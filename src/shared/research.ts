export type BlockSample = [height: number, timestamp: number, bytes: number, hash: string, parent: string]
export type UtxoSample = [day: string, outputs: number]
export type SpentSample = [day: string, allSats: number, oneYear: number, threeYears: number, fiveYears: number, tenYears: number]
export type HoldingsSample = [day: string, addresses: number, supply: string]

export const ageChoices = ['1', '3', '5', '10'] as const
export type AgeThreshold = typeof ageChoices[number]
const bandIndex = { '1': 2, '3': 3, '5': 4, '10': 5 } as const

export function satsToBtc(sats: number) {
  const digits = String(sats).padStart(9, '0')
  return digits.slice(0, -8) + '.' + digits.slice(-8)
}

export function spentAge(row: SpentSample, threshold: AgeThreshold) {
  const sats = row[bandIndex[threshold]]
  return { sats, share: row[1] === 0 ? null : sats / row[1] }
}

export function blockWindows(rows: BlockSample[], range: number) {
  const blocks = rows.slice(-range)
  let cumulative = 0
  const windows = []
  for (let i = 0; i < blocks.length; i += 15) {
    const bucket = blocks.slice(i, i + 15)
    const end = bucket.at(-1)!
    const bytes = bucket.reduce((total, row) => total + row[2], 0)
    cumulative += bytes
    windows.push({ from: bucket[0][0], to: end[0], timestamp: end[1], bytes, cumulative, hash: end[3] })
  }
  return windows
}

export const LAB_DAYS = 84
export const ARRIVALS = 10
export const COHORT_READS = 3
export const policies = ['keep', 'archive', 'remove'] as const
export type Policy = typeof policies[number]

export interface Outcome {
  active: number
  archived: number
  removed: number
  reads: number
  restored: number
  misses: number
}

export function retentionExperiment(ttl: number, readAfter: number) {
  return Array.from({ length: LAB_DAYS + 1 }, (_, day) => {
    const created = day * ARRIVALS
    const reads = Math.max(0, day - readAfter) * COHORT_READS
    const stateWithinTtl = Math.min(day, ttl) * ARRIVALS
    const expiredBeforeRead = ttl <= readAfter
    const restored = expiredBeforeRead ? reads : 0
    const stillActiveAfterRestore = Math.min(Math.max(0, day - readAfter), ttl) * COHORT_READS
    const activeWithArchive = stateWithinTtl + (expiredBeforeRead ? stillActiveAfterRestore : 0)
    const outcomes: Record<Policy, Outcome> = {
      keep: { active: created, archived: 0, removed: 0, reads, restored: 0, misses: 0 },
      archive: { active: activeWithArchive, archived: created - activeWithArchive, removed: 0, reads, restored, misses: 0 },
      remove: { active: stateWithinTtl, archived: 0, removed: created - stateWithinTtl, reads, restored: 0, misses: restored },
    }
    return { day, created, outcomes }
  })
}
