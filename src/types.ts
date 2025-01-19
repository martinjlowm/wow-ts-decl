import { Range, SemVer, valid } from 'semver';
import z from 'zod';

const variableSignatureSchema = z.object({
  name: z.string(),
  type: z.string(),
  nilable: z.boolean(),
});

export type VariableSignature = z.infer<typeof variableSignatureSchema>;

const versionedSchema = z.object({
  version: z.string().transform((str) => {
    if (valid(str)) {
      return new SemVer(str);
    }

    return new Range(str);
  }),
});

export type Versioned = z.infer<typeof versionedSchema>;

const namespacedSchema = z.object({
  ns: z.string(),
});

export type Namespaced = z.infer<typeof namespacedSchema>;

const listItemDescriptionSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type ListItemDescription = z.infer<typeof listItemDescriptionSchema>;

const functionSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    parameters: z.array(variableSignatureSchema),
    returns: z.array(variableSignatureSchema),
    events: z.array(listItemDescriptionSchema),
  })
  .merge(versionedSchema)
  .merge(namespacedSchema);

export type FunctionSignature = z.infer<typeof functionSchema>;

const tableSchema = z
  .object({
    name: z.string(),
    fields: z.array(variableSignatureSchema),
  })
  .merge(versionedSchema)
  .merge(namespacedSchema);

export type TableSignature = z.infer<typeof tableSchema>;

const eventSchema = z
  .object({
    name: z.string(),
    literalName: z.string(),
    payload: z.array(variableSignatureSchema),
  })
  .merge(versionedSchema)
  .merge(namespacedSchema);

export type EventSignature = z.infer<typeof eventSchema>;

export const apiSchema = z.object({
  functions: z.array(functionSchema),
  tables: z.array(tableSchema),
  events: z.array(eventSchema),
});

export type APISchema = z.infer<typeof apiSchema>;

export type DocumentedVariableSignature = VariableSignature & {
  description: string;
};

export type TypeAliasSignature = {
  name: string;
  type: string;
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
