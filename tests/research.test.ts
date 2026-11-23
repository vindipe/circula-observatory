import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  ageChoices, ARRIVALS, blockWindows, COHORT_READS, LAB_DAYS, policies, retentionExperiment, satsToBtc, spentAge,
  type BlockSample, type HoldingsSample, type Policy, type SpentSample, type UtxoSample,
} from '../src/shared/research'

function snapshot<T>(name: string) {
  const data = JSON.parse(readFileSync(new URL('../public/research-data/' + name + '.v1.json', import.meta.url), 'utf8')) as {
    version: number; source: { collectedAt: string; verification?: { height: number; hash: string; bytes: number }[] }; rows: T[]
  }
  assert.equal(data.version, 1)
  assert.ok(Number.isFinite(Date.parse(data.source.collectedAt)))
  return data
}

function assertDaily(rows: [string, ...unknown[]][], start: string, end: string) {
  assert.equal(rows[0][0], start)
  assert.equal(rows.at(-1)![0], end)
  rows.forEach(([day], i) => assert.equal(Date.parse(day), Date.parse(start) + i * 86_400_000))
}

test('canonical block groups reproduce the exact addition over both full and shorter windows', () => {
  const data = snapshot<BlockSample>('bitcoin-bytes')
  assert.equal(data.rows.length, 1005)
  for (const [i, row] of data.rows.entries()) {
    assert.equal(row[0], 974_000 + i)
    assert.match(row[3], /^[a-f0-9]{64}$/)
    assert.ok(Number.isInteger(row[2]) && row[2] > 80)
    if (i) assert.equal(row[4], data.rows[i - 1][3])
  }
  assert.equal(data.source.verification?.length, 3)
  for (const verified of data.source.verification!) {
    assert.deepEqual([verified.bytes, verified.hash], data.rows[verified.height - 974_000].slice(2, 4))
  }
  const full = blockWindows(data.rows, 1005)
  assert.equal(full.length, 67)
  assert.equal(full.at(-1)?.cumulative, 1_738_421_996)
  const recent = blockWindows(data.rows, 75)
  assert.equal(recent.length, 5)
  assert.equal(recent[0].from, 974_930)
  assert.equal(recent[0].cumulative, recent[0].bytes)
  assert.equal(recent.at(-1)?.cumulative, full.at(-1)!.cumulative - full.at(-6)!.cumulative)
})

test('the age threshold subsets spent value and keeps exact satoshis', () => {
  const { rows } = snapshot<SpentSample>('bitcoin-spent-age')
  assertDaily(rows, '2024-01-01', '2026-06-19')
  for (const row of rows) {
    assert.ok(row.slice(1).every(n => Number.isSafeInteger(n) && Number(n) >= 0))
    for (const [i, age] of ageChoices.entries()) {
      const sample = spentAge(row, age)
      assert.ok(sample.sats <= Number(row[1 + i]))
      assert.equal(sample.share, sample.sats / row[1])
    }
  }
  assert.deepEqual(spentAge(['2026-01-01', 100, 50, 25, 8, 1], '10'), { sats: 1, share: .01 })
  assert.equal(spentAge(['2026-01-01', 0, 0, 0, 0, 0], '10').share, null)
  assert.equal(satsToBtc(1), '0.00000001')
  assert.equal(satsToBtc(53_011_540_000_158), '530115.40000158')
})

test('daily stock snapshots have distinct units and preserve USDC precision', () => {
  const outputs = snapshot<UtxoSample>('bitcoin-utxo').rows
  const holdings = snapshot<HoldingsSample>('ethereum-usdc').rows
  assertDaily(outputs, '2024-01-01', '2026-06-19')
  assertDaily(holdings, '2026-05-27', '2026-11-22')
  assert.ok(outputs.every(row => Number.isSafeInteger(row[1]) && row[1] > 0))
  assert.ok(holdings.every(row => Number.isSafeInteger(row[1]) && row[1] > 0 && /^\d+(\.\d+)?$/.test(row[2])))
  assert.deepEqual(outputs.at(-1), ['2026-06-19', 165_851_039])
  assert.deepEqual(holdings.at(-1), ['2026-11-22', 9_227_373, '44280748483.517836'])
})

// Event-by-event implementation independent of the UI's cohort equations.
function runByEntry(policy: Policy, ttl: number, readAge: number) {
  type Entry = { state: 'active' | 'archived' | 'removed'; born: number; expiry: number; getsRead: boolean }
  const entries: Entry[] = []
  let reads = 0, misses = 0, restored = 0
  return Array.from({ length: LAB_DAYS + 1 }, (_, day) => {
    for (const entry of entries) {
      if (entry.state === 'active' && entry.expiry <= day) entry.state = policy === 'archive' ? 'archived' : 'removed'
      if (!entry.getsRead || day !== entry.born + readAge) continue
      reads++
      if (entry.state === 'removed') misses++
      if (entry.state === 'archived') {
        entry.state = 'active'
        entry.expiry = day + ttl
        restored++
      }
    }
    if (day) for (let i = 0; i < ARRIVALS; i++) entries.push({
      state: 'active', born: day, expiry: policy === 'keep' ? Infinity : day + ttl, getsRead: i < COHORT_READS,
    })
    return { active: entries.filter(x => x.state === 'active').length, archived: entries.filter(x => x.state === 'archived').length,
      removed: entries.filter(x => x.state === 'removed').length, reads, restored, misses }
  })
}

test('cohort equations match an independent simulation at and around expiry', () => {
  for (const [ttl, read] of [[7, 7], [7, 56], [21, 28], [28, 28], [29, 28], [56, 7], [56, 56]]) {
    const result = retentionExperiment(ttl, read)
    for (const policy of policies) assert.deepEqual(result.map(row => row.outcomes[policy]), runByEntry(policy, ttl, read))
    for (const row of result) for (const policy of policies) {
      const outcome = row.outcomes[policy]
      assert.equal(outcome.active + outcome.archived + outcome.removed, row.created)
      assert.ok(outcome.restored + outcome.misses <= outcome.reads)
    }
  }
  const sameDay = retentionExperiment(28, 28)[29].outcomes
  assert.equal(sameDay.remove.misses, 3)
  assert.equal(sameDay.archive.restored, 3)
  assert.equal(retentionExperiment(29, 28)[29].outcomes.remove.misses, 0)
})
