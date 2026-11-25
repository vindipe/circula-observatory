import { langs, type Lang } from './copy'
import { studyDefinitions, type StudyIndicator } from './study-types'

const words = {
  matrix:['Indicator coverage','Copertura degli indicatori','Couverture des indicateurs','Abdeckung der Indikatoren'],
  intro:['Choose the measures first. The matrix shows which Coin Metrics IDs have observations at both dates.','Scegli le misure. La matrice mostra quali ID Coin Metrics hanno osservazioni a entrambe le date.','Choisissez les mesures. La matrice indique quels ID Coin Metrics ont des observations aux deux dates.','Wählen Sie die Messgrößen. Die Matrix zeigt, welche Coin-Metrics-IDs für beide Stichtage Beobachtungen haben.'],
  period:['Observation period','Periodo di osservazione','Période d’observation','Beobachtungszeitraum'],
  frozen:['Paper · frozen comparison','Paper · confronto congelato','Article · comparaison figée','Paper · fixierter Vergleich'],
  current:['Latest complete UTC month','Ultimo mese UTC completo','Dernier mois UTC complet','Letzter vollständiger UTC-Monat'],
  custom:['Choose month-ends','Scegli i fine mese','Choisir les fins de mois','Monatsenden wählen'],
  indicators:['Indicators','Indicatori','Indicateurs','Indikatoren'],
  common:['Six common indicators','Sei indicatori comuni','Six indicateurs communs','Sechs gemeinsame Indikatoren'],
  infrastructure:['Infrastructure','Infrastruttura','Infrastructure','Infrastruktur'],
  holdings:['Holdings','Detenzioni','Avoirs','Bestände'],
  circulation:['Circulation','Circolazione','Circulation','Umlauf'],
  transactions:['Recorded transactions','Transazioni registrate','Transactions enregistrées','Erfasste Transaktionen'],
  blocks:['Recorded blocks','Blocchi registrati','Blocs enregistrés','Erfasste Blöcke'],
  ledgerBytes:['Serialized block history','Storia serializzata dei blocchi','Historique des blocs sérialisés','Serialisierte Blockhistorie'],
  fundedAddresses:['Funded addresses','Indirizzi con saldo','Adresses avec solde','Adressen mit Guthaben'],
  supply:['Current supply','Offerta corrente','Offre en circulation','Umlaufmenge'],
  inactiveFloor:['Inactive funded addresses · lower bound','Indirizzi con saldo inattivi · limite inferiore','Adresses financées inactives · borne inférieure','Inaktive Adressen mit Guthaben · Untergrenze'],
  exchangeShare:['Exchange custody · supply share','Custodia degli exchange · quota di offerta','Garde par les plateformes · part de l’offre','Börsenverwahrung · Mengenanteil'],
  exchangeValue:['Exchange custody · USD valuation','Custodia degli exchange · valutazione in USD','Garde par les plateformes · valorisation USD','Börsenverwahrung · USD-Bewertung'],
  transfers30d:['Transfers · daily mean','Trasferimenti · media giornaliera','Transferts · moyenne journalière','Transfers · Tagesmittel'],
  activeAddresses30d:['Active addresses · daily mean','Indirizzi attivi · media giornaliera','Adresses actives · moyenne journalière','Aktive Adressen · Tagesmittel'],
  history:['Historical sum','Somma storica','Somme historique','Historische Summe'],
  stock:['At the cutoff','Alla data','Au terme','Am Stichtag'],
  mean:['30-day mean','Media su 30 giorni','Moyenne sur 30 jours','30-Tage-Mittel'],
  bound:['30-day lower bound','Limite su 30 giorni','Borne sur 30 jours','30-Tage-Untergrenze'],
  network:['Native network','Rete nativa','Réseau natif','Natives Netzwerk'],
  aggregate:['Multi-chain aggregate','Aggregato multi-chain','Agrégat multi-chaînes','Chain-übergreifendes Aggregat'],
  token_deployment:['Token deployment','Deployment di token','Déploiement de jeton','Token-Deployment'],
  provider_asset:['Unresolved provider ID','ID del provider da classificare','ID fournisseur à classer','Ungeklärte Anbieter-ID'],
  observed:['Observed','Osservato','Observé','Beobachtet'],
  zero_observed:['Observed zero','Zero osservato','Zéro observé','Beobachtete Null'],
  not_applicable:['Not applicable','Non applicabile','Sans objet','Nicht anwendbar'],
  not_public:['Unavailable in the public tier','Non disponibile nel livello pubblico','Indisponible dans l’offre publique','Im öffentlichen Angebot nicht verfügbar'],
  incomplete:['Incomplete history or window','Storia o finestra incompleta','Historique ou fenêtre incomplets','Unvollständige Historie oder Zeitfenster'],
  undefined:['Undefined','Indefinito','Indéfini','Undefiniert'],
  missing:['Observation unavailable','Osservazione assente','Observation absente','Beobachtung fehlt'],
  change:['Relative change','Variazione relativa','Variation relative','Relative Änderung'],
  zeroBase:['Undefined change · zero baseline','Variazione indefinita · base zero','Variation indéfinie · base nulle','Änderung undefiniert · Ausgangswert null'],
  pop:['Coverage filter','Filtro di copertura','Filtre de couverture','Abdeckungsfilter'],
  complete:['All selected indicators at both dates','Tutti gli indicatori selezionati a entrambe le date','Tous les indicateurs sélectionnés aux deux dates','Alle gewählten Indikatoren an beiden Stichtagen'],
  partial:['Include partial coverage','Includi copertura parziale','Inclure la couverture partielle','Teilabdeckung einschließen'],
  audit:['All catalog IDs and gaps','Tutti gli ID del catalogo e le lacune','Tous les ID du catalogue et lacunes','Alle Katalog-IDs und Lücken'],
  search:['Search ID, host or layer','Cerca ID, rete ospite o layer','Rechercher un ID, réseau hôte ou couche','ID, Hostnetz oder Layer suchen'],
  scope:['Observation scope','Perimetro osservato','Périmètre observé','Beobachtungsumfang'],
  all:['All scopes','Tutti i perimetri','Tous les périmètres','Alle Typen'],
  hostLayer:['Host network layer','Layer della rete ospite','Couche du réseau hôte','Layer des Hostnetzwerks'],
  appLayer:['Application · token contract','Applicazione · contratto del token','Application · contrat du jeton','Anwendung · Token-Vertrag'],
  protocolLayer:['Application · token protocol','Applicazione · protocollo del token','Application · protocole du jeton','Anwendung · Token-Protokoll'],
  crossLayer:['Across deployments','Su più deployment','Plusieurs déploiements','Deployment-übergreifend'],
  baseLayer:['L1 · base network','L1 · rete di base','L1 · réseau de base','L1 · Basisnetzwerk'],
  networkUnknown:['Network · layer unverified','Rete · layer da verificare','Réseau · couche à vérifier','Netzwerk · Layer ungeklärt'],
  layer:['Layer','Layer','Couche','Layer'],
  count:['IDs shown','ID visualizzati','ID affichés','angezeigte IDs'],
  paired:['with complete pairs','con coppie complete','avec paires complètes','mit vollständigen Paaren'],
  csv:['Export filtered CSV','Esporta CSV filtrato','Exporter le CSV filtré','Gefilterte CSV exportieren'],
  priceOnly:['Only price coverage for these metrics in Community.','Il catalogo Community offre solo il prezzo fra i codici esaminati.','Parmi les codes examinés, Community fournit uniquement le prix.','Für die geprüften Codes enthält Community nur Preisdaten.'],
  empty:['No IDs match these filters.','Nessun ID soddisfa questi filtri.','Aucun ID ne correspond à ces filtres.','Keine ID erfüllt diese Filter.'],
  emptySelection:['Select at least one indicator.','Seleziona almeno un indicatore.','Sélectionnez au moins un indicateur.','Wählen Sie mindestens einen Indikator.'],
  dates:['Observation dates','Date di osservazione','Dates d’observation','Beobachtungsdaten'],
  acquired:['Acquired','Acquisizione','Acquisition','Abruf'],
  formula:['Formula','Formula','Formule','Formel'],
  inputs:['Source inputs','Dati sottostanti','Données sources','Quelldaten'],
  priceDate:['Price date','Data del prezzo','Date du prix','Preisdatum'],
  detail:['Inspect observations','Ispeziona le osservazioni','Examiner les observations','Beobachtungen prüfen'],
  select:['Select ID','Seleziona ID','Sélectionner un ID','ID auswählen'],
  host:['Host network','Rete ospite','Réseau hôte','Hostnetzwerk'],
  unit:['Unit','Unità','Unité','Einheit'],
  tableNote:['Cells show the later observation. Select an ID to inspect both dates, inputs and gaps.','Le celle mostrano l’osservazione più recente. Seleziona un ID per ispezionare entrambe le date, gli input e le lacune.','Les cellules affichent l’observation la plus récente. Sélectionnez un ID pour examiner les deux dates, les données sources et les lacunes.','Die Zellen zeigen die spätere Beobachtung. Wählen Sie eine ID für beide Stichtage, Quelldaten und Lücken.'],
  scopeNote:['IDs can overlap. A token transfer is recorded on its host chain. Each host contributes its own block history once.','Gli ID possono sovrapporsi. Il trasferimento di un token viene registrato sulla rete ospite. Ogni rete contribuisce una volta con la propria storia dei blocchi.','Les ID peuvent se recouper. Un transfert de jeton est enregistré sur sa chaîne hôte. Chaque chaîne contribue une fois à l’historique des blocs.','IDs können sich überschneiden. Ein Tokentransfer wird auf seiner Host-Blockchain erfasst. Jedes Netzwerk trägt seine Blockhistorie einmal bei.'],
  floorNote:['F is the end-of-window funded address count. An address can occur on multiple days in the sum of daily active addresses. A zero lower bound is inconclusive.','F è il numero di indirizzi con saldo a fine finestra. Uno stesso indirizzo può ripetersi nella somma degli attivi giornalieri. Un limite inferiore pari a zero è inconcludente.','F compte les adresses avec solde en fin de fenêtre. Une adresse peut figurer plusieurs fois dans la somme des adresses actives quotidiennes. Une borne nulle est non concluante.','F zählt die Adressen mit Guthaben am Fensterende. In der Summe der täglich aktiven Adressen kann dieselbe Adresse mehrfach vorkommen. Eine Untergrenze von null ist nicht aussagekräftig.'],
  transfersNote:['One transaction can contain multiple transfers. Daily active addresses can repeat across days.','Una transazione può includere più trasferimenti. Gli indirizzi attivi possono ripetersi tra giorni diversi.','Une transaction peut comprendre plusieurs transferts. Une adresse active peut apparaître plusieurs jours.','Eine Transaktion kann mehrere Transfers umfassen. Aktive Adressen können an mehreren Tagen vorkommen.'],
  exchangeNote:['Exchange-tagged addresses can hold funds for many users. Valuation also varies with the cutoff price.','Gli indirizzi attribuiti agli exchange possono custodire fondi di molti utenti. La valutazione varia anche con il prezzo alla data.','Les adresses attribuées aux plateformes peuvent conserver les fonds de nombreux utilisateurs. La valorisation varie aussi selon le prix à la date retenue.','Börsenadressen können Guthaben vieler Nutzer verwahren. Die Bewertung hängt auch vom Preis am Stichtag ab.'],
  unavailable:['This snapshot could not be loaded.','Impossibile caricare questo snapshot.','Impossible de charger cet instantané.','Dieser Datenstand konnte nicht geladen werden.'],
  retry:['Try again','Riprova','Réessayer','Erneut versuchen'],
  loading:['Loading observations…','Caricamento osservazioni…','Chargement des observations…','Beobachtungen werden geladen …'],
  previous:['Previous','Indietro','Précédent','Zurück'],
  next:['Next','Avanti','Suivant','Weiter'],
  open:['Explore this indicator','Esplora questo indicatore','Explorer cet indicateur','Indikator erkunden'],
  source:['Source and terms','Fonte e condizioni d’uso','Source et licence','Quelle und Lizenz'],
  catalog:['Coin Metrics Community catalog','Catalogo Coin Metrics Community','Catalogue Coin Metrics Community','Coin-Metrics-Community-Katalog'],
  close:['Close detail','Chiudi dettaglio','Fermer le détail','Detail schließen'],
  start:['First day','Primo giorno','Premier jour','Erster Tag'],
  unknown:['Unresolved','Da verificare','À vérifier','Ungeklärt'],
  from:['From','Da','Du','Von'],
  to:['To','A','Au','Bis'],
  invalidDates:['Choose a start date on or before the end date.','Scegli una data iniziale uguale o precedente a quella finale.','Choisissez une date de début antérieure ou égale à la date de fin.','Wählen Sie ein Startdatum bis einschließlich des Enddatums.'],
  'addresses':['addresses','indirizzi','adresses','Adressen'],
  'native units':['native units','unità native','unités natives','native Einheiten'],
  'transfers/day':['transfers/day','trasferimenti/giorno','transferts/jour','Transfers/Tag'],
  'addresses/day':['addresses/day','indirizzi/giorno','adresses/jour','Adressen/Tag'],
  transactionUnit:['transactions','transazioni','transactions','Transaktionen'],
  blockUnit:['blocks','blocchi','blocs','Blöcke'],
} as const

export type StudyTextKey = keyof typeof words

export function studyText(lang:Lang, key:StudyTextKey) {
  return words[key][langs.indexOf(lang)]
}

export function studyUnit(lang:Lang, id:StudyIndicator, assetId?:string): string {
  const {unit}=studyDefinitions[id]
  if (unit==='transactions') return studyText(lang,'transactionUnit')
  if (unit==='blocks') return studyText(lang,'blockUnit')
  if (unit==='addresses' || unit==='transfers/day' || unit==='addresses/day' || unit==='native units') {
    return unit==='native units' && assetId ? assetId.toUpperCase()+' · '+studyText(lang,unit) : studyText(lang,unit)
  }
  return unit
}

const layerNames: Record<string, StudyTextKey> = {
  'Application · token contract':'appLayer', 'Application · token protocol':'protocolLayer',
  'Cross-deployment':'crossLayer','L1 · base network':'baseLayer','Network · layer unverified':'networkUnknown','Unverified':'unknown',
}

export function studyLayerName(lang:Lang, layer:string | undefined) {
  return layer ? (layerNames[layer] ? studyText(lang,layerNames[layer]) : layer) : studyText(lang,'unknown')
}
