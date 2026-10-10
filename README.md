# Metro Fix Assist (મેટ્રો ફિક્સ આસિસ્ટ)

An offline troubleshooting assistant for metro maintenance staff. A technician
describes the fault (typed or spoken) or photographs it, and gets the matching
troubleshooting steps from a manual stored on the device, in **Gujarati or
English**. The steps can then be pinned in mid-air next to the equipment in
**WebXR augmented reality**, on a **Meta Quest 3** or a **phone**.

Everything runs on the device: search, photo text recognition (OCR), QR
reading, PDF parsing and the 3D view. There is no server and no cloud API, so
it works in underground sections and equipment rooms with no network.

## What it does

| Need from the problem statement | How the app does it |
|---|---|
| Works with no network | Installable PWA. A service worker caches the app, the manuals and every model (OCR engine with English and Gujarati data, PDF reader, 3D engine, Gujarati font) on first open. |
| Long PDF manuals | **Manuals › Import PDF** splits the PDF into sections (by font size and numbered headings) and steps (numbered or bulleted lines), with warnings pulled out as safety notes. Stored in IndexedDB on the device only. |
| Gujarati PDFs | Many Gujarati PDFs have a broken text layer (legacy fonts, or fonts without Unicode mapping). The importer finds those lines and OCRs just those lines from the rendered page. Fully scanned pages are OCR'd whole. |
| Describe the fault | Free text in English or Gujarati, or voice input. Search is BM25 with English and Gujarati stemming, a bilingual glossary (so `દરવાજો બંધ થતો નથી` also finds an English "door does not close" section), and a strong boost for fault codes (`E12`, `DCU-E12`, `E ૧૨`). |
| Photograph the fault | On-device OCR (Tesseract, `eng+guj`) reads fault-code displays and labels. QR **asset tags** on equipment are decoded (BarcodeDetector or jsQR) and identify the equipment type. |
| Gujarati or English | Full UI in both. Answers follow the language you ask in. Steps can be read aloud with the device's own voices. |
| AR, Quest 3 and phone | **Open in AR** starts a WebXR `immersive-ar` session. See below. |

## AR / WebXR

* **Meta Quest 3 (Meta Quest Browser):** passthrough AR. A step panel floats in
  front of you. Point a controller (or pinch with hand tracking) at a surface
  and pull the trigger to pin the panel there, with an orange marker on the
  faulty component. Use the panel's **Back / 🔊 / Next** buttons with the ray.
  Squeeze the grip to grab the panel and move it. The ray uses hit-testing
  against the room mesh where the browser supports it.
* **Android phones (Chrome with ARCore):** surface detection with a reticle.
  Tap to pin the panel and marker. A DOM overlay keeps large Back / Read /
  Recentre / Next buttons and the current step at the bottom of the screen.
* **Headsets without AR:** falls back to `immersive-vr` in a simple dark room.
* **iPhone / no WebXR:** Safari has no WebXR, so **Camera view** shows the
  live rear camera with the current step on top.

The 2D page, the AR panel and the camera view share one step state, so a step
ticked in AR is ticked on the page.

WebXR and the camera need a **secure context** (HTTPS, or `localhost`).

## Brake Control Unit: mixed reality guide (`brake.html`)

An interactive mixed reality experience for a Brake Control Unit fault (BCU-E51,
brake not released on bogie 2), linked from the Assist screen and from the brake procedure.

* **3D unit, built in code:** a BCU enclosure with a hinged cover, fault display and LEDs,
  RESET button, terminal block TB1, connectors X1/X2, EP valve manifold, pressure
  sensors PT1/PT2, a brake-cylinder gauge stuck at 3.6 bar, an isolation cock and the
  electronics module inside. No model files are needed, so it works offline.
* **See the problem:** the faulty unit glows red with corner brackets, a warning sign and a
  callout ("Brake Control Unit · Fault detected · E51"). Each step highlights the part to
  check in cyan, with its own label. Step 6 opens the cover to show the module.
* **Anchor it:** point and pinch (hands), pull the trigger (controllers) or tap (phone) on
  the real brake unit, the floor or a table. The model is held by a **WebXR anchor**. On
  Quest it is also saved as a persistent anchor, so it comes back in the same place next
  session. The ray falls back to the floor plane if no hit-test result is available.
* **Hand tracking:** poke the panel buttons with your index finger (hover at 5 cm, press
  when the fingertip crosses the panel), or pinch-ray from a distance. Pinch inside the
  model to grab and move it; it is re-anchored when you let go. Turn your left palm towards
  you for a wrist menu (Anchor / Cover / Read / Exit). Controllers work too: trigger
  selects, grip grabs.
* **Panels:** Overview (unit, carriage, location, Critical badge, fault, recommended
  actions), Steps (step x of 6, details, expected value, Back / Read aloud / Next), and
  Report (observation chips, Save report). The toolbar has Anchor, Cover, Size (1:1, 1:2,
  1:4) and EN/ગુ.
* **Without a headset:** the same page is a 3D viewer (drag to rotate, tap a part to jump to
  its step), with the guide and reports beside it. On Android the AR session adds a
  touch overlay.

## Run it

No build step. It is plain static files with all libraries vendored in `vendor/`.

### On GitHub Pages (simplest for Quest and phones)

1. In the repo: **Settings › Pages › Source: GitHub Actions**.
2. Push to `main` (or run the *Deploy to GitHub Pages* workflow).
3. Open `https://<user>.github.io/<repo>/` on the Quest 3 browser or the phone,
   once with a connection. When the badge shows **✓ Works offline**, it is
   ready. On a phone use **Add to Home screen**.

### Locally

```bash
npm start                  # http://localhost:8080
```

For a Quest or phone on the same Wi-Fi you need HTTPS:

```bash
npm run cert && npm start  # also https://<LAN-IP>:8443 (accept the certificate warning)
```

Or connect the device over USB and run `adb reverse tcp:8080 tcp:8080`, then open
`http://localhost:8080` on the device. `localhost` counts as secure, so WebXR works.

## Trying it on the train

1. Print `tags.html` (QR asset tags) and stick a tag on a door, escalator or panel.
2. Turn on flight mode.
3. **Photo** or **Live camera**, then point at the tag or at a fault-code display.
4. Open the procedure and tap **Open in AR**. Pin the steps next to the equipment and work through them.

The `samples/` folder has test images (`fault-display-door-dcu-e12.png`,
`escalator-tag-and-display.png`, `pump-panel-gujarati.png`) and a sample PDF
manual with English and Gujarati sections (`station-equipment-manual-sample.pdf`).

> The built-in manual (`data/sample-manual.json`, 13 procedures in English and
> Gujarati) is **demo content** for trying the app. It is not an official
> procedure. Import your organisation's own manuals and follow them.

## Project layout

```
index.html, css/app.css     UI shell (mobile-first, works in the Quest 2D browser)
sw.js, manifest.webmanifest offline caching + installable PWA
js/main.js                  app wiring: ask, results, procedure, manuals, camera view
js/search.js                BM25 + EN/GU stemming + bilingual glossary + fault-code boost
js/pdfimport.js             pdf.js text extraction, section/step parsing, OCR repair
js/vision.js                QR asset tags + Tesseract OCR
js/xr.js                    WebXR AR/VR session (three.js): step panel, hit-test, controllers
js/guide.js, js/card.js     shared step state + overlay card
js/speech.js                voice input / read aloud (platform engines)
brake.html, js/brake/       Brake Control Unit MR guide: model.js (procedural 3D unit + highlights),
                            mr.js (session, anchors, grab), hands.js (joints, pinch, poke, wrist menu),
                            ui3d.js + panels.js (3D panels), procedure.js (EN/GU steps + state)
js/i18n.js                  English + Gujarati strings
data/                       demo manual + QR tag definitions
vendor/                     three.js, pdf.js, tesseract.js (+ eng/guj data), jsQR, Noto Sans Gujarati
scripts/                    vendor copy, sample generation, end-to-end smoke test
```

## Development

```bash
npm install
npm run vendor                                   # refresh vendor/ after bumping a dependency
NODE_PATH=$(npm root -g) node scripts/make-samples.mjs   # regenerate icons/samples (needs Playwright)
NODE_PATH=$(npm root -g) npm test                # end-to-end smoke test (needs Playwright)
```

The smoke test runs headless Chromium. It covers English and Gujarati search,
the procedure stepper, the camera view, photo OCR (English and Gujarati), QR
tags, PDF import (including Gujarati line repair), an offline reload, and a full
**emulated Meta Quest 3 AR session** using Meta's IWER WebXR emulator:
controller-ray hover, trigger on the panel buttons, pinning, and exit. For the
brake MR guide it also places and anchors the unit with a controller, switches to
tracked hands, pokes panel buttons with the fingertip, and pinch-grabs and moves the
anchored model.

## Limits

* **Voice input** uses the platform speech engine. It only works offline where
  the OS has the offline language pack (Android: Settings › Google › Voice ›
  Offline speech recognition). Typing always works.
* **Read aloud** needs an installed voice for the language (Android ships `gu-IN`).
* PDF section detection is heuristic. Manuals with clear numbered headings and
  numbered steps give the best results.
* The first OCR run loads the model (a few seconds). After that it is fast.
* The OCR engine files total about 18 MB and are cached on first open.
