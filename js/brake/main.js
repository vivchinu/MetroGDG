// Brake Control Unit page: interactive 3D preview + guide, and the entry
// point into the mixed reality session.

import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three/addons/OrbitControls.js';
import { getLang, onLangChange, setLang, toGuDigits } from '../i18n.js';
import { speak } from '../speech.js';
import { BCU, BrakeSession, L, loadReports } from './procedure.js';
import { BrakeUnitModel } from './model.js';
import { ui } from './panels.js';
import { mrSupport, startMR } from './mr.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const PAGE = {
  en: {
    pageTitle: 'Brake Control Unit · MR', pageSub: 'Mixed reality fault guide · works offline', resetView: 'View',
    viewHint: 'Drag to rotate · pinch/scroll to zoom · tap a part', unitName: BCU.name[0], notes: 'Notes',
    savedReports: 'Saved reports', enterAR: '🥽 Enter mixed reality', enterVR: '🥽 Enter VR',
    mrNoteAR: 'Quest 3: hands or controllers. Phone: tap to place. The 3D unit is anchored where you put it.',
    mrNoteNone: 'Mixed reality needs the Meta Quest Browser or Chrome on Android over HTTPS. This 3D view works everywhere.',
    noReports: 'No reports yet.',
    flow1: 'Find the fault', flow1d: 'Search, scan the QR tag or read the code: BCU-E51.',
    flow2: 'Anchor the unit', flow2d: 'Pinch or tap on the real brake unit to anchor the 3D model there.',
    flow3: 'See the problem', flow3d: 'The faulty unit glows red; each step highlights the part to check.',
    flow4: 'Follow the steps', flow4d: 'Poke the panel with your finger or pinch-ray; grab the model to move it.',
    flow5: 'Report', flow5d: 'Tick observations and save a report on the device.',
  },
  gu: {
    pageTitle: 'બ્રેક કંટ્રોલ યુનિટ · MR', pageSub: 'મિક્સ્ડ રિયાલિટી ખામી માર્ગદર્શિકા · ઓફલાઇન ચાલે છે', resetView: 'વ્યૂ',
    viewHint: 'ફેરવવા ખેંચો · ઝૂમ માટે ચપટી/સ્ક્રોલ · ભાગ પર ટૅપ કરો', unitName: BCU.name[1], notes: 'નોંધ',
    savedReports: 'સાચવેલા રિપોર્ટ', enterAR: '🥽 મિક્સ્ડ રિયાલિટીમાં જાઓ', enterVR: '🥽 VR માં જાઓ',
    mrNoteAR: 'Quest 3: હાથ કે કંટ્રોલર. ફોન: મૂકવા ટૅપ કરો. 3D યુનિટ તમે મૂકો ત્યાં એન્કર થાય છે.',
    mrNoteNone: 'મિક્સ્ડ રિયાલિટી માટે HTTPS પર Meta Quest Browser અથવા Android પર Chrome જરૂરી છે. આ 3D વ્યૂ બધે ચાલે છે.',
    noReports: 'હજુ કોઈ રિપોર્ટ નથી.',
    flow1: 'ખામી શોધો', flow1d: 'શોધો, QR ટેગ સ્કેન કરો કે કોડ વાંચો: BCU-E51.',
    flow2: 'યુનિટ એન્કર કરો', flow2d: 'અસલી બ્રેક યુનિટ પર ચપટી કે ટૅપ કરી 3D મોડેલ ત્યાં એન્કર કરો.',
    flow3: 'સમસ્યા જુઓ', flow3d: 'ખામીવાળું યુનિટ લાલ ચમકે છે; દરેક પગલું તપાસવાનો ભાગ બતાવે છે.',
    flow4: 'પગલાં અનુસરો', flow4d: 'પેનલને આંગળીથી દબાવો કે ચપટી-કિરણ વાપરો; મોડેલ ખસેડવા પકડો.',
    flow5: 'રિપોર્ટ', flow5d: 'અવલોકનો ટિક કરો અને ઉપકરણ પર રિપોર્ટ સાચવો.',
  },
};
const p = (key) => PAGE[getLang()][key] ?? ui(getLang(), key);
const num = (n) => (getLang() === 'gu' ? toGuDigits(n) : String(n));

const session = new BrakeSession(getLang());
const model = new BrakeUnitModel();
let support = { ar: false, vr: false };

// ---------- 3D preview ----------
const viewer = $('#viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.xr.enabled = true;
viewer.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1220);
scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(1.2, 2, 1.6);
scene.add(sun);
const grid = new THREE.GridHelper(4, 40, 0x1e3a8a, 0x1e293b);
scene.add(grid);
scene.add(model.root);

const camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.01, 50);
const HOME = { pos: new THREE.Vector3(0.5, 0.78, 1.55), target: new THREE.Vector3(0, 0.3, 0) };
camera.position.copy(HOME.pos);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.minDistance = 0.4;
controls.maxDistance = 4;
controls.maxPolarAngle = Math.PI * 0.52;
const focusTarget = HOME.target.clone();

function resize() {
  const w = viewer.clientWidth;
  const h = viewer.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewer);
resize();

function previewLoop(time) {
  controls.target.lerp(focusTarget, 0.08);
  controls.update();
  model.update(time, camera.position);
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(previewLoop);

// Tap a component: show its name and jump to the step that checks it.
const raycaster = new THREE.Raycaster();
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
  const hit = model.pick(raycaster);
  const tip = $('#part-tip');
  if (!hit?.part) { tip.hidden = true; return; }
  tip.textContent = L(BCU.partNames[hit.part], getLang());
  tip.style.left = `${e.clientX - rect.left}px`;
  tip.style.top = `${e.clientY - rect.top}px`;
  tip.hidden = false;
  clearTimeout(tip.timer);
  tip.timer = setTimeout(() => { tip.hidden = true; }, 2500);
  const stepIndex = BCU.steps.findIndex((s) => s.parts.includes(hit.part));
  if (stepIndex >= 0) session.go(stepIndex);
});

function focusOnParts(ids) {
  if (!ids.length) { focusTarget.copy(HOME.target); return; }
  const box = new THREE.Box3();
  ids.forEach((id) => box.union(model.partBox(id, new THREE.Box3())));
  box.getCenter(focusTarget);
  focusTarget.applyMatrix4(model.root.matrixWorld);
}

// ---------- 2D guide UI ----------
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  children.flat().forEach((c) => c != null && n.append(c));
  return n;
}

function renderStatic() {
  const lang = getLang();
  document.documentElement.lang = lang;
  $$('[data-s]').forEach((n) => { n.textContent = p(n.dataset.s); });
  $$('.lang-toggle button').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
  $('#unit-meta').textContent = `${ui(lang, 'carriage')}: ${BCU.carriage} · ${ui(lang, 'location')}: ${L(BCU.location, lang)}`;
  $('#fault-title').textContent = `${BCU.code} · ${L(BCU.faultTitle, lang)}`;
  $('#fault-detail').textContent = L(BCU.faultDetail, lang);
  const btn = $('#btn-mr');
  btn.hidden = !(support.ar || support.vr);
  btn.textContent = support.ar ? p('enterAR') : p('enterVR');
  $('#mr-note').textContent = support.ar || support.vr ? p('mrNoteAR') : p('mrNoteNone');
}

function render() {
  const lang = getLang();
  const s = session;
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === s.tab));
  for (const t of ['overview', 'steps', 'report']) $(`#tab-${t}`).hidden = s.tab !== t;

  // Overview
  $('#rec-list').replaceChildren(...BCU.steps.map((step, i) => el('li', {
    class: [s.done.has(i) ? 'done' : '', s.index === i ? 'current' : ''].join(' '),
    onclick: () => s.go(i),
  }, el('span', { class: 'n', text: s.done.has(i) ? '✓' : num(i + 1) }), el('span', { text: L(step.title, lang) }))));
  $('#btn-start').textContent = s.index >= 0 && s.index < s.total ? `▶ ${ui(lang, 'resume')} · ${num(s.index + 1)}` : `▶ ${ui(lang, 'start')}`;

  // Steps
  const safety = $('#safety-box');
  const stepView = $('#step-view');
  if (s.index < 0) {
    safety.replaceChildren(el('h3', { text: '⚠ ' + ui(lang, 'safety') }), el('ul', {}, BCU.safety.map((x) => el('li', { text: L(x, lang) }))));
    stepView.hidden = true;
  } else if (s.index >= s.total) {
    safety.replaceChildren();
    stepView.hidden = false;
    $('#step-count').textContent = `✓ ${ui(lang, 'allDone')}`;
    $('#step-title').textContent = `${num(s.done.size)} / ${num(s.total)}`;
    $('#step-detail').textContent = '';
    $('#step-expect').textContent = '';
  } else {
    safety.replaceChildren();
    stepView.hidden = false;
    $('#step-count').textContent = ui(lang, 'stepOf', s.index + 1, s.total);
    $('#step-title').textContent = L(s.step.title, lang);
    $('#step-detail').textContent = L(s.step.detail, lang);
    $('#step-expect').textContent = L(s.step.expect, lang);
  }
  $('.expect').hidden = !s.step;
  $('#segments').replaceChildren(...BCU.steps.map((_, i) => el('i', { class: s.done.has(i) ? 'done' : s.index === i ? 'current' : '' })));
  $('#btn-back').disabled = s.index <= -1;
  $('#btn-next').textContent = s.index < 0 ? `▶ ${ui(lang, 'start')}` : s.index >= s.total ? `↺ ${ui(lang, 'restart')}` : s.index === s.total - 1 ? `✓ ${ui(lang, 'done')}` : `${ui(lang, 'next')} ▶`;

  // Report
  $('#obs-chips').replaceChildren(...BCU.observations.map((o, i) => el('button', {
    type: 'button',
    class: 'chip' + (s.observations.has(i) ? ' active' : ''),
    onclick: () => s.toggleObservation(i),
  }, (s.observations.has(i) ? '✓ ' : '') + L(o, lang))));
  if (document.activeElement !== $('#notes')) $('#notes').value = s.notes;
  $('#report-summary').textContent = `${ui(lang, 'stepsDone')}: ${num(s.done.size)} / ${num(s.total)}`;
  $('#btn-save').textContent = ui(lang, 'save');
  const reports = loadReports();
  $('#report-list').replaceChildren(...(reports.length ? reports.slice(0, 5).map((r) => el('li', {},
    el('b', { text: `${new Date(r.savedAt).toLocaleString()} · ${r.code}` }),
    `${ui(lang, 'stepsDone')}: ${num(r.stepsDone.length)} / ${num(BCU.steps.length)}${r.observations.length ? ' · ' + r.observations.join(', ') : ''}${r.notes ? ' · ' + r.notes : ''}`,
  )) : [el('li', { class: 'muted', text: p('noReports') })]));

  // 3D state
  model.setLang(lang);
  model.setFocus(s.focusParts);
  model.setCoverOpen(s.coverOpen);
  model.setFaultCleared(s.observations.has(6));
  $('#btn-cover').classList.toggle('primary', s.coverOpen);
  focusOnParts(s.focusParts);
}

session.addEventListener('change', render);

$$('.tabs button').forEach((b) => b.addEventListener('click', () => session.setTab(b.dataset.tab)));
$('#btn-start').addEventListener('click', () => (session.index < 0 || session.index >= session.total ? session.start() : session.setTab('steps')));
$('#btn-back').addEventListener('click', () => session.prev());
$('#btn-next').addEventListener('click', () => {
  if (session.index >= session.total) { session.done.clear(); session.go(0); } else session.next();
});
$('#btn-speak').addEventListener('click', () => speak(session.speechText(), session.lang));
$('#btn-cover').addEventListener('click', () => session.toggleCover());
$('#btn-view').addEventListener('click', () => {
  camera.position.copy(HOME.pos);
  focusTarget.copy(HOME.target);
});
$('#notes').addEventListener('input', (e) => { session.notes = e.target.value; });
$('#btn-save').addEventListener('click', () => {
  session.saveReport();
  toast('✓ ' + ui(getLang(), 'saved'));
});
$$('.lang-toggle button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
onLangChange((lang) => {
  session.setLang(lang);
  renderStatic();
  render();
});

let toastTimer;
function toast(msg, ms = 3000) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// ---------- mixed reality ----------
$('#btn-mr').addEventListener('click', async () => {
  try {
    await startMR({
      renderer, scene, camera, model, session,
      mode: support.ar ? 'immersive-ar' : 'immersive-vr',
      overlay: $('#xr-overlay'),
      previewOnly: [grid],
      onLang: (lang) => setLang(lang),
      onEnd: () => {
        resize();
        renderer.setAnimationLoop(previewLoop);
        render();
      },
    });
  } catch (err) {
    console.error(err);
    toast(`MR: ${err.message}`, 5000);
    renderer.setAnimationLoop(previewLoop);
  }
});

renderStatic();
render();
mrSupport().then((s) => { support = s; renderStatic(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
document.fonts?.load('16px "Noto Sans Gujarati"', 'ગુ').then(() => { model.refreshLabels(); });
