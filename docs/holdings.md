# Bitcoin inactive holdings

The publication contains monthly unspent BTC, its percentage of circulating UTXO value, and gross BTC spent during each month. The age thresholds use 1, 90 and 365 elapsed days. Bitview measures output age from creation using the running maximum of block-header timestamps. No address clustering or beneficial-owner inference enters these measures. A transaction creating change, consolidating outputs, or moving funds to another wallet controlled by the same party can spend an old output.

| Series | Definition |
| --- | --- |
| `inactive_1d`, `inactive_90d`, `inactive_365d` | Sum of BTC in the disjoint UTXO age bands meeting the threshold at the final indexed block of the month. |
| `inactive_pct_1d`, `inactive_pct_90d`, `inactive_pct_365d` | 100 × eligible BTC / all circulating UTXO BTC at that same block. Core excludes outputs known to be unspendable from the UTXO set. |
| `revived_1d`, `revived_90d`, `revived_365d` | Change across consecutive month ends in cumulative spent-output BTC for those age bands. An output is assigned its age at spending. The pre-genesis baseline is zero. |

The same snapshot supplies the Circulation dashboard with `gross_input_volume_btc`. Its denominator-free flow sums all input value spent in non-coinbase Bitcoin transactions each month. The amount equals the transaction outputs plus fees. It includes change, transfers back to the same owner, consolidations and repeated spending of the same BTC. Expanding this measure to other networks requires a compatible definition. [Provider definition](https://bitview.space/api/series/transfer_volume_cumulative)

Successive month-end cumulative BTC levels are differenced. The atlas reports four BTC decimal places because the upstream cumulative BTC representation can lose sub-microbitcoin precision as the counter grows. In October 2026 the sum for all 4,672 indexed blocks at heights 969,370–974,041 was 26,866,466.65317899 BTC. The monthly cumulative difference was 26,866,466.653179 BTC. The published value is 26,866,466.6532 BTC. The generator repeats the per-block check on the latest available complete month and validates every daily counter endpoint against the monthly extraction.

The initial release covers January 2009 through October 2026. The first month covers the network from genesis. November 2026 was in progress. The fetcher requires both a subsequent indexed bucket and a finished UTC calendar month before publishing values. A true early zero is retained. Missing values stop the update.

## Reproduce

Run `python3 scripts/holdings.py` from the repository or supply `--output PATH` to stage a candidate. The program reads free indexed endpoints off the visitor path, verifies the candidate, and atomically replaces the file under a directory lock. It refuses a shorter result if the preceding snapshot is present. Incoming groups use bounded concurrency. Failed fetches and checks leave the existing snapshot available.

The program checks every monthly timestamp and every component’s coverage, units and non-negativity. It reconciles all 23 age bands with total UTXO supply each month (rounding tolerance of one satoshi per band). For the latest closed month, it requests a separate daily extraction covering the prior month end and every calendar day. Each band’s two endpoints must agree with the monthly values, and summed daily changes must reproduce gross monthly spending. The snapshot stores those check values. The verification compares two index granularities from the same provider.

| October 2026, month-end or whole month as appropriate | ≥1 day | ≥90 days | ≥365 days |
| --- | ---: | ---: | ---: |
| Unspent BTC | 19,995,733.75239667 | 17,125,511.61559610 | 12,870,855.22309973 |
| Gross BTC spent | 3,501,743.24372614 | 718,014.00857513 | 334,998.97003598 |

The denominator on that date was 20,106,151.11551729 BTC. In the one-day series Bitview supplies Bitcoin UTXO cohorts directly. The original proposal estimates one-day inactivity by subtracting Coin Metrics active supply from current supply. These estimates have separate identifiers and provenance.

The Infrastructure dashboard also publishes Bitview’s `utxo_count`, a distinct month-end stock in units of UTXOs. It includes zero-value outputs and excludes outputs Bitcoin Core classifies as unspendable. The 31 October daily extraction matched the month-end stock of 164,160,988 UTXOs. This counts entries and does not measure live-state bytes. [Definition](https://bitview.space/api/series/utxo_count)

## Attribution and reproducibility links

Bitview (bitview.space) provides the source data under CC BY 4.0. CIRCULA selects cohorts, adds their BTC quantities, computes shares and differences month-end cumulative spending. These series use the on-chain fields computed by Bitview. [Bitview terms](https://bitview.space/terms/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

The source exposes machine-readable definitions for each metric. Published snapshot metadata records each series ID. [90-day cohort example](https://bitview.space/api/series/age_3m_to_4m_supply) · [365-day cohort example](https://bitview.space/api/series/age_1y_to_18m_supply) · [Cumulative spending](https://bitview.space/api/series/age_1y_to_18m_transfer_volume_cumulative) · [Unspent supply denominator](https://bitview.space/api/series/circulating_supply) · [API reference](https://bitview.space/api)
