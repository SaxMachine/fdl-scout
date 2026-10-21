// Confronta i parametri letti dagli FWL con il database delle codifiche.

/** Stati possibili di una voce rispetto all'auto analizzata. */
export const STATI = /** @type {const} */ ([
  'attivabile',          // tutti i parametri esistono e almeno uno non è al valore target
  'regolabile',          // i parametri esistono ma il valore è a scelta (es. tempi, soglie)
  'attiva',              // tutti i parametri sono già al valore target
  'non_disponibile',     // la centralina è stata letta ma manca almeno un parametro
  'centralina_non_letta',// nessun FWL per quella centralina
  'da_mappare',          // la voce non ha ancora i nomi dei parametri
]);

const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/**
 * @param {object} entry voce del database
 * @param {Record<string, {params: Record<string, {value: string, named: boolean}>}>} ecus centraline lette
 */
export function evaluateEntry(entry, ecus) {
  const ecu = ecus[entry.centralina];
  const base = { id: entry.id, entry, valori: [] };
  if (!entry.parametri || entry.parametri.length === 0) return { ...base, stato: 'da_mappare' };
  if (!ecu) return { ...base, stato: 'centralina_non_letta' };

  let missing = 0, atTarget = 0, withTarget = 0;
  for (const p of entry.parametri) {
    const found = ecu.params[p.nome];
    base.valori.push({ nome: p.nome, attuale: found ? found.value : null, nominato: found ? found.named : null, target: p.target ?? null, regolabile: !!p.regolabile });
    if (!found) { missing++; continue; }
    if (p.target != null) {
      withTarget++;
      if (eq(found.value, p.target)) atTarget++;
    }
  }
  if (missing) return { ...base, stato: 'non_disponibile', mancanti: missing };
  if (withTarget === 0) return { ...base, stato: 'regolabile' };
  if (atTarget === withTarget) return { ...base, stato: 'attiva' };
  return { ...base, stato: 'attivabile' };
}

/** Valuta tutto il database. */
export function evaluateAll(db, ecus) {
  return db.map(e => evaluateEntry(e, ecus));
}

// Parametri che non ha senso proporre come "inesplorati": tabelle tecniche,
// curve di calibrazione e dati di produzione.
const NOISE = [
  /^UnknowParam/i,
  /_(KENNLINIE|KL_\d+|STUETZSTELLE|TAB(ELLE)?|ARRAY)\b/i,
  /^(CHECKSUM|CRC|DATUM|DATE|SERIAL|VIN|FGNR)/i,
];

/**
 * Parametri presenti negli FWL che nessuna voce del database usa:
 * è la lista da cui la comunità scopre nuove codifiche.
 */
export function unexplored(db, ecus) {
  const known = new Set();
  for (const e of db) for (const p of e.parametri || []) known.add(`${e.centralina}:${p.nome}`);
  const out = {};
  for (const [ecu, data] of Object.entries(ecus)) {
    const list = [];
    for (const [name, v] of Object.entries(data.params)) {
      if (known.has(`${ecu}:${name}`)) continue;
      if (NOISE.some(r => r.test(name))) continue;
      list.push({ nome: name, valore: v.value, nominato: v.named });
    }
    list.sort((a, b) => a.nome.localeCompare(b.nome));
    out[ecu] = list;
  }
  return out;
}

/** Riepilogo per stato, utile per i contatori della pagina. */
export function summarize(results) {
  const c = Object.fromEntries(STATI.map(s => [s, 0]));
  for (const r of results) c[r.stato]++;
  return c;
}

/**
 * Lista di lavoro per E-Sys: solo le voci attivabili scelte dall'utente,
 * raggruppate per centralina, con valore attuale e nuovo.
 */
export function esysChecklist(results, selectedIds, lang = 'it') {
  const byEcu = {};
  for (const r of results) {
    if (!selectedIds.has(r.id) || (r.stato !== 'attivabile' && r.stato !== 'regolabile')) continue;
    (byEcu[r.entry.centralina] ||= []).push(r);
  }
  const L = lang === 'en'
    ? { head: 'E-Sys work list', backup: 'Save the FDL of each unit before writing.', set: 'set', choose: 'choose a value' }
    : { head: 'Lista di lavoro per E-Sys', backup: 'Salva l\'FDL di ogni centralina prima di scrivere.', set: 'imposta', choose: 'scegli un valore' };
  const lines = [`# ${L.head}`, `# ${L.backup}`, ''];
  for (const [ecu, rs] of Object.entries(byEcu)) {
    lines.push(`## ${ecu}`);
    for (const r of rs) {
      lines.push(`# ${r.entry.titolo[lang] || r.entry.titolo.it}`);
      for (const v of r.valori) {
        const to = v.target != null ? v.target : `<${L.choose}>`;
        if (v.target != null && v.attuale != null && eq(v.attuale, v.target)) continue;
        lines.push(`${v.nome}: ${v.attuale ?? '?'} -> ${to}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}
