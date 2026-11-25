"""Refresh the Observatory's full Coin Metrics indicator census and monthly series."""

import argparse
import gzip
import hashlib
import json
import math
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
ATLAS = ROOT / "public" / "atlas"
CACHE = ROOT / ".cache" / "indicators"
API = "https://community-api.coinmetrics.io/v4"
INPUTS = (
    "AdrActCnt", "AdrBalCnt", "BlkCnt", "CapMVRVCur", "CapMrktCurUSD",
    "FeeTotNtv", "FlowInExNtv", "FlowInExUSD", "FlowOutExNtv", "FlowOutExUSD",
    "HashRate", "IssTotNtv", "IssTotUSD", "PriceUSD", "SplyCur", "SplyExNtv",
    "SplyExUSD", "SplyExpFut10yr", "TxCnt", "TxTfrCnt",
)
DAY = timedelta(days=1)
REQUEST_LOCK = threading.Lock()
NEXT_REQUEST = 0.0


def request(url):
    global NEXT_REQUEST
    for attempt in range(6):
        with REQUEST_LOCK:
            slot = max(time.monotonic(), NEXT_REQUEST)
            NEXT_REQUEST = slot + 0.88
        time.sleep(max(0, slot - time.monotonic()))
        try:
            req = Request(url, headers={"Accept": "application/json", "Accept-Encoding": "gzip"})
            with urlopen(req, timeout=70) as response:
                payload = response.read()
                if response.headers.get("Content-Encoding") == "gzip":
                    payload = gzip.decompress(payload)
                return json.loads(payload)
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 5:
                raise RuntimeError(f"{urlsplit(url).path}: HTTP {error.code}: {error.read()[:350]}") from error
            retry_after = error.headers.get("Retry-After") or ""
            delay = int(retry_after) if retry_after.isdecimal() else 2 ** attempt
        except (URLError, TimeoutError, OSError) as error:
            if attempt == 5:
                raise
            delay = 2 ** attempt
        time.sleep(delay)


def pages(path, params):
    endpoint = f"{API}/{path}"
    url = f"{endpoint}?{urlencode(params)}"
    seen = set()
    while url:
        if url.split("?", 1)[0] != endpoint or url in seen:
            raise ValueError(f"Unexpected pagination at {endpoint}")
        seen.add(url)
        page = request(url)
        yield from page["data"]
        url = page.get("next_page_url")


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()


def write_bytes(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(f"{path.suffix}.tmp")
    tmp.write_bytes(value)
    tmp.replace(path)


def cache_json(name, producer, offline):
    path = CACHE / f"{name}.json.gz"
    if path.exists():
        return json.loads(gzip.decompress(path.read_bytes()))
    if offline:
        raise FileNotFoundError(f"Missing cached provider response {path}")
    value = producer()
    write_bytes(path, gzip.compress(compact(value), mtime=0))
    return value


def coverage_by_metric(rows):
    coverage = {}
    for row in rows:
        for metric in row["metrics"]:
            for f in metric["frequencies"]:
                if not f.get("community") or not f.get("min_time") or not f.get("max_time"):
                    continue
                freq = coverage.setdefault(metric["metric"], {}).setdefault(f["frequency"], {})
                freq[row["asset"]] = [f["min_time"][:10], f["max_time"][:10]]
    return coverage


def last_closed_month(today):
    return today.replace(day=1) - DAY


def download_plan(spans, cutoff):
    assets = {}
    for key in INPUTS:
        for asset, (start, end) in spans.get(key, {}).get("1d", {}).items():
            if key == "PriceUSD" and not any(asset in spans.get(k, {}).get("1d", {}) for k in ("SplyExNtv", "FeeTotNtv")):
                continue
            if start <= cutoff.isoformat():
                assets.setdefault(asset, {})[key] = (start, min(end, cutoff.isoformat()))
    candidates = []
    for asset, metrics in assets.items():
        start = min(span[0] for span in metrics.values())
        end = max(span[1] for span in metrics.values())
        candidates.append((start, end, asset, metrics))
    # Keep query pages small for older networks and avoid wide requests for inactive IDs.
    candidates.sort()
    batch = []
    for start, end, asset, metrics in candidates:
        bounds = (min(start, batch[0][0]), max(end, max(item[1] for item in batch))) if batch else (start, end)
        capacity = ((date.fromisoformat(bounds[1]) - date.fromisoformat(bounds[0])).days + 1) * (len(batch) + 1)
        if batch and (capacity > 8800 or len(batch) >= 12):
            yield batch
            batch = []
        batch.append((start, end, asset, metrics))
    if batch:
        yield batch


def observations(batch, cutoff, offline):
    keys = sorted({key for *_, metrics in batch for key in metrics})
    params = {
        "assets": ",".join(asset for _, _, asset, _ in batch),
        "metrics": ",".join(keys),
        "frequency": "1d",
        "start_time": min(start for start, *rest in batch),
        "end_time": max(end for _, end, *_ in batch),
        "ignore_unsupported_errors": "true",
        "ignore_forbidden_errors": "true",
        "page_size": 10000,
    }
    signature = hashlib.sha256(compact(params)).hexdigest()[:24]

    def collect():
        result = {asset: {key: {} for key in metrics} for _, _, asset, metrics in batch}
        ranges = {asset: metrics for _, _, asset, metrics in batch}
        for row in pages("timeseries/asset-metrics", params):
            asset = row["asset"]
            day = row["time"][:10]
            for key, (first, last) in ranges[asset].items():
                if row.get(key) is None or not first <= day <= last:
                    continue
                value = float(row[key])
                if math.isfinite(value):
                    observed = int(value) if value.is_integer() else value
                    result[asset][key][day] = observed
        return result

    data = cache_json(f"daily-{cutoff}-{signature}", collect, offline)
    return batch, data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", type=date.fromisoformat, default=datetime.now(UTC).date())
    parser.add_argument("--cutoff", type=date.fromisoformat)
    parser.add_argument("--offline", action="store_true", help="Rebuild using cached Coin Metrics responses")
    parser.add_argument("--download-only", action="store_true")
    args = parser.parse_args()
    cutoff = args.cutoff or last_closed_month(args.as_of)
    if cutoff >= args.as_of or (cutoff + DAY).day != 1:
        parser.error("The cutoff must be a closed UTC month-end before --as-of")

    routes = {
        "definitions": ("reference-data/asset-metrics", {"page_size": 10000}),
        "all": ("catalog-all/asset-metrics", {}),
        "community": ("catalog-v2/asset-metrics", {"page_size": 10000}),
        "assets": ("reference-data/assets", {"page_size": 10000}),
    }

    def catalog(name):
        path, params = routes[name]
        return cache_json(f"{name}-{args.as_of}", lambda: list(pages(path, params)), args.offline)

    with ThreadPoolExecutor(max_workers=4) as pool:
        definitions, available, community, assets = pool.map(catalog, routes)
    spans = coverage_by_metric(community)
    plan = list(download_plan(spans, cutoff))
    print(f"{len(definitions)} definitions, {len(spans)} Community metric codes, {len(plan)} daily batches", flush=True)

    def pull(batch):
        return observations(batch, cutoff, args.offline)

    if not args.download_only:
        from indicator_census import Census
        census = Census(args.as_of, cutoff, definitions, available, spans, assets)

    with ThreadPoolExecutor(max_workers=6) as pool:
        for i, (batch, data) in enumerate(pool.map(pull, plan), 1):
            if not args.download_only:
                census.add(batch, data)
            print(f"{i}/{len(plan)}  {', '.join(data)}", flush=True)

    if not args.download_only:
        audit, series = census.finish()
        write_bytes(ATLAS / "indicator-audit.json.gz", gzip.compress(compact(audit), mtime=0))
        write_bytes(ATLAS / "indicator-series.json.gz", gzip.compress(compact(series), mtime=0))
        print(json.dumps(audit["totals"], sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError) as error:
        sys.exit(str(error))
