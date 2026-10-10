// On-device photo understanding:
//  1. QR asset tags on equipment (BarcodeDetector, falling back to jsQR)
//  2. OCR of fault-code displays and labels (Tesseract, English + Gujarati)
// Every model file is served from ./vendor and cached by the service worker.

import { extractCodes } from './search.js';

const base = new URL('../vendor/', import.meta.url);
const scripts = new Map();

function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    }));
  }
  return scripts.get(src);
}

let workerPromise;
export function getOcrWorker(onProgress) {
  workerPromise ??= (async () => {
    await loadScript(new URL('tesseract/tesseract.min.js', base).href);
    const worker = await self.Tesseract.createWorker(['eng', 'guj'], 1, {
      workerPath: new URL('tesseract/worker.min.js', base).href,
      corePath: new URL('tesseract/core/', base).href,
      langPath: new URL('tesseract/lang', base).href,
      workerBlobURL: false,
      gzip: true,
      cacheMethod: 'none',
      logger: (m) => onProgress?.(m),
    });
    return worker;
  })().catch((err) => { workerPromise = null; throw err; });
  return workerPromise;
}

// Downscale and convert to a canvas; large phone photos make OCR slow.
export async function imageToCanvas(source, maxSide = 1600) {
  let bitmap = source;
  if (source instanceof Blob) {
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' }).catch(() => blobToImage(source));
  }
  const w = bitmap.videoWidth || bitmap.naturalWidth || bitmap.width;
  const h = bitmap.videoHeight || bitmap.naturalHeight || bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

export async function detectQr(canvas) {
  if ('BarcodeDetector' in self) {
    try {
      const formats = await self.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const codes = await new self.BarcodeDetector({ formats: ['qr_code'] }).detect(canvas);
        if (codes.length) return codes[0].rawValue;
      }
    } catch { /* fall back to jsQR */ }
  }
  await loadScript(new URL('jsqr/jsQR.js', base).href);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return self.jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data || null;
}

// Asset tag payload: METRO-ASSET|<asset id>|<equipment type>|<label>
export function parseAssetTag(text) {
  if (!text) return null;
  const parts = text.split('|');
  if (parts[0] === 'METRO-ASSET' && parts.length >= 3) {
    return { asset: parts[1], type: parts[2], label: parts[3] || parts[1], raw: text };
  }
  return { asset: text.slice(0, 40), type: null, label: text, raw: text };
}

// Grayscale + contrast stretch helps with LCD/LED fault displays.
function preprocess(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) / range) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  out.getContext('2d').putImageData(img, 0, 0);
  return out;
}

export async function ocrCanvas(canvas, onProgress) {
  const worker = await getOcrWorker(onProgress);
  const { data } = await worker.recognize(preprocess(canvas));
  return (data.text || '').replace(/[ \t]+/g, ' ').trim();
}

// Full pipeline for one photo or camera frame.
export async function analysePhoto(source, onStatus) {
  const canvas = await imageToCanvas(source);
  const qr = await detectQr(canvas).catch(() => null);
  const tag = parseAssetTag(qr);
  let text = '';
  try {
    onStatus?.('ocr');
    text = await ocrCanvas(canvas, (m) => onStatus?.('ocr-progress', m));
  } catch (err) {
    console.warn('OCR failed', err);
  }
  // Keep only lines with real words; OCR on photos produces some noise.
  const cleanText = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => (l.match(/[\p{L}\p{N}]/gu) || []).length >= 3)
    .join('\n');
  return { tag, text: cleanText, codes: extractCodes(cleanText), canvas };
}
