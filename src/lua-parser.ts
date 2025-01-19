import type luaparse from 'luaparse';
import { match } from 'ts-pattern';
import { SyntaxKind, factory } from 'typescript';

import type {
  EventSignature,
  FileAPIDocumentation,
  FunctionSignature,
  TableSignature,
  VariableSignature,
} from '#@/types.js';
import { printList, unhandledBranch } from '#@/utils.js';

const { createKeywordTypeNode } = factory;

const visitedTypes = new Set<string>();

type TableField = luaparse.TableValue & {
  value: luaparse.TableConstructorExpression;
};

export function toAPIDefinition(apiDefinition: Partial<FileAPIDocumentation>, field: luaparse.TableKeyString) {
  switch (true) {
    case isName(field): {
      apiDefinition.name = JSON.parse(field.value.raw);
      break;
    }
    case isNamespace(field): {
      apiDefinition.ns = JSON.parse(field.value.raw);
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
    case isEventList(field): {
      apiDefinition.events = field.value.fields.filter(isTableField).map((func) => {
        return func.value.fields.filter(isKeyValueField).reduce(toEvent, {} as EventSignature);
      });
      break;
    }
    default:
      unhandledBranch(field);
  }

  return apiDefinition;
}

export function toProperty(field: TableField) {
  return field.value.fields.filter(isKeyValueField).reduce(toVariableSignature, {} as VariableSignature);
}

export function toFunction(func: FunctionSignature, field: luaparse.TableKeyString) {
  switch (true) {
    case isName(field): {
      func.name = JSON.parse(field.value.raw);
      break;
    }
    case isType(field): {
      // Don't care
      // func.type = JSON.parse(field.value.raw);
      break;
    }
    case isParameters(field): {
      func.parameters = field.value.fields.filter(isTableField).map(toProperty);

      break;
    }
    case isReturns(field): {
      func.returns = field.value.fields.filter(isTableField).map(toProperty);

      break;
    }
    default:
      unhandledBranch(field);
  }

  return func;
}

export function toTable(table: TableSignature, field: luaparse.TableKeyString) {
  switch (true) {
    case isName(field): {
      table.name = JSON.parse(field.value.raw);
      visitedTypes.add(table.name);
      break;
    }
    case isFields(field): {
      table.fields = field.value.fields.filter(isTableField).map(toProperty);
      break;
    }
    default:
      unhandledBranch(field);
  }

  return table;
}

export function toEvent(event: EventSignature, field: luaparse.TableKeyString) {
  switch (true) {
    case isName(field): {
      event.name = JSON.parse(field.value.raw);
      break;
    }
    case isLiteralName(field): {
      event.literalName = JSON.parse(field.value.raw);
      break;
    }
    case isType(field): {
      // Don't care
      // event.type = JSON.parse(field.value.raw);
      break;
    }
    case isFields(field): {
      event.payload = field.value.fields.filter(isTableField).map(toProperty);
      break;
    }
    default:
      unhandledBranch(field);
  }

  return event;
}

export function toVariableSignature(signature: VariableSignature, field: luaparse.TableKeyString) {
  switch (true) {
    case isName(field): {
      signature.name = JSON.parse(field.value.raw);
      break;
    }
    case isType(field): {
      const type = JSON.parse(field.value.raw);
      const convertedType = match(type)
        .with('cstring', () => printList([createKeywordTypeNode(SyntaxKind.StringKeyword)]))
        .with('bool', () => printList([createKeywordTypeNode(SyntaxKind.BooleanKeyword)]))
        .with('table', () => printList([createKeywordTypeNode(SyntaxKind.ObjectKeyword)]))
        .with('number', (t) => t)
        .otherwise((t) => {
          if (!visitedTypes.has(t)) {
            console.warn("Found a type that wasn't mapped", t);
          }

          return t;
        });

      signature.type = convertedType;
      break;
    }
    case isNilable(field): {
      signature.nilable = field.value.value;
      break;
    }
    default:
      unhandledBranch(field);
  }

  return signature;
}

export function isKeyValueField(
  field: luaparse.TableKey | luaparse.TableKeyString | luaparse.TableValue,
): field is luaparse.TableKeyString {
  return field.type === 'TableKeyString';
}
export function isName(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.StringLiteral } {
  return field.key.name === 'Name' && field.value.type === 'StringLiteral';
}
export function isLiteralName(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.StringLiteral } {
  return field.key.name === 'LiteralName' && field.value.type === 'StringLiteral';
}
export function isType(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.StringLiteral } {
  return field.key.name === 'Type' && field.value.type === 'StringLiteral';
}
export function isNilable(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.BooleanLiteral } {
  return field.key.name === 'Nilable' && field.value.type === 'BooleanLiteral';
}

export function isNamespace(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.StringLiteral } {
  return field.key.name === 'Namespace' && field.value.type === 'StringLiteral';
}

export function isFields(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.TableConstructorExpression } {
  return field.key.name === 'Fields' && field.value.type === 'TableConstructorExpression';
}

export function isFunctionList(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.TableConstructorExpression;
} {
  return field.key.name === 'Functions' && field.value.type === 'TableConstructorExpression';
}

export function isTableList(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.TableConstructorExpression;
} {
  return field.key.name === 'Tables' && field.value.type === 'TableConstructorExpression';
}

export function isEventList(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.TableConstructorExpression;
} {
  return field.key.name === 'Events' && field.value.type === 'TableConstructorExpression';
}

export function isTableField(
  field: luaparse.TableKey | luaparse.TableKeyString | luaparse.TableValue,
): field is TableField {
  return field.type === 'TableValue' && field.value.type === 'TableConstructorExpression';
}

export function isParameters(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.TableConstructorExpression;
} {
  return field.key.name === 'Arguments' && field.value.type === 'TableConstructorExpression';
}
export function isReturns(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.TableConstructorExpression;
} {
  return field.key.name === 'Returns' && field.value.type === 'TableConstructorExpression';
}
