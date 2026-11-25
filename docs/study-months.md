# Month-end study series

The monthly history powers the custom comparison matrix and the indicator detail charts. The frozen 2019–2025 edition has a separate data file. Each month end in the rolling edition uses the source history retrieved for that release.

## Build and reuse

The keyless extraction stores HTTP responses under the UTC cutoff. Run both scripts against the same cache and cutoff. The current builder discovers indicators before asset identifiers. Both builders use the same calendar-day validation and observation functions.

```sh
python3 scripts/study_current.py --end 2026-10-31 --cache .cache/study
python3 scripts/study_series.py --end 2026-10-31 --cache .cache/study
```

A 30-day window ending on 29 February 2024 begins on 31 January. A month-on-month cumulative increment for that February covers 29 days. Cumulative transaction and block observations include every calendar day from the provider's respective start. A gap in that history invalidates every later cumulative observation until the provider supplies the missing day.

The study-series JSON holds ordered UTC month ends in `dates`. For an ID, subtract the asset's `offset` from a date's zero-based index to address its `columns` or `inputs`. Numbers include measured zeros. Gaps use inclusive global date-index ranges with a status and source detail. A token deployment's block history refers to the host ID. Only provider IDs with an on-chain input enter this data file. Source values and derivatives remain under [Coin Metrics Community's CC BY-NC 4.0 terms](https://github.com/coinmetrics/data/blob/master/LICENSE).

## Checks for the October 2026 release

- The release contains 214 month ends, from January 2009 through October 2026. The ten paper indicators yield 79,210 observed values across 142 provider IDs.
- All endpoint values were checked against the independent current matrix layout. The six-indicator intersection contains 75 IDs for December 2019 through December 2025, 74 for December 2019 through October 2026, and 115 for February 2024 through October 2026. All other pairs and indicator subsets calculate their own intersections.
- Separate Coin Metrics requests in reverse order for BTC, ETH and USDC on Ethereum verified the February 2024 month-end stocks, cumulative increments and trailing means. In Bitcoin the funded count was 51,304,018. The sum of the 30 daily active counts was 26,452,781. The sample also checks exchange valuation and supply share where attributed exchange balances are available.
- LPT transaction history through August 2019 has 483 of 489 required days. The first missing observation is 3 August. Ethereum had 19,336,606 cumulative blocks on 29 February 2024. The corresponding deployment `usdc_eth` has no separate block count.

Run `python3 -m unittest discover -s scripts -p 'study_series_test.py'` for calendar, gap compression and reconciliation tests. Run `node --import tsx --test tests/study-months.test.ts` to test the published data through the browser's point decoder.
