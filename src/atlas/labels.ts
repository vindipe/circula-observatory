import { langs, type Lang } from './copy'
import type { Series } from './data'
const names:Record<string,string[]> = {
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
 return prefix[langs.indexOf(l)]+' ≥ '+age[2]+' '+['days','giorni','jours','Tage'][langs.indexOf(l)]}
 return names[s.metric]?.[langs.indexOf(l)]||s.label
}
export function gaps(l:Lang):[string,string][]{
 const i=langs.indexOf(l)
 return [
 ['Bitcoin · Gini / Top 10 · 2010–2026',['The positive-address balance bands allow a lower bound on Gini. Exact top shares require individual ranks or a band boundary at the requested rank.','Le fasce di saldo positivo consentono un limite inferiore del Gini. Le quote esatte richiedono i ranghi individuali o un confine di fascia che coincida con il rango.','Les tranches de solde positif donnent une borne inférieure du Gini. Les parts exactes exigent les rangs individuels ou une borne au rang demandé.','Positive Guthabenklassen erlauben eine Gini-Untergrenze. Exakte Anteile erfordern Einzelränge oder passende Klassengrenzen.'][i]],
 ['SOL · Coin Metrics Community',['Market coverage only in the verified Community extract. On-chain activity needs a separately verified source.','L’estrazione Community verificata copre il mercato. L’attività on-chain richiede una fonte verificata separatamente.','L’extrait Community vérifié couvre le marché. L’activité on-chain nécessite une autre source vérifiée.','Der verifizierte Community-Auszug deckt Marktdaten ab. On-Chain-Aktivität erfordert eine weitere geprüfte Quelle.'][i]],
 ['TxTfrValNtv · BlkSizeByte · SplyAct1yr',['The extended catalog alone does not establish Community access. Published Bitcoin byte and age measures use the source displayed on each chart.','Il catalogo esteso non dimostra l’accesso Community. Le misure pubblicate dei byte e dell’età su Bitcoin indicano la propria fonte in ogni grafico.','Le catalogue étendu ne suffit pas à établir l’accès Community. Chaque graphique Bitcoin indique la source des octets et de l’âge.','Der erweiterte Katalog belegt keinen Community-Zugriff. Bitcoin-Byte- und Altersmessungen nennen ihre eigene Quelle.'][i]],
 ['State size · node storage',['Serialized blocks, live state and disk space are separate measures. A verified monthly series for state size or node disk use is still required.','Blocchi serializzati, stato attivo e spazio su disco sono misure distinte. Manca una serie mensile verificata per stato o disco.','Les blocs sérialisés, l’état actif et le disque sont des mesures distinctes. Une série mensuelle vérifiée pour l’état ou le disque reste nécessaire.','Serialisierte Blöcke, aktiver Zustand und Festplattenbedarf sind getrennte Maße. Für Zustand und Festplatte fehlt eine geprüfte Monatsreihe.'][i]],
 ]
}
