import type { Metric, Source } from './model'

const coinBase = {
  source: 'coin',
  evidence: 'Measured',
  compare: 'same-kind',
} as const
const stellarBase = {
  source: 'stellar',
  category: 'contract-state',
  unit: 'ledgers',
  evidence: 'Derived',
  shape: 'Daily snapshot',
  compare: 'cohort',
} as const

export const metrics: Metric[] = [
  {
    ...coinBase, id: 'blocks', name: 'Blocks added', providerKey: 'BlkCnt', perspective: 'accumulate',
    category: 'ledger', unit: 'blocks', shape: 'Daily count',
    definition: 'Count of blocks created during a UTC day and included in the main chain, as indexed by Coin Metrics.',
    limit: 'Compare block counts across networks using the same daily method. Blocks can contain very different amounts of data and work.',
  },
  {
    ...coinBase, id: 'funded-addresses', name: 'Addresses with a balance', providerKey: 'AdrBalCnt', perspective: 'accumulate',
    category: 'holdings', unit: 'addresses', shape: 'End-of-day stock',
    definition: 'Count of unique addresses with a nonzero balance in the observed asset at the end of the UTC day.',
    limit: 'An address can represent an exchange, multiple people, a contract or one person with many addresses. Interpretation depends on asset scope.',
  },
  {
    ...coinBase, id: 'issued-supply', name: 'Visible issued supply', providerKey: 'SplyCur', perspective: 'accumulate',
    category: 'holdings', unit: 'asset units', shape: 'End-of-day stock', compare: 'none',
    definition: 'Sum of units issued and visible on the observed ledger at the end of the UTC day, as counted by Coin Metrics.',
    limit: 'This is the provider’s visible on-ledger supply. Denominations and representations are unique to each asset. An aggregate token and its deployments can overlap.',
  },
  {
    ...coinBase, id: 'issued-daily', name: 'New issuance', providerKey: 'IssTotNtv', perspective: 'accumulate',
    category: 'holdings', unit: 'asset units', shape: 'Daily amount', compare: 'none',
    definition: 'Units newly issued during the UTC day according to the source’s protocol-specific issuance rules.',
    limit: 'The source’s issuance rules differ by protocol. A net supply change also depends on removals and other supply adjustments.',
  },
  {
    ...coinBase, id: 'exchange-share', name: 'Supply held at labelled exchanges', providerKey: 'SplyExNtv',
    perspective: 'accumulate', category: 'holdings', unit: '%', evidence: 'Derived', shape: 'End-of-day stock',
    definition: 'One hundred times the units held at addresses Coin Metrics labels as exchanges divided by that asset’s visible issued supply on the same UTC date.',
    limit: 'This measures one class of custody addresses. Label coverage varies by asset and the result does not identify beneficial owners or the concentration of all holdings.',
  },
  {
    ...coinBase, id: 'transactions', name: 'Recorded transactions', providerKey: 'TxCnt', perspective: 'circulate',
    category: 'ledger', unit: 'transactions', shape: 'Daily count',
    definition: 'Count of transactions recorded in the UTC day within an asset’s per-network or token-specific scope, including failed executions where the source records them.',
    limit: 'A transaction can contain several actions or no value transfer. Keep network totals and token series separate. Batching and failed-operation handling vary by chain.',
  },
  {
    ...coinBase, id: 'transfers', name: 'Transfer events', providerKey: 'TxTfrCnt', perspective: 'circulate',
    category: 'value-flows', unit: 'transfers', shape: 'Daily count',
    definition: 'Count of transfers of native or token units indexed by Coin Metrics over the UTC day. One transaction can contain several transfers.',
    limit: 'Compares event counts from the same methodology. Self-transfers, chain architecture and token deployment scope matter. The count measures neither units moved nor cross-chain flows.',
  },
  {
    ...coinBase, id: 'active-addresses', name: 'Active addresses', providerKey: 'AdrActCnt', perspective: 'circulate',
    category: 'value-flows', unit: 'addresses', shape: 'Daily count',
    definition: 'Count of distinct addresses active as originators or recipients of an indexed ledger change during the UTC day.',
    limit: 'Activity may include multiple addresses per participant. Chain behavior and provider indexing affect which changes are included.',
  },
  {
    ...coinBase, id: 'exchange-inflows', name: 'Exchange inflows', providerKey: 'FlowInExUSD', perspective: 'circulate',
    category: 'value-flows', unit: 'USD', evidence: 'Derived', shape: 'Daily amount',
    definition: 'Daily units transferred to addresses identified by Coin Metrics as exchanges, valued in US dollars by the provider.',
    limit: 'Limited to addresses the provider labels. Includes a valuation step and can reflect exchange wallet management rather than a sale.',
  },
  {
    ...coinBase, id: 'exchange-outflows', name: 'Exchange outflows', providerKey: 'FlowOutExUSD', perspective: 'circulate',
    category: 'value-flows', unit: 'USD', evidence: 'Derived', shape: 'Daily amount',
    definition: 'Daily units transferred from addresses identified by Coin Metrics as exchanges, valued in US dollars by the provider.',
    limit: 'Limited to addresses the provider labels. The value depends on the price used and the asset-specific coverage of exchange wallets.',
  },
  {
    ...stellarBase, id: 'stellar-write-age', name: 'State age since last write', perspective: 'persist',
    definition: 'RPC snapshot ledger sequence minus the stored lastModifiedLedgerSeq for the documented persistent contract-instance entry.',
    limit: 'Counts ledgers, with uneven wall-clock duration. Age starts again when that instance is written. Reads, transaction activity and survival of other entries are outside this cohort.',
  },
  {
    ...stellarBase, id: 'stellar-ttl', name: 'Remaining contract TTL', perspective: 'expire',
    definition: 'The last live ledger sequence (liveUntilLedgerSeq) minus the RPC snapshot ledger sequence. The instance is still live at its last live ledger.',
    limit: 'Measures a live contract-instance key, not the whole protocol. A missing key is unavailable. A larger TTL can indicate an extension or a return to the live set, which this snapshot alone cannot distinguish.',
  },
  {
    id: 'solana-circulating', name: 'Circulating SOL', perspective: 'accumulate', category: 'holdings',
    unit: 'SOL', source: 'solana', evidence: 'Derived', shape: 'Daily snapshot', compare: 'none',
    definition: 'The Solana getSupply circulating field at finalized commitment, divided by one billion lamports per SOL.',
    limit: 'Uses Solana RPC’s non-circulating account rules. Circulating supply is an outstanding stock with a distinct definition from Coin Metrics visible issued supply.',
  },
  {
    id: 'evm-head', name: 'Execution head height', perspective: 'accumulate', category: 'ledger',
    unit: 'height', source: 'evm-rpc', evidence: 'Measured', shape: 'Daily snapshot', compare: 'none',
    definition: 'Head block number reported by the configured PublicNode Ethereum JSON-RPC endpoint when sampled, after checking eth_chainId.',
    limit: 'This is an endpoint’s observed head index and can be revised after reorganization. Genesis numbering and starting heights vary. It carries no byte size or physical storage information.',
  },
  {
    id: 'wiki-views', name: 'Human page views', perspective: 'circulate', category: 'web-traffic',
    unit: 'page views', source: 'wikimedia', evidence: 'Measured', shape: 'Daily count', compare: 'same-kind',
    definition: 'Wikimedia Analytics daily page views classified as human users, for one project and all access methods. HTTP 200 and 304 responses are in scope under Wikimedia’s rules.',
    limit: 'Each project is a defined traditional-system case. Compare Wikimedia projects with the same method. Blockchain transactions and web page views are distinct events.',
  },
]

export const metricById = new Map(metrics.map(metric => [metric.id, metric]))

export const sources: Source[] = [
  {
    id: 'coin', name: 'Coin Metrics Community', documentation: 'https://docs.coinmetrics.io/',
    license: 'CC BY-NC 4.0', terms: 'https://creativecommons.org/licenses/by-nc/4.0/',
    cadence: 'Daily observations · 7-day revision window · weekly metadata',
    note: 'Coin Metrics, Inc. Community data, with attribution and noncommercial reuse only. Provider values are retained in their defined scope and indexed by UTC observation day.',
  },
  {
    id: 'evm-registry', name: 'ethereum-lists/chains', documentation: 'https://github.com/ethereum-lists/chains',
    license: 'MIT', terms: 'https://github.com/ethereum-lists/chains/blob/master/LICENSE',
    cadence: 'Weekly catalog refresh',
    note: 'Open EVM chain metadata. Identities use EIP-155 chain IDs, with network status and provenance kept in the catalog.',
  },
  {
    id: 'evm-rpc', name: 'PublicNode EVM endpoints', documentation: 'https://www.publicnode.com/',
    license: 'Public chain facts', terms: 'https://ethereum.org/en/developers/apis/json-rpc/',
    cadence: 'Daily endpoint snapshots',
    note: 'Publishes observed block numbers derived from public ledger responses. PublicNode’s generic endpoint URLs are matched against the EVM registry.',
  },
  {
    id: 'stellar', name: 'Stellar public RPC & Horizon', documentation: 'https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getLedgerEntries',
    license: 'Public chain facts', terms: 'https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival',
    cadence: 'Every 6 hours · latest sample per UTC day',
    note: 'Public Stellar ledger facts for explicitly selected instance keys. Ledger-close timestamps come from Stellar Horizon or an exact RPC ledger header.',
  },
  {
    id: 'solana', name: 'Solana RPC', documentation: 'https://solana.com/docs/rpc/http/getsupply',
    license: 'Public chain facts', terms: 'https://solana.com/docs/references/clusters',
    cadence: 'Daily finalized supply snapshot',
    note: 'The session’s finalized slot and circulating supply are published as public chain facts derived from getSupply.',
  },
  {
    id: 'wikimedia', name: 'Wikimedia Analytics', documentation: 'https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/',
    license: 'CC0 1.0', terms: 'https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html',
    cadence: 'Daily UTC aggregates · 7-day revision window',
    note: 'English Wikipedia, Wikidata and Wikimedia Commons serve as bounded, comparable traditional-system cases.',
  },
]

export const sourceById = new Map(sources.map(source => [source.id, source]))
