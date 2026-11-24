import { esc } from '../ui/html'

export interface GroupedDistribution {
  bands: {lowerSats:number, upperSats:number | null, label:string}[]
  months: Record<string, {counts:number[], btc:number[], balanceRanks?: [number,number][]}>
}

const exactCopy = {
  en:{title:'Address-level Lorenz curves',gini:'Address-level Gini',detail:'Addresses with positive balances are ranked by their balance in satoshis. Addresses with the same balance share one segment. Each curve uses the full distribution at its observation date.',open:'Compare exact snapshots'},
  it:{title:'Curve di Lorenz per indirizzo',gini:'Gini per indirizzo',detail:'Gli indirizzi con saldo positivo sono ordinati per saldo in satoshi. Gli indirizzi con lo stesso saldo condividono un segmento. Ogni curva usa la distribuzione completa alla data di osservazione.',open:'Confronta osservazioni esatte'},
  fr:{title:'Courbes de Lorenz par adresse',gini:'Gini par adresse',detail:'Les adresses à solde positif sont classées par solde en satoshis. Les adresses ayant le même solde partagent un segment. Chaque courbe utilise la distribution complète à sa date d’observation.',open:'Comparer les observations exactes'},
  de:{title:'Lorenzkurven nach Adresse',gini:'Gini nach Adresse',detail:'Adressen mit positivem Guthaben werden nach ihrem Guthaben in Satoshis geordnet. Adressen mit gleichem Guthaben teilen sich einen Abschnitt. Jede Kurve umfasst die vollständige Verteilung zum Stichtag.',open:'Exakte Stichtage vergleichen'},
}

const copy = {
  en: {title:'Lorenz curves by balance band',first:'First snapshot',second:'Second snapshot',equality:'Equal balances',x:'Cumulative share of addresses',y:'Cumulative share of BTC',gini:'Grouped Gini lower bound',detail:'Each vertex includes all addresses up to a balance threshold. Connecting the vertices assumes equal balances within each band. The grouped Gini therefore gives a lower bound on inequality.',band:'Balance band',addresses:'Addresses',btc:'BTC in band',bands:'Balance distribution by band',empty:'No comparable balance snapshots.',end:'Upper boundary',share:'Cumulative shares',inspect:'Inspect a balance band',scope:'Included addresses',snapshot:'Snapshot'},
  it: {title:'Curve di Lorenz per fascia di saldo',first:'Prima osservazione',second:'Seconda osservazione',equality:'Saldi uguali',x:'Quota cumulata degli indirizzi',y:'Quota cumulata dei BTC',gini:'Limite inferiore del Gini per fasce',detail:'Ogni vertice comprende tutti gli indirizzi fino a una soglia di saldo. I segmenti tra vertici assumono saldi uguali nella stessa fascia. Il Gini calcolato per fasce fornisce quindi un limite inferiore alla disuguaglianza.',band:'Fascia di saldo',addresses:'Indirizzi',btc:'BTC nella fascia',bands:'Distribuzione dei saldi per fascia',empty:'Nessuna coppia di osservazioni confrontabili.',end:'Soglia superiore',share:'Quote cumulate',inspect:'Esplora le fasce di saldo',scope:'Indirizzi inclusi',snapshot:'Osservazione'},
  fr: {title:'Courbes de Lorenz par tranche de solde',first:'Première observation',second:'Deuxième observation',equality:'Soldes égaux',x:'Part cumulée des adresses',y:'Part cumulée des BTC',gini:'Borne inférieure du Gini par tranche',detail:'Chaque sommet inclut toutes les adresses jusqu’à un seuil de solde. Chaque segment suppose des soldes identiques dans une même tranche. Le Gini par tranche fournit ainsi une borne inférieure de l’inégalité.',band:'Tranche de solde',addresses:'Adresses',btc:'BTC dans la tranche',bands:'Répartition des soldes par tranche',empty:'Aucune paire d’observations comparables.',end:'Seuil supérieur',share:'Parts cumulées',inspect:'Explorer les tranches de solde',scope:'Adresses incluses',snapshot:'Observation'},
  de: {title:'Lorenzkurven nach Guthabenklasse',first:'Erster Stichtag',second:'Zweiter Stichtag',equality:'Gleiche Guthaben',x:'Kumulierter Anteil der Adressen',y:'Kumulierter Anteil an BTC',gini:'Gini-Untergrenze nach Guthabenklasse',detail:'Jeder Eckpunkt erfasst alle Adressen bis zu einer Guthabenschwelle. Die Verbindungsstrecken setzen innerhalb jeder Klasse gleiche Guthaben voraus. Der gruppierte Gini bildet damit eine Untergrenze für die Ungleichheit.',band:'Guthabenklasse',addresses:'Adressen',btc:'BTC in der Klasse',bands:'Guthabenverteilung nach Klasse',empty:'Keine vergleichbaren Stichtage verfügbar.',end:'Obergrenze',share:'Kumulierte Anteile',inspect:'Guthabenklasse untersuchen',scope:'Erfasste Adressen',snapshot:'Stichtag'},
}

export function groupedCurve(bands: GroupedDistribution['bands'], values: GroupedDistribution['months'][string]) {
  if (!bands.length || bands.length !== values.counts.length || bands.length !== values.btc.length) return null
  let priorUpper: number | null = -1
  for (const [i,b] of bands.entries()) {
    if (!Number.isFinite(b.lowerSats) || b.lowerSats < 0 || priorUpper === null || b.lowerSats < priorUpper) return null
    if (b.upperSats !== null && (!Number.isFinite(b.upperSats) || b.upperSats <= b.lowerSats)) return null
    const c = values.counts[i], v = values.btc[i]
    if (!Number.isSafeInteger(c) || c < 0 || !Number.isFinite(v) || v < 0 || c === 0 && v !== 0) return null
    priorUpper = b.upperSats
  }
  return curveTotals(values.counts, values.btc)
}

function curveTotals(counts:number[], amounts:number[]) {
  const sum = (acc:number,v:number) => acc+v
  const addresses = counts.reduce(sum,0), amount = amounts.reduce(sum,0)
  if (!(addresses > 0 && amount > 0)) return null
  let count = 0, btc = 0, doubleArea = 0
  const points: [number,number][] = [[0,0]]
  for (const [i,c] of counts.entries()) {
    count += c
    btc += amounts[i]
    const x = count/addresses, y = btc/amount
    const [prevX,prevY] = points[i]
    doubleArea += (x-prevX)*(y+prevY)
    points.push([x,y])
  }
  return {points, gini:Math.max(0,1-doubleArea), addresses, amount}
}

export function exactCurve(snapshot:GroupedDistribution['months'][string]) {
  const ranks = snapshot.balanceRanks
  if (!ranks?.length || ranks.some(([sats,n],i) =>
    !Number.isSafeInteger(sats) || !Number.isSafeInteger(n) || sats <= 0 || n <= 0 ||
    (i > 0 && sats <= ranks[i-1][0]))) return null
  const curve = curveTotals(ranks.map(r=>r[1]),ranks.map(([sats,n])=>sats*n))
  if (!curve || !Number.isSafeInteger(curve.amount) || curve.addresses !== snapshot.counts.reduce((a,n)=>a+n,0)
    || Math.abs(curve.amount - snapshot.btc.reduce((a,v)=>a+Math.round(v*1e8),0)) > 0) return null
  return curve
}

let sequence = 0
export function mountLorenz(root:HTMLElement, data:GroupedDistribution, lang:string, from?:string, to?:string, onChange?:(from:string,to:string)=>void) {
  const locale = lang.split('-')[0] in copy ? lang.split('-')[0] as keyof typeof copy : 'en'
  const t = copy[locale]
  const number = new Intl.NumberFormat(locale,{maximumSignificantDigits:17})
  const fraction = new Intl.NumberFormat(locale,{maximumFractionDigits:4})
  const pct = new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:3})
  const dates = Object.keys(data.months).filter(m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && groupedCurve(data.bands,data.months[m])).sort()
  if (!dates.length) {
    root.innerHTML = `<section class="atlas-lorenz"><h3>${t.title}</h3><p role="status">${t.empty}</p></section>`
    return
  }
  let earlier = dates.includes(from ?? '') ? from! : dates[0]
  let later = dates.includes(to ?? '') ? to! : dates[dates.length-1]
  const exactDates = dates.filter(month => exactCurve(data.months[month]))
  const ex = exactCopy[locale]
  const id = 'lorenz-' + ++sequence
  let band = 0
  const dateOptions = (selected:string) => dates.map(d => `<option value="${d}"${selected === d ? ' selected' : ''}>${d}</option>`).join('')
  root.innerHTML = `<section class="atlas-lorenz" aria-labelledby="${id}-title">
    <h3 id="${id}-title">${t.title}</h3><div class="al-controls"><label>${t.first}<select data-first>${dateOptions(earlier)}</select></label><label>${t.second}<select data-second>${dateOptions(later)}</select></label>${exactDates.length>1 ? `<button type="button" class="al-exact" data-exact>${ex.open} · ${exactDates[0]} – ${exactDates.at(-1)}</button>` : ''}</div>
    <div class="al-legend"></div><div class="al-axis-y">${t.y}</div>
    <div class="al-frame"><div class="al-ticks-y" aria-hidden="true"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
    <div class="al-scene"><svg class="al-svg" viewBox="0 0 600 280" preserveAspectRatio="none" role="img" aria-labelledby="${id}-title ${id}-desc"></svg></div>
    <div class="al-ticks-x" aria-hidden="true"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div></div>
    <div class="al-axis-x">${t.x}</div><p id="${id}-desc" class="al-description">${t.detail}</p>
    <div class="al-results"></div><label class="al-picker">${t.inspect}<select data-band>${data.bands.map((b,i) => `<option value="${i}">${esc(b.label)}</option>`).join('')}</select></label>
    <div class="al-readout" aria-live="polite"></div>
    <details><summary>${t.bands}</summary><div class="al-table" tabindex="0" role="region" aria-label="${t.bands}"></div></details></section>`
  const $ = <T = HTMLElement>(s:string) => root.querySelector(s) as unknown as T
  const exact = (n:number) => number.format(n)
  const draw = () => {
    const months = earlier === later ? [earlier] : [earlier,later]
    const grouped = months.map(m => groupedCurve(data.bands,data.months[m])!)
    const ranks = months.map(m => exactCurve(data.months[m]))
    const empirical = ranks.every(c => c !== null)
    const curves = empirical ? ranks : grouped
    $('#' + id + '-title').textContent = empirical ? ex.title : t.title
    $('#' + id + '-desc').textContent = empirical ? ex.detail : t.detail
    const grid = [0,.25,.5,.75,1].map(v => `M${v*600} 0V280 M0 ${v*280}H600`).join(' ')
    const lines = curves.map((c,index) => {
      const pp = c.points.map(([x,y]) => `${(x*600).toFixed(3)},${((1-y)*280).toFixed(3)}`).join(' ')
      return `<polyline class="al-line al-track-${index}" points="${pp}"/>`
    }).join('')
    const svg = root.querySelector<SVGSVGElement>('.al-svg')!
    svg.innerHTML = `<path class="al-grid" d="${grid}"/><path class="al-diag" d="M0 280L600 0"/>${lines}<g class="al-markers"></g>`
    $('.al-legend').innerHTML = months.map((m,i) => `<span><i class="al-track-${i}"></i>${esc(m)}</span>`).join('') + `<span><i class="al-equal"></i>${t.equality}</span>`
    $('.al-results').innerHTML = `<b>${empirical ? ex.gini : t.gini}</b>${curves.map((c,i) => `<span>${months[i]} <strong>${fraction.format(c.gini)}</strong></span>`).join('')}`
    const columns = months.map(m => `<th scope="col">${t.addresses} · ${m}</th><th scope="col">${t.btc} · ${m}</th>`).join('')
    const rows = data.bands.map((b,i) => `<tr><th scope="row">${esc(b.label)}</th>${months.map(m => `<td>${exact(data.months[m].counts[i])}</td><td>${exact(data.months[m].btc[i])}</td>`).join('')}</tr>`).join('')
    $('.al-table').innerHTML = `<table><caption>${t.bands}</caption><thead><tr><th scope="col">${t.band}</th>${columns}</tr></thead><tbody>${rows}</tbody></table>`
    const readBand = () => {
      svg.querySelector('.al-markers')!.innerHTML = grouped.map((c,i) => {
        const [x,y] = c.points[band+1]
        const xx = x*600, yy=(1-y)*280
        return i===0 ? `<circle class="al-mark-0" r="4" cx="${xx}" cy="${yy}"/>` : `<rect class="al-mark-1" width="7" height="7" x="${xx-3.5}" y="${yy-3.5}"/>`
      }).join('')
      $('.al-readout').innerHTML = `<b>${t.share}</b>${grouped.map((c,i) => {
        const [x,y] = c.points[band+1]
        return `<span><time>${months[i]}</time> · ${t.addresses} ${pct.format(x)} · BTC ${pct.format(y)}</span>`
      }).join('')}`
    }
    $<HTMLSelectElement>('[data-band]').onchange = e => {band = Number((e.target as HTMLSelectElement).value); readBand()}
    const scene = $('.al-scene')
    scene.onclick = e => {
      const box = scene.getBoundingClientRect()
      const x = (e.clientX-box.left)/box.width, y = 1-(e.clientY-box.top)/box.height
      let closest = Infinity
      for (const curve of grouped) curve.points.slice(1).forEach(([px,py],i) => {
        const distance = ((px-x)*box.width)**2 + ((py-y)*box.height)**2
        if (distance < closest) { closest=distance; band=i }
      })
      $<HTMLSelectElement>('[data-band]').value = String(band)
      readBand()
    }
    readBand()
  }
  root.querySelectorAll('[data-first],[data-second]').forEach(select => select.addEventListener('change',() => {
    earlier = $<HTMLSelectElement>('[data-first]').value
    later = $<HTMLSelectElement>('[data-second]').value
    draw()
    onChange?.(earlier,later)
  }))
  root.querySelector('[data-exact]')?.addEventListener('click',() => {
    earlier = exactDates[0]
    later = exactDates[exactDates.length-1]
    $<HTMLSelectElement>('[data-first]').value = earlier
    $<HTMLSelectElement>('[data-second]').value = later
    draw()
    onChange?.(earlier,later)
  })
  draw()
}
