import { ageChoices, blockWindows, satsToBtc, spentAge, type AgeThreshold, type BlockSample, type HoldingsSample, type SpentSample, type UtxoSample } from '../shared/research'
import { icon } from './art'
import { empty, esc, ext, link, number, path, select, time } from './html'
import { bindSignalPlot, replaceStudyFilters, signalPlot, type SignalPlot, type SignalTrack } from './signal-plot'

const openBitcoin = { url: 'https://doi.org/10.5281/zenodo.21156871', name: 'Diego R. Llanos · Open Bitcoin Metrics v0.1.0', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' }

const studies = {
  ledger: { tab: 'Ledger growth', scope: 'Bitcoin · History', icon: 'accumulate', file: 'bitcoin-bytes', tone: 'green',
    title: 'How fast does the ledger grow?', claim: 'New blocks extend the retained history of the chain.',
    boundary: 'Serialized block bytes include witness data. The sample covers a segment of canonical history. Node disk usage also depends on pruning, undo files, state and indexes.',
    source: { url: 'https://mempool.space/docs/api/rest', name: 'Bitcoin block metadata via mempool.space', license: '', licenseUrl: '' },
    next: { label: 'Study the spendable state', route: '/research?study=state' },
  },
  state: { tab: 'Unspent outputs', scope: 'Bitcoin · State', icon: 'database', file: 'bitcoin-utxo', tone: 'green',
    title: 'How much spendable state remains?', claim: 'Outputs can remain spendable until a transaction consumes them.',
    boundary: 'An output count measures entries in the UTXO set. Measuring how much disk that state occupies requires a node configuration. Measuring its age requires a current UTXO age snapshot.',
    source: openBitcoin,
    next: { label: 'See older outputs spent', route: '/research?study=dormancy' },
  },
  dormancy: { tab: 'Older outputs', scope: 'Bitcoin · Spending', icon: 'circulate', file: 'bitcoin-spent-age', tone: 'cyan',
    title: 'When does older value move again?', claim: 'An output can move again even after years without being spent.',
    boundary: 'The age is measured at spending. The gross input value includes transfers to oneself and wallet consolidation. The amount still unspent at that age requires a different dataset.',
    source: openBitcoin,
    next: { label: 'Explore the holdings measure', route: '/research?study=holdings' },
  },
  holdings: { tab: 'Holdings', scope: 'USDC · Ethereum', icon: 'persist', file: 'ethereum-usdc', tone: 'amber',
    title: 'What can we observe about holdings?', claim: 'Supply and the count of funded addresses can change separately.',
    boundary: 'Multiple addresses may belong to one owner. A custody address can represent many owners. A balance snapshot is needed to calculate concentration or Gini.',
    source: { url: 'https://docs.coinmetrics.io/network-data/network-data-overview/supply', name: 'Coin Metrics Community', license: 'CC BY-NC 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/' },
    next: { label: 'Read the holdings lifecycle', route: '/research?resource=holdings' },
  },
} as const

type StudyId = keyof typeof studies
type Sample = BlockSample | UtxoSample | SpentSample | HoldingsSample
type Choice = { key: string; label: string; options: [string, string][]; selected: string }
type Cell = string | number
type EvidencePoint = { key: string; label: string; short: string; value: number; readout: string; context: string; cells: Cell[] }
type Projection = { name: string; unit: string; formula: string; sourceWindow: string; headings: string[]; points: EvidencePoint[]; choices: Choice[] }

const snapshotUrl = (study: StudyId) => '/research-data/' + studies[study].file + '.v1.json'
const atDate = (day: string) => ({ key: day, label: time(day), short: time(day).replace(/ \d{4}$/, '') })
const span = (start: string, end: string) => time(start) + ' – ' + time(end)
const integer = (value: number) => number(value)
const signed = (value: number) => (value > 0 ? '+' : '') + integer(value)
const percent = (value: number) => new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 2 }).format(value)
const bytes = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 3 }).format(value / 1_000_000_000) + ' GB'
const btc = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 8 }).format(value) + ' BTC'

function choice(params: URLSearchParams, key: string, label: string, options: [string, string][], fallback: string): Choice {
  return { key, label, options, selected: options.find(([id]) => id === params.get(key))?.[0] ?? fallback }
}

function project(study: StudyId, rows: Sample[], params: URLSearchParams): Projection {
  if (study === 'ledger') {
    const blocks = rows as BlockSample[]
    const size = choice(params, 'period', 'Block window', [['75', 'Last 75 blocks'], ['300', 'Last 300 blocks'], ['all', 'All 1,005 blocks']], 'all')
    const bucketed = blockWindows(blocks, size.selected === 'all' ? blocks.length : Number(size.selected))
    return {
      name: 'Serialized block bytes added', unit: 'GB', choices: [size],
      formula: 'Cumulative sum of serialized bytes since block ' + integer(bucketed[0].from) + ' inclusive. Each point adds 15 blocks. One GB is 10⁹ bytes.',
      sourceWindow: 'Blocks ' + integer(blocks[0][0]) + '–' + integer(blocks.at(-1)![0]),
      headings: ['first_height', 'last_height', 'last_block_time_utc', 'bytes_added', 'cumulative_bytes', 'last_block_hash'],
      points: bucketed.map(bucket => ({ key: String(bucket.to), label: 'Block ' + integer(bucket.to), short: integer(bucket.to),
        value: bucket.cumulative, readout: bytes(bucket.cumulative),
        context: integer(bucket.bytes) + ' bytes in this group · ' + time(new Date(bucket.timestamp * 1000).toISOString(), true),
        cells: [bucket.from, bucket.to, new Date(bucket.timestamp * 1000).toISOString(), bucket.bytes, bucket.cumulative, bucket.hash] })),
    }
  }
  const windows: [string, string][] = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['all', 'Full snapshot']]
  if (rows.length >= 365) windows.splice(2, 0, ['365', 'Last 365 days'])
  const period = choice(params, 'period', 'Snapshot window', windows, '90')
  const window = period.selected === 'all' ? rows : rows.slice(-Number(period.selected))
  const sourceWindow = span(String(rows[0][0]), String(rows.at(-1)![0]))
  if (study === 'state') {
    const basis = choice(params, 'metric', 'State measure', [['change', 'Change from window start'], ['count', 'Total outputs']], 'change')
    const showChange = basis.selected === 'change'
    const stock = window as UtxoSample[]
    return { name: showChange ? 'Net change in spendable outputs' : 'Spendable unspent outputs', unit: 'outputs', choices: [basis, period], sourceWindow,
      formula: (showChange ? 'Daily count minus the count on ' + time(stock[0][0]) + '. ' : '')
        + 'The source counts spendable outputs after the highest-height block assigned to each UTC date.',
      headings: ['day_utc', 'spendable_unspent_outputs', 'change_since_window_start'], points: stock.map(([day, outputs], i, points) => {
        const change = i ? outputs - points[i - 1][1] : null
        const net = outputs - points[0][1]
        return { ...atDate(day), value: showChange ? net : outputs, readout: (showChange ? signed(net) : integer(outputs)) + ' outputs',
          context: showChange ? integer(outputs) + ' total spendable at this point'
            : change === null ? 'First day in the selected window' : signed(change) + ' from the previous day', cells: [day, outputs, net] }
      }),
    }
  }
  if (study === 'dormancy') {
    const threshold = choice(params, 'age', 'Minimum age at spending', ageChoices.map(age => [age, age + (age === '1' ? ' year' : ' years')]), '5')
    return { name: 'Value spent from outputs aged ' + threshold.selected + '+ ' + (threshold.selected === '1' ? 'year' : 'years'), unit: 'BTC', choices: [threshold, period], sourceWindow,
      formula: 'Sum of spent output value at ages of at least ' + integer(Number(threshold.selected) * 365) + ' days, grouped by UTC block date.',
      headings: ['day_utc', 'threshold_years', 'matching_spent_btc', 'all_spent_btc', 'share_of_spent_value'],
      points: (window as SpentSample[]).map(row => {
        const { sats, share } = spentAge(row, threshold.selected as AgeThreshold)
        return { ...atDate(row[0]), value: sats / 100_000_000, readout: btc(sats / 100_000_000),
          context: share === null ? 'Share unavailable for this date' : percent(share) + ' of all BTC spent in the source on this day',
          cells: [row[0], threshold.selected, satsToBtc(sats), satsToBtc(row[1]), share ?? ''] }
      }),
    }
  }
  const holding = choice(params, 'metric', 'Holdings measure', [['addresses', 'Funded addresses'], ['supply', 'Current supply']], 'addresses')
  const supply = holding.selected === 'supply'
  return { name: supply ? 'Current USDC supply' : 'Addresses with positive USDC balances', unit: supply ? 'USDC' : 'addresses',
    choices: [holding, period], sourceWindow,
    formula: supply ? 'Daily Coin Metrics SplyCur for USDC on Ethereum, denominated in native USDC.' : 'Daily Coin Metrics AdrBalCnt for USDC on Ethereum. Each address with a positive balance contributes one.',
    headings: supply ? ['day_utc', 'current_supply_usdc'] : ['day_utc', 'funded_addresses'],
    points: (window as HoldingsSample[]).map(([day, addresses, amount]) => ({ ...atDate(day),
      value: supply ? Number(amount) : addresses, readout: supply ? number(Number(amount)) + ' USDC' : integer(addresses) + ' addresses',
      context: supply ? integer(addresses) + ' funded addresses on this date' : number(Number(amount), true) + ' USDC current supply on this date', cells: [day, supply ? amount : addresses] })),
  }
}

function table(projection: Projection) {
  return '<div class="table-scroll" role="region" aria-label="Displayed research observations" tabindex="0"><table><thead><tr>'
    + projection.headings.map(key => '<th scope="col">' + esc(key.replaceAll('_', ' ')) + '</th>').join('')
    + '</tr></thead><tbody>' + [...projection.points].reverse().map(point => '<tr>' + point.cells.map((cell, i) => i === 0
      ? '<th scope="row">' + esc(cell) + '</th>' : '<td>' + esc(cell) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>'
}

function csv(projection: Projection, study: StudyId) {
  const escape = (value: Cell) => '"' + String(value).replaceAll('"', '""') + '"'
  const attribution = studies[study].source
  const columns = [...projection.headings, 'source', 'source_url', 'license']
  return columns.join(',') + '\r\n' + [...projection.points].reverse().map(point =>
    [...point.cells, attribution.name, attribution.url, attribution.license].map(escape).join(',')).join('\r\n') + '\r\n'
}

const selectStudy = (params: URLSearchParams) => (Object.keys(studies).find(id => id === params.get('study')) as StudyId | undefined) ?? 'ledger'

export async function researchEvidence(params: URLSearchParams, signal: AbortSignal) {
  const study = selectStudy(params)
  const info = studies[study]
  const menu = '<nav class="signal-studies" id="study-questions" tabindex="-1" aria-label="Research questions">' + Object.entries(studies).map(([id, item]) =>
    link(path('/research', { study: id }) + '#study-questions', '<span class="signal-study-icon tone-' + item.tone + '">' + icon(item.icon, 21)
      + '</span><span><strong>' + esc(item.tab) + '</strong><small>' + esc(item.scope) + '</small></span>',
    'signal-study', id === study ? 'aria-current="true"' : '')).join('') + '</nav>'
  let rows: Sample[]
  let collectedAt: string
  try {
    const response = await fetch(snapshotUrl(study), { signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('Snapshot unavailable')
    const snapshot = await response.json() as { version: number; source?: { collectedAt: string }; rows: Sample[] }
    if (snapshot.version !== 1 || !Number.isFinite(Date.parse(snapshot.source?.collectedAt ?? ''))
      || !Array.isArray(snapshot.rows) || snapshot.rows.length < 2) throw new Error('Invalid snapshot')
    rows = snapshot.rows
    collectedAt = snapshot.source!.collectedAt
  } catch (error) {
    if (signal.aborted) throw error
    return { markup: menu + '<section id="evidence" class="panel">'
      + empty('This research snapshot is unavailable', 'Try this question again or open another question.', '<button class="button" data-retry>Retry snapshot</button>') + '</section>' }
  }
  let data = project(study, rows, params)
  const partial = '<div class="signal-panel panel" id="evidence" tabindex="-1"><header class="signal-head">'
    + '<div><p class="kicker">Historical observations</p><h2>' + esc(info.title) + '</h2></div>'
    + '<div class="signal-filters">' + data.choices.map(field => select(field.key, field.label, field.options, field.selected)).join('') + '</div></header>'
    + '<div class="signal-workbench"><section class="signal-chart" aria-label="Observation chart"><div data-study-chart></div></section>'
    + '<aside class="signal-reading"><h3>At the selected point</h3><p class="signal-reading-value" data-study-value></p><p class="signal-reading-context" data-study-context></p>'
    + '<p class="signal-observation">' + esc(info.claim) + '</p><p class="muted">' + esc(info.boundary) + '</p></aside></div>'
    + '<div class="signal-foot"><p data-study-formula></p><div class="row">'
    + '<button type="button" class="button compact" data-study-csv>' + icon('download', 15) + ' Download CSV</button>'
    + link(snapshotUrl(study), 'Source snapshot JSON', 'button compact', 'download') + '</div></div>'
    + '<details class="signal-data"><summary>Table of displayed points</summary><div data-study-table></div></details></div>'
    + '<div class="signal-provenance"><div><p>Snapshot coverage <strong>' + esc(data.sourceWindow) + '</strong></p>'
    + '<p>Collected ' + esc(time(collectedAt, true)) + '</p>'
    + '<div class="row">' + ext(info.source.url, info.source.name) + ext(info.source.licenseUrl, info.source.license) + '</div></div>'
    + link(info.next.route, esc(info.next.label) + ' ' + icon('arrow', 17), 'text-link') + '</div>'
  return { markup: menu + partial, bind(root: HTMLElement) {
    const chart = root.querySelector<HTMLElement>('[data-study-chart]')!
    const readout = root.querySelector<HTMLElement>('[data-study-value]')!
    const context = root.querySelector<HTMLElement>('[data-study-context]')!
    const formula = root.querySelector<HTMLElement>('[data-study-formula]')!
    const detailTable = root.querySelector<HTMLDetailsElement>('.signal-data')!
    const tableBody = root.querySelector<HTMLElement>('[data-study-table]')!
    const draw = () => {
      const index = data.points.findIndex(point => point.key === params.get('at'))
      const initial = index >= 0 ? index : data.points.length - 1
      const track: SignalTrack = { label: data.name, tone: info.tone, values: data.points.map(point => point.value) }
      const spansYears = study !== 'ledger' && data.points[0].key.slice(0, 4) !== data.points.at(-1)!.key.slice(0, 4)
      const plot: SignalPlot = { label: data.name + ' in ' + data.unit, cursorLabel: study === 'ledger' ? 'Inspect a block group' : 'Inspect an observed day',
        labels: data.points.map(point => point.label), shortLabels: data.points.map(point => spansYears ? point.label.replace(/^\d+ /, '') : point.short), tracks: [track],
        format: study === 'ledger' ? bytes : study === 'dormancy' ? btc : value => number(value) + ' ' + data.unit,
        axisFormat: study === 'ledger' ? bytes : undefined }
      chart.innerHTML = '<p class="signal-metric">' + esc(data.name) + ' <span>' + esc(data.unit) + '</span></p>' + signalPlot(plot, initial)
      formula.textContent = data.formula
      tableBody.innerHTML = detailTable.open ? table(data) : ''
      bindSignalPlot(chart, plot, initial, i => {
        const point = data.points[i]
        readout.textContent = point.readout
        context.textContent = point.context
        if (i !== initial || params.has('at')) {
          params.set('at', point.key)
          replaceStudyFilters({ at: point.key })
        }
      })
    }
    draw()
    for (const control of root.querySelectorAll('.signal-filters select')) {
      if (!(control instanceof HTMLSelectElement)) continue
      control.addEventListener('change', () => {
        params.set(control.name, control.value)
        data = project(study, rows, params)
        draw()
        replaceStudyFilters({ [control.name]: control.value })
      })
    }
    detailTable.addEventListener('toggle', () => {
      if (detailTable.open && !tableBody.firstChild) tableBody.innerHTML = table(data)
    })
    root.querySelector('[data-study-csv]')!.addEventListener('click', () => {
      const blob = new Blob([csv(data, study)], { type: 'text/csv;charset=utf-8' })
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = 'circula-' + studies[study].file + '.csv'
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(href), 1_000)
    })
  } }
}
