import { icon } from './art'
import { en } from './copy'
import { entityPath, esc, ext, heading, link, path } from './html'

interface ResourceCase {
  id: string
  label: string
  subject: string
  icon: string
  rule: string
  steps: { id: string; title: string; description: string }[]
  archive: { label: string; entity: string; metric: string; scope: string } | null
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
    archive: { label: 'Bitcoin blocks added per day', entity: 'network:btc', metric: 'blocks', scope: 'Count of blocks included in the main chain each day.' },
    target: 'Cumulative canonical block bytes (GB) and daily growth (MB/day). The current Community archive has block counts. The block size series needs an additional source.',
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
    archive: { label: 'Addresses holding USDC on Ethereum', entity: 'asset:usdc_eth', metric: 'funded-addresses', scope: 'Count of addresses with a positive balance. Several addresses can belong to the same owner, and a custodian can hold tokens for many owners.' },
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
    archive: null,
    target: 'Age bands for the current UTXO set and share of measured UTXO value older than a selectable threshold. Track the value of old outputs spent as a separate daily flow. Address inactivity needs its own method.',
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
    archive: { label: 'Remaining TTL for the Soroswap router', entity: 'protocol:soroswap', metric: 'stellar-ttl', scope: 'Remaining ledgers for the selected contract-instance key. The sample covers that key’s live state.' },
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
    archive: { label: 'Ethereum execution head', entity: 'eip155:1', metric: 'evm-head', scope: 'Reported head height from a verified endpoint. This measures progress at that endpoint.' },
    target: 'Compare retained block and state bytes for named node configurations. Measure historical RPC success and latency, peer-link interruption and off-chain retrieval success in separate series.',
    methods: [
      { label: 'Bitcoin Core disk measurement', url: 'https://bitcoincore.org/en/doc/30.0.0/rpc/blockchain/getblockchaininfo/' },
      { label: 'Ethereum partial history expiry', url: 'https://blog.ethereum.org/2025/07/08/partial-history-exp' },
      { label: 'IPFS persistence', url: 'https://docs.ipfs.tech/concepts/persistence/' },
    ],
  },
]

const researchPath = (resource: string, stage?: string) => path('/research', { resource, stage })

export function research(params: URLSearchParams) {
  const resource = cases.find(item => item.id === params.get('resource')) ?? cases[0]
  const step = resource.steps.find(item => item.id === params.get('stage')) ?? resource.steps[0]
  const available = resource.archive
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

  return heading('Research question', en.researchQuestion,
    'Choose a resource, follow its lifecycle and see what the archive can measure.')
    + '<nav class="research-choices" aria-label="Resource to study">' + resources + '</nav>'
    + '<section class="panel research-example" id="resource-example" aria-labelledby="resource-name">'
    + '<div class="research-rule"><span class="research-object">' + icon(resource.icon, 26)
    + '</span><div><p class="kicker">Documented lifecycle</p><h2 id="resource-name">' + esc(resource.subject)
    + '</h2><p>' + esc(resource.rule) + '</p></div></div>'
    + '<nav class="research-stages" aria-label="Lifecycle stages"><ol>' + stages + '</ol></nav>'
    + '<div id="stage-detail" class="research-stage-detail"><h3>' + esc(step.title) + '</h3><p>' + esc(step.description) + '</p></div>'
    + '</section><div class="research-observations">'
    + '<section class="panel research-evidence"><p class="kicker">' + (available ? 'In the archive' : 'Coverage') + '</p>'
    + (available ? '<h3>' + esc(available.label) + '</h3><p>' + esc(available.scope) + '</p>'
      + link(entityPath(available.entity, available.metric), 'View observations ' + icon('arrow', 16), 'text-link')
      : '<h3>Dormancy series pending</h3><p>The archive needs a UTXO age dataset before it can show how long value has stayed unspent.</p>')
    + '</section><section class="panel research-evidence"><p class="kicker">Proposed measurement</p>'
    + '<h3>What to measure next</h3><p>' + esc(resource.target) + '</p></section></div>'
    + '<div class="research-method"><p>These observations can reveal patterns associated with persistence. Estimating a causal effect requires a comparable change in policy or a controlled experiment.</p>'
    + '<nav class="row" aria-label="Sources for this resource">' + resource.methods.map(method => ext(method.url, method.label)).join('') + '</nav></div>'
}
