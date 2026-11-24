import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { catalogWithGaps, hostLayer, matchMatrix, matrixCsv, observation, relativeChange, type MatrixFilters } from '../src/atlas/matrix-model'
import { commonIndicators, type ResearchSnapshot } from '../src/atlas/study-types'

const frozen = JSON.parse(readFileSync('public/atlas/study-frozen.json','utf8')) as ResearchSnapshot
const current = JSON.parse(readFileSync('public/atlas/study-current.json','utf8')) as ResearchSnapshot
const six: MatrixFilters = {indicators:commonIndicators,mode:'complete',scope:'',query:''}
test('the frozen paper intersections count IDs with actual pairs',()=>{
  assert.equal(matchMatrix(frozen,six).length,75)
  assert.equal(matchMatrix(frozen,{...six,indicators:[...commonIndicators,'blocks']}).length,17)
  assert.deepEqual(matchMatrix(frozen,{...six,indicators:[...commonIndicators,'exchangeShare']}),['btc','eth'])
  assert.equal(matchMatrix(frozen,{...six,indicators:['ledgerBytes']}).length,0)
})
test('scopes, gaps and zero are distinct, and filtered exports preserve the visible population',()=>{
  const ids=matchMatrix(frozen,{...six,query:'L1',scope:'token_deployment',mode:'partial'})
  assert.ok(ids.includes('usdc_eth'))
  assert.ok(!ids.includes('usdc'))
  assert.equal(hostLayer(frozen.assets.usdc_eth),'L1')
  assert.equal(observation(frozen.assets.usdc_eth,'latest','blocks').status,'not_applicable')
  assert.equal(observation(frozen.assets.lpt,'baseline','transactions').status,'incomplete')
  assert.deepEqual(relativeChange({status:'zero_observed',value:0},{status:'observed',value:1}),{status:'zeroBase',value:null})
  const lines=matrixCsv(frozen,ids,six.indicators).trim().split('\r\n').slice(1)
  const actual=[...new Set(lines.map(row=>row.split('","')[0].slice(1)))]
  assert.deepEqual(actual,ids)
  assert.equal(lines.length,ids.length*six.indicators.length*2)
})
test('current catalog audit retains price-only IDs without granting on-chain eligibility',()=>{
  const audited=catalogWithGaps(current)
  const sol=audited.assets.sol
  assert.equal(sol.latest.transactions?.status,'not_public')
  assert.ok(!matchMatrix(audited,six).includes('sol'))
  assert.ok(matchMatrix(audited,{...six,mode:'audit',query:'sol'}).includes('sol'))
})
