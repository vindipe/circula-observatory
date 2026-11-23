# Sources and measurement boundaries

## Integrated sources

| Source | Scope and request checked | Collection | Reuse |
| --- | --- | --- | --- |
| Coin Metrics Community | The keyless `/v4/reference-data/assets`, `/v4/catalog/asset-metrics` and `/v4/timeseries/asset-metrics` responded to test requests. The latter returns HTTP 403 for unsupported asset/metric pairs. Eligibility comes from the Community catalog. | Daily consensus-indexed series with seven days of overlapping revisions. Weekly asset and availability metadata. | Coin Metrics, Inc., [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). The project publishes research observations and same-source derivations for noncommercial reuse with attribution. [Community archive license](https://github.com/coinmetrics/data/blob/master/LICENSE) |
| ethereum-lists/chains | The public chain registry returned EIP-155 metadata. It includes announced, development and retired networks. Exact chain IDs remain strings through SQLite, including large IDs. | Weekly | [MIT](ethereum-lists-LICENSE.txt). Registry data are normalized to a subset of fields. [Upstream](https://github.com/ethereum-lists/chains) |
| PublicNode EVM | Selected HTTPS endpoints published in the registry. Each collection verifies `eth_chainId` and records an observed `eth_blockNumber`. Some endpoints returned 403 or 404 during probing. | Daily per eligible endpoint | Derived public chain facts. The archive stores heights and chain IDs. [Provider](https://www.publicnode.com/) · [RPC protocol](https://ethereum.org/en/developers/apis/json-rpc/) |
| Stellar RPC and Horizon | Keyless `getLedgerEntries` returned live instance TTLs. Horizon and exact `getLedgers` returned ledger close times. Sourced contract IDs refer to the [Soroswap router](https://github.com/soroswap/core) and [Blend V2 backstop](https://docs.blend.capital/mainnet-deployments). | Every six hours. Most recent sample per UTC day. | Public chain facts. Archive retains derived TTL, age, ledger sequence and documented contract identity. [RPC method](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getLedgerEntries) |
| Solana RPC | Keyless `getSupply` returned finalized supply and a context slot on both documented and legacy Solana public mainnet hosts. These rate-limited endpoints provide best-effort snapshots. A tested dRPC endpoint required a paid plan for Solana. | Daily | Derived public chain facts. Tracks circulating SOL under the provider’s documented classification. [getSupply](https://solana.com/docs/rpc/http/getsupply) |
| Wikimedia Analytics | Keyless Pageviews API for English Wikipedia, Wikidata and Wikimedia Commons. Parameters are UTC daily, human-classified users and all access methods. | Daily with seven-day revision overlap. | CC0 1.0. A descriptive user agent identifies the Observatory. [Access policy](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html) |

Coin Metrics Community documents a limit of ten requests in a six-second sliding window. The scheduler uses smaller per-metric shards. The bootstrap spaces requests. Sources that become unreachable retain their last successful observation. EVM snapshots can advance or move backwards after a reorganization. Seven days of overlapping Coin Metrics and Wikimedia requests allow recent source revisions to be incorporated. Historical corrections outside this window can be replayed with the bootstrap command.

## Evaluation of other candidates

| Candidate | Result |
| --- | --- |
| [Stellar Hubble](https://developers.stellar.org/docs/data/analytics/hubble/) | The public dataset documents eviction snapshots with restoration transitions. Unauthenticated BigQuery requests returned 401. A bounded authenticated Hubble query, a confirmed redistribution basis and reconciliation against exact ledger sequences are prerequisites for adding archive and restore event counts. |
| [Dune](https://docs.dune.com/) | A representative results request returned 401. Query execution and export are metered. The prototype has no Dune dependency. |
| [DefiLlama](https://defillama.com/terms) | The protocol endpoint returned JSON. Sections 7 and 8 limit mirroring and republication without permission. No DefiLlama catalog or metrics are shipped. |
| [L2BEAT](https://api.l2beat.com/) | The tested project and activity endpoints required an API key. The MIT code license does not establish a separate API dataset license. |
| [ChainReport node costs](https://chainreport.co/node-cost/) | Studied the documented distinctions between node snapshots, chainstate, estimates and growth. Values are not imported. |
| [mainnet-observer](https://mainnet.observer/) | Studied the organization of transactions, outputs, UTXOs and chain activity. Values are not imported. |

## Interpretation

The catalog preserves source identities instead of merging solely by ticker. Matching EVM network identities use EIP-155. Known native assets and identifiable deployment-specific rows link to their parent networks. Coin Metrics uses indexed source symbols for individual asset scopes. An aggregate token can overlap its deployment rows. Network metrics and their native asset holdings belong to distinct scopes. Flow's aggregate and network-specific sources are not mixed in the block-count comparison.

Current supply is visible issued stock, and issuance measures new units in one UTC day. Circulating SOL follows the RPC circulation definition. The derived exchange custody share measures the tracked class of exchange addresses and uses visible issued supply as denominator. Transfer counts, active addresses and exchange-related USD flows each have separate definitions.

Stellar TTL and state age use the exact snapshot ledger number. Zero remaining ledgers is a valid value for a key still live on the sampled ledger. A missing key or unavailable live-until field creates a gap. A later TTL may result from an extension or restoration. Separate event evidence is necessary to distinguish renewal, expiry, eviction and restoration. Sampling starts at the first successful collection.

Node disk usage, compressed snapshots, relay-layer data propagation and reconstructed bridge flows require their own observations. The prototype does not extrapolate any of these from head heights. Wikimedia views describe activity within defined websites and support matched comparisons among those projects. The prototype contains no simulated observation series.
