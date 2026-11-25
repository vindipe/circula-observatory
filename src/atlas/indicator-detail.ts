import { esc } from '../ui/html'
import { tr, type Lang } from './copy'
import type { Bundle, Series } from './data'
import { detailMethod, detailText } from './indicator-copy'
import { mountPlot, type AtlasSeries } from './plot'
import { rulePanel } from './rules'
import { proposalGaps } from './proposal-gaps'
import { studyText, studyUnit } from './study-labels'
import { monthCell, type StudyMonths } from './study-months'
import { studyDefinitions, studyIndicators, type ResearchSnapshot, type StudyAsset, type StudyIndicator,
  type StudyObservation } from './study-types'
import './indicator-detail.css'

const provider = 'Coin Metrics Community'
const source = 'https://community-api.coinmetrics.io/v4/catalog-v2/asset-metrics'
const license = 'CC BY-NC 4.0'
const licenseUrl = 'https://creativecommons.org/licenses/by-nc/4.0/'
const missing:StudyObservation = {value:null,status:'missing'}
const simpleUTXO = new Set(['btc','ltc','doge','bch','btg','dgb','dash','vtc'])

/** Only reviewed count definitions may be compared across distinct assets. */
export function detailComparisonFamily(asset:string, row:StudyAsset, metric:StudyIndicator) {
  if (row.scope === 'network' && simpleUTXO.has(asset) && ['transactions','blocks'].includes(metric))
    return 'utxo-' + metric
  if (row.scope === 'token_deployment' && row.host === 'eth' &&
      ['transactions','fundedAddresses','activeAddresses30d','transfers30d','inactiveFloor'].includes(metric))
    return 'erc20-' + metric
  if (row.scope === 'network' && ['btc','eth'].includes(asset) && ['exchangeShare','exchangeValue'].includes(metric))
    return 'exchange-attribution-' + metric
  return null
}

const month = (day:string) => day.slice(0,7)
const unitCode = (metric:StudyIndicator,id:string,s?:Series) => metric==='supply'
  ? (s?.symbol || id.split('_')[0].toUpperCase()) : studyDefinitions[metric].unit
const csvField = (value:unknown) => '"' + String(value ?? '').replaceAll('"','""') + '"'
const tagOption = (value:string, label:string, active:string) =>
  `<option value="${esc(value)}" ${value === active ? 'selected' : ''}>${esc(label)}</option>`

function endCell(snapshot:ResearchSnapshot,id:string,metric:StudyIndicator,day:string) {
  if (day===snapshot.cutoffUtc) return snapshot.assets[id]?.latest[metric] || missing
  if (day===snapshot.baselineUtc) return snapshot.assets[id]?.baseline[metric] || missing
  return missing
}
function periodStart(cell:StudyObservation,metric:StudyIndicator,day:string,asset:StudyAsset) {
  if (cell.startUtc) return cell.startUtc
  const kind=studyDefinitions[metric].kind
  if (kind==='bound' || kind==='mean') {
    const date=new Date(day+'T00:00:00Z')
    date.setUTCDate(date.getUTCDate()-29)
    return date.toISOString().slice(0,10)
  }
  if(kind==='history') return asset.starts?.[metric==='transactions'?'TxCnt':'BlkCnt']||''
  return day
}

export function mountIndicatorDetail(host:HTMLElement, frozen:ResearchSnapshot, current:ResearchSnapshot, lang:Lang,
                                     community?:Bundle, monthly?:StudyMonths) {
  const d = (key:Parameters<typeof detailText>[1]) => detailText(lang,key)
  const t = (key:Parameters<typeof studyText>[1]) => studyText(lang,key)
  const a = (key:Parameters<typeof tr>[1]) => tr(lang,key)
  const format = (value:number, places=4) => new Intl.NumberFormat(lang,{maximumFractionDigits:places}).format(value)
  const metadata = new Map<string,Series>()
  for(const s of community?.series||[]) if(!metadata.has(s.asset)) metadata.set(s.asset,s)
  const params = () => new URLSearchParams(location.search)
  const update = (fields:Record<string,string>, replace=false) => {
    const p=params()
    for(const [k,v] of Object.entries(fields)) { if(v) p.set(k,v); else p.delete(k) }
    history[replace?'replaceState':'pushState'](null,'',location.pathname+'?'+p.toString())
  }
  const link = (fields:Record<string,string>) => {
    const p=params()
    for(const [k,v] of Object.entries(fields)) { if(v) p.set(k,v); else p.delete(k) }
    return esc(location.pathname+'?'+p.toString())
  }
  const change=(fields:Record<string,string>, focus='')=>{
    update(fields)
    render()
    if(focus) host.querySelector<HTMLElement>(focus)?.focus({preventScroll:true})
  }

  function render(){
    const p=params(), sample=p.get('sample')==='frozen'?'frozen':'current'
    const snapshot=sample==='frozen'?frozen:current
    const historyRows=sample==='current'?monthly:undefined
    const metric=studyIndicators.find(m=>m===p.get('metric'))||'transactions'
    const def=studyDefinitions[metric], asset=p.get('asset')||'btc'
    const availableDates=historyRows?.dates||[snapshot.baselineUtc,snapshot.cutoffUtc]
    const custom=p.get('sample')==='custom'
    const requestedStart=p.get('from')||(custom?p.get('baseline'):'')
    const requestedEnd=p.get('to')||(custom?p.get('cutoff'):'')
    const from=requestedStart?.slice(0,7)||month(availableDates[0])
    const to=requestedEnd?.slice(0,7)||month(availableDates.at(-1)!)
    const dates=availableDates.filter(date=>month(date)>=from && month(date)<=to)
    const soonest=month(availableDates[0]), latest=month(availableDates.at(-1)!)
    const dateForMonth=new Map(dates.map(date=>[month(date), date]))
    let date=dateForMonth.get(month(p.get('month')||''))||dates.at(-1)||''
    const person=snapshot.assets[asset]
    const cell=(id:string,key:StudyIndicator,day:string): StudyObservation =>
      historyRows ? monthCell(historyRows,snapshot,id,key,day) : endCell(snapshot,id,key,day)
    const entity=(id:string)=>{
      const s=metadata.get(id),r=snapshot.assets[id]
      return [id,s?.name||r?.name,r?.host&&r.host!==id?r.host:'',s?.contract||r?.contract]
        .filter((x,i,arr)=>x && arr.indexOf(x)===i).join(' · ')
    }
    const universe=Object.keys(snapshot.assets).sort()
    const populated=(id:string)=>dates.some(day=>cell(id,metric,day).value!=null)
    const family=person?detailComparisonFamily(asset,person,metric):null
    const knownDays=dates.filter(day=>cell(asset,metric,day).value!=null)
    const choices=universe.filter(id=>id!==asset && family && family===detailComparisonFamily(id,snapshot.assets[id],metric)
      && knownDays.some(day=>cell(id,metric,day).value!=null))
    const compare=choices.find(id=>id===p.get('compare'))
    const selected=compare?[asset,compare]:[asset]
    const picker=(id:string,label:string,options:string[],value:string,placeholder='')=>
      `<label class="a-field" for="${id}"><span>${esc(label)}</span><input id="${id}" type="search" list="${id}-list" value="${esc(value?entity(value):'')}" placeholder="${esc(placeholder)}" autocomplete="off"><datalist id="${id}-list">${options.map(key=>`<option value="${esc(entity(key))}"></option>`).join('')}</datalist></label>`
    const compatible=choices.length?picker('study-compare',a('compare'),choices,compare||'',d('none')):''
    const groups=Object.entries(studyDefinitions).reduce((out,[key,value])=>{
      const ids=out.get(value.area)||[]
      ids.push(key as StudyIndicator);out.set(value.area,ids);return out
    },new Map<typeof def.area,StudyIndicator[]>())
    const metricOptions=[...groups].map(([area,metrics])=>
      `<optgroup label="${t(area)}">${metrics.map(m=>tagOption(m,t(m),metric)).join('')}</optgroup>`).join('')
    // The searchable menu exposes observed series. Direct links can still inspect an uncovered ID.
    const assetOptions=universe.filter(id=>id===asset || populated(id))
    const list=assetOptions
    const fiscal=sample==='frozen'
    host.innerHTML=`<div class="di-header"><div><span class="a-kicker"><i></i>${t(def.area)}</span><h1>${esc(t(metric))}</h1><p>${t(def.kind)} · ${d('title')}</p></div></div>
      <section class="a-controls di-controls"><div class="a-fields">
        <label class="a-field"><span>${d('interval')}</span><select id="study-sample">${['current','frozen'].map(v=>tagOption(v,d(v as 'frozen'|'current'),sample)).join('')}</select></label>
        <label class="a-field"><span>${a('measure')}</span><select id="study-metric">${metricOptions}</select></label>
        ${picker('study-asset',d('legend'),list,asset)}${compatible}</div>
        <div class="a-period">${fiscal?`<span class="di-period-label">${d('compact')}</span>`:`<div class="a-zoom">${[['12','year'],['60','five'],['all','all']].map(([v,k])=>`<button type="button" data-detail-range="${v}">${a(k as 'year'|'five'|'all')}</button>`).join('')}</div>`}
          <label>${a('from')} <input type="month" id="study-from" value="${esc(from)}" min="${soonest}" max="${latest}"></label>
          <label>${a('to')} <input type="month" id="study-to" value="${esc(to)}" min="${soonest}" max="${latest}"></label>
          <button type="button" id="study-reset" class="a-textlink">↺ ${a('reset')}</button>
        </div></section>
      ${!person?`<p role="status" class="a-notice">${d('unknown')} · ${esc(asset)}</p>`:
      `<div class="di-scope"><strong>${esc(asset)}</strong><span>${esc(t(person.scope))}</span>${person.host&&person.scope==='token_deployment'?`<span>${d('host')} · <a data-atlas href="${link({asset:person.host,metric:'blocks',compare:'',month:''})}">${esc(person.host.toUpperCase())} ↗</a></span>`:''}</div>
      ${person.scope==='token_deployment'?'<p class="di-note">'+d('hostNote')+'</p>':''}
      <div id="detail-plot" class="a-chartbox"></div>
      <p class="di-note">${compare?d('comparison'):p.has('compare')?d('incompatible'):''}</p>
      <section class="di-point"><div class="di-point-head"><h2>${d('observations')}</h2>${dates.length?`<label class="a-field"><span>${d('requestDate')} · UTC</span><select id="study-point">${dates.slice().reverse().map(day=>tagOption(day,day,date)).join('')}</select></label>`:''}</div><div id="detail-reading"></div></section>
      <details class="di-method" open><summary>${a('methods')}</summary><p>${esc(detailMethod(lang,metric))} ${metric==='inactiveFloor'?d('bound'):''}</p><code>${esc(def.formula)}</code>
      <div class="a-cite"><span>${a('source')} <a href="${source}" target="_blank" rel="noreferrer">${provider} ↗</a></span><a href="${licenseUrl}" target="_blank" rel="noreferrer">${license} ↗</a><span>${d('acquired')} · ${esc(historyRows?.retrievedUtc||snapshot.retrievedUtc)}</span></div></details>
      <section id="detail-companions"></section>
      ${rulePanel(def.area==='infrastructure'?'history':def.area==='circulation'?'circulation':'context',lang,asset)}
      ${proposalGaps(current,asset,lang)}`}
      <div class="a-bottom"><a class="a-textlink" data-atlas href="${link({view:'matrix',indicators:metric,asset:'',metric:'',compare:'',month:'',table:'',from:'',to:'',sample:!fiscal&&requestedStart&&dates.length?'custom':sample,baseline:!fiscal&&requestedStart&&dates.length?dates[0]:'',cutoff:!fiscal&&requestedStart&&dates.length?dates.at(-1)!:''})}">${d('catalog')} ↗</a></div>`
    const el=<T=HTMLElement>(selector:string)=>host.querySelector(selector) as T
    function bindSearch(selector:string,options:string[],field:string,optional:boolean) {
      const input=el<HTMLInputElement>(selector)
      if(!input) return
      input.onfocus=()=>input.select()
      input.oninput=()=>input.setCustomValidity('')
      input.onchange=()=>{
        const raw=input.value.trim().toLowerCase()
        const found=options.find(id=>[id,entity(id),metadata.get(id)?.contract,metadata.get(id)?.name]
          .some(item=>item?.toLowerCase()===raw))
        if(found||(!raw&&optional)) change({[field]:found||'',...(field==='asset'?{compare:''}:{}),month:''},selector)
        else {input.setCustomValidity(d('valid'));input.reportValidity()}
      }
    }
    bindSearch('#study-asset',list,'asset',false)
    bindSearch('#study-compare',choices,'compare',true)
    el<HTMLSelectElement>('#study-metric').onchange=e=>change({metric:(e.target as HTMLSelectElement).value,compare:'',month:'',table:''},'#study-metric')
    el<HTMLSelectElement>('#study-sample').onchange=e=>change({sample:(e.target as HTMLSelectElement).value,from:'',to:'',baseline:'',cutoff:'',month:''},'#study-sample')
    for(const id of ['from','to']) {
      const field=el<HTMLInputElement>('#study-'+id)
      field.oninput=()=>field.setCustomValidity('')
      field.onchange=()=>{
        const f=el<HTMLInputElement>('#study-from').value, z=el<HTMLInputElement>('#study-to').value
        if(f && z && f>z){field.setCustomValidity(d('invalidRange'));field.reportValidity();return}
        change({from:f,to:z,month:''},'#study-'+id)
      }
    }
    el('#study-reset').onclick=()=>change({sample,from:'',to:'',baseline:'',cutoff:'',month:'',table:'',compare:''},'#study-reset')
    host.querySelectorAll<HTMLButtonElement>('[data-detail-range]').forEach(b=>b.onclick=()=>{
      const count=b.dataset.detailRange!, first=count==='all'?'':month(availableDates.at(-Number(count))||availableDates[0])
      change({sample,baseline:'',cutoff:'',from:first,to:count==='all'?'':latest,month:''})
    })
    if(!person) return
    const data=selected.map(id=>{
      const points: [string,number][]=[]
      for(const day of dates){ const v=cell(id,metric,day).value; if(v!=null) points.push([month(day),v]) }
      const r=snapshot.assets[id], s=metadata.get(id)
      return {asset:id,name:id.toUpperCase(),network:r.host||id,contract:s?.contract||r.contract,metric,label:t(metric),
        unit:metric==='supply'?unitCode(metric,id,s):studyUnit(lang,metric),kind:def.kind,scope:r.scope,method:def.formula,
        source:provider,sourceUrl:source,license,licenseUrl,comparison:family,points,dashboard:'indicator'} satisfies AtlasSeries
    })
    function exportRows(months:string[],active:number[]) {
      const headings=['reference_date_utc','observed_utc','start_utc','acquired_utc','asset','scope','host','contract','indicator','source_codes','formula','canonical_unit','value','status','comparison_status','inputs','source','license']
      const rows:(string|number|null)[][]=[headings]
      for(const key of months) {
        const day=dateForMonth.get(key)
        if(!day)continue
        const allObserved=selected.every(id=>cell(id,metric,day).value!=null)
        for(const index of active) {
          const id=selected[index], r=snapshot.assets[id], c=cell(id,metric,day)
          rows.push([day,c.observedUtc||(c.value!=null?day:''),periodStart(c,metric,day,r),historyRows?.retrievedUtc||snapshot.retrievedUtc,
            id,r.scope,r.host,metadata.get(id)?.contract||r.contract||'',metric,def.codes.join(' + '),def.formula,unitCode(metric,id,metadata.get(id)),
            allObserved?c.value:null,c.status,allObserved?'observed':'common_observation_missing',JSON.stringify(c.inputs||{}),provider,license])
        }
      }
      const blob=new Blob([rows.map(row=>row.map(csvField).join(',')).join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'})
      const url=URL.createObjectURL(blob), anchor=document.createElement('a')
      anchor.href=url;anchor.download=['circula',sample,selected.join('-'),metric,months[0],months.at(-1)].join('_')+'.csv';anchor.click()
      setTimeout(()=>URL.revokeObjectURL(url),5000)
    }
    function inspect(day:string,moveUrl:boolean) {
      date=day
      if(moveUrl)update({month:month(day)},true)
      const pick=el<HTMLSelectElement>('#study-point')
      if(pick)pick.value=day
      const cards=selected.map(id=>{
        const c=cell(id,metric,day), r=snapshot.assets[id], inputs=c.inputs||{}, unit=unitCode(metric,id,metadata.get(id))
        const observed=c.observedUtc||(c.value!=null?day:'—'),start=periodStart(c,metric,day,r)
        const labels=(Object.entries(inputs).filter(([,v])=>v!=null)).map(([key,v])=>
          `<dt><code>${esc(key)}</code></dt><dd>${typeof v==='number'?format(v,12):esc(String(v))}</dd>`).join('')
        const F=inputs.AdrBalCnt,sum=inputs.AdrActCntSum30d
        const explain=metric==='inactiveFloor' && typeof F==='number' && typeof sum==='number' ? `
          <p class="di-calculation"><code>100 × max(0, ${format(F)} − ${format(sum)}) / ${format(F)}</code> = <strong>${F===0?t('undefined'):(c.value!=null?format(c.value)+' %':'—')}</strong></p><p>${d('bound')}</p>`:''
        const price=metric==='exchangeValue' && inputs.PriceUSD!=null?`<p>${d('price')} <time>${esc(observed)}</time> · ${format(Number(inputs.PriceUSD),8)} USD</p>`:''
        let movement=''
        if(sample==='frozen' && dates.length===2 && day===snapshot.cutoffUtc) {
          const base=cell(id,metric,snapshot.baselineUtc).value
          const v=base!=null&&c.value!=null&&base!==0 ? format((c.value/base-1)*100)+' %' : base===0?t('undefined')+' (0)': '—'
          movement=`<div><dt>${d('frozenChange')}</dt><dd>${v}</dd></div>`
        }
        return `<article class="di-reading"><h3>${esc(id.toUpperCase())}</h3><div class="di-observed">${c.value===null?'—':format(c.value,metric==='supply'?8:2)+' <small>'+esc(metric==='supply'?unit:studyUnit(lang,metric))+'</small>'}</div>
          <p class="di-status">${esc(t(c.status))}${c.detail?' · '+esc(c.detail):''}</p><dl class="di-facts"><div><dt>${d('measured')}</dt><dd>${esc(observed)}</dd></div>
          ${start&&start!==day?`<div><dt>${d('period')}</dt><dd>${esc(start)} → ${esc(day)}</dd></div>`:''}${movement}</dl>
          ${labels?`<details class="di-raw" ${['inactiveFloor','exchangeValue','exchangeShare'].includes(metric)?'open':''}><summary>${d('inspect')}</summary><dl>${labels}</dl>${explain}${price}</details>`:''}</article>`
      })
      el('#detail-reading').innerHTML=cards.join('')
      const cohort:StudyIndicator[][]=[['fundedAddresses','supply','inactiveFloor'],['exchangeShare','exchangeValue'],['transactions','blocks','ledgerBytes'],['transfers30d','activeAddresses30d']]
      const peers=cohort.find(group=>group.includes(metric))||[]
      const columnHeads=peers.map(key=>`<th scope="col"><a data-atlas href="${link({metric:key,compare:'',month:month(day),table:''})}">${t(key)}</a><small>${t(studyDefinitions[key].kind)}</small></th>`).join('')
      const rows=selected.map(id=>{
        const values=peers.map(key=>{
          const c=cell(id,key,day)
          return `<td>${c.value==null?esc(t(c.status)):format(c.value,key==='supply'?8:2)+' '+esc(key==='supply'?unitCode(key,id,metadata.get(id)):studyUnit(lang,key))}</td>`
        }).join('')
        return `<tr><th scope="row">${esc(id.toUpperCase())}</th>${values}</tr>`
      }).join('')
      el('#detail-companions').innerHTML=`<h2>${d('siblings')}</h2><div class="di-period-label">${esc(day)} UTC</div><div class="di-table-wrap" tabindex="0" role="region" aria-label="${d('siblings')}"><table><thead><tr><th>${d('legend')}</th>${columnHeads}</tr></thead><tbody>${rows}</tbody></table></div>`
    }
    if(!date){
      el('#detail-plot').textContent=d('noChart')
      return
    }
    const measurable=dates.some(day=>selected.every(id=>cell(id,metric,day).value!=null))
    const plot=mountPlot(el('#detail-plot'),data,{lang,title:t(metric),from,to,bars:fiscal,selected:month(date),table:p.get('table')==='1',
      sampleMonths:fiscal?dates.map(month):undefined,displayFractionDigits:metric==='supply'?8:2,tooltipNote:metric==='inactiveFloor'?d('bound'):undefined,
      onViewChange:table=>update({table:table?'1':''},true),onExport:exportRows,
      onInspect:m=>{const day=dateForMonth.get(m);if(day)inspect(day,true)}})
    if(!measurable) el('#detail-plot').innerHTML=`<p role="status">${d('noChart')}</p>`
    inspect(date,false)
    plot.inspect(month(date))
    const calendar=el<HTMLSelectElement>('#study-point')
    if(calendar)calendar.onchange=()=>{inspect(calendar.value,true);plot.inspect(month(calendar.value))}
  }
  render()
}
