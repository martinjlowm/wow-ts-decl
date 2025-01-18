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
