// Service worker: caches the whole app, the demo manual and every on-device
// model (OCR, PDF reader, 3D engine, fonts) so it runs with no network,
// e.g. in underground sections and equipment rooms.
const VERSION = 'v1.0.0';
const CACHE = `metro-fix-assist-${VERSION}`;

const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'tags.html',
  'css/app.css',
  'js/main.js',
  'js/i18n.js',
  'js/search.js',
  'js/store.js',
  'js/guide.js',
  'js/card.js',
  'js/speech.js',
  'js/vision.js',
  'js/pdfimport.js',
  'js/xr.js',
  'data/sample-manual.json',
  'data/asset-tags.json',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'vendor/three/three.module.min.js',
  'vendor/three/three.core.min.js',
  'vendor/fonts/noto-sans-gujarati-400.woff2',
  'vendor/fonts/noto-sans-gujarati-700.woff2',
  'vendor/jsqr/jsQR.js',
  'vendor/pdfjs/pdf.min.mjs',
  'vendor/pdfjs/pdf.worker.min.mjs',
];

// Large model files: cached during install too, but a failure here must not
// block the rest of the app from working offline.
const MODELS = [
  'vendor/tesseract/tesseract.min.js',
  'vendor/tesseract/worker.min.js',
  'vendor/tesseract/core/tesseract-core-lstm.wasm.js',
  'vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  'vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'vendor/tesseract/lang/eng.traineddata.gz',
  'vendor/tesseract/lang/guj.traineddata.gz',
];

const ALL = [...CORE, ...MODELS];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    await Promise.allSettled(MODELS.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('metro-fix-assist-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch {
        return (await cache.match('index.html')) || Response.error();
      }
    }
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  })());
});

self.addEventListener('message', async (event) => {
  if (event.data?.type !== 'status') return;
  const cache = await caches.open(CACHE);
  let missing = 0;
  for (const url of ALL) {
    if (!(await cache.match(url))) {
      missing++;
      cache.add(url).catch(() => {});
    }
  }
  event.source?.postMessage({ type: 'status', missing, total: ALL.length, version: VERSION });
});
