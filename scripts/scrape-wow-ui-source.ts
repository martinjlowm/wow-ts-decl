#!/usr/bin/env node --experimental-transform-types --conditions development

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import path from 'node:path';
import luaparse from 'luaparse';
import { P, match } from 'ts-pattern';
import yargs from 'yargs';

import { isKeyValueField, toAPIDefinition } from '#@/lua-parser.js';
import type { FileAPIDocumentation, VersionedAPIDocumentation } from '#@/types.js';

const argv = await yargs(process.argv.slice(2))
  .scriptName(basename(import.meta.filename))
  .command('$0 <git-ref>', '')
  .demandCommand()
  .positional('git-ref', {
    describe: 'The branch, tag or some other git reference from which to scrape the API',
    default: 'classic_era',
    type: 'string',
  })
  .option('repository', {
    describe: 'The repository with documentation to scrape',
    default: 'https://github.com/Gethe/wow-ui-source',
    type: 'string',
  })
  .usage('$0 <git-ref>')
  .help().argv;

// Turn gitRefs into an array so we can checkout all desired versions and
// generate individual declaration files accordingly
const { gitRef, repository } = argv;

const temporaryDirectory = '.tmp';

if (!existsSync(temporaryDirectory)) {
  mkdirSync(temporaryDirectory);
}

const tmpPath = path.resolve(process.cwd(), temporaryDirectory);
const repositoryDirectory = path.resolve(tmpPath, basename(repository));

if (!existsSync(repositoryDirectory)) {
  spawnSync('git', ['clone', repository], { cwd: tmpPath, stdio: 'inherit' });
}

spawnSync('git', ['checkout', gitRef], { cwd: repositoryDirectory, stdio: 'inherit' });

const documentationPath = path.join(repositoryDirectory, 'Interface', 'AddOns', 'Blizzard_APIDocumentationGenerated');

const files = readdirSync(documentationPath).filter((file) => file.endsWith('.lua'));

const documentation: VersionedAPIDocumentation = {
  events: [],
  functions: [],
  namespaces: {},
  tables: [],
};

for (const file of files) {
  const fileContents = readFileSync(path.join(documentationPath, file)).toString();
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

  const { name, ns, ...docs } = documentationTable.fields
    .filter(isKeyValueField)
    .sort((l, r) => r.key.name.localeCompare(l.key.name))
    .reduce(toAPIDefinition, {} as Partial<FileAPIDocumentation>);

  if (name) {
    console.info('Parsed', name);
  }

  const innerDocumentation = match(ns)
    .with(P.string, (ns) => {
      const doc: Omit<VersionedAPIDocumentation, 'namespaces'> = {
        events: [],
        functions: [],
        tables: [],
      };

      documentation.namespaces[ns] = doc;

      return documentation.namespaces[ns];
    })
    .otherwise(() => documentation);

  innerDocumentation.events.push(...(docs.events || []));
  innerDocumentation.functions.push(...(docs.functions || []));
  innerDocumentation.tables.push(...(docs.tables || []));
}

const output = path.resolve(temporaryDirectory, `${gitRef}.json`);
writeFileSync(output, JSON.stringify(documentation, undefined, 2));
