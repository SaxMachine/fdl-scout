#!/usr/bin/env python3
"""Valida il database YAML e costruisce il sito statico in dist/.

    python3 scripts/build.py           valida e costruisce
    python3 scripts/build.py --check   valida soltanto (CI sulle pull request)

Unica dipendenza: PyYAML (su Red Hat/Fedora: python3-pyyaml; altrove: pip install pyyaml).
"""
import hashlib, json, re, shutil, sys
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
            if "insieme_a" in e and not (isinstance(e["insieme_a"], list) and all(isinstance(x, str) for x in e["insieme_a"])):
                err("insieme_a deve essere una lista di id di voci")
            if not params and e.get("stato_mappatura") != "da_mappare":
                err("senza parametri serve stato_mappatura: da_mappare")
            if e.get("rischio") not in RISCHI:
                err(f"rischio deve essere uno di {sorted(RISCHI)}")
            if e.get("consiglio") not in CONSIGLI:
                err(f"consiglio deve essere uno di {sorted(CONSIGLI)}")
            if e.get("affidabilita") not in AFFIDABILITA:
                err(f"affidabilita deve essere uno di {sorted(AFFIDABILITA)}")
            db.append(e)
    # Funzioni su più voci (data/funzioni.yaml): ogni parte è "insieme_a" alle altre.
    ids = {e["id"] for e in db}
    byid = {e["id"]: e for e in db}
    for f in load_functions(errors):
        for part in f["parti"]:
            if part not in ids:
                errors.append(f'funzione {f["id"]}: la parte {part} non esiste')
        for part in f["parti"]:
            if part in byid:
                lst = byid[part].setdefault("insieme_a", [])
                lst += [o for o in f["parti"] if o != part and o not in lst]
    # insieme_a: gli id devono esistere e il legame vale nei due sensi
    for e in db:
        for o in e.get("insieme_a", []):
            if o not in ids:
                errors.append(f'{e["id"]}: insieme_a punta a una voce che non esiste: {o}')
            elif o == e["id"]:
                errors.append(f'{e["id"]}: insieme_a non può puntare a se stessa')
    byid = {e["id"]: e for e in db}
    for e in db:
        for o in e.get("insieme_a", []):
            if o in byid and e["id"] not in byid[o].setdefault("insieme_a", []):
                byid[o]["insieme_a"].append(e["id"])
    return db, errors


def load_functions(errors=None):
    """Legge data/funzioni.yaml e lo valida (id unici, titolo, almeno due parti)."""
    errors = [] if errors is None else errors
    path = ROOT / "data" / "funzioni.yaml"
    if not path.exists():
        return []
    out, seen = [], set()
    for f in yaml.safe_load(path.read_text(encoding="utf-8")) or []:
        fid = f.get("id")
        if not fid or not re.fullmatch(r"[a-z0-9-]+", str(fid)) or fid in seen:
            errors.append(f"funzioni.yaml: id mancante, non valido o doppio: {fid}")
            continue
        seen.add(fid)
        if not (f.get("titolo") or {}).get("it") and not (f.get("titolo") or {}).get("en"):
            errors.append(f"funzione {fid}: manca il titolo")
        if not isinstance(f.get("parti"), list) or len(f["parti"]) < 2:
            errors.append(f"funzione {fid}: servono almeno due parti")
            continue
        out.append(f)
    return out


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
    payload = {"generato": datetime.now(timezone.utc).isoformat(timespec="seconds"), "voci": db, "funzioni": load_functions(), "centraline": ecu_map, "sa": sa}
    (dist / "db.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    bust_cache(dist)
    print("✓ sito costruito in dist/")


def bust_cache(dist):
    """Aggiunge ?v=<impronta> a script, stili e import: dopo ogni pubblicazione il browser scarica i file nuovi."""
    files = sorted(f for f in dist.rglob("*") if f.suffix in (".js", ".css", ".html"))
    h = hashlib.sha256()
    for f in files:
        h.update(f.read_bytes())
    v = h.hexdigest()[:10]
    for f in files:
        text = f.read_text(encoding="utf-8")
        if f.suffix == ".js":
            text = re.sub(r"(from\s+'\.{1,2}/[^']+\.js)'", rf"\1?v={v}'", text)
        elif f.suffix == ".html":
            text = re.sub(r'((?:src|href)="(?!https?:|#|docs/)[^"?]+\.(?:js|css))"', rf'\1?v={v}"', text)
        f.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
