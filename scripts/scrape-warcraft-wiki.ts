#!/usr/bin/env node --experimental-transform-types --conditions development

import { writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import yargs from 'yargs';

import { API, APIFunction } from '#@/api.js';
import { WikiScraper } from '#@/wiki-scraper.js';

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

const wiki = new WikiScraper({
  cacheDirectory,
  origin: wikiOriginEndpoint,
});

const funcs = await wiki.scrape(argv.forceDownload);

for (const func of funcs) {
  api.addFunction(new APIFunction(func));
}

const output = resolve(outDir, 'wiki.json');
writeFileSync(output, api.serialize());
