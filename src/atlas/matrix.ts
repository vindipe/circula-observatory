import './matrix.css'
import { esc } from '../ui/html'
import type { Lang } from './copy'
import { loadStudy } from './study-data'
import { loadStudyMonths, monthlyPair } from './study-months'
import { commonIndicators, studyDefinitions, studyIndicators, type ResearchSnapshot, type StudyIndicator, type StudyObservation, type StudyScope } from './study-types'
import { studyText, studyUnit, studyLayerName, type StudyTextKey } from './study-labels'
import { catalogWithGaps, hostLayer, hostName, matchMatrix, matrixCsv, observation, observed, paired, relativeChange, type CoverageMode } from './matrix-model'

type Period = 'frozen' | 'current' | 'custom'
const modes: CoverageMode[] = ['complete','partial','audit']
const scopes: StudyScope[] = ['network','token_deployment','aggregate','provider_asset']
const pageSize=20

export async function mountMatrix(root:HTMLElement,lang:Lang) {
  const t=(key:StudyTextKey)=>studyText(lang,key)
  const url = new URL(location.href)
  const param=(key:string)=>url.searchParams.get(key) || ''
  const knownMetrics=(param('indicators')||'').split(',')
  let metrics=param('indicators') ? studyIndicators.filter(id=>knownMetrics.includes(id)) : [...commonIndicators]
  let mode:CoverageMode=modes.find(id=>id===param('coverage')) || 'complete'
  let scope=scopes.find(id=>id===param('scope')) as string || ''
  let query=param('q')
  let period:Period=param('sample')==='custom'?'custom':param('sample')==='current'?'current':'frozen'
  let selectedId=param('id')||param('asset')
  let page=Number.parseInt(param('page'),10)||1
  let firstDay=param('baseline')
  let lastDay=param('cutoff')
  let snapshot:ResearchSnapshot
  let days:string[]=[]
  let token=0
  let pickerOpen=window.matchMedia('(min-width:701px)').matches

  const fmt=(n:number,compact=false)=>new Intl.NumberFormat(lang,compact?{notation:Math.abs(n)>=1e6?'compact':'standard',maximumFractionDigits:2}:{maximumSignificantDigits:12}).format(n)
  const opt=(key:string,title:string,active:string)=>`<option value="${esc(key)}" ${key===active?'selected':''}>${esc(title)}</option>`
  function save(){
    for(const [key,value] of Object.entries({sample:period,indicators:metrics.length===studyIndicators.length?metrics.join(','):metrics.length?metrics.join(','):'none',coverage:mode,scope,q:query,id:selectedId,page:page>1?String(page):'',baseline:period==='custom'?firstDay:'',cutoff:period==='custom'?lastDay:''})){
      if(value)url.searchParams.set(key,value)
      else url.searchParams.delete(key)
    }
    url.searchParams.delete('asset')
    if(root.isConnected && url.href!==location.href) history.replaceState(null,'',url)
  }
  function indicatorURL(id:string,metric:StudyIndicator){
    const dest=new URL(location.href)
    dest.search=''
    for(const [key,value] of Object.entries({view:'indicator',asset:id,metric,lang,sample:period==='custom'?'current':period,from:snapshot.baselineUtc.slice(0,7),to:snapshot.cutoffUtc.slice(0,7)}))if(value)dest.searchParams.set(key,value)
    return dest.pathname+dest.search
  }
  function periodControls(){
    return `<div class="mx-period" role="group" aria-label="${t('period')}">${(['frozen','current','custom'] as const).map(id=>`<button type="button" data-sample="${id}" aria-pressed="${id===period}">${t(id)}</button>`).join('')}</div>`
  }
  function bindPeriod(){
    root.querySelectorAll<HTMLButtonElement>('[data-sample]').forEach(button=>{button.onclick=()=>{
      if(period===button.dataset.sample) return
      period=button.dataset.sample as Period
      page=1
      save()
      void init(true)
    }})
  }
  function header(){
    return `<section class="a-dhead mx-head"><div><span class="a-kicker"><i></i>Coin Metrics Community</span><h1>${t('matrix')}</h1><p>${t('intro')}</p></div></section>${periodControls()}`
  }
  function dateSelectors(){
    if(period!=='custom')return ''
    const values=(selected:string)=>days.map(d=>opt(d,d,selected)).join('')
    return `<div class="mx-dates"><label class="a-field"><span>${t('from')}</span><select data-day="baseline">${values(firstDay)}</select></label><label class="a-field"><span>${t('to')}</span><select data-day="cutoff">${values(lastDay)}</select></label></div>`
  }
  function renderShell(){
    const areas=['infrastructure','holdings','circulation'] as const
    const group=(area:typeof areas[number])=>`<fieldset><legend>${t(area)}</legend>${studyIndicators.filter(metric=>studyDefinitions[metric].area===area).map(metric=>`<label><input type="checkbox" data-indicator="${metric}" ${metrics.includes(metric)?'checked':''}><span>${t(metric)}</span></label>`).join('')}</fieldset>`
    root.innerHTML=`<div class="mx">${header()}${dateSelectors()}
    <div class="mx-meta"><span>${t('dates')} <b>${esc(snapshot.baselineUtc)} → ${esc(snapshot.cutoffUtc)}</b></span><span>${t('acquired')} <b>${esc(snapshot.retrievedUtc.replace('T',' ').replace(/(?:Z|\+00:00)$/,''))} UTC</b></span></div>
    <details class="mx-picker" data-picker ${pickerOpen?'open':''}><summary><span>${t('indicators')}</span><small data-selected-count>${metrics.length} / ${studyIndicators.length}</small></summary><div class="mx-picker-title"><button type="button" data-common class="a-textlink">${t('common')}</button></div><div class="mx-indicators">${areas.map(group).join('')}</div></details>
    <div class="mx-filters"><label class="a-field"><span>${t('pop')}</span><select data-mode>${modes.map(m=>opt(m,t(m),mode)).join('')}</select></label><label class="a-field"><span>${t('scope')}</span><select data-scope>${opt('',t('all'),scope)}${scopes.map(s=>opt(s,t(s),scope)).join('')}</select></label><label class="a-field"><span>${t('search')}</span><input type="search" data-search value="${esc(query)}" placeholder="btc, usdc_eth, Ethereum…"></label></div>
    <div class="mx-count-row"><p aria-live="polite" data-count></p><button type="button" data-export class="a-button">${t('csv')} ↓</button></div>
    <p class="mx-note">${t('tableNote')}</p><div data-grid></div><div data-detail></div>
    <footer class="mx-method"><p>${t('scopeNote')}</p><p>${t('source')} <a href="https://docs.coinmetrics.io/network-data/network-data-overview" target="_blank" rel="noreferrer">Coin Metrics Community</a> · <a href="https://creativecommons.org/licenses/by-nc/4.0/" rel="noreferrer" target="_blank">CC BY-NC 4.0</a></p></footer>
    </div>`
    bindPeriod()
    const picker=root.querySelector<HTMLDetailsElement>('[data-picker]')!
    picker.ontoggle=()=>{pickerOpen=picker.open}
    root.querySelectorAll<HTMLElement>('[data-day]').forEach(sel=>{sel.onchange=()=>{
      if(sel.dataset.day==='baseline') firstDay=(sel as unknown as HTMLSelectElement).value
      else lastDay=(sel as unknown as HTMLSelectElement).value
      page=1
      save()
      void init(false,sel.dataset.day)
    }})
    root.querySelectorAll<HTMLInputElement>('[data-indicator]').forEach(check=>{check.onchange=()=>{
      metrics=studyIndicators.filter(id=>root.querySelector<HTMLInputElement>('[data-indicator="'+id+'"]')?.checked)
      page=1; update()
    }})
    root.querySelector<HTMLButtonElement>('[data-common]')!.onclick=()=>{
      metrics=[...commonIndicators]
      root.querySelectorAll<HTMLInputElement>('[data-indicator]').forEach(input=>{input.checked=metrics.includes(input.dataset.indicator as StudyIndicator)})
      page=1; update()
    }
    root.querySelector<HTMLElement>('[data-mode]')!.onchange=e=>{mode=(e.target as HTMLSelectElement).value as CoverageMode;page=1;update()}
    root.querySelector<HTMLElement>('[data-scope]')!.onchange=e=>{scope=(e.target as HTMLSelectElement).value;page=1;update()}
    root.querySelector<HTMLInputElement>('[data-search]')!.oninput=e=>{query=(e.target as HTMLInputElement).value;page=1;update()}
  }
  function summaryCell(cell:StudyObservation,metric:StudyIndicator,id:string){
    const text=observed(cell)?fmt(cell.value!,true):'—'
    const valueText=observed(cell)?fmt(cell.value!)+' '+studyUnit(lang,metric,id):t(cell.status)
    const tooltip=metric==='inactiveFloor'?valueText+' · '+t('floorNote'):valueText
    const marker=cell.status==='zero_observed'?`<small>${t('zero_observed')}</small>`:observed(cell)?'':`<small>${t(cell.status)}</small>`
    return `<td title="${esc(tooltip)}" class="${observed(cell)?'':'mx-gap'}">${esc(text)}${marker}</td>`
  }
  function datum(cell:StudyObservation,metric:StudyIndicator,id:string,cutoff:string){
    const isData=observed(cell)
    const unit=studyUnit(lang,metric,id)
    const day=cell.observedUtc || (isData?cutoff:'')
    const sources=Object.entries(cell.inputs||{})
    const note=metric==='inactiveFloor'?t('floorNote'):metric==='transfers30d'||metric==='activeAddresses30d'?t('transfersNote'):metric==='exchangeShare'||metric==='exchangeValue'?t('exchangeNote'):''
    return `<div class="mx-datum"><span class="mx-date">${esc(cutoff)}</span><strong>${isData?esc(fmt(cell.value!))+' <small>'+esc(unit)+'</small>':esc(t(cell.status))}</strong>
    ${cell.status==='zero_observed'?'<p>'+t('zero_observed')+'</p>':''}
    ${cell.startUtc && day?'<p>'+esc(cell.startUtc)+' → '+esc(day)+'</p>':''}
    ${day&&day!==cutoff?'<p>'+esc(day)+'</p>':''}
    ${metric==='exchangeValue' && day?'<p>'+t('priceDate')+' '+esc(day)+'</p>':''}
    ${cell.detail?'<p>'+esc(cell.detail==='price_only'?t('priceOnly'):cell.detail==='host_chain'?t('scopeNote'):cell.detail)+'</p>':''}
    ${sources.length||note?`<details class="mx-inputs"><summary>${t('inputs')}</summary>${sources.map(([key,v])=>'<div><code>'+esc(key)+'</code> '+esc(v)+'</div>').join('')}${note?'<p>'+esc(note)+'</p>':''}</details>`:''}</div>`
  }
  function inspect(){
    const host=root.querySelector<HTMLElement>('[data-detail]')!
    const asset=snapshot.assets[selectedId]
    if(!asset){host.innerHTML='';return}
    const info=metrics.map(metric=>{
      const def=studyDefinitions[metric]
      const a=observation(asset,'baseline',metric),b=observation(asset,'latest',metric)
      const delta=relativeChange(a,b)
      return `<article class="mx-item"><div><span class="mx-kind">${t(def.area)} · ${t(def.kind)}</span><h3>${t(metric)}</h3><a data-atlas href="${esc(indicatorURL(selectedId,metric))}">${t('open')} ↗</a></div><div class="mx-values">${datum(a,metric,selectedId,snapshot.baselineUtc)}${datum(b,metric,selectedId,snapshot.cutoffUtc)}</div>
      <div class="mx-calculation"><span>${t('change')} <b>${delta.value!==null?esc(fmt(delta.value))+'%':t(delta.status==='zeroBase'?'zeroBase':'missing')}</b></span> <span>${t('formula')} <code>${esc(def.formula)}</code></span></div></article>`
    }).join('')
    host.innerHTML=`<section tabindex="-1" class="mx-detail-panel" aria-label="${t('detail')}"><div class="mx-panel-title"><div><p class="a-kicker">${t('detail')}</p><h2>${esc(selectedId)} <small>${t(asset.scope)}</small></h2>${asset.host?'<p>'+t('host')+' <b>'+esc(hostName(asset))+'</b></p>':''}<p>${t('layer')} <b>${esc(studyLayerName(lang,asset.layer))}</b></p>${hostLayer(asset)?'<p>'+t('hostLayer')+' <a href="https://ethereum.org/layer-2/learn/" target="_blank" rel="noreferrer">'+esc(hostLayer(asset))+'</a></p>':''}</div><button type="button" data-close class="a-textlink">${t('close')} ×</button></div>${info}</section>`
    host.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>{
      const prior=selectedId;selectedId='';update()
      const button=[...root.querySelectorAll<HTMLButtonElement>('[data-row]')].find(b=>b.dataset.row===prior)
      button?.focus()
    }
  }
  function update(){
    root.querySelector<HTMLElement>('[data-selected-count]')!.textContent=metrics.length+' / '+studyIndicators.length
    const invalid=period==='custom' && firstDay>lastDay
    const ids=invalid?[]:matchMatrix(snapshot,{indicators:metrics,mode,scope,query},asset=>studyLayerName(lang,asset.layer))
    if(!ids.includes(selectedId))selectedId=''
    const complete=ids.filter(id=>metrics.every(metric=>paired(snapshot.assets[id],metric))).length
    const pages=Math.max(1,Math.ceil(ids.length/pageSize));page=Math.max(1,Math.min(pages,page))
    root.querySelector<HTMLElement>('[data-count]')!.textContent=ids.length+' '+t('count')+' · '+complete+' '+t('paired')
    const grid=root.querySelector<HTMLElement>('[data-grid]')!
    const row=(id:string)=>{
      const asset=snapshot.assets[id]
      return `<tr><th scope="row"><button type="button" data-row="${esc(id)}" aria-label="${t('detail')} · ${esc(id)}" aria-expanded="${id===selectedId}">${esc(id)} ↗</button><small>${t(asset.scope)}${asset.host&&asset.host!==id?' · '+esc(hostName(asset)):''}</small></th>${metrics.map(metric=>summaryCell(observation(asset,'latest',metric),metric,id)).join('')}</tr>`
    }
    grid.innerHTML=ids.length?`<div class="a-table-scroll mx-table" tabindex="0" role="region" aria-label="${t('matrix')}"><table><thead><tr><th scope="col">ID</th>${metrics.map(m=>'<th scope="col">'+t(m)+'<small>'+esc(studyUnit(lang,m))+'</small></th>').join('')}</tr></thead><tbody>${ids.slice((page-1)*pageSize,page*pageSize).map(row).join('')}</tbody></table></div>
      <div class="a-pages"><button type="button" data-page="-1" ${page===1?'disabled':''}>${t('previous')}</button><span>${page} / ${pages}</span><button type="button" data-page="1" ${page===pages?'disabled':''}>${t('next')}</button></div>`:
      `<p class="mx-empty">${invalid?t('invalidDates'):metrics.length?t('empty'):t('emptySelection')}</p>`
    grid.querySelectorAll<HTMLButtonElement>('[data-row]').forEach(b=>{b.onclick=()=>{
      selectedId=b.dataset.row!;update()
      const panel=root.querySelector<HTMLElement>('.mx-detail-panel')
      panel?.focus({preventScroll:true});panel?.scrollIntoView({block:'start'})
    }})
    grid.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(b=>{b.onclick=()=>{
      page+=Number(b.dataset.page);update()
      root.querySelector<HTMLElement>('.mx-table')?.focus()
    }})
    const exp=root.querySelector<HTMLButtonElement>('[data-export]')!
    exp.disabled=!ids.length
    exp.onclick=()=>{
      const blob=new Blob([matrixCsv(snapshot,ids,metrics)],{type:'text/csv;charset=utf-8'})
      const path=URL.createObjectURL(blob)
      const a=document.createElement('a');a.href=path;a.download='circula-'+snapshot.baselineUtc+'_'+snapshot.cutoffUtc+'.csv'
      document.body.appendChild(a);a.click();a.remove()
      window.setTimeout(()=>URL.revokeObjectURL(path),1000)
    }
    inspect()
    save()
  }
  async function init(restoreTab=false,focusDay?:string){
    const request=++token
    root.innerHTML='<div class="mx">'+header()+'<div role="status" class="mx-empty">'+t('loading')+'</div></div>'
    bindPeriod()
    try{
      if(period==='custom'){
        const [history,latest]=await Promise.all([loadStudyMonths(),loadStudy('current')])
        if(request!==token||!root.isConnected)return
        days=history.dates
        if(!days.includes(firstDay))firstDay=days.includes(latest.baselineUtc)?latest.baselineUtc:days[0]
        if(!days.includes(lastDay))lastDay=days.at(-1)!
        snapshot=catalogWithGaps(monthlyPair(history,latest,firstDay,lastDay))
      }else{
        const data=await loadStudy(period)
        if(request!==token||!root.isConnected)return
        snapshot=catalogWithGaps(data)
      }
      renderShell();update()
      if(restoreTab)root.querySelector<HTMLButtonElement>('[data-sample="'+period+'"]')?.focus({preventScroll:true})
      if(focusDay)root.querySelector<HTMLElement>('[data-day="'+focusDay+'"]')?.focus({preventScroll:true})
    }catch{
      if(request!==token||!root.isConnected)return
      root.innerHTML='<div class="mx">'+header()+'<p class="mx-empty" role="alert">'+t('unavailable')+' <button type="button" data-retry class="a-textlink">'+t('retry')+'</button></p></div>'
      bindPeriod()
      root.querySelector<HTMLButtonElement>('[data-retry]')!.onclick=()=>void init()
    }
  }
  await init()
}
