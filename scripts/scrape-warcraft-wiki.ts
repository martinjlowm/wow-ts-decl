#!/usr/bin/env node --experimental-transform-types --conditions development

import assert from 'node:assert';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import path from 'node:path';

import camelCase from 'lodash/camelCase.js';
import kebabCase from 'lodash/kebabCase.js';
import { type Locator, type Page, chromium } from 'playwright';
import { P, match } from 'ts-pattern';
import { type Node, NodeFlags, SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';
import yargs from 'yargs';

import * as luaFactory from '#@/factory.js';
import type { DocumentedVariableSignature } from '#@/types.js';
import { Duration } from '#@/units.js';
import { isCloudflareBlockedNotice, printList, serializeLocalFileURL, sleep, splitStringByPeriod } from '#@/utils.js';

const {
  createToken,
  createNull,
  createLiteralTypeNode,
  createJSDocUnknownTag,
  createJSDocParameterTag,
  createModuleBlock,
  createUnionTypeNode,
  createJSDocSeeTag,
  createModuleDeclaration,
  createJSDocReturnTag,
  createJSDocComment,
  createIdentifier,
  createNamedTupleMember,
  createKeywordTypeNode,
  createParameterDeclaration,
  createJSDocTypeExpression,
} = factory;

const ORIGIN = 'https://warcraft.wiki.gg';
const CACHE_DIRECTORY = '.cache';
const DIST_DIRECTORY = 'dist';

const cachedFiles: Record<string, string> = {};

const argv = await yargs(process.argv.slice(2))
  .scriptName(basename(import.meta.filename))
  .command('$0', '')
  .option('force-download', {
    describe: 'Force redownloading cached pages',
    default: false,
    type: 'boolean',
  })
  .demandCommand()
  .usage('$0')
  .help().argv;

const api: {
  [ns: string]: {
    [func: string]: {
      title: string;
      description: string;
      parameters: Array<{ name: string; type: string; nilable: boolean; description: string }>;
      returns: Array<{ name: string; type: string; nilable: boolean; description: string }>;
      events: Array<{ name: string; description: string }>;
      sourceLink: string;
      since?: string;
    };
  };
} = {};

const browser = await chromium.launch();

const hasCachedPages = listPages().some((entry) => entry.includes('API'));

if (!hasCachedPages || argv.forceDownload) {
  await downloadPages();
}

await scrapePages();

await browser.close();

async function cachePage(page: Page, resourcePath: string) {
  const html = await page.content();

  const localFileURL = serializeLocalFileURL(CACHE_DIRECTORY, resourcePath);

  if (isCloudflareBlockedNotice(html)) {
    delete cachedFiles[resourcePath];
    rmSync(localFileURL.pathname);
    throw new Error('Blocked');
  }

  if (existsSync(localFileURL.pathname)) {
    cachedFiles[resourcePath] = localFileURL.toString();
    return;
  }

  mkdirSync(path.dirname(localFileURL.pathname), { recursive: true });
  writeFileSync(localFileURL.pathname, html);

  console.info('Stored:', localFileURL.toString());
}

function resource(path: string) {
  const page = cachedFiles[path] || `${ORIGIN}/${path}`;
  console.info('Visiting', page);
  return page;
}

async function downloadPages() {
  const page = await browser.newPage();

  const entry = '/wiki/World_of_Warcraft_API';

  await page.goto(resource(entry));
  await cachePage(page, entry);

  const subpages = [];

  // Gets all immediate links from description details following the primary
  // headings, effectively the link of all function declarations
  const links = await page.locator('//div[@id="mw-content-text"]/div[@class="mw-parser-output"]/dl/dd/a[1]').all();

  const chunkSize = 20;
  const chunkedLinks = [...Array(Math.ceil(links.length / chunkSize))].map((_) => links.splice(0, chunkSize));

  for (const chunk of chunkedLinks) {
    subpages.push(
      ...(
        await Promise.all(
          chunk.map(async (a) => {
            const link = await a.getAttribute('href');
            if (!link?.startsWith('/')) {
              return null;
            }
            console.log('Found', link);
            return link;
          }),
        )
      ).filter((link) => typeof link === 'string'),
    );
  }

  for (const subpage of subpages) {
    let isBlockedByCloudflare = true;
    do {
      await page.goto(resource(subpage));
      try {
        await cachePage(page, subpage);
        isBlockedByCloudflare = false;
      } catch {
        await sleep(Duration.fromSeconds(1 + Math.random() * 5).asMillis());
      }
    } while (!isBlockedByCloudflare);
  }

  await browser.close();

  console.log('Page download completed!');

  await scrapePages();
}

async function toVariableSignature([lhs, rhs]: [Locator, Locator]): Promise<DocumentedVariableSignature> {
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

function mapTypeNode(type: string) {
  return match(type)
    .with('string', () => createKeywordTypeNode(SyntaxKind.StringKeyword))
    .with('boolean', () => createKeywordTypeNode(SyntaxKind.BooleanKeyword))
    .otherwise(() => createKeywordTypeNode(SyntaxKind.NumberKeyword));
}

type ScrapePageInput = {
  title: string;
  description: string;
  parameterLocators: Locator[];
  returnLocators: Locator[];
  eventTriggerLocators: Locator[];
  patchChangeLocators: Locator[];
};
async function scrapePage({
  title,
  description,
  parameterLocators,
  returnLocators,
  eventTriggerLocators,
  patchChangeLocators,
}: ScrapePageInput) {
  const [parameters = [], returns = []] = await Promise.all(
    [parameterLocators, returnLocators].map(async (locators) => {
      return Promise.all(
        locators.map(async (locator) => {
          const [variables, descriptions] = await Promise.all([
            locator.locator('dt').all(),
            locator.locator('dd').all(),
          ]);

          const zippedLines = variables.map((v, i) => [v, descriptions[i]].filter(Boolean)) as [Locator, Locator][];

          return Promise.all(zippedLines.map(toVariableSignature));
        }),
      );
    }),
  );

  const events = (await Promise.all(eventTriggerLocators.map(async (locator) => locator.textContent())))
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

  const since = (await Promise.all(patchChangeLocators.map(async (locator) => locator.textContent()))).find((t) => {
    if (!t) {
      return false;
    }

    return t.match(/added/i);
  });

  const semver = match(/(\d+\.\d+\.\d+)/.exec(since || ''))
    .when(
      (r) => !!r,
      (result) => {
        const [, semver] = result;
        return semver;
      },
    )
    .otherwise(() => undefined);

  return {
    title,
    description,
    parameters: parameters.flat(),
    returns: returns.flat(),
    events,
    since: semver,
  };
}

async function visitPage(page: Page, resourcePath: string) {
  let isBlockedByCloudflare = true;
  do {
    await page.goto(resource(resourcePath));
    try {
      await cachePage(page, resourcePath);
      isBlockedByCloudflare = false;
    } catch {
      await sleep(Duration.fromSeconds(1 + Math.random() * 5).asMillis());
    }
  } while (isBlockedByCloudflare);
}

async function scrapePages() {
  const subpages = listPages();

  const page = await browser.newPage();

  for (const subpage of subpages.splice(360, 40)) {
    await visitPage(page, subpage);

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

    const [ns, title] = splitStringByPeriod(pageTitle);
    const definition = await scrapePage({
      title,
      description,
      parameterLocators,
      returnLocators,
      eventTriggerLocators,
      patchChangeLocators,
    });

    api[ns] ||= {};
    definition.events;
    api[ns][definition.title] = {
      ...definition,
      sourceLink: `${ORIGIN}/${subpage}`,
    };
  }

  for (const ns in api) {
    const nodes: Node[] = [];
    const isGlobal = ns === 'core';

    for (const funcTitle in api[ns]) {
      const func = api[ns][funcTitle];

      if (!func) {
        continue;
      }

      const { description, parameters, returns, events, sourceLink, since } = func;

      const parameterDeclarations = parameters.map((p) =>
        createParameterDeclaration(
          undefined,
          undefined,
          createIdentifier(p.name),
          p.nilable ? createToken(SyntaxKind.QuestionToken) : undefined,
          mapTypeNode(p.type),
        ),
      );

      const returnType = match(returns)
        .with([], () => createKeywordTypeNode(SyntaxKind.VoidKeyword))
        .with([P._], ([p]) => {
          const truthyType = mapTypeNode(p.type);
          const itemType = p.nilable
            ? createUnionTypeNode([truthyType, createLiteralTypeNode(createNull())])
            : truthyType;
          return itemType;
        })
        .otherwise((returns) => {
          return luaFactory.createLuaMultiReturnTypeReferenceNode(
            returns.map((p) => {
              const truthyType = mapTypeNode(p.type);
              const itemType = p.nilable
                ? createUnionTypeNode([truthyType, createLiteralTypeNode(createNull())])
                : truthyType;

              return createNamedTupleMember(undefined, createIdentifier(p.name), undefined, itemType);
            }),
          );
        });

      const functionDeclaration = factory.createFunctionDeclaration(
        isGlobal ? [createToken(SyntaxKind.DeclareKeyword)] : undefined,
        undefined,
        createIdentifier(func.title),
        undefined,
        parameterDeclarations,
        returnType,
        undefined,
      );

      const tags = [];

      tags.push(
        ...parameters.map((p) =>
          createJSDocParameterTag(
            undefined,
            createIdentifier(p.name),
            true,
            createJSDocTypeExpression(mapTypeNode(p.type)),
            true,
            p.description,
          ),
        ),
      );

      tags.push(
        ...returns.map((p) =>
          createJSDocReturnTag(
            createIdentifier('returns'),
            createJSDocTypeExpression(mapTypeNode(p.type)),
            [p.name, p.description].filter((pt) => !!pt).join(': '),
          ),
        ),
      );

      tags.push(createJSDocSeeTag(undefined, undefined, sourceLink));

      tags.push(
        ...events.map((e) =>
          createJSDocUnknownTag(createIdentifier('event'), [e.name, e.description].filter((pt) => !!pt).join(': ')),
        ),
      );

      if (since) {
        tags.push(createJSDocUnknownTag(createIdentifier('since'), since));
      }

      const comment = createJSDocComment(description ? `${description}\n` : undefined, tags);

      nodes.push(addSyntheticLeadingComment(comment, SyntaxKind.SingleLineCommentTrivia, '__REMOVE__', true));
      nodes.push(functionDeclaration);
    }

    const output = match(isGlobal)
      .with(true, () => nodes)
      .with(false, () => [
        createModuleDeclaration(
          [createToken(SyntaxKind.DeclareKeyword)],
          createIdentifier(ns),
          // biome-ignore lint/suspicious/noExplicitAny: Not officially supported, but there's no easy way to embed comments within a namespace
          createModuleBlock(nodes as unknown as any),
          NodeFlags.Namespace | NodeFlags.ExportContext | NodeFlags.ContextFlags,
        ),
      ])
      .exhaustive();

    if (!existsSync(DIST_DIRECTORY)) {
      mkdirSync(DIST_DIRECTORY);
    }

    // Emit, flush __REMOVE__ and run biome to format
    writeFileSync(path.join(DIST_DIRECTORY, `${kebabCase(ns)}.d.ts`), printList(output));
  }

  console.log('Scraping completed');
}

function listPages() {
  const pages = readdirSync(path.join(CACHE_DIRECTORY, 'wiki')).map((p) =>
    path.join('wiki', p.substring(0, p.lastIndexOf('.'))),
  );
  for (const page of pages) {
    const localFileURL = serializeLocalFileURL(CACHE_DIRECTORY, page);
    cachedFiles[page] = localFileURL.toString();
  }

  return pages;
}
