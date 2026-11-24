"""Chart method notes for the monthly Bitcoin address distribution."""
METHODS = {
    'gini_grouped_floor': {
        'it': 'A fine mese si collegano le quote cumulate di indirizzi e BTC ai confini di 14 fasce ordinate. Uno meno il doppio dell’area sotto la spezzata dà il limite inferiore del Gini. La disuguaglianza dentro ogni fascia resta sconosciuta.',
        'fr': 'À chaque fin de mois, on relie les parts cumulées des adresses et des BTC aux limites des 14 tranches ordonnées. Un moins deux fois l’aire sous cette ligne donne une borne inférieure du Gini. Les écarts au sein de chaque tranche restent inconnus.',
        'de': 'Am Monatsende werden die kumulierten Anteile der Adressen und BTC an den Grenzen von 14 Guthabenklassen verbunden. Eins minus die doppelte Fläche unter diesem Polygonzug ergibt eine Untergrenze des Gini-Koeffizienten. Unterschiede innerhalb jeder Klasse bleiben unbekannt.',
    },
    'gini_address': {
        'it': 'Per ogni fine mese del 2009 si ricostruiscono gli accrediti e gli output spesi per ciascuno script riconosciuto. Si ordinano tutti i saldi positivi. Con rango i a partire da uno, Gini = Σ(2i−n−1)bᵢ / (nΣbᵢ). I totali di tutte le fasce sono verificati in satoshi.',
        'fr': 'Pour chaque fin de mois de 2009, on reconstruit les sorties reçues et dépensées par script reconnu. Tous les soldes positifs sont triés. Pour des rangs i commençant à un, Gini = Σ(2i−n−1)bᵢ / (nΣbᵢ). Les totaux de chaque tranche sont vérifiés en satoshis.',
        'de': 'Für jedes Monatsende 2009 werden erzeugte und ausgegebene Outputs je erkanntem Skript verrechnet. Alle positiven Guthaben werden aufsteigend geordnet. Für Ränge i ab eins gilt Gini = Σ(2i−n−1)bᵢ / (nΣbᵢ). Alle Klassensummen sind in Satoshis geprüft.',
    },
    'top10_share': {
        'it': 'Per ogni fine mese del 2009, la somma dei dieci saldi più elevati è divisa per la somma di tutti i saldi positivi. I ranghi provengono dagli output ricevuti e spesi da ciascuno script riconosciuto.',
        'fr': 'Pour chaque fin de mois de 2009, la somme des dix soldes les plus élevés est divisée par le total de tous les soldes positifs. Le classement découle des sorties reçues et dépensées par script reconnu.',
        'de': 'Für jedes Monatsende 2009 wird die Summe der zehn größten Guthaben durch die Summe aller positiven Guthaben geteilt. Die Rangfolge folgt aus den erzeugten und ausgegebenen Outputs je erkanntem Skript.',
    },
    'top100_share': {
        'it': 'Nel 2009 si ordinano tutti i saldi positivi. Nei mesi successivi si pubblicano solo i valori esatti per cui le fasce più alte contengono esattamente 100 indirizzi. Il denominatore è la somma dei BTC in tutte le fasce positive.',
        'fr': 'En 2009, tous les soldes positifs sont classés. Ensuite, une part exacte est publiée uniquement lorsque les tranches supérieures contiennent exactement 100 adresses. Le dénominateur est la somme des BTC de toutes les tranches positives.',
        'de': 'Für 2009 werden alle positiven Guthaben geordnet. Für spätere Monate wird der exakte Anteil nur ausgewiesen, wenn die obersten Klassen genau 100 Adressen enthalten. Der Nenner umfasst die BTC aller positiven Guthabenklassen.',
    },
}

SCOPE = {
    'it': 'Indirizzi Bitcoin con saldo positivo negli script riconosciuti da Bitview. Gli indirizzi di exchange, contratto e burn rimangono inclusi quando lo script è riconosciuto. I saldi nulli e gli script sconosciuti sono esclusi. Gli indirizzi non sono raggruppati per proprietario.',
    'fr': 'Adresses Bitcoin à solde positif dont le script est reconnu par Bitview. Les adresses d’échange, de contrat et de destruction sont incluses si leur script est reconnu. Les soldes nuls et les scripts inconnus sont exclus. Aucun regroupement par propriétaire.',
    'de': 'Bitcoin-Adressen mit positivem Guthaben in von Bitview erkannten Skripten. Börsen-, Vertrags- und Burn-Adressen sind bei erkanntem Skript enthalten. Nullsalden und unbekannte Skripte sind ausgeschlossen. Adressen werden nicht nach Eigentümer zusammengefasst.',
}
