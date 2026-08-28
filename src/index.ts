import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import type { FormatsPlugin } from "ajv-formats";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const schemaVersions = [
  "agent.run.v1",
  "workflow.case.v1",
  "workflow.score.v1",
] as const;

export type SchemaVersion = (typeof schemaVersions)[number];

const schemaFileByVersion: Record<SchemaVersion, string> = {
  "agent.run.v1": "agent.run.v1.schema.json",
  "workflow.case.v1": "workflow.case.v1.schema.json",
  "workflow.score.v1": "workflow.score.v1.schema.json",
};

export interface ProtocolValidationError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  message: string;
  params: Record<string, unknown>;
}

export interface ProtocolValidationResult {
  valid: boolean;
  schemaVersion?: string;
  errors: ProtocolValidationError[];
}

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const addFormats = require("ajv-formats") as FormatsPlugin;
const packageRoot = join(currentDirectory, "..", "..");
const schemaDirectory = join(packageRoot, "schemas");

function readSchema(version: SchemaVersion): object {
  const schemaPath = join(schemaDirectory, schemaFileByVersion[version]);
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

function normalizeErrors(errors: ErrorObject[] | null | undefined): ProtocolValidationError[] {
  return (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message ?? "Validation failed",
    params: error.params as Record<string, unknown>,
  }));
}

function hasSchemaVersion(value: unknown): value is { schema_version: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "schema_version" in value &&
    typeof (value as { schema_version?: unknown }).schema_version === "string"
  );
}

export class ProtocolValidator {
  readonly #ajv: Ajv2020;
  readonly #validators = new Map<SchemaVersion, ValidateFunction>();

  constructor() {
    this.#ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      allowUnionTypes: true,
    });
    addFormats(this.#ajv);

    for (const version of schemaVersions) {
      const validator = this.#ajv.compile(readSchema(version));
      this.#validators.set(version, validator);
    }
  }

  validate(document: unknown, forcedVersion?: SchemaVersion): ProtocolValidationResult {
    const detectedVersion = forcedVersion ?? (hasSchemaVersion(document) ? document.schema_version : undefined);

    if (detectedVersion === undefined) {
      return {
        valid: false,
        errors: [
          {
            instancePath: "",
            schemaPath: "#/schema_version",
            keyword: "required",
            message: "schema_version is required",
            params: { missingProperty: "schema_version" },
          },
        ],
      };
    }

    if (!isSchemaVersion(detectedVersion)) {
      return {
        valid: false,
        schemaVersion: detectedVersion,
        errors: [
          {
            instancePath: "/schema_version",
            schemaPath: "#/schema_version",
            keyword: "enum",
            message: `Unsupported schema_version: ${detectedVersion}`,
            params: { allowedValues: schemaVersions },
          },
        ],
      };
    }

    const validator = this.#validators.get(detectedVersion);
    if (validator === undefined) {
      throw new Error(`Validator was not compiled for ${detectedVersion}`);
    }

    const valid = validator(document) as boolean;
    return {
      valid,
      schemaVersion: detectedVersion,
      errors: valid ? [] : normalizeErrors(validator.errors),
    };
  }
}

export function isSchemaVersion(value: string): value is SchemaVersion {
  return (schemaVersions as readonly string[]).includes(value);
}

export function schemaPath(version: SchemaVersion): string {
  return join(schemaDirectory, schemaFileByVersion[version]);
}
