# Coin Metrics indicator catalogue

Open **Indicators** in the Atlas. The catalogue searches and browses the reference data from Coin Metrics, with a decision for every asset-metric code. The dated snapshot records the dimensions in scope for CIRCULA, the public input coverage and the observations delivered by the API. Its audit CSV includes the provider’s own category, unit and documentation link.

The three areas follow the research questions. Infrastructure tracks the record and the protocol resources that maintain it. Holdings tracks the stock, age, custody and distribution of balances. Circulation tracks user operations, movement and the amounts or fees associated with that movement. Where relevant, price is an input for valuation. External trading and provider processing timestamps fall outside this scope. Related measurements such as staking, venue-specific flows and balance-age variants remain searchable in the audit.

The public charts use every daily provider ID available for each selected metric. Derived metrics require the corresponding inputs for the same ID, compatible units and temporal scope, and positive denominators where specified. The columns for the two cutoffs are recomputed from observed points on those dates. The published span is the range advertised by the catalog. Actual observations are checked against `timeseries/asset-metrics`. Some IDs are overlapping aggregates or token deployments. Coverage counts refer to series, and economic totals require resolving overlap.

## Measurement rules

- Each plot value is sampled on an exact calendar month end in UTC. A daily flow on the chart is the observation on that day. Smoothed flows use the trailing window in the formula.
- Rolling windows require all input days. A missing day leaves the affected window blank. Prefix sums of blocks and transactions require every day from the published series start. A missing day stops a prefix.
- Stock changes compare exact dates and preserve negative values and measured zeros. The coverage CSV shows absolute change and percentage change when the baseline is positive.
- The verified daily value shown beside the chart coverage predates or equals the cutoff. It can fall between month ends. The daily input CSV link retrieves the upstream source records for the selected provider ID.
- The daily-address lower bound uses the same set inequality as the Middleware study. An exact Gini needs balances in the chosen population at a defined height. The independent Bitcoin history and grouped concentration observations remain in their Atlas dashboards. The audit lists unavailable Community inputs for ledger bytes, concentration, dormant supply, revival and retention.

The public formulas and per-indicator interpretations live in `scripts/indicator_recipes.py`. The full-catalog decision rules and observation checks live in `scripts/indicator_census.py`. Historical study values use their existing research snapshots. Community data is attributed to [Coin Metrics](https://docs.coinmetrics.io/network-data/network-data-overview) under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).

## Reproduce

Run the refresh for the latest closed UTC month, using Python 3.11 or newer. The command uses public endpoints and caches downloaded pages under `.cache/indicators/`.

```sh
python3 -B scripts/refresh-indicators.py
python3 -B -m unittest discover -s scripts -p '*_test.py'
npm run build
node scripts/pack-atlas.mjs .cache/CIRCULA-Observatory.html
```

Use `--as-of 2026-11-25 --offline` with the cached provider responses to reconstruct the initial release through 31 October 2026. A fresh download can reflect provider revisions. The checked-in gzip snapshots support browser use and local preview without calls to D1 or Coin Metrics on page load.
