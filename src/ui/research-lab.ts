import { ARRIVALS, COHORT_READS, LAB_DAYS, policies, retentionExperiment, type Outcome, type Policy } from '../shared/research'
import { icon } from './art'
import { esc, link, number, select } from './html'
import { bindSignalPlot, replaceStudyFilters, signalPlot, type SignalPlot, type SignalTrack } from './signal-plot'

const policyCopy: Record<Policy, { label: string; tone: SignalTrack['tone']; description: string }> = {
  keep: { label: 'No expiry', tone: 'green', description: 'Entries remain in active state.' },
  archive: { label: 'Archive at expiry', tone: 'cyan', description: 'A read restores the entry and restarts its TTL.' },
  remove: { label: 'Remove at expiry', tone: 'amber', description: 'A later read of the entry fails.' },
}
const labels = Array.from({ length: LAB_DAYS + 1 }, (_, day) => 'Day ' + day)

function integerParam(value: string | null, min: number, max: number, fallback: number) {
  if (value === null || !/^\d+$/.test(value)) return fallback
  return Math.min(max, Math.max(min, Number(value)))
}

function labRange(id: string, label: string, value: number) {
  return '<div class="lab-range"><label for="lab-' + id + '">' + esc(label) + '</label>'
    + '<output for="lab-' + id + '" data-lab-output="' + id + '">' + value + ' days</output>'
    + '<input type="range" id="lab-' + id + '" name="' + id + '" min="7" max="56" value="' + value + '"></div>'
}

function outcomeCard(policy: Policy, outcome: Outcome, created: number) {
  const copy = policyCopy[policy]
  const bar = (['active', 'archived', 'removed'] as const).map(state =>
    '<i class="lab-bar-' + state + '" style="width:' + (created ? (outcome[state] / created) * 100 : 0) + '%"></i>').join('')
  const cell = (name: string, data: number, state = '') => '<div' + (state ? ' class="lab-count-' + state + '"' : '') + '><dt>' + name + '</dt><dd>' + number(data) + '</dd></div>'
  return '<section class="lab-outcome panel tone-' + copy.tone + '" aria-label="' + esc(copy.label) + '">'
    + '<h3><span class="lab-swatch"></span>' + esc(copy.label) + '</h3><p>' + esc(copy.description) + '</p>'
    + '<div class="lab-bar" aria-hidden="true">' + bar + '</div><dl class="lab-outcome-counts">'
    + cell('Active', outcome.active, 'active') + cell('Archived', outcome.archived, 'archived') + cell('Removed', outcome.removed, 'removed')
    + cell('Reads served', outcome.reads - outcome.misses) + cell('Restored', outcome.restored) + cell('Missed reads', outcome.misses) + '</dl></section>'
}

export function researchLab(params: URLSearchParams) {
  let ttl = integerParam(params.get('ttl'), 7, 56, 21)
  let readAfter = integerParam(params.get('read'), 7, 56, 28)
  let day = integerParam(params.get('day'), 0, LAB_DAYS, LAB_DAYS)
  let metric: 'active' | 'misses' = params.get('metric') === 'misses' ? 'misses' : 'active'
  const requested = params.get('lines')?.split(',')
  const visible = new Set(policies.filter(policy => !requested || requested.includes(policy)))
  const markup = '<section class="signal-panel panel" id="policy-lab" aria-labelledby="policy-title" tabindex="-1">'
    + '<header class="signal-head lab-head"><div><p class="kicker lab-tag">Simulation · fixed workload</p>'
    + '<h2 id="policy-title">What changes if entries expire?</h2><p>Run the same workload under three retention policies. Change when entries expire and when they are needed again.</p></div></header>'
    + '<div class="lab-layout"><aside class="lab-controls"><h3>Experiment settings</h3>'
    + labRange('ttl', 'Time to live', ttl) + labRange('read', 'Read at age', readAfter)
    + '<p class="lab-rule" data-lab-rule></p>'
    + '<details class="lab-assumptions"><summary>Workload assumptions</summary><p>' + ARRIVALS + ' entries arrive on each of ' + LAB_DAYS + ' days. '
    + COHORT_READS + ' entries per daily cohort get one read at the chosen age. The model applies expiry before reads. A restored entry gets the same TTL again. Ordinary reads leave the expiry unchanged. Each entry is one object.</p></details></aside>'
    + '<div class="lab-graph"><div class="lab-graph-top">' + select('metric', 'Plot', [['active', 'Active entries'], ['misses', 'Cumulative missed reads']], metric)
    + '<fieldset class="lab-legend"><legend class="sr">Policies in the plot</legend>' + policies.map(policy => '<label class="tone-' + policyCopy[policy].tone
      + '"><input type="checkbox" name="policy-line" value="' + policy + '"' + (visible.has(policy) ? ' checked' : '') + '>'
      + '<i class="lab-swatch" aria-hidden="true"></i>' + esc(policyCopy[policy].label) + '</label>').join('') + '</fieldset></div>'
    + '<div data-lab-plot></div></div></div></section>'
    + '<section class="lab-outcomes" aria-labelledby="lab-outcomes-title"><div class="lab-outcomes-head"><h2 id="lab-outcomes-title">State at day <span data-lab-day></span></h2>'
    + '<p class="muted"><span data-lab-created></span> entries created. Read outcomes are cumulative.</p></div><div class="lab-outcome-grid" data-lab-outcomes></div></section>'
    + '<p class="lab-foot muted">This model treats object count as state. Measuring disk usage, access latency or network behaviour requires workloads run on named client configurations. '
    + link('/research?resource=state', 'Read the real contract rules ' + icon('arrow', 14), 'text-link') + '</p>'
  return { markup, bind(root: HTMLElement) {
    const chart = root.querySelector<HTMLElement>('[data-lab-plot]')!
    const outcomes = root.querySelector<HTMLElement>('[data-lab-outcomes]')!
    const dayOutput = root.querySelector<HTMLElement>('[data-lab-day]')!
    const createdOutput = root.querySelector<HTMLElement>('[data-lab-created]')!
    const rule = root.querySelector<HTMLElement>('[data-lab-rule]')!
    const renderPlot = () => {
      const model = retentionExperiment(ttl, readAfter)
      const isActive = metric === 'active'
      const plot: SignalPlot = { label: isActive ? 'Active entries under three retention policies by day' : 'Cumulative missed reads under three retention policies by day',
        cursorLabel: 'Inspect a simulated day', labels, shortLabels: labels,
        maximum: isActive ? LAB_DAYS * ARRIVALS : LAB_DAYS * COHORT_READS,
        tracks: policies.filter(policy => visible.has(policy)).map(policy => ({ label: policyCopy[policy].label, tone: policyCopy[policy].tone,
          values: model.map(item => item.outcomes[policy][metric]) })),
        format: value => number(value) + (isActive ? ' entries' : ' missed reads') }
      chart.innerHTML = visible.size ? signalPlot(plot, day) : '<p class="lab-empty-plot" role="status">Select a policy to show its line.</p>'
      rule.textContent = ttl <= readAfter
        ? 'The chosen reads happen after expiry has taken effect.' : 'The chosen reads happen while their entries are still active.'
      const updateOutcomes = (selected: number) => {
        if (day !== selected) replaceStudyFilters({ day: String(selected) })
        day = selected
        const result = model[day]
        dayOutput.textContent = String(day)
        createdOutput.textContent = number(result.created)
        outcomes.innerHTML = policies.map(policy => outcomeCard(policy, result.outcomes[policy], result.created)).join('')
      }
      if (visible.size) bindSignalPlot(chart, plot, day, updateOutcomes)
      else updateOutcomes(day)
    }
    for (const control of root.querySelectorAll<HTMLInputElement>('.lab-range input')) {
      const output = root.querySelector<HTMLOutputElement>('[data-lab-output="' + control.name + '"]')!
      control.setAttribute('aria-valuetext', output.value)
      control.addEventListener('input', () => {
        const value = Number(control.value)
        if (control.name === 'ttl') ttl = value
        else readAfter = value
        output.value = value + ' days'
        control.setAttribute('aria-valuetext', output.value)
        replaceStudyFilters({ [control.name]: control.value })
        renderPlot()
      })
    }
    const measure = root.querySelector('.lab-graph-top select')
    if (!(measure instanceof HTMLSelectElement)) throw new Error('Policy lab plot control is missing')
    measure.addEventListener('change', () => {
      metric = measure.value === 'misses' ? 'misses' : 'active'
      replaceStudyFilters({ metric })
      renderPlot()
    })
    for (const input of root.querySelectorAll<HTMLInputElement>('[name="policy-line"]')) {
      input.addEventListener('change', () => {
        const policy = policies.find(id => id === input.value)!
        if (input.checked) visible.add(policy)
        else visible.delete(policy)
        replaceStudyFilters({ lines: visible.size === policies.length ? null : policies.filter(id => visible.has(id)).join(',') || 'none' })
        renderPlot()
      })
    }
    renderPlot()
  } }
}
