// Impronta anonima di un'auto: solo nomi e valori dei parametri, raggruppati per centralina.
// È ciò che un utente può condividere per far crescere il database senza esporre dati personali.

import { valueHasVin, VIN_NAME } from './parser.js';

// Parametri che identificano il veicolo, l'officina o il momento della codifica, o che
// sono firme crittografiche: vengono sempre tolti, qualunque valore abbiano.
const PRIVATE_NAME = new RegExp([
  VIN_NAME.source,
  '(^|[_\\s])(SERIEN|SERIAL|SERIENNUMMER|KEY_ID|PIN|IMEI|ICCID|IMSI|MSISDN|MAC_ADR|MAC_ADDRESS|BT_ADDR|TELEFON|PHONE)([_\\s]|$)',
  'HAENDLER|HÄNDLER|DEALER',
  'CODIERDATUM|CODING[_\\s]?DATE|C_CODIERDATUM',
  'WERKSKENNUNG|WERKSNUMMER',
  '^SIGNATURE$|^TL_ID$|^CAL_ID$',
].join('|'), 'i');

export const FOOTPRINT_SCHEMA = 'fdl-scout/footprint@1';

/** True se il parametro va escluso dall'impronta. */
export function isPrivateParam(name, v) {
  return PRIVATE_NAME.test(name) || valueHasVin(v.value, v.hex);
}

/**
 * @param {Record<string, {cafds?: string[], cafd?: string|null, params: Record<string,{value:string, hex?:string}>}>} ecus
 * @param {{telaio?: string, anno?: number, i_level?: string, hu?: string, note?: string, sa?: string[]}} meta dati inseriti dall'utente
 */
export function buildFootprint(ecus, meta = {}) {
  const removed = [];
  const out = {};
  for (const [ecu, data] of Object.entries(ecus)) {
    const params = {};
    for (const [name, v] of Object.entries(data.params)) {
      if (isPrivateParam(name, v)) { removed.push(`${ecu}:${name}`); continue; }
      params[name] = v.value;
    }
    out[ecu] = { cafd: data.cafds || (data.cafd ? [data.cafd] : []), params };
  }
  const allowed = ['telaio', 'anno', 'i_level', 'hu', 'note', 'sa'];
  const cleanMeta = Object.fromEntries(Object.entries(meta).filter(([k, v]) => allowed.includes(k) && v !== '' && v != null));
  if (cleanMeta.note && valueHasVin(cleanMeta.note)) delete cleanMeta.note;
  return { footprint: { schema: FOOTPRINT_SCHEMA, ...cleanMeta, centraline: out }, removed };
}
