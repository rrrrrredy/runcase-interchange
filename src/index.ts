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

// Fields used after the versioned JSON Schema has accepted the document.
type SemanticDocument =
  | { schema_version: "workflow.score.v1"; task_result: { status: string; score?: number };
      validations: Array<{ required: boolean; objective: boolean; status: string }> }
  | { schema_version: "agent.run.v1"; capture: { sources: Array<{ name: string; status: string }>;
      gaps: Array<{ source?: string }> } }
  | { schema_version: "workflow.case.v1"; variables: Array<{ value_type: string; value: unknown }> };

function semanticErrors(document: SemanticDocument): ProtocolValidationError[] {
  const errors: ProtocolValidationError[] = [];
  function report(instancePath: string, message: string): void {
    errors.push({ instancePath, schemaPath: "", keyword: "semantic", message, params: {} });
  }
  switch (document.schema_version) {
    case "workflow.score.v1": {
      const required = document.validations.filter(row => row.required);
      if (document.task_result.status === "pass" &&
          (!required.some(row => row.objective) || required.some(row => row.status !== "pass"))) {
        report("/task_result/status", "pass requires objective evidence and all required validations to pass");
      }
      if (document.task_result.status === "not_scored" && document.task_result.score !== undefined) {
        report("/task_result/score", "not_scored must omit the numeric score");
      }
      break;
    }
    case "agent.run.v1": {
      const covered = new Set(document.capture.gaps.map(gap => gap.source));
      document.capture.sources.forEach((source, index) => {
        if (source.status === "unavailable" && !covered.has(source.name)) {
          report(`/capture/sources/${index}/status`, "unavailable source needs an observation gap naming this source");
        }
      });
      break;
    }
    case "workflow.case.v1":
      document.variables.forEach(({ value, value_type }, index) => {
        const expected = value_type === "path" || value_type === "identifier" ? "string" : value_type;
        if (expected !== "json" && typeof value !== expected) {
          report(`/variables/${index}/value`, `value must match its declared type ${value_type}`);
        }
      });
  }
  return errors;
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
  readonly #semantic: boolean;
  readonly #ajv: Ajv2020;
  readonly #validators = new Map<SchemaVersion, ValidateFunction>();

  constructor({ semantic = false }: { semantic?: boolean } = {}) {
    this.#semantic = semantic;
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

    const errors = validator(document)
      ? (this.#semantic ? semanticErrors(document as SemanticDocument) : [])
      : normalizeErrors(validator.errors);
    return {
      valid: errors.length === 0,
      schemaVersion: detectedVersion,
      errors,
    };
  }
}

export function isSchemaVersion(value: string): value is SchemaVersion {
  return (schemaVersions as readonly string[]).includes(value);
}

export function schemaPath(version: SchemaVersion): string {
  return join(schemaDirectory, schemaFileByVersion[version]);
}
