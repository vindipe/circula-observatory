import { esc } from '../ui/html'
import { tr, type Lang } from './copy'
import { catalogText, gapCopy, type CatalogueKey } from './catalog-copy'
import { catalogEndpoint, communityApi, licenseUrl, monthValue, observedMonths, sourceDocs,
  type Area, type CatalogueIndicator, type Census, type MetricStatus, type Values } from './catalog-data'
import { mountPlot, type AtlasSeries } from './plot'
import './catalogue.css'

const areas: Area[] = ['infrastructure', 'holdings', 'circulation']
const statuses: MetricStatus[] = ['chart', 'input', 'restricted', 'unlisted', 'other-frequency', 'outside']
const source = 'Coin Metrics Community'
const license = 'CC BY-NC 4.0'
const pageSize = 12
const defaultMonth = '2019-12'
type StateChanges = Record<string, string | undefined>
type TableRow = { id: string; values: Values; count: number }

const option = (key: string, label: string, current: string) =>
  `<option value="${esc(key)}"${key === current ? ' selected' : ''}>${esc(label)}</option>`
const external = (href: string, label: string) =>
  `<a href="${esc(href)}" target="_blank" rel="noreferrer">${esc(label)} ↗</a>`
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const searchMatch = (text: string, query: string) => query.split(/\s+/).filter(Boolean)
  .every(term => normalize(text).includes(normalize(term)))
const month = (day: string) => day.slice(0, 7)

function download(name: string, rows: unknown[][]) {
  const field = (value: unknown) => {
    const text = String(value ?? '')
    const safe = typeof value === 'string' && /^[=+@\-\t\r\n]/.test(text) ? "'" + text : text
    return '"' + safe.replaceAll('"', '""') + '"'
  }
  const body = rows.map(row => row.map(field).join(',')).join('\r\n') + '\r\n'
  const href = URL.createObjectURL(new Blob([body], {type: 'text/csv;charset=utf-8'}))
  const anchor = document.createElement('a')
  anchor.download = name + '.csv'
  anchor.href = href
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(href), 5000)
}

function pagination(total: number, requested: string | null) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(pages, Math.max(1, parseInt(requested ?? '1', 10) || 1))
  return {page, pages, start: (page - 1) * pageSize, end: page * pageSize}
}

export function mountCatalogue(host: HTMLElement, {audit, data}: Census, lang: Lang) {
  const t = (key: CatalogueKey) => catalogText(lang, key)
  const areaLabel = (area: Area) => tr(lang, area)
  const dateList = data.months.map(month)
  const monthIndex = new Map(dateList.map((value, index) => [value, index]))
  const byCode = new Map(audit.metrics.map(row => [row[0], row]))
  const reading = new Intl.NumberFormat(lang, {maximumSignificantDigits: 7})
  const f = (value: number | null | undefined) => value == null ? t('missing') : reading.format(value)
  const textOf = (spec: CatalogueIndicator): [string, string, string] =>
    lang === 'it' ? spec.it : [spec.title, spec.why, spec.caution]
  const get = (id: string) => host.querySelector<HTMLElement>('#' + id)
  const scope = (id: string) => t(data.assets[id][1])
  const descriptor = (id: string) => {
    const [name, , parent] = data.assets[id]
    return [id, name, scope(id), parent, data.assets[parent]?.[0]].filter(Boolean).join(' · ')
  }
  const route = (changes: StateChanges) => {
    const p = new URLSearchParams({view: 'catalogue'})
    if (lang !== 'en') p.set('lang', lang)
    for (const [key, value] of Object.entries(changes)) {
      if (value) p.set(key, value)
      else p.delete(key)
    }
    return location.pathname + (p.size ? '?' + p : '')
  }
  function change(changes: StateChanges, focus = '', replace = false) {
    const p = new URLSearchParams(location.search)
    for (const [key, value] of Object.entries(changes)) {
      if (value) p.set(key, value)
      else p.delete(key)
    }
    const target = location.pathname + '?' + p.toString()
    if (target !== location.pathname + location.search) {
      history[replace ? 'replaceState' : 'pushState'](null, '', target)
    }
    if (!replace) {
      render()
      if (focus) get(focus)?.focus({preventScroll: true})
    }
  }
  function routeLink(changes: StateChanges, text: string, active = false) {
    return `<a data-atlas href="${esc(route(changes))}"${active ? ' aria-current="page"' : ''}>${esc(text)}</a>`
  }
  function pager(prefix: string, page: number, pages: number, total: number) {
    return `<div class="ic-pager"><span id="${prefix}-pages" tabindex="-1">${reading.format(total)} · ${page} / ${pages}</span>
      <button id="${prefix}-prev" type="button"${page === 1 ? ' disabled' : ''}>${esc(t('previous'))}</button>
      <button id="${prefix}-next" type="button"${page === pages ? ' disabled' : ''}>${esc(t('next'))}</button></div>`
  }
  function bindPager(prefix: string, field: string, page: number) {
    const prev = get(prefix + '-prev')
    const next = get(prefix + '-next')
    if (prev) prev.onclick = () => change({[field]: String(page - 1)}, prefix + '-pages')
    if (next) next.onclick = () => change({[field]: String(page + 1)}, prefix + '-pages')
  }
  function render() {
    const p = new URLSearchParams(location.search)
    const isAudit = p.get('mode') === 'audit'
    const stats = audit.totals
    host.innerHTML = `<section class="ic-head"><div class="a-bread"><a data-atlas href="${esc(route({view: undefined}))}">${esc(tr(lang, 'atlas'))}</a></div><h1>${esc(t('heading'))}</h1><p>${esc(t('lead'))}</p>
      <div class="ic-counts"><span><strong>${stats.published}</strong> ${esc(t('measures'))}</span><span><strong>${stats.assetIds}</strong> ${esc(t('resourceIds'))}</span>
      <span>${esc(t('through'))} <time datetime="${esc(data.cutoff)}">${esc(data.cutoff)} UTC</time></span></div></section>
      <nav class="ic-tabs" aria-label="${esc(t('catalogue'))}">${routeLink({}, t('explorer'), !isAudit)}${routeLink({mode: 'audit'}, t('audit'), isAudit)}</nav>
      <div id="ic-content"></div><footer class="ic-source"><p>${esc(t('methodNote'))}</p><div>${external(catalogEndpoint, source)} · ${external(licenseUrl, license)}</div></footer>`
    const content = get('ic-content')!
    if (isAudit) renderAudit(content, p)
    else renderExplorer(content, p)
  }

  function renderExplorer(content: HTMLElement, p: URLSearchParams) {
    const requested = audit.indicators.find(spec => spec.id === p.get('metric'))
    const area = areas.find(item => item === p.get('area')) ?? requested?.area ?? 'infrastructure'
    const query = p.get('mq') ?? ''
    const matches = audit.indicators.filter(spec => (!query ? spec.area === area : searchMatch(
      [textOf(spec)[0], spec.title, spec.id, spec.formula, ...spec.codes, areaLabel(spec.area)].join(' '), query)))
    const spec = matches.find(option => option.id === requested?.id) ?? matches[0]
    const selectedArea = spec?.area ?? area
    content.innerHTML = `<div class="ic-areas" role="group" aria-label="${esc(t('allAreas'))}">${areas.map(a =>
      `<button id="ic-area-${a}" data-c-area="${a}" type="button" aria-pressed="${a === selectedArea && !query}">${esc(areaLabel(a))}</button>`).join('')}</div>
      <div class="ic-pickers"><label class="a-field"><span>${esc(t('select'))}</span><select id="ic-metric"${spec ? '' : ' disabled'}>${matches.map(item =>
        option(item.id, textOf(item)[0] + ' · ' + item.catalogCount, spec?.id ?? '')).join('')}</select></label>
      <form id="ic-metric-search" class="ic-search"><label class="a-field"><span>${esc(t('search'))}</span><input name="q" type="search" value="${esc(query)}"></label>
      <button type="submit">${esc(t('find'))}</button></form></div><div id="ic-detail"></div>`
    content.querySelectorAll<HTMLButtonElement>('[data-c-area]').forEach(button => {
      button.onclick = () => change({area: button.dataset.cArea, metric: '', mq: '', asset: '', compare: '', aq: '', ap: '', month: ''}, button.id)
    })
    const metric = get('ic-metric')
    if (metric instanceof HTMLSelectElement) metric.onchange = () => change({metric: metric.value, asset: '', compare: '', aq: '', ap: '', month: ''}, metric.id)
    const form = get('ic-metric-search') as HTMLFormElement
    form.onsubmit = event => {
      event.preventDefault()
      change({mq: String(new FormData(form).get('q') ?? '').trim().slice(0, 120),
        metric: '', asset: '', compare: '', aq: '', ap: '', month: ''}, 'ic-metric')
    }
    const detail = get('ic-detail')!
    if (!spec) {
      detail.innerHTML = `<p class="ic-empty" role="status">${esc(t('empty'))}</p><a data-atlas href="${esc(route({mode: 'audit', q: query}))}">${esc(t('audit'))} ↗</a>`
      return
    }
    renderIndicator(detail, spec, p)
  }

  function renderIndicator(detail: HTMLElement, spec: CatalogueIndicator, p: URLSearchParams) {
    const [title, why, caution] = textOf(spec)
    const dataset = data.rows[spec.id]
    const ids = Object.keys(dataset).sort((a, b) => data.assets[a][0].localeCompare(data.assets[b][0], lang))
    const primary = ids.find(id => id === p.get('asset')) ?? (Object.hasOwn(dataset, 'btc') ? 'btc' : ids[0])
    const secondary = ids.find(id => id !== primary && id === p.get('compare'))
    const selected = secondary ? [primary, secondary] : [primary]
    const from = p.get('from') ?? '', to = p.get('to') ?? ''
    const lo = monthIndex.get(from) ?? monthIndex.get(defaultMonth) ?? 0
    const hi = monthIndex.get(to) ?? dateList.length - 1
    const start = lo <= hi ? lo : 0, end = lo <= hi ? hi : dateList.length - 1
    const fromDay = data.months[start], toDay = data.months[end]
    const coverageRows: TableRow[] = ids.map(id => ({id, values: dataset[id], count: observedMonths(dataset[id], start, end)}))
    const filtered = coverageRows.filter(row => searchMatch(descriptor(row.id), p.get('aq') ?? ''))
    if (p.get('sort') === 'coverage') filtered.sort((a, b) => b.count - a.count)
    const {page, pages, start: begin, end: finish} = pagination(filtered.length, p.get('ap'))
    const withData = coverageRows.filter(row => row.count > 0).length
    const paired = coverageRows.filter(({values}) => monthValue(values, start) !== null && monthValue(values, end) !== null).length
    const selectedName = data.assets[primary][0]
    const sources = spec.codes.map(id => external(byCode.get(id)?.[12] || sourceDocs, id)).join(' · ')
    const codeNames = spec.codes.map(id => byCode.get(id)?.[1] || id).join(' · ')
    const values = (row: Values) => [monthValue(row, start), monthValue(row, end)] as const
    const changeValue = ([first, last]: readonly (number | null)[]) => first != null && last != null ? last - first : null
    const displayUnit = (id: string) => spec.unit.startsWith('native units') ? spec.unit + ' · ' + id.toUpperCase() : spec.unit
    const dailySource = (id: string) => {
      const url = new URL(communityApi + '/timeseries/asset-metrics')
      for (const [key, value] of Object.entries({
        assets: id, metrics: spec.codes.join(','), frequency: '1d', end_time: data.cutoff,
        page_size: '10000', format: 'csv', ignore_forbidden_errors: 'true', ignore_unsupported_errors: 'true',
      })) url.searchParams.set(key, value)
      return external(url.toString(), t('inputDownload'))
    }
    const assetOptions = ids.map(id => option(id, data.assets[id][0] + ' · ' + id, primary)).join('')
    const compareOptions = ids.filter(id => id !== primary).map(id => option(id, data.assets[id][0] + ' · ' + id, secondary ?? '')).join('')
    detail.innerHTML = `<section class="ic-card"><div class="ic-indicator-head"><div>
      <p class="ic-domain">${esc(areaLabel(spec.area))} · ${esc(t(spec.role))}</p><h2>${esc(title)}</h2></div><span class="ic-kind">${esc(t(spec.derived ? 'derived' : 'direct'))}</span></div>
      <div class="ic-workspace"><div class="ic-chart"><div class="ic-chart-picks">
      <label class="a-field"><span>${esc(tr(lang, 'asset'))}</span><select id="ic-asset">${assetOptions}</select></label>
      <label class="a-field"><span>${esc(t('compare'))}</span><select id="ic-compare">${option('', tr(lang, 'none'), secondary ?? '')}${compareOptions}</select></label></div>
      <form id="ic-dates" class="ic-dates"><label class="a-field"><span>${esc(tr(lang, 'from'))}</span><input name="from" type="month" min="${dateList[0]}" max="${dateList.at(-1)}" value="${dateList[start]}" required></label>
      <label class="a-field"><span>${esc(tr(lang, 'to'))}</span><input name="to" type="month" min="${dateList[0]}" max="${dateList.at(-1)}" value="${dateList[end]}" required></label>
      <button id="ic-apply" type="submit">${esc(t('apply'))}</button><button id="ic-full" type="button">${esc(t('full'))}</button></form>
      <div id="ic-plot"></div><p class="ic-note">${esc(t('datesNote'))}</p></div>
      <div class="ic-reading"${lang === 'de' || lang === 'fr' ? ' lang="en"' : ''}>
      ${lang === 'de' || lang === 'fr' ? `<small lang="${lang}">${esc(t('detailEnglish'))}</small>` : ''}
      <h3 lang="${lang}">${esc(t('reason'))}</h3><p>${esc(why)}</p>
      <h3 lang="${lang}">${esc(t('technique'))}</h3><p><code>${esc(spec.formula)}</code></p><p class="ic-unit">${esc(spec.unit)} · ${esc(t('period'))}</p>
      <h3 lang="${lang}">${esc(t('read'))}</h3><p>${esc(caution)}</p>
      <p class="ic-provider-names" lang="en">${esc(codeNames)}</p><p class="ic-links">${sources}</p>
      <p class="ic-links">${selected.map(id => dailySource(id) + ` <code>${esc(id)}</code>`).join('<br>')}</p>
      ${data.assets[primary][3] ? `<p class="ic-contract">${external(data.assets[primary][4], data.assets[primary][3])}</p>` : ''}
      </div></div></section>
      <section class="ic-coverage" aria-labelledby="ic-coverage"><div class="ic-sectionhead"><div><h2 id="ic-coverage">${esc(t('available'))}</h2>
      <p>${reading.format(withData)} / ${reading.format(ids.length)} ${esc(t('observed'))} · ${paired} ${esc(t('bothCutoffs'))}</p></div>
      <div class="ic-downloads"><button id="ic-export" type="button">${esc(t('export'))}</button><button id="ic-series-export" type="button">${esc(t('seriesExport'))}</button></div></div>
      <p class="ic-note">${esc(t('subset'))}</p>
      <form id="ic-asset-search" class="ic-search ic-coverage-search"><label class="a-field"><span>${esc(t('assetSearch'))}</span><input id="ic-filter" type="search" name="q" value="${esc(p.get('aq') ?? '')}"></label>
      <label class="a-field"><span>${esc(t('sort'))}</span><select id="ic-sort">${option('', t('order'), p.get('sort') ?? '')}${option('coverage', t('most'), p.get('sort') ?? '')}</select></label>
      <button type="submit">${esc(t('find'))}</button></form>
      ${filtered.length ? `<div class="ic-table" role="region" aria-label="${esc(t('available'))}" tabindex="0"><table>
      <thead><tr><th scope="col">${esc(tr(lang, 'asset'))}</th><th scope="col">${esc(fromDay)}</th><th scope="col">${esc(toDay)}</th><th scope="col">Δ</th>
      <th scope="col">${esc(t('points'))}</th><th scope="col">${esc(t('last'))}</th><th scope="col">${esc(t('range'))}</th></tr></thead>
      <tbody>${filtered.slice(begin, finish).map(({id, values: row, count}) => {
        const [a, b] = values(row)
        const asset = data.assets[id]
        const parent = asset[1] === 'deployment' && asset[2] ? ' · ' + (data.assets[asset[2]]?.[0] || asset[2]) : ''
        return `<tr${id === primary ? ' class="ic-selected"' : ''}><th scope="row"><button type="button" data-c-asset="${esc(id)}"${id === primary ? ' aria-current="true"' : ''}>${esc(asset[0])}</button>
          <small><code>${esc(id)}</code> · ${esc(scope(id) + parent)}</small></th><td>${esc(f(a))}</td><td>${esc(f(b))}</td><td>${esc(f(changeValue([a,b])))}</td>
          <td>${count}</td><td>${esc(f(row[2]?.[1]))}${row[2] ? `<small>${esc(row[2][0])}</small>` : ''}</td>
          <td>${esc(row[0][0])}<small>${esc(row[0][1])}</small></td></tr>`
      }).join('')}</tbody></table></div>${pager('ic-assets', page, pages, filtered.length)}` :
    `<p class="ic-empty" role="status">${esc(t('empty'))}</p>`}</section>`
    const makeSeries = (id: string, unit: string, comparison: string | null): AtlasSeries => {
      const row = dataset[id]
      const points: [string, number][] = []
      const [offset, sampled] = row[1]
      for (const [index, value] of sampled.entries()) {
        if (value != null) points.push([dateList[offset + index], value])
      }
      return {asset: id, name: data.assets[id][0] + ' · ' + id, network: data.assets[id][2],
        contract: data.assets[id][3] || null, metric: spec.id, label: title,
        unit, kind: 'month-end', scope: scope(id), points, comparison, dashboard: 'catalogue',
        method: spec.formula, source, sourceUrl: catalogEndpoint, license, licenseUrl}
    }
    const plot = get('ic-plot')!
    const sameScope = secondary ? data.assets[primary][1] === data.assets[secondary][1]
      && data.assets[primary][1] !== 'provider' : false
    const sameUnit = !spec.unit.startsWith('native units') && spec.unit !== 'protocol-specific'
    const overlap = secondary ? dateList.slice(start, end + 1).some((_, i) =>
      monthValue(dataset[primary], start + i) != null && monthValue(dataset[secondary], start + i) != null) : false
    const together = !!secondary && sameScope && sameUnit && overlap
    const plotOptions = {
      lang, from: dateList[start], to: dateList[end], selected: p.get('month') ?? '',
      table: p.get('table') === '1',
      onInspect: (value: string) => change({month: value}, '', true),
      onViewChange: (table: boolean) => change({table: table ? '1' : ''}, '', true),
    }
    if (secondary && !together) {
      plot.innerHTML = `<p class="ic-note">${esc(t(!overlap ? 'noOverlap' : sameUnit ? 'scopeCompare' : 'nativeCompare'))}</p>`
      for (const id of selected) {
        const panel = document.createElement('div')
        panel.className = 'ic-individual'
        plot.appendChild(panel)
        mountPlot(panel, [makeSeries(id, displayUnit(id), null)], {...plotOptions, title: data.assets[id][0]})
      }
    } else {
      mountPlot(plot, selected.map(id => makeSeries(id, displayUnit(id), together ? spec.id : null)),
        {...plotOptions, title: secondary ? title : selectedName})
      if (together) plot.insertAdjacentHTML('beforeend', `<p class="ic-note">${esc(t('comparable'))}</p>`)
    }
    const select = (id: string, field: string, limits: StateChanges = {}) => {
      const input = get(id)
      if (input instanceof HTMLSelectElement) input.onchange = () => change({[field]: input.value, month: '', ...limits}, id)
    }
    select('ic-asset', 'asset', {compare: ''})
    select('ic-compare', 'compare')
    select('ic-sort', 'sort', {ap: ''})
    const dates = get('ic-dates') as HTMLFormElement
    const until = dates.elements.namedItem('to') as HTMLInputElement
    until.oninput = () => until.setCustomValidity('')
    ;(dates.elements.namedItem('from') as HTMLInputElement).oninput = () => until.setCustomValidity('')
    dates.onsubmit = event => {
      event.preventDefault()
      const fields = new FormData(dates)
      const start = String(fields.get('from')), finish = String(fields.get('to'))
      if (!monthIndex.has(start) || !monthIndex.has(finish) || start > finish) {
        until.setCustomValidity(tr(lang, 'period'))
        until.reportValidity()
        return
      }
      change({from: start, to: finish, month: '', ap: ''}, 'ic-apply')
    }
    get('ic-full')!.onclick = () => change({from: dateList[0], to: dateList.at(-1), month: '', ap: ''}, 'ic-full')
    const assetSearch = get('ic-asset-search') as HTMLFormElement
    assetSearch.onsubmit = event => {
      event.preventDefault()
      change({aq: String(new FormData(assetSearch).get('q') ?? '').trim().slice(0, 100), ap: ''}, 'ic-filter')
    }
    detail.querySelectorAll<HTMLButtonElement>('[data-c-asset]').forEach(button => {
      button.onclick = () => {
        change({asset: button.dataset.cAsset, compare: '', month: ''}, 'ic-asset')
        get('ic-asset')?.scrollIntoView({block: 'nearest'})
      }
    })
    bindPager('ic-assets', 'ap', page)
    get('ic-export')!.onclick = () => download('circula-coverage-' + spec.id, [
      ['indicator','formula','asset','name','scope','host','unit','first_catalog_utc','last_catalog_utc','from_utc','from_value',
        'to_utc','to_value','delta','delta_pct_if_positive_baseline','observed_months','latest_observed_utc','latest_observed_value','source','license'],
      ...coverageRows.map(({id, values: row, count}) => {
        const [a, b] = values(row)
        return [spec.id,spec.formula,id,...data.assets[id].slice(0,3),spec.unit,...row[0],fromDay,a,toDay,b,
          changeValue([a,b]),a != null && a > 0 && b != null ? (b - a) / a * 100 : null,
          count,row[2]?.[0],row[2]?.[1],source,license]
      }),
    ])
    get('ic-series-export')!.onclick = () => download('circula-monthly-' + spec.id, [
      ['indicator','formula','asset','scope','host','month_end_utc','value','status','unit','source','license'],
      ...coverageRows.flatMap(({id, values: row}) => data.months.slice(start, end + 1).map((day, i) => {
        const value = monthValue(row, start + i)
        return [spec.id,spec.formula,id,data.assets[id][1],data.assets[id][2],day,value,
          value == null ? 'missing' : 'observed',spec.unit,source,license]
      })),
    ])
  }

  function renderAudit(content: HTMLElement, p: URLSearchParams) {
    const search = p.get('q') ?? ''
    const status = statuses.find(value => value === p.get('decision')) ?? ''
    const area = areas.find(value => value === p.get('area')) ?? ''
    const all = audit.metrics.filter(row => (!status || row[8] === status) && (!area || row[6] === area) &&
      searchMatch([row[0],row[1],row[2],row[3],row[4],row[7],t(row[8])].join(' '), search))
    const {page, pages, start, end} = pagination(all.length, p.get('page'))
    const number = (value: number) => reading.format(value)
    const toAtlas = (view: string) => {
      const query = new URLSearchParams({view})
      if (lang !== 'en') query.set('lang', lang)
      return `<a data-atlas href="${esc(location.pathname + '?' + query)}">${esc(t('openAtlas'))} ↗</a>`
    }
    content.innerHTML = `<section class="ic-audit-intro"><p>${esc(t('auditLead'))}</p><p>${esc(t('scopeLead'))}</p>
      <div class="ic-counts"><span><strong>${number(audit.totals.definitions)}</strong> ${esc(t('definitions'))}</span>
      <span><strong>${number(audit.totals.relevant)}</strong> ${esc(t('relevant'))}</span>
      <span><strong>${number(audit.totals.publicCodes)}</strong> ${esc(t('publicCodes'))}</span></div>
      <p class="ic-note">${esc(t('checked'))} ${esc(audit.asOf)} UTC ·
      ${external(communityApi + '/reference-data/asset-metrics', 'Reference data')} · ${external(communityApi + '/catalog-all/asset-metrics', 'Full catalog')} ·
      ${external(catalogEndpoint, 'Community catalog')}</p></section>
      <section class="ic-coverage" aria-labelledby="ic-audit-catalog"><div class="ic-sectionhead"><h2 id="ic-audit-catalog">${esc(t('audit'))}</h2>
      <button type="button" id="ic-audit-export">${esc(t('csvAll'))}</button></div>
      <form id="ic-audit-search" class="ic-search"><label class="a-field"><span>${esc(t('search'))}</span><input id="ic-audit-query" name="q" type="search" value="${esc(search)}"></label>
      <label class="a-field"><span>${esc(t('allAreas'))}</span><select name="area">${option('', t('allAreas'), area)}${areas.map(value => option(value, areaLabel(value), area)).join('')}</select></label>
      <label class="a-field"><span>${esc(t('status'))}</span><select name="decision">${option('', t('allStatus'), status)}${statuses.map(value => option(value, t(value), status)).join('')}</select></label>
      <button type="submit">${esc(t('find'))}</button></form>
      ${all.length ? `<div class="ic-table" role="region" aria-label="${esc(t('audit'))}" tabindex="0"><table>
      <thead><tr><th scope="col">${esc(t('code'))}</th><th scope="col">${esc(t('domain'))}</th><th scope="col">${esc(t('status'))}</th><th scope="col">${esc(t('cmCoverage'))}</th></tr></thead>
      <tbody>${all.slice(start, end).map(row => `<tr><th scope="row">
      ${row[8] === 'chart' ? routeLink({metric: row[0]}, row[0]) : external(row[12] || sourceDocs, row[0])}
      <small lang="en">${esc(row[1])} · ${esc(row[5] || '—')}</small></th><td>
      ${row[6] ? esc(areaLabel(row[6])) : esc(row[2] || '—')}<small>${esc(row[3] || '')} · ${esc(row[4] || '')}</small></td>
      <td>${esc(t(row[8]))}</td><td>${row[9]} / ${row[10]}${row[11] && row[11] !== '1d' ? `<small>${esc(row[11])}</small>` : ''}</td></tr>`).join('')}</tbody>
      </table></div>${pager('ic-audit', page, pages, all.length)}` : `<p class="ic-empty" role="status">${esc(t('empty'))}</p>`}</section>
      <section class="ic-gaps"><h2>${esc(t('gaps'))}</h2><p>${esc(t('gapsLead'))}</p>
      <div>${audit.gaps.map(([id, area, title, italian, formula, inputs, view]) => `<article><small>${esc(areaLabel(area))}</small>
      <h3>${esc(lang === 'it' ? italian : title)}</h3><p>${esc(gapCopy[id]?.[lang === 'it' ? 1 : 0] || '')}</p>
      <p><code>${esc(formula)}</code></p>
      ${inputs.length ? `<p class="ic-links">${inputs.map(key => routeLink({mode: 'audit', q: key}, key)).join(' · ')}</p>` : ''}
      ${view ? `<p class="ic-links">${toAtlas(view)}</p>` : ''}</article>`).join('')}</div></section>`
    bindPager('ic-audit', 'page', page)
    const form = get('ic-audit-search') as HTMLFormElement
    form.onsubmit = event => {
      event.preventDefault()
      const values = new FormData(form)
      change({q: String(values.get('q') ?? '').trim().slice(0, 120), area: String(values.get('area') ?? ''),
        decision: String(values.get('decision') ?? ''), page: ''}, 'ic-audit-query')
    }
    get('ic-audit-export')!.onclick = () => download('circula-coin-metrics-audit-' + audit.asOf, [
      ['metric','name','product','provider_category','provider_subcategory','unit','area','reason_family',
        'decision','community_daily_ids','full_daily_ids','community_frequencies','documentation'],
      ...audit.metrics,
    ])
  }

  render()
}
