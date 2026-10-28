# Contribuire

*[English version](CONTRIBUTING.md)*

## Inviare un'impronta (il modo più semplice)

Vale per qualsiasi BMW o MINI della serie F. Le impronte delle BMW sono le più utili, perché oggi il database nasce da una MINI.

1. Carica i tuoi FWL in FDL Scout.
2. Apri la scheda **Contribuisci**, compila telaio, anno e i-level e scarica l'impronta.
3. Apri il file e controlla che non ci sia niente che non vuoi condividere.
4. Apri una segnalazione su GitHub con l'etichetta `impronta` e allega il file.

Le impronte servono a capire quali parametri esistono su quali auto e a far emergere codifiche nuove.

Non hai un account GitHub? Condividi il file nel gruppo o nel forum dove hai trovato FDL Scout: qualcuno lo caricherà per te.

## Raccontare una prova

Hai fatto una codifica? Apri la sua scheda in FDL Scout e premi **L'hai provata?**: si apre una segnalazione già compilata con il nome della voce. Indica telaio, anno, i-level, valore impostato e se funziona. Una voce confermata su più auto passa da "da verificare" a "confermata".

## Confronto prima/dopo

Il contributo più prezioso. Prima di una codifica esporta l'FWL della centralina, dopo esportalo di nuovo e caricali nella scheda **Prima/dopo** di FDL Scout: vedi quali parametri sono cambiati e puoi mandare il confronto con **Racconta la prova su GitHub**. Così una voce diventa certa, oppure ne scopriamo una nuova.

## Aggiungere o correggere una codifica

1. Fai un fork e modifica `data/codings/<CENTRALINA>.yaml` seguendo [docs/SCHEMA.md](docs/SCHEMA.md).
2. Lancia `python3 scripts/build.py --check`.
3. Apri una pull request indicando su quale auto l'hai provata (telaio, anno, i-level) e con quale esito. Aggiungi la tua prova in `osservazioni`.

Regole:

- **Niente materiale BMW.** Non includere PSdZData, CAFD, file NCD, schermate di documentazione riservata, E-Sys o launcher. Solo nomi e valori dei parametri.
- **Niente testi copiati dai forum.** Riassumi con parole tue e metti il link in `fonti`.
- **Sicurezza prima di tutto.** Le codifiche che disattivano sistemi di sicurezza (avvisi cinture, blocco avviamento senza freno, controllo stabilità) vanno marcate `consiglio: sconsigliata` e `rischio: alto`. Le pull request che le presentano come consigliate non vengono accettate.
- **Note generali.** Scrivi "richiede il volante riscaldato (SA 248)", non "io ho il volante riscaldato".
- **Due lingue.** Scrivi `titolo`, `note` e `valori_suggeriti` in italiano (`it:`) e, se puoi, in inglese (`en:`). Se non te la senti, lascia solo `it:`: qualcun altro tradurrà.

## Codice

Il motore è in `src/`, la pagina in `web/`. Aggiungi un test in `tests/` per ogni comportamento nuovo del parser o del matcher e lancia `node --test tests/*.test.js`.

Se hai FWL di versioni diverse di E-Sys, gli estratti (anonimizzati, senza VIN) in `tests/fixtures/` sono preziosi: il formato non è documentato e il parser è stato scritto partendo da poche varianti.

