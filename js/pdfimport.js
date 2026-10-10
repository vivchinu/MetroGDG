// Turns a PDF manual into searchable troubleshooting sections, fully on the
// device. Text PDFs are split by headings (font size / numbering) and steps
// by numbered or bulleted lines; scanned pages are OCR'd.

import { detectLang, fromGuDigits } from './i18n.js';
import { extractCodes, tokenize } from './search.js';
import { getOcrWorker, ocrCanvas } from './vision.js';

let pdfjsPromise;
export function loadPdfJs() {
  pdfjsPromise ??= import('../vendor/pdfjs/pdf.min.mjs').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    return pdfjs;
  });
  return pdfjsPromise;
}

export async function openPdf(data) {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({ data, isEvalSupported: false }).promise;
}

async function pageLines(page) {
  const tc = await page.getTextContent();
  const items = tc.items
    .filter((it) => it.str !== undefined)
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      size: Math.hypot(it.transform[2], it.transform[3]) || it.height || 10,
      w: it.width,
      eol: it.hasEOL,
    }));
  items.sort((a, b) => (Math.abs(b.y - a.y) > Math.min(a.size, b.size) * 0.5 ? b.y - a.y : a.x - b.x));
  const lines = [];
  let cur = null;
  for (const it of items) {
    if (!it.str.trim() && !cur) continue;
    if (cur && Math.abs(cur.y - it.y) <= Math.max(2, Math.min(cur.size, it.size) * 0.5)) {
      const gap = it.x - cur.endX;
      if (gap > it.size * 0.15 && !cur.text.endsWith(' ') && !it.str.startsWith(' ')) cur.text += ' ';
      cur.text += it.str;
      cur.endX = it.x + it.w;
      cur.size = Math.max(cur.size, it.size);
    } else {
      if (cur) lines.push(cur);
      cur = { text: it.str, x: it.x, y: it.y, endX: it.x + it.w, size: it.size };
    }
  }
  if (cur) lines.push(cur);
  return lines.map((l) => ({ ...l, text: cleanText(l.text) })).filter((l) => l.text);
}

function cleanText(text) {
  return text
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    // pdf.js often splits Gujarati conjuncts into separate runs: "સ્ ટેશન" -> "સ્ટેશન"
    .replace(/\u0ACD /g, '\u0ACD')
    .trim();
}

// Many Gujarati PDFs (legacy fonts, or fonts without a ToUnicode map) give a
// text layer with missing or private-use characters. Scanned pages have no
// text at all. Both are fixed with on-device OCR of the rendered page.
const BAD_CHARS = /[\u0000�-]/;
const BAD_CHARS_G = /[\u0000�-]/g;

async function renderToCanvas(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return { canvas, viewport };
}

async function ocrPage(page) {
  const { canvas } = await renderToCanvas(page, 2);
  const text = await ocrCanvas(canvas);
  return text.split('\n').map(cleanText).filter(Boolean).map((t) => ({ text: t, size: 0, x: 0 }));
}

// OCR just the broken lines, keeping their position and font size so that
// heading detection still works.
async function repairLines(page, lines) {
  const broken = lines.filter((l) => BAD_CHARS.test(l.text));
  if (!broken.length) return lines;
  const { canvas, viewport } = await renderToCanvas(page, 3);
  const worker = await getOcrWorker();
  await worker.setParameters({ tessedit_pageseg_mode: '7' });
  try {
    for (const l of broken) {
      const [x1, y1] = viewport.convertToViewportPoint(l.x - 2, l.y + l.size * 1.1);
      const [x2, y2] = viewport.convertToViewportPoint(l.endX + 4, l.y - l.size * 0.4);
      const rectangle = {
        left: Math.max(0, Math.floor(Math.min(x1, x2))),
        top: Math.max(0, Math.floor(Math.min(y1, y2))),
        width: Math.ceil(Math.abs(x2 - x1)),
        height: Math.ceil(Math.abs(y2 - y1)),
      };
      rectangle.width = Math.min(rectangle.width, canvas.width - rectangle.left);
      rectangle.height = Math.min(rectangle.height, canvas.height - rectangle.top);
      const { data } = await worker.recognize(canvas, { rectangle });
      l.text = cleanText(data.text || '') || cleanText(l.text.replace(BAD_CHARS_G, ''));
    }
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
  }
  return lines;
}

const STEP_RE = /^\s*(?:(?:step|પગલું)\s*)?(\d{1,2}|[a-h]|[ivx]{1,4})\s*[.):]\s+|^\s*(?:step|પગલું)\s*\d{1,2}\s*[-–:]?\s*|^\s*[•\-–*▪●○■□►✓]\s+/i;
const WARN_RE = /^\s*(warning|caution|danger|note|important|ચેતવણી|સાવધાન|સાવચેતી|નોંધ|મહત્વપૂર્ણ)\b\s*[:!\-–]?/i;
const HEAD_KEYWORDS = /^(chapter|section|troubleshooting|fault|procedure|appendix|પ્રકરણ|વિભાગ|ખામી નિવારણ)\b/i;
const SENTENCE_END = /[.!?।]$/;

function isHeading(line, median) {
  const text = fromGuDigits(line.text);
  if (text.length < 3 || text.length > 90) return false;
  if (/[,;]$/.test(text)) return false;
  if (STEP_RE.test(text) && !/^\d+\.\d+/.test(text)) return false;
  const big = median && line.size >= median * 1.18;
  const multiLevel = /^\d+(\.\d+)+\.?\s+\S/.test(text);
  const chapterNum = /^\d{1,2}\s+[A-Z઀-૿]/.test(text) && median && line.size >= median * 1.05;
  const letters = text.replace(/[^A-Za-z]/g, '');
  const allCaps = letters.length >= 5 && letters === letters.toUpperCase() && !SENTENCE_END.test(text);
  const keyword = HEAD_KEYWORDS.test(text) && text.length < 60 && !SENTENCE_END.test(text);
  return Boolean(big || multiLevel || chapterNum || allCaps || keyword);
}

function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function finishSection(sec) {
  const steps = [];
  const warnings = [];
  const body = [];
  let mode = 'body';
  for (const raw of sec.lines) {
    const line = raw.text;
    const norm = fromGuDigits(line);
    if (WARN_RE.test(norm)) {
      warnings.push(line);
      mode = 'warn';
    } else if (STEP_RE.test(norm)) {
      steps.push(line.replace(STEP_RE, '').trim() || line);
      mode = 'step';
    } else if (mode === 'step' && steps.length && !(SENTENCE_END.test(steps.at(-1)) && /^[A-Z]/.test(line))) {
      steps[steps.length - 1] += ' ' + line;
    } else if (mode === 'warn' && warnings.length && !SENTENCE_END.test(warnings.at(-1))) {
      warnings[warnings.length - 1] += ' ' + line;
    } else {
      body.push(line);
      mode = 'body';
    }
  }
  const bodyText = body.join(' ');
  let finalSteps = steps.filter((s) => s.length > 2);
  if (!finalSteps.length && bodyText) {
    // No list markup: fall back to sentences so the AR panel still steps through.
    finalSteps = bodyText.split(/(?<=[.!?।])\s+/).map((s) => s.trim()).filter((s) => s.length > 8).slice(0, 15);
  }
  return {
    title: sec.title,
    page: sec.page,
    steps: finalSteps,
    warnings,
    body: bodyText,
    summary: bodyText.slice(0, 280),
  };
}

const TYPE_HINTS = [
  ['psd', ['§platform', '§door']],
  ['door', ['§door']],
  ['escalator', ['§escalator']],
  ['lift', ['§lift']],
  ['hvac', ['§cool']],
  ['pump', ['§pump']],
  ['fire', ['§fire']],
  ['afc', ['§ticket', '§gate']],
  ['tvf', ['§tunnel', '§fan']],
  ['aps', ['§battery']],
  ['pis', ['§display']],
  ['pis', ['§audio']],
  ['brake', ['§brake']],
  ['traction', ['§traction']],
  ['traction', ['§pantograph']],
];
function guessType(text) {
  const toks = new Set(tokenize(text));
  for (const [type, need] of TYPE_HINTS) if (need.every((n) => toks.has(n))) return type;
  return null;
}

export async function importPdf(file, onProgress) {
  const data = new Uint8Array(await file.arrayBuffer());
  // pdf.js transfers the buffer to its worker, so keep our own copy for storage.
  const pdf = await openPdf(data.slice());
  const allLines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    let lines = await pageLines(page);
    const cleanChars = lines.map((l) => l.text.replace(BAD_CHARS_G, '')).join('').replace(/\s/g, '').length;
    if (cleanChars < 20) {
      onProgress?.({ page: p, total: pdf.numPages, ocr: true });
      try { lines = await ocrPage(page); } catch (err) { console.warn('OCR page failed', p, err); lines = []; }
    } else if (lines.some((l) => BAD_CHARS.test(l.text))) {
      onProgress?.({ page: p, total: pdf.numPages, ocr: true });
      try { lines = await repairLines(page, lines); } catch (err) { console.warn('OCR repair failed', p, err); }
    } else {
      onProgress?.({ page: p, total: pdf.numPages, ocr: false });
    }
    lines.forEach((l) => allLines.push({ ...l, page: p }));
    page.cleanup();
  }
  const med = median(allLines.filter((l) => l.size > 0).map((l) => l.size));

  const sections = [];
  let sec = null;
  for (const line of allLines) {
    if (isHeading(line, med)) {
      if (sec && sec.lines.length === 0) {
        sec.title = `${sec.title} › ${line.text}`;
        continue;
      }
      if (sec) sections.push(sec);
      sec = { title: line.text, page: line.page, lines: [] };
    } else {
      sec ??= { title: file.name.replace(/\.pdf$/i, ''), page: line.page, lines: [] };
      sec.lines.push(line);
    }
  }
  if (sec) sections.push(sec);

  const fullText = allLines.map((l) => l.text).join(' ');
  const lang = detectLang(fullText);
  const id = 'pdf-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const name = file.name.replace(/\.pdf$/i, '');
  const procedures = sections
    .map(finishSection)
    .filter((s) => s.body.length + s.steps.join('').length >= 30)
    .map((s, i) => {
      const text = `${s.title} ${s.body} ${s.steps.join(' ')}`;
      const sectionLang = detectLang(text);
      return {
        id: `${id}-${i}`,
        manualId: id,
        manualName: name,
        source: 'pdf',
        page: s.page,
        type: guessType(`${s.title} ${s.body.slice(0, 600)}`),
        codes: extractCodes(text).map((c) => c.toUpperCase()),
        content: {
          [sectionLang]: {
            title: s.title,
            symptoms: s.summary,
            safety: s.warnings,
            tools: [],
            steps: s.steps,
            body: s.body,
          },
        },
      };
    });

  return {
    manual: { id, name, lang, source: 'pdf', pageCount: pdf.numPages, addedAt: Date.now(), size: file.size, procedures },
    blob: new Blob([data], { type: 'application/pdf' }),
  };
}

// Render one page of a stored PDF into a canvas (for "show manual page").
export async function renderPage(blob, pageNumber, canvas, maxWidth) {
  const pdf = await openPdf(new Uint8Array(await blob.arrayBuffer()));
  const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages));
  const unscaled = page.getViewport({ scale: 1 });
  const scale = (maxWidth * (window.devicePixelRatio || 1)) / unscaled.width;
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = '100%';
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
}
