import { daysAgo, type Entity, type Point } from '../shared/model'
import { icon } from './art'

export const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]!)

export const number = (value: number, compact = false) => new Intl.NumberFormat('en', {
  notation: compact && Math.abs(value) >= 1000 ? 'compact' : 'standard',
  maximumFractionDigits: compact ? 2 : 5,
}).format(value)

export function time(value: string | null, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
  if (withTime) Object.assign(options, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return new Intl.DateTimeFormat('en-GB', options).format(date) + (withTime ? ' UTC' : '')
}

export function path(url: string, params?: URLSearchParams | Record<string, string | null | undefined>) {
  const query = new URLSearchParams()
  if (params instanceof URLSearchParams) {
    for (const [key, value] of params) if (value) query.set(key, value)
  } else if (params) {
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
  }
  return url + (query.size ? '?' + query.toString() : '')
}

export const entityPath = (entity: string, metric?: string | null, params?: URLSearchParams) => {
  const query = new URLSearchParams(params)
  if (metric) query.set('metric', metric)
  for (const key of ['q','entity','page','scope','entities','kind','category','perspective']) query.delete(key)
  return path('/entity/' + encodeURIComponent(entity), query)
}

export const link = (href: string, label: string, css = '', extra = '') =>
  '<a ' + (css ? 'class="' + css + '" ' : '') + 'href="' + esc(href) + '"' + (extra ? ' ' + extra : '') + '>' + label + '</a>'

export const ext = (url: string | null, label: string) => {
  if (!url || !/^https?:\/\//i.test(url)) return ''
  return link(url, esc(label) + ' ' + icon('diagonal', 13), 'external', 'target="_blank" rel="noopener noreferrer"')
}

export const empty = (heading: string, message: string, action = '') =>
  '<div class="empty"><span class="empty-icon">' + icon('database', 24) + '</span><h3>' + esc(heading) + '</h3><p>'
  + esc(message) + '</p>' + action + '</div>'

export const options = (items: [string, string][], value: string) => items.map(([id, label]) =>
  '<option value="' + esc(id) + '"' + (id === value ? ' selected' : '') + '>' + esc(label) + '</option>').join('')

export const select = (name: string, label: string, items: [string, string][], value: string) =>
  '<label class="field"><span>' + esc(label) + '</span><select name="' + name + '">' + options(items, value) + '</select></label>'

export function pointsTable(points: Point[], entities: Entity[]) {
  const names = new Map(entities.map(e => [e.id, e.name]))
  return '<div class="table-scroll" role="region" aria-label="Observation table" tabindex="0"><table><thead><tr>'
    + '<th scope="col">Subject</th><th scope="col">Observation date</th><th scope="col" class="numeric">Value</th><th scope="col">Unit</th>'
    + '<th scope="col">Collected (UTC)</th><th scope="col">Revision</th></tr></thead><tbody>'
    + [...points].reverse().map(point => '<tr><th scope="row">' + esc(names.get(point.entity_id)) + '</th><td>'
      + esc(time(point.observed_at, Boolean(point.context))) + '</td><td class="numeric">' + esc(number(point.value))
      + '</td><td>' + esc(point.unit) + '</td><td>' + esc(time(point.collected_at, true)) + '</td><td>' + (point.revision ?? 1) + '</td></tr>').join('')
    + '</tbody></table></div>'
}

export function period(params: URLSearchParams, latest?: string) {
  const to = params.get('to') || latest || daysAgo(1)
  return { from: params.get('from') || daysAgo(89, Date.parse(to)), to }
}

export function heading(eyebrow: string, title: string, description: string, action = '') {
  return '<section class="page-heading"><div><p class="kicker">' + esc(eyebrow)
    + '</p><h1 tabindex="-1">' + esc(title) + '</h1><p class="intro">' + esc(description) + '</p></div>'
    + action + '</section>'
}
