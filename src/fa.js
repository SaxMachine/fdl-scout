// Lettore della FA (Fahrzeugauftrag) esportata da E-Sys in XML.
//
// Estrae solo ciò che serve a capire la configurazione: serie, codice tipo, data di
// produzione e codici SA/E/HO. Il VIN contenuto nell'intestazione non viene mai letto.
// Usa espressioni regolari invece di un parser XML, così funziona uguale in Node e nel browser.

const ATTR = (tag, attr) => new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*\\b${attr}="([^"]*)"`, 'i');
const LIST = tag => new RegExp(`<(?:\\w+:)?${tag}>\\s*([^<\\s]+)\\s*</(?:\\w+:)?${tag}>`, 'gi');

/** True se il testo sembra una FA di E-Sys. */
export function isFa(text) {
  return /<(?:\w+:)?(standardFA|faList|fa)\b/i.test(text) && /saCode/i.test(text);
}

/**
 * @param {string} text contenuto XML della FA
 * @returns {{serie: string|null, tipo: string|null, produzione: string|null, sa: string[], e: string[], ho: string[]}}
 */
export function parseFa(text) {
  const attr = (tag, a) => (text.match(ATTR(tag, a)) || [])[1] || null;
  const list = tag => [...text.matchAll(LIST(tag))].map(m => m[1].toUpperCase());
  const series = attr('standardFA', 'series');
  const time = attr('standardFA', 'timeCriteria'); // MMAA, es. 0322 = marzo 2022
  const produzione = time && /^\d{4}$/.test(time) ? `${time.slice(0, 2)}/20${time.slice(2)}` : null;
  return {
    serie: series ? series.replace(/^F0?/, 'F') : null, // F054 -> F54
    tipo: attr('standardFA', 'typeKey'),
    produzione,
    sa: [...new Set(list('saCode'))].sort(),
    e: [...new Set(list('eCode'))].sort(),
    ho: [...new Set(list('hoCode'))].sort(),
  };
}
