# Exporting FWL and FA files from E-Sys

*[Versione italiana](../ESPORTARE-DA-ESYS.md)*

FDL Scout reads two kinds of file exported from E-Sys:

- **FWL**: the FDL coding of one control unit saved as text. One file per CAFD, named `CAFD_<number>_<version>.fwl`.
- **FA**: the vehicle order with the option codes (SA), saved as XML.

Neither is changed or written to the car: these are read-only steps.

## What you need

- An ENET cable and a Windows PC with E-Sys.
- **PSdZData**: the lite version is fine. Ideally use one as close as possible to the car's i-level: with older or newer data some parameter names may be missing or show up as `UnknowParam`.
- Access to the E-Sys NCD editor (Edit NCD).
- A battery charger or maintainer: reading every unit takes a while with the ignition on.

## 1. Connect and read the FA

1. Ignition on, engine off, ENET cable plugged in.
2. In E-Sys: **Connect**, pick the target for your car's series and connect to the gateway (VIN). For MINI F5x it is F056; for BMWs pick the series E-Sys lists for your chassis.
3. Open **Expert Mode → Coding**.
4. In the **Vehicle Order** panel press **Read**, then **Save** and store the FA as a `.txt` file (for example `FA.txt`). It is XML inside: FDL Scout recognises it by its content, the name does not matter.

## 2. Read the coding of the control units

1. Still in **Expert Mode → Coding**, press **Read (ECU)** in the SVT panel: the unit tree appears, each unit with its address and short VIN, for example `FLE [43] [XXXXXXX]`.
2. Expand the unit and right-click the **CAFD** (in blue) → **Read Coding Data**.
3. A **yellow** line with the same name appears under the CAFD: this is the NCD, the coding read from the car.

> This step is essential. If you open the editor without reading the coding first, E-Sys shows the CAFD defaults instead of your car's values, and the saved FWL is useless.

You can select several units and read them together.

Some units have no codable CAFD, or E-Sys does not let you read their coding: then there is nothing to export and you can skip them.

## 3. Save the FWL

1. Right-click the **yellow** line (the NCD) → **Edit NCD**. The editor opens with the `.ncd` file name in the title bar.
2. Right-click the root of the tree, the `CAF [...]` line → **Expand**, so that every parameter is loaded.
3. Menu **File → Save as FWL…** and save. E-Sys already suggests the name `CAFD_<number>_<version>.fwl`: keep it, FDL Scout recognises the unit from that number.
4. Go back to **Coding** and repeat for every CAFD. Some units have more than one (ACSM has three, FZD two), and some appear twice, such as the left and right headlights (`FLE [43]` and `FLE [44]`): one file per CAFD is enough.

Do not press **Code** and do not save with **Save**: FDL Scout only needs the FWL, and the original NCD stays untouched.

## Which units to export

For a complete picture export every unit E-Sys lists. The most useful for coding are:

| Unit | What it covers |
|---|---|
| HU_NBT2 | iDrive: menus, video, phone, navigation |
| BDC_BODY | lights, locking, mirrors, wipers, driving modes |
| KOMBI | instrument cluster, on-board computer, HUD |
| KAFAS | camera: lane departure warning, signs, automatic high beams |
| IHKA | climate control |
| FZD | alarm and panoramic roof |
| DSC | speed limiter, ACC |
| SAS | Active Cruise Control (if fitted) |
| PMA | parking sensors and park assistant (if fitted) |
| SMFA | electric seat with memory |
| ACSM, FLEL/FLER, TRSVC, ATM, ASD, EGS, DME, ZBE | the rest, useful for discovering new parameters |

These names come from a MINI F5x. On BMWs some units have different names: for example FEM_BODY instead of BDC_BODY on F20/F30, or HU_NBT or HU_CIC instead of HU_NBT2. Export everything E-Sys lists anyway: if FDL Scout does not recognise a unit, type the name you see in E-Sys.

## Privacy

Some FWL files (ATM, KAFAS, KOMBI) contain the VIN, in hexadecimal too, and others the dealer number and coding dates. FDL Scout reads them only in your browser and removes them from the footprint you can share. Do not publish raw FWL files: share only the footprint.
