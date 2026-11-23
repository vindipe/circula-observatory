import { DAY_MS, daysAgo, type Point, type Run, type SourceId } from '../shared/model'
import { applySql, pointStatements } from './archive'
import { coinAsset, coinNetwork, operationalEntities, putEntities, registryStatements, statement, stellarKeys, tokenRelations, type Sql } from './catalog'
import { coinAvailability, coinCatalogPage, coinMetrics, coinSeries, evmSeries, getRegistry, solanaSeries, stellarSeries, UpstreamError, validCoin, wikiSeries, type CoinTarget } from './sources'

const ONE_MINUTE = 60_000

export interface CoinShard { metric: string; targets: CoinTarget[] }
interface Job {
  id: string
  source: SourceId
  cadence_minutes: number
  next_at: number
  failures: number
  last_success: string | null
  payload: string
}
type Trigger = 'manual' | 'scheduled'
type Outcome = {
  statements: Sql[]
  count: number
  status: 'ok' | 'partial'
  note?: string
  next?: number
  payload?: string
}

export function coinPlan(availability: Map<string, string[]>, now: number, names: Map<string, string> = new Map()) {
  const networkCoins = new Set((availability.get('BlkCnt') ?? []).filter(coin => coin !== 'flow'))
  const newNetworks = [...networkCoins].map(coin => coinNetwork(coin, names.get(coin)))
  const assets = new Set<string>()
  const shards: { id: string; payload: CoinShard }[] = []
  for (const metric of coinMetrics) {
    const eligible = [...new Set(availability.get(metric.providerKey!) ?? [])].filter(validCoin).sort()
      .filter(coin => metric.id !== 'exchange-share' || availability.get('SplyCur')?.includes(coin))
    const groups = metric.id === 'blocks' ? eligible.filter(coin => networkCoins.has(coin)) : eligible
    const targets: CoinTarget[] = groups.map(coin => {
      assets.add(coin)
      const chainLevel = metric.category !== 'holdings' && networkCoins.has(coin)
      const entity = chainLevel ? coinNetwork(coin).id : 'asset:' + coin
      const unit = metric.unit === 'asset units' ? coin.split('_')[0].toUpperCase() : metric.unit
      return [coin, entity, unit]
    })
    for (let first = 0; first < targets.length; first += 12) {
      shards.push({ id: 'coin-series:' + metric.id + ':' + (first / 12), payload: { metric: metric.id, targets: targets.slice(first, first + 12) } })
    }
  }
  const assetEntries = [...assets].map(coin => coinAsset(coin, names.get(coin) ?? coin.toUpperCase()))
  // Refresh metadata through the reference catalog. Missing names should only
  // be used when inserting newly covered assets, never overwrite a real name.
  const placeholderAssets = putEntities(assetEntries)
  if (!names.size) placeholderAssets.sql = placeholderAssets.sql.slice(0, placeholderAssets.sql.indexOf('ON CONFLICT')) + 'ON CONFLICT(id) DO NOTHING'
  return {
    shards,
    statements: [
      putEntities([...operationalEntities, ...newNetworks.filter(network => !operationalEntities.some(e => e.id === network.id))]),
      placeholderAssets,
      tokenRelations(assetEntries),
      statement(`
        INSERT INTO jobs (id,source,payload,cadence_minutes,next_at)
        SELECT value->>0,'coin',value->>1,1440,? FROM json_each(?) WHERE 1
        ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, enabled=1,
          next_at=CASE WHEN jobs.enabled=0 THEN excluded.next_at ELSE jobs.next_at END
        WHERE jobs.payload <> excluded.payload OR jobs.enabled=0
      `, now, JSON.stringify(shards.map(shard => [shard.id, JSON.stringify(shard.payload)]))),
      statement(`
        UPDATE jobs SET enabled=0 WHERE enabled=1 AND id GLOB 'coin-series:*'
          AND id NOT IN (SELECT value FROM json_each(?))
      `, JSON.stringify(shards.map(shard => shard.id))),
    ],
  }
}

function observed(points: Point[], note?: string): Outcome {
  return {
    statements: points.length ? pointStatements(points) : [],
    count: points.length,
    status: note || !points.length ? 'partial' : 'ok',
    note: note ?? (points.length ? undefined : 'The upstream returned no valid observations in this window.'),
  }
}

async function collect(job: Job, now: number): Promise<Outcome> {
  const payload = JSON.parse(job.payload) as Record<string, string>
  if (job.id === 'coin-plan') {
    const availability = await coinAvailability()
    const updated = coinPlan(availability, now)
    return { statements: updated.statements, count: 0, status: 'ok', note: updated.shards.length + ' compatible metric shards configured.' }
  }
  if (job.id === 'coin-catalog') {
    const response = await coinCatalogPage(payload.cursor)
    const assets = response.data.filter(row => validCoin(row.asset) && row.full_name)
      .map(row => coinAsset(row.asset, row.full_name))
    return {
      statements: [putEntities(assets), tokenRelations(assets)],
      count: 0,
      status: 'ok',
      note: assets.length + ' asset records checked.' + (response.next_page_token ? ' Catalog scan in progress.' : ' Catalog scan complete.'),
      next: response.next_page_token ? now + ONE_MINUTE : undefined,
      payload: JSON.stringify(response.next_page_token ? { cursor: response.next_page_token } : {}),
    }
  }
  if (job.id === 'evm-registry') {
    const raw = await getRegistry()
    return { statements: registryStatements(raw, now), count: 0, status: 'ok', note: 'Registry synced by EIP-155 identity.' }
  }
  if (job.id === 'stellar-contracts') {
    const points = await stellarSeries()
    const tracked = points.filter(point => point.metric_id === 'stellar-ttl').length
    return observed(points, tracked < stellarKeys.length ? tracked + ' of ' + stellarKeys.length + ' tracked instance keys returned a live TTL.' : undefined)
  }
  if (job.id === 'solana-supply') return observed(await solanaSeries())
  if (job.source === 'evm-rpc') return observed(await evmSeries(payload.entity, payload.endpoint))
  const firstWindow = job.last_success ? 7 : 42
  const from = daysAgo(firstWindow, now)
  const to = daysAgo(1, now)
  if (job.source === 'wikimedia') return observed(await wikiSeries(payload.entity, payload.project, from, to))
  if (job.id.startsWith('coin-series:')) {
    const shard = JSON.parse(job.payload) as CoinShard
    return observed(await coinSeries(shard.metric, shard.targets, from, to))
  }
  throw new Error('Unknown collector job')
}

export function retryDelay(failures: number, now: number, retryAfter = 0) {
  const delay = Math.min(12 * 60, 4 * 2 ** Math.min(failures, 8)) * ONE_MINUTE
  return now + Math.max(delay, retryAfter)
}

export async function tick(db: D1Database, trigger: Trigger, scheduledAt?: number, requested?: string): Promise<Run | null> {
  const now = Date.now()
  const lease = crypto.randomUUID()
  const job = await db.prepare(`
    UPDATE jobs SET lease=?, leased_until=?
    WHERE id=(SELECT id FROM jobs WHERE enabled=1 AND leased_until <= ?
      AND ((? IS NULL AND next_at <= ?) OR id=?)
      ORDER BY next_at,id LIMIT 1)
    RETURNING *
  `).bind(lease, now + 120_000, now, requested ?? null, now, requested ?? null).first<Job>()
  if (!job) return null

  const base: Omit<Run, 'status' | 'row_count' | 'note' | 'finished_at'> = {
    job_id: job.id, source: job.source, trigger,
    scheduled_at: scheduledAt == null ? null : new Date(scheduledAt).toISOString(),
    started_at: new Date(now).toISOString(),
  }
  const log = (run: Run) => statement(`
    INSERT INTO runs(job_id,source,trigger,scheduled_at,started_at,finished_at,status,row_count,note)
    VALUES (?,?,?,?,?,?,?,?,?)
  `, run.job_id, run.source, run.trigger, run.scheduled_at, run.started_at, run.finished_at, run.status, run.row_count, run.note)
  try {
    const outcome = await collect(job, now)
    const run: Run = {
      ...base, status: outcome.status, row_count: outcome.count, note: outcome.note ?? null, finished_at: new Date().toISOString(),
    }
    const next = outcome.next ?? now + job.cadence_minutes * ONE_MINUTE
    await applySql(db, [
      ...outcome.statements,
      statement(`
        UPDATE jobs SET leased_until=0,lease=NULL,failures=0,next_at=?,payload=?,last_success=? WHERE id=? AND lease=?
      `, next, outcome.payload ?? job.payload, run.finished_at, job.id, lease),
      log(run),
    ])
    console.log(JSON.stringify({ collector: run.job_id, trigger, status: run.status, observations: run.row_count, scheduled_at: run.scheduled_at }))
    return run
  } catch (error) {
    const run: Run = {
      ...base, status: 'error', row_count: 0, finished_at: new Date().toISOString(),
      note: error instanceof UpstreamError ? error.message : 'Collector or archive write failed.',
    }
    const retryAfter = error instanceof UpstreamError ? error.retryAfter : 0
    await applySql(db, [
      statement(`
        UPDATE jobs SET leased_until=0,lease=NULL,failures=failures+1,next_at=? WHERE id=? AND lease=?
      `, retryDelay(job.failures, Date.now(), retryAfter), job.id, lease),
      log(run),
    ])
    console.warn(JSON.stringify({ collector: run.job_id, trigger, status: 'error', message: error instanceof Error ? error.message : 'unknown' }))
    return run
  }
}

export const sourceLagMs: Record<SourceId, number> = {
  coin: 4 * DAY_MS, 'evm-registry': 8 * DAY_MS, stellar: 18 * 3_600_000,
  solana: 2 * DAY_MS, wikimedia: 4 * DAY_MS, 'evm-rpc': 2 * DAY_MS,
}
