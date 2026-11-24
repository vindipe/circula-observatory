import { esc } from '../ui/html'
import './events.css'

type Kind = 'extension' | 'expiry' | 'removal' | 'restoration'
interface StateEvent { date:string; ledger:number; key:string; kind:Kind; resource:string; evidence:string }
interface Snapshot {
  samples:{ ledger:number; date:string }[]
  events:StateEvent[]
  fromMonth:string
  toMonth:string
  source:string
  license:string
  sourceUrl:string
  licenseUrl:string
}
const languages = ['en','it','fr','de']
const copy = {
  title:['Contract-state events','Eventi dello stato dei contratti','Événements de l’état des contrats','Ereignisse im Vertragszustand'],
  sample:['One ledger in every 65,536. Counts represent distinct resource keys per sampled ledger and event type.','Un ledger ogni 65.536. I conteggi indicano le chiavi distinte per ledger campionato e tipo di evento.','Un registre sur 65 536. Les nombres indiquent les clés distinctes par registre échantillonné et type d’événement.','Jedes 65.536. Ledger. Gezählt werden unterschiedliche Ressourcenschlüssel je Stichproben-Ledger und Ereignistyp.'],
  extension:['TTL extension','Estensione del TTL','Prolongation du TTL','TTL-Verlängerung'],
  expiry:['Inferred expiry','Scadenza dedotta','Expiration déduite','Abgeleiteter Ablauf'],
  removal:['Eviction','Rimozione','Éviction','Verdrängung'],
  restoration:['Restoration','Ripristino','Restauration','Wiederherstellung'],
  temporary:['Temporary data','Dati temporanei','Données temporaires','Temporäre Daten'],
  persistent:['Persistent data','Dati persistenti','Données persistantes','Persistente Daten'],
  code:['Contract code','Codice del contratto','Code du contrat','Vertragscode'],
  unresolved:['Unresolved key type','Tipo di chiave indeterminato','Type de clé indéterminé','Unbestimmter Schlüsseltyp'],
  hubble:['Hubble requires an authenticated BigQuery project. This preview uses the Stellar-maintained public ledger archive.','Hubble richiede un progetto BigQuery autenticato. Questa anteprima usa l’archivio pubblico dei ledger mantenuto da Stellar.','Hubble requiert un projet BigQuery authentifié. Cet aperçu utilise l’archive publique des registres maintenue par Stellar.','Hubble erfordert ein authentifiziertes BigQuery-Projekt. Diese Vorschau nutzt das öffentliche, von Stellar gepflegte Ledger-Archiv.'],
  all:['All','Tutti','Tous','Alle'],kind:['Event type','Tipo di evento','Type d’événement','Ereignistyp'],
  resource:['Resource','Risorsa','Ressource','Ressource'],from:['From','Da','Du','Von'],to:['To','A','Au','Bis'],
  reset:['Reset','Ripristina filtri','Réinitialiser','Zurücksetzen'],date:['UTC date','Data UTC','Date UTC','UTC-Datum'],
  table:['Event table','Tabella degli eventi','Tableau des événements','Ereignistabelle'],
  key:['Resource key hash','Hash della chiave','Empreinte de la clé','Schlüssel-Hash'],
  csv:['Download CSV','Scarica CSV','Télécharger le CSV','CSV herunterladen'],
  none:['No matching observations.','Nessuna osservazione corrispondente.','Aucune observation correspondante.','Keine passenden Beobachtungen.'],
  noSamples:['No sampled ledger in this period.','Nessun ledger campionato in questo periodo.','Aucun registre échantillonné sur cette période.','Keine Stichproben-Ledger in diesem Zeitraum.'],
  inspect:['Inspect a ledger','Esplora un ledger','Explorer un registre','Ledger untersuchen'],
  indirect:['An expiry would occur after the last live ledger if no intervening renewal occurred. Sampling cannot establish this interval.','La scadenza avverrebbe dopo l’ultimo ledger valido in assenza di rinnovo. Il campionamento lascia intervalli non osservati.','L’expiration suivrait le dernier registre valide en l’absence de renouvellement. L’échantillonnage laisse des intervalles inobservés.','Der Ablauf folgt auf das letzte gültige Ledger, falls keine Verlängerung erfolgt. Die Stichprobe lässt Zwischenräume offen.'],
  method:['Extensions require an older and a greater TTL for the same key in one operation. Evictions come from ledger-close metadata. Restorations require an explicit restore change.','Le estensioni richiedono due valori crescenti del TTL della stessa chiave nella stessa operazione. Le rimozioni provengono dai metadati di chiusura del ledger. I ripristini richiedono un evento esplicito.','Les prolongations nécessitent deux TTL croissants pour la même clé dans une opération. Les évictions proviennent des métadonnées de clôture. Les restaurations nécessitent un changement explicite.','Verlängerungen erfordern zwei steigende TTL-Werte desselben Schlüssels im gleichen Vorgang. Verdrängungen stammen aus den Abschlussmetadaten. Wiederherstellungen erfordern einen expliziten Statuswechsel.'],
  observed:['Observed','Osservato','Observé','Beobachtet'],evidence:['Evidence','Evidenza','Observation','Nachweis'],
  scope:['Sampling method','Metodo di campionamento','Méthode d’échantillonnage','Stichprobenverfahren'],
  prev:['Previous','Precedente','Précédent','Zurück'],next:['Next','Successiva','Suivant','Weiter'],
  legend:['Shape identifies the event. Select a ledger to inspect its counts.','La forma identifica l’evento. Seleziona un ledger per leggerne i conteggi.','La forme identifie l’événement. Sélectionnez un registre pour lire les nombres.','Die Form zeigt den Ereignistyp. Wählen Sie ein Ledger für die Anzahl.'],
  coverage:['Sample coverage','Copertura del campione','Couverture de l’échantillon','Stichprobenabdeckung'],
}
const types:Kind[] = ['extension','removal','restoration']
const resources = ['temporary','persistent','code','unresolved']
const marks = ['●','■','▲']
const parameters = ['event','resource','from','to','ledger']
export function mountEvents(host:HTMLElement,payload:unknown,lang:string,compact=false) {
  const index = Math.max(0,languages.indexOf(lang))
  const t = (key:string) => copy[key as keyof typeof copy]?.[index] ?? key
  const data = payload as Snapshot
  if (!data?.samples?.length || !Array.isArray(data.events)) { host.textContent = t('noSamples'); return }
  const params = new URL(location.href).searchParams
  let kind = compact ? '' : params.get('event') || '', resource = compact ? '' : params.get('resource') || ''
  let from = compact ? data.fromMonth : params.get('from') || data.fromMonth
  let to = compact ? data.toMonth : params.get('to') || data.toMonth
  let selected = Number(params.get('ledger')) || 0, page = 0, tableOpen = false
  const fmt = (n:number) => n.toLocaleString(languages[index])
  const opts = (values:string[], value:string) => ['', ...values].map(v=>'<option value="'+v+'"'+(v===value?' selected':'')+'>'+esc(t(v||'all'))+'</option>').join('')
  function update(key:string,value:string) {
    if (compact) return
    const url = new URL(location.href)
    if (value) url.searchParams.set(key,value); else url.searchParams.delete(key)
    history.replaceState(history.state,'',url)
  }
  function draw(focus = '') {
    const samples = data.samples.filter(s=>s.date.slice(0,7)>=from && s.date.slice(0,7)<=to)
    const rows = data.events.filter(e=>e.date.slice(0,7)>=from && e.date.slice(0,7)<=to && (!kind||e.kind===kind) && (!resource||e.resource===resource))
    const visibleTypes = types.filter(v=>!kind||v===kind)
    const counts = new Map<string,number>()
    rows.forEach(e=>{const k=e.ledger+'-'+e.kind;counts.set(k,(counts.get(k)||0)+1)})
    if (!samples.some(s=>s.ledger===selected)) selected=samples.at(-1)?.ledger||0
    const info = samples.find(s=>s.ledger===selected)
    const caption = data.fromMonth+' – '+data.toMonth+' · '+fmt(data.samples.length)+' '+(['ledgers','ledger','registres','Ledger'][index])
    const timeline = visibleTypes.map(k=>{
      const ti=types.indexOf(k)
      return '<div class="ev-track"><div>'+marks[ti]+' '+t(k)+'</div><div class="ev-rail">'+samples.map(s=>{
        const count=counts.get(s.ledger+'-'+k)||0
        const first=Date.parse(samples[0].date), last=Date.parse(samples.at(-1)!.date)
        const pos=first===last?50:3+94*(Date.parse(s.date)-first)/(last-first)
        const label=s.date+' · '+s.ledger+' · '+t(k)+' · '+fmt(count)
        return '<button type="button" tabindex="-1" data-ledger="'+s.ledger+'" class="ev-point ev-t'+ti+(count===0?' ev-zero':'')+(s.ledger===selected?' ev-picked':'')+'" style="left:'+pos+'%" title="'+esc(label)+'" aria-label="'+esc(label)+'">'+(count?marks[ti]:'·')+'</button>'
      }).join('')+'</div></div>'
    }).join('')
    const selectedText = info ? info.date+' UTC · #'+info.ledger+' · '+visibleTypes.map(k=>t(k)+' '+fmt(counts.get(info.ledger+'-'+k)||0)).join(' · ') : t('noSamples')
    const control = (key:string, body:string) => '<label>'+t(key)+body+'</label>'
    const filterFields = control('kind','<select data-id="event">'+opts([...types,'expiry'],kind)+'</select>')+
      control('resource','<select data-id="resource">'+opts(resources,resource)+'</select>')+
      ['from','to'].map(k=>control(k,'<input type="month" data-id="'+k+'" value="'+esc(k==='from'?from:to)+'">')).join('')+
      '<button type="button" data-id="reset">'+t('reset')+'</button>'
    host.innerHTML='<section class="atlas-events"><h3>'+t('title')+'</h3><p>'+t('sample')+'</p><small>'+t('coverage')+' · '+caption+'</small>'+
      (!compact?'<div class="ev-filters">'+filterFields+'</div>':'')+
      (samples.length && visibleTypes.length?'<div class="ev-timeline">'+timeline+'<div class="ev-ticks"><span>'+samples[0].date+'</span><span>'+samples.at(-1)!.date+'</span></div></div>':'')+
      (info&&visibleTypes.length?'<label class="ev-inspect">'+t('inspect')+'<input data-id="cursor" type="range" min="0" max="'+(samples.length-1)+'" value="'+samples.indexOf(info)+'" aria-valuetext="'+esc(selectedText)+'"></label><output aria-live="polite">'+esc(selectedText)+'</output>':'')+
      (!rows.length?'<p role="status">'+t(kind==='expiry'?'indirect':!samples.length?'noSamples':'none')+'</p>':'')+
      (!compact?'<div class="ev-actions"><button data-id="table" aria-expanded="'+tableOpen+'">'+t('table')+' ('+fmt(rows.length)+')</button><button data-id="csv" '+(!rows.length?'disabled':'')+'>'+t('csv')+'</button></div>':'')+
      (tableOpen?'<div class="ev-scroll"><table><thead><tr>'+['date','Ledger','kind','resource','key','evidence'].map(k=>'<th>'+t(k)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(page*25,page*25+25).map(e=>'<tr>'+[e.date,e.ledger,t(e.kind),t(e.resource),e.key,t('observed')].map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><div class="ev-actions"><button data-id="prev" '+(page===0?'disabled':'')+'>'+t('prev')+'</button>'+(page+1)+' / '+Math.max(1,Math.ceil(rows.length/25))+'<button data-id="next" '+((page+1)*25>=rows.length?'disabled':'')+'>'+t('next')+'</button></div>':'')+
      (!compact?'<details><summary>'+t('scope')+'</summary><p>'+t('method')+'</p><p>'+t('indirect')+'</p><p>'+t('hubble')+'</p><p><a href="https://developers.stellar.org/docs/data/analytics/hubble/data-catalog/data-dictionary/bronze/ttl">Stellar Hubble TTL</a></p></details>':'')+
      '<footer><a href="'+esc(data.sourceUrl)+'">'+esc(data.source)+'</a> · <a href="'+esc(data.licenseUrl)+'">'+esc(data.license)+'</a></footer></section>'
    const byId = (id:string)=>host.querySelector<HTMLElement>('[data-id="'+id+'"]')
    const inspect = (n:number) => {selected=n;update('ledger',String(n));draw('cursor')}
    host.querySelectorAll<HTMLElement>('[data-ledger]').forEach(b=>b.onclick=()=>inspect(Number(b.dataset.ledger)))
    if(byId('cursor')) byId('cursor')!.onchange=e=>inspect(samples[Number((e.target as HTMLInputElement).value)].ledger)
    for(const k of ['event','resource','from','to']) if(byId(k)) byId(k)!.onchange=e=>{
      const v=(e.target as HTMLInputElement).value
      if(k==='event')kind=v
      if(k==='resource')resource=v
      if(k==='from')from=v||data.fromMonth
      if(k==='to')to=v||data.toMonth
      update(k,v);update('ledger','');page=0;draw(k)
      if(k==='from'||k==='to') host.dispatchEvent(new CustomEvent('atlas-period-change',{bubbles:true,detail:{from,to}}))
    }
    if(byId('reset')) byId('reset')!.onclick=()=>{
      parameters.forEach(k=>update(k,''));kind='';resource='';from=data.fromMonth;to=data.toMonth;page=0;draw('reset')
      host.dispatchEvent(new CustomEvent('atlas-period-change',{bubbles:true,detail:{from,to}}))
    }
    if(byId('table'))byId('table')!.onclick=()=>{tableOpen=!tableOpen;draw('table')}
    if(byId('prev'))byId('prev')!.onclick=()=>{page--;draw('prev')}
    if(byId('next'))byId('next')!.onclick=()=>{page++;draw('next')}
    if(byId('csv'))byId('csv')!.onclick=()=>{
      const table=[['date_utc','network','ledger','event_kind','resource','key_hash','evidence','scope','source','license','license_url'],
        ...rows.map(e=>[e.date,'Stellar mainnet',e.ledger,e.kind,e.resource,e.key,e.evidence,'Every 65536th ledger',data.sourceUrl,data.license,data.licenseUrl])]
      const csv=table.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n')
      const link=document.createElement('a');link.download='stellar-events-'+from+'_'+to+'.csv';link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)
    }
    if(focus)byId(focus)?.focus({preventScroll:true})
  }
  draw()
}
