import { lowerCaseFirst } from 'lower-case-first';

/**
 * Runtime information of a data model or field attribute
 */
export type RuntimeAttribute = {
    name: string;
    args: Array<{ name?: string; value: unknown }>;
};

/**
 * Runtime information of a data model field
 */
export type FieldInfo = {
    /**
     * Field name
     */
    name: string;

    /**
     * Field type name
     */
    type: string;

    /**
     * If the field is an ID field or part of a multi-field ID
     */
    isId?: boolean;

    /**
     * If the field type is a data model (or an optional/array of data model)
     */
    isDataModel?: boolean;

    /**
     * If the field is an array
     */
    isArray?: boolean;

    /**
     * If the field is optional
     */
    isOptional?: boolean;

    /**
     * Attributes on the field
     */
    attributes?: RuntimeAttribute[];

    /**
     * If the field is a relation field, the field name of the reverse side of the relation
     */
    backLink?: string;

    /**
     * If the field is the owner side of a relation
     */
    isRelationOwner?: boolean;

    /**
     * If the field is a foreign key field
     */
    isForeignKey?: boolean;

    /**
     * Mapping from foreign key field names to relation field names
     */
    foreignKeyMapping?: Record<string, string>;
};

/**
 * Metadata for a model-level unique constraint
 * e.g.: @@unique([a, b])
 */
export type UniqueConstraint = { name: string; fields: string[] };

/**
 * ZModel data model metadata
 */
export type ModelMeta = {
    /**
     * Model fields
     */
    fields: Record<string, Record<string, FieldInfo>>;

    /**
     * Model unique constraints
     */
    uniqueConstraints: Record<string, Record<string, UniqueConstraint>>;

    /**
     * Information for cascading delete
     */
    deleteCascade: Record<string, string[]>;

    /**
     * Name of model that backs the `auth()` function
     */
    authModel?: string;
};

/**
 * Resolves a model field to its metadata. Returns undefined if not found.
 */
export function resolveField(modelMeta: ModelMeta, model: string, field: string) {
    return modelMeta.fields[lowerCaseFirst(model)]?.[field];
}

/**
 * Resolves a model field to its metadata. Throws an error if not found.
 */
export function requireField(modelMeta: ModelMeta, model: string, field: string) {
    const f = resolveField(modelMeta, model, field);
    if (!f) {
        throw new Error(`Field ${model}.${field} cannot be resolved`);
    }
    return f;
}

/**
 * Gets all fields of a model.
 */
export function getFields(modelMeta: ModelMeta, model: string) {
    return modelMeta.fields[lowerCaseFirst(model)];
}
