import { mkdir, writeFile } from 'node:fs/promises'
import { daysAgo, type Point } from '../src/shared/model'
import { coinAsset, putEntities, registryStatements, statement, stellarKeys, tokenRelations, wikiProjects, type Sql } from '../src/worker/catalog'
import { pointStatements } from '../src/worker/archive'
import { coinPlan } from '../src/worker/collect'
import { coinAvailability, coinCatalogPage, coinSeries, evmSeries, getRegistry, solanaSeries, stellarSeries, validCoin, validPublicNode, wikiSeries } from '../src/worker/sources'

const ago = Math.min(120, Math.max(14, Number(process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1]) || 60))
const now = Date.now()
const from = daysAgo(ago, now)
const to = daysAgo(1, now)
const file = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? '.cache/bootstrap.sql'
const sql: Sql[] = []
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
let coinLast = 0

async function coinRequest<T>(fn: () => Promise<T>) {
  await sleep(Math.max(0, coinLast + 690 - Date.now()))
  coinLast = Date.now()
  return fn()
}

const quote = (value: Sql['args'][number]) => value === null ? 'NULL'
  : typeof value === 'number' ? String(value) : "'" + value.replaceAll("'", "''") + "'"

function render(query: Sql) {
  let arg = 0
  const output = query.sql.replaceAll('?', () => quote(query.args[arg++]))
  if (arg !== query.args.length) throw new Error('Incorrect SQL bind count')
  return output.trim() + ';'
}

function saveRun(job: string, source: string, started: string, points: number, good: boolean, note: string) {
  const finished = new Date().toISOString()
  sql.push(statement(
    "INSERT INTO runs(job_id,source,trigger,started_at,finished_at,status,row_count,note) VALUES (?,?,'bootstrap',?,?,?,?,?)",
    job, source, started, finished, good ? 'ok' : 'error', points, note,
  ))
  if (good) sql.push(statement('UPDATE jobs SET last_success=?,next_at=?+cadence_minutes*60000 WHERE id=?', finished, Date.now(), job))
}

async function seedSeries(job: string, source: string, load: () => Promise<Point[]>) {
  const started = new Date().toISOString()
  try {
    const points = await load()
    for (let start = 0; start < points.length; start += 180) {
      sql.push(...pointStatements(points.slice(start, start + 180)))
    }
    saveRun(job, source, started, points.length, points.length > 0, points.length ? 'Initial archive import.' : 'No data in the requested dates.')
    return points.length
  } catch (error) {
    console.warn(job, error instanceof Error ? error.message : error)
    saveRun(job, source, started, 0, false, 'Initial source probe failed. Scheduled collection can retry.')
    return 0
  }
}

const coinStarted = new Date().toISOString()
const [registry, availability] = await Promise.all([getRegistry(), coinRequest(coinAvailability)])
const entries = JSON.parse(registry.replace(/"chainId"\s*:\s*(\d+)/g, '"chainId":"$1"')) as { chainId: string; name: string; rpc?: string[]; status?: string }[]
// Split the registry at object boundaries without reserializing numeric EIP-155
// IDs, including IDs that do not fit exactly in a JavaScript Number.
let registryChunk: string[] = []
let registryBytes = 0
function flushRegistry() {
  if (registryChunk.length) sql.push(...registryStatements('[' + registryChunk.join(',') + ']', now))
  registryChunk = []
  registryBytes = 0
}
for (const entry of entries) {
  const object = JSON.stringify(entry).replace(/"chainId":"(\d+)"/g, '"chainId":$1')
  if (registryBytes + Buffer.byteLength(object) > 38_000) flushRegistry()
  registryChunk.push(object)
  registryBytes += Buffer.byteLength(object)
}
flushRegistry()
saveRun('evm-registry', 'evm-registry', coinStarted, 0, true, entries.length + ' EVM chain records checked.')

let cursor: string | undefined
const names = new Map<string, string>()
do {
  const page = await coinRequest(() => coinCatalogPage(cursor))
  const rows = page.data.filter(item => validCoin(item.asset) && item.full_name)
  for (const item of rows) names.set(item.asset, item.full_name)
  const assets = rows.map(item => coinAsset(item.asset, item.full_name))
  sql.push(putEntities(assets), tokenRelations(assets))
  cursor = page.next_page_token
} while (cursor)
saveRun('coin-catalog', 'coin', coinStarted, 0, true, names.size + ' asset records checked.')

const plan = coinPlan(availability, now, names)
sql.push(...plan.statements)
saveRun('coin-plan', 'coin', coinStarted, 0, true, plan.shards.length + ' Community series shards registered.')
console.log('Catalog:', entries.length, 'EVM network records,', names.size, 'Coin Metrics asset records.')

const otherTasks = [
  ...wikiProjects.map(project => ['wiki-' + project.id.split(':')[1], 'wikimedia',
    () => wikiSeries(project.id, project.project, from, to)] as const),
  ['stellar-contracts', 'stellar', stellarSeries] as const,
  ['solana-supply', 'solana', solanaSeries] as const,
  ...entries.flatMap(chain => {
    const endpoint = chain.rpc?.filter(validPublicNode).sort()[0]
    if (!endpoint || chain.status === 'deprecated' || /testnet|sepolia|goerli|holesky|mumbai|amoy/i.test(chain.name)) return []
    return [[
      'evm:' + chain.chainId, 'evm-rpc', () => evmSeries('eip155:' + chain.chainId, endpoint),
    ] as const]
  }),
]
let otherTotal = 0
const otherWork = (async () => {
  for (let i = 0; i < otherTasks.length; i += 4) {
    const counts = await Promise.all(otherTasks.slice(i, i + 4).map(([job, source, load]) => seedSeries(job, source, load)))
    otherTotal += counts.reduce((sum, count) => sum + count, 0)
  }
})()

let coinTotal = 0
for (const shard of plan.shards) {
  coinTotal += await seedSeries(shard.id, 'coin', () => coinRequest(
    () => coinSeries(shard.payload.metric, shard.payload.targets, from, to),
  ))
}
await otherWork
const output = sql.map(render).join('\n') + '\n'
if (file.includes('/')) await mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true })
await writeFile(file, output)
console.log('Initial archive:', coinTotal, 'Coin Metrics observations and', otherTotal, 'other observations written to', file)
console.log('Apply the schema, then import with: npx wrangler d1 execute DB --local --file ' + file)
console.log('Stellar cohort:', stellarKeys.map(item => item.name).join(', '))
