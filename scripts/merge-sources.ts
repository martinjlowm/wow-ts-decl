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
    default: 'dist',
    type: 'string',
  })
  .positional('semver', {
    describe: 'The (semver) versions to generate documentation for',
    default: ['1.15.4'],
    type: 'string',
    array: true,
  })
  .demandCommand()
  .help().argv;

const { inDir, outDir, semver } = argv;

const files = readdirSync(inDir).filter((file) => file.endsWith('.json'));
const apiBuilder = new APIBuilder({ outDir });

const validVersions = semver.filter((v) => valid(v));

console.info('Building for:', validVersions.join(', '));

for (const version of validVersions) {
  for (const file of files) {
    try {
      const api = API.load(readFileSync(join(inDir, file)).toString());
      const filteredAPI = api.filterForVersion(new SemVer(version));
      apiBuilder.add(filteredAPI);
    } catch (error) {
      console.error(error.message);
      console.log(join(inDir, file));
    }
    break;
  }
}

const api = apiBuilder.merge();
if (!api) {
  console.error('Failed to merge APIs');
  process.exit(1);
}
// TODO: Emit declarations in a tree within dist

const output = resolve(outDir, 'merged.json');
writeFileSync(output, api.serialize());
