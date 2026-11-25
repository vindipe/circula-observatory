export const studyIndicators = [
  'transactions', 'blocks', 'ledgerBytes', 'fundedAddresses', 'supply',
  'inactiveFloor', 'exchangeShare', 'exchangeValue', 'transfers30d', 'activeAddresses30d',
] as const

export type StudyIndicator = typeof studyIndicators[number]
export type StudySample = 'frozen' | 'current'
export type StudyScope = 'network' | 'aggregate' | 'token_deployment' | 'provider_asset'
export type StudyStatus = 'observed' | 'zero_observed' | 'not_applicable' | 'not_public' | 'incomplete' | 'undefined' | 'missing'
export type StudySide = 'baseline' | 'latest'

export interface StudyObservation {
  value: number | null
  status: StudyStatus
  detail?: string
  inputs?: Record<string, number | string | null>
  observedUtc?: string
  startUtc?: string
}

export interface StudyAsset {
  scope: StudyScope
  host: string | null
  layer?: string
  name?: string
  contract?: string | null
  starts?: Record<string, string | null>
  baseline: Partial<Record<StudyIndicator, StudyObservation>>
  latest: Partial<Record<StudyIndicator, StudyObservation>>
}

export interface ResearchSnapshot {
  baselineUtc: string
  cutoffUtc: string
  retrievedUtc: string
  discovery?: {priceOnlyIds?: string[]}
  assets: Record<string, StudyAsset>
}

export const commonIndicators: StudyIndicator[] = [
  'transactions', 'fundedAddresses', 'supply', 'inactiveFloor', 'transfers30d', 'activeAddresses30d',
]

interface StudyDefinition {
  area: 'infrastructure' | 'holdings' | 'circulation'
  kind: 'history' | 'stock' | 'mean' | 'bound'
  codes: string[]
  formula: string
  unit: string
}

export const studyDefinitions: Record<StudyIndicator, StudyDefinition> = {
  transactions: {area:'infrastructure',kind:'history',codes:['TxCnt'],formula:'Σ TxCnt[d]',unit:'transactions'},
  blocks: {area:'infrastructure',kind:'history',codes:['BlkCnt'],formula:'Σ BlkCnt[d]',unit:'blocks'},
  ledgerBytes: {area:'infrastructure',kind:'history',codes:['BlkSizeByte','BlkCnt','BlkSizeMeanByte'],formula:'Σ BlkSizeByte[d] / 10⁹ OR Σ (BlkCnt[d] × BlkSizeMeanByte[d]) / 10⁹',unit:'GB'},
  fundedAddresses: {area:'holdings',kind:'stock',codes:['AdrBalCnt'],formula:'AdrBalCnt[t]',unit:'addresses'},
  supply: {area:'holdings',kind:'stock',codes:['SplyCur'],formula:'SplyCur[t]',unit:'native units'},
  inactiveFloor: {area:'holdings',kind:'bound',codes:['AdrBalCnt','AdrActCnt'],formula:'100 × max(0, AdrBalCnt[t] − Σ₃₀ AdrActCnt[d]) / AdrBalCnt[t]',unit:'%'},
  exchangeShare: {area:'holdings',kind:'stock',codes:['SplyExNtv','SplyCur'],formula:'100 × SplyExNtv[t] / SplyCur[t]',unit:'%'},
  exchangeValue: {area:'holdings',kind:'stock',codes:['SplyExNtv','PriceUSD'],formula:'SplyExNtv[t] × PriceUSD[t]',unit:'USD'},
  transfers30d: {area:'circulation',kind:'mean',codes:['TxTfrCnt'],formula:'Σ₃₀ TxTfrCnt[d] / 30',unit:'transfers/day'},
  activeAddresses30d: {area:'circulation',kind:'mean',codes:['AdrActCnt'],formula:'Σ₃₀ AdrActCnt[d] / 30',unit:'addresses/day'},
}

export type StudyCell = StudyObservation
