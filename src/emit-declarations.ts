import { join } from 'node:path';

import kebabCase from 'lodash/kebabCase.js';
import { Range, SemVer, satisfies as semverSatisfies } from 'semver';
import { P, match } from 'ts-pattern';
import { type Node, NodeFlags, SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import type { API, APIEvent, APIFunction, APITable } from '#@/api.js';
import * as luaFactory from '#@/factory.js';
import { printList } from '#@/utils.js';

const {
  createImportDeclaration,
  createToken,
  createNull,
  createLiteralTypeNode,
  createJSDocUnknownTag,
  createJSDocParameterTag,
  createModuleBlock,
  createUnionTypeNode,
  createModuleDeclaration,
  createJSDocReturnTag,
  createJSDocComment,
  createIdentifier,
  createNamedTupleMember,
  createKeywordTypeNode,
  createParameterDeclaration,
  createJSDocTypeExpression,
} = factory;

const fileCategories = new Set([
  'account',
  'achievement',
  'action',
  'activity',
  'addon',
  'archaeology',
  'arena',
  'artifact',
  'auction',
  'bank',
  'barber',
  'battlefield',
  'binding',
  'blackMarket',
  'buff',
  'calendar',
  'camera',
  'channel',
  'character',
  'characterStatistics',
  'chatInfo',
  'chatWindow',
  'class',
  'communication',
  'companion',
  'constants',
  'container',
  'currency',
  'cursor',
  'debug',
  'event',
  'global',
  'gossip',
  'groups',
  'guild',
  'inventory',
  'item',
  'map',
  'totem',
  'get',
  'set',
  'mouse',
  'cinematic',
  'model',
  'quest',
  'security',
  'spell',
  'system',
  'target',
  'texture',
  'unit',
  'zone',
]);

function mapTypeNode(type: string) {
  return match(type)
    .with('string', () => createKeywordTypeNode(SyntaxKind.StringKeyword))
    .with('boolean', () => createKeywordTypeNode(SyntaxKind.BooleanKeyword))
    .otherwise(() => createKeywordTypeNode(SyntaxKind.NumberKeyword));
}

function fileCategorizeEntry({ name, ns, iface }: { name: string; ns: string; iface?: string }) {
  const fileName = ns.replace('C_', '');
  if (fileName !== API.DEFAULT_NAMESPACE) {
    if (fileName === 'PvP') {
      return 'pvp';
    }

    return kebabCase(fileName);
  }

  if (iface) {
    return kebabCase(iface);
  }

  const keywords = name
    .replace(/pvp/i, 'Pvp')
    .replace(/GUID/, 'Guid')
    .replace(/ID/, 'Id')
    .replace(/UI/, 'Ui')
    .replace(/AFK/, 'Afk')
    .split(/(?=[A-Z])/)
    .map((word) => word.toLowerCase());

  return keywords.find((keyword) => fileCategories.has(keyword)) || 'general';
}

type APIEntities = { functions: APIFunction[]; tables: APITable[]; events: APIEvent[] };
type PathPartition = Record<string, APIEntities>;

function evaluateOutputs(versions: string[]) {
  return function partitionByPath(entityName: keyof APIEntities) {
    return (partitions: PathPartition, entity: APIEntities[typeof entityName][0]) => {
      const category = fileCategorizeEntry(entity);

      const { version } = entity;

      const paths = (() => {
        if (version.format() === '') {
          return versions.map((branch) => join(branch, category, 'index'));
        }

        return versions
          .filter((branch) => semverSatisfies(branch, version instanceof SemVer ? version.format() : version))
          .map((branch) => join(branch, category, branch));
      })();

      for (const path of paths) {
        const partition = partitions[path] || { functions: [], tables: [], events: [] };
        // biome-ignore lint/suspicious/noExplicitAny: TypeScript cannot infer a pair of entityName and the entity itself
        partition[entityName].push(entity as unknown as any);
        partitions[path] = partition;
      }

      return partitions;
    };
  };
}

function buildImports(entryNodes: string[]) {
  return Object.values(
    entryNodes
      .sort((l, r) => l.localeCompare(r))
      .reduce(
        (grouped, ref) => {
          const group = grouped[ref.substring(0, 1)] || [];
          group.push(ref);

          grouped[ref.substring(0, 1)] = group;

          return grouped;
        },
        {} as Record<string, string[]>,
      ),
  ).flatMap((reference) => {
    const [first, ...rest] = reference;
    if (!first) {
      return [];
    }

    const [firstDecl, ...restDecl] = reference.map((r) =>
      createImportDeclaration(undefined, undefined, factory.createStringLiteral(`./${r}`), undefined),
    );

    if (!firstDecl) {
      return [];
    }

    return [
      addSyntheticLeadingComment(
        addSyntheticLeadingComment(firstDecl, SyntaxKind.SingleLineCommentTrivia, '__REMOVE__', true),
        SyntaxKind.SingleLineCommentTrivia,
        ` ${first.substring(0, 1).toUpperCase()}`,
        true,
      ),
      ...restDecl,
    ];
  });
}

function createFunction(func: APIFunction, ns: string | null) {
  const parameterDeclarations = func.parameters.map((p) =>
    createParameterDeclaration(
      undefined,
      undefined,
      createIdentifier(p.name),
      p.nilable ? createToken(SyntaxKind.QuestionToken) : undefined,
      mapTypeNode(p.type),
    ),
  );

  const returnType = match(func.returns)
    .with([], () => createKeywordTypeNode(SyntaxKind.VoidKeyword))
    .with([P._], ([p]) => {
      const truthyType = mapTypeNode(p.type);
      const itemType = p.nilable ? createUnionTypeNode([truthyType, createLiteralTypeNode(createNull())]) : truthyType;
      return itemType;
    })
    .otherwise((returns) => {
      return luaFactory.createLuaMultiReturnTypeReferenceNode(
        returns.map((p) => {
          const truthyType = mapTypeNode(p.type);
          const itemType = p.nilable
            ? createUnionTypeNode([truthyType, createLiteralTypeNode(createNull())])
            : truthyType;

          return createNamedTupleMember(undefined, createIdentifier(p.name), undefined, itemType);
        }),
      );
    });

  const functionDeclaration = factory.createFunctionDeclaration(
    !ns ? [createToken(SyntaxKind.DeclareKeyword)] : undefined,
    undefined,
    createIdentifier(func.name),
    undefined,
    parameterDeclarations,
    returnType,
    undefined,
  );

  const tags = [];

  tags.push(
    ...func.parameters.map((p) =>
      createJSDocParameterTag(
        undefined,
        createIdentifier(p.name),
        true,
        createJSDocTypeExpression(mapTypeNode(p.type)),
        true,
        p.description,
      ),
    ),
  );

  tags.push(
    ...func.returns.map((p) =>
      createJSDocReturnTag(
        createIdentifier('returns'),
        createJSDocTypeExpression(mapTypeNode(p.type)),
        [p.name, p.description].filter((pt) => !!pt).join(': '),
      ),
    ),
  );

  // Add link if we need it
  // tags.push(createJSDocSeeTag(undefined, undefined, sourceLink));

  tags.push(
    ...func.events.map((e) =>
      createJSDocUnknownTag(createIdentifier('event'), [e.name, e.description].filter((pt) => !!pt).join(': ')),
    ),
  );

  const version = func.version instanceof Range ? func.version.format() : '';
  if (version) {
    tags.push(createJSDocUnknownTag(createIdentifier('version'), version));
  }

  const comment = createJSDocComment(func.description ? `${func.description}\n` : undefined, tags);

  return [
    addSyntheticLeadingComment(comment, SyntaxKind.SingleLineCommentTrivia, '__REMOVE__', true),
    functionDeclaration,
  ];
}

export function emitDeclarations(api: API, versions: string[]) {
  const { functions, tables, events } = api;

  const partitionByPath = evaluateOutputs(versions);
  const partitionedEntities = events.reduce(
    partitionByPath('events'),
    functions.reduce(partitionByPath('functions'), tables.reduce(partitionByPath('tables'), {} as PathPartition)),
  );

  const entryNodes = Object.fromEntries(versions.map((v): [string, Set<string>] => [v, new Set<string>()]));

  for (const [projectPath, { functions, tables, events }] of Object.entries(partitionedEntities)) {
    const [rootVersion, category, version] = projectPath.split('/');
    if (!rootVersion || !category || !version) {
      return;
    }

    const importReference = `${category}/${version}`;
    if (entryNodes[rootVersion]) {
      entryNodes[rootVersion].add(importReference);
    }

    const nodes: Node[] = [];

    const { [API.DEFAULT_NAMESPACE]: globalFunctions, ...namedspacedFunctions } = functions.reduce(
      (namespaces, func) => {
        const list = namespaces[func.ns] || [];
        list.push(func);

        namespaces[func.ns] = list;

        return namespaces;
      },
      {} as Record<string, APIFunction[]>,
    );

    for (const [ns, functions] of Object.entries(namedspacedFunctions)) {
      const scopedNodes: Node[] = [];

      for (const func of functions) {
        scopedNodes.push(...createFunction(func, ns));
      }

      const mod = createModuleDeclaration(
        [createToken(SyntaxKind.DeclareKeyword)],
        createIdentifier(ns),
        // biome-ignore lint/suspicious/noExplicitAny: Not officially supported, but there's no easy way to embed comments within a namespace
        createModuleBlock(scopedNodes as unknown as any),
        NodeFlags.Namespace | NodeFlags.ExportContext | NodeFlags.ContextFlags,
      );

      nodes.push(mod);
    }

    for (const func of globalFunctions || []) {
      nodes.push(...createFunction(func, null));
    }

    console.log(printList(nodes));
    // functions are global if === wowapi
    // tables follow ns always
  }

  for (const version of versions) {
    if (!entryNodes[version]) {
      continue;
    }

    printList(buildImports(entryNodes[version].values().toArray()));
  }
  // console.log(Object.keys(namespacedFunctions));
  // for (const ns in api) {
  //   const nodes: Node[] = [];
  //   const isGlobal = ns === 'core';

  //   for (const funcTitle in api[ns]) {
  //     const func = api[ns][funcTitle];

  //     if (!func) {
  //       continue;
  //     }

  //     const { description, parameters, returns, events, sourceLink, since } = func;

  //     const parameterDeclarations = parameters.map((p) =>
  //       createParameterDeclaration(
  //         undefined,
  //         undefined,
  //         createIdentifier(p.name),
  //         p.nilable ? createToken(SyntaxKind.QuestionToken) : undefined,
  //         mapTypeNode(p.type),
  //       ),
  //     );

  //     const returnType = match(returns)
  //       .with([], () => createKeywordTypeNode(SyntaxKind.VoidKeyword))
  //       .with([P._], ([p]) => {
  //         const truthyType = mapTypeNode(p.type);
  //         const itemType = p.nilable
  //           ? createUnionTypeNode([truthyType, createLiteralTypeNode(createNull())])
  //           : truthyType;
  //         return itemType;
  //       })
  //       .otherwise((returns) => {
  //         return luaFactory.createLuaMultiReturnTypeReferenceNode(
  //           returns.map((p) => {
  //             const truthyType = mapTypeNode(p.type);
  //             const itemType = p.nilable
  //               ? createUnionTypeNode([truthyType, createLiteralTypeNode(createNull())])
  //               : truthyType;

  //             return createNamedTupleMember(undefined, createIdentifier(p.name), undefined, itemType);
  //           }),
  //         );
  //       });

  //     const functionDeclaration = factory.createFunctionDeclaration(
  //       isGlobal ? [createToken(SyntaxKind.DeclareKeyword)] : undefined,
  //       undefined,
  //       createIdentifier(func.title),
  //       undefined,
  //       parameterDeclarations,
  //       returnType,
  //       undefined,
  //     );

  //     const tags = [];

  //     tags.push(
  //       ...parameters.map((p) =>
  //         createJSDocParameterTag(
  //           undefined,
  //           createIdentifier(p.name),
  //           true,
  //           createJSDocTypeExpression(mapTypeNode(p.type)),
  //           true,
  //           p.description,
  //         ),
  //       ),
  //     );

  //     tags.push(
  //       ...returns.map((p) =>
  //         createJSDocReturnTag(
  //           createIdentifier('returns'),
  //           createJSDocTypeExpression(mapTypeNode(p.type)),
  //           [p.name, p.description].filter((pt) => !!pt).join(': '),
  //         ),
  //       ),
  //     );

  //     tags.push(createJSDocSeeTag(undefined, undefined, sourceLink));

  //     tags.push(
  //       ...events.map((e) =>
  //         createJSDocUnknownTag(createIdentifier('event'), [e.name, e.description].filter((pt) => !!pt).join(': ')),
  //       ),
  //     );

  //     if (since) {
  //       tags.push(createJSDocUnknownTag(createIdentifier('since'), since));
  //     }

  //     const comment = createJSDocComment(description ? `${description}\n` : undefined, tags);

  //     nodes.push(addSyntheticLeadingComment(comment, SyntaxKind.SingleLineCommentTrivia, '__REMOVE__', true));
  //     nodes.push(functionDeclaration);
  //   }

  //   const output = match(isGlobal)
  //     .with(true, () => nodes)
  //     .with(false, () => [
  //       createModuleDeclaration(
  //         [createToken(SyntaxKind.DeclareKeyword)],
  //         createIdentifier(ns),
  //         // biome-ignore lint/suspicious/noExplicitAny: Not officially supported, but there's no easy way to embed comments within a namespace
  //         createModuleBlock(nodes as unknown as any),
  //         NodeFlags.Namespace | NodeFlags.ExportContext | NodeFlags.ContextFlags,
  //       ),
  //     ])
  //     .exhaustive();

  //   if (!existsSync(outDir)) {
  //     mkdirSync(outDir);
  //   }

  //   // Emit, flush __REMOVE__ and run biome to format
  //   writeFileSync(join(outDir, `${kebabCase(ns)}.d.ts`), printList(output));
  // }
}
