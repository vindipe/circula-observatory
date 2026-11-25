# Exploring the persistence study

Choose a resource on the home page to inspect its observations, or open **Study matrix** to construct the sample by indicator. The public preview uses Coin Metrics Community data under CC BY-NC 4.0. The separate Bitcoin block history and output cohorts use Bitview under CC BY 4.0. Consult each chart for its source, unit and reuse terms.

## Editions and coverage

| Comparison in UTC | IDs with all six common indicators at both dates |
| --- | ---: |
| Frozen paper, 31 Dec 2019 → 31 Dec 2025 | 75 |
| Updated release, 31 Dec 2019 → 31 Oct 2026 | 74 |
| Updated release, 29 Feb 2024 → 31 Oct 2026 | 115 |

The current extraction consulted 1,156 catalog IDs. Of these, 142 have an input relevant to the on-chain indicators. Market price alone cannot qualify an ID. The month-end history has 79,210 observed indicator values across 214 dates from January 2009 through October 2026. Each custom interval selects its own sample. Native series, multichain aggregates and deployments can overlap. Host block and byte histories are counted once per network.

At the paper cutoffs BTC had 28,216,555 and 55,225,893 funded addresses. The corresponding 30-day sums of daily active addresses were 21,017,962 and 19,776,101. Clipping the difference at zero and dividing by funded addresses gives 25.51195% and 64.19053%. The union of active addresses can be smaller than the daily sum. These two bounds alone cannot establish the direction of change in the underlying share of inactive addresses. BTC exchange custody moved from 16.33908% to 13.39402%. Its USD valuation uses the price on the same cutoff date. Neither complete-history GB formula had a qualifying Community pair.

| Analysis | Observation | Important limit |
| --- | --- | --- |
| Infrastructure | Cumulative transactions and blocks since the first eligible provider day. Bitview separately reconstructs Bitcoin bytes and unspent output count. | A missing day invalidates later cumulative totals. Node disk use and live state require different inputs. |
| Holdings | Funded addresses, native supply, 30-day lower bound and exchange custody. Bitcoin output stock and spending by age are available at 1, 90 and 365 days. | Gross spending includes change. Community has no qualifying one-day or annual active-supply or annual revived-supply input in this edition. |
| Circulation | Transfers and active addresses per day averaged over 30 complete UTC days. Monthly event totals are available in the circulation dashboard. | An address may recur. A transaction may contain multiple transfers. Cross-asset comparison requires compatible accounting. |
| Concentration and expiration | Descriptive address distributions on Bitcoin and sampled Stellar TTL events, with references and effective dates. | Custody, issuance and address reuse matter. Gaps in sampled ledger closes prevent inference of exact expiration times. DLT 2025 PRO is bibliographic context. |

## Reproduction and monthly refresh

Run the paper's own generator with `--verify` in the data directory of `vindipe/circula`. The following commands run from the Observatory repository. The paper-data argument to the first command must point to the exact frozen edition.

```sh
python3 scripts/study_frozen.py /path/to/workspace/WP0/papers/middleware-2027-big-ideas/data
python3 scripts/refresh-study.py
python3 -m unittest discover -s scripts -p '*_test.py'
npm run check
npm test
npm run build
node scripts/pack-atlas.mjs .cache/CIRCULA-Observatory.html
```

The monthly workflow stages live Community responses, the updated pair and historical month-ends under a cache. A study release checks its frozen edition, dates, provider IDs, definition fingerprints and integrity before atomically replacing the publication pointer. Retry uses completed inputs. The client pins the pointer for the session and reads static resources only. The scheduled job is a build of a release artifact. Preview and production deployments are separate actions.

- [Frozen edition and original CSV reconciliation](frozen-study.md)
- [Current catalog, per-indicator counts and the XVG cutoff](current-study.md)
- [Monthly aggregation and independent leap-month checks](study-months.md)
- [Protocol references and effective dates](atlas-protocols.md)
- [Bitcoin output cohort definitions](holdings.md)

## Preview verification

The 25 TypeScript and 39 Python tests passed on the November 2026 snapshot. The Chromium checks exercised 320 px and 390 px viewports and a desktop viewport. They inspected the inactive bound by keyboard and touch, compared BTC and LTC over a custom interval, followed a token to its host's block series, reloaded shared URLs, and checked USD price dates. The matrix test traversed all four pages of the frozen six-indicator result and verified that the native CSV download contained the same 75 IDs. The standalone HTML reloaded the matrix and indicator detail with zero HTTP requests. Two successive promotions of verified files produced one immutable release; a staged definition change failed and preserved the previous pointer.
