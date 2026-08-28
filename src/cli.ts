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
    "Agent Run Protocol validator",
    "",
    "Usage:",
    "  arp schemas [--json]",
    "  arp validate <file-or-directory>... [--schema <version>] [--json]",
    "",
    "Directories are scanned recursively for .json files.",
  ].join("\n");
}

function collectJsonFiles(inputPath: string): string[] {
  const absolutePath = resolve(inputPath);
  const status = statSync(absolutePath);
  if (status.isFile()) {
    return [absolutePath];
  }
  if (!status.isDirectory()) {
    return [];
  }

  return readdirSync(absolutePath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const child = resolve(absolutePath, entry.name);
      if (entry.isDirectory()) {
        return collectJsonFiles(child);
      }
      return entry.isFile() && entry.name.endsWith(".json") ? [child] : [];
    });
}

function parseOptions(args: string[]): { json: boolean; schema?: SchemaVersion; paths: string[] } {
  let json = false;
  let schema: SchemaVersion | undefined;
  const paths: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
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

  return schema === undefined ? { json, paths } : { json, schema, paths };
}

function validateFile(file: string, validator: ProtocolValidator, schema?: SchemaVersion): FileResult {
  try {
    const document = JSON.parse(readFileSync(file, "utf8")) as unknown;
    const result = validator.validate(document, schema);
    return {
      file,
      valid: result.valid,
      ...(result.schemaVersion === undefined ? {} : { schemaVersion: result.schemaVersion }),
      errors: result.errors,
    };
  } catch (error) {
    return {
      file,
      valid: false,
      errors: [],
      ioError: error instanceof Error ? error.message : String(error),
    };
  }
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

  const files = [...new Set(options.paths.flatMap(collectJsonFiles))].sort();
  if (files.length === 0) {
    throw new Error("No JSON files were found");
  }

  const validator = new ProtocolValidator();
  const results = files.map((file) => validateFile(file, validator, options.schema));
  if (options.json) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    printHumanResults(results);
  }

  return results.every((result) => result.valid) ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`);
  process.exitCode = 2;
}
