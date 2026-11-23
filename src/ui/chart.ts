import { DAY_MS, dayString, type Point, type Series } from '../shared/model'
import { esc, number, time } from './html'

const colors = ['#c1f78f', '#b2a3fc', '#7bdbdd', '#f2c086']
const width = 860
const height = 295
const left = 79
const right = 22
const top = 20
const bottom = 50
const plotWidth = width - left - right
const plotHeight = height - top - bottom

function plot(series: Series, shown: Set<string>) {
  const first = Date.parse(series.window.from)
  const last = Date.parse(series.window.to)
  const minWindow = Math.max(last - first, DAY_MS)
  const activePoints = series.points.filter(point => shown.has(point.entity_id))
  const lower = Math.min(...activePoints.map(point => point.value), ...(!activePoints.length ? [0] : []))
  const upper = Math.max(...activePoints.map(point => point.value), ...(!activePoints.length ? [1] : []))
  const range = Math.max(upper - lower, Math.abs(upper) * 0.015, 0.01)
  const high = upper + range * .1
  const low = Math.min(lower, Math.max(0, lower - range * .1))
  const yRange = Math.max(high - low, range * .1)
  const x = (t: number) => left + (t - first) / minWindow * plotWidth
  const y = (value: number) => top + (1 - (value - low) / yRange) * plotHeight
  const horizontal = Array.from({ length: 5 }, (_, i) => {
    const v = low + (4 - i) / 4 * yRange
    const py = y(v)
    return '<path class="chart-grid" d="M' + left + ' ' + py + 'H' + (width - right) + '"/><text class="axis-label" x="'
      + (left - 12) + '" y="' + (py + 4) + '" text-anchor="end">' + esc(number(v, true)) + '</text>'
  }).join('')
  const ndays = Math.round((last - first) / DAY_MS)
  const ticks = Math.min(5, ndays)
  const vertical = Array.from({ length: ticks + 1 }, (_, i) => {
    const ms = first + Math.round(i / Math.max(1, ticks) * ndays) * DAY_MS
    const px = x(ms)
    const label = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(ms)
    return '<path class="chart-grid vertical" d="M' + px + ' ' + top + 'V' + (height - bottom) + '"/><text class="axis-label" x="'
      + px + '" y="' + (height - bottom + 25) + '" text-anchor="' + (i === 0 ? 'start' : i === ticks ? 'end' : 'middle') + '">' + esc(label) + '</text>'
  }).join('')
  function line(data: Point[]) {
    const ordered = [...data].sort((a, b) => a.day.localeCompare(b.day))
    const singletons: Point[] = []
    const segments: Point[][] = []
    let segment: Point[] = []
    for (const point of ordered) {
      const previous = segment.at(-1)
      if (previous && Date.parse(point.day) - Date.parse(previous.day) > DAY_MS) {
        if (segment.length === 1) singletons.push(segment[0])
        else segments.push(segment)
        segment = []
      }
      segment.push(point)
    }
    if (segment.length === 1) singletons.push(segment[0])
    else if (segment.length) segments.push(segment)
    const commands = segments.map(items => items.map((p, i) =>
      (i ? 'L' : 'M') + x(Date.parse(p.day)).toFixed(2) + ' ' + y(p.value).toFixed(2)).join(' ')).join(' ')
    return '<path class="chart-line" d="' + commands + '"/>' + singletons.map(p =>
      '<circle class="chart-dot" cx="' + x(Date.parse(p.day)) + '" cy="' + y(p.value) + '" r="4"/>').join('')
  }
  const graphs = series.entities.map((entity, index) => shown.has(entity.id)
    ? '<g style="--series:' + colors[index] + '">' + line(activePoints.filter(point => point.entity_id === entity.id)) + '</g>' : '').join('')
  return { markup: horizontal + vertical + graphs, first, ndays, x, y }
}

export function chart(series: Series) {
  const shown = new Set(series.entities.map(e => e.id))
  const initial = plot(series, shown)
  return '<div class="chart" data-chart><fieldset class="chart-legend"><legend class="sr">Visible series</legend>'
    + series.entities.map((entity, i) => '<label style="--series:' + colors[i] + '"><input type="checkbox" checked value="'
      + esc(entity.id) + '"><span></span>' + esc(entity.name) + '</label>').join('')
    + '</fieldset><div class="chart-graphic"><svg data-chart-svg viewBox="0 0 ' + width + ' ' + height
    + '" role="img" aria-label="' + esc(series.metric.name + ' in ' + series.points[0].unit + ' over time') + '">'
    + '<g data-plot>' + initial.markup + '</g><g data-guide></g></svg><div class="chart-tooltip" data-tooltip hidden></div></div>'
    + '<label class="chart-cursor"><span>Inspect a date</span><input type="range" min="0" max="' + initial.ndays
    + '" value="' + initial.ndays + '" data-cursor><output data-cursor-out aria-live="polite">'
    + esc(time(series.window.to)) + '</output></label></div>'
}

export function bindChart(root: HTMLElement, series: Series) {
  const element = root.querySelector<HTMLElement>('[data-chart]')
  if (!element) return
  const shown = new Set(series.entities.map(e => e.id))
  const svg = element.querySelector<SVGElement>('[data-chart-svg]')!
  const plots = element.querySelector('[data-plot]')!
  const guide = element.querySelector('[data-guide]')!
  const popup = element.querySelector<HTMLElement>('[data-tooltip]')!
  const cursor = element.querySelector<HTMLInputElement>('[data-cursor]')!
  const output = element.querySelector<HTMLOutputElement>('[data-cursor-out]')!
  let graph = plot(series, shown)
  const display = (dayIndex: number) => {
    const ms = graph.first + dayIndex * DAY_MS
    const day = dayString(ms)
    const px = graph.x(ms)
    const date = time(day)
    cursor.value = String(dayIndex)
    cursor.setAttribute('aria-valuetext', date)
    output.value = date
    const values = series.entities.filter(entity => shown.has(entity.id)).map(entity => ({
      name: entity.name,
      point: series.points.find(point => point.day === day && point.entity_id === entity.id),
    }))
    popup.innerHTML = '<strong>' + esc(date) + '</strong>' + values.map(({name,point}) => '<div><span>' + esc(name)
      + '</span><b>' + (point ? esc(number(point.value) + ' ' + point.unit) : 'Unavailable') + '</b></div>').join('')
    popup.hidden = false
    popup.classList.toggle('tooltip-left', px / width > .58)
    popup.style.left = (px / width * 100) + '%'
    guide.innerHTML = '<path class="chart-guide" d="M' + px + ' ' + top + 'V' + (height - bottom) + '"/>'
      + values.filter(value => value.point).map(({point}) =>
        '<circle class="focus-dot" cx="' + px + '" cy="' + graph.y(point!.value) + '" r="4"/>').join('')
  }
  svg.addEventListener('pointermove', event => {
    const box = svg.getBoundingClientRect()
    const ratio = ((event.clientX - box.left) / box.width * width - left) / plotWidth
    display(Math.max(0, Math.min(graph.ndays, Math.round(ratio * Math.max(1, graph.ndays)))))
  })
  const hide = () => { popup.hidden = true; guide.innerHTML = '' }
  svg.addEventListener('pointerleave', hide)
  cursor.addEventListener('input', () => display(Number(cursor.value)))
  cursor.addEventListener('focus', () => display(Number(cursor.value)))
  cursor.addEventListener('blur', hide)
  for (const checkbox of element.querySelectorAll<HTMLInputElement>('fieldset input')) {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) shown.add(checkbox.value)
      else shown.delete(checkbox.value)
      graph = plot(series, shown)
      plots.innerHTML = graph.markup
      hide()
    })
  }
}
