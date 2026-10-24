#!/usr/bin/env python3
"""Valida il database YAML e costruisce il sito statico in dist/.

    python3 scripts/build.py           valida e costruisce
    python3 scripts/build.py --check   valida soltanto (CI sulle pull request)

Unica dipendenza: PyYAML (su Red Hat/Fedora: python3-pyyaml; altrove: pip install pyyaml).
"""
import json, re, shutil, sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
RISCHI = {"basso", "medio", "alto"}
CONSIGLI = {"ok", "sconsigliata"}
AFFIDABILITA = {"confermata", "da_verificare"}
PARAM_NAME = re.compile(r"^[A-Za-z0-9#][A-Za-z0-9_ .\-#/()+]*$")
ID_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9-]+$")


def load_db():
    errors, ids, db = [], set(), []
    for f in sorted((ROOT / "data" / "codings").glob("*.yaml")):
        ecu = f.stem
        for e in yaml.safe_load(f.read_text(encoding="utf-8")) or []:
            vid = e.get("id")
            def err(msg):
                errors.append(f"{f.name} › {vid}: {msg}")
            if not vid or not ID_RE.match(vid):
                err("id mancante o non valido (formato centralina.nome-voce)")
            if vid in ids:
                err("id duplicato")
            ids.add(vid)
            if e.get("centralina") != ecu:
                err(f'centralina "{e.get("centralina")}" diversa dal nome del file')
            titolo = e.get("titolo") or {}
            if not (titolo.get("it") or titolo.get("en")):
                err("manca il titolo (titolo.it o titolo.en)")
            params = e.get("parametri")
            if not isinstance(params, list):
                err("parametri deve essere una lista (anche vuota)")
                params = []
            for p in params:
                if not PARAM_NAME.match(str(p.get("nome", ""))):
                    err(f"nome parametro non valido: {p.get('nome')}")
                if p.get("target") is None and not p.get("regolabile"):
                    err(f'{p.get("nome")}: serve "target" oppure "regolabile: true"')
                if p.get("target") is not None:
                    p["target"] = str(p["target"])  # YAML legge 00 o 14 come numeri
            if "requisiti_sa" in e:
                if not isinstance(e["requisiti_sa"], list):
                    err("requisiti_sa deve essere una lista di codici SA")
                else:
                    e["requisiti_sa"] = [str(x).upper() for x in e["requisiti_sa"]]
            if not params and e.get("stato_mappatura") != "da_mappare":
                err("senza parametri serve stato_mappatura: da_mappare")
            if e.get("rischio") not in RISCHI:
                err(f"rischio deve essere uno di {sorted(RISCHI)}")
            if e.get("consiglio") not in CONSIGLI:
                err(f"consiglio deve essere uno di {sorted(CONSIGLI)}")
            if e.get("affidabilita") not in AFFIDABILITA:
                err(f"affidabilita deve essere uno di {sorted(AFFIDABILITA)}")
            db.append(e)
    return db, errors


def main():
    db, errors = load_db()
    if errors:
        print(f"✗ {len(errors)} errori nel database:\n  " + "\n  ".join(errors), file=sys.stderr)
        sys.exit(1)
    en = sum(1 for e in db if e["titolo"].get("en"))
    it = sum(1 for e in db if e["titolo"].get("it"))
    ecus = {e["centralina"] for e in db}
    print(f"✓ {len(db)} voci valide · {it} con titolo italiano · {en} con titolo inglese · {len(ecus)} centraline")
    if "--check" in sys.argv:
        return
    ecu_map = yaml.safe_load((ROOT / "data" / "cafd.yaml").read_text(encoding="utf-8"))
    # Le chiavi CAFD devono restare stringhe di 8 cifre esadecimali.
    ecu_map["cafd"] = {str(k).zfill(8).upper(): v for k, v in (ecu_map.get("cafd") or {}).items()}
    dist = ROOT / "dist"
    shutil.rmtree(dist, ignore_errors=True)
    shutil.copytree(ROOT / "web", dist)
    shutil.copytree(ROOT / "src", dist / "src")
    sa = {str(k).upper(): v for k, v in (yaml.safe_load((ROOT / "data" / "sa.yaml").read_text(encoding="utf-8")) or {}).items()}
    payload = {"generato": datetime.now(timezone.utc).isoformat(timespec="seconds"), "voci": db, "centraline": ecu_map, "sa": sa}
    (dist / "db.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print("✓ sito costruito in dist/")


if __name__ == "__main__":
    main()
