import { applyI18n, detectLang, EQUIPMENT_CHIPS, getLang, onLangChange, setLang, t, toGuDigits } from './i18n.js';
import { buildIndex } from './search.js';
import { deleteManual, getPdf, listManuals, requestPersistence, saveManual, savePdf, storageEstimate } from './store.js';
import { Guide } from './guide.js';
import { fillStepCard } from './card.js';
import { canRecognise, recognise, speak, stopSpeaking } from './speech.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  builtin: null,
  imported: [],
  procedures: [],
  index: null,
  guide: null,
  xr: { ar: false, vr: false },
  lastQuery: null,
  photo: null,
};

// ---------- Data ----------

function builtinProcedures(m) {
  const pick = (pair, i) => (Array.isArray(pair) ? pair[i] : pair);
  return m.procedures.map((p) => ({
    id: p.id,
    manualId: m.id,
    manualName: m.name[0],
    manualNameGu: m.name[1],
    source: 'builtin',
    type: p.type,
    page: p.page,
    codes: p.codes,
    content: Object.fromEntries(['en', 'gu'].map((lang, i) => [lang, {
      title: pick(p.title, i),
      equipment: pick(p.equipment, i),
      symptoms: pick(p.symptoms, i),
      safety: p.safety.map((s) => pick(s, i)),
      tools: p.tools.map((s) => pick(s, i)),
      steps: p.steps.map((s) => pick(s, i)),
    }])),
  }));
}

async function loadData() {
  const res = await fetch('data/sample-manual.json');
  state.builtin = await res.json();
  try {
    state.imported = await listManuals();
  } catch (err) {
    console.warn('IndexedDB unavailable', err);
    state.imported = [];
  }
  rebuildIndex();
}

function rebuildIndex() {
  state.procedures = [
    ...builtinProcedures(state.builtin),
    ...state.imported.flatMap((m) => m.procedures),
  ];
  state.index = buildIndex(state.procedures);
}

const byId = (id) => state.procedures.find((p) => p.id === id);

function contentFor(p, lang = getLang()) {
  return p.content[lang] || Object.values(p.content)[0];
}

function manualLabel(p) {
  if (p.source === 'builtin') return getLang() === 'gu' ? p.manualNameGu : p.manualName;
  return p.manualName;
}

function num(n) {
  return getLang() === 'gu' ? toGuDigits(n) : String(n);
}

// ---------- UI helpers ----------

let toastTimer;
function toast(msg, ms = 3500) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}

function showView(name, { push = true } = {}) {
  for (const v of $$('.view')) v.hidden = v.id !== `view-${name}`;
  for (const b of $$('.tabbar button')) b.classList.toggle('active', b.dataset.view === name || (name === 'procedure' && b.dataset.view === 'assist'));
  if (push && name === 'procedure') history.pushState({ view: name }, '');
  if (name !== 'procedure') stopSpeaking();
  window.scrollTo({ top: 0 });
  if (name === 'manuals') renderManuals();
}

// ---------- Language ----------

function renderLang() {
  document.documentElement.lang = getLang();
  for (const b of $$('.lang-toggle button')) b.classList.toggle('active', b.dataset.lang === getLang());
  applyI18n();
  renderChips();
  renderXrButton();
  updateOfflineBadge();
  if (state.lastQuery) runSearch(state.lastQuery.text, state.lastQuery.opts, { keepLang: true });
  if (state.guide) state.guide.setLang(getLang());
  if (!$('#view-manuals').hidden) renderManuals();
}

// ---------- Ask / search ----------

function renderChips() {
  const box = $('#chips');
  box.replaceChildren(...EQUIPMENT_CHIPS.map((c) => el('button', {
    type: 'button',
    class: 'chip',
    onclick: () => {
      $('#query').value = c[getLang()];
      runSearch(c[getLang()], { assetType: c.type });
    },
  }, el('span', { 'aria-hidden': 'true', text: c.icon }), c[getLang()])));
}

function runSearch(text, opts = {}, { keepLang = false } = {}) {
  const query = String(text || '').trim();
  if (!query && !opts.codes?.length && !opts.assetType) return;
  if (!keepLang && query) {
    const lang = detectLang(query);
    if (/[\p{L}]/u.test(query) && lang !== getLang()) {
      setLang(lang);
      return runSearch(text, opts, { keepLang: true });
    }
  }
  state.lastQuery = { text: query, opts };
  const results = state.index.search(query, { ...opts, limit: 6 });
  renderResults(results);
}

function renderResults(results) {
  const section = $('#results-section');
  const box = $('#results');
  section.hidden = false;
  if (!results.length) {
    box.replaceChildren(el('p', { class: 'card muted', text: t('noResults') }));
    return;
  }
  box.replaceChildren(...results.map((r, i) => {
    const p = r.doc;
    const c = contentFor(p);
    const meta = el('div', { class: 'meta' },
      r.matched.slice(0, 6).map((m) => el('span', { class: /\d/.test(m) && /[a-z]/i.test(m) ? 'chip static code' : 'chip static', text: m })),
      el('span', { class: 'chip static', text: `📖 ${manualLabel(p)}${p.page ? ' · ' + t('manualPage') + ' ' + num(p.page) : ''}` }),
    );
    return el('button', { type: 'button', class: 'result' + (i === 0 ? ' best' : ''), onclick: () => openProcedure(p.id) },
      c.equipment ? el('p', { class: 'eyebrow', text: c.equipment }) : null,
      el('h3', { text: c.title }),
      c.symptoms ? el('p', { text: c.symptoms.length > 180 ? c.symptoms.slice(0, 180) + '…' : c.symptoms }) : null,
      meta,
    );
  }));
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setupAsk() {
  $('#ask-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const extra = state.photo ? ' ' + (state.photo.text || '') : '';
    runSearch($('#query').value + extra, state.photo ? { codes: state.photo.codes, assetType: state.photo.tag?.type } : {});
  });

  $('#btn-speak').addEventListener('click', async () => {
    const btn = $('#btn-speak');
    if (!canRecognise()) return toast(t('voiceUnsupported'));
    if (btn.classList.contains('listening')) { recognise.stop?.(); return; }
    btn.classList.add('listening');
    btn.querySelector('[data-i18n]').textContent = t('listening');
    try {
      const text = await recognise(getLang(), { onInterim: (s) => { $('#query').value = s; } });
      if (text) {
        $('#query').value = text;
        runSearch(text);
      }
    } catch (err) {
      toast(err.code === 'network' || err.code === 'language-not-supported' ? t('voiceOffline') : `${t('voiceUnsupported')} (${err.code || err.message})`, 6000);
    } finally {
      btn.classList.remove('listening');
      btn.querySelector('[data-i18n]').textContent = t('speak');
    }
  });

  $('#photo-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handlePhoto(file);
  });

  $('#btn-live').addEventListener('click', () => openCamera('capture'));
  $('#btn-photo-clear').addEventListener('click', clearPhoto);
}

// The photo's tag/codes/text refine searches only while its panel is shown.
function clearPhoto() {
  state.photo = null;
  $('#photo-panel').hidden = true;
  $('#photo-results').replaceChildren();
}

async function handlePhoto(source) {
  const panel = $('#photo-panel');
  const status = $('#photo-status');
  const dl = $('#photo-results');
  panel.hidden = false;
  dl.replaceChildren();
  const thumb = $('#photo-thumb');
  if (source instanceof Blob) thumb.src = URL.createObjectURL(source);
  status.textContent = t('photoAnalysing');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const { analysePhoto } = await import('./vision.js');
  let result;
  try {
    result = await analysePhoto(source, (phase, m) => {
      if (phase === 'ocr-progress' && m?.status?.startsWith('load')) status.textContent = t('photoLoadingOcr');
      else if (phase === 'ocr-progress' && m?.status === 'recognizing text') status.textContent = `${t('photoAnalysing')} ${Math.round((m.progress || 0) * 100)}%`;
    });
  } catch (err) {
    console.error(err);
    status.textContent = t('photoNothing');
    return;
  }
  if (!(source instanceof Blob)) thumb.src = result.canvas.toDataURL('image/jpeg', 0.7);
  state.photo = result;

  const rows = [];
  if (result.tag) rows.push([t('photoAsset'), `${result.tag.asset}${result.tag.label && result.tag.label !== result.tag.asset ? ' · ' + result.tag.label : ''}`]);
  if (result.codes.length) rows.push([t('photoCodes'), result.codes.map((c) => c.toUpperCase()).join(', ')]);
  if (result.text) rows.push([t('photoText'), result.text, 'ocr']);
  dl.replaceChildren(...rows.flatMap(([k, v, cls]) => [el('dt', { text: k }), el('dd', { class: cls || '', text: v })]));
  if (!rows.length) {
    status.textContent = t('photoNothing');
    return;
  }
  status.textContent = t('photoFound');
  const query = [$('#query').value, result.tag?.label, result.text].filter(Boolean).join(' ');
  runSearch(query, { codes: result.codes, assetType: result.tag?.type }, { keepLang: true });
}

// ---------- Procedure ----------

function openProcedure(id, { push = true } = {}) {
  const p = byId(id);
  if (!p) return;
  if (state.guide) state.guide.removeEventListener('change', renderGuide);
  state.guide = new Guide(p, getLang());
  state.guide.addEventListener('change', renderGuide);
  $('#page-view').hidden = true;
  renderProcedure();
  showView('procedure', { push });
}

function renderProcedure() {
  const g = state.guide;
  const p = g.procedure;
  const c = g.content;
  $('#view-procedure').lang = g.lang;
  $('#proc-equipment').textContent = c.equipment || '';
  $('#proc-title').textContent = c.title;
  const codes = (p.codes || []).join(', ');
  $('#proc-source').textContent = `${t('source')}: ${manualLabel(p)}${p.page ? ' · ' + t('manualPage') + ' ' + num(p.page) : ''}${codes ? ' · ' + codes : ''}${p.source === 'builtin' ? ' · ' + t('demoNote') : ''}`;

  const safety = $('#proc-safety');
  safety.hidden = !c.safety?.length;
  $('ul', safety).replaceChildren(...(c.safety || []).map((s) => el('li', { text: s })));

  const tools = $('#proc-tools');
  tools.hidden = !c.tools?.length;
  $('.chips', tools).replaceChildren(...(c.tools || []).map((s) => el('span', { class: 'chip static', text: '🔧 ' + s })));

  $('#btn-page').hidden = p.source !== 'pdf';
  $('#btn-mr3d').hidden = p.type !== 'brake';
  renderXrButton();
  renderGuide();
}

function renderGuide() {
  const g = state.guide;
  if (!g) return;
  if ($('#proc-title').textContent !== g.content.title) return renderProcedure();
  const list = $('#proc-steps');
  list.replaceChildren(...g.content.steps.map((s, i) => el('li', {
    class: [g.done.has(i) ? 'done' : '', g.index === i ? 'current' : ''].join(' '),
    onclick: () => (g.index === i ? g.toggle(i) : g.go(i)),
  }, el('span', { class: 'num', text: g.done.has(i) ? '✓' : num(i + 1) }), el('span', { class: 'text', text: s }))));
  const label = g.index < 0 ? '⚠ ' + t('safety') : g.index >= g.total ? '✓ ' + t('finish') : t('stepOf', g.index + 1, g.total);
  $('#stepper-label').textContent = label;
  $('.stepper [data-act="back"]').disabled = g.index <= g.minIndex;
  $('.stepper [data-act="next"]').textContent = g.index >= g.total ? '↺' : g.index === g.total - 1 ? '✓' : '▶';
  $('#proc-steps li.current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  if (!$('#camview').hidden) fillStepCard($('#camview'), g);
}

function guideAction(act) {
  const g = state.guide;
  if (!g) return;
  if (act === 'back') g.prev();
  else if (act === 'next') (g.index >= g.total ? g.restart() : g.next());
  else if (act === 'speak') speak(g.speechText(), g.lang);
}

function renderXrButton() {
  const btn = $('#btn-xr');
  if (!btn) return;
  const { ar, vr } = state.xr;
  btn.hidden = !(ar || vr);
  btn.textContent = ar ? `🥽 ${t('openAR')}` : `🥽 ${t('openVR')}`;
}

function setupProcedure() {
  $('#btn-back').addEventListener('click', () => history.back());
  window.addEventListener('popstate', () => {
    if (!$('#camview').hidden) closeCamera();
    showView('assist', { push: false });
  });
  $$('.stepper [data-act]').forEach((b) => b.addEventListener('click', () => guideAction(b.dataset.act)));
  $('#btn-read').addEventListener('click', () => speak(state.guide.speechText(), state.guide.lang));
  $('#btn-xr').addEventListener('click', launchXR);
  $('#btn-camview').addEventListener('click', () => openCamera('guide'));
  $('#btn-page').addEventListener('click', showPdfPage);
}

async function launchXR() {
  const mode = state.xr.ar ? 'immersive-ar' : 'immersive-vr';
  try {
    const { startXR } = await import('./xr.js');
    await startXR({ guide: state.guide, mode, overlay: $('#xr-overlay'), onEnd: renderGuide });
  } catch (err) {
    console.error(err);
    toast(`${t('xrUnavailable')} (${err.message})`, 5000);
    openCamera('guide');
  }
}

async function showPdfPage() {
  const p = state.guide.procedure;
  const view = $('#page-view');
  if (!view.hidden) { view.hidden = true; return; }
  const blob = await getPdf(p.manualId);
  if (!blob) return;
  view.hidden = false;
  const { renderPage } = await import('./pdfimport.js');
  await renderPage(blob, p.page || 1, $('canvas', view), view.clientWidth || 600);
  view.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Camera view ----------

let camStream = null;

async function openCamera(mode) {
  const view = $('#camview');
  view.dataset.mode = mode;
  if (mode === 'guide') fillStepCard(view, state.guide);
  if (!navigator.mediaDevices?.getUserMedia) {
    if (mode === 'capture') return $('#photo-input').click();
    toast(t('cameraUnavailable'));
  }
  view.hidden = false;
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    $('video', view).srcObject = camStream;
  } catch (err) {
    console.warn(err);
    if (mode === 'capture') {
      closeCamera();
      toast(t('cameraUnavailable'));
      $('#photo-input').click();
    } else {
      toast(t('cameraUnavailable'));
    }
  }
}

function closeCamera() {
  camStream?.getTracks().forEach((tr) => tr.stop());
  camStream = null;
  $('#camview video').srcObject = null;
  $('#camview').hidden = true;
}

function setupCamera() {
  $('#camview').addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'close') closeCamera();
    else if (act === 'capture') {
      const video = $('#camview video');
      if (!video.videoWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      closeCamera();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
      handlePhoto(blob);
    } else guideAction(act);
  });
}

// ---------- Manuals ----------

async function renderManuals() {
  const list = $('#manual-list');
  const items = [];
  const bp = state.builtin;
  items.push(el('li', {},
    el('span', { 'aria-hidden': 'true', text: '📘' }),
    el('div', { class: 'info' },
      el('div', { class: 'name', text: getLang() === 'gu' ? bp.name[1] : bp.name[0] }),
      el('div', { class: 'muted small', text: `${t('builtin')} · ${num(bp.procedures.length)} ${t('sections')} · EN + ગુ` }),
      el('div', { class: 'muted small', text: getLang() === 'gu' ? bp.note[1] : bp.note[0] }),
    )));
  for (const m of state.imported) {
    items.push(el('li', {},
      el('span', { 'aria-hidden': 'true', text: '📄' }),
      el('div', { class: 'info' },
        el('div', { class: 'name', text: m.name }),
        el('div', { class: 'muted small', text: `${num(m.procedures.length)} ${t('sections')} · ${num(m.pageCount)} ${t('pages')} · ${m.lang === 'gu' ? 'ગુજરાતી' : 'English'}` }),
      ),
      el('button', {
        type: 'button',
        class: 'btn secondary',
        text: t('remove'),
        onclick: async () => {
          if (!confirm(t('removeConfirm'))) return;
          await deleteManual(m.id);
          state.imported = state.imported.filter((x) => x.id !== m.id);
          rebuildIndex();
          renderManuals();
        },
      })));
  }
  list.replaceChildren(...items);
  const est = await storageEstimate();
  if (est?.usage) $('#storage-info').textContent = `${t('storage')}: ${(est.usage / 1048576).toFixed(1)} MB`;
}

function setupManuals() {
  $('#pdf-input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const prog = $('#import-progress');
    const bar = $('.bar', prog);
    const label = $('span', prog);
    prog.hidden = false;
    label.textContent = `${t('importing')} ${file.name}…`;
    try {
      const { importPdf } = await import('./pdfimport.js');
      const { manual, blob } = await importPdf(file, ({ page, total, ocr }) => {
        bar.style.width = `${(page / total) * 100}%`;
        label.textContent = `${t('importing')} ${num(page)} / ${num(total)}${ocr ? ' · ' + t('importOcr') : ''}`;
      });
      await saveManual(manual);
      await savePdf(manual.id, blob);
      requestPersistence();
      state.imported.push(manual);
      rebuildIndex();
      toast(t('importDone', manual.procedures.length));
      renderManuals();
    } catch (err) {
      console.error(err);
      toast(`${t('importFailed')}: ${err.message}`, 6000);
    } finally {
      prog.hidden = true;
      bar.style.width = '0';
    }
  });
}

// ---------- Offline / service worker ----------

let offlineState = 'none';
function updateOfflineBadge() {
  const badge = $('#offline-badge');
  badge.hidden = false;
  badge.classList.toggle('ok', offlineState === 'ready');
  const label = offlineState === 'ready' ? t('offlineReady') : offlineState === 'preparing' ? t('offlinePreparing') : t('offlineNoSw');
  const icon = offlineState === 'ready' ? '✓' : offlineState === 'preparing' ? '⏳' : '☁';
  badge.title = label;
  badge.replaceChildren(icon, el('span', { class: 'badge-text', text: ' ' + label }));
}

async function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) { updateOfflineBadge(); return; }
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    offlineState = 'preparing';
    updateOfflineBadge();
    const ask = () => navigator.serviceWorker.controller?.postMessage({ type: 'status' }) ?? reg.active?.postMessage({ type: 'status' });
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type !== 'status') return;
      offlineState = e.data.missing === 0 ? 'ready' : 'preparing';
      updateOfflineBadge();
      if (e.data.missing) setTimeout(ask, 3000);
    });
    await navigator.serviceWorker.ready;
    ask();
    navigator.serviceWorker.addEventListener('controllerchange', ask);
  } catch (err) {
    console.warn('Service worker registration failed', err);
    offlineState = 'none';
    updateOfflineBadge();
  }
}

// ---------- Boot ----------

async function main() {
  $$('.lang-toggle button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  $$('.tabbar button').forEach((b) => b.addEventListener('click', () => {
    if (!$('#view-procedure').hidden) history.replaceState(null, '');
    if (b.dataset.view !== 'assist') clearPhoto();
    showView(b.dataset.view, { push: false });
  }));
  onLangChange(renderLang);
  setupAsk();
  setupProcedure();
  setupCamera();
  setupManuals();
  renderLang();
  setupServiceWorker();
  document.fonts?.load('16px "Noto Sans Gujarati"', 'ગુ');

  await loadData();

  import('./xr.js').then(async ({ xrSupport }) => {
    state.xr = await xrSupport();
    renderXrButton();
    $('#env-info').textContent = [
      `WebXR AR: ${state.xr.ar ? '✓' : '✗'}`,
      `VR: ${state.xr.vr ? '✓' : '✗'}`,
      `Secure context: ${window.isSecureContext ? '✓' : '✗ (WebXR and camera need HTTPS)'}`,
      `Voice input: ${canRecognise() ? '✓' : '✗'}`,
    ].join(' · ');
  }).catch((err) => console.warn('XR module failed to load', err));

  // Deep link: ?q=door+E12 runs a search, #p=<id> opens a procedure.
  const params = new URLSearchParams(location.search);
  if (params.get('q')) {
    $('#query').value = params.get('q');
    runSearch(params.get('q'));
  }
  const hashId = location.hash.match(/^#p=(.+)$/)?.[1];
  if (hashId) openProcedure(decodeURIComponent(hashId));
}

main();
