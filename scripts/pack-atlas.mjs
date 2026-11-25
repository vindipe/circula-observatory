#!/usr/bin/env node
/** Bundle the same Atlas entry and snapshot into one file for offline peer review. */
import { build } from 'esbuild'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = process.argv[2]
if (!output || process.argv.length !== 3 || !output.toLowerCase().endsWith('.html')) {
  throw new Error('Usage: node scripts/pack-atlas.mjs path/to/preview.html')
}
const providers = ['history', 'holdings', 'distribution', 'stellar', 'community']
const publicDir = join(root, 'public')
let manifest
try {
  manifest = JSON.parse(await readFile(join(publicDir, 'atlas/current.json'), 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
if (manifest && (manifest.schema !== 1 || !/^[a-f0-9]{64}$/.test(manifest.release) ||
    providers.some(provider => manifest.files?.[provider] !== `/atlas/releases/${manifest.release}/${provider}.json`))) {
  throw new Error('Invalid release pointer. Refusing to package mixed snapshots.')
}

async function embedSnapshot() {
  const entries = await Promise.all(providers.map(async provider => {
    const path = manifest?.files[provider] ?? `/atlas/${provider}.json`
    const snapshot = JSON.parse(await readFile(join(publicDir, path), 'utf8'))
    if (!Array.isArray(snapshot.series) || !Array.isArray(snapshot.unavailable)) {
      throw new Error('Snapshot lacks data or coverage status: ' + provider)
    }
    return [provider, snapshot]
  }))
  let studyPointer
  try {
    studyPointer = JSON.parse(await readFile(join(publicDir, 'atlas/study-release.json'), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const study = {}
  for (const key of ['frozen','current','series']) {
    const file = studyPointer?.files[key] ?? '/atlas/study-' + key + '.json'
    if (studyPointer && (!/^[a-f0-9]{64}$/.test(studyPointer.release) ||
        file !== '/atlas/study-releases/' + studyPointer.release + '/study-' + key + '.json')) throw Error('Invalid study release pointer')
    study[key] = JSON.parse(await readFile(join(publicDir, file), 'utf8'))
  }
  if (study.current.cutoffUtc !== study.series.cutoffUtc) throw Error('Mismatched study cutoffs')
  const [audit,data] = await Promise.all(['audit','series'].map(async key =>
    JSON.parse(gunzipSync(await readFile(join(publicDir, 'atlas/indicator-' + key + '.json.gz'))))))
  if (audit.cutoff !== data.cutoff || audit.asOf !== data.asOf) throw Error('Mismatched indicator catalogue cutoffs')
  const payload = {atlas:Object.fromEntries(entries),samples:{current:study.current,frozen:study.frozen},months:study.series,
    indicatorCatalogue:{audit,data}}
  return gzipSync(Buffer.from(JSON.stringify(payload)), {level:9}).toString('base64')
}

const [bundle, snapshot, template, favicon] = await Promise.all([
  build({
    absWorkingDir:root,
    entryPoints:['src/atlas/app.ts'],
    outfile:'atlas.js',
    bundle:true,
    minify:true,
    target:'es2022',
    format:'iife',
    write:false,
    legalComments:'inline',
    loader:{'.woff':'dataurl','.woff2':'dataurl','.svg':'dataurl','.png':'dataurl'},
  }),
  embedSnapshot(),
  readFile(join(root, 'index.html'), 'utf8'),
  readFile(join(publicDir, 'favicon.svg')),
])
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text
const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text
const skip = template.match(/<a\b[^>]*class="skip"[^>]*>[\s\S]*?<\/a>/)?.[0]
const app = template.match(/<div\s+id="app"\s*><\/div>/)?.[0]
if (!skip || !app) throw new Error('The Atlas shell changed. Check the skip link and mount element.')

// Some browsers restrict history changes to fragments for local files. The app continues
// to see its usual query interface, and the real document retains a reloadable URL.
const offlineRouter = `
const nativeURL = window.location;
const nativeHistory = window.history;
const hierarchical = ['file:', 'http:', 'https:'].includes(nativeURL.protocol);
const defaultBase = 'https://circula-preview.invalid/atlas';
const embeddedBase = /^(https?:|file:)/.test(document.baseURI) ? document.baseURI : defaultBase;
const base = new URL(hierarchical ? nativeURL.href : embeddedBase);
let ephemeral = null;
function routeURL() {
  const result = new URL(hierarchical ? nativeURL.href : base.href);
  if (ephemeral !== null || nativeURL.hash.startsWith('#?')) result.search = ephemeral ?? nativeURL.hash.slice(1);
  result.hash = '';
  return result;
}
const location = {
  get href() { return routeURL().href },
  get search() { return routeURL().search },
  get pathname() { return hierarchical ? base.pathname : base.href.split(/[?#]/)[0] },
  get protocol() { return nativeURL.protocol },
  get origin() { return nativeURL.origin }
};
function setRoute(method, state, title, target) {
  const next = new URL(target ?? routeURL().href, routeURL().href);
  if (next.pathname !== base.pathname || next.origin !== base.origin) throw new Error('Invalid local route');
  try {
    nativeHistory[method](state, title, '#?' + next.searchParams);
    ephemeral = null;
  } catch {
    ephemeral = next.search;
  }
}
const history = {
  get state() { return nativeHistory.state },
  pushState(...args) { setRoute('pushState', ...args) },
  replaceState(...args) { setRoute('replaceState', ...args) }
};
{
  window.addEventListener('popstate', () => { ephemeral = null });
  document.querySelector('.skip').addEventListener('click', event => {
    event.preventDefault(); const main = document.getElementById('main');
    if (main) { main.focus(); main.scrollIntoView(); }
  });
}`

const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f5f7f2"><meta name="description" content="Explore how blockchain resources accumulate, persist, circulate and expire.">
<link rel="icon" href="data:image/svg+xml;base64,${favicon.toString('base64')}"><title>CIRCULA Observatory</title>
<style>${css.replace(/<\/style/gi,'<\\/style')}</style></head>
<body>${skip}${app}<noscript>Enable JavaScript to explore the Atlas.</noscript>
<script id="atlas-snapshot" type="application/octet-stream">${snapshot}</script>
<script>(async () => {
const compressed = Uint8Array.from(atob(document.getElementById('atlas-snapshot').textContent), c => c.charCodeAt(0));
const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
const payload = await new Response(stream).json();
window.__atlas = payload.atlas;
window.__studySnapshots = payload.samples;
window.__studyMonths = payload.months;
window.__indicatorCatalogue = payload.indicatorCatalogue;
document.getElementById('atlas-snapshot').remove();
${offlineRouter}
${js.replace(/<\/script/gi,'<\\/script')}
})().catch(error => { console.error(error); document.getElementById('app').textContent='The offline Atlas could not open. Use a current browser with gzip decompression support.'; });</script>
</body></html>\n`

const target = resolve(output)
await mkdir(dirname(target), {recursive:true})
const tmp = join(dirname(target), '.' + basename(target) + '.' + process.pid + '.tmp')
try {
  await writeFile(tmp, html, {flag:'wx'})
  await rename(tmp,target)
} finally {
  await rm(tmp, {force:true})
}
console.log(`Standalone Atlas: ${target} (${Buffer.byteLength(html).toLocaleString('en')} bytes)`)
