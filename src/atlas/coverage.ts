import type { Series, Bundle } from './data'
import { esc } from '../ui/html'
import { type Lang, tr, type Key, topics } from './copy'
import { gaps,label } from './labels'
export function mountCoverage(root:HTMLElement,all:Series[],stellar:Bundle,lang:Lang,makeUrl:(p:Record<string,string>)=>string) {
 const t=(key:Key)=>tr(lang,key)
 const p=new URLSearchParams(location.search)
 let query=p.get('q')||'', dashboard=p.get('topic')||'', scope=p.get('scope')||'', page=Number(p.get('page'))||1
 const rows=[...all].map(s=>({asset:s.asset,name:s.name,network:s.network,scope:s.scope,contract:s.contract,metric:s.metric,label:label(s,lang),source:s.source,license:s.license,first:s.points[0][0],last:s.points.at(-1)![0],dashboard:s.dashboard}))
 if(stellar.samples) rows.push({asset:'xlm',name:'Stellar',network:'Stellar',scope:'Contract state',contract:null,metric:'ttl_events',label:t('expiration'),source:String(stellar.source),license:String(stellar.license),first:String(stellar.fromMonth),last:String(stellar.toMonth),dashboard:'expiration'})
 rows.sort((a,b)=>a.name.localeCompare(b.name)||a.label.localeCompare(b.label))
 const opt=(id:string,text:string,val:string)=>'<option value="'+esc(id)+'" '+(id===val?'selected':'')+'>'+esc(text)+'</option>'
 root.innerHTML=`<div class="a-coverfields"><label class="a-field"><span>${t('search')}</span><input type="search" id="find-series" value="${esc(query)}" placeholder="Bitcoin, usdc_eth, TxCnt…"></label><label class="a-field"><span>${t('dashboards')}</span><select id="cover-topic">${opt('',t('all'),dashboard)}${topics.map(x=>opt(x.id,t(x.id),dashboard)).join('')}</select></label><label class="a-field"><span>${t('resource')}</span><select id="cover-scope">${opt('',t('all'),scope)}${['Network','Token deployment','Contract state'].map(x=>opt(x,x,scope)).join('')}</select></label></div><div id="cover-rows"></div><section class="a-gaps"><h2>${t('limits')}</h2>${gaps(lang).map(([k,v])=>`<details><summary>${esc(k)}</summary><p>${esc(v)}</p></details>`).join('')}</section>`
 function draw(){
 const q=query.trim().toLowerCase()
 const hits=rows.filter(a=>(!dashboard||a.dashboard===dashboard)&&(!scope||(scope==='Network'?a.scope==='Network'||a.asset==='btc':a.scope===scope))&&[a.asset,a.name,a.network,a.contract,a.metric,a.label,a.source].some(v=>v?.toLowerCase().includes(q)))
 const max=Math.max(1,Math.ceil(hits.length/35));page=Math.max(1,Math.min(page,max))
 const u=new URL(location.href)
 for(const [k,v] of Object.entries({q:query,topic:dashboard,scope,page:page>1?String(page):''})){if(v)u.searchParams.set(k,v);else u.searchParams.delete(k)}
 if(u.href!==location.href)history.replaceState(null,'',u)
 root.querySelector('#cover-rows')!.innerHTML=`<p class="a-count" role="status">${hits.length} ${t('series')}</p>${hits.length?`<div class="a-table-scroll" tabindex="0"><table><thead><tr>${['asset','measure','period','source','license'].map(k=>'<th scope="col">'+t(k as Key)+'</th>').join('')}</tr></thead><tbody>${hits.slice((page-1)*35,page*35).map(r=>`<tr><th scope="row">${esc(r.name)}<small>${esc(r.asset)} · ${esc(r.network)}</small>${r.contract?`<small class="a-contract">${esc(r.contract)}</small>`:''}</th><td><a data-atlas href="${esc(makeUrl({view:r.dashboard,asset:r.asset,metric:r.metric}))}">${esc(r.label)} ↗</a><small>${esc(r.metric)}</small></td><td>${r.first} — ${r.last}</td><td>${esc(r.source)}</td><td>${esc(r.license)}</td></tr>`).join('')}</tbody></table></div><div class="a-pages"><button id="prev" ${page===1?'disabled':''}>${t('previous')}</button><span>${page} / ${max}</span><button id="next" ${page===max?'disabled':''}>${t('next')}</button></div>`: `<p>${t('noData')}</p>`}`
 for(const [id,step] of [['prev',-1],['next',1]] as const){const b=root.querySelector<HTMLButtonElement>('#'+id);if(b)b.onclick=()=>{page+=step;draw();root.querySelector('#cover-rows')!.scrollIntoView({block:'start'})}}
 }
 root.querySelector<HTMLInputElement>('#find-series')!.oninput=e=>{query=(e.target as HTMLInputElement).value;page=1;draw()}
 ;root.querySelector<HTMLElement>('#cover-topic')!.onchange=e=>{dashboard=(e.target as HTMLSelectElement).value;page=1;draw()}
 ;root.querySelector<HTMLElement>('#cover-scope')!.onchange=e=>{scope=(e.target as HTMLSelectElement).value;page=1;draw()}
 draw()
}
