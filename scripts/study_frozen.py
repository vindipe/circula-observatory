"""Reproduce the 2019/2025 Community edition and import its observations.

Usage: python3 scripts/study_frozen.py <paper-directory>/data
The frozen edition is never fetched or rewritten by the monthly worker.
"""
import argparse
import csv
import hashlib
import json
import subprocess
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from tempfile import NamedTemporaryFile

from study_current import layer_for

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "scripts/reference/frozen-inputs.json"
OUTPUT = ROOT / "public/atlas/study-frozen.json"
BLOBS = {
    "README.md": "84af91ca5482fdb862293121dce32bac736b0ed8",
    "refresh_accumulation.py": "b0f1560a5ac78c59ed64e7b5f8c8724e3426a880",
    "accumulation-snapshot.json": "6aa59b7963c50673d6dbe9c6b39289f55729158f",
    "table1-coverage.csv": "9b4305e8a3bd1c44e083c0cdd3dd69f1e047c700",
}
INPUTS = {
    "transactions": ("TxCnt",), "blocks": ("BlkCnt",),
    "ledgerBytes": ("BlkCnt", "BlkSizeByte", "BlkSizeMeanByte"),
    "fundedAddresses": ("AdrBalCnt",), "supply": ("SplyCur",),
    "inactiveFloor": ("AdrBalCnt", "AdrActCnt"),
    "exchangeShare": ("SplyExNtv", "SplyCur"), "exchangeValue": ("SplyExNtv", "PriceUSD"),
    "transfers30d": ("TxTfrCnt",), "activeAddresses30d": ("AdrActCnt",),
}
# The paper's stored means are 30-day sums. Convert only at ingestion.
MEANS = {"transfers30d": "TxTfrCntSum30d", "activeAddresses30d": "AdrActCntSum30d"}
PAPER_SCALE = {
    "transactions": 10**6, "blocks": 10**6, "ledgerBytes": 10**9,
    "fundedAddresses": 10**6, "supply": 10**6, "inactiveFloor": 1,
    "exchangeShare": 1, "exchangeValue": 10**9,
    "transfers30d": 30_000, "activeAddresses30d": 30_000,
}
DAYS = 30
CORE = ("transactions", "fundedAddresses", "supply", "inactiveFloor", "transfers30d", "activeAddresses30d")


def read_json(path):
    return json.loads(path.read_text())


def verify_original(data):
    for name, expected in BLOBS.items():
        raw = (data / name).read_bytes()
        digest = hashlib.sha1(f"blob {len(raw)}\0".encode() + raw).hexdigest()
        if digest != expected:
            raise ValueError(f"{name}: source differs from the pinned edition ({digest})")
    subprocess.run([sys.executable, str(data / "refresh_accumulation.py"), "--verify"], check=True)


def number(n):
    return int(n) if n == n.to_integral_value() else float(n)


def window_start(day):
    return str(date.fromisoformat(day) - timedelta(days=DAYS - 1))


def absent(asset, key, day, scope, raw, evidence):
    def result(status, detail, **kwargs):
        return {"value": None, "status": status, "detail": detail, **kwargs}

    if scope == "token_deployment" and key in ("blocks", "ledgerBytes"):
        return result("not_applicable", "host_chain")
    if key == "ledgerBytes":
        return result("not_public", "BlkSizeByte | (BlkCnt × BlkSizeMeanByte)")
    denom = {"inactiveFloor": "fundedAddresses", "exchangeShare": "supply"}.get(key)
    if denom in raw and Decimal(raw[denom]) == 0:
        return result("undefined", "AdrBalCnt = 0" if key == "inactiveFloor" else "SplyCur = 0")
    catalog = evidence["catalog"].get(asset, {})
    missing = [m for m in INPUTS[key] if m not in catalog]
    if missing:
        return result("not_public", ", ".join(missing))
    start = window_start(day) if key in MEANS or key == "inactiveFloor" else day
    for metric in INPUTS[key]:
        first, last = catalog[metric]
        if day < first or last < start:
            return result("missing", f"{metric} · {first} → {last}")
        if key in MEANS or key == "inactiveFloor" and metric == "AdrActCnt":
            if first > start or last < day:
                return result("incomplete", f"{metric} · {first} → {last}")
    if key == "transactions":
        gaps = [d for d in evidence["TxCntGaps"].get(asset, []) if d <= day]
        if gaps:
            return result("incomplete", "TxCnt · " + ", ".join(gaps),
                          inputs={"missingDays": len(gaps), "firstMissingUtc": gaps[0]})
    return result("incomplete", ", ".join(INPUTS[key]))


def get_cell(asset, key, day, scope, raw, starts, evidence):
    if key not in raw:
        return absent(asset, key, day, scope, raw, evidence)
    n = Decimal(raw[key])
    value = n / (DAYS if key in MEANS else 10**9 if key == "ledgerBytes" else 1)
    cell = {"value": number(value), "status": "zero_observed" if not n else "observed", "observedUtc": day}
    if key in ("transactions", "blocks", "ledgerBytes"):
        cell["startUtc"] = starts["TxCnt" if key == "transactions" else "BlkCnt"]
    if key in MEANS:
        cell.update(startUtc=window_start(day), inputs={MEANS[key]: number(n), "days": DAYS})
    elif key == "inactiveFloor":
        funded = Decimal(raw["fundedAddresses"])
        active = Decimal(raw["activeAddresses30d"])
        expected = 100 * max(0, funded - active) / funded
        if expected != n:
            raise ValueError(f"{asset} {day}: funded-address bound differs")
        cell.update(startUtc=window_start(day), inputs={
            "AdrBalCnt": number(funded), "AdrActCntSum30d": number(active), "days": DAYS})
    elif key in ("exchangeShare", "exchangeValue"):
        balance = Decimal(evidence["exchanges"][asset][day]["SplyExNtv"])
        price = Decimal(evidence["exchanges"][asset][day]["PriceUSD"])
        supply = Decimal(raw["supply"])
        expected = 100 * balance / supply if key == "exchangeShare" else balance * price
        if n != expected:
            raise ValueError(f"{asset} {day}: exchange operands differ from frozen observation")
        cell["inputs"] = {"SplyExNtv": number(balance)}
        if key == "exchangeShare":
            cell["inputs"]["SplyCur"] = number(supply)
        else:
            cell["inputs"].update(PriceUSD=number(price), priceUtc=day)
    return cell


def build(data, evidence):
    # Labels and contract identifiers are display metadata. The paper CSV remains
    # authoritative for its membership, historical observation scope and host.
    names = {}
    for series in read_json(ROOT / "public/atlas/community.json")["series"]:
        names.setdefault(series["asset"], (series["name"], series.get("contract")))
    snapshot = read_json(data / "accumulation-snapshot.json")
    with (data / "table1-coverage.csv").open(newline="") as file:
        rows = list(csv.DictReader(file))
    indexed = {(r["asset_id"], r["indicator"]): r for r in rows}
    if len(indexed) != len(rows) or len(rows) != len(snapshot["assets"]) * len(INPUTS):
        raise ValueError("Duplicate or missing asset/indicator combinations in the paper matrix")
    result = {k: snapshot[k] for k in ("baselineUtc", "cutoffUtc", "retrievedUtc", "source", "catalogPaired")}
    result.update(license="CC BY-NC 4.0", sourceBlobs=BLOBS, assets={})
    for asset, obs in snapshot["assets"].items():
        identity = indexed[asset, "supply"]
        scope = identity["scope"]
        host = identity["host_id"] or None
        name, contract = names.get(asset, (asset, None))
        entry = {"scope": scope, "host": host, "starts": obs["starts"], "name": name,
                 "contract": contract, "layer": layer_for(asset, scope, host)}
        for side, name, day in (("baseline", "baseline", result["baselineUtc"]),
                                ("latest", "cutoff", result["cutoffUtc"])):
            raw = obs[side]
            entry[side] = {}
            for key in INPUTS:
                row = indexed[asset, key]
                # Check every cell in its original published unit before converting to chart units.
                actual = Decimal(raw[key]) / PAPER_SCALE[key] if key in raw else None
                expected = Decimal(row[name]) if row[name] else None
                if actual != expected or row["scope"] != scope or row["host_id"] != identity["host_id"]:
                    raise ValueError(f"{asset}/{key}/{day}: observation or scope disagrees with paper CSV")
                entry[side][key] = get_cell(asset, key, day, scope, raw, obs["starts"], evidence)
        result["assets"][asset] = entry
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data", type=Path, help="Frozen paper's data/ directory in vindipe/circula")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    verify_original(args.data.resolve())
    data = build(args.data, read_json(EVIDENCE))
    raw = json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n"
    args.output.parent.mkdir(exist_ok=True, parents=True)
    with NamedTemporaryFile("w", encoding="utf-8", dir=args.output.parent, delete=False) as temp:
        temp.write(raw)
        path = Path(temp.name)
    path.chmod(0o644)
    path.replace(args.output)
    print(f"Verified {len(data['assets']) * len(INPUTS) * 2} cells against the original CSV.")


if __name__ == "__main__":
    main()
