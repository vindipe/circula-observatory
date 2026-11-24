"""Cross-check the published frozen atlas against independent daily Community extracts.

Default fetches BTC, ETH, USDC on Ethereum and two histories with known gaps.
--daily-cache replays an existing independent extraction: *-history.json and
YYYY-MM-DD-window*.json contain arrays of /timeseries/asset-metrics daily rows.
No download is needed for the original paper reproduction (study_frozen.py).
"""
import argparse
import collections
from datetime import date, timedelta
from decimal import Decimal
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from study_frozen import DAYS, MEANS, OUTPUT, read_json, window_start


def distinct(rows):
    by_id = collections.defaultdict(dict)
    for row in rows:
        asset, day = row["asset"], row["time"][:10]
        if day in by_id[asset]:
            raise ValueError(f"Duplicate: {asset}/{day}")
        by_id[asset][day] = row
    return by_id


def calendar_total(rows, code, start, end):
    day, final = date.fromisoformat(start), date.fromisoformat(end)
    if day > final:
        return None
    total = Decimal(0)
    while day <= final:
        raw = rows.get(str(day), {}).get(code)
        if raw is None:
            return None
        total += Decimal(raw)
        day += timedelta(days=1)
    return total


def number(row, code):
    val = row.get(code)
    return Decimal(val) if val is not None else None


def verify(raw_dir, atlas):
    counts = collections.Counter()
    def check(asset, key, side, val):
        expected = atlas["assets"][asset][side][key]["value"]
        actual = None if val is None else float(val)
        if actual != expected:
            raise ValueError(f"{asset}/{key}/{side}: daily result {actual} vs atlas {expected}")
        counts["present" if actual is not None else "missing"] += 1

    for day, side in ((atlas["baselineUtc"], "baseline"), (atlas["cutoffUtc"], "latest")):
        rows = (r for path in raw_dir.glob(day + "-window*.json") for r in read_json(path))
        for asset, by_date in distinct(rows).items():
            if asset not in atlas["assets"]:
                continue
            last = by_date.get(day, {})
            funded, supply, exchange, price = (number(last, m) for m in ("AdrBalCnt", "SplyCur", "SplyExNtv", "PriceUSD"))
            active = calendar_total(by_date, "AdrActCnt", window_start(day), day)
            transfers = calendar_total(by_date, "TxTfrCnt", window_start(day), day)
            lower = 100 * max(0, funded - active) / funded if funded and active is not None else None
            share = 100 * exchange / supply if supply and exchange is not None else None
            usd = exchange * price if exchange is not None and price is not None else None
            vals = dict(fundedAddresses=funded, supply=supply, exchangeShare=share, exchangeValue=usd,
                        inactiveFloor=lower, transfers30d=transfers, activeAddresses30d=active)
            for key, val in vals.items():
                if key in MEANS and val is not None:
                    val /= DAYS
                check(asset, key, side, val)
    for file in raw_dir.glob("*-history.json"):
        for asset, history in distinct(read_json(file)).items():
            if asset not in atlas["assets"]:
                continue
            for code, key in (("TxCnt", "transactions"), ("BlkCnt", "blocks")):
                starts = atlas["assets"][asset]["starts"]
                if code not in starts or not any(code in r for r in history.values()):
                    continue
                for day, side in ((atlas["baselineUtc"], "baseline"), (atlas["cutoffUtc"], "latest")):
                    check(asset, key, side, calendar_total(history, code, starts[code], day))
    if not counts["present"]:
        raise ValueError("No matching observations found")
    return counts


def download_sample(data, cache, atlas):
    # Use the pinned paper's paginator and real endpoint, keeping raw responses separate.
    from study_frozen import verify_original
    verify_original(data)
    spec = importlib.util.spec_from_file_location("paper_refresh", data / "refresh_accumulation.py")
    paper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(paper)
    assets = ["btc", "eth", "usdc_eth", "hedg", "lpt"]
    def fetch(path, ids, codes, start, end):
        params = {"assets": ",".join(ids), "metrics": ",".join(codes), "frequency": "1d",
                  "start_time": start, "end_time": end, "ignore_unsupported_errors": "true",
                  "ignore_forbidden_errors": "true", "page_size": 10000}
        path.write_text(json.dumps(list(paper.coin_metrics_rows("timeseries/asset-metrics", params))))
    for day in (atlas["baselineUtc"], atlas["cutoffUtc"]):
        fetch(cache / (day + "-window0.json"), assets, list(paper.POINT), window_start(day), day)
    for asset in assets:
        starts = atlas["assets"][asset]["starts"]
        fetch(cache / (asset + "-history.json"), [asset], list(starts), min(starts.values()), atlas["cutoffUtc"])


def main():
    p = argparse.ArgumentParser(description=__doc__)
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--daily-cache", type=Path)
    group.add_argument("--paper-data", type=Path)
    args = p.parse_args()
    atlas = read_json(OUTPUT)
    with TemporaryDirectory() as tmp:
        raw = args.daily_cache or Path(tmp)
        if args.paper_data:
            download_sample(args.paper_data, raw, atlas)
        counts = verify(raw, atlas)
    print(f"Independent daily replay: {counts['present']} numeric values and {counts['missing']} absences agree.")


if __name__ == "__main__":
    main()
