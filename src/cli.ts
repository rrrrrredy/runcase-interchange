#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { ProtocolValidator, isSchemaVersion, schemaPath, schemaVersions, type SchemaVersion } from "./index.js";

interface FileResult {
  file: string;
  valid: boolean;
  schemaVersion?: string;
  errors: Array<{
    instancePath: string;
    schemaPath: string;
    keyword: string;
    message: string;
    params: Record<string, unknown>;
  }>;
  ioError?: string;
}

function usage(): string {
  return [
    "RunCase Interchange validator",
    "",
    "Usage:",
    "  rci schemas [--json]",
    "  rci validate <file-or-directory>... [--schema <version>] [--semantic] [--json]",
    "",
    "Directories are scanned recursively for .json files.",
  ].join("\n");
}

function collectJsonFiles(inputPath: string, ioErrors: Map<string, FileResult>): string[] {
  const absolutePath = resolve(inputPath);
  try {
    const status = statSync(absolutePath);
    if (status.isFile()) return [absolutePath];
    if (!status.isDirectory()) return [];
    return readdirSync(absolutePath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .flatMap(entry => {
        const child = resolve(absolutePath, entry.name);
        if (entry.isDirectory()) return collectJsonFiles(child, ioErrors);
        return entry.isFile() && entry.name.endsWith(".json") ? [child] : [];
      });
  } catch (error) {
    ioErrors.set(absolutePath, ioFailure(absolutePath, error));
    return [];
  }

}

function parseOptions(args: string[]): { json: boolean; semantic: boolean; schema?: SchemaVersion; paths: string[] } {
  let json = false;
  let semantic = false;
  let schema: SchemaVersion | undefined;
  const paths: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--semantic") {
      semantic = true;
      continue;
    }
    if (argument === "--json") {
      json = true;
      continue;
    }
    if (argument === "--schema") {
      const value = args[index + 1];
      if (value === undefined || !isSchemaVersion(value)) {
        throw new Error(`--schema must be one of: ${schemaVersions.join(", ")}`);
      }
      schema = value;
      index += 1;
      continue;
    }
    if (argument?.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    }
    if (argument !== undefined) {
      paths.push(argument);
    }
  }

  return schema === undefined ? { json, semantic, paths } : { json, semantic, schema, paths };
}

function ioFailure(file: string, error: unknown): FileResult {
  return { file, valid: false, errors: [], ioError: error instanceof Error ? error.message : String(error) };
}

function validateFile(file: string, validator: ProtocolValidator, schema?: SchemaVersion): FileResult {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    return ioFailure(file, error);
  }
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { file, valid: false, errors: [{ instancePath: "", schemaPath: "", keyword: "parse", message: error.message, params: {} }] };
  }
  return { file, ...validator.validate(document, schema) };
}

function printHumanResults(results: FileResult[]): void {
  for (const result of results) {
    if (result.valid) {
      process.stdout.write(`VALID ${result.schemaVersion ?? "unknown"} ${result.file}\n`);
      continue;
    }

    process.stdout.write(`INVALID ${result.schemaVersion ?? "unknown"} ${result.file}\n`);
    if (result.ioError !== undefined) {
      process.stdout.write(`  I/O ${result.ioError}\n`);
    }
    for (const error of result.errors) {
      process.stdout.write(`  ${error.instancePath || "/"} ${error.message} (${error.keyword})\n`);
    }
  }

  const validCount = results.filter((result) => result.valid).length;
  process.stdout.write(`\n${validCount}/${results.length} documents valid\n`);
}

function main(): number {
  const [command, ...args] = process.argv.slice(2);
  if (command === undefined || command === "--help" || command === "-h") {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  if (command === "schemas") {
    const json = args.includes("--json");
    if (args.some((argument) => argument !== "--json")) {
      throw new Error("schemas accepts only --json");
    }
    const rows = schemaVersions.map((version) => ({ version, path: schemaPath(version) }));
    if (json) {
      process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    } else {
      for (const row of rows) {
        process.stdout.write(`${row.version}\t${row.path}\n`);
      }
    }
    return 0;
  }

  if (command !== "validate") {
    throw new Error(`Unknown command: ${command}`);
  }

  const options = parseOptions(args);
  if (options.paths.length === 0) {
    throw new Error("validate requires at least one file or directory");
  }

  const ioErrors = new Map<string, FileResult>();
  const files = [...new Set(options.paths.flatMap(input => collectJsonFiles(input, ioErrors)))];
  if (files.length === 0 && ioErrors.size === 0) {
    throw new Error("No JSON files were found");
  }

  const validator = new ProtocolValidator({ semantic: options.semantic });
  const results = [...ioErrors.values(), ...files.map(file => validateFile(file, validator, options.schema))]
    .sort((left, right) => left.file < right.file ? -1 : left.file > right.file ? 1 : 0);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    printHumanResults(results);
  }

  if (results.some(result => result.ioError !== undefined)) return 2;
  return results.every((result) => result.valid) ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`);
  process.exitCode = 2;
}
