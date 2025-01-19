#!/usr/bin/env node --experimental-transform-types --conditions development

import { writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { chromium } from 'playwright';
import yargs from 'yargs';

import { API } from '#@/api.js';
import { cachePage, listPages, resourceReference, scrapePages, visitPage } from '#@/playwright.js';

const cachedFiles: Record<string, string> = {};

const argv = await yargs(process.argv.slice(2))
  .scriptName(basename(import.meta.filename))
  .command('$0 [wiki-origin-endpoint]', '')
  .option('force-download', {
    describe: 'Force redownloading cached pages',
    default: false,
    type: 'boolean',
  })
  .option('cache-dir', {
    describe: 'Directory to cache visited pages',
    default: '.cache',
    type: 'string',
  })
  .option('out-dir', {
    describe: 'Directory to emit output',
    default: 'dist',
    type: 'string',
  })
  .option('wiki-origin-endpoint', {
    describe: 'The wiki page from which the API documentation can be scraped.',
    default: 'https://warcraft.wiki.gg',
    type: 'string',
  })
  .demandCommand()
  .usage('$0')
  .help().argv;

const { outDir, cacheDir: cacheDirectory, wikiOriginEndpoint } = argv;

const api = new API();

const browser = await chromium.launch();

const hasCachedPages = listPages(cacheDirectory, cachedFiles).some((entry) => entry.includes('API'));

if (!hasCachedPages || argv.forceDownload) {
  await downloadPages();
}

await scrapePages(browser, cachedFiles, wikiOriginEndpoint, api, cacheDirectory, outDir);

const output = resolve(outDir, 'wiki.json');
writeFileSync(output, api.serialize());

await browser.close();

async function downloadPages() {
  const page = await browser.newPage();

  const entry = '/wiki/World_of_Warcraft_API';

  await page.goto(resourceReference(cachedFiles, wikiOriginEndpoint, entry));

  await cachePage(cacheDirectory, cachedFiles, page, entry);

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
    await visitPage(cacheDirectory, cachedFiles, page, wikiOriginEndpoint, subpage);
  }

  console.info('Page download completed!');
}
