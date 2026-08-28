# Contributing

RunCase Interchange is a portability contract, not a place for product-specific state. Changes should improve interoperability among independent producers and consumers without importing a database, runner, UI, queue, or vendor runtime.

Before proposing a schema change, open an issue with the user-visible interoperability problem, at least one producer and consumer example, backward-compatibility impact, privacy implications, and a counterexample. New required fields or changed meanings require a new schema identifier such as `agent.run.v2`; do not silently repurpose v1.

Run:

```powershell
npm ci
npm run check
npm pack --dry-run
```

Every normative change needs valid examples and an invalid regression case. Observation gaps, provenance, infrastructure status, redaction state, and single-run evidence labels must not be weakened for convenience.

Contributions are licensed under Apache-2.0 under the contribution terms in that license.
