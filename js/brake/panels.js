// Content of the mixed reality panels: main guide panel (Overview / Steps /
// Report), placement prompt and the wrist menu.

import { BCU, L } from './procedure.js';
import { C, FONT, drawLines, fitText, roundRect, wrapText } from './ui3d.js';
import { toGuDigits } from '../i18n.js';

const S = {
  en: {
    app: 'Metro Fix Assist · MR', offline: 'Offline mode', overview: 'Overview', steps: 'Steps', report: 'Report',
    carriage: 'Carriage', location: 'Location', critical: 'Critical', recommended: 'Recommended action',
    start: 'Start guidance', resume: 'Continue', stepOf: (a, b) => `Step ${a} of ${b}`, expected: 'Expected',
    back: 'Back', next: 'Next', done: 'Done', allDone: 'All steps done', restart: 'Restart', toReport: 'Report',
    safety: 'Safety first', observations: 'Observations', stepsDone: 'Steps done', save: 'Save report', saved: 'Saved',
    anchor: 'Anchor', cover: 'Cover', size: 'Size', exit: 'Exit', read: 'Read', menu: 'Menu',
    placeTitle: 'Place the brake unit',
    placeHand: 'Point at the real brake unit, the floor or a table and pinch to anchor the 3D model there.',
    placeCtrl: 'Point the controller at the real brake unit, the floor or a table and pull the trigger to anchor the 3D model.',
    placePhone: 'Move the phone to find a surface, then tap to anchor the 3D model.',
    placeFront: 'Place in front of me', restored: 'Anchor restored',
    notesHint: 'Typed notes: use the 2D page.',
  },
  gu: {
    app: 'મેટ્રો ફિક્સ આસિસ્ટ · MR', offline: 'ઓફલાઇન મોડ', overview: 'સારાંશ', steps: 'પગલાં', report: 'રિપોર્ટ',
    carriage: 'કેરેજ', location: 'સ્થાન', critical: 'ગંભીર', recommended: 'ભલામણ કરેલ કાર્યવાહી',
    start: 'માર્ગદર્શન શરૂ કરો', resume: 'ચાલુ રાખો', stepOf: (a, b) => `પગલું ${toGuDigits(a)} / ${toGuDigits(b)}`, expected: 'અપેક્ષિત',
    back: 'પાછળ', next: 'આગળ', done: 'થઈ ગયું', allDone: 'બધાં પગલાં પૂર્ણ', restart: 'ફરી શરૂ', toReport: 'રિપોર્ટ',
    safety: 'પહેલાં સલામતી', observations: 'અવલોકનો', stepsDone: 'પૂર્ણ પગલાં', save: 'રિપોર્ટ સાચવો', saved: 'સાચવ્યું',
    anchor: 'એન્કર', cover: 'કવર', size: 'કદ', exit: 'બહાર', read: 'વાંચો', menu: 'મેનૂ',
    placeTitle: 'બ્રેક યુનિટ મૂકો',
    placeHand: 'અસલી બ્રેક યુનિટ, ફ્લોર કે ટેબલ તરફ આંગળી રાખો અને ચપટી કરી 3D મોડેલ ત્યાં એન્કર કરો.',
    placeCtrl: 'કંટ્રોલર અસલી બ્રેક યુનિટ, ફ્લોર કે ટેબલ તરફ રાખો અને ટ્રિગર દબાવી 3D મોડેલ એન્કર કરો.',
    placePhone: 'સપાટી શોધવા ફોન ફેરવો, પછી ટૅપ કરી 3D મોડેલ એન્કર કરો.',
    placeFront: 'મારી સામે મૂકો', restored: 'એન્કર પાછું મળ્યું',
    notesHint: 'લખેલી નોંધ: 2D પાના પર લખો.',
  },
};
export const ui = (lang, key, ...a) => { const v = S[lang]?.[key] ?? S.en[key]; return typeof v === 'function' ? v(...a) : v; };
const num = (lang, n) => (lang === 'gu' ? toGuDigits(n) : String(n));

function circleNumber(ctx, x, y, r, text, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.round(r * 1.05)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

export function drawMainPanel(panel, s, opts = {}) {
  const { ctx, pw, ph } = panel;
  const lang = s.lang;
  const pad = 56;
  panel.background();

  // Header
  ctx.fillStyle = C.muted;
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(ui(lang, 'app'), pad, 66);
  const chipW = 250;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  roundRect(ctx, pad, 88, chipW, 46, 23);
  ctx.fill();
  ctx.fillStyle = C.ok;
  ctx.beginPath(); ctx.arc(pad + 26, 111, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.text;
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText(ui(lang, 'offline'), pad + 46, 120, chipW - 56);
  panel.button('exit', pw - 140, 36, 96, 96, '✕');

  // Tabs
  const tabs = ['overview', 'steps', 'report'];
  const tabW = (pw - pad * 2) / 3;
  tabs.forEach((id, i) => panel.button(`tab:${id}`, pad + i * tabW, 150, tabW, 80, ui(lang, id), { style: 'tab', active: s.tab === id }));
  ctx.fillStyle = 'rgba(148,163,184,0.25)';
  ctx.fillRect(pad, 230, pw - pad * 2, 2);

  const top = 270;
  const bottom = ph - 190;
  if (s.tab === 'overview') drawOverview(panel, s, pad, top, bottom);
  else if (s.tab === 'steps') drawSteps(panel, s, pad, top, bottom);
  else drawReport(panel, s, pad, top, bottom, opts);

  // Toolbar
  const tb = ph - 160;
  const items = [['tool:anchor', '⚓ ' + ui(lang, 'anchor')], ['tool:cover', '▣ ' + ui(lang, 'cover')], ['tool:size', '⤢ ' + ui(lang, 'size')], ['tool:lang', lang === 'gu' ? 'EN' : 'ગુ']];
  const gap = 14;
  const bw = (pw - pad * 2 - gap * (items.length - 1)) / items.length;
  items.forEach(([id, label], i) => panel.button(id, pad + i * (bw + gap), tb, bw, 104, label, { size: 32, style: id === 'tool:cover' && s.coverOpen ? 'chip' : 'secondary', active: id === 'tool:cover' && s.coverOpen }));
}

function drawOverview(panel, s, pad, top, bottom) {
  const { ctx, pw } = panel;
  const lang = s.lang;
  let y = top + 40;
  ctx.fillStyle = C.text;
  ctx.font = `700 50px ${FONT}`;
  ctx.fillText(L(BCU.name, lang), pad, y, pw - pad * 2 - 230);
  // Critical badge
  const bx = pw - pad - 210;
  ctx.fillStyle = C.danger;
  roundRect(ctx, bx, y - 44, 210, 58, 29);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 30px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('⚠ ' + ui(lang, 'critical'), bx + 105, y - 6, 196);
  ctx.textAlign = 'left';
  y += 50;
  ctx.fillStyle = C.muted;
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText(`${ui(lang, 'carriage')}: ${BCU.carriage}   ·   ${ui(lang, 'location')}: ${L(BCU.location, lang)}`, pad, y, pw - pad * 2);
  y += 30;

  // Fault box
  ctx.font = `500 30px ${FONT}`;
  const faultLines = wrapText(ctx, L(BCU.faultDetail, lang), pw - pad * 2 - 40).slice(0, 3);
  const boxH = 70 + faultLines.length * 40;
  ctx.fillStyle = C.dangerBg;
  roundRect(ctx, pad - 8, y, pw - pad * 2 + 16, boxH, 22);
  ctx.fill();
  ctx.fillStyle = '#fecdd3';
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText(`${BCU.code} · ${L(BCU.faultTitle, lang)}`, pad + 14, y + 46);
  ctx.fillStyle = C.text;
  ctx.font = `500 30px ${FONT}`;
  drawLines(ctx, faultLines, pad + 14, y + 92, 40);
  y += boxH + 56;

  ctx.fillStyle = C.text;
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText(ui(lang, 'recommended'), pad, y);
  y += 22;
  const rowH = 58;
  BCU.steps.forEach((step, i) => {
    const ry = y + i * rowH;
    if (ry + rowH > bottom - 110) return;
    panel.buttons.push({ id: `step:${i}`, x: pad - 8, y: ry, w: pw - pad * 2 + 16, h: rowH - 6 });
    if (panel.hover === `step:${i}`) {
      ctx.fillStyle = 'rgba(51,65,85,0.7)';
      roundRect(ctx, pad - 8, ry, pw - pad * 2 + 16, rowH - 6, 16);
      ctx.fill();
    }
    const fill = s.done.has(i) ? C.ok : s.index === i ? C.accent : '#1d4ed8';
    circleNumber(ctx, pad + 24, ry + rowH / 2 - 3, 22, s.done.has(i) ? '✓' : num(lang, i + 1), fill);
    ctx.fillStyle = s.done.has(i) ? C.muted : C.text;
    ctx.font = `500 31px ${FONT}`;
    ctx.fillText(L(step.title, lang), pad + 70, ry + rowH / 2 + 8, pw - pad * 2 - 80);
  });
  const label = s.index >= 0 && s.index < s.total ? `▶ ${ui(lang, 'resume')} · ${num(lang, s.index + 1)}` : `▶ ${ui(lang, 'start')}`;
  panel.button('start', pad, bottom - 96, pw - pad * 2, 96, label, { style: 'primary' });
}

function drawSteps(panel, s, pad, top, bottom) {
  const { ctx, pw } = panel;
  const lang = s.lang;
  let y = top + 20;
  const navY = bottom - 110;

  if (s.index < 0) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = `700 42px ${FONT}`;
    ctx.fillText('⚠ ' + ui(lang, 'safety'), pad, y + 30);
    y += 70;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
    roundRect(ctx, pad - 10, y, pw - pad * 2 + 20, navY - y - 30, 24);
    ctx.fill();
    let ty = y + 56;
    for (const item of BCU.safety) {
      const { lines, lineHeight } = fitText(ctx, L(item, lang), pw - pad * 2 - 60, 220, 38, 28);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('•', pad + 8, ty);
      ctx.fillStyle = C.text;
      ty = drawLines(ctx, lines, pad + 40, ty, lineHeight) + 24;
    }
    panel.button('start', pad, navY, pw - pad * 2, 100, `▶ ${ui(lang, 'start')}`, { style: 'primary' });
    return;
  }

  if (s.index >= s.total) {
    ctx.fillStyle = C.ok;
    ctx.font = `700 180px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('✓', pw / 2, y + 230);
    ctx.fillStyle = C.text;
    ctx.font = `700 50px ${FONT}`;
    ctx.fillText(ui(lang, 'allDone'), pw / 2, y + 330);
    ctx.fillStyle = C.muted;
    ctx.font = `500 34px ${FONT}`;
    ctx.fillText(`${num(lang, s.done.size)} / ${num(lang, s.total)}`, pw / 2, y + 390);
    ctx.textAlign = 'left';
    const half = (pw - pad * 2 - 20) / 2;
    panel.button('restart', pad, navY, half, 100, '↺ ' + ui(lang, 'restart'));
    panel.button('tab:report', pad + half + 20, navY, half, 100, ui(lang, 'toReport') + ' ▶', { style: 'primary' });
    return;
  }

  const step = s.step;
  ctx.fillStyle = C.accent;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(ui(lang, 'stepOf', s.index + 1, s.total), pad, y + 26);
  // progress segments
  const segW = (pw - pad * 2 - (s.total - 1) * 8) / s.total;
  for (let i = 0; i < s.total; i++) {
    ctx.fillStyle = s.done.has(i) ? C.ok : i === s.index ? C.accent : C.track;
    roundRect(ctx, pad + i * (segW + 8), y + 50, segW, 12, 6);
    ctx.fill();
  }
  y += 100;
  circleNumber(ctx, pad + 34, y + 30, 34, num(lang, s.index + 1), C.primary);
  const title = fitText(ctx, L(step.title, lang), pw - pad * 2 - 90, 120, 46, 34, 700);
  ctx.fillStyle = C.text;
  y = drawLines(ctx, title.lines, pad + 90, y + 44, title.lineHeight) + 10;

  const expect = L(step.expect, lang);
  ctx.font = `500 30px ${FONT}`;
  const expectLines = wrapText(ctx, expect, pw - pad * 2 - 40).slice(0, 3);
  const expectH = 64 + expectLines.length * 40;
  const detailMax = navY - 30 - expectH - 24 - y;
  const detail = fitText(ctx, L(step.detail, lang), pw - pad * 2, detailMax, 38, 26, 500);
  ctx.fillStyle = '#e2e8f0';
  y = drawLines(ctx, detail.lines, pad, y + detail.size, detail.lineHeight) + 10;

  const ey = navY - 30 - expectH;
  ctx.fillStyle = C.cyanBg;
  roundRect(ctx, pad - 8, ey, pw - pad * 2 + 16, expectH, 20);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(56,189,248,0.7)';
  ctx.stroke();
  ctx.fillStyle = C.accent;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('✓ ' + ui(lang, 'expected'), pad + 12, ey + 42);
  ctx.fillStyle = C.text;
  ctx.font = `500 30px ${FONT}`;
  drawLines(ctx, expectLines, pad + 12, ey + 86, 40);

  const last = s.index === s.total - 1;
  panel.button('back', pad, navY, 250, 100, '◀ ' + ui(lang, 'back'));
  panel.button('speak', pad + 266, navY, 130, 100, '🔊');
  panel.button('next', pad + 412, navY, pw - pad * 2 - 412, 100, last ? `✓ ${ui(lang, 'done')}` : `${ui(lang, 'next')} ▶`, { style: 'primary' });
}

function drawReport(panel, s, pad, top, bottom, opts) {
  const { ctx, pw } = panel;
  const lang = s.lang;
  let y = top + 30;
  ctx.fillStyle = C.text;
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText(ui(lang, 'observations'), pad, y);
  y += 30;
  const gap = 16;
  const cw = (pw - pad * 2 - gap) / 2;
  BCU.observations.forEach((o, i) => {
    const cx = pad + (i % 2) * (cw + gap);
    const cy = y + Math.floor(i / 2) * 96;
    panel.button(`obs:${i}`, cx, cy, cw, 80, (s.observations.has(i) ? '✓ ' : '') + L(o, lang), { style: 'chip', active: s.observations.has(i), size: 30 });
  });
  y += Math.ceil(BCU.observations.length / 2) * 96 + 40;
  ctx.fillStyle = C.muted;
  ctx.font = `500 32px ${FONT}`;
  const mins = Math.max(1, Math.round((Date.now() - s.startedAt) / 60000));
  ctx.fillText(`${ui(lang, 'stepsDone')}: ${num(lang, s.done.size)} / ${num(lang, s.total)}   ·   ${num(lang, mins)} min`, pad, y);
  y += 50;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(ui(lang, 'notesHint'), pad, y);
  const saved = opts.savedAt ? `✓ ${ui(lang, 'saved')} ${new Date(opts.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : null;
  panel.button('save', pad, bottom - 100, pw - pad * 2, 100, saved || ui(lang, 'save'), { style: saved ? 'chip' : 'primary', active: Boolean(saved) });
}

export function drawPlacePanel(panel, lang, mode) {
  const { ctx, pw } = panel;
  const pad = 50;
  panel.background(36);
  ctx.fillStyle = C.text;
  ctx.font = `700 46px ${FONT}`;
  ctx.fillText('⚓ ' + ui(lang, 'placeTitle'), pad, 82);
  const key = mode === 'hand' ? 'placeHand' : mode === 'phone' ? 'placePhone' : 'placeCtrl';
  const t = fitText(ctx, ui(lang, key), pw - pad * 2, 130, 34, 26);
  ctx.fillStyle = '#cbd5e1';
  drawLines(ctx, t.lines, pad, 140, t.lineHeight);
  panel.button('place-front', pad, 290, pw - pad * 2, 90, ui(lang, 'placeFront'), { style: 'primary', size: 34 });
}

export function drawWristMenu(panel, lang) {
  const { ctx, pw } = panel;
  panel.background(30);
  ctx.fillStyle = C.muted;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(ui(lang, 'menu'), 30, 50);
  const items = [['tool:anchor', '⚓ ' + ui(lang, 'anchor')], ['tool:cover', '▣ ' + ui(lang, 'cover')], ['speak', '🔊 ' + ui(lang, 'read')], ['exit', '✕ ' + ui(lang, 'exit')]];
  const bw = (pw - 30 * 2 - 16) / 2;
  items.forEach(([id, label], i) => panel.button(id, 30 + (i % 2) * (bw + 16), 72 + Math.floor(i / 2) * 116, bw, 100, label, { size: 32, style: id === 'exit' ? 'danger' : 'secondary' }));
}
