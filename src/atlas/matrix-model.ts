import { studyDefinitions, studyIndicators, type ResearchSnapshot, type StudyAsset, type StudyIndicator, type StudyObservation, type StudySide } from './study-types'

export type CoverageMode = 'complete' | 'partial' | 'audit'
export interface MatrixFilters {
  indicators: StudyIndicator[]
  mode: CoverageMode
  scope: string
  query: string
}

export function observation(asset: StudyAsset, side: StudySide, metric: StudyIndicator): StudyObservation {
  return asset[side]?.[metric] ?? {value:null,status:'missing'}
}

export function observed(cell: StudyObservation): boolean {
  return (cell.status==='observed' || cell.status==='zero_observed') && cell.value!==null && Number.isFinite(cell.value)
}

export function paired(asset: StudyAsset, metric: StudyIndicator): boolean {
  return observed(observation(asset,'baseline',metric)) && observed(observation(asset,'latest',metric))
}

const hostTopology:Record<string,{name:string,layer:string}> = {
  btc:{name:'Bitcoin',layer:'L1'}, eth:{name:'Ethereum',layer:'L1'},
}

export function hostLayer(asset:StudyAsset) {
  return (asset.host && hostTopology[asset.host]?.layer) || ''
}

export function hostName(asset:StudyAsset) {
  return asset.host && hostTopology[asset.host]?.name || asset.host || ''
}

// Ancillary USD prices alone cannot establish any on-chain indicator.
export function catalogWithGaps(snapshot:ResearchSnapshot):ResearchSnapshot {
  const ids=snapshot.discovery?.priceOnlyIds
  if(!ids?.length)return snapshot
  const missing:StudyObservation={status:'not_public',value:null,detail:'price_only'}
  const cells=Object.fromEntries(studyIndicators.map(indicator=>[indicator,missing]))
  const assets={...snapshot.assets}
  for(const id of ids){
    if(!assets[id])assets[id]={scope:'provider_asset',host:null,baseline:cells,latest:cells}
  }
  return {...snapshot,assets}
}

export function matchMatrix(snapshot: ResearchSnapshot, filters: MatrixFilters, layerLabel?: (asset:StudyAsset)=>string): string[] {
  if (!filters.indicators.length) return []
  const query=filters.query.trim().toLowerCase()
  return Object.entries(snapshot.assets).filter(([id,asset])=>{
    if(filters.scope && asset.scope!==filters.scope) return false
    const searchFields=[id, asset.name, asset.host, hostName(asset), asset.layer, hostLayer(asset), layerLabel?.(asset), asset.scope, asset.contract]
    if(query && !searchFields.some(field=>field?.toLowerCase().includes(query))) return false
    if(filters.mode==='complete') return filters.indicators.every(metric=>paired(asset,metric))
    if(filters.mode==='partial') return filters.indicators.some(metric=>
      observed(observation(asset,'baseline',metric)) || observed(observation(asset,'latest',metric)))
    return true
  }).map(([id])=>id).sort((a,b)=>a.localeCompare(b,'en'))
}

export function relativeChange(first:StudyObservation, last:StudyObservation){
  if(!observed(first)||!observed(last)) return {status:'missing' as const,value:null}
  if(first.value===0) return {status:'zeroBase' as const,value:null}
  const value=100*(last.value!/first.value!-1)
  return {status:'observed' as const,value}
}

function csvRow(values:unknown[]){
  return values.map(item=>'"'+String(item??'').replaceAll('"','""')+'"').join(',')
}

export function matrixCsv(snapshot:ResearchSnapshot, ids:string[], metrics:StudyIndicator[]){
  const rows:unknown[][]=[['id','scope','host','layer','host_layer','indicator','area','kind','unit','formula','source_codes','period','cutoff_utc','observed_utc','start_utc','acquired_utc','status','value','detail','inputs_json','relative_change_pct','change_status','source','license']]
  for(const id of ids){
    const asset=snapshot.assets[id]
    for(const metric of metrics){
      const def=studyDefinitions[metric]
      const change=relativeChange(observation(asset,'baseline',metric),observation(asset,'latest',metric))
      for(const side of ['baseline','latest'] as const){
        const cell=observation(asset,side,metric)
        const day=side==='baseline'?snapshot.baselineUtc:snapshot.cutoffUtc
        rows.push([id,asset.scope,asset.host,asset.layer,hostLayer(asset),metric,def.area,def.kind,def.unit==='native units'?id+' (native units)':def.unit,def.formula,def.codes.join('|'),side,day,cell.observedUtc??(observed(cell)?day:''),cell.startUtc,snapshot.retrievedUtc,cell.status,observed(cell)?cell.value:null,cell.detail,JSON.stringify(cell.inputs??{}),side==='latest'?change.value:null,side==='latest'?change.status:'','Coin Metrics Community','CC BY-NC 4.0'])
      }
    }
  }
  return rows.map(csvRow).join('\r\n')+'\r\n'
}
