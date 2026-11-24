import assert from 'node:assert/strict'
import test from 'node:test'
import { groupedCurve, exactCurve } from '../src/atlas/lorenz'

const bands = [{lowerSats:0,upperSats:200_000_000,label:'0–2 BTC'}, {lowerSats:200_000_000,upperSats:null,label:'≥2 BTC'}]
test('Lorenz sums independent address and BTC shares, including endpoints and correct grouped Gini',() => {
  const result = groupedCurve(bands,{counts:[3,1],btc:[3,9]})
  assert.deepEqual(result?.points,[[0,0],[.75,.25],[1,1]])
  assert.equal(result?.gini,.5)
})
test('a grouped Gini can be zero despite within-band inequality and empty bands are accepted',() => {
  assert.equal(groupedCurve(bands,{counts:[2,0],btc:[3.8,0]})?.gini,0)
})
test('invalid coverage and overlapping classes are unavailable',() => {
  assert.equal(groupedCurve(bands,{counts:[0,0],btc:[0,0]}),null)
  assert.equal(groupedCurve(bands,{counts:[2,0],btc:[2,2]}),null)
  assert.equal(groupedCurve(bands,{counts:[-1,1],btc:[1,2]}),null)
  assert.equal(groupedCurve(bands,{counts:[5],btc:[1]}),null)
  assert.equal(groupedCurve(bands.slice().reverse(),{counts:[2,1],btc:[3,2]}),null)
})

test('exact Lorenz recovers inequality from ties and rejects totals inconsistent with bands',() => {
  const data = {counts:[10],btc:[15],balanceRanks:[[100000000,5],[200000000,5]] as [number,number][]}
  assert.deepEqual(exactCurve(data)?.points,[[0,0],[.5,1/3],[1,1]])
  assert.ok(Math.abs(exactCurve(data)!.gini-1/6)<1e-12)
  assert.equal(exactCurve({...data,counts:[11]}),null)
  assert.equal(exactCurve({...data,btc:[16]}),null)
})
