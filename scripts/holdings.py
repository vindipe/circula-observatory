#!/usr/bin/env python3
"""Produce verified monthly Bitcoin UTXO stock, share and spending from Bitview's index."""
import argparse
import calendar
import fcntl
import json
import math
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public/atlas/holdings.json"
API = "https://bitview.space/api/series"
BANDS = ["under_1h", "1h_to_1d", "1d_to_1w", "1w_to_1m", "1m_to_2m", "2m_to_3m",
         "3m_to_4m", "4m_to_5m", "5m_to_6m", "6m_to_9m", "9m_to_1y", "1y_to_18m",
         "18m_to_2y", "2y_to_3y", "3y_to_4y", "4y_to_5y", "5y_to_6y", "6y_to_7y",
         "7y_to_8y", "8y_to_10y", "10y_to_12y", "12y_to_15y", "over_15y"]
THRESHOLDS = {1: BANDS.index("1d_to_1w"), 90: BANDS.index("3m_to_4m"), 365: BANDS.index("1y_to_18m")}
STOCK = "supply"
SPENDING = "transfer_volume_cumulative"
BASE_DATE = date(2009, 1, 1)
SAT = Decimal("0.00000001")
LICENSE = "https://creativecommons.org/licenses/by/4.0/"


def read(url):
    req = Request(url, headers={"User-Agent": "CIRCULA Observatory research snapshots"})
    with urlopen(req, timeout=60) as response:
        return json.load(response, parse_float=Decimal)


def ids(kind):
    bands = BANDS if kind == STOCK else BANDS[min(THRESHOLDS.values()):]
    return [f"age_{band}_{kind}" for band in bands]


def load(index, start, end, names):
    """Request small ordered batches and reject incomplete coverage, nulls and wrong units."""
    def chunk(keys):
        query = urlencode({"series": ",".join(keys), "index": index, "start": start, "end": end,
                           "limit": end - start}, safe=",")
        result = read(f"{API}/bulk?{query}")
        if len(result) != len(keys):
            raise ValueError("Incomplete response to bulk request")
        out = {}
        for key, row in zip(keys, result, strict=True):
            expected = {"timestamp": "Timestamp", "first_height": "Height", "utxo_count": "Count"}.get(key, "Bitcoin")
            if (row["index"], row["type"], row["start"], row["end"]) != (index, expected, start, end):
                raise ValueError(f"Unexpected index, units or coverage for {key}")
            values = row["data"]
            if len(values) != end - start or any(v is None or v < 0 for v in values):
                raise ValueError(f"Missing or invalid {key} observations")
            out[key] = values
        return out

    result = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        for rows in pool.map(chunk, [names[i:i + 6] for i in range(0, len(names), 6)]):
            result.update(rows)
    return result


def total(data, names, index):
    return sum((Decimal(data[key][index]) for key in names), Decimal(0))


def build(now):
    latest_stamp = read(f"{API}/timestamp/month1/latest")
    latest_bucket = datetime.fromtimestamp(latest_stamp, UTC).date()
    stop = min(now.date().replace(day=1), latest_bucket)
    count = (stop.year - BASE_DATE.year) * 12 + stop.month - 1
    if count < 2:
        raise ValueError("Insufficient closed months")
    latest_observation = (stop - timedelta(days=1)).isoformat()
    series_ids = ["timestamp", "circulating_supply", "utxo_count", SPENDING, *ids(STOCK), *ids(SPENDING)]
    monthly = load("month1", 0, count, series_ids)
    audit_index = count - 1
    audit_month = datetime.fromtimestamp(monthly["timestamp"][audit_index], UTC).date()
    audit_first = audit_month - timedelta(days=1)
    day_start = (audit_first - BASE_DATE).days
    day_end = day_start + calendar.monthrange(audit_month.year, audit_month.month)[1] + 1
    daily = load("day1", day_start, day_end, series_ids)
    for i, ts in enumerate(daily["timestamp"]):
        if datetime.fromtimestamp(ts, UTC).date() != audit_first + timedelta(days=i):
            raise ValueError("Daily extraction has a calendar gap")
    for key in series_ids[1:]:
        if (daily[key][0], daily[key][-1]) != (monthly[key][audit_index-1], monthly[key][audit_index]):
            raise ValueError(f"Independent daily endpoints disagree for {key}")
    samples, output = [], []
    for days, band_index in THRESHOLDS.items():
        supply_names = [f"age_{b}_{STOCK}" for b in BANDS[band_index:]]
        spend_names = [f"age_{b}_{SPENDING}" for b in BANDS[band_index:]]
        stocks, ratios, flows = [], [], []
        previous = Decimal(0)
        for i, ts in enumerate(monthly["timestamp"]):
            dt = datetime.fromtimestamp(ts, UTC).date()
            if dt != date(2009 + i // 12, i % 12 + 1, 1):
                raise ValueError("Monthly time axis mismatch")
            month = dt.strftime("%Y-%m")
            denominator = Decimal(monthly["circulating_supply"][i])
            # Percentages describe the whole indexed UTXO set. A different population
            # or a missing age cohort must not silently become a valid percentage.
            if denominator <= 0 or abs(total(monthly, ids(STOCK), i) - denominator) > len(BANDS) * SAT:
                raise ValueError(f"Age-band sum differs from unspent supply at {month}")
            qty = total(monthly, supply_names, i)
            current = total(monthly, spend_names, i)
            flow = (current - previous).quantize(SAT)
            if flow < 0 or qty > denominator:
                raise ValueError(f"Inconsistent UTXO measure at {month}")
            stocks.append([month, float(qty.quantize(SAT))])
            ratios.append([month, float((100 * qty / denominator).quantize(Decimal("0.00000001")))])
            flows.append([month, float(flow)])
            previous = current
        # Rebuild the latest month as the sum of daily changes in each age band's counter.
        recalculated = sum((sum(Decimal(b) - Decimal(a) for a,b in zip(daily[k],daily[k][1:]))
                            for k in spend_names), Decimal(0))
        if recalculated.quantize(SAT) != Decimal(str(flows[-1][1])):
            raise ValueError(f"Independent daily spending sum disagrees at {audit_month}")
        samples.append({"thresholdDays": days, "month": flows[-1][0],
                        "daysSummed": day_end - day_start - 1, "flowBTC": flows[-1][1],
                        "stockBTC": stocks[-1][1], "unspentSupplyBTC": float(daily["circulating_supply"][-1])})
        age = f"{days} day" if days == 1 else f"{days} days"
        for prefix, label, kind, unit, points, method in [
            ("inactive", "Inactive supply", "stock", "BTC", stocks,
             "Sum of BTC in unspent outputs at the final indexed block of the calendar month."),
            ("inactive_pct", "Share of inactive supply", "ratio", "%", ratios,
             "100 × BTC in the selected age bands / BTC in all indexed unspent outputs at month-end. "
             "Bitcoin Core excludes provably unspendable outputs such as OP_RETURN."),
            ("revived", "Previously inactive BTC spent", "flow", "BTC", flows,
             "Month-end difference in cumulative gross spent-output value across the selected age bands. "
             "Includes change-related spending, self-transfers and consolidations.")]:
            output.append({"dashboard": "inactive", "asset": "btc", "name": "Bitcoin", "network": "Bitcoin",
                "contract": None, "symbol": "BTC", "frequency": "1mo", "lastObservation": latest_observation,
                "metric": f"{prefix}_{days}d", "label": f"{label} ≥ {age}",
                "thresholdDays": days, "kind": kind, "unit": unit, "comparison": None,
                "scope": f"Bitcoin UTXOs aged at least {age}. Age runs from creation on the running maximum of block-header timestamps.",
                "method": method, "source": "Bitview (bitview.space)", "sourceUrl": "https://bitview.space",
                "license": "CC BY 4.0", "licenseUrl": LICENSE, "points": points})
    counts = monthly["utxo_count"]
    if any(type(n) is not int for n in counts):
        raise ValueError("Fractional UTXO count")
    output.append({"dashboard": "history", "asset": "btc", "name": "Bitcoin", "network": "Bitcoin",
                   "symbol": "BTC", "frequency": "1mo", "lastObservation": latest_observation,
                   "metric": "utxo_count", "label": "Unspent transaction outputs", "kind": "stock", "unit": "UTXO",
                   "comparison": None, "contract": None, "source": "Bitview (bitview.space)",
                   "sourceUrl": API + "/utxo_count", "license": "CC BY 4.0", "licenseUrl": LICENSE,
                   "scope": "Bitcoin Core UTXO set, including zero-value outputs.",
                   "scopeI18n": {"it": "Insieme degli UTXO Bitcoin Core, inclusi gli output a valore zero.",
                                 "fr": "Ensemble des UTXO Bitcoin Core, y compris les sorties de valeur nulle.",
                                 "de": "UTXO-Menge von Bitcoin Core, einschließlich Outputs mit Wert null."},
                   "method": "Stock after the last block in the month. Outputs Core classifies as unspendable are excluded.",
                   "methodI18n": {"it": "Conteggio dopo l’ultimo blocco del mese. Esclude gli output che Core classifica come non spendibili.",
                                  "fr": "Effectif après le dernier bloc du mois. Les sorties classées indépensables par Core sont exclues.",
                                  "de": "Bestand nach dem letzten Block des Monats. Von Core als unausgebbar eingestufte Outputs sind ausgeschlossen."},
                   "points": [[datetime.fromtimestamp(ts, UTC).strftime("%Y-%m"), value]
                              for ts, value in zip(monthly["timestamp"], counts, strict=True)]})
    volume, volume_check = gross_input_volume(monthly, count, latest_observation)
    output.append(volume)
    return {"series": output, "unavailable": [], "verification": samples,
            "terms": "https://bitview.space/terms/", "upstreamSeries": series_ids,
            "acquiredAt": now.isoformat(), "lastDayUtxoCount": daily["utxo_count"][-1],
            "upstreamFirstOpenMonth": latest_bucket.isoformat(), "grossInputVolumeCheck": volume_check}


def gross_input_volume(monthly, count, latest_observation):
    precision = Decimal("0.0001")
    cumulative = [Decimal(value) for value in monthly[SPENDING]]
    differences = [current - previous for previous, current in zip([Decimal(0), *cumulative[:-1]], cumulative)]
    if any(value < 0 for value in differences):
        raise ValueError("Gross spent-input counter decreased")

    # Recompute the whole latest month from independent per-block observations.
    boundary = load("month1", count - 1, count + 1, ["first_height"])["first_height"]
    first, stop = boundary
    per_block = load("height", first, stop, ["transfer_volume"])["transfer_volume"]
    actual = sum((Decimal(v) for v in per_block), Decimal(0))
    # The source emits BTC floating-point levels. Above 2^53 sats a cumulative
    # value can no longer encode every sat, even when individual blocks can.
    rounding_bound = sum((Decimal(str(math.ulp(float(v)))) for v in cumulative[-2:]), Decimal(0))
    if abs(actual - differences[-1]) > max(2 * SAT, rounding_bound):
        raise ValueError("Per-block values disagree with aggregate gross input volume")
    points = [[datetime.fromtimestamp(ts, UTC).strftime("%Y-%m"), float(value.quantize(precision))]
              for ts,value in zip(monthly["timestamp"], differences, strict=True)]
    method = ("Sum of input values in non-coinbase transactions, equal to output value plus fees. "
              "Includes change, self-transfers and consolidations. Counted each time BTC is spent. "
              "Monthly differences of the cumulative input counter, reported to 0.0001 BTC.")
    method_i18n = {
        "it": "Somma dei valori degli input delle transazioni diverse dalla coinbase, pari agli output più le commissioni. Include resto, autotrasferimenti e consolidamenti. I BTC contano ogni volta che vengono spesi. Differenza tra cumulati consecutivi, arrotondata a 0,0001 BTC.",
        "fr": "Somme des valeurs des entrées des transactions hors coinbase, égale aux sorties plus les frais. Inclut monnaie rendue, transferts à soi-même et consolidations. Les BTC comptent à chaque dépense. Différence des cumuls entre deux fins de mois, arrondie à 0,0001 BTC.",
        "de": "Summe der Inputwerte aller Transaktionen außer Coinbase. Sie entspricht den Outputs zuzüglich Gebühren. Wechselgeld, Überträge an eigene Adressen und Konsolidierungen sind enthalten. BTC zählen bei jeder Ausgabe erneut. Differenz aufeinanderfolgender Monatsendstände, gerundet auf 0,0001 BTC.",
    }
    scope_i18n = {
        "it": "Bitcoin, input spesi sulla catena canonica. Mesi UTC secondo il tempo monotono dei blocchi di Bitview.",
        "fr": "Bitcoin, entrées dépensées sur la chaîne canonique. Mois UTC selon le temps monotone des blocs de Bitview.",
        "de": "Bitcoin, ausgegebene Inputs der kanonischen Kette. UTC-Monate nach monotonen Blockzeitstempeln von Bitview.",
    }
    series = {"asset":"btc", "name":"Bitcoin", "symbol":"BTC", "network":"Bitcoin", "contract":None,
              "dashboard":"circulation", "metric":"gross_input_volume_btc", "label":"Gross spent-input value",
              "unit":"BTC", "kind":"flow", "frequency":"1mo", "comparison":None,
              "scope":"Bitcoin spent inputs on the canonical chain. UTC months follow Bitview’s monotonic block time.",
              "scopeI18n":scope_i18n, "method":method, "methodI18n":method_i18n, "source":"Bitview (bitview.space)",
              "sourceUrl":"https://bitview.space/", "license":"CC BY 4.0", "licenseUrl":LICENSE,
              "points":points, "lastObservation":latest_observation}
    check = {"month":points[-1][0], "startHeight":first, "endHeightInclusive":stop - 1, "blocksSummed":stop - first,
             "rawBlockSumBTC":str(actual), "monthCounterDifferenceBTC":str(differences[-1]),
             "unitPrecisionBTC":str(precision), "definition":API + "/transfer_volume_cumulative"}
    return series, check


def publish(output):
    output.parent.mkdir(exist_ok=True, parents=True)
    # Lock the directory so even overlapping offline refreshes cannot move the published snapshot backwards.
    payload = build(datetime.now(UTC))
    fd = os.open(output.parent, os.O_RDONLY)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        if output.exists():
            previous = json.loads(output.read_text())
            if previous["series"][0]["points"][-1][0] > payload["series"][0]["points"][-1][0]:
                raise ValueError("Refusing to replace a more recent verified snapshot")
        with tempfile.NamedTemporaryFile(mode="w", dir=output.parent, delete=False) as tmp:
            staged = Path(tmp.name)
            try:
                json.dump(payload, tmp, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
                tmp.write("\n")
                tmp.flush()
                os.fsync(tmp.fileno())
                staged.chmod(0o644)
                os.replace(staged, output)
            finally:
                staged.unlink(missing_ok=True)
    finally:
        os.close(fd)
    print(json.dumps(payload["verification"]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    publish(parser.parse_args().output)
