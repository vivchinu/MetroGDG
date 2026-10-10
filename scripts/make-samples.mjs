// Renders PNG icons, sample "fault display" photos for OCR testing and a
// sample PDF manual for import testing. Needs Playwright with Chromium:
//   NODE_PATH=$(npm root -g) node scripts/make-samples.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const font = (w) => `url(data:font/woff2;base64,${readFileSync(join(root, `vendor/fonts/noto-sans-gujarati-${w}.woff2`)).toString('base64')})`;
const fontCss = `
  @font-face { font-family: 'Noto Sans Gujarati'; font-weight: 400; src: ${font(400)}; unicode-range: U+0A80-0AFF; }
  @font-face { font-family: 'Noto Sans Gujarati'; font-weight: 700; src: ${font(700)}; unicode-range: U+0A80-0AFF; }`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage();
mkdirSync(join(root, 'samples'), { recursive: true });

// Icons
const svg = readFileSync(join(root, 'icons/icon.svg'), 'utf8');
for (const [size, name, pad] of [[192, 'icon-192.png', 0], [512, 'icon-512.png', 0], [512, 'icon-maskable-512.png', 64]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:#0b1220;display:grid;place-items:center;height:100vh">
    <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`);
  await page.screenshot({ path: join(root, 'icons', name) });
}

// Fault display photos
const qrSvg = readFileSync(join(root, 'samples/qr/ESC-07.svg'), 'utf8');
const shots = {
  'fault-display-door-dcu-e12.png': `
    <div style="background:#2b2f33;padding:40px;border-radius:24px;width:760px">
      <div style="color:#9aa3ab;font:600 26px sans-serif;margin-bottom:14px">DOOR CONTROL UNIT · CAR 3 DOOR 2</div>
      <div style="background:#9fd36b;color:#1d2a10;font:700 64px monospace;padding:26px 30px;border-radius:10px;letter-spacing:4px">
        FAULT DCU-E12<br><span style="font-size:42px">DOOR OBSTRUCTION</span></div>
    </div>`,
  'escalator-tag-and-display.png': `
    <div style="display:flex;gap:40px;align-items:center;background:#d9dde2;padding:40px;border-radius:24px">
      <div style="background:#fff;padding:18px;border-radius:12px;width:260px">${qrSvg}<div style="font:700 26px monospace;text-align:center">ESC-07</div></div>
      <div style="background:#111;color:#ff5a3c;font:700 56px monospace;padding:30px;border-radius:10px">ESC-E24<br><span style="font-size:36px">STEP SAG</span></div>
    </div>`,
  'pump-panel-gujarati.png': `
    <div style="background:#f3f1e8;padding:40px;border:6px solid #c0392b;border-radius:16px;width:760px;font-family:'Noto Sans Gujarati',sans-serif">
      <div style="font:700 52px 'Noto Sans Gujarati';color:#c0392b">ચેતવણી: પંપ ટ્રિપ</div>
      <div style="font:700 48px monospace;margin-top:16px">PMP-E71</div>
      <div style="font:400 36px 'Noto Sans Gujarati';margin-top:12px">સમ્પ પંપ ચાલુ થતો નથી</div>
    </div>`,
};
for (const [name, html] of Object.entries(shots)) {
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.setContent(`<style>${fontCss} body{margin:0;background:#56606b;display:grid;place-items:center;height:100vh}</style>${html}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, 'samples', name) });
}

// Sample PDF manual (English, with numbered steps and warnings)
await page.setContent(`<style>${fontCss}
  body { font: 11pt/1.45 'Noto Sans Gujarati', Arial, sans-serif; margin: 0; }
  h1 { font-size: 22pt; } h2 { font-size: 15pt; margin-top: 26pt; } p.warn { font-weight: 700; }
  ol { padding-left: 22pt; } li { margin: 3pt 0; }</style>
  <h1>Station Equipment Maintenance Manual</h1>
  <p>Sample document for testing PDF import in Metro Fix Assist. Not an official procedure.</p>
  <h2>3.1 Ventilation Damper Fails to Open</h2>
  <p>Symptoms: damper position alarm on the BMS, airflow low in the concourse, damper actuator humming. Fault code VDM-E14.</p>
  <p class="warn">WARNING: Isolate the actuator supply before touching the damper blades.</p>
  <ol>
    <li>Read the alarm and damper number on the BMS screen.</li>
    <li>Check the actuator supply fuse in the local control panel.</li>
    <li>Operate the manual override lever and check the blades move freely.</li>
    <li>Clean debris from the blade linkage and lubricate the pivot points.</li>
    <li>Restore supply, command OPEN from the BMS and confirm the end-switch indication.</li>
  </ol>
  <h2>3.2 Smoke Extract Fan Fails to Start</h2>
  <p>Symptoms: fan does not start on test, fire mode command not acknowledged, motor contactor not pulling in. Fault code SEF-E62.</p>
  <p class="warn">CAUTION: Smoke extract fans are life-safety equipment. Inform the station controller before testing.</p>
  <ol>
    <li>Check the fan isolator is ON and not locked out.</li>
    <li>Check the control voltage (230 V AC) at the starter panel.</li>
    <li>Reset the motor protection relay and attempt a local start.</li>
    <li>If the contactor does not pull in, check the fire alarm interface relay.</li>
    <li>Record the result in the life-safety test log.</li>
  </ol>
  <h2>3.3 Platform Lighting Flickering</h2>
  <p>Symptoms: LED fittings flicker or go dark along the platform edge, emergency lights on battery.</p>
  <ol>
    <li>Identify the affected lighting circuit from the distribution board schedule.</li>
    <li>Check the MCB and the RCD for the circuit and reset if tripped.</li>
    <li>Measure the supply voltage at the first fitting of the circuit.</li>
    <li>Replace failed LED drivers and log the fitting numbers.</li>
  </ol>
  <h2>3.4 ભૂગર્ભ સ્ટેશનમાં પાણી લીકેજ</h2>
  <p>લક્ષણો: છત અથવા દીવાલમાંથી પાણી ટપકે છે, પ્લેટફોર્મ પર પાણી ભરાય છે.</p>
  <ol>
    <li>વિસ્તારને બેરિકેડ કરો અને લપસણી સપાટીની ચેતવણી લગાવો.</li>
    <li>પાણીનો સ્રોત શોધો અને નજીકનાં ઇલેક્ટ્રિકલ સાધનો આઇસોલેટ કરો.</li>
    <li>સમ્પ પંપ ચાલુ છે તે તપાસો અને સ્ટેશન કંટ્રોલરને જાણ કરો.</li>
  </ol>`);
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: join(root, 'samples/station-equipment-manual-sample.pdf'), format: 'A4', margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' } });

await browser.close();
console.log('samples generated');
