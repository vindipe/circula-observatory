import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.OBSERVATORY_URL || 'http://127.0.0.1:8787'
const screenshots = '.cache/screenshots'
const chromiumPath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
const browser = await chromium.launch({ executablePath: chromiumPath, args: ['--no-sandbox'] })
const desktop = await browser.newContext({ viewport: { width: 1440, height: 980 }, acceptDownloads: true })
const errors = []
const archiveRequests = []
function watch(page) {
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) archiveRequests.push(request.url())
  })
  page.setDefaultTimeout(12000)
}
function href(query = '') { return new URL('/' + query, base).href }
async function fits(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
    'Page overflows the viewport at ' + page.url())
}
async function photograph(page, file) {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: screenshots + '/atlas-' + file + '.png', animations: 'disabled' })
}
async function inspectSnapshot(request, name) {
  const response = await request.get(href('atlas/current.json'))
  let asset = '/atlas/' + name + '.json'
  if (response.ok() && response.headers()['content-type']?.includes('json'))
    asset = (await response.json()).files[name]
  const data = await request.get(new URL(asset, base).href)
  assert.ok(data.ok(), name + ' snapshot unavailable')
  return data.json()
}
async function go(page, query, title) {
  await page.goto(href(query))
  await page.getByRole('heading', { name: title, level: 1 }).waitFor()
}
function param(page,key) { return new URL(page.url()).searchParams.get(key) }
const mark = label => console.log('PASS',label)

try {
  await mkdir(screenshots,{recursive:true})
  const page = await desktop.newPage()
  watch(page)
  await go(page,'',/The persistence atlas/i)
  await page.locator('#home-chart .at-plot-line').waitFor()
  await fits(page)
  await photograph(page,'home-desktop')
  const btn = page.locator('button[data-resource="inactive"]')
  await btn.focus()
  await btn.press('Enter')
  await page.locator('[data-resource="inactive"][aria-pressed="true"]').waitFor()
  assert.equal(await btn.getAttribute('aria-pressed'),'true')
  assert.equal(param(page,'resource'),'inactive')
  assert.match(await page.locator('.a-feature-foot p').innerText(),/supply stays idle/)
  assert.match(await page.locator('#home-chart h3').textContent(),/365 days/)
  const open = page.getByRole('link',{name:'Open dashboard'})
  const selection = new URL(await open.getAttribute('href'),base)
  assert.equal(selection.searchParams.get('asset'),'btc')
  assert.equal(selection.searchParams.get('metric'),'inactive_365d')
  await open.press('Enter')
  await page.getByRole('heading',{name:'Inactive holdings',level:1}).waitFor()
  assert.equal(await page.locator('#metric').inputValue(),'inactive_365d')
  mark('Keyboard changes resource, question, preview and dashboard deep link')

  await page.locator('[data-zoom="12"]').click()
  const focused = page.locator('#chart0 [role=slider]')
  await focused.press('Home')
  const selected = param(page,'month')
  assert.equal(selected,param(page,'from'))
  const otherMonths = await page.locator('#additional .at-plot-readout time').evaluateAll(elements =>
    elements.map(el => el.getAttribute('datetime')))
  assert.ok(otherMonths.length >= 2 && otherMonths.every(month => month === selected))
  const shared = page.url()
  await page.goto(shared)
  await page.locator('#chart0 .at-plot-readout').waitFor()
  assert.equal(await page.locator('#chart0 time').getAttribute('datetime'),selected)
  const snapshot = await inspectSnapshot(page.request,'holdings')
  const track = snapshot.series.find(s => s.metric === 'inactive_365d')
  const shown = track.points.filter(([month]) => month >= param(page,'from') && month <= param(page,'to'))
  assert.equal(shown.length,12)
  const unitReadout = await focused.getAttribute('aria-valuetext')
  assert.match(unitReadout,/BTC/)
  assert.ok(unitReadout.includes(new Intl.NumberFormat('en',{maximumSignificantDigits:21}).format(shown[0][1])))
  await page.locator('#chart0 button[data-view="table"]').click()
  const tableRows = page.locator('#chart0 tbody tr')
  assert.equal(await tableRows.count(),shown.length)
  for (const [i,[month,value]] of [...shown].reverse().entries()) {
    assert.equal(await tableRows.nth(i).locator('time').getAttribute('datetime'),month)
    assert.equal(Number((await tableRows.nth(i).locator('td').innerText()).replaceAll(',','')),value)
  }
  const download = page.waitForEvent('download')
  await page.locator('#chart0 button[data-export]').click()
  const downloaded = await download
  assert.match(downloaded.suggestedFilename(),/inactive_365d.*csv$/)
  const csv = await readFile(await downloaded.path(),'utf8')
  assert.equal(csv.trim().split(/\r?\n/).length,shown.length+1)
  for (const [month,value] of shown) {
    const line = csv.split(/\r?\n/).find(s => s.startsWith('"'+month+'"'))
    assert.ok(line.includes('"inactive_365d","stock","BTC","'+value+'","observed"'))
  }
  mark('Filtered chart, table and downloaded CSV agree with actual observations; URL restores synchronized cursors')
  await page.locator('#reset').click()
  assert.equal(param(page,'from'),null)
  assert.equal(param(page,'month'),null)
  await page.locator('#metric').selectOption('revived_90d')
  assert.equal(param(page,'metric'),'revived_90d')
  assert.match(await page.locator('#chart0 h3').innerText(),/90 days/)
  mark('Reset and threshold navigation')

  await go(page,'?view=history&asset=btc&metric=history_gb','History growth')
  await page.locator('#chart0 .at-plot-line').waitFor()
  await fits(page)
  await photograph(page,'history-desktop')
  await go(page,'?view=circulation&asset=btc&metric=TxCnt','Circulation')
  const comp = page.locator('#compare')
  await comp.pressSequentially('ltc')
  await comp.press('Tab')
  await page.waitForURL(url => url.searchParams.get('compare') === 'ltc')
  const keys = page.locator('#chart0 [data-key]')
  assert.equal(await keys.count(),2)
  await keys.nth(1).click()
  assert.equal(await keys.nth(1).getAttribute('aria-pressed'),'false')
  await keys.nth(1).click()
  assert.equal(await keys.nth(1).getAttribute('aria-pressed'),'true')
  await go(page,'?view=history&asset=sol&metric=history_gb','History growth')
  await page.getByRole('heading',{name:/No verified observations/}).waitFor()
  mark('Compatible network comparison, legend and unavailable asset state')

  await go(page,'?view=concentration&asset=btc&metric=gini_grouped_floor','Holding concentration')
  await page.getByText('Research hypothesis',{exact:true}).waitFor()
  const firstDate = page.locator('[data-first]')
  await firstDate.selectOption({ index:1 })
  assert.equal(param(page,'lorenzFrom'),await firstDate.inputValue())
  await go(page,'?view=expiration&asset=xlm&metric=ttl_events','Expiration & renewal')
  const eventKind = page.locator('[data-id="event"]')
  await eventKind.selectOption('extension')
  assert.equal(param(page,'event'),'extension')
  await page.locator('[data-id="table"]').click()
  const stellar = await inspectSnapshot(page.request,'stellar')
  const expectedEvents = kind => stellar.events.filter(event => event.kind === kind).length
  assert.equal(await page.locator('#events table tbody tr').count(),Math.min(25,expectedEvents('extension')))
  await eventKind.selectOption('restoration')
  assert.equal(await page.locator('[data-id="csv"]').isDisabled(),expectedEvents('restoration')===0)
  await eventKind.selectOption('expiry')
  await page.getByText(/Sampling cannot establish this interval/).waitFor()
  assert.equal(await page.locator('[data-id="csv"]').isDisabled(),true)
  mark('Distribution date pair, hypothesis and Stellar observed/inferred event filters')

  await go(page,'?view=coverage','Data coverage')
  await page.getByRole('searchbox').first().fill('usdc_eth')
  await fits(page)
  assert.ok((await page.locator('main table').innerText()).match(/USDC/i))
  await page.locator('#locale').selectOption('it')
  assert.equal(await page.locator('html').getAttribute('lang'),'it')
  mark('Coverage search and language switch')

  const mobile = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1})
  const phone = await mobile.newPage()
  watch(phone)
  await go(phone,'',/The persistence atlas/i)
  await phone.locator('#home-chart .at-plot-line').waitFor()
  await fits(phone)
  await photograph(phone,'home-mobile')
  const resource = phone.locator('#resource-select')
  await resource.selectOption('inactive')
  await phone.getByRole('link',{name:'Open dashboard'}).tap()
  await phone.getByRole('heading',{name:'Inactive holdings',level:1}).waitFor()
  await fits(phone)
  const touchChart = phone.locator('#chart0 [role=slider]')
  await touchChart.tap({position:{x:30,y:40}})
  assert.ok(param(phone,'month'))
  await go(phone,'?view=history&asset=btc&metric=history_gb','History growth')
  await phone.locator('#chart0 .at-plot-line').waitFor()
  await photograph(phone,'history-mobile')
  await phone.locator('#chart0 [role=slider]').tap({position:{x:45,y:45}})
  await photograph(phone,'history-mobile-detail')
  await fits(phone)
  await phone.setViewportSize({width:320,height:740})
  await fits(phone)
  await mobile.close()
  mark('390 px touch interaction, 320 px width and desktop/mobile screenshots')
  assert.deepEqual(errors,[])
  assert.deepEqual(archiveRequests,[])
  mark('Zero runtime errors and zero dynamic archive API calls')
} finally {
  await browser.close()
}
