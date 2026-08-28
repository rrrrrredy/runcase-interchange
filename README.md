# Agent Run Protocol

Agent Run Protocol is the only shared contract between Runtime Evolution Workbench and Workflow Environment Factory. It defines portable JSON records; it does not provide a database, queue, UI, runner, environment, or product service.

## Schemas

- `agent.run.v1`: one real agent execution, its observed events, artifacts, outcome, user corrections, redaction state, and observation gaps.
- `workflow.case.v1`: one resettable task definition, including provenance, environment setup/reset, allowed tools, validators, and safety limits.
- `workflow.score.v1`: the objective validation result for one Run on one Case, including infrastructure status, trace findings, time/cost, and nondeterminism notes.

The protocol intentionally distinguishes a **Run** from a **Trace**: a Run is the execution that happened; events are retained observations of that execution and may be incomplete.

## Quick start

Requires Node.js 20 or later. The two product implementations may impose a newer runtime independently.

```powershell
npm install
npm run check
node dist/src/cli.js schemas
node dist/src/cli.js validate examples
node dist/src/cli.js validate examples/agent.run.observed.json --json
```

The CLI exits with `0` when every document is valid, `1` when at least one document is invalid, and `2` for usage or I/O errors.

## Install a tagged release

Version 0.1 is distributed through this repository's GitHub Releases, not the public npm registry. Do not infer registry ownership from the package name.

Download `agent-run-protocol-core-0.1.0.tgz` and `SHA256SUMS.txt` from the same release, verify the tarball, then install the exact file or release URL:

```powershell
$expected = (Get-Content .\SHA256SUMS.txt | Where-Object { $_ -match 'agent-run-protocol-core-0.1.0.tgz$' }).Split()[0]
$actual = (Get-FileHash .\agent-run-protocol-core-0.1.0.tgz -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw 'Agent Run Protocol package checksum mismatch.' }
npm install .\agent-run-protocol-core-0.1.0.tgz
.\node_modules\.bin\arp schemas
```

`agent-run-protocol-schemas-0.1.0.zip` is the language-neutral distribution. `release-manifest.json` binds both archives to the source commit, and GitHub publishes build-provenance attestations for the release assets.

## Compatibility policy

The npm package follows semantic versioning. Each document also carries a stable `schema_version` discriminator.

- New optional properties and relaxed constraints may ship in a package minor version while keeping the same schema identifier.
- New required properties, removed meanings, or incompatible enum changes require a new schema identifier such as `agent.run.v2` and a package major version.
- Consumers must preserve unknown extension properties under the explicit `extensions` object. Top-level unknown properties are rejected so accidental misspellings do not silently become protocol data.
- Timestamps use RFC 3339 date-time strings. Content hashes use lowercase SHA-256 prefixed by `sha256:`.

## Privacy contract

Protocol documents must never be treated as a secret store. Producers redact content before serialization and describe redaction under `capture.redaction`. A content reference may point to a separate local content store, but portable exports should contain only references that the recipient can safely resolve.

Observation gaps are first-class. Producers must record a gap when an event source is missing, out of order beyond repair, intentionally excluded, or unavailable. Consumers must not infer that an unobserved action did not occur.

## Repository layout

```text
schemas/   JSON Schema 2020-12 contracts
examples/  valid portable examples
src/       schema loader and CLI
test/      protocol and CLI regression tests
docs/      interoperability notes
```

## OpenTelemetry mapping

`docs/opentelemetry-genai-mapping.md` defines an optional, lossy mapping. OpenTelemetry GenAI agent semantic conventions are still evolving, so they are not the canonical internal model.

## License

Apache-2.0. The explicit patent grant and permissive reuse terms are intended to make the protocol safe to adopt in open-source and commercial Agent tooling.
