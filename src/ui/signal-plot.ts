import { esc, number } from './html'

export interface SignalTrack {
  label: string
  values: readonly number[]
  tone: 'green' | 'cyan' | 'amber'
}

export interface SignalPlot {
  label: string
  cursorLabel: string
  labels: readonly string[]
  shortLabels: readonly string[]
  tracks: readonly SignalTrack[]
  format: (value: number) => string
  axisFormat?: (value: number) => string
  maximum?: number
}

const WIDTH = 800
const HEIGHT = 220

function axisCeiling(max: number) {
  if (max <= 0) return 0
  const magnitude = 10 ** Math.floor(Math.log10(max / 4))
  const step = [1, 2, 2.5, 5, 10].find(n => n * magnitude * 4 >= max)!
  return step * magnitude * 4
}

function geometry(plot: SignalPlot) {
  const values = plot.tracks.flatMap(track => track.values)
  const low = -axisCeiling(-Math.min(...values))
  const high = (plot.maximum ?? axisCeiling(Math.max(...values))) || (low === 0 ? 1 : 0)
  const n = plot.labels.length - 1
  return { low, high, n, x: (index: number) => index / Math.max(1, n) * WIDTH, y: (value: number) => (high - value) / (high - low) * HEIGHT }
}

export function signalPlot(plot: SignalPlot, index: number) {
  const { low, high, n, x, y } = geometry(plot)
  const axes = Array.from({ length: 5 }, (_, step) => {
    const value = low + (1 - step / 4) * (high - low)
    return '<span>' + esc((plot.axisFormat ?? (v => number(v, true)))(value)) + '</span>'
  }).join('')
  const grid = [0, .25, .5, .75, 1].map(tick => 'M0 ' + (tick * HEIGHT) + 'H' + WIDTH).join(' ')
  const traces = plot.tracks.map(track => {
    const coords = track.values.map((value, i) => x(i).toFixed(2) + ' ' + y(value).toFixed(2))
    const curve = '<path class="signal-line" d="M' + coords.join('L') + '"/>'
    const area = plot.tracks.length === 1 ? '<path class="signal-area" d="M' + coords.join('L') + 'V' + y(0) + 'H0Z"/>' : ''
    return '<g class="tone-' + track.tone + '">' + area + curve + '</g>'
  }).join('')
  const middle = plot.shortLabels[Math.round(n / 2)]
  return '<div class="signal-plot"><div class="signal-axes" aria-hidden="true">' + axes + '</div>'
    + '<div class="signal-viewport" data-signal-viewport>'
    + '<svg class="signal-graph' + (plot.tracks.length === 1 ? ' signal-single' : '') + '" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" preserveAspectRatio="none" role="img" aria-label="'
    + esc(plot.label) + '"><path class="signal-grid" d="' + grid + '"/>'
    + (low < 0 ? '<path class="signal-grid signal-zero" d="M0 ' + y(0) + 'H' + WIDTH + '"/>' : '') + traces + '</svg>'
    + '<div class="signal-guide" data-signal-guide aria-hidden="true"></div>'
    + '<div class="signal-hover" data-signal-hover aria-hidden="true" hidden></div></div>'
    + '<div class="signal-ticks" aria-hidden="true"><span>' + esc(plot.shortLabels[0]) + '</span><span>'
    + esc(middle) + '</span><span>' + esc(plot.shortLabels[n]) + '</span></div></div>'
    + '<div class="signal-cursor"><label class="signal-range" for="signal-position">' + esc(plot.cursorLabel) + '</label>'
    + '<input id="signal-position" type="range" min="0" max="' + n + '" value="' + index + '" data-signal-position>'
    + '<output for="signal-position" data-signal-output></output></div>'
}

export function bindSignalPlot(root: HTMLElement, plot: SignalPlot, start: number, onPick: (index: number) => void) {
  const { y, n } = geometry(plot)
  const viewport = root.querySelector<HTMLElement>('[data-signal-viewport]')!
  const marker = root.querySelector<HTMLElement>('[data-signal-guide]')!
  const hover = root.querySelector<HTMLElement>('[data-signal-hover]')!
  const input = root.querySelector<HTMLInputElement>('[data-signal-position]')!
  const output = root.querySelector<HTMLOutputElement>('[data-signal-output]')!
  const fraction = (index: number) => index / Math.max(1, n)
  const position = (event: PointerEvent | MouseEvent) => {
    const rect = viewport.getBoundingClientRect()
    return Math.min(n, Math.max(0, Math.round((event.clientX - rect.left) / rect.width * n)))
  }
  const show = (index: number) => {
    marker.style.left = (fraction(index) * 100) + '%'
    marker.innerHTML = plot.tracks.map(track => '<i class="tone-' + track.tone + '" style="top:'
      + (y(track.values[index]) / HEIGHT * 100) + '%"></i>').join('')
    input.value = String(index)
    input.setAttribute('aria-valuetext', plot.labels[index] + ', ' + plot.tracks.map(track => track.label + ' ' + plot.format(track.values[index])).join(', '))
    output.value = plot.labels[index]
  }
  const pick = (index: number) => {
    hover.hidden = true
    show(index)
    onPick(index)
  }
  input.addEventListener('input', () => pick(Number(input.value)))
  viewport.addEventListener('click', event => pick(position(event)))
  viewport.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return
    const index = position(event)
    const width = viewport.clientWidth
    const popupWidth = Math.min(226, width)
    const desired = fraction(index) * width + (fraction(index) >= .55 ? -popupWidth - 8 : 8)
    hover.style.left = Math.max(0, Math.min(width - popupWidth, desired)) + 'px'
    hover.innerHTML = '<strong>' + esc(plot.labels[index]) + '</strong>' + plot.tracks.map(track =>
      '<span>' + esc(track.label) + ' <b>' + esc(plot.format(track.values[index])) + '</b></span>').join('')
    hover.hidden = false
  })
  viewport.addEventListener('pointerleave', () => { hover.hidden = true })
  show(start)
  onPick(start)
}

export function replaceStudyFilters(values: Record<string, string | null>) {
  const url = new URL(window.location.href)
  for (const [key, value] of Object.entries(values)) {
    if (value === null) url.searchParams.delete(key)
    else url.searchParams.set(key, value)
  }
  history.replaceState(history.state, '', url)
}
