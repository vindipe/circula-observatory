import '@fontsource-variable/inter/wght.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import './style.css'
import './plot.css'
import './lorenz.css'
import { tr, langs, topics, type Key, type Lang, type Topic } from './copy'
import { figure, logo, arrow } from './figures'
import { cache, providers, loadData, type Bundle, type Provider, type Series } from './data'
import { mountPlot } from './plot'
import { mountCoverage } from './coverage'
import { mountLorenz } from './lorenz'
import { mountStellarActivity } from './stellar-activity'
import { mountEvents } from './events'
import { label, methodText, scopeText } from './labels'
import { esc } from '../ui/html'
import { resourcePaths } from './resource-paths'
import { mountMatrix } from './matrix'
import { mountIndicatorDetail } from './indicator-detail'
import { rulePanel } from './rules'
import { loadStudy } from './study-data'
import { loadStudyMonths } from './study-months'
import type { ResearchSnapshot } from './study-types'

const root=document.querySelector<HTMLElement>('#app')!
const previewTopics=topics.slice(0,5)
const data=cache as Record<Provider,Bundle>
let series:Series[]=[]
const params=()=>new URLSearchParams(location.search)
const get=(key:string)=>params().get(key)||''
const lang=():Lang=>langs.find(l=>l===get('lang'))||'en'
const t=(key:Key)=>tr(lang(),key)
function url(values:Record<string,string|undefined>, keep=false){
 const p=keep?params():new URLSearchParams()
 if(lang()!=='en')p.set('lang',lang())
 for(const [k,v] of Object.entries(values)){if(v)p.set(k,v);else p.delete(k)}
 return location.pathname+(p.size?'?'+p:'')
}
function nav(values:Record<string,string|undefined>,keep=false,redraw=true,replace=false){
 const target=url(values,keep)
 if(target!==location.pathname+location.search)history[replace?'replaceState':'pushState'](null,'',target)
 if(redraw)render()
}
const link=(values:Record<string,string|undefined>,text:string,cls='')=>`<a data-atlas href="${esc(url(values))}" class="${cls}">${text}</a>`
const option=(value:string,text:string,selected:string)=>`<option value="${esc(value)}" ${selected===value?'selected':''}>${esc(text)}</option>`
const coverageLink=()=>link({view:'coverage'},t('viewCoverage')+' '+arrow,'a-textlink')
const formatMonth=(m:string)=>new Intl.DateTimeFormat(lang(),{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-15T12:00:00Z'))
const primaryIds:Record<Topic,string>={history:'history_gb',inactive:'inactive_365d',concentration:'gini_grouped_floor',expiration:'',circulation:'TxCnt',context:'AdrBalCnt'}
function primary(topic:Topic){return series.find(s=>s.dashboard===topic && s.asset==='btc'&&s.metric===primaryIds[topic])||series.find(s=>s.dashboard===topic)}
function deep(topic:Topic,s?:Series){return {view:topic,asset:s?.asset||(topic==='expiration'?'xlm':'btc'),metric:s?.metric||(topic==='expiration'?'ttl_events':primaryIds[topic])}}
function shell(page:string,body:string){
 const l=lang()
 document.documentElement.lang=l
 const skip=document.querySelector<HTMLAnchorElement>('.skip')
 if(skip) skip.textContent=t('skip')
 const navLink=(id:string,name:string)=>link({view:id==='home'?'':id},name,'nav-link '+(page===id?'current':''))
 root.innerHTML=`<header class="a-header"><div class="a-bar"><a data-atlas class="a-brand" href="${esc(url({}))}">${logo}<span>CIRCULA<small>Observatory</small></span></a><nav aria-label="${t('atlas')}">${navLink('home',t('atlas'))}${navLink('matrix',t('matrix'))}<details class="a-menu"><summary class="nav-link ${topics.some(x=>x.id===page)?'current':''}">${t('dashboards')} <span aria-hidden="true">⌄</span></summary><div>${link({view:'indicator',asset:'btc',metric:'transactions'},t('studyLink'))}${topics.map(x=>link(deep(x.id,primary(x.id)),t(x.id))).join('')}</div></details>${navLink('coverage',t('coverage'))}</nav><label class="a-lang"><span aria-hidden="true">◎</span><select aria-label="Language / Lingua / Langue / Sprache" id="locale">${langs.map(a=>option(a,a.toUpperCase(),l)).join('')}</select></label></div></header><main id="main" class="a-main" tabindex="-1">${body}</main><footer class="a-footer"><span>CIRCULA Observatory</span><a href="https://circula.unine.ch/" target="_blank" rel="noreferrer">CIRCULA · Université de Neuchâtel ↗</a><a href="https://github.com/vindipe/circula-observatory" target="_blank" rel="noreferrer">GitHub ↗</a></footer>`
 ;root.querySelector<HTMLElement>('#locale')!.onchange=e=>nav({lang:(e.target as HTMLSelectElement).value},true)
 document.title=(page==='home'?t('title'):t(page as Key))+' · CIRCULA Observatory'
}
function evidence(s:Series){
 const first=s.points[0][0],last=s.points.at(-1)![0]
 const end=s.lastObservation||s.latestObservation||last
 return `<div class="a-evidence"><div class="a-cite"><span>${t('last')} · ${esc(end)}</span><span>${t('source')} <a href="${esc(s.sourceUrl)}" target="_blank" rel="noreferrer">${esc(s.source)} ↗</a></span><a href="${esc(s.licenseUrl)}" target="_blank" rel="noreferrer">${esc(s.license)} ↗</a></div><details><summary>${t('methods')}</summary><p><strong>${t('period')}</strong> ${first} — ${last} · ${t('last')}: ${esc(end)}</p><p>${esc(scopeText(s,lang()))} · <code>${esc(s.metric)}</code></p><p>${esc(methodText(s,lang()))}</p></details></div>`
}
let homeSnapshot:ResearchSnapshot | undefined
function home(){
 const path=resourcePaths.find(x=>x.id===get('resource'))||resourcePaths[0]
 const usesStudy=path.target.view==='indicator'
 const s=usesStudy?undefined:primary(path.figure)
 const snap=usesStudy?homeSnapshot:undefined
 const metric=path.target.metric as keyof NonNullable<typeof snap>['assets'][string]['latest']
 const samplePoints=snap?([['baseline',snap.baselineUtc],['latest',snap.cutoffUtc]] as const)
   .flatMap(([side,date])=>{const n=snap.assets.btc[side][metric]?.value;return typeof n==='number'?[{date,n}]:[]}):[]
 const latest=samplePoints.at(-1)
 const last=s?.points.at(-1)
 const val=latest?.n??last?.[1]
 const fmt=new Intl.NumberFormat(lang(),{maximumFractionDigits:2})
 const unit=path.unit==='%'?'%':path.unit?t(path.unit):s?.unit||''
 const source=usesStudy?'<a href="https://docs.coinmetrics.io/network-data/network-data-overview" target="_blank" rel="noreferrer">Coin Metrics Community</a> · CC BY-NC 4.0':s?`<a href="${esc(s.sourceUrl)}" target="_blank" rel="noreferrer">${esc(s.source)}</a> · ${esc(s.license)}`:''
 const resourceButtons=resourcePaths.map(x=>`<div class="a-resource"><button type="button" class="a-tile" data-resource="${x.id}" aria-pressed="${x.id===path.id}">${figure(x.figure)}<strong>${t(x.resource)}</strong><span>${t(x.measure)}</span></button>${link(x.target,t('directSeries')+'<span class="a-sr"> · '+t(x.resource)+'</span> '+arrow,'a-resource-link')}</div>`).join('')
 const mobile=`<label class="a-mobile-resource">${t('resource')}<select id="resource-select">${resourcePaths.map(x=>option(x.id,t(x.resource)+' → '+t(x.measure),path.id)).join('')}</select></label>`
 shell('home',`<section class="a-hero"><div class="a-hero-intro"><h1>${t('title')}<em>.</em></h1><p class="a-tagline">${t('intro')}</p><div class="a-research"><span class="a-micro">${t('researchLabel')}</span><p>${t('research')}</p></div></div>${mobile}<div class="a-feature"><div class="a-feature-heading"><span class="a-micro"><b class="a-dot"></b> ${t(path.area)} / ${t(path.measure)}</span><span class="a-ticker">${esc(path.target.asset.toUpperCase())}</span></div>${val!==undefined?`<div class="a-number">${fmt.format(val)} <small>${esc(unit)}</small></div><p class="a-caption">${latest?esc(latest.date)+' UTC':formatMonth(last![0])} · ${s?esc(label(s,lang())):t(path.measure)}</p>`:''}<div id="home-chart"></div><div class="a-feature-foot"><div><p>${t(path.question)}</p><small>${source}</small></div>${link(path.target,t('open')+' '+arrow,'a-button')}</div>${path.id==='history'?`<details class="a-home-source"><summary>${t('methods')}</summary><p>${t('paperLimit')}</p></details>`:''}</div></section>
 <section id="resources" class="a-navigator"><div class="a-sectionhead"><div><div class="a-path"><span>${t('persistence')}</span><i>→</i><span>${t('resources')}</span><i>→</i><span>${t('phenomena')}</span></div><h2>${t('navigate')}</h2></div><p>${t('choose')}</p></div><div class="a-resource-list">${resourceButtons}</div></section>
 <section class="a-study-entry"><div><h2>${t('studyEntry')}</h2><p>${t('studyLead')}</p></div><div>${link({view:'matrix',sample:'frozen'},'<strong>'+t('frozenStudy')+'</strong><small>2019-12-31 → 2025-12-31</small>'+arrow,'a-study-route')}${link({view:'matrix',sample:'current'},'<strong>'+t('latestStudy')+'</strong>'+arrow,'a-study-route')}</div></section>
 <section class="a-index"><div class="a-sectionhead"><h2>${t('look')}</h2>${coverageLink()}</div>${previewTopics.filter(x=>x.id!=='circulation').map(x=>link(deep(x.id,primary(x.id)),`<strong>${t(x.id)}</strong><span>${t(x.question)}</span>${arrow}`,'a-index-row')).join('')}</section>`)
 const host=root.querySelector<HTMLElement>('#home-chart')!
 if(path.id==='expiration')mountEvents(host,data.stellar,lang(),true)
 else if(s)mountPlot(host,[s],{lang:lang(),title:label(s,lang()),compact:true})
 else if(samplePoints.length){
   const max=Math.max(...samplePoints.map(p=>p.n),1)
   host.innerHTML=`<div class="a-endpoints"><p>${t('observedDates')}</p>${samplePoints.map(p=>`<div><time datetime="${p.date}">${p.date}</time><span><i style="width:${100*p.n/max}%"></i></span><strong>${esc(fmt.format(p.n))} ${esc(unit)}</strong></div>`).join('')}</div>`
 } else host.textContent=t('noData')
 const change=(id:string,focus?:boolean)=>{
 const destination=resourcePaths.find(x=>x.id===id)
 if(destination)root.querySelector('.a-feature-foot .a-button')?.setAttribute('href',url(destination.target))
 pendingFocus=focus?'[data-resource="'+id+'"]':'#resource-select';nav({resource:id},true)}
 root.querySelectorAll<HTMLButtonElement>('[data-resource]').forEach(b=>b.onclick=()=>change(b.dataset.resource!,true))
 ;root.querySelector<HTMLElement>('#resource-select')!.onchange=e=>{change((e.target as HTMLSelectElement).value);root.querySelector<HTMLElement>('#resource-select')?.focus({preventScroll:true})}
}
const getEntity=(s:Series)=>s.name+' · '+(s.symbol||s.asset.toUpperCase())+(s.network!==s.name?' · '+s.network:'')+(s.contract?' · '+s.contract:'')
function searchPick(id:string,title:string,items:Series[],selected:string,allowEmpty=false){
 const unique=[...new Map(items.map(s=>[s.asset,s])).values()].sort((a,b)=>a.name.localeCompare(b.name))
 return `<label class="a-field" for="${id}"><span>${title}</span><input type="search" autocomplete="off" id="${id}" list="${id}-list" value="${esc(unique.find(s=>s.asset===selected)?getEntity(unique.find(s=>s.asset===selected)!):'')}" placeholder="${allowEmpty?t('none'):t('asset')}"><datalist id="${id}-list">${unique.map(s=>`<option value="${esc(getEntity(s))}"></option>`).join('')}</datalist></label>`
}
function bindPick(id:string,items:Series[],callback:(asset:string)=>void,optional=false){
 const e=root.querySelector<HTMLInputElement>('#'+id)
 if(!e)return
 e.onfocus=()=>e.select()
 e.oninput=()=>e.setCustomValidity('')
 e.onchange=()=>{
 const x=e.value.trim().toLowerCase()
 if(!x&&optional){callback('');return}
 const s=items.find(s=>[getEntity(s),s.asset,s.name,s.contract||''].some(a=>a&&a.toLowerCase()===x))
 if(s)callback(s.asset)
 else{e.setCustomValidity(t('noData'));e.reportValidity()}
 }
}
function controls(topic:Topic,s:Series,candidate:Series[],other:Series[],from:string,to:string){
 const byMetric=[...new Map(series.filter(x=>x.dashboard===topic).map(x=>[x.metric,x])).values()]
 return `<section class="a-controls"><div class="a-fields"><label class="a-field"><span>${t('measure')}</span><select id="metric">${byMetric.map(x=>option(x.metric,label(x,lang()),s.metric)).join('')}</select></label>${searchPick('asset',t('asset'),candidate,s.asset)}${other.length?searchPick('compare',t('compare'),other,get('compare'),true):''}</div><div class="a-period"><div class="a-zoom">${[['12','year'],['60','five'],['all','all']].map(([k,v])=>`<button data-zoom="${k}">${t(v as Key)}</button>`).join('')}</div><label>${t('from')} <input type="month" id="from" value="${esc(from)}"></label><label>${t('to')} <input type="month" id="to" value="${esc(to)}"></label><button id="reset" class="a-textlink">↺ ${t('reset')}</button></div></section>`
}
function dash(topic:Topic){
 const x=topics.find(x=>x.id===topic)!
 const candidates=series.filter(s=>s.dashboard===topic)
 const metric=get('metric')||primary(topic)?.metric
 const match=candidates.filter(s=>s.metric===metric)
 const s=match.find(s=>s.asset===get('asset'))||(!get('asset')?(match.find(s=>s.asset==='btc')||match[0]):undefined)
 const others=s?.comparison?match.filter(a=>a.asset!==s.asset&&a.comparison===s.comparison&&a.unit===s.unit&&a.kind===s.kind&&a.points.some(([d])=>s.points.some(([m])=>d===m))):[]
 const second=others.find(x=>x.asset===get('compare'))
 const paired=second&&s?[s,second]:s?[s]:[]
 const start=paired.map(a=>a.points[0][0]).sort().at(-1)||''
 const end=paired.map(a=>a.points.at(-1)![0]).sort()[0]||''
 const from=get('from')||start,to=get('to')||end
 const top=`<div class="a-bread">${link({},t('atlas'))} / ${t('dashboards')}</div><section class="a-dhead"><div><span class="a-kicker"><i></i>${t(x.resource)}</span><h1>${t(topic)}</h1><p>${t(x.question)}</p></div>${figure(topic)}</section><div class="a-dnav">${previewTopics.map(i=>link(deep(i.id,primary(i.id)),t(i.id),topic===i.id?'on':'')).join('')}<button data-share>${t('share')} ↗</button></div>`
 const intro=topic==='history'?t('histText'):topic==='inactive'?t('dormantText'):''
 const hypothesis=topic==='concentration'?`<aside class="a-notice"><strong>${t('hypothesis')}</strong><p>${t('hypothesisText')}</p></aside>`:''
 const body=topic==='expiration'?'<div id="events" class="a-chartbox"></div>':s?
 controls(topic,s,match,others,from,to)+ (get('compare')?`<p class="a-note" role="status">${second?t('common'):t('noData')}</p>`:'')+
 `<div class="a-chartbox"><div id="chart0"></div>${paired.map(evidence).join('')}</div>${hypothesis}${intro?`<p class="a-explain">${intro}</p>`:''}<div id="additional"></div>`:
 `<section class="a-empty"><h2>${t('noData')}</h2>${primary(topic)?link(deep(topic,primary(topic)),t('reset'),'a-button'):''} ${coverageLink()}</section>`
 const studyMetric=({history:'transactions',context:'fundedAddresses',inactive:'inactiveFloor',circulation:'transfers30d',concentration:'exchangeShare'} as Record<string,string>)[topic]
 const studyNav=studyMetric?link({view:'indicator',asset:get('asset')||s?.asset||'btc',metric:studyMetric},t('studyLink')+' '+arrow,'a-textlink'):''
 shell(topic,top+body+(topic==='history'&&s?.source?.includes('Bitview')?'<p class="a-explain">'+t('paperLimit')+'</p>':'')+rulePanel(topic,lang(),get('asset')||s?.asset)+'<div class="a-bottom">'+studyNav+' '+coverageLink()+'</div>')
 const share=root.querySelector<HTMLButtonElement>('[data-share]')!
 share.onclick=async()=>{try{await navigator.clipboard.writeText(location.href);share.textContent=t('copied')}catch{window.prompt(t('share'),location.href)}}
 if(topic==='expiration'){
 const host=root.querySelector<HTMLElement>('#events')!
 mountEvents(host,data.stellar,lang(),false)
 const panel=document.createElement('section');panel.className='a-chartbox'
 host.insertAdjacentElement('afterend',panel)
 const activity=(from:string,to:string)=>mountStellarActivity(panel,series,lang(),from,to)
 activity(get('from')||String(data.stellar.fromMonth),get('to')||String(data.stellar.toMonth))
 host.addEventListener('atlas-period-change',e=>{const {from,to}=(e as CustomEvent).detail;activity(from,to)})
 return
}
 if(!s)return
 const handles:ReturnType<typeof mountPlot>[]=[]
 function attach(host:HTMLElement,list:Series[],title:string,bar=false) {
  handles.push(mountPlot(host,list,{lang:lang(),title,from,to,bars:bar,selected:get('month'),table:get('table')===list[0].metric,
   onInspect:month=>{for(const h of handles)h.inspect(month);nav({month},true,false,true)},
   onViewChange:table=>nav({table:table?list[0].metric:''},true,false,true)}))
 }
 const chart0=root.querySelector<HTMLElement>('#chart0')!
 attach(chart0,paired,label(s,lang()),s.kind==='flow')
 const extra=root.querySelector<HTMLElement>('#additional')!
 function addChart(a:Series,heading?:string){
 const wrap=document.createElement('div');wrap.className='a-chartbox';extra.appendChild(wrap)
 wrap.innerHTML=(heading?`<h2>${heading}</h2>`:'')+'<div></div>'+evidence(a)
 attach(wrap.querySelector<HTMLElement>('div')!,[a],label(a,lang()),a.kind==='flow')
 }
 if(topic==='history'&&s.asset==='btc'&&!second){
 const complement=series.find(a=>a.asset===s.asset&&a.metric===(s.metric==='added_gb'?'history_gb':'added_gb'))
 if(complement)addChart(complement)
 }
 if(topic==='inactive'){
 const days=s.metric.match(/(\d+d)$/)?.[1]
 series.filter(a=>a.asset===s.asset&&a.dashboard===topic&&a.metric!==s.metric&&days&&a.metric.endsWith('_'+days)).forEach(a=>addChart(a))
 }
 if(topic==='concentration'&&data.distribution.distribution){
 const wrap=document.createElement('div');extra.appendChild(wrap);wrap.className='a-chartbox'
 const p=params()
 mountLorenz(wrap,data.distribution.distribution as Parameters<typeof mountLorenz>[1],lang(),p.get('lorenzFrom')||from,p.get('lorenzTo')||to,(a,b)=>nav({lorenzFrom:a,lorenzTo:b},true,false,true),from,to,data.distribution.series[0])
 }
 const circulation=series.filter(a=>a.asset===s.asset&&a.dashboard==='circulation')
 if(topic!=='circulation'&&circulation.length){
 const related=circulation.find(a=>a.metric===(get('activity')||'TxCnt'))||circulation[0]
 const panel=document.createElement('div');panel.className='a-related'
 panel.innerHTML=`<h2>${t('related')}</h2><label class="a-field">${t('measure')}<select id="activity">${circulation.map(a=>option(a.metric,label(a,lang()),related.metric)).join('')}</select></label>`
 extra.appendChild(panel);addChart(related)
 panel.querySelector('select')!.onchange=e=>nav({activity:(e.target as HTMLSelectElement).value},true)
 }
 ;root.querySelector<HTMLElement>('#metric')!.onchange=e=>{
 const id=(e.target as HTMLSelectElement).value
 const next=candidates.find(a=>a.metric===id&&a.asset===s.asset)||candidates.find(a=>a.metric===id)!
 nav({asset:next.asset,metric:id,compare:'',month:'',table:''},true)
 }
 bindPick('asset',match,asset=>nav({asset,compare:'',month:''},true))
 bindPick('compare',others,compare=>nav({compare,month:''},true),true)
 for(const key of ['from','to']){
 const field=root.querySelector<HTMLInputElement>('#'+key)!
 field.onchange=()=>{const f=root.querySelector<HTMLInputElement>('#from')!.value,e=root.querySelector<HTMLInputElement>('#to')!.value
 if(f&&e&&f>e){field.setCustomValidity(t('period'));field.reportValidity();return}
 nav({from:f,to:e,month:''},true)}
 field.oninput=()=>field.setCustomValidity('')
 }
 root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach(b=>b.onclick=()=>{
 const z=b.dataset.zoom!
 const when=new Date(end+'-01T12:00:00Z');if(z!=='all')when.setUTCMonth(when.getUTCMonth()-Number(z)+1)
 nav({from:z==='all'?'':[start,when.toISOString().slice(0,7)].sort().at(-1),to:z==='all'?'':end,month:''},true)
 })
 root.querySelector<HTMLButtonElement>('#reset')!.onclick=()=>nav(deep(topic,s))
}

function paint(){
 const view=get('view')||'home'
 if(view==='home')home()
 else if(view==='matrix'){
   shell(view,'<div id="study-matrix"></div>')
   mountMatrix(root.querySelector<HTMLElement>('#study-matrix')!,lang())
 }else if(view==='indicator'){
   shell(view,`<div class="a-bread">${link({},t('atlas'))} / ${link({view:'matrix'},t('matrix'))}</div><div id="indicator-detail" aria-busy="true">${t('indicator')}…</div>`)
   const host=root.querySelector<HTMLElement>('#indicator-detail')!
   const frozen=loadStudy('frozen'),current=loadStudy('current'),months=loadStudyMonths()
   Promise.all([frozen,current,months]).then(([f,c,m])=>{
     if(!host.isConnected)return
     host.removeAttribute('aria-busy')
     mountIndicatorDetail(host,f,c,lang(),data.community,m)
   }).catch(()=>{if(host.isConnected){host.removeAttribute('aria-busy');host.innerHTML='<p role="alert">'+t('error')+'</p><button>'+t('reset')+'</button>';host.querySelector('button')!.onclick=render}})
 }else if(view==='coverage'){
 shell(view,`<div class="a-bread">${link({},t('atlas'))} / ${t('coverage')}</div><section class="a-dhead"><div><h1>${t('coverage')}</h1><p>${t('coverageIntro')}</p></div></section>${link({view:'matrix'},t('matrix')+' '+arrow,'a-textlink')}<section id="coverage"></section>`)
 mountCoverage(root.querySelector<HTMLElement>('#coverage')!,series,data.stellar,lang(),values=>url(values))
 }else if(topics.some(x=>x.id===view))dash(view as Topic)
 else {shell('home','<div class="a-empty">'+t('noData')+' '+link({},t('atlas'))+'</div>')}
}
root.addEventListener('click',e=>{
 if(!(e.target instanceof Element)||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return
 const a=e.target.closest<HTMLAnchorElement>('a[data-atlas]')
 if(!a)return
 e.preventDefault();history.pushState(null,'',a.href);render();window.scrollTo(0,0);root.querySelector<HTMLElement>('main')?.focus({preventScroll:true})
})
let drawId=0
let pendingFocus=''
const sourceFor:Record<string,Provider>={history:'history',inactive:'holdings',concentration:'distribution',expiration:'stellar',circulation:'community',context:'community'}
function render(){
 const id=++drawId
 const page=get('view')||'home'
 const source=sourceFor[page==='home'?(get('resource')||'history'):page]||'history'
 const studyHome=page==='home'&&resourcePaths.some(x=>x.id===get('resource')&&x.target.view==='indicator')
 const need:Provider[]=(page==='matrix'||studyHome)?[]:page==='indicator'?['community']:page==='coverage'?[...providers]:page==='home'?[source]:[...new Set<Provider>([source,'community',...((page==='circulation'||page==='history'||page==='concentration'||page==='context')?['holdings' as const]:[])])]
 function done(){if(id!==drawId)return;root.removeAttribute('aria-busy');series=Object.values(data).flatMap(b=>b.series).filter(s=>s.points?.length);paint();if(pendingFocus){root.querySelector<HTMLElement>(pendingFocus)?.focus({preventScroll:true});pendingFocus=''}}
 if(need.every(k=>data[k])&&(!studyHome||homeSnapshot)){done();return}
 root.setAttribute('aria-busy','true')
 Promise.all([need.length?loadData(need):undefined,studyHome?loadStudy('current').then(s=>{homeSnapshot=s}):undefined]).then(done).catch(()=>{
 if(id!==drawId)return
 root.innerHTML='<main id="main" class="a-main a-empty"><h1>CIRCULA Observatory</h1><p role="alert">'+t('error')+'</p><button id="retry">↻ '+t('reset')+'</button></main>'
 root.querySelector<HTMLButtonElement>('#retry')!.onclick=render
 }).finally(()=>{if(id===drawId)root.removeAttribute('aria-busy')})
}
window.addEventListener('popstate',render)
render()
