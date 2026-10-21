// Impronta anonima di un'auto: solo nomi e valori dei parametri, raggruppati per centralina.
// È ciò che un utente può condividere per far crescere il database senza esporre dati personali.

import { hasVin } from './parser.js';
// Parametri che possono contenere identificativi del veicolo, della chiave o dell'utente.
const PRIVATE_NAME = /(VIN|FGNR|FAHRGESTELL|SERIEN|SERIAL|SCHLUESSEL|KEY_ID|PIN|IMEI|ICCID|MAC_ADR|MAC_ADDRESS|BT_ADDR|NAME_|TELEFON|PHONE)/i;

export const FOOTPRINT_SCHEMA = 'fdl-scout/footprint@1';

/**
 * @param {Record<string, {cafd: string|null, params: Record<string,{value:string}>}>} ecus
 * @param {{telaio?: string, anno?: number, i_level?: string, hu?: string, note?: string}} meta dati inseriti dall'utente
 */
export function buildFootprint(ecus, meta = {}) {
  const removed = [];
  const out = {};
  for (const [ecu, data] of Object.entries(ecus)) {
    const params = {};
    for (const [name, v] of Object.entries(data.params)) {
      if (PRIVATE_NAME.test(name) || hasVin(v.value)) { removed.push(`${ecu}:${name}`); continue; }
      params[name] = v.value;
    }
    out[ecu] = { cafd: data.cafd || null, params };
  }
  const allowed = ['telaio', 'anno', 'i_level', 'hu', 'note'];
  const cleanMeta = Object.fromEntries(Object.entries(meta).filter(([k, v]) => allowed.includes(k) && v !== '' && v != null));
  if (cleanMeta.note && hasVin(cleanMeta.note)) delete cleanMeta.note;
  return { footprint: { schema: FOOTPRINT_SCHEMA, ...cleanMeta, centraline: out }, removed };
}
