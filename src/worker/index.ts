import {
  DAY_MS, compatible, dateOnly, daysAgo, perspectives,
  type CatalogEntity, type Coverage, type Entity, type Kind, type Point, type Run, type SourceId,
} from '../shared/model'
import { metricById, metrics, sourceById, sources } from '../shared/metrics'
import { sourceLagMs, tick } from './collect'
import { applySql } from './archive'
import { operationalEntities, putEntities } from './catalog'

interface Env {
  DB: D1Database
  ASSETS: Fetcher
  INGEST_TOKEN?: string
  COLLECTION_PAUSED?: string
}

class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

const entityId = /^[a-z][a-z0-9-]{0,40}:[\p{L}\p{N}_.-]{1,64}$/u
const kinds = ['network', 'asset', 'protocol', 'system'] as const
const headers = {
  'Access-Control-Allow-Origin': '*',
  'X-Content-Type-Options': 'nosniff',
}
const json = (value: unknown, status = 200, ttl = 300) => Response.json(value, {
  status, headers: { ...headers, 'Cache-Control': ttl ? 'public, max-age=' + ttl : 'no-store' },
})
const all = async <T>(stmt: D1PreparedStatement) => (await stmt.all<T>()).results

async function overview(db: D1Database) {
  const [catalogued, measured, featured] = await Promise.all([
    all<{ kind: Kind; n: number }>(db.prepare('SELECT kind,count(*) AS n FROM entities GROUP BY kind')),
    all<{ kind: Kind; n: number }>(db.prepare('SELECT e.kind,count(DISTINCT c.entity_id) AS n FROM coverage c JOIN entities e ON e.id=c.entity_id GROUP BY e.kind')),
    all<Entity & Coverage>(db.prepare(`
      SELECT e.*,c.metric_id,c.unit,c.first_day,c.last_day,c.last_value,c.observed_at,c.collected_at
      FROM coverage c JOIN entities e ON e.id=c.entity_id WHERE
        (e.id='network:btc' AND c.metric_id='blocks') OR
        (e.id='eip155:1' AND c.metric_id='transactions') OR
        (e.id='asset:usdc_eth' AND c.metric_id='transfers') OR
        (e.id='protocol:soroswap' AND c.metric_id='stellar-ttl') OR
        (e.id='system:enwiki' AND c.metric_id='wiki-views')
      ORDER BY CASE e.id WHEN 'network:btc' THEN 0 WHEN 'eip155:1' THEN 1
        WHEN 'asset:usdc_eth' THEN 2 WHEN 'protocol:soroswap' THEN 3 ELSE 4 END
    `)),
  ])
  const latest = await db.prepare('SELECT max(observed_at) AS latest FROM coverage').first<string>('latest')
  return { counts: kinds.map(kind => ({
    kind, catalogued: catalogued.find(row => row.kind === kind)?.n ?? 0,
    measured: measured.find(row => row.kind === kind)?.n ?? 0,
  })), featured, last_observed: latest }
}

function chooseMetrics(params: URLSearchParams) {
  const perspective = params.get('perspective')
  const category = params.get('category')
  const metric = params.get('metric')
  if (metric && !metricById.has(metric)) throw new ApiError(400, 'Unknown metric.')
  if (perspective && !(perspectives as readonly string[]).includes(perspective)) throw new ApiError(400, 'Unknown perspective.')
  if (category && !metrics.some(item => item.category === category)) throw new ApiError(400, 'Unknown resource category.')
  const chosen = metrics.filter(item => (!perspective || item.perspective === perspective)
    && (!category || item.category === category) && (!metric || item.id === metric))
  return chosen.map(item => item.id)
}

async function catalog(db: D1Database, params: URLSearchParams) {
  const q = (params.get('q') ?? '').trim().slice(0, 80).toLowerCase()
  const kind = params.get('kind') ?? ''
  if (kind && !(kinds as readonly string[]).includes(kind)) throw new ApiError(400, 'Unknown entity type.')
  const page = Number(params.get('page') ?? '1')
  if (!Number.isInteger(page) || page < 1 || page > 500) throw new ApiError(400, 'Invalid page number.')
  const from = params.get('from')
  const to = params.get('to')
  if ((from && !dateOnly(from)) || (to && !dateOnly(to)) || (from && to && from > to)) throw new ApiError(400, 'Invalid catalog dates.')
  const available = params.get('scope') !== 'catalog'
  const choices = chooseMetrics(params)
  const isFiltered = Boolean(params.get('metric') || params.get('category') || params.get('perspective') || from || to)
  const clauses: string[] = []
  const args: (string | number)[] = []
  if (kind) { clauses.push('e.kind=?'); args.push(kind) }
  if (q) {
    clauses.push('(instr(lower(e.name),?) OR instr(lower(coalesce(e.symbol,\'\')),?) OR instr(e.id,?))')
    args.push(q, q, q)
  }
  const cov = "SELECT * FROM coverage WHERE metric_id IN (SELECT value FROM json_each(?))"
    + (from ? ' AND last_day>=?' : '') + (to ? ' AND first_day<=?' : '')
  const modeArgs = [JSON.stringify(choices), ...(from ? [from] : []), ...(to ? [to] : [])]
  if (available || isFiltered) clauses.push('s.series > 0')
  const limit = 27
  const rows = await all<CatalogEntity>(db.prepare(`
    WITH selected AS (${cov}), s AS (
      SELECT entity_id,count(*) AS series,max(last_day) AS last_day FROM selected GROUP BY entity_id
    )
    SELECT e.*,coalesce(s.series,0) AS series,s.last_day,
      (SELECT metric_id FROM selected WHERE entity_id=e.id
        ORDER BY CASE metric_id WHEN 'blocks' THEN 0 WHEN 'transfers' THEN 1 WHEN 'stellar-ttl' THEN 2 ELSE 3 END,
        last_day DESC,metric_id LIMIT 1) AS metric_id
    FROM entities e LEFT JOIN s ON s.entity_id=e.id
    ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}
    ORDER BY ${q ? 'CASE WHEN lower(e.name)=? OR lower(e.symbol)=? OR e.id=? THEN 0 ELSE 1 END,' : ''}
      CASE WHEN s.series > 0 THEN 0 ELSE 1 END, e.testnet, e.name COLLATE NOCASE, e.id
    LIMIT ? OFFSET ?
  `).bind(...modeArgs, ...args, ...(q ? [q, q, q] : []), limit + 1, (page - 1) * limit))
  return { items: rows.slice(0, limit), page, more: rows.length > limit }
}

async function detail(db: D1Database, id: string) {
  if (!entityId.test(id)) throw new ApiError(400, 'Invalid entity identifier.')
  const entity = await db.prepare('SELECT * FROM entities WHERE id=?').bind(id).first<Entity>()
  if (!entity) throw new ApiError(404, 'Entity is absent from the catalog.')
  const [coverage, relations] = await Promise.all([
    all<Coverage>(db.prepare('SELECT metric_id,unit,first_day,last_day,last_value,observed_at,collected_at FROM coverage WHERE entity_id=? ORDER BY metric_id').bind(id)),
    all<Entity & { label: string }>(db.prepare(`
      SELECT e.*, r.label FROM (
        SELECT network_id AS id,CASE WHEN kind='network' THEN 'Parent network' ELSE 'Network' END AS label FROM entities WHERE id=? AND network_id IS NOT NULL
        UNION
        SELECT id,CASE WHEN kind='network' THEN 'Related network' ELSE 'On this network' END FROM entities WHERE network_id=?
        UNION
        SELECT target_id,label FROM relations WHERE entity_id=?
        UNION
        SELECT entity_id,'Deployment' FROM relations WHERE target_id=?
      ) r JOIN entities e ON e.id=r.id
      ORDER BY e.testnet,e.kind,e.name LIMIT 40
    `).bind(id, id, id, id)),
  ])
  return { entity, coverage, relations }
}

function requestedRange(params: URLSearchParams, isSnapshot: boolean, now: number) {
  const last = daysAgo(isSnapshot ? 0 : 1, now)
  const to = params.get('to') || last
  if (!dateOnly(to)) throw new ApiError(400, 'Choose a valid UTC end date.')
  const from = params.get('from') || daysAgo(89, Date.parse(to))
  if (!dateOnly(from) || from > to || to > daysAgo(0, now)
    || Date.parse(to) - Date.parse(from) > 365 * DAY_MS) {
    throw new ApiError(400, 'Choose a valid UTC date range of up to 366 days.')
  }
  return { from, to }
}

function csvCell(value: unknown) {
  return '"' + String(value ?? '').replaceAll('"', '""') + '"'
}

async function series(db: D1Database, params: URLSearchParams) {
  const metric = metricById.get(params.get('metric') ?? '')
  const ids = [...new Set((params.get('entities') ?? '').split(',').filter(Boolean))]
  if (!metric || !ids.length || ids.length > 4 || ids.some(id => !entityId.test(id))) {
    throw new ApiError(400, 'Specify one metric and one to four catalog entity IDs.')
  }
  const window = requestedRange(params, metric.shape === 'Daily snapshot', Date.now())
  const placeholders = ids.map(() => '?').join(',')
  const [entities, points, cover] = await Promise.all([
    all<Entity>(db.prepare('SELECT * FROM entities WHERE id IN (' + placeholders + ')').bind(...ids)),
    all<Point>(db.prepare(`SELECT * FROM observations WHERE entity_id IN (${placeholders}) AND metric_id=?
      AND day BETWEEN ? AND ? ORDER BY day,entity_id`).bind(...ids, metric.id, window.from, window.to)),
    all<{ entity_id: string; unit: string }>(db.prepare(`SELECT entity_id,unit FROM coverage
      WHERE metric_id=? AND entity_id IN (${placeholders})`).bind(metric.id, ...ids)),
  ])
  if (entities.length !== ids.length) throw new ApiError(404, 'One of the requested entities is absent from the catalog.')
  if (ids.length > 1 && (cover.length !== ids.length || entities.some(entity => entity.category === 'Provider aggregate')
    || !compatible(metric, entities, cover.map(item => item.unit)))) {
    throw new ApiError(422, 'These entities do not share the required metric definition, unit, and scope for comparison.')
  }
  const dates = 1 + (Date.parse(window.to) - Date.parse(window.from)) / DAY_MS
  const counts = new Map<string, number>()
  for (const p of points) counts.set(p.entity_id, (counts.get(p.entity_id) ?? 0) + 1)
  const missing = Object.fromEntries(ids.map(id => [id, dates - (counts.get(id) ?? 0)]))
  const source = sourceById.get(metric.source)!
  const data = { metric, entities: ids.map(id => entities.find(entity => entity.id === id)), points, window, missing, source }
  if (params.get('format') === 'csv') {
    const fields = ['entity_id','metric_id','day','value','unit','observed_at','collected_at','revision','source','license','context']
    const lines = points.map(p => [
      p.entity_id, p.metric_id, p.day, p.value, p.unit, p.observed_at, p.collected_at, p.revision, source.name, source.license, p.context,
    ].map(csvCell).join(','))
    return new Response([fields.join(','), ...lines].join('\r\n') + '\r\n', { headers: {
      ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'public, max-age=300',
      'Content-Disposition': 'attachment; filename="circula-' + metric.id + '.csv"',
      Link: '<' + source.terms + '>; rel="license"',
    } })
  }
  const response = json(data)
  if (params.get('format') === 'json') response.headers.set('Content-Disposition', 'attachment; filename="circula-' + metric.id + '.json"')
  return response
}

async function status(db: D1Database) {
  const [recent, latest, jobStats, scheduled] = await Promise.all([
    all<Run>(db.prepare('SELECT job_id,source,trigger,scheduled_at,started_at,finished_at,status,row_count,note FROM runs ORDER BY id DESC LIMIT 28')),
    all<{ source: SourceId; observed_at: string; collected_at: string }>(db.prepare(`
      SELECT m.value->>1 AS source,max(c.observed_at) AS observed_at,max(c.collected_at) AS collected_at
      FROM coverage c JOIN json_each(?) m ON c.metric_id=m.value->>0
      GROUP BY m.value->>1
    `).bind(JSON.stringify(metrics.map(m => [m.id, m.source])))),
    all<{ source: SourceId; jobs: number; failed_jobs: number; last_success: string | null }>(db.prepare(`
      SELECT source,count(*) AS jobs,sum(CASE WHEN failures>0 THEN 1 ELSE 0 END) AS failed_jobs,
        max(last_success) AS last_success FROM jobs WHERE enabled=1 GROUP BY source
    `)),
    db.prepare("SELECT scheduled_at FROM runs WHERE trigger='scheduled' ORDER BY id DESC LIMIT 1").first<string>('scheduled_at'),
  ])
  const now = Date.now()
  return {
    now: new Date(now).toISOString(), last_scheduled: scheduled, runs: recent,
    sources: sources.map(source => {
      const data = latest.find(row => row.source === source.id)
      const jobs = jobStats.find(row => row.source === source.id)
      const stamp = source.id === 'evm-registry' ? jobs?.last_success : data?.observed_at
      const state = jobs?.failed_jobs ? 'Degraded' : !stamp ? 'Collecting'
        : now - Date.parse(stamp) > sourceLagMs[source.id] ? 'Delayed' : 'Current'
      return {
        source: source.id, observed_at: data?.observed_at ?? null, collected_at: data?.collected_at ?? null,
        failed_jobs: jobs?.failed_jobs ?? 0, jobs: jobs?.jobs ?? 0, state, last_success: jobs?.last_success ?? null,
      }
    }),
  }
}

async function tokenMatches(received: string, expected: string) {
  const digest = (value: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const [a, b] = await Promise.all([digest(received), digest(expected)])
  const expectedBytes = new Uint8Array(b)
  return new Uint8Array(a).reduce((diff, byte, index) => diff | (byte ^ expectedBytes[index]), 0) === 0
}

async function api(request: Request, env: Env, ctx: ExecutionContext) {
  const { pathname, searchParams } = new URL(request.url)
  if (pathname === '/api/internal/collect') {
    if (!env.INGEST_TOKEN || request.method !== 'POST') throw new ApiError(404, 'Endpoint not found.')
    if (!await tokenMatches(request.headers.get('Authorization') ?? '', 'Bearer ' + env.INGEST_TOKEN)) {
      throw new ApiError(401, 'Unauthorized.')
    }
    if (env.COLLECTION_PAUSED === 'true') throw new ApiError(503, 'Data collection is paused.')
    const job = searchParams.get('job')
    if (!job || !/^[a-z0-9:-]{1,100}$/.test(job)) throw new ApiError(400, 'Specify a collector job ID.')
    ctx.waitUntil(tick(env.DB, 'manual', undefined, job))
    return json({ queued: job, trigger: 'manual' }, 202, 0)
  }
  if (request.method !== 'GET') throw new ApiError(405, 'This endpoint accepts GET.')
  if (pathname === '/api/v1/metadata') return json({ version: 'v1', metrics, sources }, 200, 3600)
  const collection_paused = env.COLLECTION_PAUSED === 'true'
  if (pathname === '/api/v1/status') return json({ ...await status(env.DB), collection_paused }, 200, 0)
  if (pathname.startsWith('/api/v1/entities/')) return json(await detail(env.DB, decodeURIComponent(pathname.slice('/api/v1/entities/'.length))))
  if (pathname === '/api/v1/overview') return json({ ...await overview(env.DB), collection_paused }, 200, 180)
  if (pathname === '/api/v1/catalog') return json(await catalog(env.DB, searchParams), 200, 120)
  if (pathname === '/api/v1/series') return series(env.DB, searchParams)
  throw new ApiError(404, 'Endpoint not found.')
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    try {
      const cached = request.method === 'GET' && !url.pathname.startsWith('/api/internal')
        && url.pathname !== '/api/v1/status' && url.protocol === 'https:' && request.url.length < 750
      if (cached) {
        const cache = await caches.open('circula-v1')
        url.searchParams.sort()
        const key = new Request(url)
        const stored = await cache.match(key)
        if (stored) return stored
        const response = await api(request, env, ctx)
        if (response.ok && response.headers.get('Cache-Control')?.startsWith('public')) ctx.waitUntil(cache.put(key, response.clone()))
        return response
      }
      return await api(request, env, ctx)
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status, 0)
      if (error instanceof URIError) return json({ error: 'Invalid URL encoding.' }, 400, 0)
      console.error('Archive API error', error instanceof Error ? error.message : 'unknown')
      return json({ error: 'The Observatory archive is temporarily unavailable.' }, 503, 0)
    }
  },

  async scheduled(event, env, ctx) {
    if (env.COLLECTION_PAUSED === 'true') return
    ctx.waitUntil((async () => {
      if (!await env.DB.prepare("SELECT 1 FROM entities WHERE id='protocol:soroswap'").first()) {
        await applySql(env.DB, [putEntities(operationalEntities)])
      }
      await tick(env.DB, 'scheduled', event.scheduledTime)
    })())
  },
} satisfies ExportedHandler<Env>
