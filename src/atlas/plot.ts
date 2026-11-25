import { esc } from '../ui/html'

export interface AtlasSeries {
  asset: string
  name: string
  network: string
  contract?: string | null
  metric: string
  label: string
  unit: string
  kind: string
  scope: string
  method: string
  source: string
  sourceUrl: string
  license: string
  licenseUrl: string
  comparison: string | null
  points: [string, number][]
  dashboard: string
  downloadable?: boolean
}

export interface PlotOptions {
  lang: string
  title: string
  from?: string
  to?: string
  compact?: boolean
  bars?: boolean
  table?: boolean
  selected?: string
  sampleMonths?: string[]
  tooltipNote?: string
  displayFractionDigits?: number
  onExport?: (months: string[], visible: number[]) => void
  onInspect?: (month: string) => void
  onViewChange?: (table: boolean) => void
}

const translations = {
  en: { chart:'Chart', table:'Table', download:'Download CSV', month:'Month', missing:'No observation', none:'No observations in this interval.', incompatible:'These series have different definitions or units.', inspect:'Inspect month', selected:'Selected month', plotted:'Displayed series', observation:'Observation', gap:'Months without a comparable observation', scroll:'Scroll through monthly observations', value:'Value' },
  it: { chart:'Grafico', table:'Tabella', download:'Scarica CSV', month:'Mese', missing:'Dato assente', none:'Nessuna osservazione in questo intervallo.', incompatible:'Le serie hanno definizioni o unità diverse.', inspect:'Esplora i mesi', selected:'Mese selezionato', plotted:'Serie visualizzate', observation:'Osservazione', gap:'Mesi privi di osservazioni confrontabili', scroll:'Scorri le osservazioni mensili', value:'Valore' },
  fr: { chart:'Graphique', table:'Tableau', download:'Télécharger CSV', month:'Mois', missing:'Observation absente', none:'Aucune observation sur cette période.', incompatible:'Les définitions ou les unités de ces séries diffèrent.', inspect:'Explorer les mois', selected:'Mois sélectionné', plotted:'Séries affichées', observation:'Observation', gap:'Mois sans observation comparable', scroll:'Parcourir les observations mensuelles', value:'Valeur' },
  de: { chart:'Diagramm', table:'Tabelle', download:'CSV herunterladen', month:'Monat', missing:'Kein Messwert', none:'Für diesen Zeitraum liegen keine Beobachtungen vor.', incompatible:'Die Serien haben unterschiedliche Definitionen oder Einheiten.', inspect:'Monat untersuchen', selected:'Ausgewählter Monat', plotted:'Angezeigte Reihen', observation:'Beobachtung', gap:'Monate ohne vergleichbare Beobachtung', scroll:'Monatliche Beobachtungen durchsuchen', value:'Wert' },
}
const marks = ['#087653', '#294f94', '#a04e16', '#73377b']
const dashes = ['', '7 4', '2 4', '9 3 2 3']
const icons = {
  chart:'<path d="M3 3v10h11M5 10l3-3 2 1 3-5"/>',
  table:'<rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="M3 6.5h10M7 7v6"/>',
  download:'<path d="M8 2v8m-3-3 3 3 3-3M3 11v2.5h10V11"/>',
}
function icon(name: keyof typeof icons) {
  return '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' + icons[name] + '</svg>'
}

const validMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
function ordinal(month: string) { return Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1 }
function fromOrdinal(n: number) { return Math.floor(n / 12) + '-' + String(n % 12 + 1).padStart(2, '0') }
export interface PlotRow { month: string; values: (number | null)[] }

export function compatibleSeries(series: AtlasSeries[]) {
  if (series.length < 2) return true
  const first = series[0]
  return Boolean(first.comparison) && series.every(s =>
    s.comparison === first.comparison && s.unit === first.unit && s.kind === first.kind && s.metric === first.metric)
}

/** Complete UTC calendar. A missing metric never becomes a zero or an interpolated line. */
export function plotRows(series: AtlasSeries[], from?: string, to?: string): PlotRow[] {
  if (!series.length || !compatibleSeries(series)) return []
  const observations = series.map(s => new Map(s.points.filter(([m, v]) => validMonth(m) && Number.isFinite(v))))
  if (observations.some(s => !s.size)) return []
  const dates = observations.map(map => [...map.keys()].sort())
  const first = Math.max(...dates.map(d => ordinal(d[0])), from && validMonth(from) ? ordinal(from) : -Infinity)
  const last = Math.min(...dates.map(d => ordinal(d[d.length-1])), to && validMonth(to) ? ordinal(to) : Infinity)
  return Array.from({length: Math.max(0, last - first + 1)}, (_, i) => {
    const month = fromOrdinal(first + i)
    const values = observations.map(map => map.get(month) ?? null)
    return {month, values: values.includes(null) ? values.map(() => null) : values}
  })
}

const csvQuote = (item: string | number | null) => '"' + String(item ?? '').replace(/"/g, '""') + '"'
export function plotCSV(series: AtlasSeries[], rows: PlotRow[], active: number[]) {
  const header = ['month_utc','asset','network','contract','metric','aggregation_kind','unit','value','observation_status','scope','source','source_url','license','license_url']
  const lines = rows.flatMap(row => active.map(index => {
    const s = series[index], value = row.values[index]
    return [row.month,s.asset,s.network,s.contract ?? '',s.metric,s.kind,s.unit,value,value === null ? 'missing' : 'observed',s.scope,s.source,s.sourceUrl,s.license,s.licenseUrl]
  }))
  return [header, ...lines].map(line => line.map(csvQuote).join(',')).join('\r\n') + '\r\n'
}

function scaleMax(value: number) {
  if (value <= 0) return 1
  const exponent = 10 ** Math.floor(Math.log10(value / 4))
  return ([1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(n => 4 * n * exponent >= value) ?? 10) * exponent * 4
}
function glyph(seriesIndex: number, x: number, y: number, size: number) {
  if (seriesIndex % 3 === 1) return `<rect x="${x-size}" y="${y-size}" width="${size*2}" height="${size*2}"/>`
  if (seriesIndex % 3 === 2) return `<path d="M${x} ${y-size*1.35}l${size*1.25} ${size*2.2}h-${size*2.5}z"/>`
  return `<circle cx="${x}" cy="${y}" r="${size}"/>`
}

let nextId = 0
export function mountPlot(root: HTMLElement, series: AtlasSeries[], options: PlotOptions): { inspect(month: string): void } {
  const id = 'atlas-plot-' + ++nextId
  const lang = options.lang.split('-')[0]
  const tr = translations[lang as keyof typeof translations] ?? translations.en
  const locale = lang in translations ? lang : 'en'
  const readable = new Intl.NumberFormat(locale,{ maximumSignificantDigits:21 })
  const display = options.displayFractionDigits === undefined ? readable : new Intl.NumberFormat(locale,{maximumFractionDigits:options.displayFractionDigits})
  const axis = new Intl.NumberFormat(locale,{ notation:'compact', maximumSignificantDigits:3 })
  const date = new Intl.DateTimeFormat(locale,{month:'short', year:'numeric', timeZone:'UTC'})
  const formatMonth = (m: string) => date.format(new Date(m + '-01T00:00:00Z'))
  const name = (s: AtlasSeries) => s.name || s.asset.toUpperCase()
  const allRows = plotRows(series, options.from, options.to)
  const sampleMonths = options.sampleMonths && new Set(options.sampleMonths)
  const rows = sampleMonths ? allRows.filter(row => sampleMonths.has(row.month)) : allRows
  const compatible = compatibleSeries(series)
  if (!rows.some(r => r.values.some(v => v !== null))) {
    root.innerHTML = `<section class="at-plot"><h3>${esc(options.title)}</h3><p role="status">${compatible ? tr.none : tr.incompatible}</p></section>`
    return {inspect() {}}
  }
  const months = new Map(rows.map((row, index) => [row.month, index]))
  let selected = months.get(options.selected ?? '') ?? rows.length - 1
  let table = Boolean(options.table && !options.compact)
  const visible = new Set(series.map((_, index) => index))
  const active = () => [...visible].sort((a,b) => a-b)
  const style = (i: number) => `style="--plot-color:${marks[i % marks.length]}"`
  const title = esc(options.title)
  const controls = options.compact ? '' : `<div class="at-plot-controls">
    <div class="at-plot-switch" role="group" aria-label="${title}">
      <button type="button" data-view="chart" aria-pressed="${!table}">${icon('chart')}${tr.chart}</button>
      <button type="button" data-view="table" aria-pressed="${table}">${icon('table')}${tr.table}</button>
    </div>
    <button type="button" class="at-plot-export" data-export title="${tr.download}" aria-label="${tr.download}">${icon('download')}CSV</button>
  </div>`
  const key = series.map((s,i) => `<button type="button" class="at-plot-key" ${style(i)} data-key="${i}" aria-pressed="true">
    <svg aria-hidden="true" width="23" height="14" viewBox="0 0 23 14" stroke="currentColor" fill="currentColor"><path d="M1 7H22" stroke-width="2" stroke-dasharray="${dashes[i%4]}"/>${glyph(i,11.5,7,2.7)}</svg>
    <span>${esc(name(s))}</span></button>`).join('')
  root.innerHTML = `<section class="at-plot${options.compact ? ' at-plot-compact' : ''}" aria-labelledby="${id}-title">
    <header class="at-plot-head"><h3 id="${id}-title">${title}</h3>${controls}</header>
    <div class="at-plot-summary"><div class="at-plot-legend" role="group" aria-label="${tr.plotted}">${key}</div><span class="at-plot-unit">${esc(series[0].unit)}</span></div>
    <div data-visual ${table ? 'hidden' : ''}>
      <div class="at-plot-grid">
        <div class="at-plot-y" aria-hidden="true"></div>
        <div class="at-plot-canvas" role="slider" aria-label="${tr.inspect} · ${title}" tabindex="0" aria-valuemin="0" aria-valuemax="${rows.length-1}">
          <svg class="at-plot-svg" aria-hidden="true" preserveAspectRatio="none"></svg>
          <div class="at-plot-cursor" aria-hidden="true"></div>
          <div class="at-plot-tooltip" aria-hidden="true" hidden></div>
        </div>
        <div class="at-plot-x" aria-hidden="true"></div>
      </div>
      <div class="at-plot-readout" aria-label="${tr.selected}"></div>
    </div>
    <div class="at-plot-data" data-data ${table ? '' : 'hidden'}></div>
    <div class="at-plot-gap"></div></section>`
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!
  const svg = $<SVGSVGElement>('.at-plot-svg'), cursor = $('.at-plot-cursor'), tip = $('.at-plot-tooltip')
  const canvas = $('.at-plot-canvas'), readout = $('.at-plot-readout')
  const fixed = 1000
  const height = 230
  const frac = (i: number) => options.bars || rows.length === 1 ? (i + .5)/rows.length : i/(rows.length-1)
  let y = (v: number) => height - v
  const focusedRow = (i: number, popup = false) => {
    selected = i
    cursor.style.visibility = ''
    const row = rows[i], ids = active()
    const values = ids.map(j => {
      const v = row.values[j]
      return v === null ? tr.missing : display.format(v) + ' ' + series[j].unit
    })
    cursor.style.left = (frac(i)*100) + '%'
    cursor.innerHTML = ids.map(j => {
      const v = row.values[j]
      return v === null ? '' : `<i class="at-plot-dot at-plot-dot-${j%3}" ${style(j)} data-y="${y(v)}"></i>`
    }).join('')
    cursor.querySelectorAll<HTMLElement>('[data-y]').forEach(dot => dot.style.top = Number(dot.dataset.y)/height*100 + '%')
    const label = formatMonth(row.month)
    canvas.setAttribute('aria-valuenow',String(i))
    canvas.setAttribute('aria-valuetext',[label, ...ids.map((j,k) => name(series[j]) + ' ' + values[k]), options.tooltipNote].filter(Boolean).join(', '))
    const measurements = ids.map((j,k) => `<span ${style(j)}><i></i>${ids.length > 1 ? esc(name(series[j])) + ' ' : ''}<b>${esc(values[k])}</b></span>`).join('')
    readout.innerHTML = `<time datetime="${row.month}">${esc(label)}</time>${measurements}`
    if (popup) {
      tip.innerHTML = `<strong>${esc(label)}</strong>${measurements}${options.tooltipNote ? `<small class="at-plot-annotation">${esc(options.tooltipNote)}</small>` : ''}`
      tip.hidden = false
      const w = canvas.clientWidth, tw = tip.offsetWidth
      const offset = frac(i)*w + (frac(i) >= .55 ? -tw-12 : 12)
      tip.style.left = Math.max(0,Math.min(w-tw,offset)) + 'px'
    } else tip.hidden = true
  }
  function drawGraph() {
    const ids = active()
    const values = rows.flatMap(r => ids.map(i => r.values[i]).filter((v): v is number => v !== null))
    const max = scaleMax(values.reduce((a,v) => Math.max(a,v),0))
    const minValue = values.reduce((a,v) => Math.min(a,v),0)
    const min = minValue < 0 ? -scaleMax(-minValue) : 0
    y = (v: number) => height*(max-v)/(max-min)
    const ticks = Array.from({length:5},(_,i) => max-(max-min)*i/4)
    $('.at-plot-y').innerHTML = ticks.map(t => `<span>${esc(axis.format(t))}</span>`).join('')
    const grid = ticks.map(t => `M0 ${y(t)}H${fixed}`).join(' ')
    let traces = ''
    for (const [trackIndex, j] of ids.entries()) {
      const colour = marks[j%marks.length], dash = dashes[j%4]
      const coords: [number,number][][] = []
      let part: [number,number][] = []
      for (const [i, row] of rows.entries()) {
        const v = row.values[j]
        if (v === null) {
          if (part.length) coords.push(part)
          part = []
        } else part.push([frac(i)*fixed, y(v)])
      }
      if (part.length) coords.push(part)
      for (const points of coords) {
        if (options.bars) {
          const groupWidth = fixed/rows.length * .72, barWidth = groupWidth/ids.length
          traces += points.map(([x, v]) => `<rect fill="${colour}" x="${x-groupWidth/2+trackIndex*barWidth}" y="${Math.min(v,y(0))}" width="${barWidth}" height="${Math.abs(y(0)-v)}"/>`).join('')
        } else {
          const line = points.map(([x, v]) => `${x.toFixed(2)} ${v.toFixed(2)}`).join('L')
          if (ids.length === 1 && points.length > 1)
            traces += `<path fill="url(#${id}-fill)" d="M${line}V${y(0)}H${points[0][0]}Z"/>`
          traces += `<path class="at-plot-line" d="M${line}" fill="none" stroke="${colour}" stroke-dasharray="${dash}"/>`
          if (points.length === 1 || rows.length <= 36 && ids.length > 1) {
            traces += `<g fill="${colour}">${points.map(([x, v]) => glyph(j,x,v,3.8)).join('')}</g>`
          }
        }
      }
    }
    const fill = marks[ids[0]%marks.length]
    svg.setAttribute('viewBox',`0 0 ${fixed} ${height}`)
    svg.innerHTML = `<defs><linearGradient id="${id}-fill" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="${fill}" stop-opacity=".17"/><stop offset="1" stop-color="${fill}" stop-opacity=".025"/></linearGradient></defs><path class="at-plot-rules" d="${grid}"/>${traces}`
    const tickCount = options.compact ? 3 : 4
    const tickMonths = [...new Set(Array.from({length:tickCount},(_,k) => Math.round(k*(rows.length-1)/(tickCount-1))))]
    $('.at-plot-x').innerHTML = tickMonths.map((i,k) => `<span style="left:${frac(i)*100}%;transform:translateX(${k===0 && tickMonths.length>1 ? 0 : k===tickMonths.length-1 && tickMonths.length>1 ? -100 : -50}%)">${esc(formatMonth(rows[i].month))}</span>`).join('')
    focusedRow(selected)
  }

  function drawTable() {
    const ids = active()
    const th = ids.map(i => `<th scope="col">${esc(name(series[i]))} · ${esc(series[i].unit)}</th>`).join('')
    const body = rows.slice().reverse().map(row => `<tr><th scope="row"><time datetime="${row.month}">${row.month}</time></th>${ids.map(i => `<td>${row.values[i] === null ? tr.missing : esc(readable.format(row.values[i]!))}</td>`).join('')}</tr>`).join('')
    $('[data-data]').innerHTML = `<div class="at-plot-scroll" role="region" aria-label="${tr.scroll}" tabindex="0"><table><caption class="at-plot-sr">${title}</caption><thead><tr><th scope="col">${tr.month} (UTC)</th>${th}</tr></thead><tbody>${body}</tbody></table></div>`
  }
  function updateControls() {
    root.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(b => {
      const shown = visible.has(Number(b.dataset.key))
      b.setAttribute('aria-pressed', String(shown))
      b.setAttribute('aria-disabled', String(shown && visible.size === 1))
    })
    const download = root.querySelector<HTMLButtonElement>('[data-export]')
    if (download) download.hidden = !active().every(i => {
      const s = series[i]
      return s.downloadable ?? /^(?:CC(?:0|[ -]BY)|ODbL|PDDL|Public Domain)/i.test(s.license)
    })
  }
  function pick(index: number, popup: boolean) {
    const i = Math.max(0,Math.min(rows.length-1,index))
    const changed = selected !== i
    if (changed || tip.hidden || !popup) focusedRow(i,popup)
    if (changed) options.onInspect?.(rows[i].month)
  }
  const locate = (clientX: number) => {
    const box = canvas.getBoundingClientRect()
    const fraction = (clientX-box.left)/Math.max(1,box.width)
    return options.bars ? Math.floor(fraction*rows.length) : Math.round(fraction*(rows.length-1))
  }
  canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') pick(locate(e.clientX),true) })
  canvas.addEventListener('pointerup', e => pick(locate(e.clientX),true))
  canvas.addEventListener('pointerleave', () => { tip.hidden = true })
  canvas.addEventListener('focus', () => focusedRow(selected,true))
  canvas.addEventListener('blur', () => { tip.hidden = true })
  canvas.addEventListener('keydown', e => {
    if (e.key === 'Escape') { tip.hidden = true; return }
    const movement: Record<string,number> = {ArrowRight:selected+1,ArrowUp:selected+1,ArrowLeft:selected-1,ArrowDown:selected-1,PageUp:selected+12,PageDown:selected-12,Home:0,End:rows.length-1}
    if (e.key in movement) { e.preventDefault(); pick(movement[e.key],true) }
  })
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.addEventListener('click',() => {
    table = b.dataset.view === 'table'
    $('[data-visual]').hidden = table
    $('[data-data]').hidden = !table
    if (table) drawTable()
    root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.setAttribute('aria-pressed',String((b.dataset.view === 'table') === table)))
    options.onViewChange?.(table)
  }))
  root.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(b => b.addEventListener('click',() => {
    const i = Number(b.dataset.key)
    if (visible.has(i) && visible.size === 1) return
    if (visible.has(i)) visible.delete(i)
    else visible.add(i)
    updateControls()
    drawGraph()
    if (table) drawTable()
  }))
  root.querySelector<HTMLButtonElement>('[data-export]')?.addEventListener('click', () => {
    if (options.onExport) {
      options.onExport(rows.map(row => row.month), active())
      return
    }
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([plotCSV(series,rows,active())],{type:'text/csv;charset=utf-8'}))
    const assets = active().map(i => series[i].asset).join('-')
    link.download = ['circula',assets,series[0].metric,rows[0].month,rows[rows.length-1].month].join('_') + '.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 5000)
  })
  const missing = rows.filter(row => row.values.every(v => v === null)).length
  if (missing) $('.at-plot-gap').textContent = tr.gap + ' · ' + missing
  updateControls()
  drawGraph()
  if (table) drawTable()
  return { inspect(month) {
    const i = months.get(month)
    if (i !== undefined) focusedRow(i)
    else {
      cursor.style.visibility = 'hidden'
      tip.hidden = true
      readout.textContent = (validMonth(month) ? formatMonth(month) : month) + ' · ' + tr.missing
    }
    if (i !== undefined) cursor.style.visibility = ''
  }}
}
