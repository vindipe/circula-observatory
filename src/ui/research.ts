import { icon } from './art'
import { en } from './copy'
import { entityPath, esc, ext, heading, link, path } from './html'
import { researchEvidence } from './research-evidence'
import { researchLab } from './research-lab'
import './research.css'

interface ResourceCase {
  id: string
  label: string
  subject: string
  icon: string
  rule: string
  steps: { id: string; title: string; description: string }[]
  observation: { label: string; href: string; scope: string }
  target: string
  methods: { label: string; url: string }[]
}

const cases: [ResourceCase, ...ResourceCase[]] = [
  {
    id: 'ledger', label: 'Ledger history', subject: 'Bitcoin block', icon: 'accumulate',
    rule: 'A block in the canonical history has no age-based expiry. Node operators choose how much block data to retain locally.',
    steps: [
      { id: 'recorded', title: 'Block recorded', description: 'When a block joins the canonical chain, its serialized bytes contribute to the recorded history.' },
      { id: 'history', title: 'History grows', description: 'Each additional block adds bytes. A cumulative series requires a known starting point, a consistent serialization and adequate coverage.' },
      { id: 'retention', title: 'Node prunes history', description: 'A pruned node can discard old block and undo files. The node’s retention settings determine which past blocks it can still serve.' },
    ],
    observation: { label: 'Serialized bytes added', href: '/research?study=ledger', scope: 'Growth in a canonical Bitcoin history sample of 1,005 blocks.' },
    target: 'Extend the canonical block byte series to a known baseline. Track growth over time and compare node retention modes in controlled installations.',
    methods: [
      { label: 'Coin Metrics block metrics', url: 'https://docs.coinmetrics.io/network-data/network-data-overview/network-usage/blocks' },
      { label: 'Bitcoin Core retention fields', url: 'https://bitcoincore.org/en/doc/30.0.0/rpc/blockchain/getblockchaininfo/' },
    ],
  },
  {
    id: 'holdings', label: 'Holdings', subject: 'USDC on Ethereum', icon: 'chart',
    rule: 'A token balance can persist across blocks. Contract operations determine when that address’s balance changes.',
    steps: [
      { id: 'funded', title: 'Address receives tokens', description: 'At a given block, a funded address is one whose recorded token balance is positive.' },
      { id: 'held', title: 'Balance remains', description: 'A holdings observation records how much sits at an address at a point in time. A balance can stay unchanged across many observations.' },
      { id: 'redistributed', title: 'Distribution changes', description: 'Transfers can redistribute balances across addresses. A time series of distributions can show whether balances become more or less concentrated.' },
    ],
    observation: { label: 'Holdings on Ethereum', href: '/research?study=holdings', scope: 'Supply and addresses with a positive USDC balance. Several addresses can belong to the same owner, and a custodian can hold tokens for many owners.' },
    target: 'Lorenz curve and Gini coefficient from a balance snapshot at a defined block. Include the address population, balance threshold and handling of labelled custodians. Add top-address shares as a separate concentration measure.',
    methods: [
      { label: 'Coin Metrics addresses with balance', url: 'https://docs.coinmetrics.io/network-data/network-data-overview/supply/addresses-with-balance' },
      { label: 'ERC-20 balance and transfer rules', url: 'https://eips.ethereum.org/EIPS/eip-20' },
    ],
  },
  {
    id: 'dormancy', label: 'Dormancy', subject: 'Bitcoin unspent transaction output', icon: 'persist',
    rule: 'An otherwise spendable output can remain unspent indefinitely. Dormancy marks age against a chosen observation threshold.',
    steps: [
      { id: 'created', title: 'Output created', description: 'The creation block gives this UTXO its age reference.' },
      { id: 'aging', title: 'Output ages', description: 'An unspent UTXO crosses a dormancy threshold once it reaches the selected age. Holders’ intentions and key availability are outside the observation.' },
      { id: 'spent', title: 'Output spent', description: 'When a later transaction spends the output, it leaves the unspent set. The spending event can be counted as renewed movement of older value.' },
    ],
    observation: { label: 'Older Bitcoin outputs spent', href: '/research?study=dormancy', scope: 'Daily BTC spent from outputs at or above an age threshold. The age refers to the output when spent.' },
    target: 'Measure the share of currently unspent BTC older than a fixed number of days. Age bands for the whole UTXO set would give the numerator and denominator at the same height. Address inactivity needs its own method.',
    methods: [
      { label: 'Bitcoin transaction outputs', url: 'https://developer.bitcoin.org/devguide/transactions.html' },
      { label: 'Coin Metrics active supply methodology', url: 'https://docs.coinmetrics.io/network-data/network-data-overview/supply' },
    ],
  },
  {
    id: 'state', label: 'Contract state', subject: 'Stellar Soroban instance key', icon: 'expire',
    rule: 'A contract instance has a time to live (TTL), expressed as an ending ledger sequence. A live key can have its TTL extended.',
    steps: [
      { id: 'live', title: 'Instance is live', description: 'The current ledger sequence and the last live ledger define how many ledgers remain before the key leaves live state.' },
      { id: 'archived', title: 'Instance is archived', description: 'When the TTL expires, instance data can move out of live state and be retained for restoration. Temporary storage follows its own expiry rules.' },
      { id: 'restored', title: 'Instance is restored', description: 'A restoration returns an archived instance to live state. A TTL sample observes remaining validity. Event records would be needed to count restorations or distinguish them from renewals.' },
    ],
    observation: { label: 'Remaining TTL for the Soroswap router', href: entityPath('protocol:soroswap', 'stellar-ttl'), scope: 'Remaining ledgers for the selected contract-instance key. The sample covers that key’s live state.' },
    target: 'Extension, archival and restoration event counts by storage class. Align comparisons within the same protocol and tag any changes to storage rules.',
    methods: [
      { label: 'Stellar state archival', url: 'https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival' },
    ],
  },
  {
    id: 'infrastructure', label: 'Nodes and links', subject: 'Node, endpoint and off-chain reference', icon: 'database',
    rule: 'Data availability depends on the nodes that retain and serve it, the network paths that reach them, and any off-chain storage a record refers to.',
    steps: [
      { id: 'stored', title: 'Node retains a copy', description: 'Measure disk usage against a named client, version, retention mode and chain height. State, indexes and block files have different storage scopes.' },
      { id: 'served', title: 'Endpoint serves a request', description: 'A historical request can probe whether a given endpoint serves an object at a given height. Repeat it over time to measure availability and response latency.' },
      { id: 'resolved', title: 'Reference is resolved', description: 'An on-chain record can keep an IPFS reference indefinitely. Fetching the referenced bytes depends on a reachable provider keeping a copy.' },
    ],
    observation: { label: 'Ethereum execution head', href: entityPath('eip155:1', 'evm-head'), scope: 'Reported head height from a verified endpoint. This measures progress at that endpoint.' },
    target: 'Compare retained block and state bytes for named node configurations. Measure historical RPC success and latency, peer-link interruption and off-chain retrieval success in separate series.',
    methods: [
      { label: 'Bitcoin Core disk measurement', url: 'https://bitcoincore.org/en/doc/30.0.0/rpc/blockchain/getblockchaininfo/' },
      { label: 'Ethereum partial history expiry', url: 'https://blog.ethereum.org/2025/07/08/partial-history-exp' },
      { label: 'IPFS persistence', url: 'https://docs.ipfs.tech/concepts/persistence/' },
    ],
  },
]

const researchPath = (resource: string, stage?: string) => path('/research', { resource, stage })

function resourceRules(params: URLSearchParams) {
  const resource = cases.find(item => item.id === params.get('resource')) ?? cases[0]
  const step = resource.steps.find(item => item.id === params.get('stage')) ?? resource.steps[0]
  const observed = resource.observation
  const resources = cases.map(item => link(
    researchPath(item.id) + '#resource-example',
    '<span>' + icon(item.icon, 20) + '</span>' + esc(item.label),
    'research-choice' + (item === resource ? ' selected' : ''),
    item === resource ? 'aria-current="true"' : '',
  )).join('')
  const stages = resource.steps.map(item => '<li>' + link(
    researchPath(resource.id, item.id) + '#stage-detail', esc(item.title), item === step ? 'selected' : '',
    item === step ? 'aria-current="step"' : '',
  ) + '</li>').join('')

  return '<nav class="research-choices" aria-label="Resource to study">' + resources + '</nav>'
    + '<section class="panel research-example" id="resource-example" aria-labelledby="resource-name">'
    + '<div class="research-rule"><span class="research-object">' + icon(resource.icon, 26)
    + '</span><div><p class="kicker">Documented lifecycle</p><h2 id="resource-name">' + esc(resource.subject)
    + '</h2><p>' + esc(resource.rule) + '</p></div></div>'
    + '<nav class="research-stages" aria-label="Lifecycle stages"><ol>' + stages + '</ol></nav>'
    + '<div id="stage-detail" class="research-stage-detail"><h3>' + esc(step.title) + '</h3><p>' + esc(step.description) + '</p></div>'
    + '</section><div class="research-observations">'
    + '<section class="panel research-evidence"><p class="kicker">Observed signal</p>'
    + '<h3>' + esc(observed.label) + '</h3><p>' + esc(observed.scope) + '</p>'
    + link(observed.href, 'View observations ' + icon('arrow', 16), 'text-link')
    + '</section><section class="panel research-evidence"><p class="kicker">Proposed measurement</p>'
    + '<h3>What to measure next</h3><p>' + esc(resource.target) + '</p></section></div>'
    + '<div class="research-method"><p>These observations can reveal patterns associated with persistence. Estimating a causal effect requires a comparable change in policy or a controlled experiment.</p>'
    + '<nav class="row" aria-label="Sources for this resource">' + resource.methods.map(method => ext(method.url, method.label)).join('') + '</nav></div>'
}

export async function research(params: URLSearchParams, signal: AbortSignal) {
  const mode = params.get('mode') === 'lab' ? 'lab' : params.get('mode') === 'rules' || params.has('resource') ? 'rules' : 'evidence'
  const modes = [
    ['evidence', '/research', 'Evidence', 'chart'],
    ['lab', '/research?mode=lab', 'Policy lab', 'expire'],
    ['rules', '/research?mode=rules', 'Resource rules', 'list'],
  ].map(([id, href, label, glyph]) => link(href + '#research-modes', icon(glyph, 17) + ' ' + esc(label),
    'research-mode', id === mode ? 'aria-current="page"' : '')).join('')
  const frame = '<div class="research-heading">' + heading('Persistence study', en.researchQuestion,
    'Track what builds up, stays spendable or moves again on a blockchain.') + '</div>'
    + '<nav class="research-modes" id="research-modes" tabindex="-1" aria-label="Research views">' + modes + '</nav>'
  const view = mode === 'lab' ? researchLab(params) : mode === 'rules' ? { markup: resourceRules(params) } : await researchEvidence(params, signal)
  return { ...view, markup: frame + view.markup }
}
