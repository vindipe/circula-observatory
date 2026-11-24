"""Prepare the study's month-end history using the same daily observations as the current matrix."""
import argparse
import calendar
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

ROOT = Path(__file__).resolve().parents[1]


def month_ends(start, end):
    month = start.replace(day=1)
    while month <= end:
        last = month.replace(day=calendar.monthrange(month.year, month.month)[1])
        if last > end:
            break
        yield last
        month = last + timedelta(days=1)


def scalar(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return value


def record_gap(ranges, i, cell):
    item = [i, i, cell["status"]]
    if cell.get("detail"):
        item.append(cell["detail"])
    if ranges and ranges[-1][1] + 1 == i and ranges[-1][2:] == item[2:]:
        ranges[-1][1] = i
    else:
        ranges.append(item)


def dense_columns(sparse, offset):
    columns = {}
    for key, values in sparse.items():
        if values:
            column = [None] * (max(values) - offset + 1)
            for index, value in values.items():
                column[index - offset] = scalar(value)
            columns[key] = column
    return columns


def pack_history(days, engine, rows):
    columns, inputs, gaps = defaultdict(dict), defaultdict(dict), defaultdict(list)
    for i, day in enumerate(days):
        cells = engine.observe(day, extensions=True)
        for key, cell in cells.items():
            if cell["value"] is not None:
                columns[key][i] = cell["value"]
            else:
                record_gap(gaps[key], i, cell)
        for key in ("SplyExNtv", "PriceUSD"):
            if key in rows.get(day, {}):
                inputs[key][i] = rows[day][key]
        for key in ("AdrActCnt", "TxTfrCnt"):
            values = [rows.get(day-timedelta(days=d), {}).get(key) for d in range(30)]
            if all(v is not None for v in values):
                inputs[key + 'Sum30d'][i] = sum(values)
    offset = min((min(v) for v in [*columns.values(), *inputs.values()] if v), default=0)
    return {"offset": offset, "columns": dense_columns(columns,offset),
            "inputs": dense_columns(inputs,offset), "gaps": dict(gaps)}


def verify_pair(packed, days, asset, pair):
    if not pair:
        return
    indexes = {day.isoformat(): i for i, day in enumerate(days)}
    for side, date_key in (("baseline", "baselineUtc"), ("latest", "cutoffUtc")):
        index = indexes[pair[date_key]] - packed["offset"]
        for key, cell in pair["assets"][asset][side].items():
            values = packed["columns"].get(key, [])
            got = values[index] if 0 <= index < len(values) else None
            if got != cell["value"]:
                raise ValueError(f"Month series disagrees with matrix: {asset}/{key}/{pair[date_key]}")


def verify_sample(asset, packed, days, spans, cache):
    """Re-query a leap-February month in reverse page order, independent of the full series."""
    from community import pages
    end = date(2024, 2, 29)
    if end not in days or end == days[0]:
        return
    mapping = {"TxCnt":"transactions","BlkCnt":"blocks","TxTfrCnt":"transfers30d","AdrActCnt":"activeAddresses30d",
               "AdrBalCnt":"fundedAddresses","SplyCur":"supply","SplyExNtv":"exchangeShare","PriceUSD":"exchangeValue"}
    usable = [m for m in mapping if m in spans and spans[m][0] <= end - timedelta(days=29) and spans[m][1] >= end]
    if not usable:
        return
    start = end - timedelta(days=29)
    params = {"assets":asset, "metrics":",".join(usable), "frequency":"1d","start_time":str(start),
              "end_time":str(end),"page_size":100,"paging_from":"end"}
    sample = {}
    for row in pages("timeseries/asset-metrics", params, cache):
        day = date.fromisoformat(row["time"][:10])
        if day in sample or row["asset"] != asset or not start <= day <= end:
            raise ValueError(f"Invalid verification row: {asset} {day}")
        sample[day] = {k:Decimal(row[k]) for k in usable if row.get(k) not in (None, "")}

    def value(key, d=end):
        i = days.index(d) - packed["offset"]
        series = packed["columns"].get(key, [])
        return series[i] if 0 <= i < len(series) else None

    def total(metric, first):
        values = [sample.get(first + timedelta(days=i),{}).get(metric) for i in range((end-first).days+1)]
        return sum(values) if None not in values else None

    point = sample.get(end, {})
    active = total('AdrActCnt',start)
    transfers = total('TxTfrCnt',start)
    funded, supply, custody, price = (point.get(k) for k in ('AdrBalCnt','SplyCur','SplyExNtv','PriceUSD'))
    checks = {'fundedAddresses':funded, 'supply':supply,
              'transfers30d':transfers / 30 if transfers is not None else None,
              'activeAddresses30d':active / 30 if active is not None else None,
              'inactiveFloor':100 * max(0, funded-active) / funded if active is not None and funded else None,
              'exchangeShare':100 * custody / supply if custody is not None and supply else None,
              'exchangeValue':custody * price if custody is not None and price is not None else None}
    for metric, indicator in (('TxCnt','transactions'),('BlkCnt','blocks')):
        previous = value(indicator,end.replace(day=1)-timedelta(days=1))
        delta = total(metric,end.replace(day=1))
        if previous is not None and delta is not None:
            checks[indicator] = Decimal(previous) + delta
    for indicator, expected in checks.items():
        if value(indicator) != scalar(expected):
            raise ValueError(f"Independent rolling/history check differs for {asset}/{indicator}/{end}")


def main():
    import study_current as current
    parser = argparse.ArgumentParser(description=__doc__)
    default_end = datetime.now(timezone.utc).date().replace(day=1) - timedelta(days=1)
    parser.add_argument("--end", type=date.fromisoformat, default=default_end)
    parser.add_argument("--cache", type=Path, default=ROOT / ".cache" / "study",
                        help="Root of daily HTTP cache. The subdirectory is the UTC month-end.")
    parser.add_argument("--output", type=Path, default=ROOT / "public/atlas/study-series.json")
    parser.add_argument("--pair", type=Path, default=ROOT / "public/atlas/study-current.json",
                        help="Validated current snapshot from the same release.")
    args = parser.parse_args()
    if args.end.day != calendar.monthrange(args.end.year, args.end.month)[1] or args.end > default_end:
        parser.error("--end requires a completed UTC calendar month")
    pair = json.loads(args.pair.read_bytes())
    if pair["cutoffUtc"] != args.end.isoformat():
        parser.error("--pair cutoff and --end differ")
    cache = args.cache / args.end.isoformat()
    catalog, _, _ = current.load_assets(args.end, cache)
    ids = sorted(pair["assets"])
    first_day = min(span[0] for asset in ids for k, span in catalog.get(asset, {}).items() if k != "PriceUSD")
    days = list(month_ends(first_day, args.end))
    assets = {}
    for asset in ids:
        spans = catalog.get(asset, {})
        rows = current.fetch_asset(asset, spans, args.end, cache) if spans else {}
        engine = current.StudyAsset(rows, spans, pair["assets"][asset]["scope"], asset)
        packed = pack_history(days, engine, rows)
        verify_pair(packed, days, asset, pair)
        if asset in {"btc","eth","usdc_eth"}:
            verify_sample(asset, packed, days, spans, cache)
        assets[asset] = packed
    snapshot = {"schema": 1, "retrievedUtc": pair["retrievedUtc"], "cutoffUtc": args.end.isoformat(),
                "dates": [d.isoformat() for d in days], "assets": assets}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile("w", dir=args.output.parent, delete=False) as handle:
        tmp = Path(handle.name)
        json.dump(snapshot, handle, separators=(",", ":"), allow_nan=False)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    try:
        tmp.chmod(0o644)
        os.replace(tmp, args.output)
    finally:
        tmp.unlink(missing_ok=True)
    points = sum(sum(v is not None for v in column) for row in assets.values() for column in row["columns"].values())
    print(f"{len(days)} month ends, {len(assets)} provider IDs, {points} study observations -> {args.output}")


if __name__ == "__main__":
    main()
