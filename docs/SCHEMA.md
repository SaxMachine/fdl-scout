# Schema delle voci

*[English version](en/SCHEMA.md)*

Le codifiche stanno in `data/codings/<CENTRALINA>.yaml`, un file per centralina, una lista di voci per file. `python3 scripts/build.py --check` controlla tutte le regole qui sotto e gira anche in CI su ogni pull request.

## Esempio

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

## Campi

| Campo | Obbligatorio | Contenuto |
|---|---|---|
| `id` | sì | `centralina.nome-voce`, minuscolo, unico. Non cambiarlo dopo la pubblicazione: le liste salvate lo usano. |
| `centralina` | sì | Uguale al nome del file. I nomi seguono E-Sys (`HU_NBT2`, `BDC_BODY`, `KOMBI`…). |
| `titolo.it` / `titolo.en` | almeno uno | Cosa fa la funzione, dal punto di vista di chi guida, in italiano e in inglese. Se ne scrivi uno solo, la pagina lo mostra in entrambe le lingue con l'indicazione che manca la traduzione. |
| `parametri` | sì | Lista dei parametri FDL da toccare, anche vuota. |
| `parametri[].nome` | sì | Nome esatto del parametro come compare nell'FWL, anche con spazi o trattini (`Akustische Quittierung Schaerfen`, `Display-Farbumschlag`). Il confronto ignora maiuscole e minuscole, ma è meglio copiarlo identico. |
| `parametri[].target` | uno dei due | Valore da impostare (`aktiv`, `both`, `FF`…). |
| `parametri[].regolabile` | uno dei due | `true` quando il valore è a scelta: in quel caso usa `valori_suggeriti`. |
| `valori_suggeriti` | no | Testo libero `it`/`en` con i valori consigliati per i parametri regolabili. |
| `stato_mappatura` | se `parametri` è vuoto | `da_mappare`: la funzione è nota ma mancano i nomi. |
| `rischio` | sì | `basso` (estetica, menu), `medio` (comportamento dell'auto), `alto` (sicurezza, omologazione, rischio di blocco). |
| `consiglio` | sì | `ok` oppure `sconsigliata` per ciò che riduce la sicurezza o è contrario al Codice della strada. |
| `affidabilita` | sì | `confermata` se almeno un'auto l'ha provata con esito, altrimenti `da_verificare`. |
| `telai` | no | Telai su cui la voce è documentata (es. `F54`, `F30`). Se l'utente carica una FA di un telaio diverso, la pagina lo avvisa. Aggiungi un telaio solo con una fonte o un FWL che lo dimostri: stessa funzione non vuol dire stesso parametro. |
| `requisiti_sa` | no | Codici SA necessari, es. `['248']` per il volante riscaldato. Se l'utente carica la FA e il codice manca, la voce risulta "Manca l'optional". Metti solo codici verificati. |
| `note` | no | `it`/`en`: dipendenze, avvertenze, effetti collaterali. Scrivi in modo generale, non riferito alla tua auto. |
| `insieme_a` | no | Id delle voci da codificare insieme a questa (es. la parte HU e la parte KOMBI della stessa funzione). Il legame vale nei due sensi: basta scriverlo in una delle due voci. La pagina le mostra nella scheda e la lista per E-Sys avvisa se ne manca una. |
| `fonti` | no | Link alle discussioni o guide da cui viene la voce. Riassumi con parole tue, non copiare i testi. |
| `osservazioni` | no | Auto su cui il parametro è stato letto: telaio, anno, i-level, valore letto, esito. È la prova empirica della voce. |

## Valori

Il confronto ignora maiuscole e minuscole e la differenza tra spazio e trattino basso (`AKTIV` = `aktiv`, `nicht aktiv` = `nicht_aktiv`). Un target esadecimale viene confrontato anche con il dato tra parentesi quadre dell'FWL, quindi `14` corrisponde a `wert_01 [14]`. I valori esadecimali vanno scritti come appaiono in E-Sys (`14`, `FF`) e tra virgolette se iniziano con zero (`'00'`), altrimenti YAML li legge come numeri.

Alcuni PSdZData non hanno il nome di certi valori: l'FWL mostra `UnknowParam05 [05]`. FDL Scout li tratta come valori senza nome, usa il dato esadecimale e li segnala come "senza nome nel PSdZData".

## Codici SA (`data/sa.yaml`)

Dizionario dei codici optional mostrati nella pagina quando l'utente carica la FA. Contiene solo codici con un significato verificato su una fonte pubblica. Alcuni codici hanno significati diversi tra BMW e MINI, e un nome sbagliato è peggio di nessun nome: se un codice è stato verificato solo su certi telai, indicali in `telai` e la pagina lo nominerà solo per quelle auto. Formato: `"248": { it: "Volante riscaldato", en: "Heated steering wheel" }`, oppure con `telai: [F54, F55, F56, F57, F60]`.
