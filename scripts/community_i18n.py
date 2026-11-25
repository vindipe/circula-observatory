"""Localizations of the monthly aggregation rules and scope caveats."""

LANGS = ("it", "fr", "de")
TEXT = {
    "TxCnt": (
        "Somma delle transazioni giornaliere. Una transazione può includere più operazioni o nessun trasferimento. Sono escluse le modifiche imposte dal protocollo.",
        "Somme des transactions quotidiennes. Une transaction peut englober plusieurs opérations ou aucun transfert. Les changements imposés par le protocole sont exclus.",
        "Summe der täglichen Transaktionen. Eine Transaktion kann mehrere Vorgänge oder keine Übertragung enthalten. Vom Protokoll vorgeschriebene Änderungen sind ausgeschlossen.",
    ),
    "TxTfrCnt": (
        "Somma dei trasferimenti giornalieri di importo positivo tra entità distinte del registro. Una transazione può includere più trasferimenti.",
        "Somme des transferts quotidiens de montant positif entre entités distinctes du registre. Une transaction peut inclure plusieurs transferts.",
        "Summe der täglichen Übertragungen mit positivem Betrag zwischen verschiedenen Ledger-Einheiten. Eine Transaktion kann mehrere Übertragungen umfassen.",
    ),
    "AdrActCnt": (
        "Ogni indirizzo si conta una volta per giorno UTC. Un indirizzo attivo in due giorni contribuisce due volte al totale mensile. Il voto può costituire attività sul registro.",
        "Chaque adresse est comptée une fois par jour UTC. Une adresse active deux jours contribue deux fois au total mensuel. Un vote peut constituer une activité sur le registre.",
        "Jede Adresse zählt einmal pro UTC-Tag. Eine an zwei Tagen aktive Adresse geht zweimal in die Monatssumme ein. Abstimmungen können als Aktivität im Ledger gelten.",
    ),
    "AdrBalCnt": (
        "Numero di indirizzi con saldo positivo a fine mese. I saldi nulli sono esclusi. La fonte non fornisce raggruppamenti per titolare né i pesi dei singoli saldi.",
        "Nombre d’adresses à solde positif en fin de mois. Les soldes nuls sont exclus. La source ne fournit ni regroupement par propriétaire ni pondération par solde.",
        "Anzahl der Adressen mit positivem Guthaben zum Monatsende. Nullsalden sind ausgeschlossen. Eine Zuordnung zu Eigentümern und die Gewichtung einzelner Guthaben fehlen.",
    ),
    "SplyCur": (
        "Offerta corrente secondo Coin Metrics alla fine dell’ultimo giorno UTC del mese, nell’unità nativa dell’asset.",
        "Offre courante selon Coin Metrics à la clôture du dernier jour UTC de chaque mois, en unités natives de l’actif.",
        "Aktuelle Menge laut Coin Metrics am Ende des letzten UTC-Tags jedes Monats, in der nativen Einheit des Vermögenswerts.",
    ),
    "BlkCnt": (
        "Somma mensile dei blocchi aggiunti ogni giorno alla catena principale. L’unità di misura è il blocco.",
        "Somme mensuelle des blocs ajoutés chaque jour à la chaîne principale. L’unité de mesure est le bloc.",
        "Monatliche Summe der täglich zur Hauptkette hinzugefügten Blöcke. Die Maßeinheit ist der Block.",
    ),
    "coinbase": (
        "Le transazioni coinbase sono escluse.",
        "Les transactions coinbase sont exclues.",
        "Coinbase-Transaktionen sind ausgeschlossen.",
    ),
    "unresolved": (
        "La fonte identifica l’asset con il proprio codice. Rete ospitante e deployment restano da verificare.",
        "La source identifie l’actif par son code. Le réseau hôte et le déploiement restent à vérifier.",
        "Die Quelle identifiziert den Vermögenswert über seinen Code. Netzwerk und Deployment sind noch ungeprüft.",
    ),
    "internal": (
        "Per Ethereum sono inclusi i trasferimenti interni e sono esclusi gli invii a sé stessi e i trasferimenti falliti.",
        "Pour Ethereum, les transferts internes sont inclus. Les envois à soi-même et les transferts échoués sont exclus.",
        "Bei Ethereum sind interne Übertragungen enthalten. Eigenübertragungen und fehlgeschlagene Übertragungen sind ausgeschlossen.",
    ),
    "token": (
        "La serie riguarda il solo deployment di questo token.",
        "La série couvre ce déploiement du jeton.",
        "Die Reihe erfasst dieses einzelne Token-Deployment.",
    ),
    "aggregate": (
        "Aggregato del fornitore. Le serie dei singoli deployment si sovrappongono a questo totale.",
        "Agrégat du fournisseur. Les séries des déploiements individuels recoupent ce total.",
        "Aggregat des Anbieters. Die Reihen einzelner Deployments überschneiden sich mit diesem Gesamtwert.",
    ),
}


def translations(parts):
    return {lang: " ".join(TEXT[part][i] for part in parts) for i, lang in enumerate(LANGS)}
