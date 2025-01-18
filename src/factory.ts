import { type TypeNode, factory } from 'typescript';

const { createTypeReferenceNode, createTupleTypeNode, createIdentifier } = factory;

export function createLuaMultiReturnTypeReferenceNode(typeArguments: readonly TypeNode[]) {
  const identifier = createIdentifier('LuaMultiReturn');

  return createTypeReferenceNode(identifier, [createTupleTypeNode(typeArguments)]);
}

export function createLuaIterableTypeReferenceNode(typeArgument: TypeNode) {
  const identifier = createIdentifier('LuaIterable');

  return createTypeReferenceNode(identifier, [typeArgument]);
}

export function createLuaIteratorTypeReferenceNode(leftTypeArgument: TypeNode, rightTypeArgument: TypeNode) {
  const identifier = createIdentifier('LuaIterator');

  return createTypeReferenceNode(identifier, [leftTypeArgument, rightTypeArgument]);
}

export function createLuaPairsIterableTypeReferenceNode(typeArguments: readonly TypeNode[]) {
  const identifier = createIdentifier('LuaPairsIterable');

  return createTypeReferenceNode(identifier, typeArguments);
}

export function createLuaPairsKeyIterableTypeReferenceNode(typeArgument: TypeNode) {
  const identifier = createIdentifier('LuaPairsKeyIterable');

  return createTypeReferenceNode(identifier, [typeArgument]);
}

export function createLuaTableTypeReferenceNode(leftTypeArgument: TypeNode, rightTypeArgument: TypeNode) {
  const identifier = createIdentifier('LuaTable');

  return createTypeReferenceNode(identifier, [leftTypeArgument, rightTypeArgument]);
}
