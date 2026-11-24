# Monthly atlas snapshots

Run the refresh from the repository on Linux or macOS with Python 3.10+ and Node 24+. The script requests the previous completed UTC calendar month. Each series carries its own last observation, including any provider lag. The inputs are public indexed data. Monthly preparation runs outside the Worker and uses no D1 operations.

```sh
python3 scripts/refresh-atlas.py
npm run build
npx wrangler dev --local --config wrangler.atlas-preview.jsonc
```

The first command stages each source under `.cache/atlas-refresh/YYYY-MM/`. Each producer verifies its input before its file becomes a resumable checkpoint. Rerun the same command after an interruption. To retrieve corrected upstream data within the same month, pass e.g. `--retry-source community`. This starts a fresh input cache for that source. Producer code changes invalidate its checkpoint.

The script verifies that all five source documents are present and checks each candidate against the published coverage, including individual months, Stellar sample ledgers and observed event keys, and address distribution bands. Historical value corrections may pass when coverage is preserved and the producer's numerical checks pass. Lags and previously observed zeroes are preserved as distinct states.

A release consists of five files under `public/atlas/releases/<digest>/`. Their content hashes determine the release ID. A single atomic replacement of `public/atlas/current.json` makes the whole set available to the reader. A failed producer or a failed pre-publication check leaves the previous manifest active. Older content-addressed files remain available to readers who already opened them. Concurrent refreshes are locked. On the initial preview, before the first promoted monthly release, the five repository snapshots live directly under `public/atlas/`.

To assemble an isolated candidate from existing verified producer outputs, choose a destination outside the served directory. The example exercises publication locally and is also suitable for CI verification.

```sh
python3 scripts/refresh-atlas.py --from-verified public/atlas --destination .cache/atlas-candidate/atlas
python3 -B scripts/refresh_atlas_test.py
```

The Worker preview configuration serves the Vite asset build and declares no storage bindings, schedules or production routes. Build after promotion so that the manifest and immutable files are packaged together. Keep `.cache/atlas-refresh/` on the offline runner between attempts. A monthly runner can invoke the preparation command after month-end. Hosting the resulting build is a separate release operation.
