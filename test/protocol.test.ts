import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ProtocolValidator } from "../src/index.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testDirectory, "..", "..");
const exampleDirectory = join(packageRoot, "examples");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

test("every shipped example validates", () => {
  const validator = new ProtocolValidator();
  const files = readdirSync(exampleDirectory).filter((file) => file.endsWith(".json"));
  assert.ok(files.length >= 6);

  for (const file of files) {
    const result = validator.validate(readJson(join(exampleDirectory, file)));
    assert.equal(result.valid, true, `${file}: ${JSON.stringify(result.errors)}`);
  }
});

test("a missing schema version fails explicitly", () => {
  const result = new ProtocolValidator().validate({ run_id: "missing-version" });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0]?.keyword, "required");
});

test("unknown top-level fields are rejected", () => {
  const run = readJson(join(exampleDirectory, "agent.run.managed.json")) as Record<string, unknown>;
  run.accidental_field = true;
  const result = new ProtocolValidator().validate(run);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.keyword === "additionalProperties"));
});

test("infrastructure errors cannot be scored as task passes", () => {
  const score = readJson(join(exampleDirectory, "workflow.score.reset-error.json")) as {
    task_result: { status: string };
  };
  score.task_result.status = "pass";
  const result = new ProtocolValidator().validate(score);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.instancePath === "/task_result/status"));
});

test("portable writable paths reject absolute and drive-relative Windows paths", () => {
  const workflowCase = readJson(join(exampleDirectory, "workflow.case.code.json")) as {
    safety: { writable_paths: string[] };
  };
  workflowCase.safety.writable_paths = ["C:\\Users\\example\\repo"];
  const result = new ProtocolValidator().validate(workflowCase);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.instancePath.includes("writable_paths")));

  workflowCase.safety.writable_paths = ["C:outside"];
  const driveRelative = new ProtocolValidator().validate(workflowCase);
  assert.equal(driveRelative.valid, false);
  assert.ok(driveRelative.errors.some((error) => error.instancePath.includes("writable_paths")));
});

test("portable paths reject parent traversal and dot segments", () => {
  const workflowCase = readJson(join(exampleDirectory, "workflow.case.code.json")) as {
    safety: { writable_paths: string[] };
  };
  workflowCase.safety.writable_paths = ["safe/../outside"];
  const caseResult = new ProtocolValidator().validate(workflowCase);
  assert.equal(caseResult.valid, false);
  assert.ok(caseResult.errors.some((error) => error.instancePath.includes("writable_paths")));

  const run = readJson(join(exampleDirectory, "agent.run.managed.json")) as {
    configuration: { files: Array<{ path: string }> };
  };
  run.configuration.files[0]!.path = ".\\AGENTS.md";
  const runResult = new ProtocolValidator().validate(run);
  assert.equal(runResult.valid, false);
  assert.ok(runResult.errors.some((error) => error.instancePath.includes("/configuration/files/0/path")));
});

test("partial capture must describe at least one observation gap", () => {
  const run = readJson(join(exampleDirectory, "agent.run.observed.json")) as {
    capture: { gaps: unknown[] };
  };
  run.capture.gaps = [];
  const result = new ProtocolValidator().validate(run);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.keyword === "minItems"));
});

test("derived variants require a parent and transformation provenance", () => {
  const workflowCase = readJson(join(exampleDirectory, "workflow.case.code.json")) as {
    provenance: { kind: string };
  };
  workflowCase.provenance.kind = "derived_variant";
  const result = new ProtocolValidator().validate(workflowCase);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.keyword === "required"));
});

test("one sample must be labeled as single-run evidence", () => {
  const score = readJson(join(exampleDirectory, "workflow.score.pass.json")) as {
    nondeterminism: { single_run_evidence: boolean };
  };
  score.nondeterminism.single_run_evidence = false;
  const result = new ProtocolValidator().validate(score);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.instancePath === "/nondeterminism/single_run_evidence"));
});

test("semantic validation accepts the published examples", () => {
  const strict = new ProtocolValidator({ semantic: true });
  for (const file of readdirSync(exampleDirectory)) {
    const result = strict.validate(readJson(join(exampleDirectory, file)));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  }
});

test("semantic scores need passing required objective evidence", () => {
  const legacy = new ProtocolValidator();
  const strict = new ProtocolValidator({ semantic: true });
  const score = readJson(join(exampleDirectory, "workflow.score.pass.json")) as {
    validations: Array<{ required: boolean; objective: boolean; status: string }>;
    task_result: { status: string };
  };
  score.validations[0]!.status = "fail";
  assert.equal(legacy.validate(score).valid, true);
  assert.equal(strict.validate(score).valid, false);
  score.task_result.status = "partial";
  assert.equal(strict.validate(score).valid, true);
  score.task_result.status = "pass";
  score.validations[0]!.required = false;
  assert.equal(strict.validate(score).valid, true);
  score.validations = [];
  assert.equal(strict.validate(score).valid, false);
});

test("unscored executions cannot carry a numeric score in semantic mode", () => {
  const score = readJson(join(exampleDirectory, "workflow.score.reset-error.json")) as { task_result: { score?: number } };
  const strict = new ProtocolValidator({ semantic: true });
  assert.equal(strict.validate(score).valid, true);
  score.task_result.score = 0;
  assert.equal(new ProtocolValidator().validate(score).valid, true);
  assert.equal(strict.validate(score).errors[0]?.instancePath, "/task_result/score");
});

test("unavailable capture sources require their own observation gap", () => {
  const run = readJson(join(exampleDirectory, "agent.run.managed.json")) as {
    capture: { sources: Array<{ name: string; status: string }>; completeness: string; gaps: object[] };
  };
  const strict = new ProtocolValidator({ semantic: true });
  const source = run.capture.sources[0]!;
  source.status = "unavailable";
  assert.equal(new ProtocolValidator().validate(run).valid, true);
  assert.equal(strict.validate(run).valid, false);
  run.capture.completeness = "partial";
  run.capture.gaps = [{ gap_id: "g", kind: "source_unavailable", summary: "No events", source: "other" }];
  assert.equal(strict.validate(run).valid, false);
  Object.assign(run.capture.gaps[0]!, { source: source.name });
  assert.equal(strict.validate(run).valid, true);
});

test("semantic variable types distinguish false, zero and arbitrary JSON", () => {
  const doc = readJson(join(exampleDirectory, "workflow.case.code.json")) as {
    variables: Array<{ value: unknown; value_type: string }>;
  };
  const strict = new ProtocolValidator({ semantic: true });
  for (const [kind, value, expected] of [
    ["number", false, false], ["number", 0, true], ["boolean", 0, false], ["boolean", false, true],
    ["identifier", 42, false], ["path", "src/a", true], ["string", "", true], ["json", null, true],
  ] as const) {
    Object.assign(doc.variables[0]!, { value_type: kind, value });
    assert.equal(strict.validate(doc).valid, expected);
    assert.equal(new ProtocolValidator().validate(doc).valid, true);
  }
});

test("CLI distinguishes malformed JSON from I/O errors and preserves mixed per-file results", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "rci-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const invalid = join(dir, "invalid.json");
  const missing = join(dir, "missing.json");
  const valid = join(exampleDirectory, "workflow.score.pass.json");
  writeFileSync(invalid, "{");
  const cli = join(packageRoot, "dist/src/cli.js");
  const validate = (...args: string[]) => spawnSync(process.execPath, [cli, "validate", "--json", ...args], { encoding: "utf8" });
  assert.equal(validate(invalid).status, 1);
  assert.equal(validate("--semantic", valid).status, 0);
  const mixed = validate(valid, invalid, missing);
  assert.equal(mixed.status, 2);
  const results = JSON.parse(mixed.stdout) as Array<{ file: string; valid: boolean; ioError?: string }>;
  assert.equal(results.length, 3);
  assert.equal(results.find(row => row.file === valid)?.valid, true);
  assert.equal(results.find(row => row.file === invalid)?.ioError, undefined);
  assert.ok(results.find(row => row.file === missing)?.ioError);
  // The preload deterministically models loss of a file after directory enumeration on every OS.
  const preload = join(dir, "read-failure.cjs");
  writeFileSync(preload, `const fs = require("node:fs"); const read = fs.readFileSync;
    fs.readFileSync = function(file, ...args) {
      if (file === ${JSON.stringify(invalid)}) throw Object.assign(new Error("file no longer readable"), {code: "EACCES"});
      return read.call(this, file, ...args);
    }; require("node:module").syncBuiltinESMExports();`);
  const denied = spawnSync(process.execPath, ["--require", preload, cli, "validate", dir, "--json"], { encoding: "utf8" });
  assert.equal(denied.status, 2);
  assert.match(JSON.parse(denied.stdout)[0].ioError, /no longer readable/);
});
