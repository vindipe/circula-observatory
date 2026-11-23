#!/usr/bin/env python3
"""Rebuild the versioned research snapshots. Writes static assets only."""

import argparse
import csv
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'research-inputs'
OUTPUT = ROOT / 'public' / 'research-data'
RELEASE = 'https://doi.org/10.5281/zenodo.21156871'
TAR = 'open_bitcoin_metrics-v0.1.0.tar.gz'
TAR_SHA256 = 'd5caa010dd0dfc08b6a428fe733b15265b5a159ebfe8a38c24ad6c799641a26c'
BTC_START, BTC_END = '2024-01-01', '2026-06-19'
USDC_START, USDC_END = '2026-05-27', '2026-11-22'
HEIGHT_START, HEIGHT_END = 974000, 975004
BLOCK_ID = re.compile(r'[0-9a-f]{64}')
AGE_BANDS = ('0d_1d', '1d_1w', '1w_1m', '1m_3m', '3m_6m', '6m_1y',
             '1y_2y', '2y_3y', '3y_5y', '5y_7y', '7y_10y', '10y_plus')
AGE_START = {'1': 6, '3': 8, '5': 9, '10': 11}


def cached(url, filename, pause=0):
    path = CACHE / filename
    if path.exists():
        return path.read_bytes()
    request = Request(url, headers={'User-Agent': 'CIRCULA-Observatory research snapshot (github.com/vindipe/circula-observatory)'})
    last = None
    for attempt in range(4):
        time.sleep(pause)
        try:
            with urlopen(request, timeout=30) as response:
                raw = response.read()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
            return raw
        except (HTTPError, URLError, TimeoutError) as error:
            last = error
            if isinstance(error, HTTPError) and error.code not in (408, 429, 500, 502, 503, 504):
                raise
            wait = 2 ** attempt
            if isinstance(error, HTTPError) and error.headers.get('Retry-After', '').isdigit():
                wait = max(wait, int(error.headers['Retry-After']))
            time.sleep(min(wait, 60))
    raise RuntimeError(f'Provider unavailable for {filename}') from last


def write(filename, source, rows):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    target = OUTPUT / f'{filename}.v1.json'
    target.write_text(json.dumps({'version': 1, 'source': source, 'rows': rows}, separators=(',', ':')) + '\n')
    print(f'{filename}: {len(rows)} rows, {target.stat().st_size:,} bytes', flush=True)


def captured(filenames):
    last = max((CACHE / filename).stat().st_mtime for filename in filenames)
    return datetime.fromtimestamp(last, UTC).isoformat(timespec='seconds').replace('+00:00', 'Z')


def validate_calendar(rows, start, end):
    dates = [row[0] for row in rows]
    first, last = date.fromisoformat(start), date.fromisoformat(end)
    if dates != [(first + timedelta(days=i)).isoformat() for i in range((last - first).days + 1)]:
        raise ValueError(f'Incomplete or unordered days in {start} to {end}')


def csv_rows(archive, dataset):
    member = f'open_bitcoin_metrics/metrics/{dataset}/{dataset}.csv'
    with archive.extractfile(member) as file:
        return [row for row in csv.DictReader(io.TextIOWrapper(file, encoding='utf-8'))
                if BTC_START <= row['date'] <= BTC_END]


def bitcoin_stock_and_spending():
    raw = cached(f'https://zenodo.org/api/records/21156871/files/{TAR}/content', TAR)
    if hashlib.sha256(raw).hexdigest() != TAR_SHA256:
        raise ValueError('Release checksum differs from the published SHA-256')
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
        stock = [[row['date'], int(row['value'])] for row in csv_rows(archive, 'obm_utxo_eod_count_daily')]
        spending = []
        for row in csv_rows(archive, 'obm_spent_value_age_band_btc_daily'):
            values = [Decimal(row[f'spent_value_{band}_btc']) * 100_000_000 for band in AGE_BANDS]
            if not all(value.is_finite() and 0 <= value == int(value) for value in values):
                raise ValueError(f'Invalid satoshi value on {row["date"]}')
            spending.append([row['date'], int(sum(values)), *(int(sum(values[start:])) for start in AGE_START.values())])
    for rows in (stock, spending):
        validate_calendar(rows, BTC_START, BTC_END)
    write('bitcoin-utxo', {'url': RELEASE, 'license': 'CC BY 4.0', 'releaseSha256': TAR_SHA256, 'collectedAt': captured([TAR]),
                          'columns': ['day_utc', 'spendable_utxo_count']}, stock)
    write('bitcoin-spent-age', {'url': RELEASE, 'license': 'CC BY 4.0', 'releaseSha256': TAR_SHA256, 'collectedAt': captured([TAR]),
                               'columns': ['day_utc', 'all_satoshis', *(f'age_ge_{year}y_satoshis' for year in AGE_START)]}, spending)


def bitcoin_block_bytes():
    mempool = 'https://mempool.space/api'
    esplora = 'https://blockstream.info/api'
    data = []
    captures = []
    for last in range(HEIGHT_END, HEIGHT_START - 1, -15):
        filename = f'blocks/{last}.json'
        chunk = json.loads(cached(f'{mempool}/v1/blocks/{last}', filename, pause=1.1))
        captures.append(filename)
        if [row['height'] for row in chunk] != list(range(last, last - 15, -1)):
            raise ValueError(f'Incomplete canonical response ending at {last}')
        data.extend(row for row in chunk if row['height'] >= HEIGHT_START)
    data.reverse()
    if [row['height'] for row in data] != list(range(HEIGHT_START, HEIGHT_END + 1)):
        raise ValueError('Height coverage mismatch')
    for row in data:
        if not isinstance(row['size'], int) or not 80 <= row['size'] <= 4_000_000 or not BLOCK_ID.fullmatch(row['id']):
            raise ValueError(f'Invalid block metadata at height {row["height"]}')
        if not BLOCK_ID.fullmatch(row['previousblockhash']):
            raise ValueError(f'Invalid parent hash at height {row["height"]}')
    for prior, row in zip(data, data[1:]):
        if row['previousblockhash'] != prior['id']:
            raise ValueError(f'Broken chain at height {row["height"]}')
    verification = []
    for i in (0, len(data) // 2, len(data) - 1):
        row = data[i]
        height = row['height']
        actual = cached(f'{esplora}/block-height/{height}', f'blockstream/{height}.txt', pause=1.1).decode().strip()
        if row['id'] != actual:
            raise ValueError(f'Canonical endpoint disagreement at height {height}')
        raw = cached(f'{esplora}/block/{actual}/raw', f'blockstream/{height}.blk', pause=1.1)
        captures.extend((f'blockstream/{height}.txt', f'blockstream/{height}.blk'))
        if row['size'] != len(raw) or hashlib.sha256(hashlib.sha256(raw[:80]).digest()).digest()[::-1].hex() != actual:
            raise ValueError(f'Serialized block cross-check failed at height {height}')
        verification.append({'height': height, 'hash': actual, 'bytes': len(raw)})
    rows = [[row['height'], row['timestamp'], row['size'], row['id'], row['previousblockhash']] for row in data]
    write('bitcoin-bytes', {'url': 'https://mempool.space/docs/api/rest', 'crossCheck': 'https://github.com/Blockstream/esplora/blob/master/API.md', 'collectedAt': captured(captures),
                           'verification': verification, 'columns': ['height', 'timestamp_unix', 'bytes', 'block_hash', 'previous_hash']}, rows)


def usdc_holdings():
    query = urlencode({'assets': 'usdc_eth', 'metrics': 'AdrBalCnt,SplyCur', 'frequency': '1d',
                       'start_time': USDC_START, 'end_time': USDC_END, 'page_size': 1000})
    url = f'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?{query}'
    filename = f'coinmetrics-usdc-eth-{USDC_START}-{USDC_END}.json'
    dataset = json.loads(cached(url, filename))
    if dataset.get('next_page_url') or any(row['asset'] != 'usdc_eth' for row in dataset['data']):
        raise ValueError('Unexpected asset or pagination from Coin Metrics')
    rows = [[row['time'][:10], int(row['AdrBalCnt']), row['SplyCur']] for row in dataset['data']]
    validate_calendar(rows, USDC_START, USDC_END)
    if any(row[1] < 1 or not Decimal(row[2]).is_finite() or Decimal(row[2]) < 0 for row in rows):
        raise ValueError('Unexpected holdings values from Coin Metrics')
    write('ethereum-usdc', {'url': url, 'license': 'CC BY-NC 4.0', 'collectedAt': captured([filename]),
                            'columns': ['day_utc', 'funded_addresses', 'current_supply_usdc']}, rows)


if __name__ == '__main__':
    actions = {'blocks': bitcoin_block_bytes, 'obm': bitcoin_stock_and_spending, 'usdc': usdc_holdings}
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('source', choices=[*actions, 'all'], nargs='?', default='all')
    choice = cli.parse_args().source
    for action in actions.values() if choice == 'all' else (actions[choice],):
        action()
