# Entry schema

*[Versione italiana](../SCHEMA.md)*

Coding entries live in `data/codings/<UNIT>.yaml`, one file per control unit, one list of entries per file. `python3 scripts/build.py --check` checks every rule below and also runs in CI on every pull request.

Field names are in Italian because the project started in Italian; they are the same for everyone, whatever language you write the text in.

## Example

```yaml
- id: kombi.marcia-inserita-nell-hud
  centralina: KOMBI
  titolo:
    it: Marcia inserita nell'HUD
    en: Current gear in the HUD
  parametri:
  - nome: HUD_FAHRSTUFE_ENABLE
    target: aktiv
  rischio: basso
  consiglio: ok
  affidabilita: confermata
  telai: [F54, F55, F56, F57, F60]
  note:
    it: Le tre voci HUD_SPORTANZEIGE_* devono essere già attive in HU e KOMBI.
    en: The three HUD_SPORTANZEIGE_* entries must already be active in the HU and the KOMBI.
  fonti:
  - https://www.northamericanmotoring.com/forums/...
  osservazioni:
  - telaio: F54
    anno: 2022
    i_level: F056-26-03-519
    valore_letto: nicht_aktiv
    esito: Consigliato
```

## Fields

| Field | Required | Content |
|---|---|---|
| `id` | yes | `unit.entry-name`, lower case, unique. Do not change it once published: saved lists use it. |
| `centralina` | yes | Unit name, same as the file name. Names follow E-Sys (`HU_NBT2`, `BDC_BODY`, `KOMBI`…). |
| `titolo.it` / `titolo.en` | at least one | What the function does, from the driver's point of view, in Italian and English. If you write only one, the page shows it in both languages and flags the missing translation. |
| `parametri` | yes | List of FDL parameters to change, may be empty. |
| `parametri[].nome` | yes | Exact parameter name as it appears in the FWL, spaces and dashes included (`Akustische Quittierung Schaerfen`, `Display-Farbumschlag`). Matching ignores case, but copy it as it is. |
| `parametri[].target` | one of the two | Value to set (`aktiv`, `both`, `FF`…). |
| `parametri[].regolabile` | one of the two | `true` when the value is up to the user: then use `valori_suggeriti`. |
| `valori_suggeriti` | no | Free text `it`/`en` with suggested values for adjustable parameters. |
| `stato_mappatura` | if `parametri` is empty | `da_mappare`: the function is known but the parameter names are not. |
| `rischio` | yes | `basso` (low: looks, menus), `medio` (medium: car behaviour), `alto` (high: safety, type approval, risk of bricking). |
| `consiglio` | yes | `ok`, or `sconsigliata` (not recommended) for anything that reduces safety or breaks traffic rules. |
| `affidabilita` | yes | `confermata` (confirmed) if at least one car has tried it with a known result, otherwise `da_verificare` (to be verified). |
| `telai` | no | Chassis the entry is documented on (e.g. `F54`, `F30`). If the user loads an FA from a different chassis, the page warns them. Only add a chassis with a source or an FWL that proves it: same feature does not mean same parameter. |
| `requisiti_sa` | no | Required SA codes, e.g. `['248']` for the heated steering wheel. If the user loads the FA and the code is missing, the entry shows as "Option missing". Only use verified codes. |
| `note` | no | `it`/`en`: dependencies, warnings, side effects. Write in general terms, not about your own car. |
| `fonti` | no | Links to the threads or guides the entry comes from. Summarise in your own words, do not copy text. |
| `osservazioni` | no | Cars the parameter was read on: chassis, year, i-level, value read, result. This is the evidence for the entry. |

## Values

Matching ignores case and the difference between space and underscore (`AKTIV` = `aktiv`, `nicht aktiv` = `nicht_aktiv`). A hexadecimal target is also compared with the bracketed data in the FWL, so `14` matches `wert_01 [14]`. Write hexadecimal values as E-Sys shows them (`14`, `FF`) and quote them if they start with zero (`'00'`), otherwise YAML reads them as numbers.

Some PSdZData have no name for certain values: the FWL shows `UnknowParam05 [05]`. FDL Scout treats them as unnamed values, uses the hex data and flags them as "unnamed in PSdZData".

## SA codes (`data/sa.yaml`)

Dictionary of option codes shown on the page when the user loads the FA. It only holds codes whose meaning has been verified on a public source. Some codes mean different things on BMW and MINI, and a wrong name is worse than none: if a code was verified only on some chassis, list them in `telai` and the page will name it only for those cars. Format: `"248": { it: "Volante riscaldato", en: "Heated steering wheel" }`, or with `telai: [F54, F55, F56, F57, F60]`.
