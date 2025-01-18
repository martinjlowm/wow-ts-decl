import path from 'node:path';

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

export function splitStringByPeriod(title: string): [string, string] {
  const [ns, namespacedTitle] = title.split('.');

  if (!namespacedTitle) {
    return ['core', ns];
  }

  return [ns, namespacedTitle];
}

// Cloudflare responds with a block notice splash screen when bot-like behavior
// is detected
export function isCloudflareBlockedNotice(content: string) {
  return content.includes('Sorry, you have been blocked') || content.includes('challenge-error-text');
}

export function serializeLocalFileURL(relativeDirectory: string, resourcePath: string) {
  const filePath = path.join(relativeDirectory, `${resourcePath}.html`);
  const fullFilePath = `${process.cwd()}/${filePath}`;
  const localFileURL = new URL(`file://${fullFilePath}`);

  return localFileURL;
}
