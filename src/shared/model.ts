export const perspectives = ['accumulate', 'persist', 'circulate', 'expire'] as const
export type Perspective = typeof perspectives[number]
export type Kind = 'network' | 'asset' | 'protocol' | 'system'
export type SourceId = 'coin' | 'evm-registry' | 'stellar' | 'solana' | 'wikimedia' | 'evm-rpc'
export type Category = 'ledger' | 'holdings' | 'contract-state' | 'value-flows' | 'web-traffic'

export interface Entity {
  id: string
  name: string
  kind: Kind
  category: string
  symbol: string | null
  source: SourceId
  network_id: string | null
  website: string | null
  description: string | null
  testnet: number
}

export interface Point {
  entity_id: string
  metric_id: string
  day: string
  value: number
  unit: string
  observed_at: string
  collected_at: string
  context: string | null
  revision?: number
}

export interface Coverage {
  metric_id: string
  unit: string
  first_day: string
  last_day: string
  last_value: number
  observed_at: string
  collected_at: string
}

export interface Metric {
  id: string
  name: string
  perspective: Perspective
  category: Category
  unit: string
  source: SourceId
  providerKey?: string
  evidence: 'Measured' | 'Derived'
  shape: 'Daily count' | 'Daily amount' | 'End-of-day stock' | 'Daily snapshot'
  compare: 'same-kind' | 'cohort' | 'none'
  definition: string
  limit: string
}

export interface Source {
  id: SourceId
  name: string
  documentation: string
  license: string
  terms: string
  cadence: string
  note: string
}

export interface Series {
  metric: Metric
  entities: Entity[]
  points: Point[]
  window: { from: string; to: string }
  missing: Record<string, number>
}

export interface CatalogEntity extends Entity {
  series: number
  metric_id: string | null
  last_day: string | null
}

export interface Catalog {
  items: CatalogEntity[]
  page: number
  more: boolean
}

export interface Detail {
  entity: Entity
  coverage: Coverage[]
  relations: (Entity & { label: string })[]
}

export interface Overview {
  collection_paused: boolean
  counts: { kind: Kind; catalogued: number; measured: number }[]
  featured: (Entity & Coverage)[]
  last_observed: string | null
}

export interface Run {
  job_id: string
  source: SourceId
  trigger: 'bootstrap' | 'manual' | 'scheduled'
  scheduled_at: string | null
  started_at: string
  finished_at: string
  status: 'ok' | 'partial' | 'error'
  row_count: number
  note: string | null
}

export interface Status {
  collection_paused: boolean
  now: string
  sources: {
    source: SourceId
    observed_at: string | null
    collected_at: string | null
    failed_jobs: number
    jobs: number
    last_success: string | null
    state: 'Collecting' | 'Current' | 'Delayed' | 'Degraded'
  }[]
  runs: Run[]
  last_scheduled: string | null
}

export const DAY_MS = 86_400_000
export const dayString = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const daysAgo = (days: number, ms = Date.now()) => dayString(ms - days * DAY_MS)
export const dateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && dayString(Date.parse(value)) === value

export function compatible(metric: Metric, entities: Entity[], units: string[]) {
  if (entities.length < 2) return true
  if (metric.compare === 'none' || new Set(units).size !== 1) return false
  if (metric.compare === 'cohort') return entities.every(entity => entity.network_id === entities[0].network_id)
  const [first] = entities
  return entities.every(entity => entity.kind === first.kind
    && (first.kind !== 'asset' || entity.category === first.category))
}
