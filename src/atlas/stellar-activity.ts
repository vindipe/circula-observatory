import { esc } from '../ui/html'
import { langs, tr } from './copy'
import type { Series } from './data'
import { label } from './labels'
import { mountPlot, type AtlasSeries } from './plot'

const metrics = ['TxCnt','TxTfrCnt','AdrActCnt','TxTfrValNtv']
const scope = [
  'Whole-network monthly activity on Stellar. The contract-state timeline samples individual ledgers.',
  'Attività mensile dell’intera rete Stellar. La timeline dello stato dei contratti campiona singoli ledger.',
  'Activité mensuelle de tout le réseau Stellar. La chronologie de l’état des contrats échantillonne certains registres.',
  'Monatliche Aktivität des gesamten Stellar-Netzes. Die Zeitleiste des Vertragszustands basiert auf einzelnen Stichproben-Ledgern.',
]
const missing = [
  'No verified Stellar activity series is available.','Nessuna serie verificata sull’attività di Stellar.',
  'Aucune série vérifiée sur l’activité de Stellar.','Keine verifizierte Reihe zur Stellar-Aktivität verfügbar.',
]

export function mountStellarActivity(host:HTMLElement, series:AtlasSeries[], language:string, from:string, to:string) {
  const lang = langs.find(l=>l===language) ?? 'en'
  const index = langs.indexOf(lang)
  const choices = metrics.flatMap(metric=>series.filter(s=>s.asset==='xlm' && s.metric===metric && s.points.length))
  host.innerHTML = '<h2>'+tr(lang,'related')+'</h2>'
  if (!choices.length) {
    host.insertAdjacentHTML('beforeend','<p role="status">'+missing[index]+'</p>')
    return
  }
  const query = new URL(location.href).searchParams
  let current:Series = choices.find(s=>s.metric===query.get('activity')) ?? choices[0]
  host.insertAdjacentHTML('beforeend','<p>'+scope[index]+'</p><label class="a-field">'+tr(lang,'measure')+
    '<select data-activity>'+choices.map(s=>'<option value="'+esc(s.metric)+'"'+(s===current?' selected':'')+'>'+esc(label(s,lang))+'</option>').join('')+
    '</select></label><div data-chart></div><div class="a-evidence" data-meta></div>')
  function draw() {
    mountPlot(host.querySelector<HTMLElement>('[data-chart]')!,[current],{
      lang,title:label(current,lang),from,to,bars:true,table:new URL(location.href).searchParams.get('activityTable')==='1',
      onViewChange:showTable=>{
        const url=new URL(location.href)
        if(showTable)url.searchParams.set('activityTable','1');else url.searchParams.delete('activityTable')
        history.replaceState(history.state,'',url)
      },
    })
    const end = current.points.at(-1)![0]
    const meta = host.querySelector<HTMLElement>('[data-meta]')!
    meta.innerHTML = '<div class="a-cite"><span>'+tr(lang,'source')+' <a href="'+esc(current.sourceUrl)+'">'+esc(current.source)+'</a></span>'+
      '<a href="'+esc(current.licenseUrl)+'">'+esc(current.license)+'</a></div><details><summary>'+tr(lang,'methods')+'</summary>'+
      '<p>'+esc(current.scopeI18n?.[lang]||current.scope)+' · <code>'+esc(current.metric)+'</code></p>'+
      '<p>'+esc(current.methodI18n?.[lang]||current.method)+'</p>'+
      '<p>'+tr(lang,'coverage')+' · '+esc(current.points[0][0])+' – '+esc(end)+' · '+tr(lang,'last')+' · '+
      esc(current.latestObservation||current.lastObservation||end)+'</p></details>'
  }
  host.querySelector<HTMLElement>('[data-activity]')!.onchange = event=>{
    const metric = (event.target as HTMLSelectElement).value
    current = choices.find(s=>s.metric===metric) ?? choices[0]
    const url = new URL(location.href)
    url.searchParams.set('activity',current.metric)
    history.replaceState(history.state,'',url)
    draw()
  }
  draw()
}
