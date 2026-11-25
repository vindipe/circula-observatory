export type Area = 'infrastructure' | 'holdings' | 'circulation'
export type AssetScope = 'network' | 'deployment' | 'aggregate' | 'provider'
export type MetricStatus = 'chart' | 'input' | 'restricted' | 'unlisted' | 'other-frequency' | 'outside'

export type MetricDecision = [
  id: string, name: string, product: string, category: string, subcategory: string,
  unit: string, area: Area | '', family: string, status: MetricStatus, dailyPublic: number,
  dailyAll: number, publicFrequencies: string, docs: string | null,
]
export type Gap = [id: string, area: Area, title: string, italian: string, formula: string, inputs: string[], view: string]
export type Asset = [name: string, scope: AssetScope, host: string, contract: string, contractSource: string]
export type Values = [range: [string, string], monthly: [offset: number, values: (number | null)[]], latest: [string, number] | null]

export interface CatalogueIndicator {
  id: string
  area: Area
  title: string
  why: string
  caution: string
  it: [title: string, why: string, caution: string]
  unit: string
  role: 'stock' | 'movement' | 'history' | 'context'
  formula: string
  codes: string[]
  derived: boolean
  catalogCount: number
  monthlyCount: number
  observationCount: number
}

interface Audit {
  schema: number
  asOf: string
  cutoff: string
  totals: {
    definitions: number; catalogued: number; relevant: number; publicCodes: number; restricted: number;
    published: number; direct: number; derived: number; assetIds: number; basePairs: number;
    observedBasePairs: number; catalogPairs: number; monthlyPairs: number; observedPairs: number
  }
  indicators: CatalogueIndicator[]
  metrics: MetricDecision[]
  gaps: Gap[]
}

interface Observations {
  schema: number
  asOf: string
  cutoff: string
  months: string[]
  assets: Record<string, Asset>
  rows: Record<string, Record<string, Values>>
}

export interface Census { audit: Audit; data: Observations }

declare global { interface Window { __indicatorCatalogue?: Census } }

export const communityApi = 'https://community-api.coinmetrics.io/v4'
export const catalogEndpoint = communityApi + '/catalog-v2/asset-metrics'
export const licenseUrl = 'https://creativecommons.org/licenses/by-nc/4.0/'
export const sourceDocs = 'https://docs.coinmetrics.io/network-data/network-data-overview'

async function jsonGzip<T>(file: string): Promise<T> {
  const response = await fetch('/atlas/' + file)
  if (!response.ok) throw new Error('Indicator snapshot unavailable')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(bytes)) as T
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).json() as Promise<T>
}

let census: Promise<Census> | undefined

export function loadCensus() {
  census ??= (window.__indicatorCatalogue
    ? Promise.resolve(window.__indicatorCatalogue)
    : Promise.all([
        jsonGzip<Audit>('indicator-audit.json.gz'),
        jsonGzip<Observations>('indicator-series.json.gz'),
      ]).then(([audit, data]) => ({audit, data}))
  ).then(value => {
    if (value.audit.schema !== 1 || value.data.schema !== 1 || value.audit.cutoff !== value.data.cutoff
      || value.audit.asOf !== value.data.asOf || !value.data.months.length
      || value.audit.indicators.some(spec => !value.data.rows[spec.id])) {
      throw new Error('Incompatible indicator snapshots')
    }
    return value
  }).catch(error => { census = undefined; throw error })
  return census
}

export function monthValue(row: Values, index: number) {
  const [offset, values] = row[1]
  return values[index - offset] ?? null
}

export function observedMonths(row: Values, start: number, end: number) {
  const [offset, values] = row[1]
  return values.slice(Math.max(0, start - offset), Math.max(0, end - offset + 1))
    .filter(value => value !== null).length
}
