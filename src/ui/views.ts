import {
  daysAgo, perspectives, type Catalog, type Detail, type Overview, type Perspective, type Series, type Status,
} from '../shared/model'
import { metrics, metricById, sources, sourceById } from '../shared/metrics'
import { icon, illustration, mark } from './art'
import { chart } from './chart'
import { en, categories, labels, lens } from './copy'
import { empty, entityPath, esc, ext, heading, link, number, path, period, pointsTable, select, time } from './html'

export const button = (url: string, label: string, primary = false, glyph = 'arrow') =>
  link(url, esc(label) + icon(glyph, 17), 'button' + (primary ? ' primary' : ''))

const kinds: [string, string][] = [['', 'All entities'], ...Object.entries(labels)]
const views = [['chart', 'Chart', 'chart'], ['table', 'Table', 'list']]
const kindLabel = (kind: string) => labels[kind as keyof typeof labels] ?? kind

export function shell(route: string) {
  const nav = en.nav.map(([href, title]) => link(href, esc(title), (route === href ? 'active' : '') + (href === '/status' ? ' status-nav' : ''),
    route === href ? 'aria-current="page"' : '')).join('')
  return '<header class="site-header"><div class="frame header-inner">'
    + link('/', mark + '<span><strong>CIRCULA</strong> <small>OBSERVATORY</small></span>', 'logo')
    + '<nav aria-label="Main navigation">' + nav + '</nav></div></header>'
    + '<main id="main" class="frame" tabindex="-1"></main>'
    + '<footer class="site-footer"><div class="frame footer-inner"><div class="foot-brand">' + mark
    + '<span>CIRCULA Observatory<small>Open research on digital resource lifecycles</small></span></div><nav aria-label="Project links">'
    + link('/methods', 'Data & licensing') + ext('https://github.com/vindipe/circula-observatory', 'Source code')
    + ext('https://circula.unine.ch/', 'CIRCULA project') + '</nav></div></footer>'
}

export function homeVisual(active: Perspective) {
  return illustration(active) + '<figcaption><span class="concept-dot"></span> Conceptual illustration <span class="visual-caption">'
    + esc(lens[active].caption) + '</span></figcaption>'
}

export function home(params: URLSearchParams, stats: Overview | null, broken = false) {
  const value = params.get('perspective') as Perspective
  const active = perspectives.includes(value) ? value : 'accumulate'
  const lenses = perspectives.map(p => {
    const item = lens[p]
    return '<button class="lens-card' + (p === active ? ' selected' : '') + '" data-lens="' + p + '" aria-pressed="' + (p === active)
      + '" style="--lens:' + item.color + '"><span class="lens-top"><span class="lens-icon">' + icon(p, 24) + '</span>'
      + '<span class="lens-arrow">' + icon('diagonal', 17) + '</span></span><strong>' + item.title + '</strong><span>'
      + esc(item.summary) + '</span></button>'
  }).join('')
  const archive = stats ? stats.counts.map(item => '<div class="stat"><span>' + esc(en[item.kind]) + '</span><strong>'
    + number(item.measured) + '</strong><small>with data <span> / ' + number(item.catalogued) + ' catalogued</span></small></div>').join('') : ''
  const featured = stats?.featured.map(item => {
    const metric = metricById.get(item.metric_id)
    return link(entityPath(item.id, item.metric_id), '<span class="sample-meta"><span>' + esc(kindLabel(item.kind)) + '</span>'
      + icon('diagonal', 17) + '</span><strong>' + esc(item.name) + '</strong><span>' + esc(metric?.name) + '</span>'
      + '<span class="sample-number">' + number(item.last_value, true) + ' <small>' + esc(item.unit) + '</small></span>'
      + '<time datetime="' + esc(item.last_day) + '">' + esc(time(item.last_day)) + '</time>', 'sample')
  }).join('')
  const questions = [
    ['ledger', 'How much history was added?', 'Bitcoin block bytes', '/research?study=ledger#study-questions', 'accumulate'],
    ['spending', 'When does older value move again?', 'Bitcoin outputs at spending', '/research?study=dormancy#study-questions', 'circulate'],
    ['expiry', 'What changes when entries expire?', 'Policy simulation', '/research?mode=lab#policy-lab', 'expire'],
  ].map(([id, question, scope, route, glyph]) => link(route,
    '<span class="home-study-symbol" aria-hidden="true">' + icon(glyph, 24) + '</span><span><small>' + esc(scope)
    + '</small><strong>' + esc(question) + '</strong></span>' + icon('arrow', 17), 'home-study home-study-' + id)).join('')
  return '<section class="hero"><div class="hero-copy"><p class="kicker"><span class="signal"></span> Open research observatory</p>'
    + '<h1 tabindex="-1">What can we observe<br class="hero-break"> without expiry<span>?</span></h1><p class="hero-tagline">' + en.tagline + '</p>'
    + '<div class="hero-actions">' + button('/research', 'Start the study', true) + button('/explorer', 'Browse the archive', false, 'diagonal') + '</div>'
    + '</div><figure id="concept" class="concept">' + homeVisual(active) + '</figure></section>'
    + '<section class="home-studies" aria-labelledby="home-study-title"><h2 id="home-study-title">Start with a question</h2><div>' + questions + '</div></section>'
    + '<section class="perspectives" aria-label="Four perspectives"><div class="section-lead"><div><p class="kicker">Perspectives</p>'
    + '<h2>Follow the resource lifecycle</h2></div><div id="lens-link">' + link(path('/explorer', { perspective: active }),
      'Explore ' + lens[active].title.toLowerCase() + ' ' + icon('arrow', 16), 'text-link') + '</div></div>'
    + '<div class="lens-grid">' + lenses + '</div></section>'
    + '<section class="coverage-home"><div class="section-lead"><div><p class="kicker">Coverage</p><h2>Inside the archive</h2></div>'
    + '<form action="/explorer" data-navigation class="search-form"><label class="sr" for="home-search">Search the catalog</label>'
    + icon('search', 19) + '<input id="home-search" name="q" type="search" placeholder="' + en.find + '" required>'
    + '<input type="hidden" name="scope" value="catalog"><button aria-label="Run catalog search">' + icon('arrow', 18) + '</button></form></div>'
    + (stats?.collection_paused ? '<p class="archive-note">Automatic updates paused. ' + link('/status', 'View collection status', 'text-link') + '</p>' : '')
    + (stats ? '<div class="stat-grid">' + archive + '</div>'
      : broken ? empty('Archive unavailable', 'The source archive could not be reached. Try again in a moment.', '<button class="button" data-retry>Retry</button>')
        : '<div class="skeleton" role="status">Loading archive coverage…</div>')
    + '</section>'
    + '<section class="samples-home"><div class="section-lead"><div><p class="kicker">Observations</p><h2>From the archive</h2></div>'
    + (stats?.last_observed ? '<span class="muted mono">Latest observation · ' + esc(time(stats.last_observed)) + '</span>' : '')
    + '</div>' + (featured ? '<div class="sample-grid">' + featured + '</div>'
      : stats ? empty('Collections starting', 'The first successful collection will appear here.') : '') + '</section>'
}

function preserve(params: URLSearchParams, changes: Record<string, string | null>) {
  const next = new URLSearchParams(params)
  for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key)
  return next
}

const hidden = (p: URLSearchParams, keys: string[]) => keys.map(key => p.get(key)
  ? '<input type="hidden" name="' + key + '" value="' + esc(p.get(key)) + '">' : '').join('')

export function explorer(params: URLSearchParams, catalog: Catalog, selected: Series | null) {
  const filterLinks = [['', 'All perspectives'], ...perspectives.map(p => [p, lens[p].title])]
  const type = params.get('kind') ?? ''
  const q = params.get('q') ?? ''
  const scope = params.get('scope') ?? 'measured'
  const metric = params.get('metric') ?? ''
  const perspective = params.get('perspective') ?? ''
  const category = params.get('category') ?? ''
  const metricChoices: [string, string][] = [
    ['', 'All metrics'],
    ...metrics.filter(m => (!perspective || m.perspective === perspective) && (!category || m.category === category))
      .map(m => [m.id, m.name] as [string, string]),
  ]
  const cards = catalog.items.map(item => {
    const isSelected = selected?.entities[0]?.id === item.id
    const selectPath = path('/explorer', preserve(params, { entity: item.id }))
    return '<article class="entity-card' + (isSelected ? ' active-entity' : '') + '"><div class="entity-card-top"><span class="pill">'
      + esc(kindLabel(item.kind)) + '</span><span class="mono small">' + esc(item.symbol ?? (item.testnet ? 'Test or retired' : '')) + '</span></div>'
      + '<h3>' + link(entityPath(item.id, item.metric_id, params), esc(item.name) + icon('diagonal', 16)) + '</h3>'
      + '<div class="entity-card-bottom"><span class="small ' + (item.series ? 'positive' : 'muted') + '">'
      + (item.series ? number(item.series) + ' ' + (item.series === 1 ? 'series' : 'series') + ' · ' + esc(time(item.last_day)) : 'Catalog only')
      + '</span>' + (item.metric_id ? link(selectPath + '#preview', 'Preview', 'text-link small') : '') + '</div></article>'
  }).join('')
  return heading('Discover', 'Explorer', 'Browse networks, assets, protocols and traditional systems by the resource behavior you want to understand.', share())
    + '<section class="panel filter-panel" aria-label="Explorer filters"><nav class="lens-tabs" aria-label="Perspective">'
    + filterLinks.map(([id, label]) => link(path('/explorer', preserve(params, { perspective: id || null, metric: null, entity: null, page: null })),
      (id ? icon(id, 17) : '') + esc(label), id === perspective ? 'selected' : '', id === perspective ? 'aria-current="true"' : '')).join('')
    + '</nav><form action="/explorer" data-navigation class="filter-grid">'
    + hidden(params, ['perspective','from','to','view'])
    + '<label class="field search-field"><span>Find an entity</span><span class="input-icon">' + icon('search', 17)
    + '<input type="search" name="q" value="' + esc(q) + '" placeholder="' + en.find + '"></span></label>'
    + select('kind', 'Entity type', kinds, type)
    + select('category', 'Resource', [['', 'All resources'], ...categories.map(row => [...row] as [string, string])], category)
    + select('metric', 'Metric', metricChoices, metric)
    + select('scope', 'Coverage', [['measured','With observations'],['catalog','Full catalog']], scope)
    + '<button class="button primary apply" type="submit">Apply filters' + icon('arrow', 16) + '</button></form></section>'
    + '<div class="section-lead results-lead"><div><h2>' + (scope === 'catalog' ? 'Catalog' : 'Measured entities') + '</h2>'
    + '<p class="muted">Page ' + catalog.page + ' · ' + catalog.items.length + ' results shown</p></div>'
    + '<div class="row">' + (catalog.page > 1 ? button(path('/explorer', preserve(params, { page: String(catalog.page - 1), entity: null })), 'Previous') : '')
    + (catalog.more ? button(path('/explorer', preserve(params, { page: String(catalog.page + 1), entity: null })), 'Next page') : '') + '</div></div>'
    + (cards ? '<div class="entity-grid">' + cards + '</div>' : empty('No matching entities', 'Change the filters to broaden your selection.', button('/explorer', 'Clear filters')))
    + (selected ? '<section id="preview" class="preview-block" aria-label="Selected entity history"><div class="section-lead"><div>'
      + '<p class="kicker">Historical preview</p><h2>' + esc(selected.entities[0].name) + '</h2></div>'
      + button(entityPath(selected.entities[0].id, selected.metric.id, params), 'Open entity') + '</div>'
      + seriesPanel(selected, params, '/explorer', { entity: selected.entities[0].id }) + '</section>' : '')
}

function share() {
  return '<button class="button share" data-share>' + icon('link', 16) + '<span>' + en.shares + '</span></button>'
}

export function seriesPanel(series: Series, params: URLSearchParams, route: string, extra: Record<string, string> = {}) {
  const { metric, window } = series
  const source = sourceById.get(metric.source)!
  const mode = params.get('view') === 'table' ? 'table' : 'chart'
  const api = { metric: metric.id, entities: series.entities.map(e => e.id).join(','), from: window.from, to: window.to }
  const clean = preserve(params, extra)
  const days = Object.values(series.missing).reduce((sum, missing) => sum + missing, 0)
  const agreement = new Map<string, number>()
  for (const p of series.points) agreement.set(p.day, (agreement.get(p.day) ?? 0) + 1)
  const common = [...agreement.values()].filter(count => count === series.entities.length).length
  return '<section class="panel series-panel"><div class="series-top"><div><p class="kicker">' + esc(lens[metric.perspective].title)
    + ' · ' + esc(metric.shape) + '</p><h2>' + esc(metric.name) + '</h2></div><nav class="segments" aria-label="Series display">'
    + views.map(([id, label, glyph]) => link(path(route, preserve(clean, { view: id })), icon(glyph, 16) + esc(label),
      id === mode ? 'selected' : '', id === mode ? 'aria-current="true"' : '')).join('') + '</nav></div>'
    + '<div class="series-tools"><form data-navigation class="date-form" action="' + esc(route) + '">'
    + hidden(clean, ['q','scope','page','kind','category','perspective','metric','entity','entities','view'])
    + (clean.has('metric') ? '' : '<input type="hidden" name="metric" value="' + esc(metric.id) + '">')
    + '<label class="field"><span>From (UTC)</span><input required type="date" name="from" value="' + esc(window.from) + '"></label>'
    + '<label class="field"><span>To (UTC)</span><input required type="date" name="to" value="' + esc(window.to) + '"></label>'
    + '<button class="button compact">Apply dates</button></form><nav aria-label="Date zoom" class="zoom row">'
    + [14,30,90].map(d => link(path(route, preserve(clean, { from: daysAgo(d - 1, Date.parse(window.to)), to: window.to })),
      d + 'd', 'button compact', 'aria-label="' + d + 'd, Last ' + d + ' days ending on ' + esc(time(window.to)) + '"')).join('') + '</nav></div>'
    + (series.points.length ? (mode === 'chart' ? chart(series) : pointsTable(series.points, series.entities))
      : empty(en.noData, 'Choose another date range or check the collection status.'))
    + '<div class="series-foot"><div><span class="mono small">' + number(series.points.length) + ' observations'
    + (series.entities.length > 1 ? ' · ' + number(common) + ' shared dates' : '')
    + (days ? ' · ' + number(days) + ' missing entity-days' : '') + '</span><p>' + esc(metric.limit) + '</p></div>'
    + '<nav class="row download-links" aria-label="Export these observations">' + button(path('/api/v1/series', { ...api, format: 'csv' }), 'CSV', false, 'download')
    + button(path('/api/v1/series', { ...api, format: 'json' }), 'JSON', false, 'download') + '</nav></div>'
    + '<div class="source-strip"><span>' + esc(metric.evidence) + '</span>' + ext(source.documentation, source.name)
    + ext(source.terms, source.license) + '</div></section>'
}

export function detail(data: Detail, series: Series | null, params: URLSearchParams, route: string) {
  const { entity, coverage, relations } = data
  const pills = coverage.map(item => {
    const metric = metricById.get(item.metric_id)!
    const chosen = series?.metric.id === item.metric_id
    return link(path(route, preserve(params, { metric: item.metric_id })), '<span class="mono small">' + esc(lens[metric.perspective].title)
      + '</span><strong>' + esc(metric.name) + '</strong><span class="measure-value">' + number(item.last_value, true)
      + ' <small>' + esc(item.unit) + '</small></span><small>Observed ' + esc(time(item.observed_at))
      + ' · Available since ' + esc(time(item.first_day)) + '</small>', 'measure-card' + (chosen ? ' active-entity' : ''),
      chosen ? 'aria-current="true"' : '')
  }).join('')
  const links = relations.map(item => link(entityPath(item.id), '<span><strong>' + esc(item.name)
    + '</strong><small>' + esc(item.label) + '</small></span>' + icon('diagonal', 16), 'relation')).join('')
  return heading(kindLabel(entity.kind) + ' · ' + entity.category, entity.name,
    entity.description ?? ('Explore the observations and relationships archived for ' + entity.name + '.'), share())
    + '<div class="entity-meta row"><span class="mono pill">' + esc(entity.id) + '</span>'
    + (entity.testnet ? '<span class="pill">Test or retired network</span>' : '')
    + ext(entity.website, 'Official reference') + '</div>'
    + (coverage.length ? '<div class="measure-grid">' + pills + '</div>'
      : empty('Catalog record', 'The archive currently has no observations for this entity.'))
    + (series ? seriesPanel(series, params, route) : '')
    + (series ? '<section class="panel entity-method"><div><p class="kicker">Definition</p><h2>' + esc(series.metric.name)
      + '</h2><p>' + esc(series.metric.definition) + '</p></div><div><small>Collected through</small><strong>'
      + esc(time(coverage.find(item => item.metric_id === series.metric.id)?.collected_at ?? null, true)) + '</strong>'
      + (series.metric.compare !== 'none' ? button(path('/compare', { metric: series.metric.id, entities: entity.id, kind: entity.kind }), 'Compare with others') : '')
      + '</div></section>' : '')
    + (links ? '<section class="relationships"><div class="section-lead"><h2>Related entities</h2></div><div class="relation-grid">' + links + '</div></section>' : '')
}

export function compare(params: URLSearchParams, requested: string[], candidates: Catalog, series: Series | null, error: string | null) {
  const current = params.get('metric') ?? 'blocks'
  const kind = params.get('kind') ?? 'network'
  const q = params.get('q') ?? ''
  const selections = requested.map(id => '<span class="select-chip"><span>' + esc(series?.entities.find(e => e.id === id)?.name
    ?? candidates.items.find(e => e.id === id)?.name ?? id) + '</span>'
    + link(path('/compare', preserve(params, { entities: requested.filter(other => other !== id).join(',') || 'none' })),
      '×', 'remove-chip', 'aria-label="Remove ' + esc(id) + '"') + '</span>').join('')
  const picker = candidates.items.filter(item => !requested.includes(item.id)).slice(0, 8).map(item =>
    link(path('/compare', preserve(params, { entities: [...requested, item.id].join(',') })),
      esc(item.name) + '<span aria-hidden="true">+</span>', 'add-entity')).join('')
  const dates = period(params)
  return heading('Compare', 'Compare observations', 'Choose up to four subjects that share a metric, definition, unit and comparable scope.', share())
    + '<section class="panel compare-panel"><form action="/compare" data-navigation data-compare-form class="compare-form">'
    + '<input type="hidden" name="entities" value="' + esc(requested.join(',') || 'none') + '">'
    + '<input type="hidden" name="previous-kind" value="' + esc(kind) + '">'
    + '<input type="hidden" name="previous-metric" value="' + esc(current) + '">'
    + hidden(params, ['from','to','view'])
    + select('kind', 'Entity type', kinds.filter(([id]) => id), kind)
    + select('metric', 'Comparable metric', metrics.filter(metric => metric.compare !== 'none'
      && (kind === 'system' ? metric.source === 'wikimedia' : kind === 'protocol' ? metric.source === 'stellar' : metric.source === 'coin'))
      .map(metric => [metric.id, metric.name]), current)
    + '<label class="field"><span>Find a subject</span><input name="q" type="search" placeholder="Search measured entities" value="' + esc(q) + '"></label>'
    + '<button class="button primary apply">Update selection' + icon('arrow', 16) + '</button></form>'
    + '<div class="selection-row"><span class="kicker">Selected · ' + requested.length + ' / 4</span>' + (selections || '<span class="muted small">Choose a subject below.</span>') + '</div>'
    + (requested.length < 4 && picker ? '<div class="candidate-list" aria-label="Add a compatible subject">' + picker + '</div>' : '')
    + '</section>'
    + (error ? empty('Comparison unavailable', error) : '')
    + (series ? seriesPanel(series, params, '/compare') : requested.length ? '' : empty('Choose subjects to get started', 'Add one or more measured subjects above. The current window ends ' + time(dates.to) + '.'))
}

export function methods() {
  const sourceCards = sources.map(source => '<article class="panel source-card"><h3>' + esc(source.name) + '</h3><p>' + esc(source.note)
    + '</p><span class="mono small">' + esc(source.cadence) + '</span><div class="row">'
    + ext(source.documentation, 'Documentation') + ext(source.terms, source.license) + '</div></article>').join('')
  const definitions = metrics.map(metric => '<details class="method-row" id="method-' + metric.id + '"><summary>'
    + '<span><span class="mono small">' + esc(lens[metric.perspective].title) + '</span><strong>' + esc(metric.name) + '</strong></span>'
    + '<span class="pill">' + esc(metric.evidence) + '</span></summary><dl><div><dt>Method</dt><dd>' + esc(metric.definition)
    + '</dd></div><div><dt>Unit and resolution</dt><dd>' + esc(metric.unit + ' · ' + metric.shape) + '</dd></div><div><dt>Comparison</dt><dd>'
    + esc(metric.limit) + '</dd></div><div><dt>History and source</dt><dd>The first and last archived dates appear on each entity page. '
    + ext(sourceById.get(metric.source)!.documentation, sourceById.get(metric.source)!.name) + '</dd></div></dl></details>').join('')
  return heading('Transparency', 'Methods & data', 'Definitions, source licenses, coverage and access to the public archive.')
    + '<section class="methods-section"><div class="section-lead"><h2>Reading the observations</h2></div><div class="panel methods-reading">'
    + '<article><h3>Stocks and flows</h3><p>A stock describes a quantity at a point in time. A flow counts events or measures amounts over an interval. Issued and circulating supply have distinct definitions.</p></article>'
    + '<article><h3>Ledger and disk</h3><p>Block counts, recorded transactions and head heights describe ledger data. Physical node storage depends on the client, database, indexing and retention configuration.</p></article>'
    + '<article><h3>Validity and retention</h3><p>TTL is a validity rule. Inactivity, burn, spending, pruning and archive movements each require their own evidence. Stellar measurements cover specified live contract entries.</p></article>'
    + '<article><h3>Traditional systems</h3><p>Wikimedia page views use one documented method across three services. They provide a web-traffic comparison within that cohort. Blockchain event counts are shown on their own axes.</p></article>'
    + '</div></section><section class="methods-section"><div class="section-lead"><h2>Research snapshots</h2></div><div class="panel api-panel">'
    + '<p>Research includes a fixed Bitcoin block sample, two series from Open Bitcoin Metrics v0.1.0 and a daily USDC snapshot from Coin Metrics Community. Each view links to its source and offers a CSV for the selected range and a versioned JSON snapshot.</p>'
    + '<p>The Policy lab uses a fixed synthetic workload and documents its event order. Its results stay within the experiment.</p>'
    + '<div class="row">' + link('/research', 'Open the research views', 'text-link')
    + ext('https://github.com/vindipe/circula-observatory/blob/main/docs/research-design.md', 'Research methods and reconstruction') + '</div>'
    + '</div></section><section class="methods-section"><div class="section-lead"><h2>Source register</h2></div><div class="sources-grid">'
    + sourceCards + '</div></section><section class="methods-section"><div class="section-lead"><h2>Metric definitions</h2></div><div class="panel">'
    + definitions + '</div></section><section class="methods-section"><div class="section-lead"><h2>Download and API</h2></div><div class="panel api-panel">'
    + '<p>Open an entity or comparison to export its selected metric and dates. Each series includes the observation date, collection time, source, unit and revision.</p>'
    + '<ul><li>' + link('/api/v1/metadata', 'Metric and source definitions') + '</li><li>'
    + link('/api/v1/catalog?scope=measured&kind=network', 'Measured network catalog') + '</li><li>'
    + link('/api/v1/series?entities=network%3Abtc&metric=blocks', 'Bitcoin block count example') + '</li><li>'
    + ext('https://github.com/vindipe/circula-observatory/blob/main/docs/api.md', 'Full API reference') + '</li></ul></div></section>'
}

export function status(data: Status) {
  const scheduler = data.collection_paused ? 'Automatic collection paused'
    : data.last_scheduled ? 'Scheduled execution recorded' : 'Awaiting scheduled execution'
  return heading('Operations', 'Data status', 'Collection history, observation freshness and upstream availability.',
    '<button class="button" data-retry>Refresh' + icon('arrow', 16) + '</button>')
    + '<div class="scheduler-status panel"><div><p class="kicker">Scheduler</p><h2>' + scheduler
    + '</h2></div><p>' + (data.last_scheduled ? 'Last scheduled run · ' + esc(time(data.last_scheduled, true)) : 'The archive has no scheduled run record yet.')
    + '</p></div><div class="sources-grid">' + data.sources.map(item => {
      const source = sourceById.get(item.source)!
      return '<article class="panel source-card"><div class="row source-title"><h3>' + esc(source.name)
        + '</h3><span class="pill state-' + item.state.toLowerCase() + '">' + item.state + '</span></div><p class="small">' + esc(source.cadence)
        + '</p><dl class="status-data"><div><dt>Latest observed</dt><dd>' + esc(time(item.observed_at, true))
        + '</dd></div><div><dt>Latest ingested</dt><dd>' + esc(time(item.collected_at, true)) + '</dd></div>'
        + '<div><dt>Last successful job</dt><dd>' + esc(time(item.last_success, true)) + '</dd></div><div><dt>Failing jobs</dt><dd>'
        + item.failed_jobs + ' / ' + item.jobs + '</dd></div></dl></article>'
    }).join('') + '</div><section class="methods-section"><div class="section-lead"><h2>Recent collection runs</h2></div>'
    + (data.runs.length ? '<div class="table-scroll panel" role="region" aria-label="Recent collection runs" tabindex="0"><table><thead>'
      + '<tr><th scope="col">Job</th><th scope="col">Trigger</th><th scope="col">UTC time</th><th scope="col">Result</th>'
      + '<th scope="col">Points received</th><th scope="col">Details</th></tr></thead><tbody>'
      + data.runs.map(run => '<tr><th scope="row">' + esc(run.job_id) + '</th><td>' + esc(run.trigger) + '</td><td>'
        + esc(time(run.finished_at, true)) + '</td><td class="state-' + (run.status === 'ok' ? 'current' : 'degraded') + '">'
        + esc(run.status) + '</td><td>' + run.row_count + '</td><td>' + esc(run.note || '—') + '</td></tr>').join('')
      + '</tbody></table></div>' : empty('No collection runs recorded', 'This view fills after the first attempted job.')) + '</section>'
}
