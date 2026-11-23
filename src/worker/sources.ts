import { dayString, daysAgo, dateOnly, type Point } from '../shared/model'
import { metricById, metrics } from '../shared/metrics'
import { stellarKeys } from './catalog'

const coinBase = 'https://community-api.coinmetrics.io/v4'
const userAgent = 'CIRCULA-Observatory/0.1 (https://github.com/vindipe/circula-observatory)'
export const coinMetrics = metrics.filter(metric => metric.source === 'coin')
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class UpstreamError extends Error {
  constructor(message: string, readonly retryAfter = 0) {
    super(message)
  }
}

export async function upstream(url: string, payload?: object) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers: Record<string, string> = { 'User-Agent': userAgent }
    if (payload) headers['Content-Type'] = 'application/json'
    const origin = new URL(url).hostname
    let response: Response
    try {
      response = await fetch(url, {
        method: payload ? 'POST' : 'GET',
        headers,
        body: payload ? JSON.stringify(payload) : undefined,
        redirect: 'manual',
        signal: AbortSignal.timeout(9_000),
      })
    } catch (error) {
      if (!attempt) {
        await pause(650)
        continue
      }
      const reason = error instanceof Error ? error.name : 'Fetch error'
      throw new UpstreamError(origin + ' request failed (' + reason + ')')
    }
    if (response.ok) return response
    const retryAfter = response.headers.get('Retry-After')
    const delay = retryAfter
      ? Math.max(0, /^[0-9]+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now())
      : 0
    await response.body?.cancel()
    if (attempt || !(response.status === 408 || response.status === 429 || response.status >= 500) || delay > 2_000) {
      throw new UpstreamError(origin + ' HTTP ' + response.status, delay || 0)
    }
    await pause(Math.max(delay, 900 + Math.floor(Math.random() * 350)))
  }
  throw new Error('Upstream retry exhausted')
}

export async function json<T>(url: string, payload?: object): Promise<T> {
  const response = await upstream(url, payload)
  return response.json() as Promise<T>
}

interface Paged<T> { data: T[]; next_page_token?: string }

export async function coinCatalogPage(cursor?: string) {
  const query = new URLSearchParams({ page_size: '250' })
  if (cursor) query.set('next_page_token', cursor)
  const page = await json<Paged<{ asset: string; full_name: string }>>(coinBase + '/reference-data/assets?' + query)
  if (!Array.isArray(page.data) || !page.data.length) throw new UpstreamError('Empty Coin Metrics catalog response')
  return page
}

export async function coinAvailability() {
  const query = new URLSearchParams({ metrics: coinMetrics.map(metric => metric.providerKey).join(',') })
  const body = await json<Paged<{
    metric: string
    frequencies: { frequency: string; assets: string[] }[]
  }>>(coinBase + '/catalog/asset-metrics?' + query)
  if (!Array.isArray(body.data) || !body.data.length) throw new UpstreamError('Empty Coin Metrics availability response')
  return new Map(body.data.map(item => [
    item.metric, item.frequencies.find(frequency => frequency.frequency === '1d')?.assets.filter(validCoin) ?? [],
  ]))
}

export const validCoin = (value: string) => typeof value === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}_.-]{0,63}$/u.test(value)

export type CoinTarget = [coin: string, entity: string, unit: string]
export type CoinRow = { asset: string; time: string } & Record<string, string | null | undefined>

export function decodeCoinRows(rows: CoinRow[], targets: CoinTarget[], metricId: string, from: string, to: string, at: string) {
  const providerKey = metricById.get(metricId)?.providerKey
  if (!providerKey) throw new Error('Unsupported Coin Metrics series')
  const targetByCoin = new Map(targets.map(target => [target[0], target]))
  const points = new Map<string, Point>()
  for (const row of rows) {
    const target = targetByCoin.get(row.asset)
    const day = row.time?.slice(0, 10)
    const raw = row[providerKey]
    if (!target || !day || !dateOnly(day) || day < from || day > to || raw == null || raw.trim() === '') continue
    const rawValue = Number(raw)
    const supply = row.SplyCur ? Number(row.SplyCur) : 0
    const value = metricId === 'exchange-share'
      ? supply > 0 && rawValue >= 0 && rawValue <= supply ? 100 * rawValue / supply : NaN
      : rawValue
    if (!Number.isFinite(value)) continue
    const point: Point = {
      entity_id: target[1], metric_id: metricId, unit: target[2], day,
      value, observed_at: day + 'T00:00:00.000Z', collected_at: at, context: null,
    }
    points.set(point.entity_id + '/' + point.day, point)
  }
  return [...points.values()]
}

export async function coinSeries(metricId: string, targets: CoinTarget[], from: string, to: string) {
  const providerKey = metricById.get(metricId)?.providerKey
  if (!providerKey || targets.length === 0) throw new Error('Unconfigured Coin Metrics series')
  // Request the preceding date as well so both inclusive and exclusive source
  // boundary behavior yield the same retained range.
  const query = new URLSearchParams({
    assets: targets.map(([coin]) => coin).join(','), metrics: metricId === 'exchange-share' ? providerKey + ',SplyCur' : providerKey,
    frequency: '1d', start_time: daysAgo(1, Date.parse(from)), end_time: to, page_size: '1000',
  })
  const points: Point[] = []
  for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
    const page = await json<Paged<CoinRow>>(coinBase + '/timeseries/asset-metrics?' + query)
    if (!Array.isArray(page.data)) throw new UpstreamError('Invalid Coin Metrics series response')
    points.push(...decodeCoinRows(page.data, targets, metricId, from, to, new Date().toISOString()))
    if (!page.next_page_token) return points
    query.set('next_page_token', page.next_page_token)
  }
  throw new UpstreamError('Coin Metrics pagination exceeded the bounded shard')
}

export async function getRegistry() {
  const response = await upstream('https://chainid.network/chains.json')
  const raw = await response.text()
  if (!raw.startsWith('[') || raw.length > 1_850_000 || raw.length < 10_000) {
    throw new UpstreamError('EVM registry has an unexpected size or format')
  }
  return raw
}

async function rpc<T>(url: string, method: string, params: object = {}): Promise<T> {
  const body = await json<{ result?: T; error?: { code: number } }>(url, {
    jsonrpc: '2.0', method, params, id: 1,
  })
  if (body.result == null) throw new UpstreamError(new URL(url).hostname + ' RPC ' + method + ' error ' + (body.error?.code ?? 'invalid response'))
  return body.result
}

export interface StellarEntry {
  key: string
  lastModifiedLedgerSeq?: number
  liveUntilLedgerSeq?: number
}

export function decodeStellar(entries: StellarEntry[], latestLedger: number, observedAt: string, collectedAt: string) {
  const points: Point[] = []
  for (const item of stellarKeys) {
    const entry = entries.find(row => row.key === item.key)
    const ttl = entry?.liveUntilLedgerSeq
    const write = entry?.lastModifiedLedgerSeq
    if (!Number.isSafeInteger(ttl) || !ttl || ttl < latestLedger) continue
    const context = JSON.stringify({ ledger: latestLedger, contract: item.address, live_until_ledger: ttl, last_modified_ledger: write })
    const point = {
      entity_id: item.id, day: observedAt.slice(0, 10), unit: 'ledgers',
      observed_at: observedAt, collected_at: collectedAt, context,
    }
    points.push({ ...point, metric_id: 'stellar-ttl', value: ttl - latestLedger })
    if (write && Number.isSafeInteger(write) && write <= latestLedger) {
      points.push({ ...point, metric_id: 'stellar-write-age', value: latestLedger - write })
    }
  }
  return points
}

export function closeTimeFromLedgerPrefix(text: string, sequence: number) {
  const fields = /"sequence"\s*:\s*(\d+)\s*,\s*"ledgerCloseTime"\s*:\s*"(\d+)"/.exec(text)
  if (!fields || Number(fields[1]) !== sequence) return null
  const ms = Number(fields[2]) * 1000
  return Number.isFinite(ms) && ms > 0 && ms <= Date.now() + 60_000 ? new Date(ms).toISOString() : null
}

async function stellarLedgerClose(endpoint: string, sequence: number) {
  try {
    const ledger = await json<{ closed_at: string; sequence: number }>('https://horizon.stellar.org/ledgers/' + sequence)
    if (Number.isFinite(Date.parse(ledger.closed_at)) && ledger.sequence === sequence) return new Date(ledger.closed_at).toISOString()
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error
  }
  const response = await upstream(endpoint, {
    jsonrpc: '2.0', id: 1, method: 'getLedgers',
    params: { startLedger: sequence, pagination: { limit: 1 } },
  })
  const reader = response.body?.getReader()
  if (!reader) throw new UpstreamError('Stellar ledger close response is unavailable')
  let prefix = ''
  const decoder = new TextDecoder()
  try {
    while (prefix.length < 2048) {
      const { done, value } = await reader.read()
      if (done) break
      prefix += decoder.decode(value.slice(0, 2048 - prefix.length))
      const close = closeTimeFromLedgerPrefix(prefix, sequence)
      if (close) return close
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  throw new UpstreamError('Stellar did not return a verified timestamp for the observation ledger')
}

export async function stellarSeries() {
  const params = { keys: stellarKeys.map(item => item.key) }
  type Result = { latestLedger: number; entries: StellarEntry[] }
  let endpoint = 'https://mainnet.sorobanrpc.com/'
  let result: Result
  try {
    result = await rpc<Result>(endpoint, 'getLedgerEntries', params)
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error
    endpoint = 'https://stellar.api.onfinality.io/public'
    result = await rpc<Result>(endpoint, 'getLedgerEntries', params)
  }
  if (!Number.isSafeInteger(result.latestLedger) || !Array.isArray(result.entries)) {
    throw new UpstreamError('Stellar RPC returned no valid snapshot ledger')
  }
  const closedAt = await stellarLedgerClose(endpoint, result.latestLedger)
  return decodeStellar(result.entries, result.latestLedger, closedAt, new Date().toISOString())
}

function snapshot(entity: string, metric: string, value: number, context: object, observedAt: string) {
  return {
    entity_id: entity, metric_id: metric, value, unit: metricById.get(metric)!.unit,
    observed_at: observedAt, collected_at: new Date().toISOString(),
    day: observedAt.slice(0, 10), context: JSON.stringify(context),
  }
}

export async function solanaSeries() {
  type Supply = { context: { slot: number }; value: { circulating: number } }
  const params = [{ commitment: 'finalized', excludeNonCirculatingAccountsList: true }]
  let response: Supply
  try {
    response = await rpc<Supply>('https://api.mainnet-beta.solana.com', 'getSupply', params)
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error
    response = await rpc<Supply>('https://solana.drpc.org', 'getSupply', params)
  }
  const observedAt = new Date().toISOString()
  const slot = response.context?.slot
  const lamports = response.value?.circulating
  if (!Number.isSafeInteger(slot) || !Number.isInteger(lamports) || lamports < 0) {
    throw new UpstreamError('Solana RPC supply or slot was malformed')
  }
  return [snapshot('asset:sol', 'solana-circulating', lamports / 1e9, { slot, commitment: 'finalized' }, observedAt)]
}

export function validPublicNode(endpoint: string) {
  return /^https:\/\/[a-z0-9-]+\.publicnode\.com\/?$/i.test(endpoint)
}

export async function evmSeries(entity: string, endpoint: string) {
  if (!validPublicNode(endpoint) || !/^eip155:[0-9]+$/.test(entity)) throw new Error('Invalid configured EVM endpoint')
  const [rawChain, rawHeight] = await Promise.all([
    rpc<string>(endpoint, 'eth_chainId', []),
    rpc<string>(endpoint, 'eth_blockNumber', []),
  ])
  const observedAt = new Date().toISOString()
  if (typeof rawChain !== 'string' || typeof rawHeight !== 'string' || !/^0x[0-9a-f]+$/i.test(rawChain) || !/^0x[0-9a-f]+$/i.test(rawHeight)) {
    throw new UpstreamError('PublicNode returned an invalid chain ID or block height')
  }
  const chain = BigInt(rawChain).toString()
  const height = Number(BigInt(rawHeight))
  if ('eip155:' + chain !== entity || !Number.isSafeInteger(height)) throw new UpstreamError('PublicNode chain identity or block height mismatch')
  return [snapshot(entity, 'evm-head', height, { chain_id: chain, method: 'eth_blockNumber' }, observedAt)]
}

export async function wikiSeries(entity: string, project: string, from: string, to: string) {
  const path = [project, 'all-access', 'user', 'daily', from.replaceAll('-', ''), to.replaceAll('-', '')].join('/')
  const response = await json<{ items: { timestamp: string; views: number }[] }>(
    'https://wikimedia.org/api/rest_v1/metrics/pageviews/aggregate/' + path,
  )
  const collectedAt = new Date().toISOString()
  if (!Array.isArray(response.items) || !response.items.length) throw new UpstreamError('No Wikimedia daily aggregates returned')
  return response.items.flatMap(item => {
    const digits = item.timestamp
    if (!/^\d{10}$/.test(digits) || !Number.isSafeInteger(item.views) || item.views < 0) return []
    const day = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].join('-')
    if (!dateOnly(day) || day < from || day > to) return []
    return [{
      entity_id: entity, metric_id: 'wiki-views', day, value: item.views, unit: 'page views',
      observed_at: dayString(Date.parse(day)) + 'T00:00:00.000Z', collected_at: collectedAt,
      context: null,
    }]
  })
}
