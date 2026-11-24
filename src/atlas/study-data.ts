import type { ResearchSnapshot } from './study-types'

type Sample = 'frozen' | 'current'
type StudyFile = Sample | 'series'
type Release = {schema: number; release: string; files: Record<StudyFile,string>}
declare global {
  interface Window { __studySnapshots?: Record<Sample,ResearchSnapshot> }
}
let pointer: Promise<Release | undefined> | undefined
const pending = new Map<Sample,Promise<ResearchSnapshot>>()
async function readPointer(): Promise<Release | undefined> {
  const response = await fetch('/atlas/study-release.json', {cache:'no-cache'})
  if (response.status === 404 || (response.ok && response.headers.get('content-type')?.includes('text/html'))) return undefined
  if (!response.ok) throw Error('Research release unavailable')
  const doc: Release = await response.json()
  if (doc.schema !== 1 || !/^[a-f0-9]{64}$/.test(doc.release) ||
    (['frozen','current','series'] as const).some(key => doc.files?.[key] !== '/atlas/study-releases/' + doc.release + '/study-' + key + '.json')) {
    throw Error('Invalid research release')
  }
  return doc
}
export async function studyFileUrl(key: StudyFile) {
  pointer ??= readPointer().catch(error => {pointer = undefined; throw error})
  return (await pointer)?.files[key] ?? '/atlas/study-' + key + '.json'
}
export async function loadStudy(sample: Sample): Promise<ResearchSnapshot> {
  const embedded = window.__studySnapshots?.[sample]
  if (embedded) return embedded
  let request = pending.get(sample)
  if (!request) {
    request = studyFileUrl(sample).then(async path => {
      const response = await fetch(path)
      if (!response.ok) throw Error('Missing research snapshot')
      const snapshot = await response.json() as ResearchSnapshot
      if (!snapshot.assets?.btc || !snapshot.baselineUtc || !snapshot.cutoffUtc) throw Error('Invalid research snapshot')
      return snapshot
    }).catch(error => {pending.delete(sample); throw error})
    pending.set(sample, request)
  }
  return request
}
