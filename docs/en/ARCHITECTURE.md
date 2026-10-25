# Architecture

*[Versione italiana](../ARCHITETTURA.md)*

FDL Scout is a static site. It has no application server, no accounts and no online database: GitHub Pages serves fixed files and all the work happens in the user's browser.

```
data/codings/*.yaml ─┐
data/cafd.yaml ──────┼─ scripts/build.py ──> dist/db.json ─┐
                     │   (validates the schema)             │
web/  src/ ──────────┴────────────────────> dist/ ──────────┤
                                                            ▼
            user's FWL files ──> parser ──> units ──> matcher ──> report
                                                └──> footprint ──> footprint .json
```

## Modules (`src/`)

ES modules with no dependencies, used unchanged by the browser and by the Node tests.

**`parser.js`** turns the text of an FWL into `{cafd, cafdVersion, ecuHint, vinFound, params}`. The real E-Sys format is a `CAF_ID:05 00 00 16 EE 113 118 002` line followed by `NAME: value [hex bytes]` lines; names and values may contain spaces. Each parameter keeps both the readable value and the hex data. `UnknowParam05 [05]` becomes an unnamed value equal to `05`. The VIN is detected even when written as hex bytes (ATM, KAFAS, KOMBI). There is a fallback for tab- or space-separated lines. `identifyEcu` decides the unit by looking, in order, at the name in the file or header, the CAFD identifier (`data/cafd.yaml`) and finally the "signatures", parameters that only exist in one unit.

**`matcher.js`** gives every database entry a state (can be enabled, adjustable, already on, option missing, not available, unit not read, not mapped yet). `unexplored` lists the FWL parameters no entry uses, filtering out technical tables and production data. `esysChecklist` produces the text work list.

**`fa.js`** reads the E-Sys FA XML and extracts series, type key, production date and SA/E/HO codes. It never reads the VIN in the header.

**`footprint.js`** builds the anonymous footprint. It removes the VIN and short VIN (in hex too), dealer number, coding dates, factory identifiers, cryptographic signatures and any value that contains a VIN. The same parameters are also hidden from the "To discover" list.

## Page (`web/`)

`index.html`, `styles.css`, `app.js` and `i18n.js`, with no framework and no JavaScript build. The chosen language is remembered in the browser; loaded files are not, they disappear when the page is closed.

## Decisions

- **No uploads.** It is the simplest guarantee to explain and to check: the code is readable and the browser's Network tab confirms it.
- **No writing to the car.** A parser bug can never brick a unit.
- **YAML for the database.** Anyone can read and edit it through a pull request, with line-by-line review. The JSON for the browser is generated.
- **No external requests.** Fonts are downloaded at build time (scripts/fetch-fonts.sh) and served by the site itself; a Content-Security-Policy stops the page from contacting other domains.
- **Python for the build.** PyYAML ships with almost every Linux distribution; the project has no npm dependencies.
- **No BMW material.** CAFD files in PSdZData are encrypted for BMW's own tools. FDL Scout does not try to open them: it only reads the FWL that E-Sys produces on the user's PC.

## To do

- Validate the parser on FWL files from other E-Sys versions and other cars.
- Map SAS and PMA (parking sensors) as soon as their FWL files are available.
- A script that compares several footprints and proposes new entries (parameters that change between trims).
- Fill the database for BMW F-series with community footprints, then extend to the G-series.
