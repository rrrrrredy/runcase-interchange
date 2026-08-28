# Validation evidence

Validated locally on 2026-08-28 with Node.js 20.19.1 and npm 10.8.2 on Windows.

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

The dry run contained 17 files: runtime JS/type declarations, three schemas, six examples, documentation, README, license, and package metadata. Test sources and local dependencies were not included.

This proves schema and CLI behavior on the stated host. It does not yet prove interoperability inside either product, which remains a later acceptance item.
