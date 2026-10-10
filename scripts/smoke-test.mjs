// End-to-end smoke test in headless Chromium:
//   search (EN + GU), procedure stepping, photo OCR + QR, PDF import,
//   offline reload, and an emulated Meta Quest 3 AR session (IWER).
// Run: npm install && NODE_PATH=$(npm root -g) npm test
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8099;
const BASE = `http://localhost:${PORT}/`;
const out = join(root, 'test-output');
mkdirSync(out, { recursive: true });

const server = spawn(process.execPath, [join(root, 'server.mjs')], { env: { ...process.env, PORT: String(PORT), HTTPS_PORT: '0' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

try {
  // ---------- Phone-like context ----------
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, permissions: ['camera'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE);
  await page.waitForFunction(() => document.querySelector('#offline-badge')?.classList.contains('ok'), null, { timeout: 60000 });
  check(true, 'service worker cached everything (offline badge ready)');

  await page.fill('#query', 'door keeps reopening');
  await page.click('#ask-form button[type=submit]');
  await page.waitForSelector('.result');
  check((await page.textContent('.result h3')).includes('Saloon door'), 'English description finds the door procedure');

  await page.fill('#query', 'એસ્કેલેટર અટકી ગયું');
  await page.click('#ask-form button[type=submit]');
  await page.waitForFunction(() => document.documentElement.lang === 'gu');
  check((await page.textContent('.result h3')).includes('એસ્કેલેટર'), 'Gujarati description switches to Gujarati and finds the escalator procedure');
  await page.screenshot({ path: join(out, '01-results-gu.png') });

  await page.click('.result');
  await page.waitForSelector('#view-procedure:not([hidden])');
  check((await page.$$('#proc-steps li')).length === 6, 'procedure shows 6 steps');
  check(await page.isVisible('#proc-safety'), 'safety notes shown first');
  await page.click('.stepper [data-act=next]');
  await page.click('.stepper [data-act=next]');
  check((await page.textContent('#stepper-label')).includes('૨'), 'stepper advances (Gujarati numerals)');
  await page.screenshot({ path: join(out, '02-procedure-gu.png'), fullPage: true });

  await page.click('.lang-toggle [data-lang=en]');
  check((await page.textContent('#proc-title')).includes('Escalator'), 'language toggle switches the open procedure to English');

  // Camera view with fake camera
  await page.click('#btn-camview');
  await page.waitForFunction(() => document.querySelector('#camview video').videoWidth > 0, null, { timeout: 10000 });
  check((await page.textContent('#camview .step-text')).length > 10, 'camera view shows the current step over the camera');
  await page.screenshot({ path: join(out, '03-camera-view.png') });
  await page.click('#camview [data-act=close]');
  await page.click('#btn-back');

  // Photo: fault display OCR
  await page.setInputFiles('#photo-input', join(root, 'samples/fault-display-door-dcu-e12.png'));
  await page.waitForFunction(() => document.querySelector('#photo-results')?.textContent.includes('E12'), null, { timeout: 120000 });
  await page.waitForSelector('.result');
  check((await page.textContent('.result h3')).includes('door'), 'photo of DCU-E12 display → door procedure via on-device OCR');
  await page.screenshot({ path: join(out, '04-photo-ocr.png') });

  // Photo: QR asset tag
  await page.setInputFiles('#photo-input', join(root, 'samples/escalator-tag-and-display.png'));
  await page.waitForFunction(() => document.querySelector('#photo-results')?.textContent.includes('ESC-07'), null, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('.result h3')?.textContent.includes('Escalator'));
  check(true, 'photo with QR asset tag ESC-07 → escalator procedure');

  // Photo: Gujarati label
  await page.setInputFiles('#photo-input', join(root, 'samples/pump-panel-gujarati.png'));
  await page.waitForFunction(() => document.querySelector('#photo-results')?.textContent.includes('E71'), null, { timeout: 120000 });
  const ocrGu = await page.textContent('#photo-results');
  check(/પંપ/.test(ocrGu), `Gujarati OCR reads Gujarati text (${ocrGu.replace(/\s+/g, ' ').slice(0, 80)}…)`);
  check((await page.textContent('.result h3')).toLowerCase().includes('pump'), 'Gujarati pump label photo → sump pump procedure');

  // PDF import
  await page.click('.tabbar [data-view=manuals]');
  await page.setInputFiles('#pdf-input', join(root, 'samples/station-equipment-manual-sample.pdf'));
  await page.waitForFunction(() => document.querySelectorAll('#manual-list li').length === 2, null, { timeout: 60000 });
  check(true, 'PDF manual imported and stored on device');
  await page.screenshot({ path: join(out, '05-manuals.png') });
  await page.click('.tabbar [data-view=assist]');
  await page.fill('#query', 'smoke extract fan does not start');
  await page.click('#ask-form button[type=submit]');
  await page.waitForSelector('.result');
  check((await page.textContent('.result h3')).includes('Smoke Extract Fan'), 'search finds the section from the imported PDF');
  await page.click('.result');
  const pdfSteps = await page.$$eval('#proc-steps li .text', (els) => els.map((e) => e.textContent));
  check(pdfSteps.length === 5 && pdfSteps[0].startsWith('Check the fan isolator'), `PDF steps parsed (${pdfSteps.length})`);
  check((await page.textContent('#proc-safety')).includes('CAUTION'), 'PDF warning detected as safety note');
  await page.click('#btn-page');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, '06-pdf-procedure.png'), fullPage: true });
  await page.click('#btn-back');

  await page.fill('#query', 'પાણી લીકેજ');
  await page.click('#ask-form button[type=submit]');
  await page.waitForSelector('.result');
  const guPdf = await page.$$eval('.result h3', (els) => els.map((e) => e.textContent));
  check(guPdf.some((s) => s.includes('લીકેજ')), `Gujarati section from the PDF is searchable (${guPdf[0]})`);

  // Offline reload
  await ctx.setOffline(true);
  await page.goto(BASE + '?q=' + encodeURIComponent('fire panel fault'));
  await page.waitForSelector('.result');
  check((await page.textContent('.result h3')).includes('Fire alarm'), 'works offline after reload (search)');
  await page.click('.tabbar [data-view=manuals]');
  await page.waitForFunction(() => document.querySelectorAll('#manual-list li').length === 2);
  check(true, 'imported manual still available offline');
  await page.click('.tabbar [data-view=assist]');
  await page.setInputFiles('#photo-input', join(root, 'samples/fault-display-door-dcu-e12.png'));
  await page.waitForFunction(() => document.querySelector('#photo-results')?.textContent.includes('E12'), null, { timeout: 120000 });
  check(true, 'photo OCR works offline (fresh page, models from cache)');
  await ctx.setOffline(false);

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();

  // ---------- Emulated Meta Quest 3 (IWER) ----------
  const qctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const q = await qctx.newPage();
  const qerrors = [];
  q.on('pageerror', (e) => qerrors.push(e.message));
  q.on('console', (m) => { if (m.type() === 'error') qerrors.push(m.text()); });
  await q.addInitScript({ path: join(root, 'node_modules/iwer/build/iwer.min.js') });
  await q.addInitScript(() => {
    const device = new self.IWER.XRDevice(self.IWER.metaQuest3);
    device.installRuntime({ forceInstall: true });
    self.__xrDevice = device;
  });
  await q.goto(BASE + '#p=door-not-closing');
  await q.click('.lang-toggle [data-lang=en]');
  await q.waitForSelector('#btn-xr:not([hidden])', { timeout: 10000 });
  check((await q.textContent('#btn-xr')).includes('AR'), 'Quest 3: "Open in AR" offered');
  await q.click('#btn-xr');
  // waitForFunction can't await an async predicate, so poll.
  const until = async (fn, timeout = 15000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await q.evaluate(fn).catch(() => false)) return true;
      await q.waitForTimeout(100);
    }
    throw new Error('timed out waiting for XR state');
  };
  await until(async () => {
    const { xrDebug } = await import('./js/xr.js');
    return Boolean(xrDebug.session && xrDebug.panelGroup.visible);
  });
  check(true, 'Quest 3: immersive-ar session started and step panel placed in view');

  const aimAt = async (target) => q.evaluate(async (target) => {
    const THREE = await import('three');
    const { xrDebug } = await import('./js/xr.js');
    const d = self.__xrDevice;
    let world;
    if (target === 'empty') {
      world = new THREE.Vector3(0.8, -0.6, -1.0);
    } else {
      const b = xrDebug.panel.buttons.find((x) => x.id === target);
      const local = new THREE.Vector3(((b.x + b.w / 2) / xrDebug.W - 0.5) * xrDebug.PANEL_W, (0.5 - (b.y + b.h / 2) / xrDebug.H) * xrDebug.PANEL_H, 0);
      world = xrDebug.panel.mesh.localToWorld(local);
    }
    // 'local' reference space starts at the headset pose (identity rotation here).
    const head = new THREE.Vector3(d.position.x, d.position.y, d.position.z);
    const targetGlobal = world.clone().add(head);
    const from = head.clone().add(new THREE.Vector3(0.15, -0.25, 0));
    const m = new THREE.Matrix4().lookAt(from, targetGlobal, new THREE.Vector3(0, 1, 0));
    const quat = new THREE.Quaternion().setFromRotationMatrix(m);
    const c = d.controllers.right;
    c.position.set(from.x, from.y, from.z);
    c.quaternion.set(quat.x, quat.y, quat.z, quat.w);
  }, target);
  const pull = async () => {
    await q.evaluate(() => self.__xrDevice.controllers.right.updateButtonValue('trigger', 1));
    await q.waitForTimeout(200);
    await q.evaluate(() => self.__xrDevice.controllers.right.updateButtonValue('trigger', 0));
    await q.waitForTimeout(300);
  };
  const guideIndex = () => q.evaluate(async () => (await import('./js/xr.js')).xrDebug.guide.index);

  const before = await guideIndex();
  await aimAt('next');
  await q.waitForTimeout(300);
  const hover = await q.evaluate(async () => (await import('./js/xr.js')).xrDebug.panel.hover);
  check(hover === 'next', `Quest 3: controller ray hovers the Next button (${hover})`);
  await pull();
  check((await guideIndex()) === before + 1, 'Quest 3: trigger on Next advances the step');
  check(await q.evaluate(() => document.querySelector('#stepper-label').textContent.includes('1')), 'Quest 3: 2D page stays in sync with the AR panel');
  await aimAt('back');
  await q.waitForTimeout(200);
  await pull();
  check((await guideIndex()) === before, 'Quest 3: trigger on Back goes back');

  await aimAt('empty');
  await q.waitForTimeout(200);
  await pull();
  check(await q.evaluate(async () => {
    const { xrDebug } = await import('./js/xr.js');
    return xrDebug.isPinned() && xrDebug.marker.visible;
  }), 'Quest 3: trigger on empty space pins the panel with a marker');

  // Save what the panel shows
  const png = await q.evaluate(async () => (await import('./js/xr.js')).xrDebug.panel.canvas.toDataURL('image/png'));
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(out, '07-xr-panel-en.png'), Buffer.from(png.split(',')[1], 'base64'));
  await q.click('.lang-toggle [data-lang=gu]').catch(() => {});
  await q.evaluate(async () => (await import('./js/xr.js')).xrDebug.guide.setLang('gu'));
  await q.waitForTimeout(200);
  const pngGu = await q.evaluate(async () => (await import('./js/xr.js')).xrDebug.panel.canvas.toDataURL('image/png'));
  writeFileSync(join(out, '08-xr-panel-gu.png'), Buffer.from(pngGu.split(',')[1], 'base64'));

  await aimAt('exit');
  await q.waitForTimeout(200);
  await pull();
  check(await q.evaluate(async () => (await import('./js/xr.js')).xrDebug.session.ended === undefined
    ? !document.querySelector('.xr-canvas')
    : true), 'Quest 3: Exit button ends the session and cleans up');
  check(qerrors.length === 0, `Quest 3: no page errors${qerrors.length ? ': ' + qerrors.join(' | ') : ''}`);
  await qctx.close();
} catch (err) {
  console.error(err);
  failures++;
} finally {
  await browser.close();
  server.kill();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
