# Coin Metrics monthly snapshots

The atlas serves an aggregated extract of Coin Metrics Community Network Data. Source data are attributed to Coin Metrics, Inc. and licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). CIRCULA's changes are monthly aggregation, unit labels and asset-scope annotations. The source's [Community data repository](https://github.com/coinmetrics/data) identifies the Community API and links its [license](https://github.com/coinmetrics/data/blob/master/LICENSE). This license applies separately from the Observatory software license.

## Build

Run from the repository root on Linux or macOS with Python 3.10+. The first command selects the last closed calendar month. For an as-of reproduction pass a specific closed month-end in UTC.

```sh
python scripts/community.py
python scripts/community.py --end 2026-10-31 --cache .cache/community
PYTHONDONTWRITEBYTECODE=1 python scripts/community_test.py
```

The input is the free anonymous API. The script discovers daily asset/metric pairs with `community=true` via `/v4/catalog-v2/asset-metrics`, resolves source names and definitions via `/v4/reference-data`, and requests full daily observations via `/v4/timeseries/asset-metrics`. It follows pagination, throttles requests and caches successful responses by release and request. Retrying a stopped build reuses that cache. Supply a fresh cache path to incorporate a provider restatement for the same cutoff. Source outages leave the previously published file in place. A file replacement is atomic, ordered by cutoff under a directory lock, and cannot remove previously published months silently. The tool runs off the request path, has no Cloudflare credentials and performs zero D1 operations.

## Definitions and validation

| Code | Monthly observation | Unit |
| --- | --- | --- |
| TxCnt | Sum of transactions. A transaction can perform several operations. Coin Metrics excludes coinbase transactions on UTXO chains. | transactions |
| TxTfrCnt | Sum of positive transfers between distinct ledger entities. Ethereum includes internal transfers and excludes self-sends and failed transfers. | transfers |
| AdrActCnt | Sum of the daily number of distinct active addresses. Repeated activity on different days contributes multiple times. | address-days |
| AdrBalCnt | Number of addresses with a positive native-unit balance on the final source date of the month. | addresses |
| SplyCur | Current supply on the final source date of the month. See each asset's definition for the accounting model. | asset units |
| BlkCnt | Sum of daily blocks added to the main chain. | blocks |

A flow requires all calendar dates and a non-null value for each one. A stock requires the last date. Zero is retained. Duplicate dates, negative values and nonfinite values abort the release. Each series' most recent published value is checked against a second, month-bounded request with independent aggregation. The per-series source link points to the official metric definition.

Scope-qualified IDs such as `usdc_eth` represent the deployment. Unqualified aggregate IDs remain separate. Where deployment metadata is unresolved the catalogue preserves the provider asset ID and disables cross-asset comparisons. Across the mapped UTXO networks, block and transaction counts share comparison keys. Differences in privacy features and address accounting make broader cross-network comparisons unsuitable. Ethereum token comparisons require an issuer-verified contract, matching metric, host and counting unit. Native-unit amounts carry the individual asset symbol. The eight populated contract identifiers were checked against [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses), [Circle EURC](https://developers.circle.com/stablecoins/eurc-contract-addresses), [Tether](https://tether.to/en/supported-protocols/) or [Ethena](https://docs.ethena.fi/technical-design/key-addresses).

For this release, BTC queries for BlkSizeByte, TxTfrValNtv and SplyAct1yr returned HTTP 403 at the Community endpoint. No daily pair for these measures was present in the tested Community discovery results. The SOL asset catalogue returned eight market series and no selected on-chain series. AdrBalCnt and SplyCur alone do not identify address-level inequality, inactivity or reactivation flows. Per-series first and last dates are retained independently, including assets where reporting ended.
