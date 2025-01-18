export type VariableSignature = {
  name: string;
  type: string;
  nilable: boolean;
};

export type DocumentedVariableSignature = VariableSignature & {
  description: string;
};

export type ListItemDescription = {
  name: string;
  description: string;
};

export type TypeAliasSignature = {
  name: string;
  type: string;
};

export type FunctionSignature = {
  name: string;
  type: string;
  parameters: VariableSignature[];
  returns: VariableSignature[];
};

export type TableSignature = {
  name: string;
  fields: VariableSignature[];
};

export type EventSignature = {
  name: string;
  type: string;
  literalName: string;
  payload: VariableSignature[];
};

export type FileAPIDocumentation = {
  name: string;
  ns?: string;
  functions: FunctionSignature[];
  tables: TableSignature[];
  events: EventSignature[];
};

export type VersionedAPIDocumentation = {
  functions: FunctionSignature[];
  tables: TableSignature[];
  events: EventSignature[];
  namespaces: {
    [ns: string]: Omit<VersionedAPIDocumentation, 'namespaces'>;
  };
};

export type APIDocumentation = {
  [version: `v${number}.${number}`]: VersionedAPIDocumentation;
};

// FIXME: Merge together to one common structure
export type APIDeclaration = {
  [ns: string]: {
    [func: string]: {
      title: string;
      description: string;
      parameters: DocumentedVariableSignature[];
      returns: DocumentedVariableSignature[];
      events: ListItemDescription[];
      sourceLink: string;
      since?: string;
    };
  };
};
