// Parser per i file FWL esportati da E-Sys (lettura FDL in formato testo).
//
// Formato reale di E-Sys, una riga per parametro:
//
//   CAF_ID:05 00 00 16 EE 113 118 002
//   MEMORY_UMLUFT: NICHT_AKTIV [00]
//   Car Back Position X: F54 JCW/S [89 0D]
//   KF_SB: UnknowParam05 [05]          <- il PSdZData non ha il nome del valore
//   Coding Date: 01 01 24              <- dato grezzo senza nome né parentesi
//
// I nomi possono contenere spazi, punti e trattini; i valori possono contenere spazi.
// Tra parentesi quadre c'è sempre il dato esadecimale reale scritto nella centralina.
// Per compatibilità resta un percorso di riserva per righe "NOME<tab>valore" o
// "NOME   valore" senza due punti.
//
// Funziona identico nel browser e in Node: nessuna dipendenza.

const CAFD_RE = /CAFD[_\s-]*([0-9A-Fa-f]{8})/;
const CAF_ID_RE = /^CAF_ID:\s*([0-9A-Fa-f]{2})\s+([0-9A-Fa-f]{2})\s+([0-9A-Fa-f]{2})\s+([0-9A-Fa-f]{2})\s+([0-9A-Fa-f]{2})\s+(\d{3})\s+(\d{3})\s+(\d{3})/;
// "NOME: valore [AA BB]" — il nome finisce al primo ":" seguito da spazio o fine riga.
const COLON_LINE = /^([^:\[\]]+?):\s*(.*?)\s*(?:\[([0-9A-Fa-f\s]*)\])?\s*$/;
const NAME_OK = /^[A-Za-z0-9#][A-Za-z0-9_ .\-#/()+]*$/;
const SIMPLE_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const UNKNOWN_VALUE = /^Unknow[n]?Param([0-9A-Fa-f]*)$/i;
const HEX_BYTES = /^(?:[0-9A-Fa-f]{2})(?:\s+[0-9A-Fa-f]{2})*$/;
const HEX_ONLY = /^(0x)?[0-9A-Fa-f]+$/;

// Il VIN deve stare da solo: non un pezzo di una sequenza più lunga di byte o lettere.
const VIN_RE = /(?<![A-Z0-9])[A-HJ-NPR-Z0-9]{17}(?![A-Z0-9])/g;
/** Nomi di parametro che contengono il numero di telaio. */
export const VIN_NAME = /(^|[_\s])(VIN|FGNR)([_\s]|$)|FAHRGESTELL/i;
/** Un VIN ha cifre e lettere mescolate: evita falsi positivi come ZUSATZWASSERPUMPE. */
export function hasVin(s) {
  for (const m of String(s).toUpperCase().matchAll(VIN_RE)) {
    const d = (m[0].match(/\d/g) || []).length;
    if (d >= 3 && d <= 14) return true;
  }
  return false;
}

/** Decodifica una sequenza di byte esadecimali in testo ASCII stampabile, se lo è. */
export function hexToAscii(hex) {
  const clean = String(hex).replace(/\s+/g, '');
  if (!clean || clean.length % 2 || !/^[0-9A-Fa-f]+$/.test(clean)) return null;
  let out = '';
  for (let i = 0; i < clean.length; i += 2) {
    const c = parseInt(clean.slice(i, i + 2), 16);
    if (c < 0x20 || c > 0x7e) return null;
    out += String.fromCharCode(c);
  }
  return out;
}

/** True se il valore, in chiaro o decodificato da esadecimale, contiene un VIN o parte di esso. */
export function valueHasVin(value, hex = '') {
  if (hasVin(value)) return true;
  for (const h of [hex, value]) {
    const a = hexToAscii(h);
    if (a && (hasVin(a) || /^[A-HJ-NPR-Z0-9]{7}$/.test(a) && /\d/.test(a) && /[A-Z]/.test(a))) return true; // VIN lungo o corto (7 caratteri)
  }
  return false;
}

/** Divide una riga senza due punti in token: tab, poi due o più spazi, poi spazi singoli. */
export function tokenize(line) {
  const t = line.trim();
  if (!t) return [];
  if (t.includes('\t')) return t.split(/\t+/).map(s => s.trim()).filter(Boolean);
  const wide = t.split(/\s{2,}/);
  if (wide.length > 1) return wide.map(s => s.trim()).filter(Boolean);
  return t.split(/\s+/);
}

/**
 * Interpreta il valore di una riga.
 * @returns {{value: string, hex: string, named: boolean}}
 */
function interpret(rawValue, rawHex) {
  const hex = (rawHex || '').replace(/\s+/g, '').toUpperCase();
  const v = rawValue.trim();
  const unk = v.match(UNKNOWN_VALUE);
  if (unk) {
    // Valore senza nome: il dato utile è quello esadecimale.
    const h = hex || unk[1].toUpperCase();
    return { value: h, hex: h, named: false };
  }
  if (!v && hex) return { value: hex, hex, named: false };
  if (!hex && HEX_BYTES.test(v)) {
    // Dato grezzo senza parentesi (date, numeri, identificativi).
    const h = v.replace(/\s+/g, '').toUpperCase();
    return { value: v, hex: h, named: false };
  }
  return { value: v, hex, named: !HEX_ONLY.test(v) };
}

/**
 * Analizza il testo di un FWL.
 * @param {string} text contenuto del file
 * @param {string} [filename] nome del file, usato per trovare CAFD e centralina
 * @returns {{cafd: string|null, cafdVersion: string|null, ecuHint: string|null, vinFound: boolean,
 *            params: Record<string, {value: string, hex: string, named: boolean, line: number}>,
 *            unknown: number, skipped: number}}
 */
export function parseFwl(text, filename = '') {
  const params = {};
  let cafd = null, cafdVersion = null;
  let vinFound = false;
  let unknown = 0, skipped = 0;

  const fm = filename.match(CAFD_RE);
  if (fm) cafd = fm[1].toUpperCase();

  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.replace(/\u0000/g, '').trim();
    if (!line) return;

    const caf = line.match(CAF_ID_RE);
    if (caf) {
      cafd = (caf[2] + caf[3] + caf[4] + caf[5]).toUpperCase();
      cafdVersion = `${caf[6]}_${caf[7]}_${caf[8]}`;
      return;
    }
    if (!cafd) {
      const m = line.match(CAFD_RE);
      if (m) cafd = m[1].toUpperCase();
    }

    let name, value, hex, named;
    const m = line.includes(':') ? line.match(COLON_LINE) : null;
    if (m && NAME_OK.test(m[1].trim())) {
      name = m[1].trim();
      ({ value, hex, named } = interpret(m[2], m[3]));
    } else {
      // Percorso di riserva: "NOME<tab>valore" o "NOME   valore".
      const tok = tokenize(line);
      if (tok.length < 2 || !SIMPLE_NAME.test(tok[0])) { skipped++; return; }
      name = tok[0];
      ({ value, hex, named } = interpret(tok[1].replace(/^[=:]\s*/, ''), ''));
    }

    if (/^\.+$/.test(name) || /^Unknow[n]?Param/i.test(name)) { unknown++; return; }
    if ((VIN_NAME.test(name) && !named) || valueHasVin(value, hex)) vinFound = true;
    if (!named) unknown++;
    // Il primo nome vince: alcune esportazioni ripetono il parametro nei dettagli.
    if (params[name]) return;
    params[name] = { value, hex, named, line: i + 1 };
  });

  return { cafd, cafdVersion, ecuHint: ecuFromFilename(filename) || ecuFromHeader(lines.slice(0, 40)), vinFound, params, unknown, skipped };
}

const ECU_NAMES = 'HU_NBT2|HU_NBTEVO|HU_NBT|HU_CIC|NBTEVO|BDC_BODY|BDC|FEM_BODY|KOMBI|KAFAS|DME|IHKA|PMA|TRSVC|ATM|ASD|FZD|SAS|DSC|ACSM|SMFA|EGS5|EGS|EPS|FLEL|FLER|FLE|ZBE';
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
    if (!HEADER_HINT.test(l) || l.includes('[')) continue;
    const m = l.match(ECU_IN_HEADER);
    if (m) return m[1];
  }
  return null;
}

/**
 * Decide a quale centralina appartiene un FWL analizzato.
 * Ordine: nome nel file o nell'intestazione, CAFD noto, parametri "firma".
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
