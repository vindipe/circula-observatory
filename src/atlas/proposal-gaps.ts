import { esc } from '../ui/html'
import { langs, type Lang } from './copy'
import { studyText } from './study-labels'
import type { ResearchSnapshot, StudyObservation } from './study-types'

const measures = [
  ['unspentOutputs','UTXOCnt',['Unspent output count','Numero di output non spesi','Nombre de sorties non dépensées','Anzahl nicht ausgegebener Outputs']],
  ['contractCount','ContCnt',['Contract count','Numero di contratti','Nombre de contrats','Anzahl der Verträge']],
  ['topDecileShare','SplyAdrTop10Pct',['Share at the richest 10% of addresses','Quota del 10% di indirizzi con saldo più elevato','Part des 10 % d’adresses les plus riches','Anteil der reichsten 10 % der Adressen']],
  ['inactive1d','SplyCur − SplyAct1d',['Inactive native units · 1 day','Unità native inattive · 1 giorno','Unités natives inactives · 1 jour','Inaktive native Einheiten · 1 Tag']],
  ['inactive1yr','SplyCur − SplyAct1yr',['Inactive native units · 1 year','Unità native inattive · 1 anno','Unités natives inactives · 1 an','Inaktive native Einheiten · 1 Jahr']],
  ['revived1yr','SplyRvv1yr',['Native units reactivated after a year','Unità native riattivate dopo un anno','Unités natives réactivées après un an','Nach einem Jahr reaktivierte native Einheiten']],
] as const

export function proposalGaps(current:ResearchSnapshot,id:string,lang:Lang):string {
  const item = current.assets[id]
  if (!item) return ''
  const cells = item.latest as Partial<Record<string,StudyObservation>>
  const i=langs.indexOf(lang)
  const title=['Additional resource measures','Altre misure delle risorse','Autres mesures des ressources','Weitere Ressourcenmessungen'][i]
  const intro=['Community availability at the latest cutoff','Disponibilità in Community all’ultima data','Disponibilité Community à la dernière date','Community-Verfügbarkeit am letzten Stichtag'][i]
  const native=['native units','unità native','unités natives','native Einheiten'][i]
  const rows=measures.map(([key,code,names])=>{
    const c=cells[key]
    const status=studyText(lang,c?.status||'missing')
    const shown= c?.value!=null ? new Intl.NumberFormat(lang,{maximumSignificantDigits:12}).format(c.value)+' '+(key==='topDecileShare'?'%':key.startsWith('inactive')||key==='revived1yr'?native:'') : status
    return `<li><span>${esc(names[i])}</span><code>${esc(code)}</code><strong>${esc(shown)}</strong></li>`
  })
  return `<details class="a-proposal"><summary>${esc(title)}</summary><p>${esc(intro)} · <b>${esc(id)}</b> · ${esc(current.cutoffUtc)} UTC</p><ul>${rows.join('')}</ul></details>`
}
