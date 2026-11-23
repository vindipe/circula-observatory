import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { compatible, type Point } from '../src/shared/model'
import { metricById } from '../src/shared/metrics'
import { pointStatements } from '../src/worker/archive'
import { coinAsset, coinNetwork, putEntities, stellarKeys } from '../src/worker/catalog'
import { coinPlan, retryDelay } from '../src/worker/collect'
import { closeTimeFromLedgerPrefix, decodeCoinRows, decodeStellar, validPublicNode } from '../src/worker/sources'

test('daily ingestion preserves real zeros and skips missing and out-of-window values', () => {
  const points = decodeCoinRows([
    { asset: 'btc', time: '2026-11-20T00:00:00Z', BlkCnt: '0' },
    { asset: 'btc', time: '2026-11-21T00:00:00Z', BlkCnt: null },
    { asset: 'btc', time: '2026-11-22T00:00:00Z', BlkCnt: '150' },
  ], [['btc','network:btc','blocks']], 'blocks', '2026-11-20', '2026-11-21', '2026-11-23T10:00:00Z')
  assert.deepEqual(points.map(p => [p.day, p.value]), [['2026-11-20',0]])
})

test('exchange custody share uses same-row stock and omits invalid denominators', () => {
  const points = decodeCoinRows([
    { asset: 'btc', time: '2026-11-20T00:00:00Z', SplyExNtv: '20', SplyCur: '80' },
    { asset: 'btc', time: '2026-11-21T00:00:00Z', SplyExNtv: '20', SplyCur: '0' },
    { asset: 'btc', time: '2026-11-22T00:00:00Z', SplyExNtv: '90', SplyCur: '80' },
  ], [['btc','asset:btc','%']], 'exchange-share', '2026-11-20', '2026-11-22', '2026-11-23T10:00:00Z')
  assert.equal(points.length,1)
  assert.equal(points[0].value,25)
})

test('Stellar TTL uses the snapshot ledger, permits same-ledger expiry and skips unavailable keys', () => {
  const points = decodeStellar([
    { key: stellarKeys[0].key, liveUntilLedgerSeq: 901, lastModifiedLedgerSeq: 701 },
    { key: stellarKeys[1].key, liveUntilLedgerSeq: 0, lastModifiedLedgerSeq: 900 },
  ], 901, '2026-11-22T11:10:00Z', '2026-11-22T11:10:07Z')
  assert.deepEqual(points.map(p => [p.metric_id,p.value]), [['stellar-ttl',0],['stellar-write-age',200]])
  assert.equal(points[0].collected_at,'2026-11-22T11:10:07Z')
  assert.equal(closeTimeFromLedgerPrefix('{"sequence":901,"ledgerCloseTime":"1795344000","headerXdr":"...',901),
    new Date(1795344000000).toISOString())
  assert.equal(closeTimeFromLedgerPrefix('{"sequence":901,"ledgerCloseTime":"1795344000",',902),null)
})

test('comparison enforces the scope and denomination', () => {
  const blocks = metricById.get('blocks')!
  assert.equal(compatible(blocks,[coinNetwork('btc'),coinNetwork('eth')],['blocks','blocks']),true)
  assert.equal(compatible(blocks,[coinNetwork('btc'),coinAsset('eth','Ethereum')],['blocks','blocks']),false)
  assert.equal(compatible(metricById.get('issued-supply')!,[coinAsset('btc','Bitcoin'),coinAsset('eth','Ethereum')],['BTC','ETH']),false)
  assert.equal(coinAsset('usdc_eth','USDC on Ethereum').network_id,'eip155:1')
  assert.equal(validPublicNode('https://ethereum-rpc.publicnode.com'),true)
  assert.equal(validPublicNode('https://ethereum-rpc.publicnode.com@evil.example'),false)
})

test('community planning excludes overlapping Flow aggregate and keeps supply on the asset', () => {
  const planned = coinPlan(new Map([['BlkCnt',['btc','flow','flow_native','flow_evm']],['SplyCur',['btc','usdc_eth']]]),100)
  const get = (metric: string) => planned.shards.find(job => job.payload.metric === metric)?.payload.targets.map(target => target[1])
  assert.deepEqual(get('blocks'),['network:btc','eip155:747','network:flow'])
  assert.deepEqual(get('issued-supply'),['asset:btc','asset:usdc_eth'])
  assert.equal(retryDelay(3,100),100 + 32 * 60_000)
  assert.equal(retryDelay(0,100,500_000),500_100)
})

test('archive replay is idempotent, records newer revisions and keeps valid coverage', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../migrations/0001_archive.sql',import.meta.url),'utf8'))
  const subject = coinNetwork('btc')
  const entity = putEntities([subject])
  db.prepare(entity.sql).run(...entity.args)
  const sample: Point = {
    entity_id: subject.id, metric_id: 'blocks', day: '2026-11-22', value: 144,
    unit: 'blocks', observed_at: '2026-11-22T00:00:00.000Z', collected_at: '2026-11-23T00:00:00.000Z', context: null,
  }
  const persist = (rows: Point[]) => {
    db.exec('BEGIN')
    for (const statement of pointStatements(rows)) db.prepare(statement.sql).run(...statement.args)
    db.exec('COMMIT')
  }
  persist([sample])
  persist([sample])
  persist([{...sample,value:143,collected_at:'2026-11-23T03:00:00.000Z'}])
  persist([{...sample,value:141,collected_at:'2026-11-23T01:00:00.000Z'}])
  persist([])
  assert.equal(db.prepare('SELECT count(*) AS n FROM observations').get()?.n,1)
  assert.equal(db.prepare('SELECT revision FROM observations').get()?.revision,2)
  assert.equal(db.prepare('SELECT last_value FROM coverage').get()?.last_value,143)
  db.close()
})
