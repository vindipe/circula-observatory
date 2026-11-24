# Stellar contract-state observations

The preview samples Stellar mainnet ledger close metadata from the provider-maintained AWS Public Blockchain Data archive. The registry links its dataset license to MIT-0 and identifies Stellar as the provider. Anonymous GET requests returned the archive configuration and compressed ledger files. The configuration specifies the public-network passphrase, a 64,000-ledger partition and one ledger per compressed object. All acquisition and aggregation runs offline.

- [Dataset registry, provider, citation and license](https://registry.opendata.aws/aws-public-blockchain/)
- [License linked by the registry](https://github.com/aws-solutions-library-samples/guidance-for-digital-assets-on-aws/blob/main/LICENSE)
- [XDR ledger metadata format](https://github.com/stellar/stellar-xdr/blob/master/Stellar-ledger.x)
- [Restoration metadata semantics](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0066.md)
- [Inclusive last-live ledger semantics](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-12.md)

## Sample frame

Each UTC month from August 2026 includes every ledger whose sequence number is divisible by 65,536. Sample inclusion depends only on ledger sequence. Close time comes from the ledger header. A sample before and after the requested window verifies that all scheduled observations have been examined. A missing archive object or unsupported XDR version aborts publication. The acquisition caches compressed raw ledgers outside the deployment, so a retry can reuse its downloads. Each run builds a complete candidate before replacing the output.

The first preview contains 23 sampled ledger closes from 2 August through 30 October 2026. It records 12,000 evictions of temporary contract data and seven observed extensions. The sample contains zero explicit restorations. Event counts are limited to these sampled ledger closes. Network-wide totals and key histories between observations remain unknown. No network total is estimated from the sample.

## Classification

- **Extension** compares TTL records for a key within the same operation. A greater live-until sequence must have an earlier TTL value in that operation. Initial creation alone does not qualify.
- **Eviction** comes from the ledger-close eviction vector. Each contract-data or contract-code key must have a matching TTL key hash in the same vector. Temporary data is removed, while persistent data and code may be archived. Generic deletions inside a transaction are excluded.
- **Restoration** requires the explicit restored change for a TTL entry inside operation metadata. A restore operation request by itself does not establish an observed restoration.
- **Inferred expiry** needs a continuous history that rules out renewal through the last live ledger. The sample cannot support that inference.

An observation identifies one key, ledger and kind. Multiple same-kind changes to a key in a single ledger count once. A known kind and ledger can be retained with an unresolved resource class when the TTL key's underlying contract code or data key is unavailable. SHA-256 of the XDR-encoded LedgerKey supplies the common identifier, consistent with the TTL metadata. Each header's SHA-256 must match its embedded history hash. The last observation is fetched and decoded a second time, and the records must agree exactly.

## Hubble coverage

An unauthenticated request to the BigQuery tables endpoint for `crypto-stellar.crypto_stellar` returned HTTP 401. The SDF connection guide identifies an authenticated project or a limited BigQuery sandbox. No chargeable queries were submitted. The public documentation identifies TTL, eviction and restoration records. Neither network-wide temporal coverage nor a dataset-specific redistribution grant for a Hubble extract was established in this preview.

- [Hubble access](https://developers.stellar.org/docs/data/analytics/hubble/analyst-guide/connecting)
- [TTL records](https://developers.stellar.org/docs/data/analytics/hubble/data-catalog/data-dictionary/bronze/ttl)
- [Evicted keys](https://developers.stellar.org/docs/data/analytics/hubble/data-catalog/data-dictionary/bronze/evicted-keys)
- [Restored keys](https://developers.stellar.org/docs/data/analytics/hubble/data-catalog/data-dictionary/bronze/restored-key)

## Reproduction

Run `python3 scripts/stellar_snapshot.py --through 2026-10 --output /tmp/stellar.json` with Python 3.10+ and Node 24. Set `--cache` to a persistent working directory for repeat runs. The script verifies the pinned official XDR decoder archive using its npm SHA-512 digest. Snapshot rows are deterministic for a fixed end month and source data. The public UI filters the same event rows for timeline counts, table and CSV.
