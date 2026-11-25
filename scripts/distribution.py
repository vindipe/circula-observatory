"""Prepare monthly positive-address balance distributions from Bitview's indexed API."""
import argparse
import calendar
import fcntl
import hashlib
import json
import os
import subprocess
from contextlib import contextmanager
import tempfile
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlencode

from distribution_early import exact_2009
from distribution_i18n import METHODS, SCOPE as LOCALIZED_SCOPE

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://bitview.space'
API = BASE + '/api/series/bulk?'
SECONDARY = 'https://bitcoinyears.com/data/toolkit/stack.json'
BANDS = (
    '1_to_10_sats', '10_to_100_sats', '100_to_1k_sats', '1k_to_10k_sats',
    '10k_to_100k_sats', '100k_to_1m_sats', '1m_to_10m_sats', '10m_to_100m_sats',
    '1_to_10_btc', '10_to_100_btc', '100_to_1k_btc', '1k_to_10k_btc',
    '10k_to_100k_btc', 'over_100k_btc',
)
LABELS = ('1–<10 sat', '10–<100 sat', '100–<1k sat', '1k–<10k sat', '10k–<100k sat',
          '100k–<1M sat', '0.01–<0.1 BTC', '0.1–<1 BTC', '1–<10 BTC', '10–<100 BTC',
          '100–<1k BTC', '1k–<10k BTC', '10k–<100k BTC', '≥100k BTC')
SATS = 100_000_000
SCOPE = ('Bitcoin addresses with a positive balance under Bitview’s locking-script classifications. '
         'Exchange custody, script contracts and burn-labelled addresses remain where the index recognizes their scripts. '
         'Zero balances and unrecognized scripts are excluded. Addresses are not grouped by owner.')


def fetch(url, cache):
    key = hashlib.sha256(url.encode()).hexdigest() + '.json'
    path = cache / key if cache else None
    if path and path.exists():
        raw = path.read_bytes()
    else:
        raw = subprocess.check_output(['curl', '--fail', '--silent', '--show-error', '--location',
                                       '--retry', '3', '--max-time', '90', url])
        obj = json.loads(raw, parse_float=Decimal)
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as f:
                f.write(raw)
            os.replace(f.name, path)
        return obj
    return json.loads(raw, parse_float=Decimal)


def bulk(cache, names, index='month1', start=0, end=None):
    args = {'series': ','.join(names), 'index': index, 'start': start}
    if end is not None:
        args['end'] = end
    rows = fetch(API + urlencode(args, safe=','), cache)
    if len(rows) != len(names):
        raise ValueError('Incomplete bulk response')
    for row in rows:
        if row['index'] != index or row['start'] != start or len(row['data']) != row['end'] - start:
            raise ValueError(f'Unexpected {index} window')
        if end is not None and row['end'] != end:
            raise ValueError('Truncated index range')
    return [r['data'] for r in rows]


def grouped_floor(counts, sats):
    n, total = sum(counts), sum(sats)
    cumulative = area = 0
    for count, amount in zip(counts, sats, strict=True):
        area += count * (2 * cumulative + amount)
        cumulative += amount
    return 1 - area / (n * total)


def boundary_share(counts, sats, rank):
    """Exactly identify a top-k when the cohort boundary coincides with that rank."""
    n = value = 0
    for count, amount in reversed(list(zip(counts, sats, strict=True))):
        n += count
        value += amount
        if n == rank:
            return 100 * value / sum(sats)
        if n > rank:
            break
    return None


def meta(metric, label, unit, method, points):
    end_year, end_month = map(int, points[-1][0].split('-'))
    last_day = calendar.monthrange(end_year, end_month)[1]
    return dict(lastObservation=f'{end_year:04}-{end_month:02}-{last_day:02}', methodI18n=METHODS[metric],
                scopeI18n=LOCALIZED_SCOPE, asset='btc', name='Bitcoin', network='Bitcoin', contract=None, dashboard='concentration',
                metric=metric, label=label, unit=unit, kind='ratio', scope=SCOPE, method=method, source='Bitview (bitview.space)',
                sourceUrl=BASE + '/', license='CC BY 4.0',
                licenseUrl='https://creativecommons.org/licenses/by/4.0/', comparison=None, points=points)


def in_satoshis(value):
    exact = Decimal(value) * SATS
    if exact < 0 or exact != exact.to_integral_value():
        raise ValueError('Invalid BTC amount')
    return int(exact)


def build(as_of, cache):
    dates, totals, funded, zero = bulk(cache, ['date', 'address_supply', 'funded_address_count', 'balance_0_sats_address_count'])
    counts = bulk(cache, ['balance_' + b + '_address_count' for b in BANDS])
    amounts = bulk(cache, ['balance_' + b + '_supply' for b in BANDS])
    threshold = as_of.replace(day=1).isoformat()
    if len(dates) != len(set(dates)) or dates != sorted(dates):
        raise ValueError('Duplicate or out-of-order months')
    months, grouped, rank100 = {}, [], []
    sat_records = {}
    last_ordinal = None
    for i, start in enumerate(dates):
        if start >= threshold:
            break
        period = date.fromisoformat(start)
        ordinal = period.year * 12 + period.month
        if period.day != 1 or (last_ordinal is not None and ordinal != last_ordinal + 1):
            raise ValueError('Month grid is incomplete')
        last_ordinal = ordinal
        m = start[:7]
        c = [v[i] for v in counts]
        sats = [in_satoshis(v[i]) for v in amounts]
        if any(type(x) != int or x < 0 for x in c):
            raise ValueError(f'Missing or invalid address count in {m}')
        if sum(c) != funded[i] - zero[i] or sum(sats) != in_satoshis(totals[i]):
            raise ValueError(f'Positive bands do not reconcile in {m}')
        for j, (n, value) in enumerate(zip(c, sats, strict=True)):
            if not (n * 10**j <= value) or (j < len(BANDS)-1 and value > n * (10**(j+1)-1)):
                raise ValueError(f'Band arithmetic failed for {m} / {BANDS[j]}')
        months[m] = {'counts': c, 'btc': [a / SATS for a in sats]}
        sat_records[m] = sats
        grouped.append([m, grouped_floor(c, sats)])
        share = boundary_share(c, sats, 100)
        if share is not None:
            rank100.append([m, share])
    if not months:
        raise ValueError('No complete month')
    secondary = fetch(SECONDARY, cache)
    if secondary['license'] != 'CC BY 4.0':
        raise ValueError('Bitcoin Years license changed')
    checked = []
    for day, cc, bb in zip(secondary['days'], secondary['count'], secondary['btc'], strict=True):
        d = date.fromisoformat(day)
        m = day[:7]
        if m not in months or d.day != calendar.monthrange(d.year, d.month)[1]:
            continue
        if cc != months[m]['counts'] or any(abs(Decimal(x) * SATS - s) > SATS // 200
                                            for x, s in zip(bb, sat_records[m], strict=True)):
            raise ValueError(f'Second extraction disagrees in {m}')
        checked.append(m)
    if len(checked) < 2:
        raise ValueError('Insufficient independent month-end checks')
    series = [meta('gini_grouped_floor', 'Gini lower bound · 14 balance bands', '0–1',
                   'At each month-end, join cumulative address and BTC shares at 14 ordered band boundaries. '
                   'One minus twice the area under this polygon bounds the address-level Gini from below. '
                   'Differences among balances inside a band remain unobserved.', grouped)]
    # Immutable early index requests can be reused across refresh months.
    early_cache = cache.parent / 'early-2009' if cache else None
    checks = exact_2009(bulk, early_cache, months, sat_records)
    exact_method = ('January–December 2009 validation window. Sum indexed outputs minus spent outputs per recognized '
                    'address script at each month-end, retain every strictly positive balance, and rank them. '
                    'All cohort totals must reconcile in integer satoshis.')
    series.append(meta('gini_address', 'Address-level Gini · exact baseline', '0–1',
                       exact_method + ' Gini = Σ(2i−n−1)bᵢ / (nΣbᵢ), with ascending one-based ranks.',
                       [[m, gini] for m,gini,_,_ in checks]))
    series.append(meta('top10_share', 'Balance share of the top 10 addresses', '%',
                       exact_method + ' Divide the sum of the ten largest balances by the total positive balance.',
                       [[m, share] for m,_,share,_ in checks]))
    rank100 = sorted(dict(rank100 + [[m,share] for m,_,_,share in checks]).items())
    if rank100:
        series.append(meta('top100_share', 'Balance share of the top 100 addresses', '%',
                           'In 2009, rank all positive address balances. At later dates, report a value only when the upper bands contain exactly 100 addresses. '
                           'Denominator: BTC across all positive address bands. Other month-ends are missing.', rank100))
    return {'series': series, 'distribution': {
        'bands': [{'label': text, 'lowerSats': 10**i, 'upperSats': 10**(i+1) if i < 13 else None}
                  for i, text in enumerate(LABELS)], 'months': months},
        'verification': {'primary': BASE + '/terms/', 'crossCheck': 'https://bitcoinyears.com/stack-rank/',
                         'addressLevelCrossChecks': len(checks), 'monthEndChecks': len(checked), 'firstCheck': checked[0], 'lastCheck': checked[-1]},
        'unavailable': []}


@contextmanager
def locked_directory(directory):
    fd = os.open(directory, os.O_RDONLY)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        os.close(fd)


def publish(path, result):
    path.parent.mkdir(parents=True, exist_ok=True)
    with locked_directory(path.parent):
        if path.exists():
            previous = json.loads(path.read_text())
            old_months = previous['distribution']['months']
            new_months = result['distribution']['months']
            if old_months.keys() - new_months.keys():
                raise ValueError('Update would lose previously published months')
            new_coverage = {s['metric']: {m for m,_ in s['points']} for s in result['series']}
            for s in previous['series']:
                if {m for m,_ in s['points']} - new_coverage.get(s['metric'], set()):
                    raise ValueError('Update would lose previously published observations')
        with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as file:
            tmp = Path(file.name)
            try:
                json.dump(result, file, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
                file.write('\n')
                file.flush()
                os.fsync(file.fileno())
                os.chmod(tmp, 0o644)
                os.replace(tmp, path)
            finally:
                tmp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--as-of', type=date.fromisoformat, default=datetime.now(timezone.utc).date())
    parser.add_argument('--output', type=Path, default=ROOT / 'public/atlas/distribution.json')
    parser.add_argument('--cache', type=Path)
    args = parser.parse_args()
    cache = args.cache / args.as_of.strftime('%Y-%m') if args.cache else None
    result = build(args.as_of, cache)
    publish(args.output, result)
    print(f"Validated {len(result['distribution']['months'])} month-end distributions, "
          f"{result['verification']['monthEndChecks']} secondary checks.")


if __name__ == '__main__':
    main()
