import '@fontsource-variable/space-grotesk/wght.css'
import '@fontsource-variable/inter/wght.css'
import '@fontsource/ibm-plex-mono/400.css'
import './style.css'
import type { Catalog, Detail, Overview, Perspective, Series, Status } from '../shared/model'
import { metricById } from '../shared/metrics'
import { bindChart } from './chart'
import { en, lens } from './copy'
import { empty, esc, heading, link, path } from './html'
import { button, compare, detail, explorer, home, homeVisual, methods, shell, status } from './views'
import { icon } from './art'

const app = document.querySelector<HTMLElement>('#app')!
let controller: AbortController
let sequence = 0
let currentShell = ''

class FetchError extends Error {}

async function read<T>(endpoint: string, active: AbortSignal): Promise<T> {
  const response = await fetch(endpoint, { signal: active, headers: { Accept: 'application/json' } })
  const type = response.headers.get('Content-Type') ?? ''
  if (!type.includes('application/json')) throw new FetchError('The archive did not return data for this request.')
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new FetchError(data.error || 'The archive temporarily failed to answer.')
  return data
}

function seriesURL(params: URLSearchParams, entityIds: string[], metric: string) {
  return path('/api/v1/series', { metric, entities: entityIds.join(','), from: params.get('from'), to: params.get('to') })
}

function catalogURL(params: URLSearchParams) {
  const filtered = new URLSearchParams()
  for (const key of ['perspective','category','kind','metric','q','scope','page','from','to']) {
    const value = params.get(key)
    if (value) filtered.set(key, value)
  }
  return path('/api/v1/catalog', filtered)
}

const defaultMetric = (kind: string) => ({ protocol: 'stellar-ttl', system: 'wiki-views', asset: 'transfers' })[kind] ?? 'blocks'

async function render(focus = false) {
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  const renderId = ++sequence
  const url = new URL(window.location.href)
  const route = url.pathname.replace(/\/$/, '') || '/'
  const params = new URLSearchParams(url.search)
  const shellRoute = route.startsWith('/entity/') ? '/explorer' : route
  if (shellRoute !== currentShell || !app.querySelector('main')) {
    currentShell = shellRoute
    app.innerHTML = shell(shellRoute)
  }
  const root = app.querySelector<HTMLElement>('main')!
  root.setAttribute('aria-busy', 'true')
  document.title = (route === '/' ? 'CIRCULA Observatory' : ((en.nav.find(([href]) => href === shellRoute)?.[1] ?? 'Entity') + ' · CIRCULA Observatory'))
  const loading = '<div class="skeleton page-loading" role="status">Loading observations…</div>'
  root.innerHTML = route === '/' ? home(params, null) : route === '/methods' ? methods() : loading
  let selected: Series | null = null
  let bindView: ((root: HTMLElement) => void) | undefined
  try {
    let markup = ''
    if (route === '/') {
      const overview = await read<Overview>('/api/v1/overview', signal)
      markup = home(new URLSearchParams(window.location.search), overview)
    } else if (route === '/research') {
      const { research } = await import('./research')
      const view = await research(params, signal)
      markup = view.markup
      bindView = 'bind' in view ? view.bind : undefined
    } else if (route === '/explorer') {
      const data = await read<Catalog>(catalogURL(params), signal)
      const chosen = data.items.find(item => item.id === params.get('entity'))
        ?? data.items.find(item => item.metric_id)
      if (chosen?.metric_id) {
        try {
          selected = await read<Series>(seriesURL(params, [chosen.id], params.get('metric') || chosen.metric_id), signal)
        } catch (error) {
          if (!(error instanceof FetchError)) throw error
        }
      }
      markup = explorer(params, data, selected)
    } else if (route.startsWith('/entity/')) {
      const id = decodeURIComponent(route.slice('/entity/'.length))
      const data = await read<Detail>('/api/v1/entities/' + encodeURIComponent(id), signal)
      const preferred = data.coverage.find(item => item.metric_id === params.get('metric'))
        ?? data.coverage.find(item => item.metric_id === 'stellar-ttl') ?? data.coverage[0]
      if (preferred) {
        params.set('metric', preferred.metric_id)
        selected = await read<Series>(seriesURL(params, [id], preferred.metric_id), signal)
      }
      document.title = data.entity.name + ' · CIRCULA Observatory'
      markup = detail(data, selected, params, route)
    } else if (route === '/compare') {
      const kind = params.get('kind') || 'network'
      const metric = params.get('metric') || defaultMetric(kind)
      params.set('metric', metric)
      params.set('kind', kind)
      const list = params.get('entities')
      const ids = list === 'none' ? [] : list ? [...new Set(list.split(',').filter(Boolean))].slice(0, 4)
        : kind === 'network' && metric === 'blocks' ? ['network:btc','eip155:1'] : []
      params.set('entities', ids.join(',') || 'none')
      const chosen = metricById.get(metric)
      const candidates = new URLSearchParams({ kind, metric, q: params.get('q') ?? '' })
      const [catalog, result] = await Promise.all([
        read<Catalog>(catalogURL(candidates), signal),
        ids.length && chosen?.compare !== 'none'
          ? read<Series>(seriesURL(params, ids, metric), signal).catch(error => {
            if (!(error instanceof FetchError)) throw error
            return error.message
          }) : Promise.resolve(null),
      ])
      selected = typeof result === 'string' ? null : result
      const error = typeof result === 'string' ? result : null
      markup = compare(params, ids, catalog, selected, error)
    } else if (route === '/methods') {
      markup = methods()
    } else if (route === '/status') {
      markup = status(await read<Status>('/api/v1/status', signal))
    } else {
      markup = heading('Observatory', 'Page unavailable', 'This address does not match an Observatory view.') + button('/', 'Go to Overview')
    }
    if (renderId !== sequence) return
    root.innerHTML = markup
    if (selected) bindChart(root, selected)
    bindView?.(root)
  } catch (error) {
    if (signal.aborted || renderId !== sequence) return
    const message = error instanceof FetchError ? error.message : 'Try again in a moment.'
    root.innerHTML = route === '/' ? home(params, null, true)
      : heading('Archive', 'Unable to load this view', message) + empty('The request could not be completed', 'You can retry or return to the Explorer.', '<button class="button" data-retry>Retry</button>')
      + button('/explorer', 'Open Explorer')
  } finally {
    if (renderId === sequence) {
      root.removeAttribute('aria-busy')
      if (focus) {
        if (url.hash) {
          const section = document.getElementById(url.hash.slice(1))
          section?.scrollIntoView()
          if (section instanceof HTMLElement) {
            if (!section.hasAttribute('tabindex')) section.tabIndex = -1
            section.focus({ preventScroll: true })
          }
        } else {
          root.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
          window.scrollTo(0, 0)
        }
      }
    }
  }
}

function open(url: URL) {
  window.history.pushState(null, '', url)
  void render(true)
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return
  const control = event.target.closest<HTMLButtonElement>('button[data-lens],button[data-retry],button[data-share]')
  if (control?.hasAttribute('data-retry')) {
    void render()
    return
  }
  if (control?.hasAttribute('data-share')) {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      control.querySelector('span')!.textContent = en.copied
    }, () => {
      control.querySelector('span')!.textContent = 'Copy the address from your browser'
    })
    return
  }
  if (control?.dataset.lens) {
    const active = control.dataset.lens as Perspective
    const url = new URL(window.location.href)
    url.searchParams.set('perspective', active)
    window.history.pushState(null, '', url)
    for (const item of document.querySelectorAll<HTMLButtonElement>('button[data-lens]')) {
      const chosen = item === control
      item.classList.toggle('selected', chosen)
      item.setAttribute('aria-pressed', String(chosen))
    }
    const concept = document.querySelector('#concept')
    if (concept) concept.innerHTML = homeVisual(active)
    const target = document.querySelector('#lens-link')
    if (target) target.innerHTML = link(path('/explorer', { perspective: active }),
      'Explore ' + esc(lens[active].title.toLowerCase()) + ' ' + icon('arrow', 16), 'text-link')
    return
  }
  const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
  if (!anchor || anchor.target || anchor.hasAttribute('download') || event.defaultPrevented || event.button !== 0
    || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  const destination = new URL(anchor.href)
  if (destination.origin !== location.origin || destination.pathname.startsWith('/api/')
    || anchor.getAttribute('href')?.startsWith('#')) return
  event.preventDefault()
  open(destination)
})

document.addEventListener('submit', event => {
  if (!(event.target instanceof HTMLFormElement) || !event.target.hasAttribute('data-navigation')) return
  event.preventDefault()
  const form = event.target
  const url = new URL(form.action)
  for (const [key, value] of new FormData(form)) if (typeof value === 'string' && value.trim()) url.searchParams.set(key, value.trim())
  if (form.hasAttribute('data-compare-form')) {
    const kind = url.searchParams.get('kind') ?? 'network'
    if (kind !== url.searchParams.get('previous-kind')) {
      url.searchParams.set('metric', defaultMetric(kind))
      url.searchParams.set('entities', 'none')
    } else if (url.searchParams.get('metric') !== url.searchParams.get('previous-metric')) {
      url.searchParams.set('entities', 'none')
    }
    url.searchParams.delete('previous-kind')
    url.searchParams.delete('previous-metric')
  }
  if (url.pathname === '/explorer' && url.searchParams.has('category')) {
    const current = metricById.get(url.searchParams.get('metric') ?? '')
    if (current && current.category !== url.searchParams.get('category')) url.searchParams.delete('metric')
  }
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const toField = form.querySelector<HTMLInputElement>('[name=to]')
  if (toField && from && to && from > to) {
    toField.setCustomValidity('Choose an end date on or after the start date.')
    toField.reportValidity()
    toField.addEventListener('input', () => toField.setCustomValidity(''), { once: true })
    return
  }
  open(url)
})

window.addEventListener('popstate', () => void render(true))
void render()
