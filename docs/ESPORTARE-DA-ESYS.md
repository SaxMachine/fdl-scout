# Esportare FWL e FA da E-Sys

FDL Scout legge due tipi di file esportati da E-Sys:

- **FWL**: la lettura FDL di una centralina salvata come testo. Un file per CAFD, nome `CAFD_<numero>_<versione>.fwl`.
- **FA**: l'ordine veicolo con i codici degli optional (SA), salvato in XML.

Nessuno dei due viene modificato o scritto sull'auto: si tratta solo di letture.

## Cosa serve

- Cavo ENET e un PC Windows con E-Sys.
- **PSdZData completi** (non la versione "lite") di versione uguale o più recente dell'i-level dell'auto. Con dati più vecchi i nomi dei parametri mancano o diventano `UnknowParam`.
- La possibilità di aprire l'editor NCD di E-Sys (Edit NCD).
- Un mantenitore di carica sulla batteria: la lettura di tutte le centraline richiede tempo a quadro acceso.

## 1. Collegarsi e leggere la FA

1. Quadro acceso, motore spento, cavo ENET collegato.
2. In E-Sys: **Connect**, scegli il telaio (per le MINI F5x è il target della serie F056) e connettiti al gateway (VIN).
3. Apri **Expert Mode → Coding**. Le istruzioni sono state verificate con E-Sys 3.35.3 (la versione con Plus 3.8.1): con altre versioni i nomi dei comandi possono cambiare leggermente.
4. Nel riquadro **Vehicle Order** premi **Read**, poi tasto destro sulla FA → **Activate FA**.

**Per salvare la FA:** dopo **Read** usa **Save** nello stesso riquadro Vehicle Order: ottieni un file XML. Va bene anche se si chiama `.txt`, perché FDL Scout la riconosce dal contenuto.

## 2. Leggere la codifica delle centraline

1. Torna in **Expert Mode → Coding** e premi **Read (VCM)** nel riquadro SVT: compare l'albero delle centraline, ognuna con il suo indirizzo e il VIN corto, per esempio `FLE [43] [XXXXXXX]`.
2. Espandi la centralina e fai tasto destro sul **CAFD** (in blu) → **Read Coding Data**.
3. Sotto il CAFD compare una riga **in giallo** con lo stesso nome: è l'NCD, cioè la codifica letta dall'auto.

> Questo passaggio è indispensabile. Se apri l'editor senza aver letto la codifica, E-Sys mostra i valori predefiniti del CAFD e non quelli della tua auto, e l'FWL salvato non serve a niente.

Puoi selezionare più centraline e leggerle insieme.

## 3. Salvare l'FWL

1. Tasto destro sulla riga **gialla** (l'NCD) → **Edit NCD**. Si apre l'editor, con il nome del file `.ncd` nella barra del titolo.
2. Tasto destro sulla radice dell'albero, la riga `CAF [...]` → **Expand**, così tutti i parametri vengono caricati.
3. Menu **File → Save as FWL…** e salva. E-Sys propone già il nome `CAFD_<numero>_<versione>.fwl`: lascialo così, FDL Scout riconosce la centralina proprio da quel numero.
4. Torna in **Coding** e ripeti per ogni CAFD. Alcune centraline ne hanno più di uno (ACSM ne ha tre, FZD due), e alcune compaiono due volte, come i fari sinistro e destro (`FLE [43]` e `FLE [44]`): basta un file per CAFD.

Non premere **Code** e non salvare con **Save**: per FDL Scout basta l'FWL, l'NCD originale resta intatto.

## Quali centraline esportare

Per un quadro completo esporta tutte quelle che E-Sys elenca. Le più utili per le codifiche sono:

| Centralina | Cosa contiene |
|---|---|
| HU_NBT2 | iDrive: menu, video, telefono, navigazione |
| BDC_BODY | luci, chiusure, specchi, tergicristalli, modalità di guida |
| KOMBI | quadro strumenti, computer di bordo, HUD |
| KAFAS | telecamera: avviso corsia, cartelli, abbaglianti automatici |
| IHKA | climatizzatore |
| FZD | allarme e tetto panorama |
| DSC | limitatore di velocità, ACC |
| SAS | Active Cruise Control (se presente) |
| PMA | sensori e parcheggio automatico (se presente) |
| SMFA | sedile elettrico con memoria |
| ACSM, FLEL/FLER, TRSVC, ATM, ASD, EGS, DME, ZBE | il resto, utile per la scoperta di parametri nuovi |

## Privacy

Alcuni FWL (ATM, KAFAS, KOMBI) contengono il VIN, anche in esadecimale, e altri il numero del concessionario e le date di codifica. FDL Scout li legge solo nel tuo browser e li toglie dall'impronta che puoi condividere. Non pubblicare gli FWL grezzi: condividi solo l'impronta.

---

## English (short)

1. Connect via ENET, **Expert Mode → Coding**, **Read** the FA and **Activate** it.
2. Save the FA as XML with **Save** in the same Vehicle Order panel.
3. **Read (VCM)**, then right-click each CAFD → **Read Coding Data**: a yellow NCD line appears under it. Without this step the editor shows CAFD defaults, not your car's values.
4. Right-click the yellow NCD → **Edit NCD**, right-click the `CAF [...]` root → **Expand**, then **File → Save as FWL…** keeping the proposed `CAFD_…fwl` name. Export every CAFD, some units have more than one.
5. Use full PSdZData at least as new as the car's i-level. Never press **Code**: reading is enough. Share the anonymous footprint, not the raw FWL files (they contain the VIN).
