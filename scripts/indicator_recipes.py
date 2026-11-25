"""Scientific definitions for the indicators displayed in the Observatory."""

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class Indicator:
    id: str
    area: str
    unit: str
    role: str
    title: str
    why: str
    caution: str
    it: tuple[str, str, str]
    formula: str = ""
    inputs: tuple[tuple[str, int, int], ...] = ()
    apply: Callable | None = None
    cumulative: bool = False

    @property
    def codes(self):
        return tuple(dict.fromkeys(key for key, _, _ in self.inputs)) or (self.id,)


INFRA = "infrastructure"
HOLD = "holdings"
FLOW = "circulation"
HISTORY = "history"
STOCK = "stock"
MOVEMENT = "movement"
CONTEXT = "context"

RAW = (
    Indicator("BlkCnt", INFRA, "blocks/day", HISTORY, "Blocks included",
              "Each canonical block adds a batch of records to the history a network produces.",
              "Block size and local pruning determine how many bytes a given node stores.",
              ("Blocchi inclusi", "Ogni blocco canonico aggiunge un gruppo di record alla storia prodotta dalla rete.",
               "La dimensione dei blocchi e il pruning determinano quanti byte conserva un nodo specifico.")),
    Indicator("HashRate", INFRA, "protocol-specific", CONTEXT, "Proof-of-work hash rate",
              "Shows the computation rate of miners while the network extends and secures its record.",
              "The algorithm and units depend on the protocol. This estimates present computation. Storage and verification of old history require dedicated measurements.",
              ("Hash rate proof-of-work", "Mostra il ritmo di calcolo dei miner mentre la rete estende e protegge il registro.",
               "Algoritmo e unità dipendono dal protocollo. È una stima del calcolo corrente. Storage e verifica della storia richiedono misure proprie.")),
    Indicator("AdrBalCnt", HOLD, "addresses", STOCK, "Funded addresses",
              "Counts addresses at which a positive balance persists at the cutoff, even when there is no recent activity.",
              "One person may use many addresses and one custody address may represent many people. The address count also depends on the accounting model.",
              ("Indirizzi con saldo positivo", "Conta gli indirizzi presso cui rimane un saldo positivo alla data osservata, anche senza attività recente.",
               "Una persona può usare più indirizzi e un custode può rappresentare più persone. Il conteggio dipende anche dal modello contabile.")),
    Indicator("SplyCur", HOLD, "native units", STOCK, "Current supply",
              "Measures the stock of issued units visible in the ledger at the cutoff. It gives the denominator for questions about where balances persist.",
              "Issuance, burning, redemption and bridge accounting change the stock. The measure includes units whose keys may be inaccessible.",
              ("Offerta corrente", "Misura lo stock di unità emesse visibili nel registro alla data osservata. È il denominatore per studiare dove persistono i saldi.",
               "Emissioni, burn, riscatti e bridge variano lo stock. La misura può includere unità con chiavi inaccessibili.")),
    Indicator("IssTotNtv", HOLD, "native units/day", STOCK, "Gross issuance",
              "Measures newly issued units entering the outstanding stock on each day. Compare it with the net change in supply to place accumulation in context.",
              "Supply can also change because of burns, redemptions, migration or accounting revisions.",
              ("Emissione lorda", "Misura le nuove unità che entrano nello stock ogni giorno. Il confronto con la variazione netta aiuta a leggere l’accumulo.",
               "Anche burn, riscatti, migrazioni e revisioni contabili possono variare l’offerta.")),
    Indicator("IssTotUSD", HOLD, "USD/day", CONTEXT, "Gross issuance valued in USD",
              "Values the daily inflow of new units in a common denomination.",
              "A different exchange rate can change this series with the same number of newly issued units.",
              ("Valore in USD dell’emissione lorda", "Esprime in una denominazione comune il flusso giornaliero di nuove unità.",
               "Il cambio può far variare la serie a parità di unità emesse.")),
    Indicator("SplyExNtv", HOLD, "native units", STOCK, "Supply held by known exchanges",
              "Measures the stock in labelled hot and cold wallets, where many customers’ balances can persist under a custodian.",
              "Coin Metrics can revise address labels retrospectively. Trading inside an exchange is outside the ledger.",
              ("Offerta detenuta dagli exchange identificati", "Misura lo stock negli hot e cold wallet attribuiti agli exchange, dove possono permanere saldi di molti clienti.",
               "Coin Metrics può rivedere retroattivamente le attribuzioni. Gli scambi interni a un exchange sono fuori registro.")),
    Indicator("SplyExUSD", HOLD, "USD", CONTEXT, "Exchange-held supply valued in USD",
              "Values known exchange balances at the observation date. This is the valuation of the same custody stock.",
              "Address attribution and price both affect the value. Compare the native-unit balance to see whether the stock moved.",
              ("Valore in USD dell’offerta sugli exchange", "Valuta alla data osservata i saldi nelle disponibilità già attribuite agli exchange.",
               "Attribuzione e prezzo influenzano il valore. Il saldo in unità native mostra se lo stock è cambiato.")),
    Indicator("CapMrktCurUSD", HOLD, "USD", CONTEXT, "Current supply valued in USD",
              "Places the scale of the measured outstanding stock in a common denomination for cross-asset inspection.",
              "Price alone can change market value. Native units track the changing amount.",
              ("Valore in USD dell’offerta corrente", "Esprime lo stock osservato in una denominazione comune per consultare più asset.",
               "Il solo prezzo può modificare il valore di mercato. Le unità native seguono la quantità.")),
    Indicator("CapMVRVCur", HOLD, "ratio", CONTEXT, "Market value / realized value",
              "Compares valuation at today’s price with the provider’s realized valuation. For supported assets the latter retains information about earlier movement of balances.",
              "Price and the asset-specific realized-cap method affect the ratio. Age, holder concentration and use each require their own measure.",
              ("Valore di mercato / valore realizzato", "Confronta il valore al prezzo corrente con quello realizzato. Per gli asset supportati quest’ultimo conserva informazione sui movimenti passati.",
               "Il rapporto dipende dal prezzo e dal metodo del singolo asset. Età, concentrazione e uso richiedono misure proprie.")),
    Indicator("SplyExpFut10yr", HOLD, "native units", CONTEXT, "Expected supply in ten years",
              "Shows the outstanding stock implied by continuing the recorded issuance schedule for another ten years.",
              "This is a projection conditional on the protocol rules used by Coin Metrics. It cannot account for future rule changes.",
              ("Offerta attesa tra dieci anni", "Mostra lo stock atteso se il piano di emissione osservato continua per altri dieci anni.",
               "La proiezione è condizionata alle regole usate da Coin Metrics. Cambiamenti futuri del protocollo restano fuori dal calcolo.")),
    Indicator("TxCnt", FLOW, "transactions/day", MOVEMENT, "Recorded transactions per day",
              "Counts attempts recorded in the ledger. It follows how often users or software interact with a network or token.",
              "A transaction can fail or include several transfers. Scope, batching and protocol operations vary.",
              ("Transazioni registrate per giorno", "Conta i tentativi registrati nel ledger. Segue la frequenza di interazione con rete o token.",
               "Una transazione può fallire o includere più trasferimenti. Ambito, batching e operazioni di protocollo variano.")),
    Indicator("TxTfrCnt", FLOW, "transfers/day", MOVEMENT, "Positive-value transfers per day",
              "Counts recorded movements of positive amounts between ledger entities. It distinguishes value movement from other types of activity.",
              "Messages may contain several transfers. Custody movements, bridge hops and transfers between addresses of the same owner can count.",
              ("Trasferimenti di valore per giorno", "Conta gli spostamenti registrati di quantità positive fra entità del ledger, distinguendoli da altre operazioni.",
               "Un messaggio può contenere più trasferimenti. Possono contare spostamenti interni di custodia, bridge e indirizzi dello stesso titolare.")),
    Indicator("AdrActCnt", FLOW, "addresses/day", MOVEMENT, "Active addresses per day",
              "Shows how many addresses participated in a recorded ledger change during the day.",
              "The same address can appear on several days. Address activity can include contract calls and other changes besides transfers.",
              ("Indirizzi attivi per giorno", "Mostra quanti indirizzi hanno partecipato a una modifica registrata nel ledger durante il giorno.",
               "Lo stesso indirizzo può comparire in più giorni. Oltre ai trasferimenti possono contare chiamate a contratti e altre operazioni.")),
    Indicator("FeeTotNtv", FLOW, "native units/day", CONTEXT, "On-chain transaction fees",
              "Measures the amount users pay to record activity. It gives context for circulation when access to transaction inclusion has a cost.",
              "Congestion, fee rules and transaction mix affect the total. Disk usage requires measurements on a particular node.",
              ("Commissioni di transazione on-chain", "Misura quanto pagano gli utenti per registrare operazioni. Contestualizza la circolazione quando accedere all’inclusione ha un costo.",
               "Congestione, regole delle commissioni e composizione delle transazioni influenzano il totale. L’uso del disco richiede una misura propria.")),
    Indicator("FlowInExNtv", FLOW, "native units/day", MOVEMENT, "Deposits to known exchanges",
              "Counts units moving from outside the labelled exchange set into custody. This shows one channel through which recorded balances move.",
              "Exchange-to-exchange activity and internal trades are excluded. Attribution can be revised.",
              ("Depositi verso gli exchange identificati", "Segue le unità che entrano in custodia dall’esterno degli exchange identificati, uno dei canali di circolazione dei saldi.",
               "Movimenti fra exchange e scambi interni sono esclusi. Le attribuzioni possono essere riviste.")),
    Indicator("FlowOutExNtv", FLOW, "native units/day", MOVEMENT, "Withdrawals from known exchanges",
              "Counts units moving out from labelled exchanges. Withdrawals track a change in custody visible on the ledger.",
              "The destination can be another address controlled by the same economic owner. The provider can revise attribution.",
              ("Prelievi dagli exchange identificati", "Segue le unità in uscita dagli exchange identificati e rileva un cambiamento di custodia visibile nel ledger.",
               "La destinazione può appartenere allo stesso titolare economico. Il provider può rivedere le attribuzioni.")),
    Indicator("FlowInExUSD", FLOW, "USD/day", CONTEXT, "USD value of exchange deposits",
              "Values the measured inflow to labelled custody in a common denomination.",
              "Price and labels affect this series independently of units deposited.",
              ("Valore in USD dei depositi sugli exchange", "Esprime in una denominazione comune il flusso verso la custodia identificata.",
               "Prezzo ed etichette fanno variare la serie indipendentemente dalle unità depositate.")),
    Indicator("FlowOutExUSD", FLOW, "USD/day", CONTEXT, "USD value of exchange withdrawals",
              "Values the measured movement out of labelled custody in a common denomination.",
              "Price and labels affect this series independently of units withdrawn.",
              ("Valore in USD dei prelievi dagli exchange", "Esprime in una denominazione comune il flusso in uscita dalla custodia identificata.",
               "Prezzo ed etichette fanno variare la serie indipendentemente dalle unità prelevate.")),
)


def one(key, days=1, lag=0):
    return key, days, lag


def ratio(numerator, denominator, scale=1):
    return scale * numerator / denominator if denominator > 0 else None


def growth(current, earlier):
    return ratio(current - earlier, earlier, 100)


def inactivity(funded, daily_total):
    return ratio(max(0, funded - daily_total), funded, 100)


def recipe(*meta, inputs, apply, cumulative=False):
    return Indicator(*meta, inputs=inputs, apply=apply, cumulative=cumulative)


def window_mean(key, unit, title, it_title, why, it_why, caution, it_caution, role=MOVEMENT, area=FLOW):
    return recipe(key + "-mean30", area, unit, role, title, why, caution, (it_title, it_why, it_caution),
                  f"Σ₃₀ {key} / 30", inputs=(one(key, 30),), apply=lambda total: total / 30)


RECIPES = (
    recipe("recorded-transactions", INFRA, "transactions", HISTORY, "Cumulative recorded transactions",
           "Follows how many transactions have left a record since the start of the available series.",
           "A cumulative series grows mechanically when activity is added. A complete daily sequence is required. Token activity is a subset or scope of its host ledger.",
           ("Transazioni registrate cumulative", "Segue quante transazioni hanno lasciato un record dall’inizio della serie disponibile.",
            "Il cumulato aumenta quando viene aggiunta attività. Serve una sequenza giornaliera completa. L’attività di un token ha un ambito specifico sul registro ospite."),
           "Σ TxCnt from series start", inputs=(one("TxCnt"),), apply=lambda value: value, cumulative=True),
    recipe("recorded-blocks", INFRA, "blocks", HISTORY, "Cumulative recorded blocks",
           "Shows how many canonical batches have been added to the available history.",
           "A complete daily sequence is required. Blocks vary in size and node clients may discard older data.",
           ("Blocchi registrati cumulativi", "Mostra quanti gruppi canonici di record sono stati aggiunti alla storia disponibile.",
            "Serve una sequenza giornaliera completa. Le dimensioni dei blocchi variano e i client possono scartare i dati più vecchi."),
           "Σ BlkCnt from series start", inputs=(one("BlkCnt"),), apply=lambda value: value, cumulative=True),
    window_mean("BlkCnt", "blocks/day", "Daily block production · 30-day mean",
                "Produzione giornaliera di blocchi · media 30 giorni",
                "Smooths the rate at which canonical history receives new batches of records.",
                "Smussa il ritmo con cui la storia canonica riceve nuovi gruppi di record.",
                "Block frequency and payload capacity depend on the protocol.",
                "Frequenza dei blocchi e capacità dei payload dipendono dal protocollo.", HISTORY, INFRA),
    recipe("transactions-per-block", INFRA, "transactions/block", HISTORY, "Transactions per block · 30 days",
           "Relates recorded operations to the number of canonical batches that contain them. This contrasts denser blocks with more frequent block production.",
           "Calculated for the same provider network ID. Batching and transaction definitions affect cross-network comparisons.",
           ("Transazioni per blocco · 30 giorni", "Rapporta le operazioni ai gruppi canonici che le contengono. Distingue blocchi più densi da blocchi più frequenti.",
            "Usa il medesimo ID di rete. Batching e definizioni delle transazioni incidono sui confronti fra reti."),
           "Σ₃₀ TxCnt / Σ₃₀ BlkCnt", inputs=(one("TxCnt", 30), one("BlkCnt", 30)), apply=ratio),
    recipe("funded-address-change", HOLD, "addresses", STOCK, "Net change in funded addresses · 30 days",
           "Shows whether the stock of positive-balance addresses grew or contracted over a fixed interval.",
           "An address can cross the zero threshold in either direction. New positive balances and cleared balances can offset one another.",
           ("Variazione netta degli indirizzi finanziati · 30 giorni", "Mostra se lo stock di indirizzi con saldo positivo cresce o si contrae in un intervallo fisso.",
            "Un indirizzo può attraversare la soglia zero nei due sensi. Nuovi saldi positivi e saldi chiusi possono compensarsi."),
           "AdrBalCnt(t) − AdrBalCnt(t−30d)", inputs=(one("AdrBalCnt"), one("AdrBalCnt", lag=30)), apply=lambda a, b: a - b),
    recipe("supply-change", HOLD, "native units", STOCK, "Net supply change · 30 days",
           "Follows how the outstanding stock changes after issuance, redemption, burns and other accounting events.",
           "Attribution to individual processes requires issuance, burn, redemption or migration data.",
           ("Variazione netta dell’offerta · 30 giorni", "Segue come cambia lo stock dopo emissioni, riscatti, burn e altri movimenti contabili.",
            "Il saldo netto lascia aperta l’attribuzione ai singoli processi."),
           "SplyCur(t) − SplyCur(t−30d)", inputs=(one("SplyCur"), one("SplyCur", lag=30)), apply=lambda a, b: a - b),
    recipe("supply-growth-365", HOLD, "%", STOCK, "Net supply growth · 365 days",
           "Normalizes net stock growth to the outstanding units one year earlier.",
           "A small baseline can amplify percentage changes. Changes can reflect protocol rules, migration and supply estimates.",
           ("Crescita netta dell’offerta · 365 giorni", "Normalizza la crescita netta rispetto alle unità presenti un anno prima.",
            "Una base iniziale piccola amplifica le variazioni percentuali. Regole di protocollo, migrazioni e stime possono influenzarle."),
           "100 × (SplyCur(t) / SplyCur(t−365d) − 1)", inputs=(one("SplyCur"), one("SplyCur", lag=365)), apply=growth),
    recipe("gross-issuance-rate", HOLD, "%", STOCK, "Gross issuance / initial supply · 365 days",
           "Measures units created in a year relative to the opening stock. This helps distinguish the creation of new units from the persistence of old balances.",
           "Issuance is gross. The rate can be positive while the outstanding stock contracts.",
           ("Emissione lorda / offerta iniziale · 365 giorni", "Misura le unità create nell’anno rispetto allo stock iniziale. Aiuta a distinguere la creazione di unità dalla permanenza dei saldi esistenti.",
            "L’emissione è lorda. Il tasso può essere positivo mentre lo stock si contrae."),
           "100 × Σ₃₆₅ IssTotNtv / SplyCur(t−365d)", inputs=(one("IssTotNtv", 365), one("SplyCur", lag=365)),
           apply=lambda a, b: ratio(a, b, 100)),
    recipe("supply-per-funded-address", HOLD, "native units/address", STOCK, "Supply per funded address",
           "Relates the stock of units to the number of positive-balance addresses in the provider’s scope.",
           "This aggregate quotient can be skewed by custodians and address reuse. A distribution of balances is needed for Gini.",
           ("Offerta per indirizzo con saldo positivo", "Rapporta le unità nello stock al numero di indirizzi con saldo positivo nell’ambito del provider.",
            "Custodia e riuso degli indirizzi incidono sul quoziente aggregato. Per il Gini serve la distribuzione dei saldi."),
           "SplyCur / AdrBalCnt", inputs=(one("SplyCur"), one("AdrBalCnt")), apply=ratio),
    recipe("inactive-address-floor", HOLD, "%", STOCK, "Inactive funded addresses · 30-day lower bound",
           "Bounds the share of cutoff-funded addresses that could have stayed inactive. Across the preceding 30 days the number of unique active addresses cannot exceed the sum of daily counts.",
           "Zero is an uninformative floor. The bound is about addresses and can be far below their true idle share. Dormant units require balance-age data.",
           ("Indirizzi finanziati inattivi · limite inferiore a 30 giorni", "Fornisce un limite inferiore per la quota di indirizzi finanziati al cutoff che è rimasta inattiva. Nell’arco di 30 giorni gli indirizzi distinti attivi sono al massimo la somma dei conteggi giornalieri.",
            "Uno zero indica un limite inferiore privo di informazione positiva. Il limite riguarda gli indirizzi e può stare ben al di sotto della quota effettiva. Per le unità dormienti serve l’età dei saldi."),
           "100 × max(0, AdrBalCnt − Σ₃₀ AdrActCnt) / AdrBalCnt",
           inputs=(one("AdrBalCnt"), one("AdrActCnt", 30)), apply=inactivity),
    recipe("exchange-share", HOLD, "%", STOCK, "Share of supply at known exchanges",
           "Shows the proportion of outstanding units held at known exchange addresses. Persistent custodial balances can aggregate many claims.",
           "This observes attributed custody. Address-level custody concentration, economic ownership and willingness to spend are different quantities.",
           ("Quota dell’offerta sugli exchange identificati", "Mostra la quota di unità detenute negli indirizzi degli exchange identificati, che possono aggregare molte posizioni.",
            "Misura la custodia attribuita. Concentrazione per indirizzo, proprietà economica e intenzione di spendere sono quantità distinte."),
           "100 × SplyExNtv / SplyCur", inputs=(one("SplyExNtv"), one("SplyCur")), apply=lambda a, b: ratio(a, b, 100)),
    recipe("exchange-value", HOLD, "USD", CONTEXT, "Exchange balances × closing price",
           "Applies the proposal’s USD valuation to the measured stock held by known exchanges.",
           "Compare the native-unit stock to distinguish changes in custody from price changes. The provider also publishes a USD series for this stock.",
           ("Saldi sugli exchange × prezzo di chiusura", "Applica la valutazione in USD del proposal allo stock osservato sugli exchange identificati.",
            "Il saldo in unità native distingue movimenti di custodia da variazioni di prezzo. Il provider pubblica anche una serie in USD per lo stesso stock."),
           "SplyExNtv × PriceUSD", inputs=(one("SplyExNtv"), one("PriceUSD")), apply=lambda a, b: a * b),
    recipe("implied-realized-cap", HOLD, "USD", CONTEXT, "Implied realized capitalization",
           "Reconstructs realized capitalization from two public series. This retains the provider’s valuation based on prior movement or accounting cost basis where its methodology supports it.",
           "The public ratio can be rounded. Asset-specific treatment of accounts and price is inherited from Coin Metrics.",
           ("Capitalizzazione realizzata implicita", "Ricostruisce la capitalizzazione realizzata da due serie pubbliche. Mantiene la valutazione del provider basata sui movimenti passati o sul costo contabile secondo la sua metodologia.",
            "Il rapporto pubblico può essere arrotondato. La misura eredita il trattamento di conto e prezzo del provider."),
           "CapMrktCurUSD / CapMVRVCur", inputs=(one("CapMrktCurUSD"), one("CapMVRVCur")), apply=ratio),
    recipe("projected-additional-supply", HOLD, "native units", CONTEXT, "Additional supply implied over ten years",
           "Subtracts the measured current stock from the provider’s projected stock to expose how much new supply the observed schedule would add.",
           "Future rule changes and events outside the provider’s forecast can change the outcome.",
           ("Offerta aggiuntiva prevista in dieci anni", "Sottrae lo stock corrente da quello proiettato per mostrare quante unità in più implicherebbe il piano osservato.",
            "Modifiche future delle regole ed eventi fuori previsione possono cambiare l’esito."),
           "SplyExpFut10yr − SplyCur", inputs=(one("SplyExpFut10yr"), one("SplyCur")), apply=lambda a, b: a - b),
    window_mean("TxCnt", "transactions/day", "Recorded transactions · 30-day mean",
                "Transazioni registrate · media 30 giorni", "Smooths daily variations in the rate of operations recorded by the ledger.",
                "Smussa le variazioni giornaliere nel ritmo delle operazioni registrate.",
                "The count can include failed transactions or many actions batched together.",
                "Il conteggio può includere tentativi falliti o azioni raggruppate."),
    window_mean("TxTfrCnt", "transfers/day", "Positive-value transfers · 30-day mean",
                "Trasferimenti di valore · media 30 giorni", "Smooths the frequency of positive-value movements across ledger entities.",
                "Smussa la frequenza degli spostamenti di valore fra entità del ledger.",
                "Transfer amounts and the age of moved units require distinct measurements.",
                "Ammontare dei trasferimenti ed età delle unità mosse richiedono misure proprie."),
    window_mean("AdrActCnt", "addresses/day", "Active addresses · 30-day mean",
                "Indirizzi attivi · media 30 giorni", "Smooths daily address participation without interpreting the participants as users.",
                "Smussa la partecipazione giornaliera misurata per indirizzo.",
                "Repeating activity contributes on each day. A 30-day mean cannot recover distinct addresses over that month.",
                "L’attività ripetuta contribuisce in ogni giorno. Per gli indirizzi distinti del mese serve la loro unione."),
    window_mean("FeeTotNtv", "native units/day", "On-chain fees · 30-day mean",
                "Commissioni on-chain · media 30 giorni",
                "Smooths the amount paid for including operations and gives context for sustained activity.",
                "Smussa quanto viene pagato per includere operazioni e contestualizza un’attività prolungata.",
                "Fee policy, demand and transaction type affect the trend.",
                "Regole sulle commissioni, domanda e tipo di transazione influenzano la tendenza.", CONTEXT),
    recipe("transfers-per-transaction", FLOW, "transfers/transaction", MOVEMENT, "Transfers per recorded transaction · 30 days",
           "Shows the number of positive-value movements recorded per transaction. This helps interpret circulation when transactions batch many actions.",
           "Protocol conventions and zero-transfer transactions change this rate. It can exceed one.",
           ("Trasferimenti per transazione · 30 giorni", "Mostra quanti spostamenti di valore si registrano per transazione. È utile quando le transazioni raggruppano molte azioni.",
            "Convenzioni di protocollo e transazioni senza trasferimenti cambiano il rapporto. Può superare uno."),
           "Σ₃₀ TxTfrCnt / Σ₃₀ TxCnt", inputs=(one("TxTfrCnt", 30), one("TxCnt", 30)), apply=ratio),
    recipe("transactions-per-active-address", FLOW, "transactions/address-day", MOVEMENT, "Transactions per active address-day · 30 days",
           "Relates transaction frequency to daily address participation. Persistent balances can coexist with different intensities of use.",
           "A transaction can involve several active addresses, including recipients. This is an aggregate intensity over address-days.",
           ("Transazioni per indirizzo-giorno attivo · 30 giorni", "Rapporta la frequenza delle transazioni alla partecipazione giornaliera. Saldi persistenti possono convivere con varie intensità di utilizzo.",
            "Una transazione può coinvolgere più indirizzi attivi, inclusi i destinatari. La misura è un’intensità aggregata."),
           "Σ₃₀ TxCnt / Σ₃₀ AdrActCnt", inputs=(one("TxCnt", 30), one("AdrActCnt", 30)), apply=ratio),
    recipe("activity-per-funded", FLOW, "addresses/day per 100 funded", MOVEMENT, "Daily activity per 100 funded addresses",
           "Puts mean daily participation alongside the cutoff stock of funded addresses. It can flag activity that grows at a different rate from holdings.",
           "The active pool can include addresses without a balance at cutoff. This intensity may exceed 100 and measures no overlap between the pools.",
           ("Attivi giornalieri per 100 indirizzi finanziati", "Rapporta la partecipazione giornaliera media allo stock di indirizzi finanziati al cutoff. Evidenzia ritmi diversi di attività e detenzione.",
            "Fra gli attivi possono esserci indirizzi senza saldo al cutoff. Il rapporto può superare 100 e lascia ignota l’intersezione fra i due insiemi."),
           "100 × (Σ₃₀ AdrActCnt / 30) / AdrBalCnt", inputs=(one("AdrActCnt", 30), one("AdrBalCnt")),
           apply=lambda a, b: ratio(a / 30, b, 100)),
    recipe("fees-per-transaction", FLOW, "native units/transaction", CONTEXT, "Mean fee per recorded transaction · 30 days",
           "Relates fees paid to the volume of recorded transactions over 30 complete days. This adds cost context to activity comparisons.",
           "This is an aggregate average. Protocol-specific fee accounting and failed attempts can affect both inputs.",
           ("Commissione media per transazione · 30 giorni", "Rapporta le commissioni alle transazioni registrate su 30 giorni completi, contestualizzando il costo dell’attività.",
            "È una media aggregata. Regole contabili delle commissioni e tentativi falliti possono influire sugli input."),
           "Σ₃₀ FeeTotNtv / Σ₃₀ TxCnt", inputs=(one("FeeTotNtv", 30), one("TxCnt", 30)), apply=ratio),
    recipe("fees-usd", FLOW, "USD/day", CONTEXT, "Transaction fees × closing price",
           "Values fees in USD at the daily closing price. It makes the denomination explicit when considering the cost of recorded activity.",
           "Price can change the result even with identical native-unit fees. It applies the closing price to the whole day.",
           ("Commissioni × prezzo di chiusura", "Valuta le commissioni in USD al prezzo giornaliero di chiusura, esplicitando la denominazione del costo.",
            "Il prezzo modifica il risultato anche a commissioni invariate. La valutazione è alla chiusura del giorno."),
           "FeeTotNtv × PriceUSD", inputs=(one("FeeTotNtv"), one("PriceUSD")), apply=lambda a, b: a * b),
    recipe("exchange-net", FLOW, "native units/day", MOVEMENT, "Net flow into known exchanges",
           "Calculates the balance of deposits and withdrawals at labelled exchanges for the same day. Positive values indicate net movement toward known custody.",
           "Daily netting conceals simultaneous turnover in both directions. Net flows and wallet stocks may diverge when address coverage changes.",
           ("Flusso netto verso gli exchange identificati", "Calcola il saldo di depositi e prelievi verso gli exchange identificati nello stesso giorno. Un valore positivo indica movimento netto verso la custodia osservata.",
            "Il saldo nasconde movimenti simultanei nei due sensi. Flusso e stock possono divergere quando cambia la copertura degli indirizzi."),
           "FlowInExNtv − FlowOutExNtv", inputs=(one("FlowInExNtv"), one("FlowOutExNtv")), apply=lambda a, b: a - b),
    recipe("exchange-net-usd", FLOW, "USD/day", CONTEXT, "USD value of net exchange flow",
           "Values the net direction of the observed exchange flows in USD.",
           "Attribution and price matter. Gross deposits and withdrawals can both be high when the net value is near zero.",
           ("Flusso netto sugli exchange in USD", "Valuta in USD la direzione netta dei flussi osservati sugli exchange.",
            "Attribuzione e prezzo contano. Depositi e prelievi lordi possono essere elevati anche con saldo prossimo a zero."),
           "FlowInExUSD − FlowOutExUSD", inputs=(one("FlowInExUSD"), one("FlowOutExUSD")), apply=lambda a, b: a - b),
    recipe("exchange-turnover", FLOW, "% of opening custody stock", MOVEMENT, "Gross exchange movement / opening stock",
           "Relates deposits plus withdrawals in 30 days to the known exchange stock at the start of the window. This contrasts activity with a stock that can persist.",
           "Repeated movement can make turnover exceed 100%. Coverage is tied to labelled on-chain exchange activity.",
           ("Movimenti lordi sugli exchange / stock iniziale", "Rapporta depositi e prelievi in 30 giorni allo stock sugli exchange all’inizio della finestra. Confronta l’attività con uno stock che può persistere.",
            "Movimenti ripetuti possono superare il 100%. La copertura dipende dall’attività on-chain attribuita agli exchange."),
           "100 × (Σ₃₀ FlowInExNtv + Σ₃₀ FlowOutExNtv) / SplyExNtv(t−30d)",
           inputs=(one("FlowInExNtv", 30), one("FlowOutExNtv", 30), one("SplyExNtv", lag=30)),
           apply=lambda a, b, c: ratio(a + b, c, 100)),
)

INDICATORS = (*RECIPES[:4], *RAW, *RECIPES[4:])
