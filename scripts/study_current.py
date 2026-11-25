#!/usr/bin/env python3
"""Rebuild the keyless Community study at the last closed UTC month. Python 3.11+."""
import argparse
from bisect import bisect_left, bisect_right
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode

from community import CONTRACT, METRICS, atomic, get

BASELINE = date(2019, 12, 31)
DAY = timedelta(days=1)
BASE = tuple(METRICS)  # Same discovery/request order as the monthly archive, for cache reuse.
AUDIT = ('AdrNewCnt', 'ContCnt', 'UTXOCnt', 'SplyAdrTop10Pct', 'SplyAct1d', 'SplyAct1yr', 'SplyRvv1yr')
ALL = (*BASE, 'BlkSizeByte', 'BlkSizeMeanByte', 'SplyExNtv', 'PriceUSD', *AUDIT)
CORE = ('transactions', 'fundedAddresses', 'supply', 'inactiveFloor', 'transfers30d', 'activeAddresses30d')
API = 'https://community-api.coinmetrics.io/v4/'
LICENSE = 'https://creativecommons.org/licenses/by-nc/4.0/'
SOURCE = 'Coin Metrics Community'
D = Decimal


# mtime records the original successful HTTP acquisition, even when this edition reuses the page.
ACQUISITIONS = {}


def pages(path, params, cache):
    args = dict(params)
    result, seen = [], set()
    while True:
        url = API + path + '?' + urlencode(args)
        if url in seen:
            raise ValueError('Repeated Community pagination cursor')
        seen.add(url)
        page = get(url,cache)
        key = cache / hashlib.sha256(url.encode()).hexdigest()
        ACQUISITIONS[key] = key.stat().st_mtime
        result.extend(page['data'])
        token = page.get('next_page_token')
        if not token:
            return result
        args['next_page_token'] = token


def layer_for(asset, scope, host):
    if scope == 'token_deployment':
        return 'Application · token protocol' if asset.endswith('_omni') else 'Application · token contract'
    if scope == 'aggregate':
        return 'Cross-deployment'
    if scope == 'network':
        if asset in {'btc','eth','ltc','bch','doge','xlm','xrp','ada','trx','etc'}:
            return 'L1 · base network'
        return 'Network · layer unverified'
    return 'Unverified'


def number(value):
    return int(value) if value == value.to_integral_value() else float(value)


def asset_identity(asset, spans):
    if asset in {'usdc','usdt'}:
        return 'aggregate', None
    if 'BlkCnt' in spans:
        return 'network', asset
    suffix = asset.rsplit('_', 1)
    if len(suffix) == 2 and suffix[1] in {'eth','trx','avaxc','eos','sol','omni'}:
        return 'token_deployment', 'btc' if suffix[1] == 'omni' else suffix[1]
    return 'provider_asset', None


def load_assets(end, cache):
    """Return {asset:{metric:(first,last)}}, {metric:definition}, {asset:name}."""
    data = pages('catalog-v2/asset-metrics', {'metrics': ','.join(ALL), 'page_size': 10000}, cache)
    catalog = {}
    for row in data:
        asset = row['asset']
        if asset in catalog:
            raise ValueError(f'Duplicate catalog ID {asset}')
        catalog[asset] = {
            metric['metric']: (date.fromisoformat(f['min_time'][:10]), date.fromisoformat(f['max_time'][:10]))
            for metric in row['metrics'] for f in metric['frequencies']
            if f['frequency'] == '1d' and f.get('community') and f.get('min_time') and f.get('max_time')
        }
    definitions = {row['metric']:row for row in pages('reference-data/asset-metrics',
                                                       {'metrics':','.join(ALL), 'page_size':1000},cache)}
    missing = set(ALL)-set(definitions)
    if missing:
        raise ValueError(f'No official definition for {sorted(missing)}')
    names = {r['asset']:r['full_name'] for r in pages('reference-data/assets',{'page_size':10000},cache)}
    return catalog, definitions, names


def fetch_group(asset, metrics, start, end, cache):
    if not metrics or start > end:
        return {}
    result = {}
    params = {'assets':asset, 'metrics':','.join(sorted(metrics)), 'frequency':'1d',
              'start_time':str(start),'end_time':str(end),'page_size':10000}
    for row in pages('timeseries/asset-metrics', params, cache):
        day = date.fromisoformat(row['time'][:10])
        if row['asset'] != asset or not start <= day <= end or day in result:
            raise ValueError(f'Unexpected or duplicate observation for {asset} {day}')
        daily = {m:D(row[m]) for m in metrics if row.get(m) not in ('',None)}
        if any(not v.is_finite() or v < 0 for v in daily.values()):
            raise ValueError(f'Invalid observation for {asset} {day}')
        result[day] = daily
    return result


def fetch_asset(asset, spans, end, cache):
    core = sorted(set(BASE) & set(spans))
    rows = fetch_group(asset, core, min((spans[m][0] for m in core),default=end), end, cache)
    other = sorted(set(spans) - set(core) - {'PriceUSD'})
    if 'SplyExNtv' in other and 'PriceUSD' in spans:
        other.append('PriceUSD')
    extra = fetch_group(asset,other,min((spans[m][0] for m in other), default=end),end,cache)
    for day, values in extra.items():
        rows.setdefault(day,{}).update(values)
    return rows


def absent(status, detail, **evidence):
    return {'value':None, 'status':status, 'detail':detail, **evidence}


def observed(value, day, start=None, inputs=None):
    obs = {'value':number(value), 'status':'zero_observed' if value == 0 else 'observed',
           'observedUtc':str(day)}
    if start:
        obs['startUtc'] = str(start)
    if inputs:
        obs['inputs'] = {k:number(v) if isinstance(v,D) else v for k,v in inputs.items()}
    return obs


class DailyTotals:
    """Decimal prefix sums and actual observation dates, with missing days preserved."""
    def __init__(self, rows, metrics):
        self.dates = []
        self.prefix = [D(0)]
        for day in sorted(rows):
            values = rows[day]
            if all(m in values for m in metrics):
                quantity = values[metrics[0]]
                if len(metrics) == 2:
                    quantity *= values[metrics[1]]
                self.dates.append(day)
                self.prefix.append(self.prefix[-1] + quantity)

    def window(self, start, end):
        left = bisect_left(self.dates, start)
        right = bisect_right(self.dates, end)
        expected = (end - start).days + 1
        if right-left == expected:
            return self.prefix[right]-self.prefix[left], None
        # Log the first missing UTC date without iterating a multi-year history.
        lo, hi = left, right
        while lo < hi:
            mid = (lo+hi)//2
            if self.dates[mid] == start + (mid-left)*DAY:
                lo = mid + 1
            else:
                hi = mid
        missing = start + (lo-left)*DAY
        return None, (right-left, expected, missing)


class StudyAsset:
    def __init__(self, rows, spans, scope, asset=None):
        self.rows = rows
        self.spans = spans
        self.scope = scope
        self.asset = asset
        keys = [('TxCnt',), ('BlkCnt',), ('TxTfrCnt',), ('AdrActCnt',), ('BlkSizeByte',),
                ('BlkCnt','BlkSizeMeanByte'), ('SplyRvv1yr',)]
        self.totals = {key:DailyTotals(rows,key) for key in keys if all(m in spans for m in key)}

    def missing(self, metrics, day):
        unavailable = [m for m in metrics if m not in self.spans]
        if unavailable:
            return absent('not_public', 'No daily Community series for ' + ', '.join(unavailable) + '.')
        for m in metrics:
            first,last = self.spans[m]
            if day < first or day > last:
                return absent('missing', f'{m}: catalog covers {first} to {last}.', startUtc=str(first),
                              inputs={'firstAvailableUtc':str(first),'lastAvailableUtc':str(last)})
        return None

    def sum(self, metrics, start, day):
        gap = self.missing(metrics,day)
        if gap:
            return None,gap
        if start > day:
            return None,absent('incomplete',f'Series starts after {day}.')
        value, partial = self.totals[metrics].window(start,day)
        if partial:
            count,expected,missing = partial
            return None,absent('incomplete',f'{", ".join(metrics)}: {count}/{expected} UTC days; '
                               f'first missing {missing}.', startUtc=str(start),
                               inputs={'daysObserved':count,'daysExpected':expected,'firstMissingUtc':str(missing)})
        return value,None

    def point(self, metrics, day):
        gap = self.missing(metrics,day)
        if gap:
            return None,gap
        daily = self.rows.get(day,{})
        empty = [m for m in metrics if m not in daily]
        if empty:
            return None,absent('incomplete',f'{", ".join(empty)} missing on {day}.')
        return {m:daily[m] for m in metrics},None

    def cumulative(self, metric, day):
        if self.scope == 'token_deployment' and metric == 'BlkCnt':
            return absent('not_applicable', 'Block history belongs to the host network.')
        start = self.spans.get(metric,(day,day))[0]
        value,gap = self.sum((metric,),start,day)
        return gap or observed(value,day,start)

    def bytes(self, day):
        if self.scope == 'token_deployment':
            return absent('not_applicable','Block bytes belong to the host network.')
        if 'BlkCnt' not in self.spans or not ({'BlkSizeByte','BlkSizeMeanByte'} & self.spans.keys()):
            return absent('not_public','Missing daily block-byte history from the first block-count observation.')
        start = self.spans['BlkCnt'][0]
        reasons = []
        for metrics in [('BlkSizeByte',),('BlkCnt','BlkSizeMeanByte')]:
            if not all(m in self.spans for m in metrics):
                continue
            amount,gap = self.sum(metrics,start,day)
            if not gap:
                return observed(amount / D(10**9),day,start,{'bytes':amount,'codes':' × '.join(metrics)})
            reasons.append(gap['detail'])
        return absent('incomplete',' '.join(reasons),startUtc=str(start))

    def observe(self, day, extensions=False):
        start = day - 29*DAY
        values = {'transactions':self.cumulative('TxCnt',day),
                  'blocks':self.cumulative('BlkCnt',day), 'ledgerBytes':self.bytes(day)}
        for indicator,metric in [('fundedAddresses','AdrBalCnt'),('supply','SplyCur')]:
            point,gap = self.point((metric,),day)
            values[indicator] = gap or observed(point[metric],day)
        active,active_gap = self.sum(('AdrActCnt',),start,day)
        transfers,transfer_gap = self.sum(('TxTfrCnt',),start,day)
        values['activeAddresses30d'] = active_gap or observed(active/30,day,start,{'AdrActCntSum30d':active,'days':30})
        values['transfers30d'] = transfer_gap or observed(transfers/30,day,start,{'TxTfrCntSum30d':transfers,'days':30})
        funded,gap = self.point(('AdrBalCnt',),day)
        if gap or active_gap:
            values['inactiveFloor'] = gap or active_gap
        else:
            count = funded['AdrBalCnt']
            operands = {'AdrBalCnt':count,'AdrActCntSum30d':active,'days':30}
            values['inactiveFloor'] = (observed(100*max(D(0),count-active)/count,day,start,operands)
                                       if count else absent('undefined','Zero funded-address denominator.',
                                                            inputs={'AdrBalCnt':0, 'AdrActCntSum30d':number(active),'days':30}))
        share,gap = self.point(('SplyExNtv','SplyCur'),day)
        if gap:
            values['exchangeShare'] = gap
        else:
            supply,custody = share['SplyCur'], share['SplyExNtv']
            if custody > supply:
                raise ValueError(f'Exchange-attributed balance exceeds supply on {day}.')
            values['exchangeShare'] = (observed(100*custody/supply,day,inputs=share) if supply else
                                       absent('undefined','Zero supply denominator.',inputs={'SplyExNtv':0,'SplyCur':0}))
        valuation,gap = self.point(('SplyExNtv','PriceUSD'),day)
        values['exchangeValue'] = gap or observed(valuation['SplyExNtv']*valuation['PriceUSD'],day,
                                                  inputs={**valuation,'priceDateUtc':str(day)})
        if extensions:
            for indicator,metric in [('unspentOutputs','UTXOCnt'),('contractCount','ContCnt')]:
                point,gap = self.point((metric,),day)
                values[indicator] = gap or observed(point[metric],day)
            if self.scope == 'token_deployment':
                values['unspentOutputs'] = absent('not_applicable','UTXOCnt describes host-chain outputs, not token balances.')
                values['contractCount'] = absent('not_applicable','ContCnt measures the host network contract stock.')
            elif self.asset in {'eth','etc','xlm','xrp','trx','algo','avaxc'}:
                values['unspentOutputs'] = absent('not_applicable','This network records balances using an account model.')
            decile,gap = self.point(('SplyAdrTop10Pct','SplyCur'),day)
            if gap:
                values['topDecileShare'] = gap
            elif not decile['SplyCur']:
                values['topDecileShare'] = absent('undefined','Zero supply denominator.')
            else:
                values['topDecileShare'] = observed(100*decile['SplyAdrTop10Pct']/decile['SplyCur'],day,inputs=decile)
            for indicator,metric in [('inactive1d','SplyAct1d'),('inactive1yr','SplyAct1yr')]:
                point,gap = self.point(('SplyCur',metric),day)
                if gap:
                    values[indicator] = gap
                elif point[metric] > point['SplyCur']:
                    raise ValueError(f'{metric} exceeds current supply on {day}.')
                else:
                    values[indicator] = observed(point['SplyCur']-point[metric],day,inputs=point)
            month_start = day.replace(day=1)
            revived,gap = self.sum(('SplyRvv1yr',),month_start,day)
            values['revived1yr'] = gap or observed(revived,day,month_start)
        return values


def relevant(catalog):
    return {asset:spans for asset,spans in catalog.items() if set(spans)-{'PriceUSD'}}


def metric_audit(catalog,definitions):
    audit = {}
    for metric in ALL:
        info = definitions[metric]
        # Keep a comparability checkpoint across editions without storing official prose in full.
        fields = {k: info.get(k) for k in ('description','unit','type')}
        fingerprint = hashlib.sha256(json.dumps(fields,sort_keys=True).encode()).hexdigest()
        ids = sorted(asset for asset,spans in catalog.items() if metric in spans)
        audit[metric] = {'communityCount':len(ids),'unit':info.get('unit'),'documentationUrl':info['docs_url'],
                         'definitionSha256':fingerprint}
        if metric != 'PriceUSD':
            audit[metric]['communityIds'] = ids
    return audit


def cross_check_end(end, cache, records):
    """A separate narrow extraction in reverse order verifies complete windows and custody operands."""
    metrics = ('AdrBalCnt','SplyCur','SplyExNtv','PriceUSD','TxTfrCnt','AdrActCnt')
    start = end - 29*DAY
    rows = pages('timeseries/asset-metrics',{'assets':'btc','metrics':','.join(metrics),
                 'start_time':str(start),'end_time':str(end),'frequency':'1d','page_size':10,
                 'paging_from':'end','ignore_unsupported_errors':'true','ignore_forbidden_errors':'true'},cache)
    by_day = {date.fromisoformat(r['time'][:10]):r for r in rows if r['asset']=='btc'}
    expected_days = {start + n*DAY for n in range(30)}
    if len(rows) != len(by_day) or not set(by_day).issubset(expected_days):
        raise ValueError('Invalid independent verification rows.')
    point = by_day.get(end,{})
    def n(key):
        return D(point[key]) if point.get(key) is not None else None
    def total(key):
        if all(by_day.get(d,{}).get(key) is not None for d in expected_days):
            return sum(D(by_day[d][key]) for d in expected_days)
        return None
    funded,supply,exchange,price = [n(key) for key in metrics[:4]]
    active,transfers = total('AdrActCnt'),total('TxTfrCnt')
    checks = {'fundedAddresses':funded, 'supply':supply,
              'inactiveFloor':100*max(D(0),funded-active)/funded if funded and active is not None else None,
              'transfers30d':transfers/30 if transfers is not None else None,
              'activeAddresses30d':active/30 if active is not None else None,
              'exchangeShare':100*exchange/supply if supply and exchange is not None else None,
              'exchangeValue':exchange*price if exchange is not None and price is not None else None}
    for k,v in checks.items():
        expected = None if v is None else number(v)
        if records['btc']['latest'][k]['value'] != expected:
            raise ValueError(f'Independent month-end verification failed for BTC {k}.')


def validate_editions(old,new):
    if old and old['cutoffUtc'] > new['cutoffUtc']:
        raise ValueError('Refusing to replace a more recent cutoff.')
    if old:
        for metric,entry in old.get('catalogAudit',{}).items():
            now = new['catalogAudit'].get(metric)
            if not now or entry['definitionSha256'] != now['definitionSha256']:
                raise ValueError(f'Provider metadata changed for {metric}. Review definitions before publishing.')
    if not new['assets'] or not any(all(data['latest'][k]['value'] is not None for k in CORE)
                                    for data in new['assets'].values()):
        raise ValueError('No complete core observations in candidate.')


def build(end, cache, target):
    ACQUISITIONS.clear()
    catalog,definitions,names = load_assets(end,cache)
    assets = relevant(catalog)
    def collect(item):
        asset,spans = item
        scope,host = asset_identity(asset,spans)
        engine = StudyAsset(fetch_asset(asset,spans,end,cache),spans,scope,asset)
        result = {'name':names.get(asset,asset),'scope':scope,'host':host,'layer':layer_for(asset,scope,host),'contract':CONTRACT.get(asset,(None,))[0],
                  'starts':{k:str(a) for k,(a,_) in spans.items() if k in ('BlkCnt','TxCnt')},
                  'baseline':engine.observe(BASELINE,extensions=True),'latest':engine.observe(end,extensions=True)}
        return asset,result
    with ThreadPoolExecutor(max_workers=5) as pool:
        records = dict(sorted(pool.map(collect, assets.items())))
    # Prices by themselves cannot qualify an ID for the on-chain sample.
    price_only = sorted(a for a,s in catalog.items() if set(s)=={'PriceUSD'})
    cross_check_end(end,cache,records)
    def timestamp(mtime):
        return datetime.fromtimestamp(mtime,UTC).isoformat(timespec='seconds')
    output = {'baselineUtc':str(BASELINE),'cutoffUtc':str(end),
              'retrievedUtc':timestamp(max(ACQUISITIONS.values())),
              'acquisitionStartUtc':timestamp(min(ACQUISITIONS.values())), 'source':SOURCE,
              'license':'CC BY-NC 4.0','licenseUrl':LICENSE,'endpoint':API,
              'discovery':{'catalogIds':len(catalog),'onchainIds':len(assets),'priceOnlyIds':price_only},
              'catalogAudit':metric_audit(catalog,definitions),'assets':records}
    validate_editions(json.loads(target.read_bytes()) if target.exists() else None,output)
    atomic(target,(json.dumps(output,separators=(',',':'),ensure_ascii=False)+'\n').encode())
    return output


def closed_month(now):
    return now.astimezone(UTC).date().replace(day=1)-DAY


if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--end',type=date.fromisoformat,default=closed_month(datetime.now(UTC)))
    parser.add_argument('--cache',type=Path,default=Path('.cache/study'))
    parser.add_argument('--output',type=Path,default=Path('public/atlas/study-current.json'))
    args = parser.parse_args()
    if args.end < BASELINE or args.end > closed_month(datetime.now(UTC)) or (args.end + DAY).day != 1:
        parser.error('Choose a closed UTC month-end on or after the baseline.')
    output = build(args.end,args.cache/str(args.end),args.output)
    for side in ('baseline','latest'):
        print(side, len([1 for asset in output['assets'].values()
                         if all(asset[side][k]['value'] is not None for k in CORE)]),'complete IDs')
