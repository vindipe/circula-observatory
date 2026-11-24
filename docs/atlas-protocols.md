# Rules, resources and interpretation

The dashboard discloses the resource, the protocol or client behaviour, the relevant date and the observable to which the rule applies. A publication date for an optional client feature identifies when that feature was available, not a network-wide change in retention.

| Resource | Applicable date | What the observation captures | Source |
| --- | --- | --- | --- |
| Bitcoin output | From the mainnet genesis block, 3 January 2009 | An input spends a previously unspent output when its script conditions are met. The Bitview cohorts assign age to each output, including self-transfers. | [Bitcoin Developer Guide](https://developer.bitcoin.org/devguide/transactions.html), [genesis parameters](https://github.com/bitcoin/bitcoin/blob/master/src/kernel/chainparams.cpp) |
| Ethereum transaction and contract receipt | Frontier genesis, 30 July 2015 | Ethereum is the chain of record for Ethereum token deployments. One execution can emit several transfers. The host block history belongs to Ethereum. Each deployment has its own inception and contract-level validity conditions. | [Ethereum history](https://ethereum.org/ethereum-forks/#frontier), [ERC-20](https://eips.ethereum.org/EIPS/eip-20) |
| Ethereum historical execution data on a node | Client support documented 8 July 2025 | Execution clients can discard pre-Merge block history. Current balances and contract state remain available. Disk use depends on client, indexes and configuration. | [Ethereum Foundation](https://blog.ethereum.org/2025/07/08/partial-history-exp) |
| Soroban contract state | Protocol 20 mainnet, 20 February 2024 | Last-live ledger is inclusive. TTL can be extended. Temporary data may be recreated after expiry. Persistent data and contract code support restoration. | [Upgrade date](https://stellar.org/blog/developers/protocol-20-upgrade-guide), [CAP-0046-12](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-12.md) |
| Archived Soroban state | Protocol 23 mainnet, 3 September 2025 | Evicted persistent entries move to the archive. Invocations can automatically restore eligible entries. The observed timeline distinguishes retirement from live state, explicit restoration metadata and TTL extension. | [Mainnet dates](https://stellar.org/protocol-upgrades), [CAP-0062](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0062.md), [CAP-0066](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0066.md) |

Two dated snapshots describe outcomes under observed conditions. To estimate the effect of a rule, identify variation in effective rules or configurations, specify comparable observation units with a defensible counterfactual, and address custody, issuance, asset migration, address reuse and measurement changes. A transfer count does not identify unique users or the age of funds. In Stellar the sampling gaps also preclude tracking a key's survival across every intervening ledger.

## Proposal lineage and public access

Section 1.2, “Default persistence and its frictions,” in the SNSF research plan (proposal 10010141) relates infrastructure growth to holdings-side indicators. Its period runs from end-2018 to end-2025. Its conceptual definitions motivate this site. The frozen paper edition compares end-2019 to end-2025 and has its own public-source snapshot. The proposal's raw data and DLT 2025 PRO exports are outside the published source path.

In the proposal the one-day dormant quantity is `SplyCur − SplyAct1d` in native units. A one-year stock estimate would require `SplyCur − SplyAct1yr`. One-year gross revival requires daily `SplyRvv1yr` summed over a complete flow window with the same age definition. The stock changes as units cross the age threshold as well as when they move. In UTXO systems Coin Metrics measures output age; on account systems it applies account-activity definitions including outgoing native movements and qualifying account creation. This makes unrestricted comparisons across accounting models misleading. Bitview's Bitcoin cohort series under separate metric IDs use output creation and spending for 1, 90 and 365 elapsed days. [Active supply](https://docs.coinmetrics.io/network-data/network-data-overview/supply/active-supply) · [Revived supply](https://docs.coinmetrics.io/network-data/network-data-overview/supply/revived-supply) · [Bitview series](holdings.md)

On 24 November 2026 an unauthenticated GET against Community `catalog-v2/asset-metrics` returned HTTP 200 and an empty data array for each of `UTXOCnt`, `ContCnt`, `SplyAct1d`, `SplyAct1yr` and `SplyRvv1yr`. The same catalog returned 139 IDs for `SplyCur`. The following real daily requests used the two cutoff parameters set to 2025-12-31. [Catalog](https://community-api.coinmetrics.io/v4/catalog-v2/asset-metrics?metrics=SplyAct1yr)

| Input and ID | Response to the keyless timeseries request |
| --- | --- |
| SplyAct1d · btc, SplyAct1yr · eth, UTXOCnt · btc, ContCnt · eth | HTTP 403. Provider denied access at daily frequency with the credentials supplied. |
| SplyRvv1yr · usdc_eth | HTTP 400. Provider reports this metric unsupported for the deployment at daily frequency. |
| SplyCur · btc | HTTP 200. One row of 19,969,701.1599654 BTC. |

The catalogue does not supply a comparable network-wide contract count, live contract-state entry count or byte series in this edition. The atlas separately publishes a specific Bitcoin UTXO count and sampled Stellar entry changes. Observations of Stellar evictions cannot establish the entire live-state stock.

The DLT 2025 study examines a different period and uses different grouping and data access. Its numbers are excluded from the public snapshots and export. [Di Perna, Foderaro, Fabris and Bernardo, *An Entropy-Based Approach to Evaluating the Economic Efficiency of Cryptocurrencies*](https://ceur-ws.org/Vol-4105/paper09.pdf)
