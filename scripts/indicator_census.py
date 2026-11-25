"""Coverage rules, exact UTC month-end sampling and a catalog-wide decision log."""

from bisect import bisect_left
from calendar import monthrange
from datetime import date, timedelta
from math import isfinite

from community import AGGREGATE, CONTRACT, HOST
from indicator_recipes import FLOW, HOLD, INDICATORS, INFRA, RAW


PUBLISHED = {spec.id: spec for spec in RAW}
HOLDING_MARKET = {
    "CapAct1yrUSD", "CapFutExp10yrUSD", "CapMVRVCur", "CapMVRVFF", "CapMVRVZ",
    "CapMrktCurUSD", "CapMrktFFUSD",
}
HOLDING_ECONOMICS = {"MCRC", "MCTC", "NUPL", "RCTC"}
FLOW_ECONOMICS = {"MOMR", "NVTAdj", "NVTAdj90", "NVTAdjFF", "NVTAdjFF90", "RVTAdj", "RVTAdj90"}
GAPS = [
    ["ledger-bytes", INFRA, "Serialized ledger history · GB", "Storia serializzata del registro · GB",
     "Σ BlkSizeByte / 10⁹ or Σ (BlkCnt × BlkSizeMeanByte) / 10⁹",
     ["BlkSizeByte", "BlkSizeMeanByte", "BlkCnt"], "history"],
    ["state-addresses", INFRA, "Address creation and contract stock", "Creazione di indirizzi e stock di contratti",
     "Σ AdrNewCnt · ContCnt · ContBalCnt · UTXOCnt",
     ["AdrNewCnt", "ContCnt", "ContBalCnt", "UTXOCnt"], ""],
    ["blob-retention", INFRA, "Block weight, blob load and retention", "Peso dei blocchi, blob e conservazione",
     "BlkWghtTot · blob counts and bytes · retained disk bytes by client and mode",
     ["BlkWghtTot", "BlkWghtMean", "BlobCnt", "BlobSizeByte", "BlobSizeAllTimeByte"], ""],
    ["top-share", HOLD, "Concentration in top addresses", "Concentrazione negli indirizzi al vertice",
     "100 × SplyAdrTop10Pct / SplyCur · SplyAdrTop10Pct × PriceUSD",
     ["SplyAdrTop10Pct", "SplyAdrTop1Pct", "SplyAdrTop100", "SplyCur", "PriceUSD"], "concentration"],
    ["gini", HOLD, "Gini and Lorenz curve", "Gini e curva di Lorenz",
     "Address-level balance distribution, or consistent group counts and balances",
     [], "concentration"],
    ["age-bands", HOLD, "Dormant units and balance-age bands", "Unità dormienti e fasce di età dei saldi",
     "SplyCur − SplyAct(window) · 100 × dormant / SplyCur · dormant × PriceUSD · differences of nested active windows",
     ["SplyAct1d", "SplyAct30d", "SplyAct1yr", "SplyAct2yr", "UTXOAgeValMean", "SplyCur", "PriceUSD"], "inactive"],
    ["supply-composition", HOLD, "Burned, free-float and locked supply", "Offerta bruciata, in free float e vincolata",
     "Burns · free float / current supply · staked / current supply for the same accounting scope",
     ["SplyBurntNtv", "SplyFF", "SplyActStkedNtv", "SplyCur"], ""],
    ["balance-cohorts", HOLD, "Address balance cohorts", "Coorti per soglia di saldo",
     "Differences of nested funded-address thresholds · balance shares by cohort",
     ["AdrBalCnt", "SplyAdrBalNtv0.1"], ""],
    ["revived", FLOW, "Older units returning to circulation", "Unità più vecchie tornate in circolazione",
     "SplyRvv30d · SplyRvv180d · SplyRvv1yr · older-spend flow over time",
     ["SplyRvv30d", "SplyRvv180d", "SplyRvv1yr"], "inactive"],
    ["turnover", FLOW, "Transfer amounts and velocity", "Quantità trasferite e velocità di circolazione",
     "Σ adjusted transfer value / mean same-scope supply · VelCurAdj1yr",
     ["TxTfrValAdjNtv", "TxTfrValAdjUSD", "VelCurAdj1yr", "VelActAdj1yr"], "circulation"],
    ["activity-sets", FLOW, "Distinct activity and idle-stock overlap", "Attività distinta e intersezione con i saldi",
     "AdrAct30dCnt · funded ∩ active with address-level observations",
     ["AdrAct30dCnt", "AdrBalCnt"], ""],
    ["expiry", INFRA, "Pruning, expiry, renewal and recovery", "Pruning, scadenza, rinnovo e recupero",
     "TTL, archival, restoration and node-serving measurements from protocol or client instrumentation",
     [], "expiration"],
]


def classify(row):
    key, product = row["metric"], row.get("product")
    category, sub = row.get("category"), row.get("subcategory")
    if key == "PriceUSD":
        return HOLD, "valuation-input"
    if product == "FARUM":
        if sub in {"Difficulty", "Hashrate", "Block Attributes", "Block size", "Blocks", "Block times", "Empty Blocks"}:
            return INFRA, "block-production"
        return FLOW, "operations-and-fees"
    if product != "Network Data":
        return "", "external-markets"
    if category in {"Addresses", "Wallets"}:
        return (FLOW, "address-activity") if sub == "Active" else (HOLD, "balance-population")
    if category == "Supply":
        return (FLOW, "revived-supply") if sub == "Revived" else (HOLD, "supply-composition")
    if category == "Network Usage":
        return (HOLD, "realized-valuation") if sub == "Profitability" else (INFRA, "record-and-state")
    if category in {"Exchange", "Exchange Traded Fund"}:
        return (HOLD, "attributed-custody") if sub.endswith("Supply") else (FLOW, "attributed-flows")
    if category == "Mining":
        if sub == "Balances":
            return HOLD, "attributed-custody"
        if sub.endswith("Flows"):
            return FLOW, "attributed-flows"
        return INFRA, "block-production"
    if category == "Staking":
        if sub in {"Consensus Health Metrics", "Penalty Metrics", "Slashing Metrics", "Validators"}:
            return INFRA, "validator-participation"
        return (FLOW, "attributed-flows") if sub == "Flows" else (HOLD, "staking-claims")
    if category in {"Transactions", "Fees and Revenue"}:
        return FLOW, "operations-and-fees"
    if key in HOLDING_MARKET | HOLDING_ECONOMICS or key.startswith("CapRealUSD"):
        return HOLD, "realized-valuation"
    if key in FLOW_ECONOMICS or key.startswith("SOPR"):
        return FLOW, "movement-and-age"
    if category == "Availability":
        return "", "provider-metadata"
    return "", "external-markets"


def audit_row(row, all_by_metric, public):
    key = row["metric"]
    area, family = classify(row)
    if key in PUBLISHED:
        area, status = PUBLISHED[key].area, "chart"
    elif key == "PriceUSD":
        status = "input"
    elif not area:
        status = "outside"
    elif public.get(key, {}).get("1d"):
        raise ValueError(f"Review the new Community indicator {key} and document its chart or input use")
    elif public.get(key):
        status = "other-frequency"
    else:
        status = "restricted" if key in all_by_metric else "unlisted"
    dates = all_by_metric.get(key, {})
    return [key, row["full_name"], row.get("product"), row.get("category"), row.get("subcategory"),
            row.get("unit"), area, family, status, len(public.get(key, {}).get("1d", {})),
            dates.get("1d", 0), ",".join(sorted(public.get(key, {}))), row.get("docs_url")]


def month_dates(first, last):
    year, month = first.year, first.month
    while (year, month) <= (last.year, last.month):
        yield date(year, month, monthrange(year, month)[1])
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)


def asset_identity(key, name, networks):
    if key in AGGREGATE:
        return [name, "aggregate", "", "", ""]
    if key in networks or key in {"flow_native", "flow_evm"}:
        return [name, "network", key, "", ""]
    suffix = key.rsplit("_", 1)
    if len(suffix) == 2 and suffix[1] in HOST:
        contract, source = CONTRACT.get(key, ("", ""))
        return [name, "deployment", "btc" if suffix[1] == "omni" else suffix[1], contract, source]
    return [name, "provider", "", "", ""]


class Daily:
    def __init__(self, values):
        self.values = {date.fromisoformat(day).toordinal(): value for day, value in values.items()}
        self.days = sorted(self.values)
        self.sums = [0]
        for day in self.days:
            self.sums.append(self.sums[-1] + self.values[day])

    def at(self, day, window=1, lag=0):
        last = day - lag
        if window == 1:
            return self.values.get(last)
        first = last - window + 1
        start = bisect_left(self.days, first)
        stop = bisect_left(self.days, last + 1)
        if stop - start == window:
            return self.sums[stop] - self.sums[start]
        return None


def valid_span(spans, spec):
    if not all(key in spans for key in spec.codes):
        return None
    if not spec.inputs:
        return spans[spec.id]
    first = max(date.fromisoformat(spans[key][0]) + timedelta(days=window + lag - 1)
                for key, window, lag in spec.inputs)
    last = min(date.fromisoformat(spans[key][1]) + timedelta(days=lag) for key, _, lag in spec.inputs)
    return [first.isoformat(), last.isoformat()] if first <= last else None


def evaluate(spec, daily, span, ordinals, cutoff):
    first, last = (date.fromisoformat(x).toordinal() for x in span)

    def read(day):
        if spec.cumulative:
            return daily[spec.codes[0]].at(day, day - first + 1)
        if not spec.inputs:
            return daily[spec.id].at(day)
        values = [daily[key].at(day, window, lag) for key, window, lag in spec.inputs]
        if None in values:
            return None
        value = spec.apply(*values)
        return value if value is not None and isfinite(value) else None

    offset = bisect_left(ordinals, first)
    end = bisect_left(ordinals, last + 1)
    values = [read(day) for day in ordinals[offset:end]]
    present = [i for i, value in enumerate(values) if value is not None]
    points = [offset + present[0], values[present[0]:present[-1] + 1]] if present else [0, []]

    if spec.cumulative:
        days = daily[spec.codes[0]].days
        # The first missing UTC day makes subsequent prefixes invalid.
        contiguous = next((first + i for i, day in enumerate(days) if day != first + i), first + len(days))
        latest = min(cutoff, last, contiguous - 1)
    elif not spec.inputs:
        latest = daily[spec.id].days[-1] if daily[spec.id].days else 0
    else:
        latest = min(cutoff, last, *(daily[key].days[-1] + lag if daily[key].days else 0
                                    for key, _, lag in spec.inputs))
    # A series can have valid daily observations between the fixed month ends.
    latest_point = None
    for day in range(latest, first - 1, -1):
        value = read(day)
        if value is not None:
            latest_point = [date.fromordinal(day).isoformat(), value]
            break
    return [list(span), points, latest_point]


class Census:
    def __init__(self, as_of, cutoff, definitions, available, public, assets):
        self.as_of = as_of
        self.cutoff = cutoff
        self.definitions = definitions
        self.public = public
        self.names = {r["asset"]: r["full_name"] for r in assets}
        self.all_by_metric = {row["metric"]: {f["frequency"]: len(f["assets"]) for f in row["frequencies"]}
                              for row in available}
        networks = next((row for row in available if row["metric"] == "BlkCnt"), {})
        self.networks = {asset for f in networks.get("frequencies", []) for asset in f["assets"]}
        first = min(date.fromisoformat(span[0]) for k in PUBLISHED for span in public.get(k, {}).get("1d", {}).values())
        self.months = list(month_dates(first, cutoff))
        self.ordinals = [day.toordinal() for day in self.months]
        self.rows = {spec.id: {} for spec in INDICATORS}
        self.assets = {}
        self.source_pairs = set()
        self.checked_pairs = set()

    def add(self, batch, raw):
        for _, _, asset, _ in batch:
            spans = {key: values["1d"][asset] for key, values in self.public.items()
                     if "1d" in values and asset in values["1d"]}
            daily = {key: Daily(values) for key, values in raw[asset].items()}
            for key, observed in daily.items():
                if key in PUBLISHED:
                    self.checked_pairs.add((key, asset))
                    if observed.days:
                        self.source_pairs.add((key, asset))
            self.assets[asset] = asset_identity(asset, self.names.get(asset, asset), self.networks)
            for spec in INDICATORS:
                span = valid_span(spans, spec)
                if not span:
                    continue
                if all(key in daily for key in spec.codes):
                    result = evaluate(spec, daily, span, self.ordinals, self.cutoff.toordinal())
                else:
                    result = [list(span), [0, []], None]
                self.rows[spec.id][asset] = result

    def finish(self):
        # Include all advertised pairs, even if a series begins after the cutoff
        # or starts too late to calculate the selected monthly window.
        asset_ids = set().union(*(self.public.get(key, {}).get("1d", {}) for key in PUBLISHED))
        all_daily = {key: self.public[key]["1d"] for spec in INDICATORS for key in spec.codes
                     if self.public.get(key, {}).get("1d")}
        for asset in asset_ids:
            self.assets.setdefault(asset, asset_identity(asset, self.names.get(asset, asset), self.networks))
            spans = {key: data[asset] for key, data in all_daily.items() if asset in data}
            for spec in INDICATORS:
                span = valid_span(spans, spec)
                if span:
                    self.rows[spec.id].setdefault(asset, [list(span), [0, []], None])
        rows = {key: dict(sorted(items.items())) for key, items in self.rows.items()}
        decisions = [audit_row(r, self.all_by_metric, self.public) for r in self.definitions]
        if {r[0] for r in decisions} != {r["metric"] for r in self.definitions} or set(self.public) - {r[0] for r in decisions}:
            raise ValueError("Reference and Community catalogs disagree about metric codes")
        indicators = [
            {"id": spec.id, "area": spec.area, "unit": spec.unit, "role": spec.role, "title": spec.title,
             "why": spec.why, "caution": spec.caution, "it": spec.it, "formula": spec.formula or spec.id,
             "codes": spec.codes, "derived": bool(spec.inputs), "catalogCount": len(rows[spec.id]),
             "observationCount": sum(row[2] is not None for row in rows[spec.id].values()),
             "monthlyCount": sum(bool(row[1][1]) for row in rows[spec.id].values())}
            for spec in INDICATORS
        ]
        eligible_source_pairs = {(key, asset) for key in PUBLISHED for asset, span in all_daily[key].items()
                                 if span[0] <= self.cutoff.isoformat()}
        if self.checked_pairs != eligible_source_pairs or not self.source_pairs:
            raise ValueError("Some Community series were not checked against the time series API")
        if any(not item["monthlyCount"] for item in indicators):
            raise ValueError("A displayed indicator has no month-end observations")
        totals = {
            "definitions": len(decisions), "catalogued": len(self.all_by_metric),
            "relevant": sum(bool(r[6]) for r in decisions), "publicCodes": len(self.public),
            "restricted": sum(r[8] == "restricted" for r in decisions),
            "published": len(indicators), "direct": len(PUBLISHED), "derived": len(INDICATORS) - len(PUBLISHED),
            "assetIds": len(asset_ids), "basePairs": sum(len(all_daily[key]) for key in PUBLISHED),
            "observedBasePairs": len(self.source_pairs), "catalogPairs": sum(x["catalogCount"] for x in indicators),
            "monthlyPairs": sum(x["monthlyCount"] for x in indicators),
            "observedPairs": sum(x["observationCount"] for x in indicators),
        }
        audit = {"schema": 1, "asOf": self.as_of.isoformat(), "cutoff": self.cutoff.isoformat(),
                 "totals": totals, "metrics": decisions, "indicators": indicators, "gaps": GAPS}
        data = {"schema": 1, "asOf": audit["asOf"], "cutoff": audit["cutoff"],
                "months": [day.isoformat() for day in self.months], "assets": dict(sorted(self.assets.items())),
                "rows": rows}
        return audit, data
