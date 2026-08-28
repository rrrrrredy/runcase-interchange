# Optional OpenTelemetry GenAI mapping

This mapping is an export adapter, not a replacement for the protocol. The OpenTelemetry GenAI agent conventions are currently marked Development and can change independently.

| Agent Run Protocol | OpenTelemetry concept | Mapping note |
|---|---|---|
| `run_id` | trace id or agent invocation span attribute | Preserve `run_id` as an additional attribute; it need not equal a trace id. |
| `events[*]` | spans and span events | One protocol event may map to a span, a span event, or no OTel record. |
| `agent.product` | `gen_ai.system` or provider attributes | Vendor naming can differ; retain the original protocol field. |
| `agent.model` | request/response model attributes | Protocol records the configured model; response model can live in event data. |
| `resource_usage.input_tokens` | GenAI input token usage | Map only when the source reports it. |
| `resource_usage.output_tokens` | GenAI output token usage | Map only when the source reports it. |
| `capture.gaps` | no canonical equivalent | Export as namespaced events or attributes; never discard. |
| `user_corrections` | feedback/evaluation event | Preserve correction text redaction and target event references. |
| `workflow.score.v1` validations | evaluation spans/events | Validator identity and evidence remain canonical in the score document. |

Round trips are not guaranteed. Importers must set `capture.mode` to `imported`, identify the mapping version, and add an observation gap for fields that cannot be reconstructed.
