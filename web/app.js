import { parseFwl, identifyEcu } from './src/parser.js';
import { evaluateAll, unexplored, summarize, esysChecklist, buildItems, STATI_FUNZIONE } from './src/matcher.js';
import { buildFootprint } from './src/footprint.js';
import { isFa, parseFa } from './src/fa.js';
import { T } from './i18n.js';
import { diffParams, entriesForChanges, diffReport } from './src/diff.js';

// Repository pubblico del progetto (link a codice, database e segnalazioni).
const REPO = 'https://github.com/SaxMachine/fdl-scout';

const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) n.append(c);
  return n;
};
const store = {
  get(k, d) { try { const v = localStorage.getItem('fdlscout.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fdlscout.' + k, JSON.stringify(v)); } catch { /* storage non disponibile */ } },
};

const state = {
  lang: store.get('lang', (navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en'),
  db: [], map: { cafd: {}, alias: {}, firme: {}, nomi: {} }, sa: {},
  files: [],            // {name, parsed, ecu, how}
  fa: null,             // {serie, tipo, produzione, sa[]} dalla FA, senza VIN
  selected: new Set(),
  results: [],
  funzioni: [],         // funzioni su più voci (data/funzioni.yaml)
  items: [],            // cosa mostra la lista: funzioni e voci singole
  tab: 'codings',
  cmp: { before: [], after: [] }, // file per il confronto prima/dopo
};
const t = () => T[state.lang];
const tr = obj => (obj && (obj[state.lang] || obj.it || obj.en)) || '';

/** Centraline lette, nel formato atteso dal matcher. Più file della stessa centralina si uniscono. */
function ecus() {
  const out = {};
  for (const f of state.files) {
    if (!f.ecu) continue;
    const e = out[f.ecu] ||= { cafds: [], params: {} };
    if (f.parsed.cafd) e.cafds.push(f.parsed.cafdVersion ? `${f.parsed.cafd}_${f.parsed.cafdVersion}` : f.parsed.cafd);
    Object.assign(e.params, f.parsed.params);
  }
  return out;
}

// ---------- caricamento ----------
async function loadDb() {
  const r = await fetch('db.json', { cache: 'no-cache' }); // sempre l'ultima versione del database
  const data = await r.json();
  state.db = data.voci;
  state.funzioni = data.funzioni || [];
  state.map = data.centraline;
  state.sa = data.sa || {};
  $('#dbDate').textContent = `${state.db.length} · ${data.generato.slice(0, 10)}`;
}

async function addFiles(fileList) {
  // Copia subito: la FileList dell'input si svuota appena azzeriamo input.value.
  const list = [...fileList];
  for (const file of list) {
    const text = await file.text();
    if (isFa(text)) { state.fa = parseFa(text); continue; }
    const parsed = parseFwl(text, file.name);
    const { ecu, how } = identifyEcu(parsed, state.map);
    state.files = state.files.filter(f => f.name !== file.name);
    state.files.push({ name: file.name, parsed, ecu, how });
  }
  refresh();
}

const drop = $('#drop');
const input = $('#files');
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
drop.addEventListener('drop', e => { e.preventDefault(); addFiles(e.dataTransfer.files); });
input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
$('#addMore').addEventListener('click', () => input.click());
$('#shareLoad').addEventListener('click', () => input.click());
$('#reset').addEventListener('click', () => { state.files = []; state.fa = null; state.selected.clear(); refresh(); });

// ---------- rendering ----------
function renderStatic() {
  document.documentElement.lang = state.lang;
  document.title = t().docTitle;
  document.querySelectorAll('[data-t]').forEach(n => {
    const v = t()[n.dataset.t];
    if (typeof v === 'string') n.textContent = v;
  });
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
  $('#fQ').placeholder = t().search;
  $('#dQ').placeholder = t().discoverFilter;
  $('#repoLink').href = REPO;
  $('#howtoLink').href = `${REPO}/blob/main/docs/${state.lang === 'it' ? 'ESPORTARE-DA-ESYS.md' : 'en/EXPORTING-FROM-ESYS.md'}`;
}

function renderUnits() {
  const has = state.files.length > 0 || !!state.fa;
  $('#loaded').hidden = !has;
  $('#hero').classList.toggle('compact', has);
  $('#catalogueNote').hidden = has;
  if (!has) return;
  $('#loadedTitle').textContent = t().loaded(Object.keys(ecus()).length);
  const known = [...new Set([...Object.keys(state.map.nomi || {}), ...(state.map.altre || []), ...state.db.map(e => e.centralina), ...state.files.map(f => f.ecu).filter(Boolean)])].sort();
  // Un codice verificato solo su certi telai (es. MINI) si nomina solo se la FA è di quei telai.
  const named = state.fa ? state.fa.sa.filter(c => state.sa[c] && (!state.sa[c].telai || state.sa[c].telai.includes(state.fa.serie))) : [];
  const faCard = state.fa
    ? el('li', { class: 'unit fa' },
        el('strong', { text: 'FA' }),
        el('span', { class: 'unit-desc', text: [state.fa.serie, state.fa.tipo, state.fa.produzione].filter(Boolean).join(' · ') }),
        el('span', { class: 'unit-meta', text: t().saCount(state.fa.sa.length) }),
        el('details', { class: 'unit-change' }, el('summary', { text: t().saShow(named.length) }),
          el('ul', { class: 'sa-list' }, ...named.map(c => el('li', {}, el('code', { text: c }), ' ', tr(state.sa[c]))))))
    : el('li', { class: 'unit fa missing' },
        el('strong', { text: 'FA' }),
        el('span', { class: 'unit-desc', text: t().faMissing }),
        el('span', { class: 'unit-meta', text: t().faWhy }),
        el('button', { type: 'button', class: 'ghost small', onclick: () => input.click() }, t().faAdd));
  $('#ecuNames').replaceChildren(...known.map(k => el('option', { value: k })));
  const files = [...state.files].sort((a, b) => (a.ecu || '~').localeCompare(b.ecu || '~') || a.name.localeCompare(b.name));
  $('#units').replaceChildren(faCard, ...files.map(f => {
    const n = Object.keys(f.parsed.params).length;
    // Campo libero con suggerimenti: le BMW serie F hanno centraline che il database non conosce ancora.
    const picker = el('input', {
      type: 'text', list: 'ecuNames', value: f.ecu || '', placeholder: t().chooseEcu, 'aria-label': t().chooseEcu,
      autocomplete: 'off', spellcheck: 'false', class: 'ecu-input',
      onchange: e => { const v = e.target.value.trim().toUpperCase().replace(/\s+/g, '_'); f.ecu = (state.map.alias || {})[v] || v || null; /* nome di E-Sys -> nome del database */ f.how = f.ecu ? 'manuale' : null; refresh(); },
    });
    return el('li', { class: 'unit' + (f.ecu ? '' : ' unknown') },
      f.ecu ? el('strong', { text: f.ecu }) : picker,
      el('span', { class: 'unit-desc', text: f.ecu ? tr(state.map.nomi?.[f.ecu]) : f.name }),
      el('span', { class: 'unit-meta', text: [f.parsed.cafd && `CAFD ${f.parsed.cafd}`, t().params(n), f.how && t().how[f.how]].filter(Boolean).join(', ') }),
      f.ecu ? el('details', { class: 'unit-change' }, el('summary', { text: t().change }), picker) : null,
      f.parsed.vinFound ? el('span', { class: 'unit-vin', text: t().vinWarn }) : null);
  }));
}

function renderOverview(counts) {
  const total = state.items.length;
  const order = state.files.length ? STATI_FUNZIONE : ['da_mappare', 'centralina_non_letta'];
  $('#meter').replaceChildren(...order.filter(s => counts[s]).map(s => {
    const seg = el('span', { class: `seg s-${s}`, title: `${t().stati[s]}: ${counts[s]}` });
    seg.style.flexGrow = String(counts[s]); // CSSOM: permesso dalla Content-Security-Policy, l'attributo style no
    return seg;
  }));
  $('#legend').replaceChildren(...STATI_FUNZIONE.filter(s => counts[s]).map(s =>
    el('li', { class: `s-${s}` },
      el('button', { type: 'button', title: t().statiHelp[s], onclick: () => { $('#fState').value = s; renderRows(); } },
        el('b', { text: counts[s] }), ' ', t().stati[s]))));
  $('#meter').setAttribute('aria-label', `${total}`);
}

function renderFilters() {
  const ecuSel = $('#fEcu'), stSel = $('#fState');
  const keepE = ecuSel.value, keepS = stSel.value;
  const units = [...new Set(state.db.map(e => e.centralina))].sort();
  ecuSel.replaceChildren(el('option', { value: '', text: t().allEcus }), ...units.map(u => el('option', { value: u, text: u })));
  stSel.replaceChildren(el('option', { value: '', text: t().allStates }), ...STATI_FUNZIONE.map(s => el('option', { value: s, text: t().stati[s] })));
  ecuSel.value = keepE; stSel.value = keepS;
}

/** True se la FA indica un telaio e la voce è documentata solo su telai diversi. */
const otherChassis = e => !!(state.fa?.serie && e.telai?.length && !e.telai.includes(state.fa.serie));

// Se nessuna voce copre il telaio della FA basta l'avviso in cima, senza ripeterlo su ogni riga.
const chassisCovered = () => state.db.some(e => e.telai?.includes(state.fa?.serie));

const RANK = { attivabile: 0, regolabile: 1, parziale: 2, attiva: 3, manca_optional: 4, non_disponibile: 5, centralina_non_letta: 6, da_mappare: 7 };

function renderRows() {
  const fe = $('#fEcu').value, fs = $('#fState').value, q = $('#fQ').value.trim().toLowerCase(), hide = $('#fHide').checked;
  const parts = it => it.tipo === 'funzione' ? it.parti : [it.r];
  const firstUnit = it => parts(it)[0].entry.centralina;
  const allOther = it => parts(it).every(r => otherChassis(r.entry));
  const rows = state.items
    .filter(it => !fe || parts(it).some(r => r.entry.centralina === fe))
    .filter(it => !fs || it.stato === fs)
    .filter(it => !hide || !parts(it).some(r => r.entry.consiglio === 'sconsigliata'))
    .filter(it => !q || [it.tipo === 'funzione' ? tr(it.funzione.titolo) : '', ...parts(it).flatMap(r => [tr(r.entry.titolo), r.entry.centralina, ...r.entry.parametri.map(p => p.nome)])].join(' ').toLowerCase().includes(q))
    .sort((a, b) => RANK[a.stato] - RANK[b.stato] || allOther(a) - allOther(b) || (b.tipo === 'funzione') - (a.tipo === 'funzione') || firstUnit(a).localeCompare(firstUnit(b)));
  // Con la FA di un telaio che il database non copre ancora, un avviso unico in cima.
  const serie = state.fa?.serie;
  const covered = serie && state.db.filter(e => e.telai?.includes(serie)).length;
  $('#chassisNote').hidden = !serie || covered > 0;
  if (serie && !covered) $('#chassisNote').textContent = t().chassisNone(serie);
  $('#empty').hidden = rows.length > 0;
  $('#rows').replaceChildren(...rows.map(it => it.tipo === 'funzione' ? functionView(it) : rowView(it.r)));
}

function valueCell(v) {
  if (v == null) return el('span', { class: 'v none', text: '—' });
  return el('code', { class: 'v' }, v);
}

/** Link alle fonti di una voce, con il nome del sito come testo. */
function sourcesView(fonti) {
  const list = (fonti || []).filter(u => /^https:\/\//.test(u));
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const total = {}, seen = {};
  for (const u of list) total[host(u)] = (total[host(u)] || 0) + 1;
  const links = list.map(u => {
    const h = host(u);
    seen[h] = (seen[h] || 0) + 1;
    const label = total[h] > 1 ? `${h} (${seen[h]})` : h; // stesso sito più volte: numera i link
    return el('a', { href: u, target: '_blank', rel: 'noopener noreferrer', title: u, text: label });
  });
  if (!links.length) return el('p', { class: 'sources none', text: t().noSources });
  return el('p', { class: 'sources' }, el('b', { text: t().sources + ': ' }), ...links.flatMap((a, i) => i ? [', ', a] : [a]));
}

/** Link a una segnalazione GitHub già compilata per raccontare una prova. */
// Voci da codificare insieme: titolo, centralina e stato sulla tua auto, con link alla riga.
function togetherView(e) {
  const ids = e.insieme_a || [];
  if (!ids.length) return null;
  const byId = Object.fromEntries((state.results || []).map(r => [r.id, r]));
  const items = ids.map(id => {
    const r = byId[id]; const o = r?.entry || state.db.find(x => x.id === id);
    if (!o) return null;
    return el('li', {}, el('a', { href: '#voce-' + id, text: tr(o.titolo) }), ` (${o.centralina}${r ? ' · ' + t().stati[r.stato] : ''})`);
  }).filter(Boolean);
  return el('div', { class: 'together' }, el('b', { text: t().together + ':' }), el('ul', {}, ...items));
}

function reportView(e) {
  const title = encodeURIComponent(`${t().reportTitle}: ${tr(e.titolo)}`);
  const body = encodeURIComponent(t().reportBody(e.id, tr(e.titolo)));
  const text = e.affidabilita === 'da_verificare' ? t().reportLinkVerify : t().reportLink;
  return el('p', { class: 'report' }, el('a', { href: `${REPO}/issues/new?labels=prova&title=${title}&body=${body}`, target: '_blank', rel: 'noopener noreferrer', text }));
}

function rowView(r, nested = false) {
  const e = r.entry;
  const actionable = !nested && (r.stato === 'attivabile' || r.stato === 'regolabile');
  const id = 'sel-' + e.id.replace(/\W/g, '-');
  const titleLang = e.titolo[state.lang] ? null : el('span', { class: 'lang-fallback', text: e.titolo.it ? 'IT' : 'EN', title: t().notTranslated });
  const switchEl = el('span', { class: `toggle s-${r.stato}`, role: 'img', 'aria-label': t().stati[r.stato] }, el('i'));

  const params = el('table', { class: 'params' },
    el('thead', {}, el('tr', {}, el('th', { text: 'FDL' }), el('th', { text: t().current }), el('th', { text: t().target }))),
    el('tbody', {}, (r.valori.length ? r.valori : e.parametri.map(p => ({ nome: p.nome, target: p.target, regolabile: p.regolabile, attuale: null }))).map(v =>
      el('tr', { class: v.ok ? 'ok' : '' },
        el('td', {}, el('code', { text: v.nome })),
        el('td', {}, valueCell(v.attuale), v.nominato === false ? el('small', { text: ' ' + t().noName }) : null),
        el('td', {}, v.target != null ? valueCell(v.target) : el('em', { text: t().choose }))))));

  const tags = [
    el('span', { class: `risk r-${e.rischio}`, text: t().risk[e.rischio] }),
    e.consiglio === 'sconsigliata' ? el('span', { class: 'tag bad', text: t().advisedAgainst }) : null,
    e.affidabilita === 'da_verificare' ? el('span', { class: 'tag', text: t().unverified }) : null,
    r.sa_mancanti ? el('span', { class: 'tag bad', text: t().missingSa(r.sa_mancanti.join(', ')) }) : null,
    otherChassis(e) && chassisCovered() ? el('span', { class: 'tag warn', text: t().otherChassis(e.telai.join(', '), state.fa.serie) }) : null,
  ];
  const seen = (e.osservazioni || []).map(o => `${o.telaio} ${o.anno || ''} ${o.i_level || ''}`.trim());

  const details = el('details', { class: 'more' },
    el('summary', { text: e.parametri.length ? e.parametri.map(p => p.nome).join(', ') : t().stati.da_mappare }),
    e.parametri.length ? params : null,
    e.valori_suggeriti ? el('p', {}, el('b', { text: t().suggested + ': ' }), tr(e.valori_suggeriti)) : null,
    e.requisiti_sa?.length ? el('p', {}, el('b', { text: t().needsSa + ': ' }), e.requisiti_sa.join(', ')) : null,
    tr(e.note) ? el('p', { class: 'note', text: tr(e.note) }) : null,
    nested ? null : togetherView(e),
    seen.length ? el('p', { class: 'seen', text: `${t().seenOn}: ${seen.join('; ')}` }) : null,
    sourcesView(e.fonti),
    reportView(e));

  return el('li', { id: nested ? null : 'voce-' + e.id, class: `row s-${r.stato}` + (nested ? ' part' : '') + (e.consiglio === 'sconsigliata' ? ' advised-against' : '') },
    el('div', { class: 'row-main' },
      switchEl,
      el('div', { class: 'row-title' },
        el('h3', {}, tr(e.titolo), titleLang),
        el('p', { class: 'row-sub' }, el('span', { class: 'ecu', text: e.centralina }), ' ', el('span', { class: 'state', text: t().stati[r.stato] }), ...tags)),
      actionable ? el('label', { class: 'pick', for: id, title: t().addToList },
        el('input', { type: 'checkbox', id, checked: state.selected.has(e.id), onchange: ev => { ev.target.checked ? state.selected.add(e.id) : state.selected.delete(e.id); renderDock(); } }),
        el('span', { class: 'sr', text: t().addToList })) : null),
    details);
}

/**
 * Una funzione su più voci: una scheda sola con lo stato complessivo.
 * Dentro, le parti (una per voce, spesso in centraline diverse) con il loro stato e i parametri.
 */
function functionView(it) {
  const f = it.funzione, parts = it.parti;
  const units = [...new Set(parts.map(r => r.entry.centralina))];
  const todo = parts.filter(r => r.stato === 'attivabile' || r.stato === 'regolabile');
  const id = 'sel-' + it.id;
  const riskOrder = { basso: 0, medio: 1, alto: 2 };
  const risk = parts.map(r => r.entry.rischio).sort((a, b) => riskOrder[b] - riskOrder[a])[0];
  const tags = [
    el('span', { class: `risk r-${risk}`, text: t().risk[risk] }),
    parts.some(r => r.entry.consiglio === 'sconsigliata') ? el('span', { class: 'tag bad', text: t().advisedAgainst }) : null,
    parts.some(r => r.entry.affidabilita === 'da_verificare') ? el('span', { class: 'tag', text: t().unverified }) : null,
    el('span', { class: 'tag multi', text: t().funcParts(parts.length, units.length) }),
  ];
  const selected = todo.length > 0 && todo.every(r => state.selected.has(r.id));
  const progress = it.stato === 'parziale' ? el('p', { class: 'func-progress', text: t().funcProgress(parts.filter(r => r.stato === 'attiva').length, parts.length) }) : null;
  return el('li', { id: 'voce-' + it.id, class: `row func s-${it.stato}` + (parts.some(r => r.entry.consiglio === 'sconsigliata') ? ' advised-against' : '') },
    el('div', { class: 'row-main' },
      el('span', { class: `toggle s-${it.stato}`, role: 'img', 'aria-label': t().stati[it.stato] }, el('i')),
      el('div', { class: 'row-title' },
        el('h3', {}, tr(f.titolo)),
        el('p', { class: 'row-sub' }, el('span', { class: 'ecu', text: units.join(' + ') }), ' ', el('span', { class: 'state', text: t().stati[it.stato] }), ...tags)),
      todo.length ? el('label', { class: 'pick', for: id, title: t().addToList },
        el('input', { type: 'checkbox', id, checked: selected, onchange: ev => { todo.forEach(r => ev.target.checked ? state.selected.add(r.id) : state.selected.delete(r.id)); renderDock(); } }),
        el('span', { class: 'sr', text: t().addToList })) : null),
    el('div', { class: 'func-body' },
      el('p', { class: 'func-hint', text: t().funcHint }),
      progress,
      el('ol', { class: 'parts' }, ...parts.map(r => rowView(r, true)))));
}

function renderDiscover() {
  const data = unexplored(state.db, ecus());
  const total = Object.values(data).reduce((a, l) => a + l.length, 0);
  $('#discoverCount').textContent = total ? total : '';
  $('#discoverEmpty').hidden = state.files.length > 0;
  $('#dQ').hidden = state.files.length === 0;
  const q = $('#dQ').value.trim().toLowerCase();
  $('#discover').replaceChildren(...Object.entries(data).map(([ecu, list]) => {
    const shown = list.filter(p => !q || p.nome.toLowerCase().includes(q));
    if (!shown.length) return null;
    // La tabella si costruisce solo all'apertura: con tutte le centraline sono migliaia di righe.
    const LIMIT = 400;
    const fill = d => {
      if (d.dataset.filled) return;
      d.dataset.filled = '1';
      const rows = shown.slice(0, LIMIT).map(p =>
        el('tr', {}, el('td', {}, el('code', { text: p.nome })), el('td', {}, el('code', { class: 'v', text: p.valore }), p.nominato ? null : el('small', { text: ' ' + t().noName }))));
      d.append(el('table', { class: 'params disc-table' }, el('tbody', {}, rows)));
      if (shown.length > LIMIT) d.append(el('p', { class: 'empty', text: t().discoverMore(shown.length - LIMIT) }));
    };
    const d = el('details', { class: 'disc', ontoggle: ev => ev.target.open && fill(ev.target) },
      el('summary', {}, el('strong', { text: ecu }), ` ${tr(state.map.nomi?.[ecu])} `, el('span', { class: 'tab-count', text: shown.length })));
    if (Object.keys(data).length === 1 || q) { d.open = true; fill(d); }
    return d;
  }).filter(Boolean));
}

/** Riquadro che invita a contribuire: quante voci, quante confermate, su quante auto. */
function renderCommunity() {
  const cars = new Set(state.db.flatMap(e => (e.osservazioni || []).map(o => [o.telaio, o.anno, o.i_level].join('|'))));
  const confirmed = state.db.filter(e => e.affidabilita === 'confermata').length;
  $('#communityTitle').textContent = t().commH(cars.size);
  const stat = (n, label, cls) => el('div', { class: cls }, el('dt', { text: label }), el('dd', { text: String(n) }));
  $('#communityStats').replaceChildren(
    stat(state.db.length, t().statEntries),
    stat(confirmed, t().statConfirmed),
    stat(cars.size, t().statCars(cars.size), cars.size < 5 ? 'few' : null));
}

function showTab(id) {
  document.querySelectorAll('[role=tab]').forEach(x => x.setAttribute('aria-selected', String(x.id === id)));
  document.querySelectorAll('[role=tabpanel]').forEach(p => (p.hidden = p.id !== $('#' + id).getAttribute('aria-controls')));
}
$('#goShare').addEventListener('click', () => { showTab('tab-share'); $('#tab-share').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

function renderShare() {
  const has = state.files.some(f => f.ecu);
  $('#shareEmpty').hidden = has;
  $('#shareForm').hidden = !has;
  if (!has) return;
  const form = $('#shareForm');
  if (state.fa) {
    if (!form.telaio.value && state.fa.serie) form.telaio.value = state.fa.serie;
    if (!form.anno.value && state.fa.produzione) form.anno.value = state.fa.produzione.slice(-4);
  }
  const { removed } = buildFootprint(ecus(), {});
  $('#removed').textContent = removed.length ? t().removed(removed.length) : '';
  const title = encodeURIComponent(`${t().issueTitle}: ${Object.keys(ecus()).join(', ')}`);
  const body = encodeURIComponent(t().issueBody);
  $('#issueLink').href = `${REPO}/issues/new?labels=impronta&title=${title}&body=${body}`;
}

$('#shareForm').addEventListener('submit', e => {
  e.preventDefault();
  const meta = Object.fromEntries(new FormData(e.target));
  if (meta.anno) meta.anno = Number(meta.anno) || undefined;
  if (state.fa) meta.sa = state.fa.sa;
  const { footprint } = buildFootprint(ecus(), meta);
  footprint.generatore = 'fdl-scout';
  footprint.creata = new Date().toISOString().slice(0, 10);
  save(`${t().fileFootprint}-${(meta.telaio || t().fileCar).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${footprint.creata}.json`, JSON.stringify(footprint, null, 2), 'application/json');
});

// ---------- confronto prima/dopo ----------
async function readSide(fileList) {
  const out = [];
  for (const file of [...fileList]) {
    const parsed = parseFwl(await file.text(), file.name);
    const { ecu } = identifyEcu(parsed, state.map);
    out.push({ name: file.name, parsed, ecu: ecu || file.name });
  }
  return out;
}
['before', 'after'].forEach(side => {
  const inp = $(side === 'before' ? '#cmpBefore' : '#cmpAfter');
  inp.addEventListener('change', async () => { state.cmp[side] = await readSide(inp.files); renderCompare(); });
});

/** Coppie prima/dopo per centralina; con un solo file per parte li confronta comunque. */
function comparePairs() {
  const { before, after } = state.cmp;
  if (before.length === 1 && after.length === 1) return [{ ecu: after[0].ecu, a: before[0], b: after[0] }];
  const units = [...new Set([...before, ...after].map(f => f.ecu))];
  return units.map(ecu => ({ ecu, a: before.find(f => f.ecu === ecu), b: after.find(f => f.ecu === ecu) }));
}

function renderCompare() {
  // Il campo file mostra già il nome se è uno solo: l'elenco serve con più file.
  $('#cmpBeforeNames').textContent = state.cmp.before.length > 1 ? state.cmp.before.map(f => f.name).join(', ') : '';
  $('#cmpAfterNames').textContent = state.cmp.after.length > 1 ? state.cmp.after.map(f => f.name).join(', ') : '';
  const out = [], groups = [];
  if (state.cmp.before.length && state.cmp.after.length) {
    for (const { ecu, a, b } of comparePairs()) {
      if (!a || !b) { out.push(el('p', { class: 'chassis-note', text: t().cmpMissing(ecu, a ? t().cmpSideAfter : t().cmpSideBefore) })); continue; }
      const diff = diffParams(a.parsed.params, b.parsed.params);
      const entries = entriesForChanges([...diff.changed, ...diff.added], state.db, ecu);
      const cafd = b.parsed.cafd ? `${b.parsed.cafd}${b.parsed.cafdVersion ? '_' + b.parsed.cafdVersion : ''}` : '';
      groups.push({ ecu, cafd, diff, entries });
      const N = x => x.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const where = nome => entries.filter(e => e.parametri.some(p => N(p.nome) === N(nome)));
      const cell = v => el('code', { class: 'v', text: v ? `${v.value}${v.hex && v.hex !== v.value ? ' [' + v.hex + ']' : ''}` : '—' });
      const entryCell = nome => {
        const list = where(nome);
        return list.length
          ? el('td', {}, ...list.flatMap((e, i) => {
              const f = state.items.find(it => it.tipo === 'funzione' && it.parti.some(r => r.id === e.id)); // le parti stanno dentro la scheda della funzione
              return [i ? ', ' : null, el('a', { href: '#voce-' + (f ? f.id : e.id), text: tr(e.titolo), onclick: () => showTab('tab-codings') })];
            }))
          : el('td', { class: 'cmp-new', text: t().cmpNew });
      };
      const rows = [...diff.changed.map(c => [c.nome, c.prima, c.dopo]), ...diff.added.map(c => [c.nome, null, c.dopo]), ...diff.removed.map(c => [c.nome, c.prima, null])];
      out.push(el('section', { class: 'cmp-group' },
        el('h3', {}, el('span', { class: 'ecu', text: ecu }), cafd ? ` · CAFD ${cafd}` : ''),
        a.parsed.cafd && b.parsed.cafd && a.parsed.cafd !== b.parsed.cafd ? el('p', { class: 'chassis-note', text: t().cmpCafd(a.parsed.cafd, b.parsed.cafd) }) : null,
        rows.length
          ? el('table', { class: 'params cmp-table' },
              el('thead', {}, el('tr', {}, el('th', { text: t().cmpParam }), el('th', { text: t().cmpBeforeCol }), el('th', { text: t().cmpAfterCol }), el('th', { text: t().cmpEntryCol }))),
              el('tbody', {}, ...rows.map(([n, x, y]) => el('tr', {}, el('td', {}, el('code', { text: n })), el('td', {}, cell(x)), el('td', {}, cell(y)), entryCell(n)))))
          : el('p', { class: 'empty', text: t().cmpNone }),
        diff.hidden ? el('p', { class: 'privacy', text: t().cmpHidden(diff.hidden) }) : null));
    }
  }
  $('#cmpOut').replaceChildren(...out);
  const has = groups.some(g => g.diff.changed.length || g.diff.added.length || g.diff.removed.length);
  $('#cmpActions').hidden = !has;
  if (has) {
    const report = diffReport(groups, state.lang);
    state.cmpReport = report;
    const title = encodeURIComponent(`${t().cmpIssueTitle}: ${groups.map(g => g.ecu).join(', ')}`);
    const body = encodeURIComponent((t().cmpIssueBody + report).slice(0, 6000));
    $('#cmpIssue').href = `${REPO}/issues/new?labels=prova&title=${title}&body=${body}`;
  }
}
$('#cmpCopy').addEventListener('click', async e => {
  try { await navigator.clipboard.writeText(state.cmpReport || ''); e.target.textContent = t().copied; setTimeout(() => (e.target.textContent = t().cmpCopy), 1500); } catch { /* clipboard negato */ }
});

function renderDock() {
  const n = [...state.selected].filter(id => state.results.some(r => r.id === id && (r.stato === 'attivabile' || r.stato === 'regolabile'))).length;
  $('#dock').hidden = n === 0;
  $('#openList').textContent = t().listBtn(n);
}

function save(name, text, type = 'text/plain') {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#openList').addEventListener('click', () => {
  $('#listText').textContent = esysChecklist(state.results, state.selected, state.lang);
  $('#listDialog').showModal();
});
$('#copyList').addEventListener('click', async e => {
  try { await navigator.clipboard.writeText($('#listText').textContent); e.target.textContent = t().copied; setTimeout(() => (e.target.textContent = t().copy), 1500); } catch { /* clipboard negato: resta il download */ }
});
$('#downloadList').addEventListener('click', () => save(t().fileList, $('#listText').textContent));

// ---------- schede, filtri, lingua ----------
document.querySelectorAll('[role=tab]').forEach(tab => tab.addEventListener('click', () => showTab(tab.id)));
['#fEcu', '#fState', '#fQ', '#fHide'].forEach(s => $(s).addEventListener('input', renderRows));
$('#dQ').addEventListener('input', renderDiscover);
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
  state.lang = b.dataset.lang; store.set('lang', state.lang); renderStatic(); refresh();
}));

function refresh() {
  state.results = evaluateAll(state.db, ecus(), { sa: state.fa ? new Set(state.fa.sa) : null });
  state.items = buildItems(state.results, state.funzioni);
  renderUnits();
  renderOverview(summarize(state.items));
  renderFilters();
  renderRows();
  renderDiscover();
  renderCommunity();
  renderShare();
  renderCompare();
  renderDock();
}

renderStatic();
loadDb().then(refresh).catch(err => {
  $('#rows').replaceChildren(el('li', { class: 'empty', text: `db.json: ${err.message}` }));
});
