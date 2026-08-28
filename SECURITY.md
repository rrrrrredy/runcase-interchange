# Security policy

The protocol must not become a secret transport. Producers are responsible for redacting before serialization; consumers must preserve redaction and observation-gap metadata.

Report schema or CLI vulnerabilities privately through the repository's [security advisory form](https://github.com/rrrrrredy/agent-run-protocol/security/advisories/new). Do not attach real Run exports, credentials, proprietary task data, or private content-store objects. Use synthetic examples.

Only the latest tagged preview release receives fixes. The project has no response-time SLA before 1.0.

Version 0.1 is not published to the public npm registry. Obtain packages only from this repository's GitHub Release, compare them with `SHA256SUMS.txt`, and verify the GitHub provenance attestation when your supply-chain policy requires it.
