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

**`parser.js`**: trasforma il testo di un FWL in `{cafd, cafdVersion, ecuHint, vinFound, params}`. Il formato reale di E-Sys è una riga `CAF_ID:05 00 00 16 EE 113 118 002` seguita da righe `NOME: valore [byte esadecimali]`; nomi e valori possono contenere spazi. Ogni parametro conserva il valore leggibile e il dato esadecimale. `UnknowParam05 [05]` diventa un valore senza nome uguale a `05`. Il VIN viene riconosciuto anche quando è scritto in byte esadecimali (ATM, KAFAS, KOMBI). Resta un percorso di riserva per righe separate da tab o spazi. `identifyEcu` decide la centralina guardando, in ordine, il nome nel file o nell'intestazione, l'identificativo CAFD (`data/cafd.yaml`) e infine le "firme", cioè parametri che esistono solo in una centralina.

**`matcher.js`**: per ogni voce del database assegna uno stato (attivabile, regolabile, già attiva, non disponibile, centralina non letta, da mappare). `unexplored` elenca i parametri degli FWL che nessuna voce usa, filtrando tabelle tecniche e dati di produzione. `esysChecklist` produce la lista di lavoro testuale.

**`fa.js`**: legge la FA XML di E-Sys e ne estrae serie, codice tipo, data di produzione e codici SA/E/HO. Non legge mai il VIN dell'intestazione.

**`footprint.js`**: costruisce l'impronta anonima. Toglie VIN e VIN corto (anche in esadecimale), numero del concessionario, date di codifica, identificativi di fabbrica, firme crittografiche e qualsiasi valore che contenga un VIN. Gli stessi parametri vengono nascosti anche dalla lista "Da scoprire".

## Pagina (`web/`)

`index.html`, `styles.css`, `app.js` e `i18n.js`, senza framework né build JavaScript. La lingua scelta resta salvata nel browser; i file caricati no, spariscono alla chiusura della pagina.

## Decisioni

- **Nessun upload.** È la garanzia più semplice da spiegare e da verificare: il codice è leggibile e la scheda Rete del browser lo conferma.
- **Nessuna scrittura sull'auto.** Un errore del parser non può mai bloccare una centralina.
- **YAML per il database.** Leggibile e modificabile da chiunque con una pull request, con revisione riga per riga. Il JSON per il browser viene generato.
- **Python per il build.** PyYAML è disponibile di serie su quasi tutte le distribuzioni Linux; il progetto non ha dipendenze npm.

## Da fare

- Validare il parser su FWL di altre versioni di E-Sys e altre auto.
- Mappare SAS e PMA (sensori di parcheggio) appena disponibili i loro FWL.
- Ospitare i font nel repository, così la pagina non contatta nemmeno Google Fonts.
- Script che confronta più impronte e propone nuove voci (parametri che cambiano tra allestimenti).
- Traduzione inglese di titoli e note.
- Estendere il perimetro ad altri telai F e poi G.
