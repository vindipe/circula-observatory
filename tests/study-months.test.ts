import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { monthCell, monthlyPair, type StudyMonths } from '../src/atlas/study-months'
import { studyIndicators, type ResearchSnapshot } from '../src/atlas/study-types'

const snapshot: ResearchSnapshot = JSON.parse(readFileSync('public/atlas/study-current.json','utf8'))
const monthly: StudyMonths = JSON.parse(readFileSync('public/atlas/study-series.json','utf8'))

test('custom dates reproduce every current-pair value, gap status and source price date', () => {
  const custom = monthlyPair(monthly,snapshot,snapshot.baselineUtc,snapshot.cutoffUtc)
  for (const [id, asset] of Object.entries(snapshot.assets)) {
    for (const metric of studyIndicators) for (const side of ['baseline','latest'] as const) {
      const actual = custom.assets[id][side][metric]!
      const expected = asset[side][metric]!
      assert.equal(actual.value,expected.value,`${id}/${metric}/${side}`)
      assert.equal(actual.status,expected.status)
      if (metric === 'exchangeValue' && actual.value !== null) {
        assert.equal(actual.inputs?.priceDateUtc, expected.inputs?.priceDateUtc)
      }
    }
  }
})

test('custom token selection shows host-only block history', () => {
  const date = snapshot.cutoffUtc
  const token = monthCell(monthly,snapshot,'usdc_eth','blocks',date)
  assert.equal(token.status,'not_applicable')
  assert.equal(token.value,null)
  assert.equal(snapshot.assets.usdc_eth.host, 'eth')
  assert.ok((monthCell(monthly,snapshot,'eth','blocks',date).value ?? 0) > 0)
})

test('a 30-day February observation can start in January', () => {
  const floor = monthCell(monthly,snapshot,'btc','inactiveFloor','2024-02-29')
  assert.equal(floor.startUtc, '2024-01-31')
  assert.equal(floor.inputs?.days, 30)
  const funded = Number(floor.inputs?.AdrBalCnt)
  const active = Number(floor.inputs?.AdrActCntSum30d)
  const difference = Math.abs(floor.value! - 100 * Math.max(0,funded-active) / funded)
  assert.ok(difference < 1e-12)
})
