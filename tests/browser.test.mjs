import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const base = process.env.OBSERVATORY_URL || 'http://127.0.0.1:8787'
const outcomes = []
const browser = await chromium.launch({
  headless: true, executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
const viewport = { width: 1440, height: 1080 }
const desktop = await browser.newContext({ viewport, acceptDownloads: true })
const page = await desktop.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text())
})
const path = suffix => new URL(suffix, base).href
async function view(suffix, title) {
  await page.goto(path(suffix))
  await page.getByRole('heading', { name: title, level: 1 }).waitFor()
  await page.locator('main:not([aria-busy])').waitFor()
}
async function accessible(label) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()
  assert.deepEqual(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], label)
  outcomes.push(label + ' axe checks')
}
async function fits(p) {
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
}

try {
  await mkdir('.cache/screenshots', { recursive: true })
  const ocean = await page.request.get(path('/api/v1/overview'))
  assert.equal(ocean.status(), 200)
  const counts = (await ocean.json()).counts
  assert.ok(counts.find(item => item.kind === 'network').measured >= 6)
  await view('/', /The life of digital resources/)
  await page.getByText('Inside the archive').waitFor()
  await page.getByRole('button', { name: /Persist/ }).click()
  assert.match(page.url(), /perspective=persist/)
  assert.equal(await page.getByRole('button', { name: /Persist/ }).getAttribute('aria-pressed'), 'true')
  await page.getByRole('button', { name: /Accumulate/ }).click()
  await accessible('Overview')
  await fits(page)
  await page.screenshot({ path: '.cache/screenshots/overview-desktop.png' })
  await page.getByRole('searchbox', { name: 'Search the catalog' }).fill('Bitcoin')
  await page.getByRole('button', { name: 'Run catalog search' }).click()
  await page.getByRole('heading', { name: 'Explorer', level: 1 }).waitFor()
  await page.getByRole('link', { name: 'Bitcoin', exact: true }).first().waitFor()
  assert.match(page.url(), /q=Bitcoin/)
  await accessible('Explorer')
  await view('/entity/network%3Abtc?metric=blocks', 'Bitcoin')
  await page.getByRole('heading', { name: 'Blocks added', exact: true }).first().waitFor()
  await page.getByRole('slider', { name: 'Inspect a date' }).press('ArrowLeft')
  assert.equal(await page.locator('[data-tooltip]').isVisible(), true)
  await page.getByRole('link', { name: 'Table', exact: true }).click()
  await page.getByRole('table').waitFor()
  const original = await page.getByRole('link', { name: 'JSON', exact: true }).getAttribute('href')
  const raw = await page.request.get(path(original))
  const dataset = await raw.json()
  assert.equal(await page.locator('tbody tr').count(), dataset.points.length)
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'CSV', exact: true }).click()
  const file = await (await download).path()
  const csv = await readFile(file, 'utf8')
  assert.match(csv, /^entity_id,metric_id,day,value,unit,observed_at,collected_at,revision,source,license,context/)
  assert.equal(csv.trim().split(/\r?\n/).length, dataset.points.length + 1)
  assert.ok(csv.includes('"' + dataset.points[0].value + '"'))
  await accessible('Entity table')
  await view('/compare?metric=blocks&kind=network&entities=network%3Abtc%2Ceip155%3A1', 'Compare observations')
  await page.locator('[data-chart-svg]').waitFor()
  const legend = page.getByRole('checkbox', { name: /Bitcoin/ })
  await legend.uncheck()
  assert.equal(await page.locator('.chart-line').count(), 1)
  await legend.check()
  await page.getByRole('link', { name: /Last 14 days/ }).click()
  await page.locator('[data-chart-svg]').waitFor()
  assert.match(page.url(), /from=/)
  await accessible('Compare')
  await page.screenshot({ path: '.cache/screenshots/compare-desktop.png' })
  const incompatible = await page.request.get(path('/api/v1/series?metric=issued-supply&entities=asset:btc,asset:eth'))
  assert.equal(incompatible.status(), 422)
  await view('/methods', 'Methods & data')
  await page.getByText('Remaining contract TTL', { exact: true }).click()
  await page.getByText(/last live ledger sequence/).waitFor()
  await accessible('Methods')
  await view('/status','Data status')
  await page.getByRole('heading', { name: 'Recent collection runs' }).waitFor()
  await accessible('Data status')

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1, hasTouch: true })
  const phone = await mobile.newPage()
  await phone.goto(path('/'))
  await phone.getByRole('heading', { name: /The life of digital resources/, level: 1 }).waitFor()
  await phone.locator('main:not([aria-busy])').waitFor()
  await fits(phone)
  await phone.screenshot({ path: '.cache/screenshots/overview-mobile.png' })
  await phone.getByRole('link', { name: 'Explorer', exact: true }).click()
  await phone.getByRole('heading', { name: 'Explorer', level: 1 }).waitFor()
  await fits(phone)
  await mobile.close()
  assert.deepEqual(errors, [])
  console.log('Browser flow passed at', base)
  console.log(outcomes.join('\n'))
  console.log('Responsive checks, search, lens controls, chart cursor, legend, zoom, CSV/JSON consistency, and clean console passed.')
} finally {
  await browser.close()
}
