# Validation evidence

Validated locally on 2026-08-28 with Node.js 20.19.1 and Node.js 22.23.2 on Windows.

Command:

```powershell
npm run check
```

Observed result:

- TypeScript build completed.
- 8 protocol regression tests passed.
- 6 of 6 shipped examples passed the standalone CLI.
- Negative cases cover missing schema versions, unknown top-level fields, task/infrastructure result separation, absolute portable paths, missing observation gaps, missing variant provenance, and incorrect single-run evidence labels.

Packaging check:

```powershell
npm pack --dry-run
```

The dry run contained 19 files and produced an 18.1 kB package: runtime JS/type declarations, three schemas, six examples, documentation, README, license, notice, and package metadata. Test sources and local dependencies were not included.

Release packaging produced:

- `agent-run-protocol-core-0.1.0.tgz`;
- `agent-run-protocol-schemas-0.1.0.zip`;
- a commit-bound `release-manifest.json`;
- `SHA256SUMS.txt`, independently rehashed with all three entries matching.

## Product interoperability evidence

- Workflow Environment Factory's Python consumer validates and imports a synthetic `agent.run.v1`, redacts an inline secret, preserves structural fields, and deduplicates the canonical document.
- Runtime Evolution Workbench's TypeScript consumer validates and imports a standard `workflow.case.v1`, preserves `secret_refs`, and deduplicates the canonical document.
- The Runtime import was also exercised through the real loopback service and browser file picker: one Case appeared in the protocol library, the empty-Run boundary remained visible, and the browser reported no console or page errors.

These are sibling implementation results on the stated host, not evidence of independent third-party adoption. Fresh Windows installation and public-release CI remain separate gates.
