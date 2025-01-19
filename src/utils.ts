import path from 'node:path';

import { Range } from 'semver';
import { match } from 'ts-pattern';
import { ListFormat, type Node, ScriptTarget, createPrinter, createSourceFile, factory } from 'typescript';

const { createNodeArray } = factory;

const printer = createPrinter();
const buffer = createSourceFile('foo.ts', '', ScriptTarget.ES2024);

export function printList(nodes: Node[]) {
  return printer.printList(ListFormat.MultiLine, createNodeArray(nodes), buffer);
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function unhandledBranch(field: unknown) {
  const stacktrace = new Error().stack;
  if (!stacktrace) {
    return;
  }

  const [, , branchLocation = 'unknown'] = stacktrace.split('\n');

  console.warn('Unhandled branch for field', field, branchLocation.trim());
}

export function splitStringByPeriodColon(title: string): [string | undefined, string] {
  const [ns, namespacedTitle] = title.split(/\.|:/);

  if (!namespacedTitle) {
    return [undefined, ns];
  }

  return [ns, namespacedTitle];
}

export function serializeLocalFileURL(relativeDirectory: string, resourcePath: string) {
  const filePath = path.join(relativeDirectory, `${resourcePath}.html`);
  const fullFilePath = `${process.cwd()}/${filePath}`;
  const localFileURL = new URL(`file://${fullFilePath}`);

  return localFileURL;
}

export function identicalArrays<T>(left: T[], right: T[], predicate: (l: T) => (r: T) => boolean) {
  return left.length === right.length && left.every((f) => right.some(predicate(f)));
}

export function extractSemanticRange(since: string | undefined, until: string | undefined) {
  const [parsedSince, parsedUntil] = [since, until].map((v) => {
    return match(/(\d+\.\d+\.\d+)/.exec(v || ''))
      .when(
        (r) => !!r,
        (result) => {
          const [, semver] = result;
          return semver;
        },
      )
      .otherwise(() => undefined);
  });

  const range = [];
  if (parsedSince) {
    range.push(`>=${parsedSince}`);
  }

  if (parsedUntil) {
    range.push(`<${parsedUntil}`);
  }

  return new Range(range.join(' ') || '*');
}
