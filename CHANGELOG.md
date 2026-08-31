# Changelog

## [Unreleased]

## [0.1.2] - 2026-08-31

- Reject Windows drive-relative portable paths such as `C:outside`; resolving them on Windows can escape a consumer's intended root even though they do not start with a slash.

## [0.1.1] - 2026-08-31

- Reject `.` and `..` path segments in portable relative paths.
- Apply the portable relative-path contract to Run artifact paths.
- Document that consumers must canonicalize and enforce root containment even after schema validation.

- GitHub tag releases now require curated, version-matched adoption notes and are labeled prereleases instead of presenting generated commit summaries as product documentation.
- Added a public support boundary for usage questions, schema proposals, bug reports, and sensitive Run data.
- Independent third-party implementation reports remain pending.
- Reproducible release assets now include package/schema archives, SHA-256 checksums, a commit manifest, and GitHub provenance attestations.
- CI covers both supported Node.js 20 and Node.js 22 runtimes.
- Public instructions now identify GitHub Releases as the sole 0.1 package channel and require checksum verification instead of implying an npm-registry publication.
- Renamed the unpublished project to RunCase Interchange after finding an existing, materially different Agent Run Protocol; the three document schema-version discriminators remain unchanged.

## [0.1.0] - 2026-08-28

- Added strict JSON Schema 2020-12 contracts for `agent.run.v1`, `workflow.case.v1`, and `workflow.score.v1`.
- Added managed/observed Run, code/Issue-to-PR Case, pass, and reset-error examples.
- Added a Node validation CLI with machine-readable output and stable exit codes.
- Added regression contracts for gaps, provenance, portable paths, infrastructure errors, and single-run evidence.
- Added an optional, explicitly lossy OpenTelemetry GenAI mapping.
