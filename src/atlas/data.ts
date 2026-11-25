import type { AtlasSeries } from './plot'
export type Series = AtlasSeries & {symbol?:string;scopeI18n?:Record<string,string>;methodI18n?:Record<string,string>;lastObservation?:string;latestObservation?:string}
export const providers=['history','holdings','distribution','stellar','community'] as const
export type Provider=typeof providers[number]
export interface Bundle {series:Series[]; unavailable:unknown[]; [key:string]:unknown}
declare global { interface Window {__atlas?:Record<Provider,Bundle>} }
async function manifest(){
 const r=await fetch('/atlas/current.json',{cache:'no-cache'})
 if(r.status===404||(r.ok&&r.headers.get('Content-Type')?.includes('text/html')))return {}
 if(!r.ok)throw Error('Snapshot manifest unavailable')
 const m=await r.json() as {schema:number;release:string;files:Record<string,string>}
 if(m.schema!==1 || !/^[a-f0-9]{64}$/.test(m.release)||providers.some(k=>m.files?.[k]!=='/atlas/releases/'+m.release+'/'+k+'.json'))throw Error('Invalid release manifest')
 return m.files
}
let release:Promise<Record<string,string>>|undefined
const inflight=new Map<Provider,Promise<Bundle>>()
export const cache:Partial<Record<Provider,Bundle>>=window.__atlas||{}
export async function loadData(keys:Provider[]){
 release??=manifest().catch(e=>{release=undefined;throw e})
 const files=await release
 await Promise.all(keys.map(async k=>{
  if(cache[k])return
  let request=inflight.get(k)
  if(!request){
   request=fetch(files[k]||'/atlas/'+k+'.json').then(async r=>{
    if(!r.ok||!r.headers.get('Content-Type')?.includes('json'))throw Error('Missing snapshot '+k)
    const b=await r.json() as Bundle
    if(!Array.isArray(b.series)||!Array.isArray(b.unavailable))throw Error('Invalid snapshot '+k)
    cache[k]=b
    return b
   }).finally(()=>inflight.delete(k))
   inflight.set(k,request)
  }
  await request
 }))
}
