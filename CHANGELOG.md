# Changelog

## [Unreleased]

- Independent third-party implementation reports remain pending.
- Reproducible release assets now include package/schema archives, SHA-256 checksums, a commit manifest, and GitHub provenance attestations.
- CI covers both supported Node.js 20 and Node.js 22 runtimes.

## [0.1.0] - 2026-08-28

- Added strict JSON Schema 2020-12 contracts for `agent.run.v1`, `workflow.case.v1`, and `workflow.score.v1`.
- Added managed/observed Run, code/Issue-to-PR Case, pass, and reset-error examples.
- Added a Node validation CLI with machine-readable output and stable exit codes.
- Added regression contracts for gaps, provenance, portable paths, infrastructure errors, and single-run evidence.
- Added an optional, explicitly lossy OpenTelemetry GenAI mapping.
