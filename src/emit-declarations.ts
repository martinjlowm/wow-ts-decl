import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import kebabCase from 'lodash/kebabCase.js';
import { P, match } from 'ts-pattern';
import { type Node, NodeFlags, SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import type { APIBuilder } from '#@/api.js';
import * as luaFactory from '#@/factory.js';
import { printList } from '#@/utils.js';

const {
  createToken,
  createNull,
  createLiteralTypeNode,
  createJSDocUnknownTag,
  createJSDocParameterTag,
  createModuleBlock,
  createUnionTypeNode,
  createJSDocSeeTag,
  createModuleDeclaration,
  createJSDocReturnTag,
  createJSDocComment,
  createIdentifier,
  createNamedTupleMember,
  createKeywordTypeNode,
  createParameterDeclaration,
  createJSDocTypeExpression,
} = factory;

function mapTypeNode(type: string) {
  return match(type)
    .with('string', () => createKeywordTypeNode(SyntaxKind.StringKeyword))
    .with('boolean', () => createKeywordTypeNode(SyntaxKind.BooleanKeyword))
    .otherwise(() => createKeywordTypeNode(SyntaxKind.NumberKeyword));
}

export function emitDeclarations(api: APIBuilder, outDir: string) {
  for (const ns in api) {
    const nodes: Node[] = [];
    const isGlobal = ns === 'core';

    for (const funcTitle in api[ns]) {
      const func = api[ns][funcTitle];

      if (!func) {
        continue;
      }

      const { description, parameters, returns, events, sourceLink, since } = func;

      const parameterDeclarations = parameters.map((p) =>
        createParameterDeclaration(
          undefined,
          undefined,
          createIdentifier(p.name),
          p.nilable ? createToken(SyntaxKind.QuestionToken) : undefined,
          mapTypeNode(p.type),
        ),
      );

      const returnType = match(returns)
        .with([], () => createKeywordTypeNode(SyntaxKind.VoidKeyword))
        .with([P._], ([p]) => {
          const truthyType = mapTypeNode(p.type);
          const itemType = p.nilable
            ? createUnionTypeNode([truthyType, createLiteralTypeNode(createNull())])
            : truthyType;
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
        isGlobal ? [createToken(SyntaxKind.DeclareKeyword)] : undefined,
        undefined,
        createIdentifier(func.title),
        undefined,
        parameterDeclarations,
        returnType,
        undefined,
      );

      const tags = [];

      tags.push(
        ...parameters.map((p) =>
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
        ...returns.map((p) =>
          createJSDocReturnTag(
            createIdentifier('returns'),
            createJSDocTypeExpression(mapTypeNode(p.type)),
            [p.name, p.description].filter((pt) => !!pt).join(': '),
          ),
        ),
      );

      tags.push(createJSDocSeeTag(undefined, undefined, sourceLink));

      tags.push(
        ...events.map((e) =>
          createJSDocUnknownTag(createIdentifier('event'), [e.name, e.description].filter((pt) => !!pt).join(': ')),
        ),
      );

      if (since) {
        tags.push(createJSDocUnknownTag(createIdentifier('since'), since));
      }

      const comment = createJSDocComment(description ? `${description}\n` : undefined, tags);

      nodes.push(addSyntheticLeadingComment(comment, SyntaxKind.SingleLineCommentTrivia, '__REMOVE__', true));
      nodes.push(functionDeclaration);
    }

    const output = match(isGlobal)
      .with(true, () => nodes)
      .with(false, () => [
        createModuleDeclaration(
          [createToken(SyntaxKind.DeclareKeyword)],
          createIdentifier(ns),
          // biome-ignore lint/suspicious/noExplicitAny: Not officially supported, but there's no easy way to embed comments within a namespace
          createModuleBlock(nodes as unknown as any),
          NodeFlags.Namespace | NodeFlags.ExportContext | NodeFlags.ContextFlags,
        ),
      ])
      .exhaustive();

    if (!existsSync(outDir)) {
      mkdirSync(outDir);
    }

    // Emit, flush __REMOVE__ and run biome to format
    writeFileSync(join(outDir, `${kebabCase(ns)}.d.ts`), printList(output));
  }
}
