// On-device retrieval: BM25 over manual procedures with light English and
// Gujarati stemming, a bilingual concept glossary (so a Gujarati description
// finds an English manual and vice versa) and a strong boost for fault codes.

import { fromGuDigits } from './i18n.js';

const EN_STOP = new Set('the a an is are was were be been of to and or in on at it its my this that with for from by as has have had do does did please our we i me can will'.split(' '));
const GU_STOP = new Set(['છે', 'અને', 'તે', 'આ', 'એક', 'થાય', 'હોય', 'કરો', 'કે', 'પણ', 'જો', 'તો', 'છું', 'હતું', 'હતો', 'હતી', 'મારો', 'મારી', 'અમારો', 'કૃપા', 'કરીને']);

// Postpositions / case endings commonly glued to Gujarati nouns.
const GU_SUFFIXES = ['માંથી', 'ઓમાં', 'ઓને', 'ઓનો', 'ઓની', 'ઓનું', 'માં', 'થી', 'નો', 'ની', 'નું', 'ના', 'ને', 'એ', 'પર', 'ઓ'];
const GU_FINAL_VOWEL = /[ા-ૄેૈોૌં]$/;

function stemGu(w) {
  for (const s of GU_SUFFIXES) {
    if (w.endsWith(s) && [...w].length - [...s].length >= 2) { w = w.slice(0, -s.length); break; }
  }
  if ([...w].length > 2) w = w.replace(GU_FINAL_VOWEL, '');
  return w;
}

function stemEn(w) {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith("'s")) w = w.slice(0, -2);
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ing') && w.length > 5) { w = w.slice(0, -3); return w.replace(/(.)\1$/, '$1'); }
  if (w.endsWith('ed') && w.length > 4) { w = w.slice(0, -2); return w.replace(/(.)\1$/, '$1'); }
  if (/(ss|us|is)$/.test(w)) return w;
  if (/(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

export function normalize(text) {
  return fromGuDigits(String(text || '').normalize('NFC')).toLowerCase();
}

function stem(w) {
  return /[઀-૿]/.test(w) ? stemGu(w) : stemEn(w);
}

// Concept glossary: words in either language map to a shared concept token.
const CONCEPTS = {
  door: ['door', 'doors', 'દરવાજો', 'દરવાજા', 'બારણું', 'ડોર'],
  open: ['open', 'opening', 'opens', 'reopen', 'ખૂલે', 'ખૂલતો', 'ખુલ્લો', 'ખોલો', 'ખૂલવું'],
  close: ['close', 'closing', 'closed', 'shut', 'બંધ'],
  stuck: ['stuck', 'jam', 'jammed', 'trapped', 'blocked', 'અટકી', 'અટક્યું', 'અટક્યો', 'ફસાયું', 'ફસાયા', 'ફસાયેલું', 'જામ'],
  stop: ['stop', 'stopped', 'halt', 'trip', 'tripped', 'અટકે', 'બંધ', 'ટ્રિપ'],
  escalator: ['escalator', 'એસ્કેલેટર'],
  lift: ['lift', 'elevator', 'લિફ્ટ', 'એલિવેટર'],
  pump: ['pump', 'sump', 'પંપ', 'સમ્પ'],
  water: ['water', 'flood', 'flooding', 'leak', 'leaking', 'drip', 'પાણી', 'લીક', 'ટપકે'],
  fire: ['fire', 'આગ', 'ફાયર'],
  smoke: ['smoke', 'ધુમાડો', 'સ્મોક'],
  alarm: ['alarm', 'buzzer', 'beeping', 'એલાર્મ', 'બઝર'],
  brake: ['brake', 'brakes', 'braking', 'બ્રેક'],
  hot: ['hot', 'heat', 'warm', 'ગરમ', 'ગરમી'],
  cool: ['cool', 'cooling', 'cold', 'ac', 'hvac', 'conditioner', 'conditioning', 'ઠંડક', 'ઠંડુ', 'એસી', 'એર-કન્ડિશન', 'કન્ડિશનિંગ'],
  noise: ['noise', 'sound', 'loud', 'grinding', 'અવાજ'],
  audio: ['audio', 'announcement', 'speaker', 'pa', 'જાહેરાત', 'સ્પીકર'],
  vibration: ['vibration', 'vibrating', 'shaking', 'કંપન', 'ધ્રુજારી'],
  fan: ['fan', 'fans', 'પંખો', 'પંખા'],
  battery: ['battery', 'batteries', 'બેટરી'],
  voltage: ['voltage', 'volt', 'volts', 'વોલ્ટેજ'],
  power: ['power', 'electricity', 'supply', 'પાવર', 'વીજળી', 'સપ્લાય'],
  ticket: ['ticket', 'ટિકિટ'],
  gate: ['gate', 'gates', 'ગેટ'],
  card: ['card', 'token', 'કાર્ડ', 'ટોકન'],
  display: ['display', 'screen', 'monitor', 'ડિસ્પ્લે', 'સ્ક્રીન'],
  light: ['light', 'lights', 'lamp', 'led', 'લાઇટ', 'લેમ્પ', 'બત્તી'],
  train: ['train', 'coach', 'car', 'ટ્રેન', 'કોચ'],
  fault: ['fault', 'error', 'failure', 'fail', 'problem', 'issue', 'ખામી', 'ફોલ્ટ', 'ભૂલ', 'સમસ્યા'],
  platform: ['platform', 'પ્લેટફોર્મ'],
  tunnel: ['tunnel', 'underground', 'ટનલ', 'ભૂગર્ભ'],
  pantograph: ['pantograph', 'પેન્ટોગ્રાફ'],
  traction: ['traction', 'ટ્રેક્શન'],
  broken: ['broken', 'damaged', 'damage', 'તૂટેલું', 'તૂટી', 'નુકસાન'],
  passenger: ['passenger', 'passengers', 'મુસાફર', 'મુસાફરો'],
  reset: ['reset', 'restart', 'રીસેટ'],
  motor: ['motor', 'મોટર'],
  move: ['move', 'moving', 'run', 'running', 'ચાલતી', 'ચાલતો', 'ચાલુ', 'ચાલે'],
};
const conceptOf = new Map();
for (const [concept, words] of Object.entries(CONCEPTS)) {
  for (const w of words) {
    const key = stem(normalize(w));
    if (!conceptOf.has(key)) conceptOf.set(key, []);
    if (!conceptOf.get(key).includes('§' + concept)) conceptOf.get(key).push('§' + concept);
  }
}

export function tokenize(text) {
  const words = normalize(text).match(/[\p{L}\p{M}\p{N}]+/gu) || [];
  const out = [];
  for (const raw of words) {
    if (EN_STOP.has(raw) || GU_STOP.has(raw)) continue;
    const s = stem(raw);
    if (!s) continue;
    out.push(s);
    const concepts = conceptOf.get(s);
    if (concepts) out.push(...concepts);
  }
  return out;
}

// Fault codes like "DCU-E12", "E 12", "F03", "ESC E24". Returns canonical
// short codes ("e12") which is what is printed on most equipment displays.
export function extractCodes(text) {
  const s = fromGuDigits(String(text || '')).toUpperCase();
  const found = new Set();
  for (const m of s.matchAll(/\b(?:[A-Z]{2,4}[\s\-_]+)?([A-Z])[\s\-_]?(\d{2,3})\b/g)) {
    found.add((m[1] + m[2]).toLowerCase());
  }
  return [...found];
}

const K1 = 1.2;
const B = 0.75;

export class Index {
  constructor() {
    this.docs = [];
  }

  // fields: [{ text, weight }]
  add(doc, fields) {
    const tf = new Map();
    let len = 0;
    for (const { text, weight } of fields) {
      for (const tok of tokenize(text)) {
        tf.set(tok, (tf.get(tok) || 0) + weight);
        len += weight;
      }
    }
    const codes = new Set((doc.codes || []).flatMap(extractCodes));
    for (const c of extractCodes(fields.map((f) => f.text).join(' '))) codes.add(c);
    this.docs.push({ doc, tf, len, codes });
    this._stats = null;
  }

  stats() {
    if (this._stats) return this._stats;
    const df = new Map();
    let total = 0;
    for (const d of this.docs) {
      total += d.len;
      for (const tok of d.tf.keys()) df.set(tok, (df.get(tok) || 0) + 1);
    }
    this._stats = { df, avgLen: total / Math.max(1, this.docs.length) };
    return this._stats;
  }

  search(query, { codes = [], assetType = null, limit = 5 } = {}) {
    const qTokens = [...new Set(tokenize(query))];
    const qCodes = new Set([...codes, ...extractCodes(query)]);
    const { df, avgLen } = this.stats();
    const N = this.docs.length;
    const results = [];
    for (const d of this.docs) {
      let score = 0;
      const matched = [];
      for (const tok of qTokens) {
        const f = d.tf.get(tok);
        if (!f) continue;
        const n = df.get(tok) || 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        const w = tok.startsWith('§') ? 0.6 : 1;
        score += w * idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * (d.len / avgLen)));
        if (!tok.startsWith('§')) matched.push(tok);
      }
      const codeHits = [...qCodes].filter((c) => d.codes.has(c));
      if (codeHits.length) {
        score += 8 * codeHits.length;
        matched.push(...codeHits.map((c) => c.toUpperCase()));
      }
      if (assetType && d.doc.type === assetType) {
        score += 4;
      }
      if (score > 0) results.push({ doc: d.doc, score, matched: [...new Set(matched)], codeHits });
    }
    results.sort((a, b) => b.score - a.score);
    // Drop weak tail results relative to the best one.
    const top = results[0]?.score || 0;
    return results.filter((r) => r.score >= top * 0.25).slice(0, limit);
  }
}

// Build an index over built-in procedures and imported PDF sections.
export function buildIndex(procedures) {
  const index = new Index();
  for (const p of procedures) {
    const fields = [];
    for (const c of Object.values(p.content)) {
      fields.push({ text: c.title, weight: 3 });
      fields.push({ text: c.equipment || '', weight: 2 });
      fields.push({ text: c.symptoms || '', weight: 2 });
      fields.push({ text: (c.steps || []).join(' '), weight: 1 });
      fields.push({ text: c.body || '', weight: 0.7 });
    }
    fields.push({ text: (p.codes || []).join(' '), weight: 3 });
    index.add(p, fields);
  }
  return index;
}
