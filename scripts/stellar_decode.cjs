// Decode a single indexed mainnet ledger. Only resource keys (never contract values) are exported.
const { readFileSync } = require('node:fs')
const { createHash } = require('node:crypto')
const { zstdDecompressSync } = require('node:zlib')
const assert = require('node:assert/strict')
global.self = globalThis
const { xdr } = require(process.argv[2])
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const raw = zstdDecompressSync(readFileSync(process.argv[3]))
const batch = xdr.LedgerCloseMetaBatch.fromXDR(raw.toString('base64'), 'base64')
const sequence = Number(process.argv[4])
assert.equal(batch.startSequence(), sequence)
assert.equal(batch.endSequence(), sequence)
assert.equal(batch.ledgerCloseMeta().length, 1)
const union = batch.ledgerCloseMeta()[0]
assert.equal(union.switch(), 2)
const meta = union.value()
const header = meta.ledgerHeader().header()
assert.equal(header.ledgerSeq(), sequence)
assert.equal(sha256(header.toXDR()), Buffer.from(meta.ledgerHeader().hash()).toString('hex'))
const date = new Date(Number(header.scpValue().closeTime()) * 1000).toISOString().slice(0, 10)
const keyTypes = new Map()
const events = new Map()
const removed = new Set()
const ttlRemoved = new Set()
function record(kind, key) {
  events.set(kind + key, {date, kind, key, ledger: sequence, evidence:'observed'})
}
function register(key) {
  const hash = sha256(key.toXDR())
  if (key.switch().name === 'contractCode') keyTypes.set(hash, 'code')
  else keyTypes.set(hash, key.value().durability().name)
  return hash
}
for (const key of meta.evictedKeys()) {
  if (key.switch().name === 'ttl') ttlRemoved.add(Buffer.from(key.value().keyHash()).toString('hex'))
  else {
    assert.ok(['contractData','contractCode'].includes(key.switch().name))
    const hash = register(key)
    removed.add(hash)
    record('removal', hash)
  }
}
assert.deepEqual(removed, ttlRemoved)
for (const tx of meta.txProcessing()) {
  const apply = tx.txApplyProcessing()
  assert.equal(apply.switch(), 4)
  for (const operation of apply.value().operations()) {
    const before = new Map()
    for (const change of operation.changes()) {
      const action = change.switch().name
      if (action === 'ledgerEntryRemoved') continue
      const data = change.value().data()
      const type = data.switch().name, entry = data.value()
      if (type === 'contractCode') register(xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({hash:entry.hash()})))
      if (type === 'contractData') register(xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
        contract:entry.contract(), key:entry.key(), durability:entry.durability()
      })))
      if (type !== 'ttl') continue
      const hash = Buffer.from(entry.keyHash()).toString('hex')
      const liveUntil = entry.liveUntilLedgerSeq()
      if (action === 'ledgerEntryRestored') record('restoration', hash)
      if (action === 'ledgerEntryUpdated' && before.has(hash) && before.get(hash) < liveUntil) record('extension', hash)
      before.set(hash, liveUntil)
    }
  }
}
const rows = [...events.values()].map(e => ({...e, resource:keyTypes.get(e.key) || 'unresolved'}))
console.log(JSON.stringify({ledger:sequence, date, events:rows, headerHash:sha256(header.toXDR())}))
