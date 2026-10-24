import { parseFwl, identifyEcu } from './src/parser.js';
import { evaluateAll, unexplored, summarize, esysChecklist, STATI } from './src/matcher.js';
import { buildFootprint } from './src/footprint.js';
import { isFa, parseFa } from './src/fa.js';
import { T } from './i18n.js';

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
  tab: 'codings',
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
  const known = [...new Set([...Object.keys(state.map.nomi || {}), ...state.db.map(e => e.centralina)])].sort();
  const named = state.fa ? state.fa.sa.filter(c => state.sa[c]) : [];
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
  const files = [...state.files].sort((a, b) => (a.ecu || '~').localeCompare(b.ecu || '~') || a.name.localeCompare(b.name));
  $('#units').replaceChildren(faCard, ...files.map(f => {
    const n = Object.keys(f.parsed.params).length;
    const picker = el('select', {
      'aria-label': t().chooseEcu,
      onchange: e => { f.ecu = e.target.value || null; f.how = f.ecu ? 'manuale' : null; refresh(); },
    }, el('option', { value: '', text: t().chooseEcu }), known.map(k => el('option', { value: k, text: k, selected: k === f.ecu })));
    return el('li', { class: 'unit' + (f.ecu ? '' : ' unknown') },
      f.ecu ? el('strong', { text: f.ecu }) : picker,
      el('span', { class: 'unit-desc', text: f.ecu ? tr(state.map.nomi?.[f.ecu]) : f.name }),
      el('span', { class: 'unit-meta', text: [f.parsed.cafd && `CAFD ${f.parsed.cafd}`, t().params(n), f.how && t().how[f.how]].filter(Boolean).join(', ') }),
      f.ecu ? el('details', { class: 'unit-change' }, el('summary', { text: t().change }), picker) : null,
      f.parsed.vinFound ? el('span', { class: 'unit-vin', text: t().vinWarn }) : null);
  }));
}

function renderOverview(counts) {
  const total = state.results.length;
  const order = state.files.length ? STATI : ['da_mappare', 'centralina_non_letta'];
  $('#meter').replaceChildren(...order.filter(s => counts[s]).map(s => {
    const seg = el('span', { class: `seg s-${s}`, title: `${t().stati[s]}: ${counts[s]}` });
    seg.style.flexGrow = String(counts[s]); // CSSOM: permesso dalla Content-Security-Policy, l'attributo style no
    return seg;
  }));
  $('#legend').replaceChildren(...STATI.filter(s => counts[s]).map(s =>
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
  stSel.replaceChildren(el('option', { value: '', text: t().allStates }), ...STATI.map(s => el('option', { value: s, text: t().stati[s] })));
  ecuSel.value = keepE; stSel.value = keepS;
}

const RANK = { attivabile: 0, regolabile: 1, attiva: 2, manca_optional: 3, non_disponibile: 4, centralina_non_letta: 5, da_mappare: 6 };

function renderRows() {
  const fe = $('#fEcu').value, fs = $('#fState').value, q = $('#fQ').value.trim().toLowerCase(), hide = $('#fHide').checked;
  const rows = state.results
    .filter(r => !fe || r.entry.centralina === fe)
    .filter(r => !fs || r.stato === fs)
    .filter(r => !hide || r.entry.consiglio !== 'sconsigliata')
    .filter(r => !q || [tr(r.entry.titolo), r.entry.centralina, ...r.entry.parametri.map(p => p.nome)].join(' ').toLowerCase().includes(q))
    .sort((a, b) => RANK[a.stato] - RANK[b.stato] || a.entry.centralina.localeCompare(b.entry.centralina));
  $('#empty').hidden = rows.length > 0;
  $('#rows').replaceChildren(...rows.map(rowView));
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
function reportView(e) {
  const title = encodeURIComponent(`${t().reportTitle}: ${tr(e.titolo)}`);
  const body = encodeURIComponent(t().reportBody(e.id, tr(e.titolo)));
  const text = e.affidabilita === 'da_verificare' ? t().reportLinkVerify : t().reportLink;
  return el('p', { class: 'report' }, el('a', { href: `${REPO}/issues/new?labels=prova&title=${title}&body=${body}`, target: '_blank', rel: 'noopener noreferrer', text }));
}

function rowView(r) {
  const e = r.entry;
  const actionable = r.stato === 'attivabile' || r.stato === 'regolabile';
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
  ];
  const seen = (e.osservazioni || []).map(o => `${o.telaio} ${o.anno || ''} ${o.i_level || ''}`.trim());

  const details = el('details', { class: 'more' },
    el('summary', { text: e.parametri.length ? e.parametri.map(p => p.nome).join(', ') : t().stati.da_mappare }),
    e.parametri.length ? params : null,
    e.valori_suggeriti ? el('p', {}, el('b', { text: t().suggested + ': ' }), tr(e.valori_suggeriti)) : null,
    e.requisiti_sa?.length ? el('p', {}, el('b', { text: t().needsSa + ': ' }), e.requisiti_sa.join(', ')) : null,
    tr(e.note) ? el('p', { class: 'note', text: tr(e.note) }) : null,
    seen.length ? el('p', { class: 'seen', text: `${t().seenOn}: ${seen.join('; ')}` }) : null,
    sourcesView(e.fonti),
    reportView(e));

  return el('li', { class: `row s-${r.stato}` + (e.consiglio === 'sconsigliata' ? ' advised-against' : '') },
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
  save(`${t().fileFootprint}-${(meta.telaio || 'mini').toLowerCase()}-${footprint.creata}.json`, JSON.stringify(footprint, null, 2), 'application/json');
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
  renderUnits();
  renderOverview(summarize(state.results));
  renderFilters();
  renderRows();
  renderDiscover();
  renderCommunity();
  renderShare();
  renderDock();
}

renderStatic();
loadDb().then(refresh).catch(err => {
  $('#rows').replaceChildren(el('li', { class: 'empty', text: `db.json: ${err.message}` }));
});
