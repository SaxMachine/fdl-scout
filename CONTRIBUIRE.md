# Contribuire / Contributing

## Inviare un'impronta (il modo più semplice)

1. Carica i tuoi FWL in FDL Scout.
2. Apri la scheda **Contribuisci**, compila telaio, anno e i-level e scarica l'impronta.
3. Apri il file e controlla che non ci sia niente che non vuoi condividere.
4. Apri una segnalazione su GitHub con l'etichetta `impronta` e allega il file.

Le impronte servono a capire quali parametri esistono su quali auto e a far emergere codifiche nuove.

## Aggiungere o correggere una codifica

1. Fai un fork e modifica `data/codings/<CENTRALINA>.yaml` seguendo [docs/SCHEMA.md](docs/SCHEMA.md).
2. Lancia `python3 scripts/build.py --check`.
3. Apri una pull request indicando su quale auto l'hai provata (telaio, anno, i-level) e con quale esito. Aggiungi la tua prova in `osservazioni`.

Regole:

- **Niente materiale BMW.** Non includere PSdZData, CAFD, file NCD, schermate di documentazione riservata, E-Sys o launcher. Solo nomi e valori dei parametri.
- **Niente testi copiati dai forum.** Riassumi con parole tue e metti il link in `fonti`.
- **Sicurezza prima di tutto.** Le codifiche che disattivano sistemi di sicurezza (avvisi cinture, blocco avviamento senza freno, controllo stabilità) vanno marcate `consiglio: sconsigliata` e `rischio: alto`. Le pull request che le presentano come consigliate non vengono accettate.
- **Note generali.** Scrivi "richiede il volante riscaldato (SA 248)", non "io ho il volante riscaldato".

## Codice

Il motore è in `src/`, la pagina in `web/`. Aggiungi un test in `tests/` per ogni comportamento nuovo del parser o del matcher e lancia `node --test tests/*.test.js`.

Se hai FWL di versioni diverse di E-Sys, gli estratti (anonimizzati, senza VIN) in `tests/fixtures/` sono preziosi: il formato non è documentato e il parser è stato scritto partendo da poche varianti.

---

## Contributing (English)

- **Send a footprint:** load your FWL files, open **Contribute**, download the footprint, check it, and attach it to a GitHub issue labelled `impronta`.
- **Add or fix a coding entry:** edit `data/codings/<UNIT>.yaml` following [docs/SCHEMA.md](docs/SCHEMA.md), run `python3 scripts/build.py --check`, open a PR saying which car you tested on and the result.
- **Translate:** add `en:` next to `it:` in `titolo`, `note` and `valori_suggeriti`.
- Never include BMW material (PSdZData, CAFD, NCD, E-Sys, launchers). Do not paste forum text; summarise and link. Safety-reducing coding must be marked `consiglio: sconsigliata`, `rischio: alto`.
