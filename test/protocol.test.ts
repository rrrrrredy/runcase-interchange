import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
