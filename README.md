# FDL Scout

**Quali codifiche puoi fare alla tua BMW o MINI?** Trascini nel browser gli FWL esportati da E-Sys e FDL Scout ti dice, centralina per centralina, quali codifiche sono già attive, quali puoi attivare, quali hanno un valore a scelta e quali parametri nessuno ha ancora documentato.

### 👉 [Apri FDL Scout](https://saxmachine.github.io/fdl-scout/)

Non devi installare niente: apri il link, trascina i tuoi file e basta. Funziona da qualsiasi browser e i file restano sul tuo computer.

*[English below](#english)*

- **Tutto nel browser.** I file non vengono caricati da nessuna parte: il parsing avviene sul tuo computer. Gli FWL contengono VIN e configurazione dell'auto, e lì restano.
- **Sola lettura.** FDL Scout non scrive mai sull'auto. Ti prepara una lista di lavoro, poi la modifica la fai tu in E-Sys, con il tuo backup.
- **Un database aperto e verificabile.** Ogni codifica è una voce YAML con parametri, valori, rischio, fonti e le auto su cui è stata osservata.
- **Scoperta collettiva.** I parametri dei tuoi FWL che il database non conosce finiscono in "Da scoprire". Con un clic esporti un'impronta anonima da condividere: confrontando auto diverse emergono le codifiche nuove.

Perimetro: **BMW e MINI serie F**. E-Sys e il formato FWL sono gli stessi per tutte, quindi la pagina legge i file di qualsiasi auto della serie F. Il database ha 311 voci raccolte da forum (anche giapponesi e tedeschi), dall'elenco BimmerCode, da guide PDF e dai cheat sheet di E-Sys pubblicati su GitHub, e tutte sono state verificate sui FWL reali di una MINI F54 Cooper S ALL4 del 2022 (i-level F056-26-03-519): ogni parametro esiste davvero in quella centralina. Molte codifiche sono documentate anche su BMW (F01/F10, F20/F30, F15/F25, F45/F48), ma i dati delle auto vere vengono finora da una sola MINI. Le BMW sulla stessa piattaforma (Serie 2 Active/Gran Tourer F45/F46, X1 F48, X2 F39) hanno centraline molto simili; le altre serie F (F20/F30, F10, F15…) usano in parte centraline diverse, come il FEM al posto del BDC. Ogni voce indica in `telai` su quali modelli è documentata, e la pagina avvisa quando la tua FA è di un telaio diverso. Per le BMW il database crescerà con le impronte della comunità. Titoli, note e valori suggeriti sono in italiano e in inglese.

## Come si usa

Apri **[https://saxmachine.github.io/fdl-scout/](https://saxmachine.github.io/fdl-scout/)**.

Guida passo passo all'esportazione da E-Sys: [docs/ESPORTARE-DA-ESYS.md](docs/ESPORTARE-DA-ESYS.md).

1. In E-Sys leggi l'FDL di ogni centralina che ti interessa ed esportalo come testo (FWL). Esporta anche la FA (il file XML con i codici SA): non è obbligatoria, ma permette di scartare le codifiche che richiedono optional che non hai.
2. Apri [FDL Scout](https://saxmachine.github.io/fdl-scout/) e trascina tutti i file nella pagina, FA compresa.
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

Solo per chi vuole modificare il codice o il database. Per usare FDL Scout basta il [sito](https://saxmachine.github.io/fdl-scout/).

Serve Python 3 con PyYAML (su Red Hat/Fedora `dnf install python3-pyyaml`) e Node.js 20 o più recente solo per test e server di prova. Nessuna dipendenza npm.

```sh
python3 scripts/build.py        # valida il database e costruisce dist/
node scripts/serve.mjs          # http://localhost:8080
node --test tests/*.test.js     # test del motore
```

Nella cartella `examples/` ci sono quattro FWL e una FA di esempio, nel formato di E-Sys, per provare la pagina. Sono ricostruiti dai valori documentati nel database, non sono export reali.

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

**What can you code on your BMW or MINI?** Drop the FWL files exported from E-Sys into your browser and FDL Scout tells you, unit by unit, which coding is already on, which you can enable, which takes a value of your choice, and which parameters nobody has documented yet.

### 👉 [Open FDL Scout](https://saxmachine.github.io/fdl-scout/)

Nothing to install: open the link, drop your files and that's it. It works in any browser and your files stay on your computer.

- **Runs entirely in the browser.** Files are never uploaded anywhere: parsing happens on your computer. FWL files contain the VIN and the car's configuration, and they stay there.
- **Read only.** FDL Scout never writes to the car. It prepares a work list; you make the change in E-Sys, with your own backup.
- **An open, checkable database.** Each coding is a YAML entry with parameters, values, risk, sources and the cars it was observed on.
- **Collective discovery.** Parameters in your FWL files that the database does not know end up under "To discover". Export an anonymous footprint in one click and share it: comparing different cars brings new coding to light.

Scope: **BMW and MINI F-series**. E-Sys and the FWL format are the same for all of them, so the page reads files from any F-series car. The database has 311 entries gathered from forums (Japanese and German ones too), the BimmerCode list, PDF guides and E-Sys cheat sheets published on GitHub, all checked against the real FWL files of a 2022 MINI F54 Cooper S ALL4 (i-level F056-26-03-519): every parameter really exists in that unit. Many codings are also documented on BMWs (F01/F10, F20/F30, F15/F25, F45/F48), but real-car data so far comes from a single MINI. BMWs on the same platform (2 Series Active/Gran Tourer F45/F46, X1 F48, X2 F39) have very similar units; other F-series (F20/F30, F10, F15…) partly use different units, such as the FEM instead of the BDC. Each entry lists in `telai` the models it is documented on, and the page warns you when your FA is from a different chassis. For BMWs the database will grow with community footprints. Titles, notes and suggested values are available in Italian and English.

### How to use it

Open **[https://saxmachine.github.io/fdl-scout/](https://saxmachine.github.io/fdl-scout/)**.

Step-by-step export guide: [docs/en/EXPORTING-FROM-ESYS.md](docs/en/EXPORTING-FROM-ESYS.md).

1. In E-Sys read the FDL of each unit you care about and save it as text (FWL). Export the FA too (the XML file with the SA codes): it is optional, but it rules out coding that needs options you do not have.
2. Open [FDL Scout](https://saxmachine.github.io/fdl-scout/) and drop all the files on the page, FA included.
3. Check that each file was matched to the right unit. E-Sys files are only called `CAFD_<number>`: FDL Scout recognises them by CAFD or by typical parameters. If it gets one wrong, fix it with "Change unit".
4. Tick the coding you want and open the **E-Sys list**: parameter by parameter, current and new value, to copy or download.
5. In E-Sys: FDL backup, edit, write. One unit at a time.

### What the states mean

| State | Meaning |
|---|---|
| Can be enabled | Every parameter exists in your CAFD and at least one is not at the documented value yet |
| Adjustable | The parameters exist and the value is up to you (times, thresholds, brightness) |
| Already on | Every parameter is already at the documented value |
| Option missing | You loaded the FA and the option (SA) the feature needs is not there |
| Not available | The unit was read but your CAFD does not have this parameter |
| Unit not read | The FWL of that unit is missing |
| Not mapped yet | The feature is known but the parameter names are not documented yet |

"Can be enabled" means the parameter exists, not that the feature is guaranteed to work: some entries need hardware (SA) or other units. Always read the notes and the risk level.

### Running locally

Only if you want to change the code or the database. To use FDL Scout, the [website](https://saxmachine.github.io/fdl-scout/) is all you need.

You need Python 3 with PyYAML (on Red Hat/Fedora `dnf install python3-pyyaml`), and Node.js 20 or newer only for the tests and the local server. No npm dependencies.

```sh
python3 scripts/build.py        # validates the database and builds dist/
node scripts/serve.mjs          # http://localhost:8080
node --test tests/*.test.js     # engine tests
```

The `examples/` folder has four FWL files and an FA in E-Sys format to try the page. They are rebuilt from the values documented in the database, not real exports.

### Contributing

The project grows with the community's cars. The easiest way to help is to send a footprint (the **Contribute** tab on the page). To add or fix coding entries read [CONTRIBUTING.md](CONTRIBUTING.md). The entry schema is in [docs/en/SCHEMA.md](docs/en/SCHEMA.md), the internals in [docs/en/ARCHITECTURE.md](docs/en/ARCHITECTURE.md).

### Warnings

Coding a unit can brick it if something goes wrong. Use a power supply, always save the FDL before writing and change one thing at a time. Some coding (video while driving, lights) can make the car non-compliant with its type approval: the database flags it, but the responsibility stays with whoever codes. A dealer update recodes everything from the FA and wipes FDL changes.

FDL Scout is not affiliated with BMW AG or MINI. The repository does not and will never contain PSdZData, CAFD, E-Sys, launchers or any other BMW material: only parameter names and values, and descriptions written by contributors.

### Licences

- Code: [GPL-3.0-or-later](LICENSE)
- Database (`data/`): [CC BY-SA 4.0](data/LICENSE)
