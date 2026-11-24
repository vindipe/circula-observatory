# Frozen Community study

The paper edition fixes two UTC observation dates, 31 December 2019 and 31 December 2025. The source records acquisition on 24 November 2026 at 22:12:39 UTC. An ID identifies a provider series. Native assets, token deployments and overlapping aggregates can share economic activity. A token has its own recorded transaction series where available. Its host supplies the underlying block history.

## Reproduction

From a checkout of `vindipe/circula`, locate `workspace/WP0/papers/middleware-2027-big-ideas/data/`. Pass the absolute path to the importer from the Observatory checkout:

```sh
python3 scripts/study_frozen.py /path/to/paper/data
python3 scripts/study_frozen_check.py --paper-data /path/to/paper/data
python3 -B -m unittest discover -s scripts -p study_frozen_test.py
```

The importer validates the Git blobs of the dictionary, generator, JSON and coverage CSV. It runs the paper's original `--verify` mode, which regenerates the printed and full tables and the coverage matrix in memory. It compares all 2,840 endpoint cells to the paper CSV at original decimal precision before converting them to chart units. It also checks address lower bounds and both custody formulas from their operands. The replay command independently downloads daily records from the keyless Community API. Provider revisions can change the result of running this second check on a later date.

The Observatory publishes unscaled counts, native amounts and USD amounts. Means divide the complete 30-day sum by 30. The paper's printed transaction, block, address and supply units are millions, and its printed means are thousands per day. The paper's printed USD value uses billions. The GB unit divides bytes by 1,000,000,000.

The supplemental file `scripts/reference/frozen-inputs.json` contains the observed Community catalog ranges used to distinguish absent inputs from windows outside coverage. It also records the four BTC/ETH exchange balances and prices, and the missing dates in the LPT, HEDG and LEO-on-EOS transaction histories. Published observations and derivatives of Coin Metrics Community data carry [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). [Provider archive and terms](https://github.com/coinmetrics/data)

## Verified results

The original generator reproduced the checked-in tables. A separately gathered batch of keyless daily API responses allowed a second replay of 1,275 numerical observations and 544 absences. These included the BTC and ETH exchange calculations. All matched the frozen file. A separate complete extraction kept with the paper audit also matched each asset's two endpoint dictionaries.

| Measure | IDs with values at both dates |
| --- | ---: |
| Recorded transaction history | 83 |
| Recorded block history | 22 |
| Serialized block history in GB, Community definition | 0 |
| Funded addresses | 78 |
| Supply | 84 |
| Inactive funded addresses, 30-day lower bound | 77 |
| Exchange custody share | 2 |
| Exchange custody valuation | 2 |
| Mean daily transfers | 85 |
| Mean daily active addresses | 83 |

Among 142 catalog IDs in the frozen matrix, 75 have both dates for all six common measures. Adding block counts yields 17. Requiring both exchange measures together with those seven leaves BTC and ETH. Other editions and selections compute their own intersections.

| Bitcoin, UTC | 31 Dec 2019 | 31 Dec 2025 |
| --- | ---: | ---: |
| Addresses with positive balance | 28,216,555 | 55,225,893 |
| Sum of daily active addresses over 30 days | 21,017,962 | 19,776,101 |
| Inactive funded addresses, lower bound | 25.5% | 64.2% |
| BTC in attributed exchange custody | 2,962,866.20908524 | 2,674,746.59753899 |
| Custody share | 16.3% | 13.4% |
| PriceUSD at cutoff | 7,167.39505464641 | 87,516.9780376972 |
| USD valuation of that custody balance | 21,236,032,615 | 234,085,739,233 |

Each active address can appear on several days in the sum. A zero lower bound is inconclusive. Three frozen ratio slots have zero denominators and 45 cells have measured zero values, including lower bounds of zero. The qualifying cumulative transaction histories exclude missing days. LPT lacks 3–8 August 2019, and HEDG lacks 29 July 2022. The Ethereum host of `usdc_eth` contributes no block counts to the token row. An aggregate such as `usdc` has a distinct ID and may overlap its deployments.

### Data vintages

A separate check verified the official [BTC archive](https://github.com/coinmetrics/data/blob/master/csv/btc.csv) at Git blob `5e50f336d268e1f3a38e9885b5aaef36de529700`, ending 24 May 2026. Its `AdrBalCnt` gives 28,404,831 and 55,782,613 on the two cutoffs. The November API edition used for the paper gives 28,216,555 and 55,225,893. Both vintage and source must travel with a comparison. The reason for this historical revision is unverified.

The GB coverage result applies to both paper cutoffs under the complete Community history rule. The separate Bitcoin block-level chart uses the Bitview dataset and its own byte and time definitions. The proposal's DLT 2025 PRO estimates serve as bibliographic context.
