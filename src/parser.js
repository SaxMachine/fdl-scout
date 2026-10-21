// Parser per i file FWL esportati da E-Sys (lettura FDL in formato testo).
//
// Il formato non è documentato da BMW e varia tra versioni di E-Sys, quindi il parser
// è volutamente tollerante: ogni riga che inizia con un nome di parametro valido seguito
// da almeno un valore diventa una voce. Tutto il resto (intestazioni, gruppi, righe vuote)
// viene usato solo per riconoscere CAFD, centralina e VIN, oppure ignorato.
//
// Funziona identico nel browser e in Node: nessuna dipendenza.

const PARAM_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const CAFD_RE = /CAFD[_\s-]*([0-9A-Fa-f]{8})/;
const VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
// Un VIN ha cifre e lettere mescolate: evita falsi positivi come ZUSATZWASSERPUMPE.
export function hasVin(s) {
  for (const m of String(s).matchAll(VIN_RE)) {
    const d = (m[0].match(/\d/g) || []).length;
    if (d >= 3 && d <= 14) return true;
  }
  return false;
}
const HEX_ONLY = /^(0x)?[0-9A-Fa-f]+$/;
// Parametri segnaposto che E-Sys usa quando il PSdZData non ha il descrittore.
const UNKNOWN_PARAM = /^Unknow[n]?Param/i;

/** Divide una riga in token: tab, poi due o più spazi, poi spazi singoli. */
export function tokenize(line) {
  const t = line.trim();
  if (!t) return [];
  if (t.includes('\t')) return t.split(/\t+/).map(s => s.trim()).filter(Boolean);
  const wide = t.split(/\s{2,}/);
  if (wide.length > 1) return wide.map(s => s.trim()).filter(Boolean);
  return t.split(/\s+/);
}

/** Ripulisce un valore: toglie "=", ":" iniziali e virgolette. */
function cleanValue(v) {
  return v.replace(/^[=:]\s*/, '').replace(/^"(.*)"$/, '$1').trim();
}

/**
 * Analizza il testo di un FWL.
 * @param {string} text contenuto del file
 * @param {string} [filename] nome del file, usato per trovare CAFD e centralina
 * @returns {{cafd: string|null, ecuHint: string|null, vinFound: boolean,
 *            params: Record<string, {value: string, named: boolean, line: number}>,
 *            unknown: number, skipped: number}}
 */
export function parseFwl(text, filename = '') {
  const params = {};
  let cafd = null;
  let vinFound = false;
  let unknown = 0;
  let skipped = 0;

  const fm = filename.match(CAFD_RE);
  if (fm) cafd = fm[1].toUpperCase();

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.replace(/\u0000/g, '');
    if (!cafd) {
      const m = line.match(CAFD_RE);
      if (m) cafd = m[1].toUpperCase();
    }
    if (!vinFound && hasVin(line)) vinFound = true;

    const tok = tokenize(line);
    if (tok.length < 2) { if (tok.length) skipped++; return; }
    // "NOME = valore" oppure "NOME: valore"
    let [name, ...rest] = tok;
    if (name.endsWith(':') || name.endsWith('=')) name = name.slice(0, -1);
    if (rest[0] === '=' || rest[0] === ':') rest = rest.slice(1);
    if (!PARAM_NAME.test(name) || !rest.length) { skipped++; return; }
    if (UNKNOWN_PARAM.test(name)) { unknown++; return; }
    // Il primo nome vince: alcune esportazioni ripetono il parametro nei dettagli.
    if (params[name]) return;
    const value = cleanValue(rest[0]);
    params[name] = { value, named: !HEX_ONLY.test(value), line: i + 1 };
  });

  return { cafd, ecuHint: ecuFromFilename(filename) || ecuFromHeader(lines.slice(0, 40)), vinFound, params, unknown, skipped };
}

const ECU_NAMES = 'HU_NBT2|HU_NBTEVO|HU_NBT|NBTEVO|BDC_BODY|BDC|KOMBI|KAFAS|DME|IHKA|PMA|TRSVC|ATM|ASD|FZD|SAS|DSC|ACSM|SMFA|EGS|EPS|FLEL|FLER';
// Nel nome del file "_" e "-" sono separatori: "BDC_BODY-CAFD_000017BE.fwl", "x_KOMBI_y.fwl".
const ECU_IN_FILENAME = new RegExp(`(?<![A-Za-z0-9])(${ECU_NAMES})(?![A-Za-z0-9])`);
// Nelle righe di intestazione il nome deve stare da solo, per non confonderlo
// con un parametro che lo contiene (es. ASD_SOUND_OFF nella HU).
const ECU_IN_HEADER = new RegExp(`(?<![A-Za-z0-9_])(${ECU_NAMES})(?![A-Za-z0-9_])`);
const HEADER_HINT = /\b(ECU|SG|Steuerger|Basisvariante|Variante|Diagnose|Adresse)\b/i;

function ecuFromFilename(name) {
  const base = name.split(/[\\/]/).pop() || '';
  const m = base.match(ECU_IN_FILENAME);
  return m ? m[1] : null;
}

function ecuFromHeader(lines) {
  for (const l of lines) {
    if (!HEADER_HINT.test(l)) continue;
    const m = l.match(ECU_IN_HEADER);
    if (m) return m[1];
  }
  return null;
}

/**
 * Decide a quale centralina appartiene un FWL analizzato.
 * @param {ReturnType<typeof parseFwl>} parsed
 * @param {{cafd: Record<string,string>, alias: Record<string,string>, firme: Record<string,string[]>}} map
 * @returns {{ecu: string|null, how: 'nome'|'cafd'|'firma'|null}}
 */
export function identifyEcu(parsed, map) {
  const norm = n => (map.alias && map.alias[n]) || n;
  if (parsed.ecuHint) return { ecu: norm(parsed.ecuHint), how: 'nome' };
  if (parsed.cafd && map.cafd && map.cafd[parsed.cafd]) return { ecu: map.cafd[parsed.cafd], how: 'cafd' };
  let best = null, bestHits = 0;
  for (const [ecu, sig] of Object.entries(map.firme || {})) {
    const hits = sig.filter(p => p in parsed.params).length;
    if (hits > bestHits) { best = ecu; bestHits = hits; }
  }
  return best ? { ecu: best, how: 'firma' } : { ecu: null, how: null };
}
