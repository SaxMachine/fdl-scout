# FDL Scout

**Quali codifiche puoi fare alla tua MINI?** Trascini nel browser gli FWL esportati da E-Sys e FDL Scout ti dice, centralina per centralina, quali codifiche sono già attive, quali puoi attivare, quali hanno un valore a scelta e quali parametri nessuno ha ancora documentato.

*[English below](#english)*

- **Tutto nel browser.** I file non vengono caricati da nessuna parte: il parsing avviene sul tuo computer. Gli FWL contengono VIN e configurazione dell'auto, e lì restano.
- **Sola lettura.** FDL Scout non scrive mai sull'auto. Ti prepara una lista di lavoro, poi la modifica la fai tu in E-Sys, con il tuo backup.
- **Un database aperto e verificabile.** Ogni codifica è una voce YAML con parametri, valori, rischio, fonti e le auto su cui è stata osservata.
- **Scoperta collettiva.** I parametri dei tuoi FWL che il database non conosce finiscono in "Da scoprire". Con un clic esporti un'impronta anonima da condividere: confrontando auto diverse emergono le codifiche nuove.

Perimetro attuale: **MINI F5x** (F54, F55, F56, F57, F60) con head unit NBT EVO. Il database parte da 114 voci raccolte su una F54 Cooper S ALL4 del 2022 (i-level F056-26-03-519) e verificate sui suoi FWL reali: tutti i nomi dei parametri esistono davvero nelle centraline, e 16 centraline vengono riconosciute in automatico.

## Come si usa

1. In E-Sys leggi l'FDL di ogni centralina che ti interessa ed esportalo come testo (FWL). Esporta anche la FA (il file XML con i codici SA): non è obbligatoria, ma permette di scartare le codifiche che richiedono optional che non hai.
2. Apri FDL Scout e trascina tutti i file nella pagina, FA compresa.
3. Controlla che ogni file sia stato riconosciuto con la centralina giusta. I file di E-Sys si chiamano solo `CAFD_<numero>`: FDL Scout li riconosce dal CAFD o dai parametri tipici. Se sbaglia, correggi con "Cambia centralina".
4. Spunta le codifiche che vuoi fare e apri **Lista per E-Sys**: è l'elenco parametro per parametro, valore attuale e nuovo, da copiare o scaricare.
5. In E-Sys: backup FDL, modifica, scrittura. Una centralina alla volta.

### Cosa significano gli stati

| Stato | Significato |
|---|---|
| Attivabile | Tutti i parametri esistono nel tuo CAFD e almeno uno non è ancora al valore indicato |
| Regolabile | I parametri esistono e il valore è a tua scelta (tempi, soglie, luminosità) |
| Già attiva | Tutti i parametri sono già al valore indicato |
| Manca l'optional | Hai caricato la FA e non c'è l'optional (SA) che la funzione richiede |
| Non disponibile | La centralina è stata letta ma il tuo CAFD non ha questo parametro |
| Centralina non letta | Manca l'FWL di quella centralina |
| Da mappare | La funzione è nota ma i nomi dei parametri non sono ancora documentati |

"Attivabile" vuol dire che il parametro esiste, non che la funzione funzionerà di sicuro: alcune voci richiedono hardware (SA) o altre centraline. Leggi sempre le note e il livello di rischio.

## Eseguire in locale

Serve Python 3 con PyYAML (su Red Hat/Fedora `dnf install python3-pyyaml`) e Node.js 20 o più recente solo per test e server di prova. Nessuna dipendenza npm.

```sh
python3 scripts/build.py        # valida il database e costruisce dist/
node scripts/serve.mjs          # http://localhost:8080
node --test tests/*.test.js     # test del motore
```

Nella cartella `examples/` ci sono quattro FWL di esempio per provare la pagina. Sono ricostruiti dai valori documentati nel database, non sono export reali.

## Contribuire

Il progetto cresce con le auto della comunità. Il modo più semplice di aiutare è inviare un'impronta (scheda **Contribuisci** della pagina). Per aggiungere o correggere codifiche leggi [CONTRIBUIRE.md](CONTRIBUIRE.md). Lo schema delle voci è in [docs/SCHEMA.md](docs/SCHEMA.md), il funzionamento interno in [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md).

## Avvertenze

Codificare una centralina può renderla inutilizzabile se qualcosa va storto. Usa un alimentatore, salva sempre l'FDL prima di scrivere e cambia una cosa alla volta. Alcune codifiche (video in movimento, luci) possono rendere l'auto non conforme all'omologazione: il database le segnala, la responsabilità resta di chi codifica. Un aggiornamento in officina ricodifica tutto dalla FA e cancella le modifiche FDL.

FDL Scout non è affiliato a BMW AG o MINI. Il repository non contiene e non accetterà mai PSdZData, CAFD, E-Sys, launcher o altro materiale BMW: solo nomi e valori dei parametri e descrizioni scritte dai contributori.

## Licenze

- Codice: [GPL-3.0-or-later](LICENSE)
- Database (`data/`): [CC BY-SA 4.0](data/LICENSE)

---

<a id="english"></a>

## English

**What can you code on your MINI?** Drop the FWL files exported from E-Sys into your browser and FDL Scout tells you, unit by unit, which coding is already on, which you can enable, which takes a value of your choice, and which parameters nobody has documented yet.

- **Runs entirely in the browser.** Files are never uploaded; parsing happens on your computer.
- **Read only.** FDL Scout never writes to the car. It gives you a work list; you make the change in E-Sys with your own backup.
- **Open, checkable database.** Each coding is a YAML entry with parameters, values, risk, sources and the cars it was observed on.
- **Collective discovery.** Parameters the database does not know show up under "To discover". Export an anonymous footprint in one click to share it.

Current scope: **MINI F5x** (F54, F55, F56, F57, F60) with NBT EVO. The database starts from 106 entries gathered on a 2022 F54 Cooper S ALL4. Entry titles and notes are in Italian for now; English translations are a great first contribution (add `en:` next to `it:`).

Build and run: `python3 scripts/build.py && node scripts/serve.mjs`, tests with `node --test tests/*.test.js`. See [CONTRIBUIRE.md](CONTRIBUIRE.md) (bilingual) to contribute.

Code: GPL-3.0-or-later. Database: CC BY-SA 4.0. Not affiliated with BMW AG or MINI. Code at your own risk and always back up the FDL first.
