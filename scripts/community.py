"""Build Coin Metrics snapshots offline. Run with Python 3.10+; no external packages."""

import argparse
import calendar
import collections
import concurrent.futures
import datetime as dt
import fcntl
import gzip
import hashlib
import json
import os
import tempfile
import threading
import time
from decimal import Decimal
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from community_i18n import translations

API = "https://community-api.coinmetrics.io/v4/"
LICENSE_URL = "https://creativecommons.org/licenses/by-nc/4.0/"
SOURCE = "Coin Metrics Community"
METRICS = {
    "TxCnt": (
        "Transactions",
        "transactions",
        "circulation",
        "flow",
        "Sum of daily transaction counts. A transaction may contain several operations or no transfer. Protocol-mandated changes are excluded.",
    ),
    "TxTfrCnt": (
        "Transfers",
        "transfers",
        "circulation",
        "flow",
        "Sum of daily positive-value transfers between distinct ledger entities. One transaction may contain multiple transfers.",
    ),
    "AdrActCnt": (
        "Sum of daily active addresses",
        "address-days",
        "circulation",
        "flow",
        "Addresses are deduplicated within each UTC day and then summed. An address active on two dates contributes twice. Voting can qualify as ledger activity.",
    ),
    "AdrBalCnt": (
        "Addresses with a positive balance",
        "addresses",
        "context",
        "stock",
        "Month-end count of addresses with a positive balance. Zero balances are excluded. No ownership clustering or balance weights are available.",
    ),
    "SplyCur": (
        "Current supply",
        None,
        "context",
        "stock",
        "Coin Metrics current supply at the end of the last UTC day of each month, in the asset's native unit.",
    ),
    "BlkCnt": (
        "Blocks added",
        "blocks",
        "history",
        "flow",
        "Monthly sum of daily blocks added to the main chain. A block count measures additions to the sequence, in blocks.",
    ),
}
# Only explicitly matched counting families receive a comparison key.
UTXO = {"btc", "ltc", "doge", "bch", "bsv", "btg", "vtc", "dgb", "dash"}
HOST = {
    "eth": "Ethereum",
    "trx": "TRON",
    "avaxc": "Avalanche C-Chain",
    "omni": "Bitcoin (Omni)",
    "eos": "EOS",
}
CIRCLE = "https://developers.circle.com/stablecoins/"
TETHER = "https://tether.to/en/supported-protocols/"
ETHENA = "https://docs.ethena.fi/technical-design/key-addresses"
CONTRACT = {
    "usdc_eth": ("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", CIRCLE + "usdc-contract-addresses"),
    "usdc_avaxc": ("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", CIRCLE + "usdc-contract-addresses"),
    "eurc_eth": ("0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c", CIRCLE + "eurc-contract-addresses"),
    "usdt_eth": ("0xdac17f958d2ee523a2206206994597c13d831ec7", TETHER),
    "usdt_avaxc": ("0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", TETHER),
    "usdt_trx": ("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", TETHER),
    "usde_eth": ("0x4c9edd5852cd905f086c759e8383e09bff1e68b3", ETHENA),
    "susde_eth": ("0x9d39a5de30e57443bff2a8307a4256c8797a3497", ETHENA),
}
AGGREGATE = {"usdc", "usdt", "tusd", "flow"}
NATIVE_UNITS = {
    "avaxc": "AVAX",
    "avaxp": "AVAX",
    "avaxx": "AVAX",
    "flow_evm": "FLOW",
    "flow_native": "FLOW",
    "steth_lido": "stETH",
}
lock = threading.Lock()
last_request = 0.0


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as file:
        file.write(data)
        temporary = file.name
    os.replace(temporary, path)


def get(url, cache):
    key = cache / hashlib.sha256(url.encode()).hexdigest()
    if key.exists():
        return json.loads(key.read_bytes())
    global last_request
    for attempt in range(6):
        with lock:
            time.sleep(max(0, 0.65 - (time.monotonic() - last_request)))
            last_request = time.monotonic()
        try:
            with urlopen(
                Request(
                    url,
                    headers={
                        "Accept-Encoding": "gzip",
                        "User-Agent": "CIRCULA-Observatory/monthly-archive",
                    },
                ),
                timeout=90,
            ) as response:
                raw = response.read()
                if response.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
            data = json.loads(raw)
            atomic(key, raw)
            return data
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 5:
                raise
            time.sleep(max(2**attempt, int(error.headers.get("Retry-After", "1"))))
        except (TimeoutError, URLError):
            if attempt == 5:
                raise
            time.sleep(2**attempt)


def pages(path, args, cache):
    params = dict(args)
    items = []
    while True:
        result = get(API + path + "?" + urlencode(params), cache)
        items.extend(result["data"])
        token = result.get("next_page_token")
        if not token:
            return items
        assert token != params.get("next_page_token"), "Nonadvancing cursor"
        params["next_page_token"] = token


def aggregate(rows, asset, metric, end):
    # Sorting + distinct dates also protect month sums against duplicate page boundaries.
    by_month = collections.defaultdict(dict)
    for row in rows:
        if row["asset"] != asset:
            raise ValueError("Unexpected asset")
        day = dt.date.fromisoformat(row["time"][:10])
        if day > end:
            raise ValueError("Unexpected date beyond cutoff")
        month, day_number = day.strftime("%Y-%m"), day.day
        if day_number in by_month[month]:
            raise ValueError(f"Duplicate observation {asset} {day}")
        raw = row.get(metric)
        value = Decimal(raw) if raw is not None and raw != "" else None
        if value is not None and (not value.is_finite() or value < 0):
            raise ValueError(f"Invalid observation {asset} {metric} {day}")
        by_month[month][day_number] = value
    points = []
    for month, daily in sorted(by_month.items()):
        days = calendar.monthrange(*map(int, month.split("-")))[1]
        if METRICS[metric][3] == "stock":
            value = daily.get(days)
        elif len(daily) == days and None not in daily.values():
            value = sum(daily.values())
        else:
            value = None
        if value is not None:
            points.append((month, value))
    return points


def identity(asset, name, keys):
    suffix = asset.rsplit("_", 1)
    if asset in AGGREGATE:
        return "Multiple deployments", "Provider aggregate across deployments", None
    if asset in ("flow_native", "flow_evm") or "BlkCnt" in keys:
        return name, "Network", "utxo" if asset in UTXO else None
    if len(suffix) == 2 and suffix[-1] in HOST:
        return HOST[suffix[-1]], "Token deployment", "erc20" if suffix[-1] == "eth" else None
    return "Unresolved", "Provider asset scope", None


def collect(item, names, definitions, end, cache):
    asset = item["asset"]
    avail = {
        entry["metric"]: f
        for entry in item["metrics"]
        for f in entry["frequencies"]
        if f["frequency"] == "1d" and f.get("community") and entry["metric"] in METRICS
    }
    if not avail:
        return []
    keys = sorted(avail)
    start = min(f["min_time"][:10] for f in avail.values())
    params = {
        "assets": asset,
        "metrics": ",".join(keys),
        "frequency": "1d",
        "start_time": start,
        "end_time": end.isoformat(),
        "page_size": 10000,
    }
    rows = pages("timeseries/asset-metrics", params, cache)
    name = names.get(asset, asset.upper())
    network, scope, family = identity(asset, name, keys)
    contract, contract_url = CONTRACT.get(asset, (None, None))
    series = []
    samples = collections.defaultdict(dict)
    for key in keys:
        label, unit, dash, kind, method = METRICS[key]
        points = aggregate(rows, asset, key, end)
        if not points:
            continue
        month, value = points[-1]
        samples[month][key] = value
        parts = [key]
        if family == "utxo" and key == "TxCnt":
            parts.append("coinbase")
            method += " Coinbase transactions are excluded."
        if scope == "Provider asset scope":
            parts.append("unresolved")
            method += " The source identifies this asset by code. Its host network and deployment have not been verified here."
        if asset == "eth" and key == "TxTfrCnt":
            parts.append("internal")
            method += (
                " Ethereum includes internal transfers and excludes self-sends and failed transfers."
            )
        if scope == "Token deployment":
            parts.append("token")
            method += (
                " Counted for this token deployment only."
                if key != "SplyCur"
                else " Supply for this deployment only."
            )
        if asset in AGGREGATE:
            parts.append("aggregate")
            method += " Provider aggregate; component deployments overlap this series."
        # UTXO privacy features and address encodings differ. Retain only the
        # source's transaction/block counts across UTXO networks. Token comparisons
        # require a verified deployment and the same host and counting unit.
        comparable = (
            family == "utxo"
            and key in {"TxCnt", "BlkCnt"}
            or family == "erc20"
            and contract
            and key in {"TxCnt", "TxTfrCnt", "AdrActCnt", "AdrBalCnt"}
        )
        comparison = f"CM:{family}:{key}:1mo" if comparable else None
        symbol = (
            asset.split("_")[0].upper()
            if scope == "Token deployment"
            else NATIVE_UNITS.get(asset, asset.upper())
        )
        series.append(
            {
                "asset": asset,
                "name": name,
                "network": network,
                "symbol": symbol,
                "contract": contract,
                "contractUrl": contract_url,
                "scope": scope,
                "metric": key,
                "label": label,
                "unit": unit or symbol,
                "dashboard": dash,
                "kind": kind,
                "comparison": comparison,
                "method": method,
                "methodI18n": translations(parts),
                "frequency": "1mo",
                "source": SOURCE,
                "sourceUrl": definitions[key]["docs_url"],
                "license": "CC BY-NC 4.0",
                "licenseUrl": LICENSE_URL,
                "latestObservation": month
                + "-"
                + str(calendar.monthrange(*map(int, month.split("-")))[1]),
                "points": [[m, int(v) if v == v.to_integral_value() else float(v)] for m, v in points],
            }
        )
    # Independent query, narrower bounds and a reversed provider order. Recompute directly
    # from each complete result, independently from the history grouping code.
    for month, expected in samples.items():
        dates = [
            f"{month}-{i:02}" for i in range(1, calendar.monthrange(*map(int, month.split("-")))[1] + 1)
        ]
        sample = pages(
            "timeseries/asset-metrics",
            {
                **params,
                "metrics": ",".join(expected),
                "start_time": dates[0],
                "end_time": dates[-1],
                "paging_from": "end",
                "page_size": 1000,
            },
            cache,
        )
        keyed = {x["time"][:10]: x for x in sample if x["asset"] == asset}
        for key, exp in expected.items():
            actual = (
                Decimal(keyed[dates[-1]][key])
                if METRICS[key][3] == "stock"
                else sum(Decimal(keyed[d][key]) for d in dates)
            )
            if actual != exp:
                raise ValueError(f"Independent extraction disagrees for {asset}/{key} {month}")
    return series


def save_snapshot(output, snapshot):
    """Serialize publication even if two releases finish out of order on one host."""
    output.parent.mkdir(parents=True, exist_ok=True)
    directory = os.open(output.parent, os.O_RDONLY)
    try:
        fcntl.flock(directory, fcntl.LOCK_EX)
        if output.exists():
            previous = json.loads(output.read_text())
            if previous["cutoff"] > snapshot["cutoff"]:
                raise ValueError("Refusing to replace a more recent snapshot")
            months = {(s["asset"], s["metric"]): {p[0] for p in s["points"]} for s in snapshot["series"]}
            for series in previous["series"]:
                series_id = series["asset"], series["metric"]
                if any(point[0] not in months.get(series_id, set()) for point in series["points"]):
                    raise ValueError(
                        f"Previous coverage would shrink for {series_id}. Snapshot preserved."
                    )
        atomic(output, (json.dumps(snapshot, separators=(",", ":"), ensure_ascii=False) + "\n").encode())
    finally:
        os.close(directory)


def build(args):
    end = (
        dt.date.fromisoformat(args.end)
        if args.end
        else dt.date.today().replace(day=1) - dt.timedelta(days=1)
    )
    if end.day != calendar.monthrange(end.year, end.month)[1] or end >= dt.date.today().replace(day=1):
        raise ValueError("The cutoff must be a closed calendar month-end")
    cache = Path(args.cache) / end.isoformat()
    keys = ",".join(METRICS)
    catalog = pages("catalog-v2/asset-metrics", {"metrics": keys, "page_size": 1000}, cache)
    names = {
        r["asset"]: r["full_name"] for r in pages("reference-data/assets", {"page_size": 10000}, cache)
    }
    definitions = {
        r["metric"]: r for r in pages("reference-data/asset-metrics", {"metrics": keys}, cache)
    }
    if set(METRICS) - definitions.keys():
        raise ValueError("Source metric definition unavailable")
    if args.assets:
        catalog = [r for r in catalog if r["asset"] in args.assets.split(",")]
    ordered = sorted(
        catalog,
        key=lambda x: (
            x["asset"] not in ("btc", "eth", "ltc", "doge", "usdc_eth", "xlm", "algo"),
            x["asset"],
        ),
    )
    result = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        tasks = {
            pool.submit(collect, row, names, definitions, end, cache): row["asset"] for row in ordered
        }
        for i, future in enumerate(concurrent.futures.as_completed(tasks), 1):
            result.extend(future.result())
            if i % 10 == 0:
                print(f"{i}/{len(ordered)} assets checked", flush=True)
    if not result:
        raise ValueError("Empty snapshot")
    output = Path(args.output)
    result.sort(key=lambda s: (s["asset"], s["metric"]))
    snapshot = {"cutoff": end.isoformat(), "series": result, "unavailable": []}
    save_snapshot(output, snapshot)
    print(f"{len(result)} series, {sum(len(s['points']) for s in result)} observations -> {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--end")
    parser.add_argument(
        "--cache", default=".cache/community", help="Per-release resumable extraction directory"
    )
    parser.add_argument("--output", default="public/atlas/community.json")
    parser.add_argument("--assets", help="Optional comma-separated subset for verification")
    build(parser.parse_args())
