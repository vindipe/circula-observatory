# Community study at a closed UTC month-end

The rolling edition fixes the first endpoint at 2019-12-31 and uses the last day of the preceding UTC month as its second endpoint. The matrix can also evaluate other pairs of monthly observations. All counts refer to provider IDs. Overlapping asset aggregates, deployments and their hosts can each be eligible.

## Acquisition and calculation

The input list is defined before asset discovery in [study_current.py](../scripts/study_current.py). The keyless [Community catalog](https://community-api.coinmetrics.io/v4/catalog-v2/asset-metrics) supplies daily availability. Each input must appear with the Community flag. The pipeline also requests [definitions](https://community-api.coinmetrics.io/v4/reference-data/asset-metrics), asset names, and [observations](https://community-api.coinmetrics.io/v4/timeseries/asset-metrics). The public API is sufficient for this pipeline. Coin Metrics distributes the observations under [CC BY-NC 4.0](https://github.com/coinmetrics/data#license). The acquisition interval records successful source-page retrieval times, including original retrieval times for reused pages.

The latest release examined 1,156 catalog IDs for the specified inputs. There were 142 candidates with on-chain metrics and 1,014 additional IDs with only price data, including SOL. The source JSON records both lists. IDs with missing dates stay in the candidate table. Eligibility depends on the requested indicators and endpoints.

| Indicator | 2019-12-31 and 2026-10-31 | 2026-10-31 alone |
| --- | ---: | ---: |
| Accumulated transactions | 82 | 127 |
| Accumulated blocks | 21 | 28 |
| Serialized history in GB using Community | 0 | 0 |
| Funded addresses | 77 | 118 |
| Current supply | 83 | 127 |
| Thirty-day inactive funded-address lower bound | 76 | 118 |
| Exchange custody share | 2 | 2 |
| Exchange valuation in USD | 2 | 2 |
| Thirty-day mean transfers | 84 | 128 |
| Thirty-day mean active addresses | 82 | 126 |
| All six core indicators | 74 | 116 |

For the six core indicators, the frozen 2019/2025 comparison includes 75 IDs. XVG drops out in the updated comparison because its public series stop on 2026-10-17. Counting only the cutoff gives a larger set because several deployments began after 2019.

Each cumulative count requires every day from the metric's first catalog date. For HEDG one missing day, 2022-07-29, invalidates subsequent cumulative transaction totals. LPT has six missing days starting 2019-08-03. The corresponding positive-balance observations and any complete recent 30-day windows remain independently eligible. Block bytes require a daily total or a daily product of the count and mean serialized block size back to the first block-count date. The separately licensed Bitcoin Bitview history in the atlas has its own coverage.

The stock cells use the exact cutoff date. The two circulation means and the address bound use all 30 UTC dates ending at the cutoff, even across month boundaries. The BTC example at 2026-10-31 has 57,273,270 funded addresses and 18,968,387 active address-days. Its bound is 66.880908%. Repeated active addresses make this bound conservative. A clipped zero cannot establish how many addresses were inactive. A zero denominator leaves the ratio undefined.

Exchange share and valuation use the provider's attributed balance on the same date. BTC custody on 2026-10-31 was 2,665,091.86877031 BTC, or 13.255029% of supply. The USD valuation uses the price of 77,401.0172870368 USD/BTC on that date. Off-chain customer allocations are outside this measurement. The remaining Community supply, revival, contract and UTXO inputs inspected by name have their coverage in the source JSON under `catalogAudit`. This includes the distinction between an unavailable metric at the public tier and a resource absent from the asset's accounting model.

## Scope, comparability and definition changes

Explicit suffixes establish deployment links in the paper convention. A USDC transfer on Ethereum has a deployment-specific transaction series, while Ethereum owns the serialized block and its byte count. The USDC and USDT cross-deployment aggregates receive a separate scope. Network IDs with block histories receive a network scope in the study. Other mappings remain unresolved. A network status does not specify a layer or make all networks' address or transaction counting rules comparable. Layer labels for verified base networks and token applications are searchable attributes.

The pipeline hashes each input's current provider description, unit and aggregation type. Promotion rejects a changed hash until reviewed. The Community API does not supply a dated, asset-specific history of every methodological revision alongside each observation. Historical continuity is therefore conditional on the published definition and known scope. The frozen edition keeps its committed input even when the provider revises backfilled numbers.

## Reproduction and checks

From repository root, run the following commands with Python 3.11 or newer. The first generates a standalone pair and the second checks regression fixtures. The end date must be the last day of a completed UTC month.

```sh
python3 scripts/study_current.py --end 2026-10-31 --cache .cache/study --output .cache/study-current.json
python3 -m unittest discover -s scripts -p 'study_current_test.py'
```

A second BTC request pages backward through the final 30 days. Seven observations are independently recalculated from those rows: funded addresses, supply, the lower bound, both daily means, the custody share and its valuation. Real input zeros, missing days and outside-span windows remain distinguishable. The regression fixtures include duplicate source rows, a zero denominator, a genuine zero value, an invalid byte-history day, alternate complete byte inputs, an ERC-20 deployment on its host and a provider definition change. Computation and checks run before replacement. The monthly release path uses the common [study release script](../scripts/refresh-study.py) and content-addressed artifacts.
