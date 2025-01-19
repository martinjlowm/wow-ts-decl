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
  .command('$0 <branch>', '')
  .demandCommand()
  .positional('branch', {
    describe: 'The branch from which to scrape the API',
    type: 'string',
  })
  .usage('$0 <branch>')
  .help().argv;

const remote = 'https://github.com/Gethe/wow-ui-source';

const { branch } = argv;
// Already handled by yargs, but the type is not narrowed
if (!branch) {
  process.exit(1);
}

const temporaryDirectory = '.tmp';

if (!existsSync(temporaryDirectory)) {
  mkdirSync(temporaryDirectory);
}

const tmpPath = path.resolve(process.cwd(), temporaryDirectory);
const repositoryDirectory = path.resolve(tmpPath, basename(remote));

if (!existsSync(repositoryDirectory)) {
  spawnSync('git', ['clone', remote], { cwd: tmpPath, stdio: 'inherit' });
}

spawnSync('git', ['checkout', branch], { cwd: repositoryDirectory, stdio: 'inherit' });

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

const output = path.resolve(temporaryDirectory, `${branch}.json`);
writeFileSync(output, JSON.stringify(documentation, undefined, 2));
