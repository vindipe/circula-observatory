#!/usr/bin/env python3
"""Build the monthly Bitcoin history snapshot offline from Bitview's public index."""
import argparse
from calendar import monthrange
from datetime import UTC, datetime
import fcntl
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = "https://bitview.space/api/series/"
LICENSE = "https://creativecommons.org/licenses/by/4.0/"
SIZE = "block_size_cumulative"
COUNT = "block_count_cumulative"


def month_at(index):
    return f"{2009 + index // 12:04}-{index % 12 + 1:02}"


def read_series(metric, index, **filters):
    url = API + metric + "/" + index
    if filters:
        url += "?" + urlencode(filters)
    request = Request(url, headers={"User-Agent": "CIRCULA Observatory monthly research snapshot"})
    with urlopen(request, timeout=45) as response:
        result = json.load(response)
    if result["index"] != index or result["end"] - result["start"] != len(result["data"]):
        raise ValueError(f"Malformed series at {url}")
    if result["type"] != ("Count" if metric == COUNT else "Bytes"):
        raise ValueError(f"Unexpected units at {url}")
    return result


def read_months(metric):
    series = read_series(metric, "month1")
    if series["start"] != 0:
        raise ValueError("Genesis baseline missing")
    return series["data"]


def complete_rows(sizes, counts, now):
    # An observation in the following bucket proves that the source closed the month.
    utc_month_index = (now.year - 2009) * 12 + now.month - 1
    n = min(len(sizes) - 1, len(counts) - 1, utc_month_index)
    if n < 1:
        raise ValueError("No completed month")
    rows = []
    previous_size = previous_count = 0
    for index in range(n):
        size, count = sizes[index], counts[index]
        if type(size) is not int or type(count) is not int:
            raise ValueError(f"Missing or non-integer month-end value for {month_at(index)}")
        added, blocks = size - previous_size, count - previous_count
        if added <= 0 or blocks <= 0:
            raise ValueError(f"Unexpected change in Bitcoin cumulative history at {month_at(index)}")
        rows.append((month_at(index), size, added, blocks))
        previous_size, previous_count = size, count
    return rows


def check_sample(sizes, counts, rows):
    sample = []
    for i in sorted({0, min(131, len(rows) - 1), len(rows) - 1}):
        first, end = counts[i - 1] if i else 0, counts[i]
        extracted = read_series("block_size", "height", start=first, end=end, limit=end-first)
        values = extracted["data"]
        if (extracted["start"], extracted["end"]) != (first, end) or any(type(v) is not int or v <= 0 for v in values):
            raise ValueError("Incomplete per-block verification data")
        if (not i and values[0] != 285) or sum(values) != rows[i][2]:
            raise ValueError(f"Monthly totals differ from serialized blocks at {rows[i][0]}")
        month = rows[i][0]
        anchor = read_series(SIZE, "month1", start=month + "-01", end=month_at(i + 1) + "-01")
        if anchor["start"] != i or anchor["data"] != [sizes[i]]:
            raise ValueError(f"Date lookup differs from positional lookup at {month}")
        sample.append({"month": month, "firstHeight": first, "lastHeight": end - 1,
                       "blocks": len(values), "serializedBytes": sum(values)})
    return sample


def check_prototype():
    # The earlier prototype archived a second indexed provider's per-block observations.
    archive = json.loads((ROOT / "public/research-data/bitcoin-bytes.v1.json").read_text())
    rows = archive["rows"]
    first, end = rows[0][0], rows[-1][0] + 1
    observed = read_series("block_size", "height", start=first, end=end, limit=end-first)
    if list(range(first, end)) != [r[0] for r in rows] or observed["data"] != [r[2] for r in rows]:
        raise ValueError("Bitview and the archived mempool.space block sizes differ")
    return {"source": "mempool.space", "firstHeight": first, "lastHeight": end - 1,
            "matches": len(rows), "archive": "public/research-data/bitcoin-bytes.v1.json"}


def series_rows(rows):
    scope = "Bitcoin main chain. Calendar months in UTC use Bitview’s monotonic block timestamps."
    definitions = [
        ("history_gb", "Recorded block history", "GB", "stock",
         "Sum since genesis of serialized block headers, transaction-count prefixes and transactions including witness data. 1 GB = 10⁹ bytes. State, indexes and node storage are excluded."),
        ("added_gb", "Block history added", "GB", "flow",
         "Difference between successive calendar month-end totals of serialized block bytes, divided by 10⁹. The first month starts from zero before genesis."),
        ("history_block_count", "Blocks recorded", "blocks", "flow",
         "Change in cumulative indexed block count over a calendar month. Genesis is counted."),
        ("mean_block_bytes", "Mean serialized block size", "bytes/block", "mean",
         "Total serialized bytes added during the calendar month divided by the number of blocks recorded in that month.")
    ]
    scope_i18n = {
        "it": "Catena principale di Bitcoin. I mesi UTC seguono i timestamp monotoni dei blocchi nell’indice Bitview.",
        "fr": "Chaîne principale de Bitcoin. Les mois UTC suivent les horodatages monotones des blocs dans l’index Bitview.",
        "de": "Bitcoin-Hauptkette. Die UTC-Kalendermonate beruhen auf den monotonen Blockzeitstempeln im Bitview-Index.",
    }
    methods = {
        "history_gb": {
            "it": "Somma dalla genesi dei byte serializzati delle intestazioni, dei prefissi che indicano il numero di transazioni e delle transazioni complete di witness. 1 GB = 10⁹ byte. Stato, indici e spazio su disco del nodo sono esclusi.",
            "fr": "Somme depuis la genèse des octets sérialisés des en-têtes, des préfixes de comptage des transactions et des transactions avec témoins. 1 Go = 10⁹ octets. Le calcul exclut l’état, les index et l’espace disque du nœud.",
            "de": "Summe der serialisierten Blockheader, Präfixe für die Transaktionsanzahl und Transaktionen einschließlich Witness-Daten seit dem Genesisblock. 1 GB = 10⁹ Byte. Zustand, Indizes und Plattenplatz eines Knotens sind ausgenommen.",
        },
        "added_gb": {
            "it": "Differenza fra i totali dei byte dei blocchi a due fini mese consecutive, divisa per 10⁹. Il primo mese parte da zero prima del blocco di genesi.",
            "fr": "Différence entre les octets cumulés à deux fins de mois consécutives, divisée par 10⁹. Le premier mois part de zéro avant le bloc de genèse.",
            "de": "Differenz der kumulierten Blockbytes an zwei aufeinanderfolgenden Monatsenden, geteilt durch 10⁹. Vor dem Genesisblock beträgt der Anfangswert null.",
        },
        "history_block_count": {
            "it": "Aumento del numero cumulato di blocchi indicizzati durante il mese di calendario. Il conteggio comprende il blocco di genesi.",
            "fr": "Variation du nombre cumulé de blocs indexés au cours du mois civil. Le total inclut le bloc de genèse.",
            "de": "Zunahme der kumulierten Zahl indexierter Blöcke im Kalendermonat. Der Genesisblock wird mitgezählt.",
        },
        "mean_block_bytes": {
            "it": "Byte serializzati aggiunti nel mese divisi per il numero di blocchi registrati nello stesso mese.",
            "fr": "Octets sérialisés ajoutés durant le mois divisés par le nombre de blocs enregistrés pendant ce mois.",
            "de": "Im Kalendermonat hinzugefügte serialisierte Bytes geteilt durch die Zahl der in diesem Monat erfassten Blöcke.",
        },
    }
    result = []
    end = rows[-1][0]
    y, m = map(int, end.split("-"))
    for i, (metric, label, unit, kind, method) in enumerate(definitions):
        points = []
        for month, total, added, blocks in rows:
            values = [total / 10**9, added / 10**9, blocks, added / blocks]
            points.append([month, values[i]])
        result.append({"asset": "btc", "name": "Bitcoin", "network": "Bitcoin", "contract": None,
                       "metric": metric, "label": label, "unit": unit, "kind": kind, "scope": scope,
                       "scopeI18n": scope_i18n, "methodI18n": methods[metric], "symbol": "BTC",
                       "method": method, "source": "Bitview (bitview.space)", "sourceUrl": "https://bitview.space/",
                       "license": "CC BY 4.0", "licenseUrl": LICENSE, "comparison": "bitcoin-monotonic-month-" + metric,
                       "dashboard": "history", "frequency": "1mo", "lastObservation": f"{end}-{monthrange(y,m)[1]:02}",
                       "points": points})
    return result


def publish(path, document):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Serialize promotion on the containing directory, including concurrent processes.
    directory = os.open(path.parent, os.O_RDONLY)
    try:
        fcntl.flock(directory, fcntl.LOCK_EX)
        if path.exists():
            old = json.loads(path.read_text())
            if old["series"][0]["points"][-1][0] > document["series"][0]["points"][-1][0]:
                raise ValueError("New extraction has less coverage than the published snapshot")
        with NamedTemporaryFile("w", dir=path.parent, delete=False) as stream:
            tmp = Path(stream.name)
            try:
                json.dump(document, stream, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
                stream.write("\n")
                stream.flush()
                os.fsync(stream.fileno())
                os.chmod(tmp, 0o644)
                os.replace(tmp, path)
            finally:
                tmp.unlink(missing_ok=True)
    finally:
        os.close(directory)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "public/atlas/history.json")
    args = parser.parse_args()
    now = datetime.now(UTC)
    sizes, counts = read_months(SIZE), read_months(COUNT)
    rows = complete_rows(sizes, counts, now)
    checks = check_sample(sizes, counts, rows)
    independent = check_prototype()
    result = {"series": series_rows(rows), "unavailable": [], "audit": {
        "checkedAt": now.isoformat(), "terms": "https://bitview.space/terms/",
        "definitions": [API + m for m in ("block_size", SIZE, COUNT, "block_month1")],
        "endpoints": [API + m + "/month1" for m in (SIZE, COUNT)],
        "changes": "UTC month-end selection, decimal GB conversion, calendar differences and weighted block-size means by CIRCULA Observatory.",
        "perHeightChecks": checks, "independentBlockChecks": independent}}
    publish(args.output, result)
    print(f"Verified {len(rows)} completed months, {rows[0][0]} to {rows[-1][0]}. "
          f"{independent['matches']} independently archived block sizes match.")


if __name__ == "__main__":
    main()
