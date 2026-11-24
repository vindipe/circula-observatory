# Bitcoin address balance distribution

CIRCULA derives these monthly observations from the public, keyless [Bitview (bitview.space)](https://bitview.space/) indexed API. The source data and series descriptions are licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The atlas groups records in calendar time, computes shares and measures inequality. No fees, authenticated services or direct node requests are involved. [Provider terms](https://bitview.space/terms/)

## Positive address balances

Bitview uses its monotonic block timestamp to assign a canonical height to each UTC calendar period. At each month-end, record the address count and BTC held in each of 14 mutually exclusive positive balance bands. Thresholds start at 1 satoshi and increase by factors of ten. Each includes its lower bound and excludes its upper bound. The top band includes every balance of 100,000 BTC or more. The snapshot keys retain counts separately from BTC. [Address charts](https://bitview.space/studio/presets/addresses/) · [Sample count definition](https://bitview.space/api/series/balance_over_100k_btc_address_count) · [Sample BTC definition](https://bitview.space/api/series/balance_1_to_10_sats_supply)

The population consists of Bitview's recognized Bitcoin address scripts with positive balances. P2PK keys are tracked in addition to P2PKH, P2SH and supported SegWit scripts. Exchange deposit and custody addresses, script-controlled balances and recognizable burn addresses receive no owner-based corrections. Multiple addresses controlled by the same person remain separate. The aggregate balance of customers in an exchange address belongs to one observed address. The extent of beneficial ownership cannot be inferred.

The January 2009–October 2026 preview includes 214 complete months. CIRCULA checks for a consecutive month grid and rejects missing fields. For every month the sum across bands in satoshis must equal the independent total-address-supply series. Counts must equal the source's funded address count minus its zero-satoshi band. For the 202 overlapping months starting in January 2010, a separate extraction published by Bitcoin Years agrees on every count and every per-band BTC figure to its publication precision of 0.01 BTC. Bitcoin Years also uses Bitview, so this check tests extraction and period alignment, not independence of the indexer. [Bitcoin Years, Bitcoin Stack Rank](https://bitcoinyears.com/stack-rank/)

## Grouped measurement

The Lorenz coordinates at a band boundary are the cumulative share of addresses and the cumulative share of their BTC. Those points are observed. Joining them linearly gives a grouped Lorenz polygon. Its area leads to a lower bound on the population Gini because individual balances can differ inside a band. If band j has nⱼ addresses and bⱼ satoshis, and Bⱼ is total satoshis in preceding bands, the lower bound is

    1 − Σⱼ nⱼ (2 Bⱼ + bⱼ) / [(Σⱼ nⱼ)(Σⱼ bⱼ)].

At some month-ends, the cumulative count from the largest bands downwards is exactly 100. At those dates the top-100 share is known exactly by summing the balances of those bands and dividing by all BTC in the positive bands. Six month-ends outside the address-level baseline satisfy this condition in the preview. A partial band at rank 100 leaves its exact share unidentified. No interpolated or estimated top-100 values are published.

## Address-level historical baseline

The January–December 2009 series uses every indexed transaction output and spent-output reference from genesis through the last block of 2009. Month boundaries come from the first canonical height of each succeeding month. A charged output belongs to the pair (locking-script type, type-local address index). The input index records the corresponding previously spent output; a coinbase input references none. The provider's positive-address accounting includes the genesis output. The 2009 sample recognises P2PK and P2PKH scripts, with no address-to-owner heuristics. This population measures balances attributed to scripts, including where spendability is unknown.

Each of the twelve month-end balance lists sums back to the independent Bitview cohort counts and satoshi totals in all 14 bands. We sort positive balances, calculate their address-level Gini from the weighted rank sum and compute the top-10 and top-100 proportions of the total. The published frequency table contains unique satoshi balances and the number of addresses above zero with each exact balance. Tied balances can therefore share one Lorenz segment without introducing within-band assumptions. For December 2009 the exact Gini is 0.0838544112 and the exact top-100 share is 8.59640628%. Later month-ends are represented only where the data support the chosen metric. [Bitview indexed data](https://bitview.space/api) · [Scope and reuse](https://bitview.space/terms/)

## Rebuilding

Run `python scripts/distribution.py --as-of 2026-11-01 --cache /tmp/circula-distribution --output public/atlas/distribution.json` to rebuild through October 2026. The cutoff is the start of the first excluded calendar month. An optional cache retains completed requests as separate files. The script validates the whole candidate and atomically replaces the destination. No D1 reads or writes occur. The test command is `python -m unittest discover -s scripts -p 'distribution_test.py'`.
