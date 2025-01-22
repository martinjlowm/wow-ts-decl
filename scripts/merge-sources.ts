#!/usr/bin/env node --experimental-transform-types --conditions development

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import { SemVer, valid } from 'semver';
import yargs from 'yargs';

import { API, APIBuilder } from '#@/api.js';

const argv = await yargs(process.argv.slice(2))
  .scriptName(basename(import.meta.filename))
  .command('$0 [semver..]', '')
  .option('in-dir', {
    describe: 'The directory with all API JSON data',
    default: '.tmp',
    type: 'string',
  })
  .option('out-dir', {
    describe: 'Directory to emit output',
    default: '.tmp',
    type: 'string',
  })
  .positional('semver', {
    describe: 'The (semver) versions to merge documentation for',
    default: ['1.15.4'],
    type: 'string',
    array: true,
  })
  .demandCommand()
  .help().argv;

const { inDir, outDir, semver } = argv;

const files = readdirSync(inDir).filter((file) => file.endsWith('.json') && !file.startsWith('merged'));
const apiBuilder = new APIBuilder();

const validVersions = semver.filter((v) => valid(v));

console.info('Building for:', validVersions.join(', '));

for (const version of validVersions) {
  for (const file of files) {
    const api = API.load(readFileSync(join(inDir, file)).toString());
    apiBuilder.add(api);
  }

  const api = apiBuilder.merge();
  if (!api) {
    console.error('Failed to merge APIs');
    process.exit(1);
  }

  const filteredAPI = api.filterForVersion(new SemVer(version));

  const output = resolve(outDir, `merged-${version}.json`);
  writeFileSync(output, filteredAPI.serialize());
}
