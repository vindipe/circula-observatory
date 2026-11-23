import type { Perspective } from '../shared/model'
import { lens } from './copy'

const iconPaths: Record<string, string> = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  diagonal: '<path d="M6 18 18 6M8 6h10v10"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4.5 4.5"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16M8 4v16"/>',
  chart: '<path d="M4 4v16h16M7 15l4-5 4 2 5-6"/>',
  download: '<path d="M12 4v11m-4-4 4 4 4-4M5 15v5h14v-5"/>',
  link: '<path d="m10 13 4-4m-5 6-2 2a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0m0 8a3 3 0 0 0 4 0l5-5a3 3 0 0 0-4-4l-2 2"/>',
  accumulate: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5"/>',
  persist: '<path d="M12 2 21 6v6c0 4-4 8-9 10-5-2-9-6-9-10V6l9-4Z"/><path d="M12 8v4l3 2"/>',
  circulate: '<path d="M4 9h16l-4-4m4 10H4l4 4"/><circle cx="4" cy="9" r="1"/><circle cx="20" cy="15" r="1"/>',
  expire: '<path d="M6 3h12M6 21h12M7 3v4l5 5-5 5v4m10-18v4l-5 5 5 5v4"/><path d="M9 18h6"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
}
export const icon = (name: string, size = 20) => '<svg aria-hidden="true" width="' + size + '" height="' + size
  + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">'
  + (iconPaths[name] ?? '') + '</svg>'

export const mark = '<svg aria-hidden="true" viewBox="0 0 44 44" fill="none"><path d="M34 13A15 15 0 1 0 34 31m-4-14a10 10 0 1 0 0 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m34 17 5 5-5 5-5-5Z" fill="currentColor"/></svg>'

type XY = [number, number]
const iso = (x: number, y: number, z = 0): XY => [315 + 35 * (x - y), 133 + 17 * (x + y) - 34 * z]
const xy = ([x, y]: XY) => x + ',' + y
const points = (...vertices: XY[]) => vertices.map(xy).join(' ')

function plane(x: number, y: number, z: number, span: number, classes: string) {
  return '<polygon class="' + classes + '" points="' + points(iso(x, y, z), iso(x + span, y, z), iso(x + span, y + span, z), iso(x, y + span, z)) + '"/>'
}

function cube(x: number, y: number, z: number, tone: string) {
  const size = 0.94
  const height = 0.92
  const top = z + height
  return '<g class="cube ' + tone + '"><polygon class="face-left" points="'
    + points(iso(x, y + size, z), iso(x + size, y + size, z), iso(x + size, y + size, top), iso(x, y + size, top))
    + '"/><polygon class="face-right" points="'
    + points(iso(x + size, y, z), iso(x + size, y + size, z), iso(x + size, y + size, top), iso(x + size, y, top))
    + '"/>' + plane(x, y, top, size, 'face-top') + '</g>'
}

type Cell = [number, number, number, string]
const cells: Record<Perspective, Cell[]> = {
  accumulate: [
    [1, 0, 0, 'quiet'], [2, 0, 0, 'blue'], [3, 0, 0, 'quiet'], [0, 1, 0, 'blue'],
    [1, 1, 0, 'quiet'], [2, 1, 0, 'green'], [2, 1, 1, 'green'], [2, 1, 2, 'bright'],
    [3, 1, 0, 'blue'], [3, 1, 1, 'quiet'], [4, 1, 0, 'blue'], [1, 2, 0, 'blue'],
    [1, 2, 1, 'green'], [2, 2, 0, 'green'], [2, 2, 1, 'green'], [3, 2, 0, 'green'],
    [3, 2, 1, 'green'], [3, 2, 2, 'bright'], [4, 2, 0, 'quiet'], [1, 3, 0, 'quiet'],
    [2, 3, 0, 'green'], [3, 3, 0, 'blue'], [4, 3, 0, 'blue'], [2, 4, 0, 'quiet'],
  ],
  persist: [
    [0, 0, 0, 'quiet'], [1, 0, 0, 'blue'], [2, 0, 0, 'quiet'], [3, 0, 0, 'blue'],
    [0, 1, 0, 'blue'], [1, 1, 0, 'blue'], [2, 1, 0, 'blue'], [3, 1, 0, 'blue'],
    [0, 2, 0, 'blue'], [1, 2, 0, 'blue'], [2, 2, 0, 'green'], [2, 2, 1, 'bright'],
    [2, 2, 2, 'bright'], [3, 2, 0, 'blue'], [0, 3, 0, 'quiet'], [1, 3, 0, 'blue'],
    [3, 3, 0, 'quiet'], [2, 4, 0, 'quiet'], [4, 2, 0, 'quiet'],
  ],
  circulate: [
    [0, 0, 0, 'blue'], [0, 0, 1, 'violet'], [1, 0, 0, 'blue'], [0, 1, 0, 'blue'],
    [1, 1, 0, 'quiet'], [3, 3, 0, 'quiet'], [3, 4, 0, 'blue'], [4, 3, 0, 'violet'],
    [4, 4, 0, 'violet'], [4, 4, 1, 'violet'], [4, 0, 0, 'quiet'], [0, 4, 0, 'quiet'],
    [2, 2, 0, 'green'],
  ],
  expire: [
    [0, 1, 0, 'blue'], [1, 1, 0, 'quiet'], [1, 1, 1, 'bright'], [1, 1, 2, 'amber'],
    [2, 1, 0, 'blue'], [0, 2, 0, 'quiet'], [1, 2, 0, 'blue'], [2, 2, 0, 'amber'],
    [3, 3, 0, 'quiet'], [4, 3, 0, 'quiet'], [3, 4, 0, 'blue'], [4, 4, 0, 'blue'],
    [4, 4, 1, 'quiet'],
  ],
}

export function illustration(id: Perspective) {
  const guide = Array.from({ length: 6 }, (_, i) =>
    '<path d="M' + xy(iso(i, 0)) + 'L' + xy(iso(i, 5)) + 'M' + xy(iso(0, i)) + 'L' + xy(iso(5, i)) + '"/>').join('')
  const diagram = [...cells[id]].sort((a, b) => a[0] + a[1] - b[0] - b[1] || a[2] - b[2])
    .map(cell => cube(...cell)).join('')
  const traces = {
    accumulate: '<path class="tracer" d="M190 185v-42l-50-26m251 150v-38l75-37"/><circle cx="140" cy="117" r="3"/><circle cx="466" cy="192" r="3"/>',
    persist: plane(1.2, 1.2, 2.12, 2.55, 'enclosure') + plane(1.2, 1.2, 2.83, 2.55, 'enclosure'),
    circulate: '<path class="tracer flow-trace" d="M315 105 403 150 403 202 316 243"/><path class="tracer flow-trace" d="M313 104 222 153 222 203 316 243"/><circle cx="403" cy="150" r="4"/><circle cx="222" cy="153" r="4"/>',
    expire: '<path class="tracer flow-trace" d="M315 111 412 162 411 224 316 269"/><path class="tracer" d="m327 253-11 16 19-3"/><circle cx="412" cy="162" r="4"/>',
  }[id]
  return '<svg class="observatory-art" viewBox="80 2 470 370" role="img" aria-label="' + lens[id].caption + '">'
    + '<defs><radialGradient id="orbit-glow"><stop stop-color="' + lens[id].color + '" stop-opacity=".17"/><stop offset="1" stop-color="' + lens[id].color + '" stop-opacity="0"/></radialGradient></defs>'
    + '<ellipse cx="315" cy="175" rx="216" ry="173" fill="url(#orbit-glow)"/>'
    + '<g class="orbit"><ellipse cx="315" cy="218" rx="215" ry="100"/><ellipse cx="315" cy="218" rx="193" ry="89"/><path d="M100 218h25m380 0h25m-215-100v15m0 170v15"/></g>'
    + plane(-0.35, -0.35, -0.21, 5.7, 'platform-edge') + plane(-0.35, -0.35, 0, 5.7, 'platform')
    + '<g class="lattice">' + guide + '</g>' + diagram + '<g class="traces" style="--art-tone:' + lens[id].color + '">'
    + traces + '</g><g class="art-cross"><path d="M118 89h14m-7-7v14M495 87h14m-7-7v14M144 293h14m-7-7v14M463 311h14m-7-7v14"/></g></svg>'
}
