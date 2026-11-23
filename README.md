# CIRCULA Observatory

Explore how digital resources accumulate, persist, circulate and expire.

The Observatory is an independent CIRCULA research prototype. Its public catalog combines EVM networks, Coin Metrics assets, tracked Stellar protocols and selected Wikimedia projects. The Explorer starts with subjects that have recorded observations. The full catalog includes subjects that have only reference metadata.

- [Public Observatory](https://circula-observatory.vincenzopaolo-diperna.workers.dev/)
- [Research question and interactive study design](docs/research-design.md)
- [Source selection, scope and data licenses](docs/sources.md)
- [Public API and downloads](docs/api.md)
- [Adding a controlled node adapter](docs/node-adapters.md)

## Run locally

Use Node.js 22.16 or newer and npm.

```sh
npm ci
npm run check
npm test
npm run db:local
npm run build
npm run preview
```

Open http://127.0.0.1:8787. For hot-reload, keep Wrangler running and start `npm run dev` in another terminal. Vite proxies the archive API to Wrangler.

For an initial history from upstream providers, run the following commands in another terminal. The bootstrap imports the complete reference catalogs, compatible Community daily history within the requested window and current snapshots from reachable sources. It saves the actual collection timestamps. Unavailable providers are recorded as failed bootstrap probes.

```sh
npm run seed -- --days=54
npx wrangler d1 execute DB --local --file .cache/bootstrap.sql
```

To exercise a collector locally, start Wrangler with a local `INGEST_TOKEN` in `.dev.vars` and use the authenticated manual invocation described below with the loopback URL. The run will be labelled `manual`.

## Deploy on Cloudflare

The production project uses a single Worker, Workers Static Assets and one D1 database. Public page or API requests read the archive. When enabled, a Cron Trigger acquires the next due collector with a database lease. The scheduler runs on an empty site and backfills the first 42 days of available daily observations per shard. Initial population takes multiple runs.

1. For a fork, create a dedicated D1 database with `npx wrangler d1 create circula-observatory` and set its returned ID and your desired Worker name in `wrangler.jsonc`. The checked-in ID binds this project's production database.
2. Sign in via Wrangler or provide the environment variables in [the example](.env.example) through a secret store. The operator needs Worker deployment and D1 write permissions for the selected account.
3. Apply schema migrations with `npm run db:remote`.
4. Run `npm run deploy`. For Workers Builds, use the root directory, `npm run build` and `npx wrangler deploy`, with preview builds disabled unless an independent preview database is configured.
5. Open `/api/v1/status`. A genuine Cloudflare invocation appears with `trigger=scheduled` and the UTC `scheduled_at` supplied by Cloudflare. A bootstrap import or manual run is labelled separately. Cron changes can take up to 15 minutes to propagate.

An optional authenticated manual invocation can be enabled using `npx wrangler secret put INGEST_TOKEN`. With the token held in your shell secret environment:

```sh
curl -fsS -X POST -H "Authorization: Bearer $INGEST_TOKEN" \
  'https://YOUR-WORKER.workers.dev/api/internal/collect?job=stellar-contracts'
```

This returns HTTP 202 for an accepted attempt. Check the status endpoint for its actual outcome. The route is disabled without the secret. A running job lease suppresses a concurrent duplicate invocation.

## Operate the archive

Production collection is paused via `COLLECTION_PAUSED=true` and an empty `triggers.crons` array in `wrangler.jsonc`. The application guard skips scheduled and authenticated manual jobs before they access D1. The public archive and Research view remain available.

Before resuming collection, review D1's Row Metrics and distinguish account-wide reads from writes. Successful collector logs include `batch_rows_read` and `batch_rows_written` for the D1 archive batch and `observations` for points received. Spread historical imports across available quota and reserve headroom for public reads. Set an appropriate cron cadence and remove the pause flag in the same deploy. Check the first scheduled runs and the database's daily quota after resuming.

Coin Metrics and Wikimedia refresh daily with a seven-day revision lookback. EVM and Solana snapshot collectors run daily. Stellar samples every six hours, retaining the last accepted snapshot per UTC day. EVM and Coin Metrics metadata refresh approximately weekly. Coin Metrics metadata scans resume by cursor on successive runs.

Upstream calls have deadlines and bounded retries. Failed jobs use exponential backoff. An archive record is unique by subject, metric and UTC day. Confirmed updates replace older observations of that day and increment the revision. Measurements stay available during outages. The status view records collection outcomes, per-source lag, failed jobs and recent execution outcomes. Native-unit stocks, labeled flow estimates and physical node measurements each require distinct definitions.

The design targets the Cloudflare Free limits of 100,000 Worker requests per day and D1 limits of 5 million rows read, 100,000 rows written per day and 500 MB per database. Static illustration and UI requests use Workers Static Assets. There are no paid data dependencies or R2 resources. Check [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) when expanding traffic or retention.

## Verify

```sh
npm run check
npm test
npm run build
npx wrangler deploy --dry-run
npx playwright install chromium
OBSERVATORY_URL=http://127.0.0.1:8787 npm run test:browser
```

The browser suite requires a seeded archive. It runs against the same public routes on a deployed Worker. Set `CHROMIUM_PATH` to use an existing Chromium executable.

Code and original graphics are MIT licensed. Source datasets retain their own terms. Coin Metrics Community observations are attributed and licensed separately under CC BY-NC 4.0.
