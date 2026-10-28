// Confronta i parametri letti dagli FWL con il database delle codifiche.

import { isPrivateParam } from './footprint.js';

/** Stati possibili di una voce rispetto all'auto analizzata. */
export const STATI = /** @type {const} */ ([
  'attivabile',          // tutti i parametri esistono e almeno uno non è al valore target
  'regolabile',          // i parametri esistono ma il valore è a scelta (es. tempi, soglie)
  'attiva',              // tutti i parametri sono già al valore target
  'manca_optional',      // la FA non ha l'optional (SA) che la funzione richiede
  'non_disponibile',     // la centralina è stata letta ma manca almeno un parametro
  'centralina_non_letta',// nessun FWL per quella centralina
  'da_mappare',          // la voce non ha ancora i nomi dei parametri
]);

/** Stati di una funzione su più voci: in più c'è "attiva in parte". */
export const STATI_FUNZIONE = /** @type {const} */ ([
  'attivabile', 'regolabile', 'parziale', 'attiva', 'manca_optional', 'non_disponibile', 'centralina_non_letta', 'da_mappare',
]);

/** Confronto tollerante: maiuscole, spazi/trattini bassi e "0x" non contano. */
const norm = v => String(v).trim().toLowerCase().replace(/^0x/, '').replace(/[\s_]+/g, '_');
const hexNorm = v => String(v).replace(/\s+/g, '').replace(/^0x/i, '').toUpperCase();

/** Il valore letto corrisponde al target, per nome o per dato esadecimale. */
export function matchesTarget(found, target) {
  if (norm(found.value) === norm(target)) return true;
  if (found.hex && /^(0x)?[0-9A-Fa-f]+$/.test(String(target).trim()) && hexNorm(found.hex) === hexNorm(target)) return true;
  return false;
}

/** Cerca un parametro per nome esatto, poi ignorando maiuscole e minuscole. */
function lookup(ecu, name) {
  if (ecu.params[name]) return ecu.params[name];
  if (!ecu._lower) {
    ecu._lower = {};
    for (const k of Object.keys(ecu.params)) ecu._lower[k.toLowerCase()] ||= ecu.params[k];
  }
  return ecu._lower[name.toLowerCase()] || null;
}

/**
 * @param {object} entry voce del database
 * @param {Record<string, {params: Record<string, {value: string, hex?: string, named: boolean}>}>} ecus centraline lette
 * @param {{sa?: Set<string>|null}} [ctx] codici SA letti dalla FA, se disponibili
 */
export function evaluateEntry(entry, ecus, ctx = {}) {
  const ecu = ecus[entry.centralina];
  const base = { id: entry.id, entry, valori: [] };
  const req = (entry.requisiti_sa || []).map(s => String(s).toUpperCase());
  if (ctx.sa && req.length) {
    const mancanti = req.filter(s => !ctx.sa.has(s));
    if (mancanti.length) return { ...base, stato: 'manca_optional', sa_mancanti: mancanti };
  }
  if (!entry.parametri || entry.parametri.length === 0) return { ...base, stato: 'da_mappare' };
  if (!ecu) return { ...base, stato: 'centralina_non_letta' };

  let missing = 0, atTarget = 0, withTarget = 0;
  for (const p of entry.parametri) {
    const found = lookup(ecu, p.nome);
    base.valori.push({ nome: p.nome, attuale: found ? found.value : null, nominato: found ? found.named : null, target: p.target ?? null, regolabile: !!p.regolabile, ok: !!(found && p.target != null && matchesTarget(found, p.target)) });
    if (!found) { missing++; continue; }
    if (p.target != null) {
      withTarget++;
      if (matchesTarget(found, p.target)) atTarget++;
    }
  }
  if (missing) return { ...base, stato: 'non_disponibile', mancanti: missing };
  if (withTarget === 0) return { ...base, stato: 'regolabile' };
  if (atTarget === withTarget) return { ...base, stato: 'attiva' };
  return { ...base, stato: 'attivabile' };
}

/** Valuta tutto il database. */
export function evaluateAll(db, ecus, ctx = {}) {
  return db.map(e => evaluateEntry(e, ecus, ctx));
}

// Parametri che non ha senso proporre come "inesplorati": tabelle tecniche,
// curve di calibrazione e dati di produzione.
const NOISE = [
  /^UnknowParam/i,
  /^(SIGNATURE|TL_ID|CAL_ID|Padding.*|Future[ _]?Use.*|#Spare.*)$/i,
  /(^|_)(Debug|Dbg)/i,
  /_(KENNLINIE|KL_\d+|STUETZSTELLE|TAB(ELLE)?|ARRAY)\b/i,
  /^(CHECKSUM|CRC|DATUM|DATE|SERIAL|VIN|FGNR)/i,
];

/**
 * Parametri presenti negli FWL che nessuna voce del database usa:
 * è la lista da cui la comunità scopre nuove codifiche.
 */
export function unexplored(db, ecus) {
  const known = new Set();
  for (const e of db) for (const p of e.parametri || []) known.add(`${e.centralina}:${p.nome}`.toLowerCase());
  const out = {};
  for (const [ecu, data] of Object.entries(ecus)) {
    const list = [];
    for (const [name, v] of Object.entries(data.params)) {
      if (known.has(`${ecu}:${name}`.toLowerCase())) continue;
      // Telaio, firme e simili non servono alla scoperta e non devono finire in uno screenshot.
      if (isPrivateParam(name, v)) continue;
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
  const c = Object.fromEntries(STATI_FUNZIONE.map(s => [s, 0]));
  for (const r of results) c[r.stato]++;
  return c;
}

/**
 * Stato complessivo di una funzione dalle sue parti.
 * Se una parte non si può fare o non si può sapere (optional, parametro assente, centralina non letta)
 * quello è lo stato della funzione: senza tutte le parti la funzione non è completa.
 * Altrimenti: tutte attive = attiva; alcune attive = parziale; nessuna = attivabile o regolabile.
 */
export function functionState(stati) {
  for (const s of ['manca_optional', 'non_disponibile', 'centralina_non_letta', 'da_mappare']) if (stati.includes(s)) return s;
  if (stati.every(s => s === 'attiva')) return 'attiva';
  if (stati.includes('attiva')) return 'parziale';
  return stati.includes('attivabile') ? 'attivabile' : 'regolabile';
}

/**
 * Elementi da mostrare: una per funzione (con le sue parti) e una per ogni voce che non fa parte
 * di nessuna funzione. Una voce può stare in più funzioni.
 */
export function buildItems(results, funzioni = []) {
  const byId = Object.fromEntries(results.map(r => [r.id, r]));
  const inFunction = new Set();
  const items = [];
  for (const f of funzioni) {
    const parti = f.parti.map(id => byId[id]).filter(Boolean);
    if (parti.length < 2) continue;
    parti.forEach(r => inFunction.add(r.id));
    items.push({ tipo: 'funzione', id: 'funz-' + f.id, funzione: f, parti, stato: functionState(parti.map(r => r.stato)) });
  }
  for (const r of results) if (!inFunction.has(r.id)) items.push({ tipo: 'voce', id: r.id, r, stato: r.stato });
  return items;
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
    ? { head: 'E-Sys work list', backup: 'Save the FDL of each unit before writing.', choose: 'choose a value', together: 'also needs' }
    : { head: 'Lista di lavoro per E-Sys', backup: 'Salva l\'FDL di ogni centralina prima di scrivere.', choose: 'scegli un valore', together: 'serve anche' };
  const byId = Object.fromEntries(results.map(r => [r.id, r]));
  const title = e => e.titolo[lang] || e.titolo.it || e.titolo.en;
  const lines = [`# ${L.head}`, `# ${L.backup}`, ''];
  for (const [ecu, rs] of Object.entries(byEcu)) {
    lines.push(`## ${ecu}`);
    for (const r of rs) {
      lines.push(`# ${title(r.entry)}`);
      for (const o of r.entry.insieme_a || []) {
        const other = byId[o];
        if (!other || selectedIds.has(o) || other.stato === 'attiva') continue;
        lines.push(`#   ${L.together}: ${title(other.entry)} (${other.entry.centralina})`);
      }
      for (const v of r.valori) {
        const to = v.target != null ? v.target : `<${L.choose}>`;
        if (v.ok) continue;
        lines.push(`${v.nome}: ${v.attuale ?? '?'} -> ${to}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}
