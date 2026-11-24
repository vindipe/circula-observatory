import { langs, type Lang } from './copy'
import type { Series } from './data'
const names:Record<string,string[]> = {
 utxo_count:['Unspent transaction outputs','Output di transazione non spesi','Sorties de transaction non dépensées','Nicht ausgegebene Transaktionsoutputs'],
 gross_input_volume_btc:['Gross spent-input value','Valore lordo degli input spesi','Valeur brute des entrées dépensées','Bruttowert ausgegebener Inputs'],
 history_gb:['Cumulative block history','Storico cumulato dei blocchi','Historique cumulé des blocs','Kumulierte Blockhistorie'],
 added_gb:['Block bytes added per month','GB aggiunti ogni mese','Octets ajoutés par mois','Monatlich hinzugefügte Blockbytes'],
 history_block_count:['Blocks per month · monotonic time','Blocchi al mese · tempo monotono','Blocs par mois · temps monotone','Blöcke pro Monat · monotone Zeit'],
 mean_block_bytes:['Mean serialized block size','Dimensione media dei blocchi serializzati','Taille moyenne des blocs sérialisés','Mittlere serialisierte Blockgröße'],
 TxCnt:['Transactions','Transazioni','Transactions','Transaktionen'],TxTfrCnt:['Transfers','Trasferimenti','Transferts','Transfers'],
 AdrActCnt:['Sum of daily active addresses','Somma degli indirizzi attivi giornalieri','Somme des adresses actives quotidiennes','Summe täglich aktiver Adressen'],
 AdrBalCnt:['Addresses with a positive balance','Indirizzi con saldo positivo','Adresses à solde positif','Adressen mit positivem Guthaben'],
 SplyCur:['Current supply','Offerta corrente','Offre courante','Aktuelle Menge'],BlkCnt:['Blocks added · Coin Metrics','Blocchi aggiunti · Coin Metrics','Blocs ajoutés · Coin Metrics','Hinzugefügte Blöcke · Coin Metrics'],
 gini_grouped_floor:['Gini lower bound · grouped balances','Limite inferiore del Gini · saldi per fascia','Borne inférieure du Gini · soldes groupés','Gini-Untergrenze · gruppierte Guthaben'],
 gini_address:['Exact address Gini','Gini esatto degli indirizzi','Gini exact des adresses','Exakter Adress-Gini'],
 top10_share:['Share of top 10 addresses','Quota dei primi 10 indirizzi','Part des 10 premières adresses','Anteil der 10 größten Adressen'],
 top100_share:['Share of top 100 addresses','Quota dei primi 100 indirizzi','Part des 100 premières adresses','Anteil der 100 größten Adressen'],
}
export function label(s:Series,l:Lang){
 const age=s.metric.match(/^(inactive_pct|inactive|revived)_(\d+)d$/)
 if(age){const prefix=({inactive_pct:['Inactive supply share','Quota di offerta inattiva','Part de l’offre inactive','Inaktiver Anteil'],inactive:['Inactive supply','Offerta inattiva','Offre inactive','Inaktive Menge'],revived:['Older inputs spent','Input anziani spesi','Entrées anciennes dépensées','Ausgegebene ältere Inputs']} as Record<string,string[]>)[age[1]]
 const words=age[2]==='1'?['day','giorno','jour','Tag']:['days','giorni','jours','Tage']
 return prefix[langs.indexOf(l)]+' ≥ '+age[2]+' '+words[langs.indexOf(l)]}
 return names[s.metric]?.[langs.indexOf(l)]||s.label
}
export function gaps(l:Lang):[string,string][]{
 const i=langs.indexOf(l)
 return [
 ['Bitcoin · Gini / Top 10 · 2010–2026',['The positive-address balance bands allow a lower bound on Gini. Exact top shares require individual ranks or a band boundary at the requested rank.','Le fasce di saldo positivo consentono un limite inferiore del Gini. Le quote esatte richiedono i ranghi individuali o un confine di fascia che coincida con il rango.','Les tranches de solde positif donnent une borne inférieure du Gini. Les parts exactes exigent les rangs individuels ou une borne au rang demandé.','Positive Guthabenklassen erlauben eine Gini-Untergrenze. Exakte Anteile erfordern Einzelränge oder passende Klassengrenzen.'][i]],
 ['Stellar · Hubble TTL',['Hubble requires an authenticated BigQuery project. The published timeline uses sampled AWS ledger-close records. Inferring expiry requires continuous renewal history.','Hubble richiede un progetto BigQuery autenticato. La timeline pubblicata usa chiusure di ledger campionate su AWS. Per dedurre la scadenza serve una storia continua dei rinnovi.','Hubble exige un projet BigQuery authentifié. La chronologie repose sur des clôtures de registres échantillonnées sur AWS. Déduire une expiration impose un historique continu des renouvellements.','Hubble erfordert ein authentifiziertes BigQuery-Projekt. Die Zeitleiste nutzt Stichproben der Ledger-Abschlüsse auf AWS. Ein abgeleiteter Ablauf erfordert einen lückenlosen Verlängerungsverlauf.'][i]],
 ['SOL · Coin Metrics Community',['Market coverage only in the verified Community extract. On-chain activity needs a separately verified source.','L’estrazione Community verificata copre il mercato. L’attività on-chain richiede una fonte verificata separatamente.','L’extrait Community vérifié couvre le marché. L’activité on-chain nécessite une autre source vérifiée.','Der verifizierte Community-Auszug deckt Marktdaten ab. On-Chain-Aktivität erfordert eine weitere geprüfte Quelle.'][i]],
 ['TxTfrValNtv · BlkSizeByte · SplyAct1yr',['The extended catalog alone does not establish Community access. Published Bitcoin byte and age measures use the source displayed on each chart.','Il catalogo esteso non dimostra l’accesso Community. Le misure pubblicate dei byte e dell’età su Bitcoin indicano la propria fonte in ogni grafico.','Le catalogue étendu ne suffit pas à établir l’accès Community. Chaque graphique Bitcoin indique la source des octets et de l’âge.','Der erweiterte Katalog belegt keinen Community-Zugriff. Bitcoin-Byte- und Altersmessungen nennen ihre eigene Quelle.'][i]],
 ['State size · node storage',['Serialized blocks, live state and disk space are separate measures. A verified monthly series for state size or node disk use is still required.','Blocchi serializzati, stato attivo e spazio su disco sono misure distinte. Manca una serie mensile verificata per stato o disco.','Les blocs sérialisés, l’état actif et le disque sont des mesures distinctes. Une série mensuelle vérifiée pour l’état ou le disque reste nécessaire.','Serialisierte Blöcke, aktiver Zustand und Festplattenbedarf sind getrennte Maße. Für Zustand und Festplatte fehlt eine geprüfte Monatsreihe.'][i]],
 ]
}

export function methodText(s:Series,l:Lang){
 if(s.methodI18n?.[l])return s.methodI18n[l]
 const match=s.metric.match(/^(inactive_pct|inactive|revived)_(\d+)d$/)
 if(!match||l==='en')return s.method
 const methods:Record<string,Record<string,string>>={
  inactive:{it:'Somma dei BTC negli output non spesi all’ultimo blocco indicizzato del mese.',fr:'Somme des BTC dans les sorties non dépensées au dernier bloc indexé du mois.',de:'Summe der BTC in nicht ausgegebenen Outputs im letzten indexierten Block des Monats.'},
  inactive_pct:{it:'100 × BTC nelle fasce di età selezionate / BTC in tutti gli output non spesi indicizzati a fine mese. Gli output dimostrabilmente non spendibili, come OP_RETURN, sono esclusi.',fr:'100 × BTC des tranches d’âge retenues / BTC de toutes les sorties non dépensées indexées en fin de mois. Les sorties manifestement indépensables, dont OP_RETURN, sont exclues.',de:'100 × BTC der ausgewählten Altersklassen / BTC aller indexierten ungenutzten Outputs am Monatsende. Nachweislich unausgebbare Outputs wie OP_RETURN sind ausgeschlossen.'},
  revived:{it:'Differenza tra due fine mese del valore lordo cumulato degli input spesi nelle fasce selezionate. Include resto, autotrasferimenti e consolidamenti.',fr:'Différence entre deux fins de mois de la valeur brute cumulée dépensée dans les tranches retenues. Le change, les transferts à soi-même et les consolidations sont inclus.',de:'Differenz des kumulierten Bruttowerts ausgegebener Inputs der ausgewählten Altersklassen zwischen zwei Monatsenden. Wechselgeld, Eigenüberträge und Konsolidierungen sind enthalten.'}
 }
 return methods[match[1]][l]
}
export function scopeText(s:Series,l:Lang){
 if(s.scopeI18n?.[l])return s.scopeI18n[l]
 const age=s.metric.match(/^(?:inactive_pct|inactive|revived)_(\d+)d$/)?.[1]
 if(age && l!=='en')return {it:`UTXO Bitcoin di almeno ${age} ${age==='1'?'giorno':'giorni'}. L’età decorre dalla creazione usando il massimo progressivo dei timestamp delle intestazioni dei blocchi.`,fr:`UTXO Bitcoin âgés d’au moins ${age} ${age==='1'?'jour':'jours'}. L’âge est mesuré depuis la création à partir du maximum courant des horodatages des en-têtes de bloc.`,de:`Bitcoin-UTXOs mit einem Alter von mindestens ${age} ${age==='1'?'Tag':'Tagen'}. Das Alter seit Erstellung folgt dem fortlaufenden Maximum der Zeitstempel der Blockheader.`}[l]
 return s.scope
}
