import type luaparse from 'luaparse';
import { P, match } from 'ts-pattern';
import { SyntaxKind, factory } from 'typescript';

import camelCase from 'lodash/camelCase.js';
import capitalize from 'lodash/capitalize.js';
import type { TableValue } from 'luaparse';
import type {
  EventSignature,
  FileAPIDocumentation,
  FunctionSignature,
  TableSignature,
  VariableSignature,
} from '#@/types.js';
import { printList, unhandledBranch } from '#@/utils.js';

const { createKeywordTypeNode, createEnumDeclaration } = factory;

const visitedTypes = new Set<string>();

type TableField = luaparse.TableValue & {
  value: luaparse.TableConstructorExpression;
};

// NOTE: Since we process one file at a time, it's possible that these tables
// haven't been processed
// TODO: Flatten all the files, process tables first to account for this list
// ahead of time
const passthroughTypes = [
  'AddPrivateAuraAnchorArgs',
  'AuraData',
  'CallbackType',
  'ClubId',
  'ClubStreamId',
  'FramePoint',
  'ItemInfo',
  'ModelSceneFrame',
  'ModelSceneFrameActor',
  'PlayerLocation',
  'PrivateAuraIconInfo',
  'ScriptRegion',
  'SimpleFrame',
  'SimpleTexture',
  'TimerCallback',
  'TransmogCollectionType',
  'TransmogLocation',
  'TransmogPendingInfo',
  'TransmogSearchType',
  'UIWidgetCurrencyInfo',
  'UIWidgetVisualizationType',
  'UnitAuraUpdateInfo',
  'UnitPrivateAuraAppliedSoundInfo',
  'UnitToken',
  'VoiceChatMember',
  // Tables may be used for storing constants (ideally, we should branch based
  // on that knowledge and handle it differently to regular tables)
  'Constants',
] as const;

function explicitlyMapType(parsedType: string) {
  return match(parsedType)
    .with('cstring', 'textureAtlas', () => printList([createKeywordTypeNode(SyntaxKind.StringKeyword)]).trim())
    .with('bool', () => printList([createKeywordTypeNode(SyntaxKind.BooleanKeyword)]).trim())
    .with('XMLTemplateKeyValue', 'Structure', 'table', () =>
      printList([createKeywordTypeNode(SyntaxKind.ObjectKeyword)]).trim(),
    )
    .with('Enumeration', () => printList([createEnumDeclaration(undefined, '', [])]).trim())
    .with('WOWGUID', () => 'GUID')
    .with(P.string.startsWith('vector'), P.string.startsWith('colorRGB'), 'textureKit', (v) => capitalize(v))
    .with('fileID', () => 'FileId')
    .with('uiUnit', () => 'UIUnit')
    .with('time_t', () => 'Date')
    .with('string', 'number', ...passthroughTypes, (t) => t)
    .with('luaIndex', () => 'LuaIndex')
    .otherwise((t) => {
      if (!visitedTypes.has(t)) {
        console.warn("Found a type that wasn't explicitly mapped", t);
      }

      return t;
    });
}

export function toAPIDefinition(apiDefinition: Partial<FileAPIDocumentation>, field: luaparse.TableKeyString) {
  switch (true) {
    case isName(field): {
      apiDefinition.name = JSON.parse(field.value.raw);
      break;
    }
    case isType(field): {
      // Don't care
      // func.type = JSON.parse(field.value.raw);
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
    case isDocumentation(field): {
      func.description = field.value.fields
        .filter(isTableValue)
        .map((v) => JSON.parse(v.value.raw))
        .join('\n');
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
    case isEnumRange(field): {
      // Don't care
      // event.type = JSON.parse(field.value.raw);
      break;
    }
    case isParameters(field): {
      // NOTE: See the comment for the table schema - not sure what the meaning
      // of this is - perhaps a wrongly categorized entry
      table.parameters = field.value.fields.filter(isTableField).map(toProperty);
      break;
    }
    case isValues(field): {
      // NOTE: Tables are also used for storing constants - we should probably
      // store these separately...
      table.values = field.value.fields.filter(isTableField).map(toProperty);
      break;
    }
    case isType(field): {
      table.type = explicitlyMapType(JSON.parse(field.value.raw));
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
    case isPayload(field): {
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
      signature.name = camelCase(JSON.parse(field.value.raw)).replace('Afk', 'AFK');
      break;
    }
    case isDefault(field): {
      signature.default = field.value.value || JSON.parse(field.value.raw);
      break;
    }
    case isType(field): {
      signature.type = explicitlyMapType(JSON.parse(field.value.raw));
      break;
    }
    case isMixin(field): {
      signature.mixin = JSON.parse(field.value.raw);
      break;
    }
    case isStrideIndex(field): {
      signature.strideIndex = JSON.parse(field.value.raw);
      break;
    }
    case isDocumentation(field): {
      signature.description = field.value.fields
        .filter(isTableValue)
        .map((v) => JSON.parse(v.value.raw))
        .join('\n');
      break;
    }
    case isNilable(field): {
      signature.nilable = field.value.value;
      break;
    }
    case isEnumValue(field): {
      // Don't care
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
  return (field.key.name === 'Type' || field.key.name === 'InnerType') && field.value.type === 'StringLiteral';
}
export function isDocumentation(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.TableConstructorExpression } {
  return field.key.name === 'Documentation' && field.value.type === 'TableConstructorExpression';
}
export function isEnumValue(field: luaparse.TableKeyString): field is luaparse.TableKeyString {
  return field.key.name === 'EnumValue';
}
export function isEnumRange(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.NumericLiteral } {
  return (
    ['MinValue', 'MaxValue', 'NumValues'].some((k) => k === field.key.name) &&
    (field.value.type === 'NumericLiteral' || field.value.type === 'UnaryExpression')
  );
}

export function isMixin(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.StringLiteral } {
  return field.key.name === 'Mixin' && field.value.type === 'StringLiteral';
}

export function isStrideIndex(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.NumericLiteral } {
  return field.key.name === 'StrideIndex' && field.value.type === 'NumericLiteral';
}

export function isDefault(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.StringLiteral | luaparse.NumericLiteral | luaparse.BooleanLiteral;
} {
  return (
    field.key.name === 'Default' &&
    (field.value.type === 'StringLiteral' ||
      field.value.type === 'NumericLiteral' ||
      field.value.type === 'BooleanLiteral')
  );
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
export function isPayload(
  field: luaparse.TableKeyString,
): field is luaparse.TableKeyString & { value: luaparse.TableConstructorExpression } {
  return field.key.name === 'Payload' && field.value.type === 'TableConstructorExpression';
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

export function isTableValue(
  field: luaparse.TableKey | luaparse.TableKeyString | luaparse.TableValue,
): field is TableValue & {
  value: luaparse.StringLiteral;
} {
  return field.type === 'TableValue' && field.value.type === 'StringLiteral';
}

export function isParameters(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.TableConstructorExpression;
} {
  return field.key.name === 'Arguments' && field.value.type === 'TableConstructorExpression';
}

export function isValues(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.TableConstructorExpression;
} {
  return field.key.name === 'Values' && field.value.type === 'TableConstructorExpression';
}

export function isReturns(field: luaparse.TableKeyString): field is luaparse.TableKeyString & {
  value: luaparse.TableConstructorExpression;
} {
  return field.key.name === 'Returns' && field.value.type === 'TableConstructorExpression';
}
