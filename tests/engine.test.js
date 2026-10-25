import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFwl, identifyEcu, tokenize } from '../src/parser.js';
import { evaluateEntry, unexplored, esysChecklist, summarize, evaluateAll } from '../src/matcher.js';
import { buildFootprint } from '../src/footprint.js';

// FWL sintetici: riproducono le varianti di formato viste finora (tab, spazi multipli, "=").
// Vanno sostituiti/affiancati da estratti di FWL reali in tests/fixtures/.
const HU_TAB = [
  'ECU HU_NBT2  CAFD_00001EF6_005_017_004',
  'VIN WMW00TEST0A123456',
  '',
  'CLIMATE_AUTORECIRCULATION\tauc_nicht_vorhanden\t00',
  'API_USB_VIDEO\tnone\t00',
  'ENT_CODEC_XVID\tnicht_aktiv\t00',
  'ASD_SOUND_OFF\tnicht_aktiv\t00',
  'UnknowParam0000000000\t01',
  'HMI_ID_VERSION\tid6_light\t03',
].join('\n');

const BDC_SPACES = [
  'Steuergerät 40  BDC_BODY',
  'TFL_MODUS            tfl_s        02',
  'ASP_BEIKLAPPEN       aktiv        01',
  'WL_TIMEOUT           14',
  'VEHICLE_SERIAL_NO    WMW00TEST0C111222',
  'MAPPING_ABBIEGEL_L_OUTPUT  off   00',
].join('\n');

const MAP = { cafd: { '00001EF6': 'HU_NBT2' }, alias: { BDC: 'BDC_BODY' }, firme: { KOMBI: ['BR_KENNUNG'] } };

test('tokenize gestisce tab, spazi multipli e singoli', () => {
  assert.deepEqual(tokenize('A\tb\t00'), ['A', 'b', '00']);
  assert.deepEqual(tokenize('A    b c   00'), ['A', 'b c', '00']);
  assert.deepEqual(tokenize('A = b'), ['A', '=', 'b']);
});

test('parseFwl estrae parametri, CAFD, VIN e scarta i segnaposto', () => {
  const p = parseFwl(HU_TAB, 'export.fwl');
  assert.equal(p.cafd, '00001EF6');
  assert.equal(p.ecuHint, 'HU_NBT2');
  assert.equal(p.vinFound, true);
  assert.equal(p.unknown, 1);
  assert.equal(p.params.CLIMATE_AUTORECIRCULATION.value, 'auc_nicht_vorhanden');
  assert.equal(p.params.CLIMATE_AUTORECIRCULATION.named, true);
  assert.ok(!('UnknowParam0000000000' in p.params));
});

test('il nome di un parametro nella HU non viene scambiato per una centralina', () => {
  const p = parseFwl('ASD_SOUND_OFF\tnicht_aktiv\nX\ty', 'senza_nome.fwl');
  assert.equal(p.ecuHint, null);
});

test('un parametro lungo 17 lettere non è un VIN', () => {
  assert.equal(parseFwl('ZUSATZWASSERPUMPE\tnicht_verbaut').vinFound, false);
  assert.equal(parseFwl('VIN\tWMW00TEST0B654321').vinFound, true);
});

test('valori esadecimali senza nome sono marcati come non nominati', () => {
  const p = parseFwl(BDC_SPACES, 'x.fwl');
  assert.equal(p.params.WL_TIMEOUT.value, '14');
  assert.equal(p.params.WL_TIMEOUT.named, false);
});

test('identifyEcu usa nome nel file, poi CAFD, poi firme', () => {
  assert.deepEqual(identifyEcu(parseFwl('A\tb', 'FA_BDC_BODY-CAFD_000017BE.fwl'), MAP), { ecu: 'BDC_BODY', how: 'nome' });
  assert.deepEqual(identifyEcu(parseFwl('A\tb', 'CAFD_00001EF6.fwl'), MAP), { ecu: 'HU_NBT2', how: 'cafd' });
  assert.deepEqual(identifyEcu(parseFwl('BR_KENNUNG\tf54', 'senza.fwl'), MAP), { ecu: 'KOMBI', how: 'firma' });
  assert.deepEqual(identifyEcu(parseFwl(BDC_SPACES, 'x.fwl'), MAP), { ecu: 'BDC_BODY', how: 'nome' });
});

const DB = [
  { id: 'hu_nbt2.auc', centralina: 'HU_NBT2', titolo: { it: 'AUC' }, parametri: [{ nome: 'CLIMATE_AUTORECIRCULATION', target: 'auc_vorhanden' }] },
  { id: 'hu_nbt2.video', centralina: 'HU_NBT2', titolo: { it: 'Video' }, parametri: [{ nome: 'API_USB_VIDEO', target: 'both' }, { nome: 'ENT_CODEC_XVID', target: 'aktiv' }] },
  { id: 'hu_nbt2.vid-mancante', centralina: 'HU_NBT2', titolo: { it: 'X' }, parametri: [{ nome: 'NON_ESISTE', target: 'aktiv' }] },
  { id: 'bdc_body.specchi', centralina: 'BDC_BODY', titolo: { it: 'Specchi' }, parametri: [{ nome: 'ASP_BEIKLAPPEN', target: 'aktiv' }] },
  { id: 'bdc_body.wl', centralina: 'BDC_BODY', titolo: { it: 'WL' }, parametri: [{ nome: 'WL_TIMEOUT', regolabile: true }] },
  { id: 'kombi.x', centralina: 'KOMBI', titolo: { it: 'K' }, parametri: [{ nome: 'BC_LEERZEILE', target: 'aktiv' }] },
  { id: 'fzd.y', centralina: 'FZD', titolo: { it: 'F' }, parametri: [], stato_mappatura: 'da_mappare' },
];

const ECUS = {
  HU_NBT2: { cafd: '00001EF6', params: parseFwl(HU_TAB).params },
  BDC_BODY: { cafd: null, params: parseFwl(BDC_SPACES).params },
};

test('evaluateEntry assegna tutti gli stati', () => {
  const s = Object.fromEntries(DB.map(e => [e.id, evaluateEntry(e, ECUS).stato]));
  assert.deepEqual(s, {
    'hu_nbt2.auc': 'attivabile',
    'hu_nbt2.video': 'attivabile',
    'hu_nbt2.vid-mancante': 'non_disponibile',
    'bdc_body.specchi': 'attiva',
    'bdc_body.wl': 'regolabile',
    'kombi.x': 'centralina_non_letta',
    'fzd.y': 'da_mappare',
  });
});

test('il confronto dei valori ignora maiuscole e minuscole', () => {
  const ecus = { IHKA: { params: { MEMORY_UMLUFT: { value: 'AKTIV', named: true } } } };
  const e = { id: 'ihka.m', centralina: 'IHKA', titolo: { it: 'M' }, parametri: [{ nome: 'MEMORY_UMLUFT', target: 'aktiv' }] };
  assert.equal(evaluateEntry(e, ecus).stato, 'attiva');
});

test('unexplored elenca solo i parametri non coperti dal database', () => {
  const u = unexplored(DB, ECUS);
  assert.deepEqual(u.HU_NBT2.map(x => x.nome), ['ASD_SOUND_OFF', 'HMI_ID_VERSION']);
  assert.ok(u.BDC_BODY.some(x => x.nome === 'TFL_MODUS'));
});

test('summarize conta per stato', () => {
  const c = summarize(evaluateAll(DB, ECUS));
  assert.equal(c.attivabile, 2);
  assert.equal(c.attiva, 1);
});

test('esysChecklist elenca solo i cambi necessari', () => {
  const rs = evaluateAll(DB, ECUS);
  const txt = esysChecklist(rs, new Set(['hu_nbt2.video', 'bdc_body.specchi']));
  assert.match(txt, /## HU_NBT2/);
  assert.match(txt, /API_USB_VIDEO: none -> both/);
  assert.doesNotMatch(txt, /ASP_BEIKLAPPEN/); // già attiva, non è nella lista
});

test("l'impronta toglie VIN e parametri identificativi", () => {
  const { footprint, removed } = buildFootprint(ECUS, { telaio: 'F54', i_level: 'F056-26-03-519', note: 'VIN WMW00TEST0C111222' });
  assert.ok(removed.includes('BDC_BODY:VEHICLE_SERIAL_NO'));
  assert.ok(!JSON.stringify(footprint).includes('WMW00TEST0C111222'));
  assert.equal(footprint.telaio, 'F54');
  assert.equal(footprint.note, undefined);
  assert.equal(footprint.centraline.HU_NBT2.params.API_USB_VIDEO, 'none');
});

test('esysChecklist usa il titolo nella lingua scelta, con ripiego sull\'altra', () => {
  const db = [
    { id: 'hu_nbt2.solo-en', centralina: 'HU_NBT2', titolo: { en: 'English only' }, parametri: [{ nome: 'API_USB_VIDEO', target: 'both' }] },
  ];
  const ecus = { HU_NBT2: { params: { API_USB_VIDEO: { value: 'none' } } } };
  const rs = evaluateAll(db, ecus);
  assert.match(esysChecklist(rs, new Set(['hu_nbt2.solo-en']), 'it'), /# English only/);
  assert.match(esysChecklist(rs, new Set(['hu_nbt2.solo-en']), 'en'), /# E-Sys work list/);
});

test('le centraline BMW si riconoscono dal nome e NBT non diventa NBT EVO', () => {
  const map = { cafd: {}, alias: { BDC: 'BDC_BODY' }, firme: {} };
  assert.equal(identifyEcu(parseFwl('CAF_ID:05 00 00 99 99 001 001 001\nA: b [00]', 'FEM_BODY_backup.fwl'), map).ecu, 'FEM_BODY');
  assert.equal(identifyEcu(parseFwl('CAF_ID:05 00 00 99 98 001 001 001\nA: b [00]', 'HU_NBT.fwl'), map).ecu, 'HU_NBT');
});
