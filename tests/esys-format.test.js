// Test sul formato reale degli FWL di E-Sys ("NOME: valore [hex]") e sulla FA.
// Le fixture in tests/fixtures/ riproducono il formato vero con valori di prova.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFwl, identifyEcu, valueHasVin, hexToAscii } from '../src/parser.js';
import { evaluateEntry, matchesTarget, unexplored } from '../src/matcher.js';
import { buildFootprint } from '../src/footprint.js';
import { isFa, parseFa } from '../src/fa.js';

const fx = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const MAP = { cafd: { '000016EE': 'IHKA', '00001F61': 'ATM' }, alias: {}, firme: { SMFA: ['Kunden_Memory'] } };

test('CAF_ID dà CAFD e versione', () => {
  const p = parseFwl(fx('IHKA_esys.fwl'), 'CAFD_000016EE_113_118_002.fwl');
  assert.equal(p.cafd, '000016EE');
  assert.equal(p.cafdVersion, '113_118_002');
  assert.deepEqual(identifyEcu(p, MAP), { ecu: 'IHKA', how: 'cafd' });
});

test('nomi con trattini, spazi e cifre iniziali', () => {
  const p = parseFwl(fx('IHKA_esys.fwl'));
  assert.equal(p.params['Display-Farbumschlag'].value, 'INAKTIV');
  assert.equal(p.params['Display-Farbumschlag'].hex, '00');
  assert.equal(p.params['4BIT_WERT_1'].value, 'AKTIV');
  assert.equal(p.params['LAENDERVARIANTE KLIMA'].value, 'ECE');
  assert.equal(p.params['Display-Farbumschlag-Timeout'].value, '0,7 Sekunden');
});

test('valori con spazi e virgole, dati grezzi senza parentesi', () => {
  const p = parseFwl(fx('PMA_esys.fwl'));
  assert.equal(p.params['Car Back Position X'].value, 'F54 JCW/S');
  assert.equal(p.params['Car Back Position X'].hex, '890D');
  assert.equal(p.params['RV PGM. mode bitmask'].value, '02, real PGM, overlays on, real video off');
  assert.equal(p.params['Coding Date'].named, false);
  assert.equal(p.params['Coding Date'].hex, '010124');
});

test('UnknowParam diventa un valore senza nome con il dato esadecimale', () => {
  const p = parseFwl(fx('SMFA_esys.fwl'));
  assert.deepEqual([p.params.KF_SB.value, p.params.KF_SB.named], ['05', false]);
  assert.equal(p.params.PIA_LKV_GES_L.value, '0000');
  assert.ok(!('.' in p.params));
  assert.deepEqual(identifyEcu(p, { cafd: {}, alias: {}, firme: { SMFA: ['Kunden_Memory'] } }), { ecu: 'SMFA', how: 'firma' });
});

test('il VIN in esadecimale viene riconosciuto, lungo e corto', () => {
  assert.equal(hexToAscii('57 4D 57'), 'WMW');
  assert.equal(parseFwl(fx('ATM_esys.fwl')).vinFound, true);
  assert.equal(parseFwl(fx('KAFAS_esys.fwl')).vinFound, true);
  assert.equal(parseFwl(fx('IHKA_esys.fwl')).vinFound, false);
  // "DRIVING" contiene le lettere VIN ma non è un VIN
  assert.equal(valueHasVin('default', '000000'), false);
});

test("l'impronta toglie VIN, concessionario, date di codifica e firme", () => {
  const atm = parseFwl(fx('ATM_esys.fwl'));
  const kafas = parseFwl(fx('KAFAS_esys.fwl'));
  const ihka = parseFwl(fx('IHKA_esys.fwl'));
  const { footprint, removed } = buildFootprint({
    ATM: { cafds: ['00001F61'], params: atm.params },
    KAFAS: { cafds: ['00001148'], params: kafas.params },
    IHKA: { cafds: ['000016EE'], params: ihka.params },
  });
  const json = JSON.stringify(footprint);
  for (const k of ['VIN', 'HaendlerNummer', 'TL_ID', 'SHORT_VIN', 'CODING_DATE', 'SIGNATURE']) assert.ok(!json.includes(`"${k}"`), k);
  assert.ok(!json.includes('57 4D 57'));
  assert.ok(removed.includes('ATM:VIN'));
  // i parametri normali restano, anche quelli con "VIN" dentro il nome
  assert.equal(footprint.centraline.KAFAS.params.DRIVING_STATES, 'default');
  assert.equal(footprint.centraline.ATM.params.WLAN_DOMAIN, 'etsi');
});

test('confronto tollerante: maiuscole, spazi, esadecimale', () => {
  assert.ok(matchesTarget({ value: 'nicht aktiv', hex: '00' }, 'nicht_aktiv'));
  assert.ok(matchesTarget({ value: 'AKTIV', hex: '01' }, 'aktiv'));
  assert.ok(matchesTarget({ value: '05', hex: '05', named: false }, '05'));
  assert.ok(matchesTarget({ value: 'wert_01', hex: '14' }, '14'));
  assert.ok(!matchesTarget({ value: 'wert_01', hex: '14' }, '15'));
});

test('nome del parametro trovato anche con maiuscole diverse', () => {
  const ecus = { DSC: { params: { C_SLD_vmax_kmh: { value: '250', hex: '32', named: true } } } };
  const e = { id: 'dsc.x', centralina: 'DSC', titolo: { it: 'x' }, parametri: [{ nome: 'C_SLD_VMAX_KMH', regolabile: true }] };
  assert.equal(evaluateEntry(e, ecus).stato, 'regolabile');
});

test('FA: serie, data, optional e mai il VIN', () => {
  const text = fx('FA_esempio.xml');
  assert.ok(isFa(text));
  assert.ok(!isFa(fx('IHKA_esys.fwl')));
  const fa = parseFa(text);
  assert.deepEqual([fa.serie, fa.tipo, fa.produzione], ['F54', 'XJ11', '03/2022']);
  assert.deepEqual(fa.sa, ['248', '302', '6AC']);
  assert.ok(!JSON.stringify(fa).includes('WMW'));
});

test("una voce che richiede un optional assente risulta 'manca_optional'", () => {
  const ecus = { BDC_BODY: { params: { NACHLAUFZEIT_LENKRADHEIZUNG: { value: '15_min', named: true } } } };
  const e = { id: 'bdc_body.v', centralina: 'BDC_BODY', titolo: { it: 'v' }, requisiti_sa: ['248'], parametri: [{ nome: 'NACHLAUFZEIT_LENKRADHEIZUNG', regolabile: true }] };
  assert.equal(evaluateEntry(e, ecus, { sa: new Set(['302']) }).stato, 'manca_optional');
  assert.deepEqual(evaluateEntry(e, ecus, { sa: new Set(['302']) }).sa_mancanti, ['248']);
  assert.equal(evaluateEntry(e, ecus, { sa: new Set(['248']) }).stato, 'regolabile');
  assert.equal(evaluateEntry(e, ecus).stato, 'regolabile'); // senza FA non si giudica
});

test('i parametri inesplorati non mostrano VIN né firme', () => {
  const atm = parseFwl(fx('ATM_esys.fwl'));
  const u = unexplored([], { ATM: { params: atm.params } });
  const names = u.ATM.map(x => x.nome);
  assert.ok(!names.includes('VIN') && !names.includes('TL_ID') && !names.includes('HaendlerNummer'));
  assert.ok(names.includes('WLAN_DOMAIN'));
});
