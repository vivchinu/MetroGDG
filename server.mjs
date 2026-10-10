// Zero-dependency static server for local testing.
//   npm start                 -> http://localhost:8080
//   npm run cert && npm start -> also https://<your-LAN-IP>:8443 (needed for
//                                WebXR/camera when opening from a Quest or phone
//                                on the same Wi-Fi; accept the certificate warning)
// Alternatively connect the device by USB and run `adb reverse tcp:8080 tcp:8080`,
// then open http://localhost:8080 on the device (localhost counts as secure).
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { existsSync, readFileSync, statSync, createReadStream } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 8443);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.gz': 'application/octet-stream',
  '.pdf': 'application/pdf',
};

function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (path.includes('..') || path.startsWith('node_modules')) { res.writeHead(403).end(); return; }
  let file = join(root, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(file).pipe(res);
}

const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
createHttp(handler).listen(PORT, () => console.log(`HTTP   http://localhost:${PORT}`));
const key = join(root, 'cert/key.pem');
const cert = join(root, 'cert/cert.pem');
if (existsSync(key) && existsSync(cert)) {
  createHttps({ key: readFileSync(key), cert: readFileSync(cert) }, handler).listen(HTTPS_PORT, () => {
    for (const ip of ['localhost', ...ips]) console.log(`HTTPS  https://${ip}:${HTTPS_PORT}`);
  });
} else {
  console.log('No cert/ found: run `npm run cert` to also serve HTTPS for phones/Quest on your LAN.');
}
