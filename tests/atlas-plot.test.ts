import test from 'node:test'
import assert from 'node:assert/strict'
import { compatibleSeries, plotCSV, plotRows, type AtlasSeries } from '../src/atlas/plot'

function track(asset: string, points: AtlasSeries['points']): AtlasSeries {
  return {asset,name:asset,network:asset,metric:'test-flow',label:'Test flow',unit:'counts',kind:'flow',scope:'test only',method:'sum',source:'example',sourceUrl:'https://example.org',license:'CC0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',comparison:'flow-test-v1',points,dashboard:'circulation'}
}

test('comparison restricts dates, preserves measured zero and leaves interior gaps',() => {
  const a = track('a',[['2025-11',3],['2025-12',0],['2026-02',9],['2026-03',7]])
  const b = track('b',[['2025-12',40],['2026-01',5],['2026-02',4],['2026-04',2]])
  const rows = plotRows([a,b],'2025-01','2026-02')
  assert.deepEqual(rows,[
    {month:'2025-12',values:[0,40]},
    {month:'2026-01',values:[null,null]},
    {month:'2026-02',values:[9,4]},
  ])
  const lines = plotCSV([a,b],rows,[0]).trim().split('\r\n')
  assert.equal(lines.length,4)
  assert.match(lines[1],/"counts","0","observed"/)
  assert.match(lines[2],/"counts","","missing"/)
  assert.doesNotMatch(lines.join(''),/"b"/)
})
test('rejects differing populations, units or kind even if metric labels match',() => {
  const a = track('a',[['2026-01',2]])
  for (const delta of [{unit:'BTC'},{comparison:null},{comparison:'other'},{kind:'stock'},{metric:'other'}]) {
    assert.equal(compatibleSeries([a,{...a,...delta}]),false)
    assert.deepEqual(plotRows([a,{...a,...delta}]),[])
  }
})
test('filter limits, disjoint time ranges and nonfinite observations',() => {
  const a = track('a',[['2026-01',2],['2026-02',NaN],['2026-03',0.00000003]])
  assert.deepEqual(plotRows([a],'2026-02','2026-02'),[{month:'2026-02',values:[null]}])
  assert.deepEqual(plotRows([a],'2026-03','2026-01'),[])
  assert.deepEqual(plotRows([a,track('b',[['2025-01',3]])]),[])
  assert.match(plotCSV([a],plotRows([a],'2026-03'),[0]),/"3e-8"/)
})
