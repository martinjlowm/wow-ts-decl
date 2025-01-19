#!/usr/bin/env node --experimental-transform-types --conditions development

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import luaparse from 'luaparse';
import { SemVer, valid } from 'semver';
import yargs from 'yargs';

import { API, APIEvent, APIFunction, APITable } from '#@/api.js';
import { isKeyValueField, toAPIDefinition } from '#@/lua-parser.js';
import type { FileAPIDocumentation } from '#@/types.js';

const argv = await yargs(process.argv.slice(2))
  .scriptName(basename(import.meta.filename))
  .command('$0 [semver..]', '')
  .demandCommand()
  .positional('semver', {
    describe: 'The (semver) version tag from which to scrape the API',
    default: ['1.15.4'],
    type: 'string',
    array: true,
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
  .option('repository', {
    describe: 'The repository with documentation to scrape',
    default: 'https://github.com/Gethe/wow-ui-source',
    type: 'string',
    array: false,
  })
  .help().argv;

const { semver, cacheDir, outDir, repository } = argv;

if (!existsSync(cacheDir)) {
  mkdirSync(cacheDir);
}

const tmpPath = resolve(process.cwd(), cacheDir);
const repositoryDirectory = resolve(tmpPath, basename(repository));

if (!existsSync(repositoryDirectory)) {
  spawnSync('git', ['clone', repository], { cwd: tmpPath, stdio: 'inherit' });
}

const validVersions = semver.filter((v) => valid(v));

console.info('Scraping:', validVersions.join(', '));

for (const version of validVersions) {
  spawnSync('git', ['checkout', version], { cwd: repositoryDirectory, stdio: 'inherit' });

  const documentationPath = join(repositoryDirectory, 'Interface', 'AddOns', 'Blizzard_APIDocumentationGenerated');

  const files = readdirSync(documentationPath).filter((file) => file.endsWith('.lua'));

  const api = new API();

  for (const file of files) {
    const fileContents = readFileSync(join(documentationPath, file)).toString();
    const ast = luaparse.parse(fileContents);

    const definitionTable = ast.body.find((node) => node.type === 'LocalStatement');
    if (!definitionTable) {
      continue;
    }

    const [documentationTable] = definitionTable.init;
    if (documentationTable?.type !== 'TableConstructorExpression') {
      console.warn(`Table in ${file} was not the expected type of a TableConstructorExpression`);
      continue;
    }

    const {
      name,
      ns,
      events = [],
      functions = [],
      tables = [],
    } = documentationTable.fields
      .filter(isKeyValueField)
      .sort((l, r) => r.key.name.localeCompare(l.key.name))
      .reduce(toAPIDefinition, {} as Partial<FileAPIDocumentation>);

    if (name) {
      console.info('Parsed', name);
    }

    for (const func of functions.map((f) => new APIFunction({ ...f, version: new SemVer(version), ns }))) {
      api.addFunction(func);
    }

    for (const event of events.map((e) => new APIEvent({ ...e, version: new SemVer(version), ns }))) {
      api.addEvent(event);
    }

    for (const table of tables.map((e) => new APITable({ ...e, version: new SemVer(version), ns }))) {
      api.addTable(table);
    }
  }

  const output = resolve(outDir, `wow-ui-source-${version}.json`);
  writeFileSync(output, api.serialize());
}
