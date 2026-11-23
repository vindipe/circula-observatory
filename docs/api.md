# Observatory API v1

The API is public and read-only. It serves the Observatory archive as UTF-8 JSON or CSV. Times are UTC. An unavailable observation has no row.

| Endpoint | Parameters and output |
| --- | --- |
| `GET /api/v1/metadata` | Metric definitions, categories, units, comparison rules, source documentation, collection cadence and licenses |
| `GET /api/v1/overview` | Catalogued and measured counts by entity type, featured observations and latest observation timestamp |
| `GET /api/v1/catalog` | `q` text, `kind` (`network`, `asset`, `protocol`, `system`), `perspective`, `category`, `metric`, `scope` (`measured` by default or `catalog`), `from`, `to` and `page` |
| `GET /api/v1/entities/{id}` | Entity metadata, measured series range, latest values and entity relationships |
| `GET /api/v1/series` | `entities` is a comma-separated list of one to four entity IDs. `metric` is required. Optional inclusive `from` and `to` use YYYY-MM-DD, up to 366 days. Optional `format=csv` or `format=json` requests an attachment |
| `GET /api/v1/status` | Source collection status, latest observed and ingested timestamps, scheduled execution time, job failures and recent run records |

The catalog returns up to 27 records per page. Its date filters select series whose observed coverage span intersects the dates. The series endpoint reports the actual observations and counts absent days, including dates outside the recorded span. Use the detail endpoint's coverage for precise known bounds per subject.

Example request for blocks recorded on Bitcoin and Ethereum:

```text
/api/v1/series?entities=network%3Abtc%2Ceip155%3A1&metric=blocks&format=csv
```

Each observation contains `entity_id`, `metric_id`, `day`, `value`, `unit`, `observed_at`, `collected_at`, `context` and `revision`. JSON includes definitions and provenance. CSV repeats source and license on each row. `context` is a nullable JSON-encoded string with source-specific context such as a Stellar ledger sequence. Daily aggregate timestamps are UTC interval labels. Snapshot timestamps represent the measurement time or an upstream ledger-close timestamp as specified by the adapter. Values are persisted as IEEE 754 numbers and may round provider decimals.

A comparison uses one metric identity and unit, a compatible entity class or a shared observation cohort. Native asset quantities retain their asset-specific denomination. Overlapping provider aggregates are excluded from multi-subject calls. Incompatible comparisons return HTTP 422. Invalid query parameters return 400, an unknown entity returns 404 and a temporarily unavailable archive returns 503.

Retain source attribution and the stated dataset terms when you export or reuse values. [Dataset licenses](sources.md)
