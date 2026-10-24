# Contributing

*[Versione italiana](CONTRIBUIRE.md)*

## Send a footprint (the easiest way)

1. Load your FWL files into FDL Scout.
2. Open the **Contribute** tab, fill in chassis, year and i-level, and download the footprint.
3. Open the file and check there is nothing in it you do not want to share.
4. Open a GitHub issue with the `impronta` label and attach the file.

Footprints show which parameters exist on which cars and bring new coding to light.

## Add or fix a coding entry

1. Fork the repository and edit `data/codings/<UNIT>.yaml` following [docs/en/SCHEMA.md](docs/en/SCHEMA.md).
2. Run `python3 scripts/build.py --check`.
3. Open a pull request saying which car you tried it on (chassis, year, i-level) and with what result. Add your test under `osservazioni`.

Rules:

- **No BMW material.** Do not include PSdZData, CAFD, NCD files, screenshots of restricted documentation, E-Sys or launchers. Only parameter names and values.
- **No text copied from forums.** Summarise in your own words and put the link in `fonti`.
- **Safety first.** Coding that disables safety systems (seat belt warnings, starting without the brake, stability control) must be marked `consiglio: sconsigliata` and `rischio: alto`. Pull requests presenting it as recommended are not accepted.
- **General notes.** Write "requires the heated steering wheel (SA 248)", not "I have the heated steering wheel".
- **Two languages.** Write `titolo`, `note` and `valori_suggeriti` in Italian (`it:`) and English (`en:`). If you cannot write Italian, add `en:` only and say so in the pull request: someone will translate it.

## Code

The engine is in `src/`, the page in `web/`. Add a test in `tests/` for every new parser or matcher behaviour and run `node --test tests/*.test.js`.

If you have FWL files from other E-Sys versions, excerpts (anonymised, without VIN) in `tests/fixtures/` are valuable: the format is undocumented and the parser was written from only a few variants.
