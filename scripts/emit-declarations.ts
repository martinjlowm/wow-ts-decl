#!/usr/bin/env node --experimental-transform-types --conditions development

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import yargs from 'yargs';

import { API, APIBuilder } from '#@/api.js';
import { emitDeclarations } from '#@/emit-declarations.js';

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
  .demandCommand()
  .help().argv;

const { inDir, outDir, semver } = argv;

const files = readdirSync(inDir).filter((file) => file.startsWith('merged') && file.endsWith('.json'));

const versions = files
  .map((file) => /^merged-(\d+\.\d+\.\d+)\.json$/.exec(file))
  .map((regexResult) => regexResult?.[1])
  .filter(Boolean);

// TODO: Check all files before emitting. We need to identify declarations in
// common and those that are distinct to separate them into versioned files.
for (const file of files) {
  const api = API.load(readFileSync(join(inDir, file)).toString());
  emitDeclarations(api, versions);
}

// const output = resolve(outDir, 'merged.json');
// writeFileSync(output, api.serialize());
