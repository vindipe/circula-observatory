import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH, args:['--no-sandbox']})
try {
  const page = await browser.newPage()
  const externalRequests = []
  page.on('request',request => {
    if (/^https?:/.test(request.url())) externalRequests.push(request.url())
  })
  await page.goto(pathToFileURL(resolve(process.argv[2])).href)
  await page.getByRole('heading',{name:/The persistence atlas/i}).waitFor()
  await page.locator('[data-resource="inactive"]').press('Enter')
  await page.locator('.a-feature-foot .a-button').click()
  await page.getByRole('heading',{name:'Inactive holdings',level:1}).waitFor()
  await page.reload()
  await page.getByRole('heading',{name:'Inactive holdings',level:1}).waitFor()
  await page.locator('#chart0 button[data-view="table"]').click()
  assert.ok(await page.locator('#chart0 tbody tr').count() > 1)
  await page.getByRole('link',{name:'Study matrix',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('[data-count]')?.textContent?.startsWith('75 '))
  await page.locator('[data-sample="custom"]').click()
  await page.locator('[data-day="baseline"]').waitFor()
  await page.getByRole('link',{name:'Atlas',exact:true}).first().click()
  await page.locator('[data-resource="balances"]').press('Enter')
  await page.locator('.a-feature-foot .a-button').click()
  await page.locator('#study-metric').waitFor()
  assert.equal(await page.locator('#study-metric').inputValue(),'inactiveFloor')
  await page.reload()
  await page.locator('#study-metric').waitFor()
  assert.deepEqual(externalRequests,[])
  console.log('Offline HTML loads, navigates, reloads and renders the table without network requests.')
} finally {
  await browser.close()
}
