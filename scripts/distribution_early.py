"""Exact 2009 BTC address statistics from pre-indexed Bitview transaction inputs and outputs."""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

SAT = 100_000_000


def chunked(bulk, cache, names, index, stop):
    # Each call stays below the hosted API's documented response weight limit.
    chunks = [(start, min(stop, start + 5_000)) for start in range(0, stop, 5_000)]
    columns = [[] for _ in names]
    def fetch(pair):
        start, end = pair
        return bulk(cache, names, index, start, end)
    with ThreadPoolExecutor(max_workers=2) as executor:
        for batch in executor.map(fetch, chunks):
            for column, part in zip(columns, batch, strict=True):
                column.extend(part)
    return columns


def exact_2009(bulk, cache, months, sat_records):
    days, month_height = bulk(cache, ['date', 'first_height'], 'month1', 0, 13)
    if days != [f'2009-{n:02d}-01' for n in range(1, 13)] + ['2010-01-01']:
        raise ValueError('Unexpected sample dates')
    outputs, inputs = chunked(bulk, cache, ['first_txout_index', 'first_txin_index'], 'height', month_height[-1]+1)
    types, local_keys, values = chunked(bulk, cache, ['output_type','type_index','output_value'], 'txout_index', outputs[-1])
    spent, = chunked(bulk, cache, ['spent_txout_index'], 'txin_index', inputs[-1])
    allowed_types = {'p2pk65', 'p2pk33', 'p2pkh'}
    if set(types) - allowed_types:
        raise ValueError('Review additional script classes before expanding the fixed sample')
    balances = Counter()
    checks = []
    prev_output = prev_input = 0
    for day, height in zip(days[:-1], month_height[1:], strict=True):
        month = day[:7]
        for n in range(prev_output, outputs[height]):
            balances[types[n], local_keys[n]] += values[n]
        for n in spent[prev_input:inputs[height]]:
            if n is not None:
                balances[types[n], local_keys[n]] -= values[n]
        prev_output, prev_input = outputs[height], inputs[height]
        if min(balances.values()) < 0:
            raise ValueError(f'Negative balance in {month}')
        ordered = sorted(v for v in balances.values() if v > 0)
        n, total = len(ordered), sum(ordered)
        count_by_band, sat_by_band = [0]*14, [0]*14
        for v in ordered:
            band = min(13,len(str(v))-1)
            count_by_band[band] += 1
            sat_by_band[band] += v
        if count_by_band != months[month]['counts'] or sat_by_band != sat_records[month]:
            raise ValueError(f'Address-level reconstruction disagrees with the independent cohort extraction in {month}: '
                             f'{count_by_band} vs {months[month]["counts"]}, {sat_by_band} vs {sat_records[month]}')
        months[month]["balanceRanks"] = sorted(Counter(ordered).items())
        numerator = sum((2*rank - n - 1)*v for rank, v in enumerate(ordered, 1))
        checks.append((month, numerator/(n*total), 100*sum(ordered[-10:])/total, 100*sum(ordered[-100:])/total))
    return checks
