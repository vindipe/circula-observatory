import { langs, type Lang, type Topic } from './copy'
import { esc } from '../ui/html'
import './rules.css'

type Translation = readonly [string, string, string, string]
type Rule = {
  date: string
  title: Translation
  text: Translation
  references: readonly [string, string][]
}

const title: Translation = ['Which rule applies?', 'Quale regola si applica?', 'Quelle règle s’applique ?', 'Welche Regel gilt?']
const btc: Rule = {
  date: '2009-01-03',
  title: ['Bitcoin · UTXO validity', 'Bitcoin · validità degli UTXO', 'Bitcoin · validité des UTXO', 'Bitcoin · Gültigkeit von UTXOs'],
  text: [
    'An output remains in the unspent set until an input satisfies its spending conditions. Output age runs from creation to spending, even when the owner sends funds to their own wallet.',
    'Un output resta nell’insieme degli UTXO finché un input ne soddisfa le condizioni di spesa. L’età va dalla creazione alla spesa, anche quando il proprietario sposta fondi verso un proprio wallet.',
    'Une sortie reste dans l’ensemble des UTXO jusqu’à ce qu’une entrée satisfasse ses conditions de dépense. Son âge court de la création à la dépense, y compris lors d’un virement vers un portefeuille du même propriétaire.',
    'Ein Output bleibt in der UTXO-Menge, bis ein Input seine Ausgabebedingungen erfüllt. Sein Alter reicht von der Erstellung bis zur Ausgabe, auch bei Überträgen an eine eigene Wallet.'
  ],
  references: [['Bitcoin Developer Guide', 'https://developer.bitcoin.org/devguide/transactions.html'], ['Bitcoin Core · genesis', 'https://github.com/bitcoin/bitcoin/blob/master/src/kernel/chainparams.cpp']],
}
const eth: Rule = {
  date: '2015-07-30',
  title: ['Ethereum · execution history', 'Ethereum · storia di esecuzione', 'Ethereum · historique d’exécution', 'Ethereum · Ausführungshistorie'],
  text: [
    'Ethereum records transactions in blocks. Contract execution can emit multiple token transfers. Attribute those records to the deployment and count its host’s blocks and bytes once.',
    'Ethereum registra le transazioni nei blocchi. Un’esecuzione di contratto può generare più trasferimenti di token. I trasferimenti si attribuiscono al deployment e i blocchi e i byte si contano una volta per rete ospite.',
    'Ethereum enregistre les transactions dans les blocs. L’exécution d’un contrat peut produire plusieurs transferts de jetons. Les transferts sont attribués au déploiement et les blocs et octets comptés une fois par réseau hôte.',
    'Ethereum zeichnet Transaktionen in Blöcken auf. Eine Vertragsausführung kann mehrere Token-Transfers auslösen. Die Transfers gehören zum Deployment. Blöcke und Bytes werden je Trägernetz nur einmal gezählt.'
  ],
  references: [['Ethereum · Frontier', 'https://ethereum.org/ethereum-forks/#frontier'], ['ERC-20 · Transfer', 'https://eips.ethereum.org/EIPS/eip-20']],
}
const retention: Rule = {
  date: '2025-07-08',
  title: ['Ethereum · client retention', 'Ethereum · conservazione nei client', 'Ethereum · conservation par les clients', 'Ethereum · Datenhaltung im Client'],
  text: [
    'By this date all execution clients supported discarding pre-Merge block history. A node’s retention setting affects its disk footprint. Current account balances remain available in live state.',
    'A questa data tutti i client di esecuzione supportavano la rimozione della storia precedente al Merge. La scelta di conservazione del nodo incide sul disco. I saldi correnti restano disponibili nello stato vivo.',
    'À cette date, tous les clients d’exécution permettaient de supprimer l’historique antérieur au Merge. La politique de conservation du nœud influe sur le disque. Les soldes courants restent disponibles dans l’état actif.',
    'Ab diesem Datum unterstützten alle Ausführungsclients das Entfernen der Historie vor dem Merge. Die lokale Aufbewahrung beeinflusst den Plattenbedarf. Aktuelle Kontostände bleiben im aktiven Zustand verfügbar.'
  ],
  references: [['Ethereum Foundation', 'https://blog.ethereum.org/2025/07/08/partial-history-exp']],
}
const ttl: Rule = {
  date: '2024-02-20',
  title: ['Stellar · Soroban TTL', 'Stellar · TTL Soroban', 'Stellar · TTL Soroban', 'Stellar · Soroban-TTL'],
  text: [
    'Protocol 20 gives contract entries a last-live ledger, inclusive. A renewal can advance this height. Once a temporary entry expires it can be recreated. Persistent entries have a recovery path.',
    'Con il protocollo 20 una voce di contratto ha un ultimo ledger di validità, incluso. Un rinnovo può posticiparlo. Dopo la scadenza una voce temporanea può essere ricreata. Le voci persistenti dispongono di un percorso di ripristino.',
    'Le protocole 20 fixe le dernier registre de validité d’une entrée de contrat, borne incluse. Un renouvellement peut le repousser. Une entrée temporaire expirée peut être recréée. Les entrées persistantes disposent d’une procédure de restauration.',
    'Protokoll 20 setzt für Vertragseinträge einen letzten gültigen Ledger einschließlich dieser Höhe. Eine Verlängerung kann die Grenze verschieben. Abgelaufene temporäre Einträge lassen sich neu anlegen, persistente Einträge wiederherstellen.'
  ],
  references: [['CAP-0046-12', 'https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-12.md'], ['Stellar · Protocol 20', 'https://stellar.org/blog/developers/protocol-20-upgrade-guide']],
}
const restore: Rule = {
  date: '2025-09-03',
  title: ['Stellar · restoration', 'Stellar · ripristino', 'Stellar · restauration', 'Stellar · Wiederherstellung'],
  text: [
    'Protocol 23 moves evicted persistent entries to an archive and supports restoration during invocation. The timeline identifies eviction from ledger-close records and restoration from explicit changes to entries.',
    'Il protocollo 23 archivia le voci persistenti rimosse dallo stato vivo e permette il ripristino durante un’invocazione. La timeline identifica la rimozione nei record di chiusura del ledger e il ripristino nelle modifiche esplicite delle voci.',
    'Le protocole 23 archive les entrées persistantes évincées et permet leur restauration lors d’un appel. La chronologie identifie les évictions à la clôture du registre et les restaurations dans les modifications explicites des entrées.',
    'Protokoll 23 archiviert verdrängte persistente Einträge und ermöglicht die Wiederherstellung bei einem Aufruf. Die Zeitlinie erfasst Verdrängungen beim Ledger-Abschluss und Wiederherstellungen anhand expliziter Eintragsänderungen.'
  ],
  references: [['Stellar · protocol upgrades', 'https://stellar.org/protocol-upgrades'], ['CAP-0066', 'https://github.com/stellar/stellar-protocol/blob/master/core/cap-0066.md']],
}

const evidence: Record<string, Translation> = {
  unknown: [
    'A deployment-specific lifetime rule and its effective date have yet to be verified for this selection. Activity can still be described within the stated provider scope.',
    'Per questa selezione restano da verificare la regola di durata del deployment e la data di efficacia. L’attività si può descrivere nel perimetro dichiarato dalla fonte.',
    'La règle de durée propre à ce déploiement et sa date d’effet restent à vérifier. L’activité peut être décrite dans le périmètre défini par la source.',
    'Für diese Auswahl sind die Lebensdauerregel des Deployments und ihr Gültigkeitsbeginn noch offen. Die Aktivität lässt sich im dokumentierten Umfang der Quelle beschreiben.'
  ],
  stock: [
    'Stock changes include outputs newly crossing the age threshold. Gross reactivation is measured from spending events. In the proposal the one-day estimate is SplyCur − SplyAct1d. The Community catalog returned no public deployments for SplyAct1d, SplyAct1yr or SplyRvv1yr on 24 November 2026. Bitview separately indexes Bitcoin outputs at creation and spend. On account ledgers Coin Metrics dates activity by account creation or outgoing movements, which requires its own comparison group.',
    'La variazione dello stock include gli output che hanno appena superato la soglia. Il flusso lordo riattivato si misura dagli eventi di spesa. Nel proposal la stima a un giorno è SplyCur − SplyAct1d. Il 24 novembre 2026 il catalogo Community non restituiva deployment pubblici per SplyAct1d, SplyAct1yr o SplyRvv1yr. Bitview indicizza separatamente creazioni e spese di output Bitcoin. Nei sistemi a conti Coin Metrics considera la creazione del conto o i movimenti in uscita, che richiedono un gruppo di confronto distinto.',
    'La variation du stock inclut les sorties qui viennent de franchir le seuil. Le flux brut réactivé se mesure à la dépense. Dans le projet, l’estimation à un jour est SplyCur − SplyAct1d. Le 24 novembre 2026, le catalogue Community ne renvoyait aucun déploiement public pour SplyAct1d, SplyAct1yr ou SplyRvv1yr. Bitview indexe les créations et dépenses de sorties Bitcoin. Sur les chaînes à comptes, Coin Metrics tient compte de la création du compte ou des mouvements sortants, ce qui exige un groupe de comparaison distinct.',
    'Bestandsänderungen umfassen auch Outputs, die gerade die Altersgrenze überschritten haben. Der reaktivierte Bruttobetrag wird anhand der Ausgaben gemessen. Der Tagesansatz im Antrag ist SplyCur − SplyAct1d. Am 24. November 2026 lieferte der Community-Katalog für SplyAct1d, SplyAct1yr und SplyRvv1yr keine öffentlichen Deployments. Bitview indexiert die Erstellung und Ausgabe von Bitcoin-Outputs. Auf Kontenketten berücksichtigt Coin Metrics die Kontenerstellung oder ausgehende Bewegungen, was eine eigene Vergleichsgruppe erfordert.'
  ],
  inference: [
    'Two snapshots can motivate a hypothesis. Attributing a difference to a lifetime rule requires a dated change, a comparable group and controls for custody, issuance, address reuse and changes in measurement.',
    'Due snapshot possono motivare un’ipotesi. Attribuire una differenza a una regola di durata richiede una modifica datata, un gruppo comparabile e controlli per custodia, emissioni, riuso degli indirizzi e cambiamenti nella misurazione.',
    'Deux instantanés peuvent motiver une hypothèse. Attribuer une différence à une règle de durée exige une modification datée, un groupe comparable et des contrôles pour la garde, les émissions, la réutilisation des adresses et les changements de mesure.',
    'Zwei Stichtage können eine Hypothese begründen. Die Zuordnung einer Differenz zu einer Laufzeitregel erfordert eine datierte Änderung, eine Vergleichsgruppe sowie Kontrollen für Verwahrung, Emission, Adresswiederverwendung und Messänderungen.'
  ],
}
const researchSources: readonly [string, string][] = [
  ['Coin Metrics · Active supply', 'https://docs.coinmetrics.io/network-data/network-data-overview/supply/active-supply'],
  ['Coin Metrics · Revived supply', 'https://docs.coinmetrics.io/network-data/network-data-overview/supply/revived-supply'],
]
const paper: [string,string] = ['Di Perna et al. · DLT 2025', 'https://ceur-ws.org/Vol-4105/paper09.pdf']
const bibliography: Translation = ['Bibliography', 'Bibliografia', 'Bibliographie', 'Literatur']
const links = (items: readonly [string, string][]) => items.map(([name,url]) =>
  `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(name)} ↗</a>`).join(' · ')

export function rulePanel(topic: Topic, lang: Lang, asset = '') {
  const i = langs.indexOf(lang)
  const local = (value: Translation) => esc(value[i])
  const rules = topic === 'expiration' ? [ttl, restore] : asset === 'btc' ? [btc] :
    asset === 'eth' || asset.endsWith('_eth') ? (topic === 'history' ? [eth, retention] : [eth]) : []
  const entries = rules.map(rule => {
    const date = new Intl.DateTimeFormat(lang, {dateStyle:'long', timeZone:'UTC'}).format(new Date(rule.date+'T00:00:00Z'))
    return `<li><time datetime="${rule.date}">${esc(date)}</time><div><strong>${local(rule.title)}</strong><p>${local(rule.text)}</p><small>${links(rule.references)}</small></div></li>`
  }).join('')
  return `<details class="a-rule-panel"><summary>${local(title)}</summary>${entries ? '<ul>'+entries+'</ul>' : '<p>'+local(evidence.unknown)+'</p>'}${topic==='inactive' ? '<p>'+local(evidence.stock)+'</p><small>'+links(researchSources)+'</small>' : ''}<p>${local(evidence.inference)}</p>${topic==='concentration'||topic==='inactive' ? '<small>'+local(bibliography)+' · '+links([paper])+'</small>' : ''}</details>`
}
