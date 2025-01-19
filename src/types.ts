import { Range, SemVer, valid } from 'semver';
import z from 'zod';

const variableSignatureSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  type: z.string(),
  mixin: z.string().optional(),
  default: z.string().or(z.boolean()).or(z.number()).optional(),
  strideIndex: z.number().optional(),
  nilable: z.boolean().default(false),
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
  ns: z.string().optional(),
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
    description: z.string().optional(),
    parameters: z.array(variableSignatureSchema).default([]),
    returns: z.array(variableSignatureSchema).default([]),
    events: z.array(listItemDescriptionSchema).default([]),
  })
  .merge(versionedSchema)
  .merge(namespacedSchema);

export type FunctionSignature = z.infer<typeof functionSchema>;

const tableSchema = z
  .object({
    name: z.string(),
    type: z.string(),
    // NOTE: There is some weird table defined in UITimer that looks like a
    // (callback) function and not a table
    parameters: z.array(variableSignatureSchema).default([]),
    values: z.array(variableSignatureSchema).default([]),
    fields: z.array(variableSignatureSchema).default([]),
  })
  .merge(versionedSchema)
  .merge(namespacedSchema);

export type TableSignature = z.infer<typeof tableSchema>;

const eventSchema = z
  .object({
    name: z.string(),
    literalName: z.string(),
    payload: z.array(variableSignatureSchema).default([]),
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
