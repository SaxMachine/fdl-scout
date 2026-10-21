# Architettura

FDL Scout è un sito statico. Non ha server applicativo, account o database online: GitHub Pages serve file fissi e tutto il lavoro avviene nel browser di chi lo usa.

```
data/codings/*.yaml ─┐
data/cafd.yaml ──────┼─ scripts/build.py ──> dist/db.json ─┐
                     │   (valida lo schema)                 │
web/  src/ ──────────┴────────────────────> dist/ ──────────┤
                                                            ▼
            FWL dell'utente ──> parser ──> centraline ──> matcher ──> report
                                                    └──> footprint ──> impronta .json
```

## Moduli (`src/`)

Sono moduli ES senza dipendenze, usati identici dal browser e dai test Node.

**`parser.js`**: trasforma il testo di un FWL in `{cafd, ecuHint, vinFound, params}`. Il formato non è documentato e cambia tra versioni di E-Sys, quindi il parser è tollerante: divide ogni riga per tab, poi per spazi multipli, poi per spazi singoli, e considera parametro ogni riga che inizia con un nome valido seguito da un valore. Scarta i segnaposto `UnknowParam…`. `identifyEcu` decide la centralina guardando, in ordine, il nome nel file o nell'intestazione, l'identificativo CAFD (`data/cafd.yaml`) e infine le "firme", cioè parametri che esistono solo in una centralina.

**`matcher.js`**: per ogni voce del database assegna uno stato (attivabile, regolabile, già attiva, non disponibile, centralina non letta, da mappare). `unexplored` elenca i parametri degli FWL che nessuna voce usa, filtrando tabelle tecniche e dati di produzione. `esysChecklist` produce la lista di lavoro testuale.

**`footprint.js`**: costruisce l'impronta anonima. Toglie i parametri il cui nome suggerisce un identificativo (VIN, numeri di serie, chiavi, indirizzi MAC) e quelli il cui valore contiene un VIN.

## Pagina (`web/`)

`index.html`, `styles.css`, `app.js` e `i18n.js`, senza framework né build JavaScript. La lingua scelta resta salvata nel browser; i file caricati no, spariscono alla chiusura della pagina.

## Decisioni

- **Nessun upload.** È la garanzia più semplice da spiegare e da verificare: il codice è leggibile e la scheda Rete del browser lo conferma.
- **Nessuna scrittura sull'auto.** Un errore del parser non può mai bloccare una centralina.
- **YAML per il database.** Leggibile e modificabile da chiunque con una pull request, con revisione riga per riga. Il JSON per il browser viene generato.
- **Python per il build.** PyYAML è disponibile di serie su quasi tutte le distribuzioni Linux; il progetto non ha dipendenze npm.

## Da fare

- Validare il parser su FWL reali di versioni diverse di E-Sys e aggiungerne estratti anonimi in `tests/fixtures/`.
- Ospitare i font nel repository, così la pagina non contatta nemmeno Google Fonts.
- Script che confronta più impronte e propone nuove voci (parametri che cambiano tra allestimenti).
- Traduzione inglese di titoli e note.
- Estendere il perimetro ad altri telai F e poi G.
