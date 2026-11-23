# Controlled node adapters

The archive accepts new measurement definitions and sources through the same pipeline as the RPC adapters.

1. Register a source and a metric in `src/shared/metrics.ts`. Fix the denominator, unit, scope, period, evidence type, redistribution terms and comparison rule before collecting.
2. Add the source adapter in `src/worker/sources.ts` or a sibling module. Return `Point` values, with the observed timestamp from the node or its measurement file and the actual collection timestamp. Resolve canonical subject IDs in `src/worker/catalog.ts`.
3. Register a due job and route it in `src/worker/collect.ts`. Reuse the transactional point and coverage statements. Use an allowlisted endpoint and keep credentials in Worker secrets.
4. For a controlled experiment, retain the client and version, hardware and filesystem, workload, protocol or block range, synchronization state, pruning policy, indexes, and whether the storage figure is apparent size, allocated bytes or a compressed artifact. Run independent repetitions with their setup preserved.

Treat protocol bytes, installed state and compressed snapshots as distinct metrics. If test configurations differ, show the measurements in separate series with their configuration details. For collection that exceeds Worker CPU or storage limits, aggregate measurements on the controlled node and submit bounded aggregates rather than exporting node state to the Worker.
