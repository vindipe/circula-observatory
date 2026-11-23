import type { Kind, Perspective } from '../shared/model'

// Independent labels give additional locales a single entry point. Source
// definitions in shared/metrics and recorded entity names retain their origin.
export const en = {
  nav: [['/', 'Overview'], ['/explorer', 'Explorer'], ['/compare', 'Compare'], ['/methods', 'Methods & data'], ['/status', 'Data status']],
  tagline: 'Explore how digital resources accumulate, persist, circulate and expire.',
  network: 'Networks',
  asset: 'Assets',
  protocol: 'Protocols',
  system: 'Traditional systems',
  verified: 'Measured',
  catalog: 'Catalogued',
  noData: 'No observations for this selection.',
  missing: 'Unavailable',
  shares: 'Copy link',
  copied: 'Link copied',
  from: 'From',
  to: 'To',
  status: 'Archive status',
  dateLabel: 'Observation date',
  find: 'Search by name, symbol or ID',
} as const

export const labels: Record<Kind, string> = {
  network: 'Network', asset: 'Asset', protocol: 'Protocol', system: 'Traditional system',
}

export const lens: Record<Perspective, { title: string; summary: string; caption: string; description: string; color: string; tag: string }> = {
  accumulate: {
    title: 'Accumulate', summary: 'What builds up over time?',
    caption: 'Ledger objects gather in layers as new records are written.',
    description: 'Follow new records, outstanding supply and balances.',
    color: '#bef493', tag: 'Records & holdings',
  },
  persist: {
    title: 'Persist', summary: 'What stays available?',
    caption: 'An entry endures inside layers of retained state.',
    description: 'Measure how long observed state has gone unchanged.',
    color: '#8edcc1', tag: 'Retained state',
  },
  circulate: {
    title: 'Circulate', summary: 'What moves, and where?',
    caption: 'A record of a transfer traces a path between distinct endpoints.',
    description: 'Trace activity, transfer events and labelled exchange flows.',
    color: '#b6a9ff', tag: 'Transfers & activity',
  },
  expire: {
    title: 'Expire', summary: 'When does validity end?',
    caption: 'A time-limited entry moves out of the active set when its lifetime ends.',
    description: 'Inspect remaining validity for selected live contract entries.',
    color: '#f3c792', tag: 'Validity & lifecycle',
  },
}

export const categories = [
  ['ledger', 'Ledger data'],
  ['holdings', 'Supply & balances'],
  ['contract-state', 'Contract state'],
  ['value-flows', 'Activity & flows'],
  ['web-traffic', 'Web traffic'],
] as const
