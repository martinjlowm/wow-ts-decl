import { Range, SemVer, satisfies as semverSatisfies, subset } from 'semver';
import { P, match } from 'ts-pattern';

import {
  type APISchema,
  type EventSignature,
  type FunctionSignature,
  type ListItemDescription,
  type TableSignature,
  type VariableSignature,
  apiSchema,
} from '#@/types.js';
import { identicalArrays } from '#@/utils.js';

function filterAgainstVersion(targetVersion: SemVer) {
  return function filterItem<T extends { version: SemVer | Range }>(item: T) {
    if (item.version instanceof Range) {
      return item.version.test(targetVersion);
    }

    return semverSatisfies(targetVersion, item.version.raw);
  };
}

function identicalSignature(s: VariableSignature) {
  return (ss: VariableSignature) =>
    Object.entries(s).every(([key, value]) => {
      if (!(key in ss)) {
        return false;
      }

      return ss[key as keyof VariableSignature] === value;
    });
}

// NOTE: Making this generic for SemVer | Range results in too deep of a type
// signature with the use of match
export class Version {
  version: SemVer | Range;

  constructor(version: SemVer | Range) {
    this.version = version;
  }

  extend(extendingVersion: SemVer | Range) {
    this.version = match([this.version, extendingVersion])
      .with([P.instanceOf(SemVer), P.instanceOf(SemVer)], ([left, right]) => {
        return new Range(`${left.version} || ${right.version}`);
      })
      .with([P.instanceOf(Range), P.instanceOf(SemVer)], ([left, right]) => {
        const isOutsideRange = !semverSatisfies(right.version, left);
        if (!isOutsideRange) {
          return new Range(left.format());
        }

        return new Range(`${left.format()} || ${right.version}`);
      })
      .with([P.instanceOf(SemVer), P.instanceOf(Range)], ([left, right]) => {
        const isOutsideRange = !semverSatisfies(left, right);
        if (isOutsideRange) {
          return new Range(`${left.version} || ${right.format()}`);
        }

        return new Range(right.format());
      })
      .with([P.instanceOf(Range), P.instanceOf(Range)], ([left, right]) => {
        if (subset(left, right)) {
          return new Range(right.format());
        }

        if (subset(right, left)) {
          return new Range(left.format());
        }

        return new Range(`${left.format()} ${right.format()}`);
      })
      .exhaustive();
  }

  toJSON() {
    const { version, ...item } = this;
    return {
      ...item,
      version: version.raw,
    };
  }
}

export type APIFunctionProps = {
  name: string;
  description?: string;
  ns?: string;
  parameters: VariableSignature[];
  returns: VariableSignature[];
  events?: ListItemDescription[];
  version: SemVer | Range;
};
export class APIFunction extends Version implements FunctionSignature {
  name: string;
  description: string;
  parameters: VariableSignature[];
  returns: VariableSignature[];
  events: ListItemDescription[];
  ns: string;

  constructor(props: APIFunctionProps) {
    super(props.version);

    this.name = props.name;
    this.description = props.description || '';
    this.parameters = props.parameters;
    this.returns = props.returns;
    this.version = props.version;
    this.events = props.events || [];
    this.ns = props.ns || API.DEFAULT_NAMESPACE;
  }

  identicalTo(func: APIFunction) {
    const criteria = [
      this.name === func.name,
      identicalArrays(this.parameters, func.parameters, identicalSignature),
      identicalArrays(this.returns, func.returns, identicalSignature),
      this.ns === func.ns,
    ];

    return criteria.every((c) => c);
  }
}

export type APITableProps = {
  name: string;
  description?: string;
  type?: string;
  ns?: string;
  fields: VariableSignature[];
  parameters?: VariableSignature[];
  values?: VariableSignature[];
  version: SemVer | Range;
};
export class APITable extends Version implements TableSignature {
  name: string;
  description: string;
  type: string;
  fields: VariableSignature[];
  parameters: VariableSignature[];
  values: VariableSignature[];
  ns: string;

  constructor(props: APITableProps) {
    super(props.version);
    this.name = props.name;
    this.description = props.description || '';
    this.type = props.type || '';
    this.fields = props.fields;
    this.parameters = props.parameters || [];
    this.values = props.values || [];
    this.ns = props.ns || API.DEFAULT_NAMESPACE;
  }

  identicalTo(t: APITable) {
    const criteria = [
      this.name === t.name,
      identicalArrays(this.fields, t.fields, identicalSignature),
      this.ns === t.ns,
    ];

    return criteria.every((c) => c);
  }
}

export type APIEventProps = {
  name: string;
  description?: string;
  literalName: string;
  ns?: string;
  payload: VariableSignature[];
  version: SemVer | Range;
};
export class APIEvent extends Version implements EventSignature {
  name: string;
  description: string;
  literalName: string;
  payload: VariableSignature[];
  ns: string;

  constructor(props: APIEventProps) {
    super(props.version);
    this.name = props.name;
    this.description = props.description || '';
    this.literalName = props.literalName;
    this.payload = props.payload;
    this.ns = props.ns || API.DEFAULT_NAMESPACE;
  }

  identicalTo(t: APIEvent) {
    const criteria = [
      this.name === t.name,
      this.literalName === t.literalName,
      identicalArrays(this.payload, t.payload, identicalSignature),
      this.ns === t.ns,
    ];

    return criteria.every((c) => c);
  }
}

export class API implements APISchema {
  static DEFAULT_NAMESPACE = 'WoWAPI';

  functions: APIFunction[];
  tables: APITable[];
  events: APIEvent[];

  constructor() {
    this.functions = [];
    this.tables = [];
    this.events = [];
  }

  addFunction(f: APIFunction) {
    this.functions.push(f);
  }

  addTable(t: APITable) {
    this.tables.push(t);
  }

  addEvent(e: APIEvent) {
    this.events.push(e);
  }

  filterForVersion(version: SemVer) {
    return new FilteredAPI(this, version);
  }

  combineItems<T extends Version & { name: string; identicalTo: (this: T, item: T) => boolean }>(
    items: T[],
    combiningItems: T[],
  ) {
    for (const combiningItem of combiningItems) {
      const existingItem = items.find((f) => combiningItem.name === f.name);
      if (existingItem) {
        const isIdentical = existingItem.identicalTo(combiningItem);
        if (isIdentical) {
          existingItem.extend(combiningItem.version);
          continue;
        }
      }

      items.push(combiningItem);
    }
  }

  // Enables you to chain combine APIs: api.combine(api.combine(api))
  combine(api: API) {
    const { functions: leftFunctions, events: leftEvents, tables: leftTables } = this;
    const { functions: rightFunctions, events: rightEvents, tables: rightTables } = api;

    const combinedAPI = new API();
    for (const func of leftFunctions) {
      combinedAPI.addFunction(func);
    }
    for (const table of leftTables) {
      combinedAPI.addTable(table);
    }
    for (const event of leftEvents) {
      combinedAPI.addEvent(event);
    }

    combinedAPI.combineItems(combinedAPI.functions, rightFunctions);
    combinedAPI.combineItems(combinedAPI.events, rightEvents);
    combinedAPI.combineItems(combinedAPI.tables, rightTables);

    return combinedAPI;
  }

  serialize() {
    return JSON.stringify(this, undefined, 2);
  }

  static load(content: string) {
    const parsed = apiSchema.parse(JSON.parse(content));

    const api = new API();

    api.functions.push(...parsed.functions.map((f) => new APIFunction(f)));
    api.tables.push(...parsed.tables.map((t) => new APITable(t)));
    api.events.push(...parsed.events.map((e) => new APIEvent(e)));

    return api;
  }
}

class FilteredAPI extends API {
  constructor(api: API, version: SemVer) {
    super();

    const { functions, events, tables } = api;

    this.functions.push(...functions.filter(filterAgainstVersion(version)));
    this.events.push(...events.filter(filterAgainstVersion(version)));
    this.tables.push(...tables.filter(filterAgainstVersion(version)));
  }
}

export class APIBuilder {
  private apis: API[];

  constructor() {
    this.apis = [];
  }

  add(api: API) {
    this.apis.push(api);
  }

  merge() {
    if (!this.apis.length) {
      return null;
    }

    return this.apis.reduce((combinedAPI, api) => combinedAPI.combine(api));
  }
}
