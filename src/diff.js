// Confronto tra due FWL della stessa centralina: prima e dopo una codifica.
// Serve a scoprire con certezza quali parametri cambia una funzione (per esempio una codifica fatta con un'app).

import { isPrivateParam } from './footprint.js';

const N = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Parametri cambiati, comparsi o spariti tra due FWL. I parametri privati (VIN e simili) non escono mai.
 * @param {Record<string,{value:string,hex?:string}>} before
 * @param {Record<string,{value:string,hex?:string}>} after
 */
export function diffParams(before, after) {
  const changed = [], added = [], removed = [];
  let hidden = 0;
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const name of [...names].sort()) {
    const a = before[name], b = after[name];
    if ((a && isPrivateParam(name, a)) || (b && isPrivateParam(name, b))) {
      if (!a || !b || a.value !== b.value || (a.hex || '') !== (b.hex || '')) hidden++;
      continue;
    }
    if (a && b) {
      if (a.value !== b.value || (a.hex || '') !== (b.hex || '')) changed.push({ nome: name, prima: a, dopo: b });
    } else if (b) added.push({ nome: name, dopo: b });
    else removed.push({ nome: name, prima: a });
  }
  return { changed, added, removed, hidden };
}

/** Voci del database che usano i parametri cambiati, nella stessa centralina. */
export function entriesForChanges(changes, db, ecu) {
  const want = new Set(changes.map(c => N(c.nome)));
  return db.filter(e => e.centralina === ecu && e.parametri.some(p => want.has(N(p.nome))));
}

/** Testo da incollare in una segnalazione: centralina, CAFD e parametri cambiati. */
export function diffReport(groups, lang = 'it') {
  const L = lang === 'en'
    ? { head: 'FWL before/after comparison', none: 'no change', newp: 'not in the database' }
    : { head: 'Confronto FWL prima/dopo', none: 'nessuna differenza', newp: 'non nel database' };
  const lines = [`## ${L.head}`, ''];
  for (const g of groups) {
    lines.push(`### ${g.ecu || '?'}${g.cafd ? ' · CAFD ' + g.cafd : ''}`);
    if (!g.diff.changed.length && !g.diff.added.length && !g.diff.removed.length) { lines.push(L.none, ''); continue; }
    const known = new Set(g.entries.flatMap(e => e.parametri.map(p => N(p.nome))));
    for (const c of g.diff.changed) lines.push(`- ${c.nome}: ${c.prima.value} [${c.prima.hex || ''}] -> ${c.dopo.value} [${c.dopo.hex || ''}]${known.has(N(c.nome)) ? '' : ' (' + L.newp + ')'}`);
    for (const c of g.diff.added) lines.push(`- ${c.nome}: + ${c.dopo.value} [${c.dopo.hex || ''}]`);
    for (const c of g.diff.removed) lines.push(`- ${c.nome}: - ${c.prima.value} [${c.prima.hex || ''}]`);
    lines.push('');
  }
  return lines.join('\n');
}
