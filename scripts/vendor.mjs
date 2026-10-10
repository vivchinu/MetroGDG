// Copies the third-party runtime files the app needs into ./vendor so the
// whole app can be served as static files and cached for fully offline use.
// Run `npm install && npm run vendor` after bumping a dependency.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = (p) => join(root, 'node_modules', p);
const out = (p) => join(root, 'vendor', p);

const files = [
  ['three/build/three.module.min.js', 'three/three.module.min.js'],
  ['three/build/three.core.min.js', 'three/three.core.min.js'],
  ['three/LICENSE', 'three/LICENSE'],
  ['pdfjs-dist/build/pdf.min.mjs', 'pdfjs/pdf.min.mjs'],
  ['pdfjs-dist/build/pdf.worker.min.mjs', 'pdfjs/pdf.worker.min.mjs'],
  ['pdfjs-dist/LICENSE', 'pdfjs/LICENSE'],
  ['tesseract.js/dist/tesseract.min.js', 'tesseract/tesseract.min.js'],
  ['tesseract.js/dist/worker.min.js', 'tesseract/worker.min.js'],
  ['tesseract.js/LICENSE.md', 'tesseract/LICENSE.md'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract/core/tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract/core/tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'tesseract/lang/eng.traineddata.gz'],
  ['@tesseract.js-data/guj/4.0.0_best_int/guj.traineddata.gz', 'tesseract/lang/guj.traineddata.gz'],
  ['jsqr/dist/jsQR.js', 'jsqr/jsQR.js'],
  ['@fontsource/noto-sans-gujarati/files/noto-sans-gujarati-gujarati-400-normal.woff2', 'fonts/noto-sans-gujarati-400.woff2'],
  ['@fontsource/noto-sans-gujarati/files/noto-sans-gujarati-gujarati-700-normal.woff2', 'fonts/noto-sans-gujarati-700.woff2'],
  ['@fontsource/noto-sans-gujarati/LICENSE', 'fonts/LICENSE'],
];

rmSync(join(root, 'vendor'), { recursive: true, force: true });
for (const [from, to] of files) {
  mkdirSync(dirname(out(to)), { recursive: true });
  cpSync(nm(from), out(to));
  console.log('vendor/' + to);
}

// Printable QR asset tags used to demo "photograph the equipment" lookups.
const tags = JSON.parse(
  (await import('node:fs')).readFileSync(join(root, 'data/asset-tags.json'), 'utf8'),
);
mkdirSync(join(root, 'samples/qr'), { recursive: true });
for (const tag of tags) {
  const svg = await QRCode.toString(tag.payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  writeFileSync(join(root, 'samples/qr', `${tag.asset}.svg`), svg);
  console.log('samples/qr/' + tag.asset + '.svg');
}
