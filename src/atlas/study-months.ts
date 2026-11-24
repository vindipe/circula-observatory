import { studyFileUrl } from './study-data'
import {
  studyIndicators, type ResearchSnapshot, type StudyAsset, type StudyIndicator,
  type StudyObservation, type StudyStatus,
} from './study-types'

type Gap = [fromIndex: number, toIndex: number, status: StudyStatus, detail?: string]
type Values = (number | null)[]
interface MonthlyAsset {
  offset: number
  columns: Partial<Record<StudyIndicator, Values>>
  inputs: Record<string, Values>
  gaps: Partial<Record<StudyIndicator, Gap[]>>
}

export interface StudyMonths {
  schema: 1
  dates: string[]
  cutoffUtc: string
  retrievedUtc: string
  assets: Record<string, MonthlyAsset>
}
declare global { interface Window { __studyMonths?: StudyMonths } }

let loading: Promise<StudyMonths> | undefined

export async function loadStudyMonths(): Promise<StudyMonths> {
  if (window.__studyMonths) return window.__studyMonths
  if (!loading) {
    loading = (async () => {
      const response = await fetch(await studyFileUrl('series'))
      if (!response.ok) throw new Error('Monthly study data unavailable')
      const history: StudyMonths = await response.json()
      if (history.schema !== 1 || !history.assets || !Array.isArray(history.dates) ||
          history.dates.at(-1) !== history.cutoffUtc) throw new Error('Invalid monthly study data')
      return history
    })().catch(error => { loading = undefined; throw error })
  }
  return loading
}

const inputKeys: Record<StudyIndicator, string[]> = {
  transactions: [], blocks: [], ledgerBytes: [], fundedAddresses: ['AdrBalCnt'], supply: ['SplyCur'],
  inactiveFloor: ['AdrBalCnt', 'AdrActCntSum30d'], exchangeShare: ['SplyExNtv', 'SplyCur'],
  exchangeValue: ['SplyExNtv', 'PriceUSD'], transfers30d: ['TxTfrCntSum30d'],
  activeAddresses30d: ['AdrActCntSum30d'],
}

function windowStart(end: string): string {
  const date = new Date(end + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() - 29)
  return date.toISOString().slice(0,10)
}

export function monthCell(history: StudyMonths, snapshot: ResearchSnapshot, asset: string, metric: StudyIndicator,
                          day: string): StudyObservation {
  const row = history.assets[asset]
  const index = history.dates.indexOf(day)
  if (!row || index < 0) return {value:null, status:'missing'}
  const local = index - row.offset
  const value = row.columns[metric]?.[local] ?? null
  const gap = value === null ? row.gaps[metric]?.find(([from,to]) => from <= index && index <= to) : undefined
  const cell: StudyObservation = value === null
    ? {value:null, status:gap?.[2] ?? 'missing', detail:gap?.[3]}
    : {value, status:value === 0 ? 'zero_observed' : 'observed', observedUtc:day}
  const inputs: Record<string, number | string> = {}
  for (const key of inputKeys[metric]) {
    const column = key === 'AdrBalCnt' ? row.columns.fundedAddresses
      : key === 'SplyCur' ? row.columns.supply : row.inputs[key]
    const input = column?.[local]
    if (input != null) inputs[key] = input
  }
  if (metric === 'exchangeValue' && inputs.PriceUSD != null) inputs.priceDateUtc = day
  if (['inactiveFloor','transfers30d','activeAddresses30d'].includes(metric)) {
    cell.startUtc = windowStart(day)
    if (inputs.AdrActCntSum30d != null || inputs.TxTfrCntSum30d != null) inputs.days = 30
  }
  if (Object.keys(inputs).length) cell.inputs = inputs
  if (metric === 'transactions' || metric === 'blocks' || metric === 'ledgerBytes') {
    const startKey = metric === 'transactions' ? 'TxCnt' : 'BlkCnt'
    const start = snapshot.assets[asset]?.starts?.[startKey]
    if (start && start <= day) cell.startUtc = start
  }
  return cell
}

export function monthlyPair(history: StudyMonths, snapshot: ResearchSnapshot,
                            baselineUtc: string, cutoffUtc: string): ResearchSnapshot {
  const assets: Record<string, StudyAsset> = {}
  for (const [id, asset] of Object.entries(snapshot.assets)) {
    const baseline: StudyAsset['baseline'] = {}, latest: StudyAsset['latest'] = {}
    for (const indicator of studyIndicators) {
      baseline[indicator] = monthCell(history,snapshot,id,indicator,baselineUtc)
      latest[indicator] = monthCell(history,snapshot,id,indicator,cutoffUtc)
    }
    assets[id] = {...asset,baseline,latest}
  }
  return {...snapshot,baselineUtc,cutoffUtc,retrievedUtc:history.retrievedUtc,assets}
}
