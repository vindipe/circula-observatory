"""Build a deterministic monthly sample of public indexed Stellar ledgers. Node 24 and Python 3.10+."""
import argparse
import base64
import concurrent.futures
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STRIDE = 65536
FIRST = 968 * STRIDE  # July 2026, before the August coverage boundary
FIRST_MONTH = '2026-08'
BASE = 'https://aws-public-blockchain.s3.amazonaws.com/v1.1/stellar/ledgers/pubnet'
REGISTRY = 'https://registry.opendata.aws/aws-public-blockchain/'
LICENSE = 'https://github.com/aws-solutions-library-samples/guidance-for-digital-assets-on-aws/blob/main/LICENSE'
DECODER = 'https://registry.npmjs.org/@stellar/stellar-base/-/stellar-base-15.0.0.tgz'
DIGEST = 'XQhxUr9BYiEcFcgc4oWcCMR9QJCny/GmmGsuwPKf/ieIcOeb5149KLHYx9mJCA0ea8QbucR2/GzV58QbXOTxQA=='

def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        tmp.write(data)
        os.chmod(tmp.name, 0o644)
    os.replace(tmp.name, path)

def fetch(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=25) as result:
                return result.read()
        except OSError:
            if attempt == 2:
                raise
            time.sleep(1 + attempt)

def decoder(cache):
    path = cache / 'stellar-base-15.0.0.tgz'
    if not path.exists():
        atomic(path, fetch(DECODER))
    raw = path.read_bytes()
    if base64.b64encode(hashlib.sha512(raw).digest()).decode() != DIGEST:
        raise ValueError('Decoder checksum mismatch')
    with tarfile.open(fileobj=io.BytesIO(raw)) as package:
        target = cache / 'decoder.cjs'
        atomic(target, package.extractfile('package/dist/stellar-base.min.js').read())
        return target

def url(seq):
    partition = seq // 64000 * 64000
    return f'{BASE}/{0xffffffff-partition:08X}--{partition}-{partition+63999}/{0xffffffff-seq:08X}--{seq}.xdr.zst'

def build(cache, through):
    sdk = decoder(cache)
    def extract(seq, verify=False):
        path = cache / f'{seq}.zst'
        if verify or not path.exists():
            atomic(path, fetch(url(seq)))
        result = subprocess.run(['node', ROOT/'scripts/stellar_decode.cjs', sdk, path, str(seq)],
                                capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(f'Ledger {seq}: {result.stderr[-1400:]}')
        return json.loads(result.stdout)
    previous = extract(FIRST)
    if previous['date'][:7] >= FIRST_MONTH:
        raise ValueError('Missing initial coverage boundary')
    samples, events = [], []
    current = FIRST + STRIDE
    # Fetch nearby samples concurrently. Each month is bracketed by embedded ledger close dates.
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        while previous['date'][:7] <= through:
            # Limit lookahead to one near the publication boundary.
            size = 1 if previous['date'][:7] >= through else 5
            for sample in pool.map(extract, range(current, current+size*STRIDE, STRIDE)):
                if sample['date'] <= previous['date']:
                    raise ValueError('Non-monotonic sample')
                previous = sample
                if FIRST_MONTH <= sample['date'][:7] <= through:
                    events.extend(sample['events'])
                    samples.append({key:sample[key] for key in ('ledger','date','headerHash')})
            current += size * STRIDE
    if not samples:
        raise ValueError('No eligible monthly samples')
    # Repeat extraction from S3, hash verification and key classification for an independent fetch.
    verify_seq = samples[-1]['ledger']
    check = extract(verify_seq, verify=True)
    if check['events'] != [e for e in events if e['ledger'] == verify_seq]:
        raise ValueError('Refetched audit ledger disagrees')
    return dict(series=[], events=events, samples=samples, fromMonth=FIRST_MONTH, toMonth=through,
                stride=STRIDE, source='Stellar / AWS Public Blockchain Data', sourceUrl=REGISTRY,
                license='MIT-0 (AWS registry)', licenseUrl=LICENSE, downloadable=True,
                coverage='Systematic ledger sample', unavailable=['expiry','hubble-census'],
                audit=dict(refetchedLedger=verify_seq, boundaryAfter=previous['date'],sampleCount=len(samples)))

if __name__ == '__main__':
    latest=(dt.datetime.now(dt.timezone.utc).date().replace(day=1)-dt.timedelta(days=1)).strftime('%Y-%m')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache',type=Path,default=Path(tempfile.gettempdir())/'circula-stellar')
    parser.add_argument('--output',type=Path,default=ROOT/'public/atlas/stellar.json')
    parser.add_argument('--through',default=latest)
    args=parser.parse_args()
    if dt.datetime.strptime(args.through,'%Y-%m').strftime('%Y-%m') != args.through or not FIRST_MONTH <= args.through <= latest:
        parser.error('Expected a supported complete UTC month')
    snapshot=build(args.cache.resolve(),args.through)
    atomic(args.output, json.dumps(snapshot,separators=(',',':')).encode())
    print(f"{len(snapshot['samples'])} sampled ledgers, {len(snapshot['events'])} resource events")
