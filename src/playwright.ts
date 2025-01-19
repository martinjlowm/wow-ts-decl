import assert from 'node:assert';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import camelCase from 'lodash/camelCase.js';
import type { Browser, Locator, Page } from 'playwright';
import { Range } from 'semver';
import { match } from 'ts-pattern';

import { type API, APIFunction } from '#@/api.js';
import { emitDeclarations } from '#@/emit-declarations.js';
import type { DocumentedVariableSignature } from '#@/types.js';
import { Duration } from '#@/units.js';
import { extractSemanticRange, serializeLocalFileURL, sleep, splitStringByPeriod } from '#@/utils.js';

// Cloudflare responds with a block notice splash screen when bot-like behavior
// is detected
export function isCloudflareBlockedNotice(content: string) {
  return content.includes('Sorry, you have been blocked') || content.includes('challenge-error-text');
}

export async function cachePage(
  cacheDirectory: string,
  cachedFiles: Record<string, string>,
  page: Page,
  resourcePath: string,
) {
  const html = await page.content();

  const localFileURL = serializeLocalFileURL(cacheDirectory, resourcePath);

  if (isCloudflareBlockedNotice(html)) {
    delete cachedFiles[resourcePath];
    rmSync(localFileURL.pathname);
    throw new Error('Blocked');
  }

  if (existsSync(localFileURL.pathname)) {
    cachedFiles[resourcePath] = localFileURL.toString();
    return;
  }

  mkdirSync(dirname(localFileURL.pathname), { recursive: true });
  writeFileSync(localFileURL.pathname, html);

  console.info('Stored:', localFileURL.toString());
}

export function resourceReference(cachedFiles: Record<string, string>, origin: string, path: string) {
  const page = cachedFiles[path] || `${origin}/${path}`;
  console.info('Visiting', page);
  return page;
}

export async function visitPage(
  cacheDirectory: string,
  cachedFiles: Record<string, string>,
  page: Page,
  origin: string,
  resourcePath: string,
) {
  let isBlockedByCloudflare = true;
  do {
    await page.goto(resourceReference(cachedFiles, origin, resourcePath));
    try {
      await cachePage(cacheDirectory, cachedFiles, page, resourcePath);
      isBlockedByCloudflare = false;
    } catch {
      await sleep(Duration.fromSeconds(1 + Math.random() * 5).asMillis());
    }
  } while (isBlockedByCloudflare);
}

export async function parseLocatorPairToVariableSignature([lhs, rhs]: [
  Locator,
  Locator,
]): Promise<DocumentedVariableSignature> {
  const [variableName, variableDetails] = await Promise.all([lhs.textContent(), rhs.textContent()]);

  assert(variableName, 'Failed to extract variable name');
  assert(variableDetails, 'Failed to extract variable details');

  const [_type, description = ''] = variableDetails.trim().split(' - ');
  const [t, opt] = _type.split(/(?=\?)/);

  return {
    name: camelCase(variableName.trim()),
    type: t,
    nilable: opt === '?',
    description,
  };
}

type ScrapePageInput = {
  pageTitle: string;
  description: string;
  parameterLocators: Locator[];
  returnLocators: Locator[];
  eventTriggerLocators: Locator[];
  patchChangeLocators: Locator[];
};
export async function scrapePage({
  pageTitle,
  description,
  parameterLocators,
  returnLocators,
  eventTriggerLocators,
  patchChangeLocators,
}: ScrapePageInput) {
  const [ns, name] = splitStringByPeriod(pageTitle);

  const [parameters = [], returns = []] = await Promise.all(
    [parameterLocators, returnLocators].map(async (locators) => {
      return Promise.all(
        locators.map(async (locator) => {
          const [variables, descriptions] = await Promise.all([
            locator.locator('dt').all(),
            locator.locator('dd').all(),
          ]);

          const zippedLines = variables.map((v, i) => [v, descriptions[i]].filter(Boolean)) as [Locator, Locator][];

          return Promise.all(zippedLines.map(parseLocatorPairToVariableSignature));
        }),
      );
    }),
  );

  const [eventsText, patchChangesText] = await Promise.all([
    Promise.all(eventTriggerLocators.map(async (locator) => locator.textContent())),
    Promise.all(patchChangeLocators.map(async (locator) => locator.textContent())),
  ]);

  const events = eventsText
    .map((eventEntry) => {
      if (!eventEntry) {
        return null;
      }

      return match(/([A-Z_]+)(.*)/.exec(eventEntry))
        .when(
          (r) => !!r,
          (result) => {
            const [, name = null, description = ''] = result;
            return name ? { name, description } : null;
          },
        )
        .otherwise(() => null);
    })
    .filter(Boolean);

  const since = patchChangesText.filter(Boolean).find((t) => {
    if (!t) {
      return false;
    }

    return t.match(/added/i);
  });

  const until = patchChangesText.filter(Boolean).find((t) => {
    if (!t) {
      return false;
    }

    return t.match(/removed/i);
  });

  return {
    name,
    ns,
    description,
    parameters: parameters.flat(),
    returns: returns.flat(),
    events,
    version: extractSemanticRange(since, until),
  };
}

export function listPages(cacheDirectory: string, cachedFiles: Record<string, string>) {
  const pages = readdirSync(join(cacheDirectory, 'wiki')).map((p) => join('wiki', p.substring(0, p.lastIndexOf('.'))));

  for (const page of pages) {
    const localFileURL = serializeLocalFileURL(cacheDirectory, page);
    cachedFiles[page] = localFileURL.toString();
  }

  return pages;
}

export async function scrapePages(
  browser: Browser,
  cachedFiles: Record<string, string>,
  origin: string,
  api: API,
  cacheDirectory: string,
  outDir: string,
) {
  const subpages = listPages(cacheDirectory, cachedFiles);

  const page = await browser.newPage();

  for (const subpage of subpages.splice(0, 10)) {
    await visitPage(cacheDirectory, cachedFiles, page, origin, subpage);

    const pageTitleLocator = page.locator('h1').first();
    const pageBody = page.locator('//div[@id="mw-content-text"]/div[@class="mw-parser-output"]');

    const descriptionLocator = pageBody.locator('> p:first-of-type');

    const parametersHeaderLocator = pageBody.locator('h2:has(> #Arguments)');
    const returnsHeaderLocator = pageBody.locator('h2:has(> #Returns)');
    const eventTriggersHeaderLocator = pageBody.locator('h2:has(> #Triggers_events)');
    const patchChangesHeaderLocator = pageBody.locator('h2:has(> #Patch_changes)');

    const [pageTitle, description, parameterLocators, returnLocators, eventTriggerLocators, patchChangeLocators] =
      await Promise.all([
        pageTitleLocator.textContent().then((content) => content?.trim()),
        descriptionLocator.textContent().then((content) => content?.trim()),
        parametersHeaderLocator.locator('//following-sibling::dl[1]/dd/dl').all(),
        returnsHeaderLocator.locator('//following-sibling::dl[1]/dd/dl').all(),
        eventTriggersHeaderLocator.locator('//following-sibling::ul[1]/li').all(),
        patchChangesHeaderLocator.locator('//following-sibling::ul[1]/li').all(),
      ] as const);

    if (!pageTitle || !description) {
      console.log('Skipped', subpage);

      // SPecial handling for
      // match(pageTitle)
      //   .with('SPECIAL', ()=> {
      //   });
      continue;
    }

    const definition = await scrapePage({
      pageTitle,
      description,
      parameterLocators,
      returnLocators,
      eventTriggerLocators,
      patchChangeLocators,
    });

    api.addFunction(new APIFunction(definition));
  }

  console.log('Scraping completed');

  // return emitDeclarations(api, outDir);
}
