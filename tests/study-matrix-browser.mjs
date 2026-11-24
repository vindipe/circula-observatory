import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const origin=process.env.OBSERVATORY_URL||'http://127.0.0.1:8787'
const folder='.cache/screenshots'
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']})
const initial=new URL('/?view=matrix&lang=it',origin).href
const errors=[]
const csvIds=contents=>[...new Set(contents.trim().split('\r\n').slice(1).map(row=>row.split('","')[0].slice(1)))]
async function waitCount(page,count) {
  await page.waitForFunction(expected=>document.querySelector('[data-count]')?.textContent?.startsWith(expected+' '),count)
}
async function fits(page) {
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'viewport overflow')
}
async function dateChange(page,side,value) {
  await page.locator('[data-day="'+side+'"]').selectOption(value)
  await page.waitForFunction(([side,val])=>document.querySelector('[data-day="'+side+'"]')?.value===val && document.querySelector('[data-count]'),[side,value])
}
try {
  await mkdir(folder,{recursive:true})
  const ctx=await browser.newContext({viewport:{width:1440,height:1040},acceptDownloads:true})
  const page=await ctx.newPage()
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(initial)
  await waitCount(page,75)
  await fits(page)
  await page.evaluate(()=>document.fonts.ready)
  await page.screenshot({path:folder+'/atlas-matrix-desktop.png',animations:'disabled'})
  const firstPage=page.locator('[data-row]')
  const ids=[]
  while (true) {
    ids.push(...await firstPage.evaluateAll(rows=>rows.map(r=>r.dataset.row)))
    const next=page.locator('[data-page="1"]')
    if(await next.isDisabled())break
    await next.click()
  }
  assert.equal(ids.length,75)
  const download=page.waitForEvent('download')
  await page.locator('[data-export]').click()
  const file=await download
  assert.deepEqual(csvIds(await readFile(await file.path(),'utf8')),ids)
  await page.locator('[data-indicator="blocks"]').focus()
  await page.keyboard.press('Space')
  await waitCount(page,17)
  await page.locator('[data-indicator="ledgerBytes"]').check()
  await waitCount(page,0)
  await page.locator('[data-mode]').selectOption('partial')
  assert.notEqual(await page.locator('[data-count]').innerText(),'0 ID visualizzati · 0 con coppie complete')
  await page.locator('[data-search]').fill('usdc_eth')
  await waitCount(page,1)
  await page.locator('[data-row="usdc_eth"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('.mx-detail-panel').waitFor()
  assert.match(await page.locator('.mx-detail-panel').innerText(),/Ethereum/)
  assert.match(await page.locator('.mx-detail-panel').innerText(),/Non applicabile/)
  const share=page.url()
  await page.goto(share)
  await page.locator('.mx-detail-panel').waitFor()
  assert.equal(await page.locator('[data-search]').inputValue(),'usdc_eth')
  await page.locator('[data-search]').fill('')
  await page.locator('[data-common]').click()
  await page.locator('[data-mode]').selectOption('complete')
  await page.locator('[data-sample="current"]').click()
  await page.locator('[data-count]').waitFor()
  await page.locator('[data-sample="custom"]').click()
  await page.locator('[data-day="baseline"]').waitFor()
  await dateChange(page,'baseline','2024-02-29')
  await dateChange(page,'cutoff','2026-10-31')
  await waitCount(page,115)
  const link=page.url()
  await page.reload()
  await waitCount(page,115)
  assert.equal(page.url(),link)
  if(!await page.locator('[data-row="btc"]').count())await page.locator('[data-search]').fill('btc')
  await page.locator('[data-row="btc"]').click()
  const href=await page.locator('.mx-item a[data-atlas]').first().getAttribute('href')
  assert.equal(new URL(href,origin).searchParams.get('from'),'2024-02')
  await page.close()
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1})
  const touch=await mobile.newPage()
  touch.on('pageerror',error=>errors.push(error.message))
  await touch.goto(initial)
  await waitCount(touch,75)
  await fits(touch)
  await touch.evaluate(()=>document.fonts.ready)
  await touch.screenshot({path:folder+'/atlas-matrix-mobile.png',animations:'disabled'})
  await touch.locator('[data-picker] > summary').tap()
  await touch.locator('[data-indicator="blocks"]').tap()
  await waitCount(touch,17)
  await touch.locator('[data-search]').fill('btc')
  await touch.locator('[data-row="btc"]').tap()
  await touch.locator('.mx-detail-panel').waitFor()
  await fits(touch)
  assert.deepEqual(errors,[])
  console.log('PASS frozen intersections, window recomputation, partial scope, observed inputs, URL, native download ID parity across four pages, keyboard, mobile touch and viewport.')
} finally {
  await browser.close()
}
