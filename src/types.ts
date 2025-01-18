import fs from 'node:fs';
import { EmitHint, ScriptTarget, SyntaxKind, createPrinter, createSourceFile, factory } from 'typescript';

import path from 'node:path';
import luaparse from 'luaparse';
import { match } from 'ts-pattern';

// Parse all branches and emit API variants
// Parse wowpedia and merge missing functions and docs
// Map to TS structure and emit files nested under WoWAPI

const printer = createPrinter();
const buffer = createSourceFile('dummy.ts', '', ScriptTarget.ES2015);
const { createKeywordTypeNode, createFunctionDeclaration } = factory;

const documentationPath = path.join('Interface', 'AddOns', 'Blizzard_APIDocumentationGenerated');

const files = fs.readdirSync(documentationPath).filter((file) => file.endsWith('.lua'));

type TableField = luaparse.TableValue & {
  value: luaparse.TableConstructorExpression;
};

type FunctionSignature = {
  name: string;
  type: string;
  arguments: VariableSignature[];
  returns: VariableSignature[];
};

type TableSignature = {
  name: string;
  fields: VariableSignature[];
};

type APIDefinition = {
  name: string;
  type: string;
  namespace: string;
  functions: FunctionSignature[];
  tables: TableSignature[];
};

type VariableSignature = {
  name: string;
  type: string;
  nilable: boolean;
};

function toAPIDefinition(apiDefinition: APIDefinition, field: luaparse.TableKeyString) {
  switch (true) {
    case isName(field): {
      apiDefinition.name = JSON.parse(field.value.raw);
      break;
    }
    case isNamespace(field): {
      apiDefinition.namespace = JSON.parse(field.value.raw);
      break;
    }
    case isFunctionList(field): {
      apiDefinition.functions = field.value.fields.filter(isTableField).map((func) => {
        return func.value.fields.filter(isKeyValueField).reduce(toFunction, {} as FunctionSignature);
      });
      break;
    }
    case isTableList(field): {
      apiDefinition.tables = field.value.fields.filter(isTableField).map((func) => {
        return func.value.fields.filter(isKeyValueField).reduce(toTable, {} as TableSignature);
      });
      break;
    }
  }

  return apiDefinition;
}

function toProperty(field: TableField) {
  return field.value.fields.filter(isKeyValueField).reduce(toVariableSignature, {} as VariableSignature);
}

function toFunction(func: FunctionSignature, field: luaparse.TableKeyString) {
  switch (true) {
    case isName(field): {
      func.name = JSON.parse(field.value.raw);
      break;
    }
    case isType(field): {
      func.type = JSON.parse(field.value.raw);
      break;
    }
    case isArguments(field): {
      func.arguments = field.value.fields.filter(isTableField).map(toProperty);

      break;
    }
    case isReturns(field): {
      func.returns = field.value.fields.filter(isTableField).map(toProperty);

      break;
    }
  }

  return func;
}

function toTable(table: TableSignature, field: luaparse.TableKeyString) {
  switch (true) {
    case isName(field): {
      table.name = JSON.parse(field.value.raw);
      break;
    }
    case isFields(field): {
      table.fields = field.value.fields.filter(isTableField).map(toProperty);
      break;
    }
  }

  return table;
}

function toVariableSignature(signature: VariableSignature, field: luaparse.TableKeyString) {
  switch (true) {
    case isName(field): {
      signature.name = JSON.parse(field.value.raw);
      break;
    }
    case isType(field): {
      const type = JSON.parse(field.value.raw);
      const convertedType = match(type)
        .with('cstring', () =>
          printer.printNode(EmitHint.Unspecified, createKeywordTypeNode(SyntaxKind.StringKeyword), buffer),
        )
        .with('bool', () =>
          printer.printNode(EmitHint.Unspecified, createKeywordTypeNode(SyntaxKind.BooleanKeyword), buffer),
        )
        .with('table', () =>
          printer.printNode(EmitHint.Unspecified, createKeywordTypeNode(SyntaxKind.ObjectKeyword), buffer),
        )
        .otherwise((t) => t);

      signature.type = convertedType;
      break;
    }
    case isNilable(field): {
      signature.nilable = field.value.value;
      break;
    }
  }

  return signature;
}

function isKeyValueField(
  field: luaparse.TableKey | luaparse.TableKeyString | luaparse.TableValue,
): field is luaparse.TableKeyString {
  return field.type === 'TableKeyString';
}
function isName(field: luaparse.TableKeyString): field is luaparse.TableKeyString & { value: luaparse.StringLiteral } {
  return field.key.name === 'Name' && field.value.type === 'StringLiteral';
}
function isType(field: luaparse.TableKeyString): field is luaparse.TableKeyString & { value: luaparse.StringLiteral } {
  return field.key.name === 'Type' && field.value.type === 'StringLiteral';
}
function isNilable(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.BooleanLiteral } {
  return field.key.name === 'Nilable' && field.value.type === 'BooleanLiteral';
}

function isNamespace(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.StringLiteral } {
  return field.key.name === 'Namespace' && field.value.type === 'StringLiteral';
}

function isFields(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.TableConstructorExpression } {
  return field.key.name === 'Fields' && field.value.type === 'TableConstructorExpression';
}

function isFunctionList(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.TableConstructorExpression;
} {
  return field.key.name === 'Functions' && field.value.type === 'TableConstructorExpression';
}
function isTableList(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.TableConstructorExpression;
} {
  return field.key.name === 'Tables' && field.value.type === 'TableConstructorExpression';
}

function isTableField(field: luaparse.TableKey | luaparse.TableKeyString | luaparse.TableValue): field is TableField {
  return field.type === 'TableValue' && field.value.type === 'TableConstructorExpression';
}

function isArguments(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.TableConstructorExpression;
} {
  return field.key.name === 'Arguments' && field.value.type === 'TableConstructorExpression';
}
function isReturns(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.TableConstructorExpression;
} {
  return field.key.name === 'Returns' && field.value.type === 'TableConstructorExpression';
}

for (const file of files) {
  const fileContents = fs.readFileSync(path.join(documentationPath, file)).toString();
  const ast = luaparse.parse(fileContents);

  const definitionTable = ast.body.find((node) => node.type === 'LocalStatement');
  if (!definitionTable) {
    continue;
  }

  const [documentationTable] = definitionTable.init;
  if (documentationTable?.type !== 'TableConstructorExpression') {
    continue;
  }

  console.log(
    JSON.stringify(
      documentationTable.fields.filter(isKeyValueField).reduce(toAPIDefinition, {} as APIDefinition),
      undefined,
      2,
    ),
  );
}

// const parameters = [];
// createFunctionDeclaration(undefined, undefined, 'IsDelveInProgress', undefined, parameters, )
