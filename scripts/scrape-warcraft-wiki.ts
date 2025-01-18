#!/usr/bin/env node --experimental-transform-types --conditions development

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import camelCase from 'lodash/camelCase.js';
import kebabCase from 'lodash/kebabCase.js';
import { type Browser, type Locator, type Page, chromium } from 'playwright';
import { match } from 'ts-pattern';
import { type Node, NodeFlags, SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import * as luaFactory from '#@/factory.js';
import { Duration } from '#@/units.js';
import { sleep } from '#@/utils.js';

const {
  createToken,
  createJSDocUnknownTag,
  createJSDocParameterTag,
  createModuleBlock,
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

let browser: Browser | undefined;
const origin = 'https://warcraft.wiki.gg';

const cacheDirectory = '.cache';
const cachedFiles: Record<string, string> = {};

function extractNamespace(title: string): [string, string] {
  const [ns, namespacedTitle] = title.split('.');

  if (!namespacedTitle) {
    return ['core', ns];
  }

  return [ns, namespacedTitle];
}

function isCloudflareBlockedNotice(content: string) {
  return content.includes('Sorry, you have been blocked') || content.includes('challenge-error-text');
}

function serializeLocalFileURL(resourcePath: string) {
  const filePath = path.join(cacheDirectory, `${resourcePath}.html`);
  const fullFilePath = `${import.meta.dirname}/${filePath}`;
  const localFileURL = new URL(`file://${fullFilePath}`);

  return localFileURL;
}

async function cachePage(page: Page, resourcePath: string) {
  const html = await page.content();

  const localFileURL = serializeLocalFileURL(resourcePath);

  if (isCloudflareBlockedNotice(html)) {
    delete cachedFiles[resourcePath];
    fs.rmSync(localFileURL.pathname);
    throw new Error('Blocked');
  }

  if (fs.existsSync(localFileURL.pathname)) {
    cachedFiles[resourcePath] = localFileURL.toString();
    return;
  }

  fs.mkdirSync(path.dirname(localFileURL.pathname), { recursive: true });
  fs.writeFileSync(localFileURL.pathname, html);

  console.info('Stored:', localFileURL);
}

function resource(path: string) {
  const page = cachedFiles[path] || `${origin}/${path}`;
  console.info('Visiting', page);
  return page;
}

async function downloadPages() {
  browser ||= await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
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

async function toVariableSignature([lhs, rhs]: [Locator, Locator]) {
  const variableDetails = await rhs.textContent();
  assert(variableDetails, 'Failed to extract variable details');

  const [_type, description] = variableDetails.trim().split(' - ');
  const [t, opt] = _type.split(/(?=\?)/);

  const variableName = await lhs.textContent();
  assert(variableName, 'Failed to extract variable name');

  return {
    name: camelCase(variableName.trim()),
    type: t,
    nilable: opt === '?',
    description,
  };
}

const api: {
  [ns: string]: {
    [func: string]: {
      summary: string;
      parameters: Array<{ name: string; type: string; nilable: boolean; description: string }>;
      returns: Array<{ name: string; type: string; nilable: boolean; description: string }>;
      sourceLink?: string;
      since?: string;
    };
  };
} = {};

function mapTypeNode(type: string) {
  return match(type)
    .with('string', () => createKeywordTypeNode(SyntaxKind.StringKeyword))
    .with('boolean', () => createKeywordTypeNode(SyntaxKind.BooleanKeyword))
    .otherwise(() => createKeywordTypeNode(SyntaxKind.NumberKeyword));
}

async function scrapePages() {
  const subpages = listPages();

  browser ||= await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage();

  for (const subpage of subpages.splice(30, 40)) {
    let parsed = false;
    do {
      let isBlockedByCloudflare = true;
      do {
        await page.goto(resource(subpage));
        try {
          await cachePage(page, subpage);
          isBlockedByCloudflare = false;
        } catch {
          await sleep(Duration.fromSeconds(1 + Math.random() * 5).asMillis());
        }
      } while (isBlockedByCloudflare);

      const pageTitle = (await page.locator('h1').first().textContent())?.trim();
      assert(pageTitle, 'Failed to find a page title!');

      const [ns, namespacedTitle] = extractNamespace(pageTitle);

      api[ns] ||= {};
      // biome-ignore lint/suspicious/noExplicitAny: TODO
      api[ns][namespacedTitle] ||= { summary: null, parameters: [], returns: [] } as any;
      const summaryNode = page.locator('//div[@id="mw-content-text"]/div[@class="mw-parser-output"]/p[1]');

      api[ns][namespacedTitle].summary = (await summaryNode.textContent()).trim();

      const subheaders = await summaryNode
        .locator('//following-sibling::h2')
        .filter({ has: page.locator('text="Arguments"').or(page.locator('text="Returns"')) })
        .all();
      for (const subheader of subheaders) {
        const isArguments = !!(await subheader.filter({ hasText: 'Arguments' }).all()).length;
        if (isArguments) {
          const argumentsNode = subheader.locator('//following-sibling::dl[1]/dd/dl');
          const variables = await argumentsNode.locator('dt').all();
          const descriptions = await argumentsNode.locator('dd').all();

          api[ns][namespacedTitle].parameters.push(
            ...(await Promise.all(variables.map((v, i) => [v, descriptions[i]]).map(toVariableSignature))),
          );
        } else {
          const returnsNode = subheader.locator('//following-sibling::dl[1]/dd/dl');
          const variables = await returnsNode.locator('dt').all();
          const descriptions = await returnsNode.locator('dd').all();

          api[ns][namespacedTitle].returns.push(
            ...(await Promise.all(variables.map((v, i) => [v, descriptions[i]]).map(toVariableSignature))),
          );
        }
      }

      parsed = true;
    } while (!parsed);
  }

  for (const ns in api) {
    const nodes: Node[] = [];
    const isGlobal = ns === 'core';

    for (const func in api[ns]) {
      const { summary, parameters, returns, sourceLink = 'http://localhost', since = '1.0.0' } = api[ns][func];

      const parameterDeclarations = parameters.map((p) =>
        createParameterDeclaration(
          undefined,
          undefined,
          createIdentifier(p.name),
          p.nilable ? createToken(SyntaxKind.QuestionToken) : undefined,
          mapTypeNode(p.type),
        ),
      );
      const returnType = luaFactory.createLuaMultiReturnTypeReferenceNode(
        returns.map((p) =>
          createNamedTupleMember(
            undefined,
            createIdentifier(p.name),
            p.nilable ? createToken(SyntaxKind.QuestionToken) : undefined,
            mapTypeNode(p.type),
          ),
        ),
      );

      const functionDeclaration = factory.createFunctionDeclaration(
        isGlobal ? [createToken(SyntaxKind.DeclareKeyword)] : undefined,
        undefined,
        createIdentifier(func),
        undefined,
        parameterDeclarations,
        returnType,
        undefined,
      );

      const comment = createJSDocComment(summary ? `${summary}\n` : undefined, [
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
        ...returns.map((p) =>
          createJSDocReturnTag(
            createIdentifier('returns'),
            createJSDocTypeExpression(mapTypeNode(p.type)),
            [p.name, p.description].filter((pt) => !!pt).join(': '),
          ),
        ),
        createJSDocSeeTag(undefined, undefined, sourceLink),
        createJSDocUnknownTag(createIdentifier('since'), since),
      ]);

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

    console.log(printList(output));
    // Emit, flush __REMOVE__ and run biome to format
    fs.writeFileSync(`${kebabCase(ns)}.d.ts`, printList(output));
  }

  await browser.close();

  console.log('Scraping completed');
}

function listPages() {
  const pages = fs
    .readdirSync(path.join(cacheDirectory, 'wiki'))
    .map((p) => path.join('wiki', p.substring(0, p.lastIndexOf('.'))));
  for (const page of pages) {
    const localFileURL = serializeLocalFileURL(page);
    cachedFiles[page] = localFileURL;
  }

  return pages;
}

const hasCachedPages = listPages().some((entry) => entry.includes('API'));

const [, , action] = process.argv;
const scrape = action === '--scrape';

if (scrape || !hasCachedPages) {
  downloadPages();
} else {
  scrapePages();
}
