# Schema delle voci

Le codifiche stanno in `data/codings/<CENTRALINA>.yaml`, un file per centralina, una lista di voci per file. `python3 scripts/build.py --check` controlla tutte le regole qui sotto e gira anche in CI su ogni pull request.

## Esempio

```yaml
- id: kombi.marcia-inserita-nellhud
  centralina: KOMBI
  titolo:
    it: Marcia inserita nell'HUD
    en: Selected gear in the HUD
  parametri:
  - nome: HUD_FAHRSTUFE_ENABLE
    target: aktiv
  rischio: basso
  consiglio: ok
  affidabilita: confermata
  telai: [F54, F55, F56, F57, F60]
  note:
    it: Le tre voci HUD_SPORTANZEIGE_* devono essere già attive in HU e KOMBI.
  fonti:
  - https://www.northamericanmotoring.com/forums/...
  osservazioni:
  - telaio: F54
    anno: 2022
    i_level: F056-26-03-519
    valore_letto: nicht_aktiv
    esito: Consigliato
```

## Campi

| Campo | Obbligatorio | Contenuto |
|---|---|---|
| `id` | sì | `centralina.nome-voce`, minuscolo, unico. Non cambiarlo dopo la pubblicazione: le liste salvate lo usano. |
| `centralina` | sì | Uguale al nome del file. I nomi seguono E-Sys (`HU_NBT2`, `BDC_BODY`, `KOMBI`…). |
| `titolo.it` | sì | Cosa fa la funzione, dal punto di vista di chi guida. `titolo.en` facoltativo. |
| `parametri` | sì | Lista dei parametri FDL da toccare, anche vuota. |
| `parametri[].nome` | sì | Nome esatto del parametro come compare nell'FWL. |
| `parametri[].target` | uno dei due | Valore da impostare (`aktiv`, `both`, `FF`…). |
| `parametri[].regolabile` | uno dei due | `true` quando il valore è a scelta: in quel caso usa `valori_suggeriti`. |
| `valori_suggeriti` | no | Testo libero `it`/`en` con i valori consigliati per i parametri regolabili. |
| `stato_mappatura` | se `parametri` è vuoto | `da_mappare`: la funzione è nota ma mancano i nomi. |
| `rischio` | sì | `basso` (estetica, menu), `medio` (comportamento dell'auto), `alto` (sicurezza, omologazione, rischio di blocco). |
| `consiglio` | sì | `ok` oppure `sconsigliata` per ciò che riduce la sicurezza o è contrario al Codice della strada. |
| `affidabilita` | sì | `confermata` se almeno un'auto l'ha provata con esito, altrimenti `da_verificare`. |
| `telai` | no | Telai a cui si applica. |
| `requisiti_sa` | no | Codici SA necessari, es. `[248]` per il volante riscaldato. |
| `note` | no | `it`/`en`: dipendenze, avvertenze, effetti collaterali. Scrivi in modo generale, non riferito alla tua auto. |
| `fonti` | no | Link alle discussioni o guide da cui viene la voce. Riassumi con parole tue, non copiare i testi. |
| `osservazioni` | no | Auto su cui il parametro è stato letto: telaio, anno, i-level, valore letto, esito. È la prova empirica della voce. |

## Valori

Il confronto ignora maiuscole e minuscole (`AKTIV` = `aktiv`). I valori esadecimali vanno scritti come appaiono in E-Sys (`14`, `FF`) e tra virgolette se iniziano con zero (`'00'`), altrimenti YAML li legge come numeri.

Alcuni PSdZData recenti non hanno più il nome di certi valori: l'FWL mostra solo il dato esadecimale. FDL Scout li segnala come "senza nome nel PSdZData".
