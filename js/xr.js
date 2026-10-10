// Immersive WebXR view: the current troubleshooting step on a floating panel
// that the technician pins next to the faulty equipment.
//  - Meta Quest 3 (Meta Quest Browser): immersive-ar with passthrough,
//    controllers or hand pinch, hit-test against the room mesh when available,
//    squeeze (grip) to grab and move the panel.
//  - Android phones (Chrome + ARCore): immersive-ar with hit-test reticle and
//    a DOM overlay holding big touch buttons.
//  - Headsets without AR: immersive-vr with a simple dark room.

import * as THREE from 'three';
import { tl, toGuDigits } from './i18n.js';
import { speak, stopSpeaking } from './speech.js';
import { fillStepCard } from './card.js';

export async function xrSupport() {
  if (!navigator.xr || !window.isSecureContext) return { ar: false, vr: false };
  const check = (mode) => navigator.xr.isSessionSupported(mode).catch(() => false);
  const [ar, vr] = await Promise.all([check('immersive-ar'), check('immersive-vr')]);
  return { ar, vr };
}

const FONT = '"Noto Sans Gujarati", "Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const W = 1024;
const H = 1280;
const PANEL_W = 0.46;
const PANEL_H = (PANEL_W * H) / W;
const UP = new THREE.Vector3(0, 1, 0);

const COLORS = {
  bg: 'rgba(11, 18, 32, 0.94)',
  border: '#38bdf8',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#38bdf8',
  done: '#22c55e',
  track: '#334155',
  warnBg: 'rgba(245, 158, 11, 0.16)',
  warn: '#fbbf24',
  btn: '#1e293b',
  btnHover: '#334155',
  primary: '#0284c7',
  primaryHover: '#0ea5e9',
};

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  const pushLong = (word) => {
    // Break very long words (or unspaced runs) by grapheme.
    const seg = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)].map((s) => s.segment)
      : [...word];
    let part = '';
    for (const g of seg) {
      if (ctx.measureText(part + g).width > maxWidth && part) { lines.push(part); part = g; } else part += g;
    }
    return part;
  };
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width <= maxWidth) { line = test; continue; }
    if (line) lines.push(line);
    line = ctx.measureText(word).width > maxWidth ? pushLong(word) : word;
  }
  if (line) lines.push(line);
  return lines;
}

function fitText(ctx, text, maxWidth, maxHeight, maxSize, minSize, weight = 500) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    const lines = wrapText(ctx, text, maxWidth);
    if (lines.length * size * 1.35 <= maxHeight) return { lines, size };
  }
  ctx.font = `${weight} ${minSize}px ${FONT}`;
  const lines = wrapText(ctx, text, maxWidth);
  const max = Math.floor(maxHeight / (minSize * 1.35));
  return { lines: lines.length > max ? [...lines.slice(0, max - 1), lines[max - 1] + ' …'] : lines, size: minSize };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

class StepPanel {
  constructor(renderer) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(PANEL_W, PANEL_H),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false }),
    );
    this.buttons = [];
    this.hover = null;
  }

  setHover(id) {
    if (id === this.hover) return;
    this.hover = id;
    this.draw(this.guide, this.opts);
  }

  buttonAt(uv) {
    const x = uv.x * W;
    const y = (1 - uv.y) * H;
    return this.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id || null;
  }

  button(id, x, y, w, h, label, primary = false) {
    const { ctx } = this;
    this.buttons.push({ id, x, y, w, h });
    const hover = this.hover === id;
    ctx.fillStyle = primary ? (hover ? COLORS.primaryHover : COLORS.primary) : (hover ? COLORS.btnHover : COLORS.btn);
    roundRect(ctx, x, y, w, h, 28);
    ctx.fill();
    if (hover) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = COLORS.accent;
      ctx.stroke();
    }
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 ${h > 100 ? 44 : 40}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 2, w - 20);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  draw(guide, opts = {}) {
    this.guide = guide;
    this.opts = opts;
    const { ctx } = this;
    const c = guide.content;
    const lang = guide.lang;
    const pad = 56;
    this.buttons = [];
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = COLORS.bg;
    roundRect(ctx, 8, 8, W - 16, H - 16, 48);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = COLORS.border;
    ctx.stroke();

    this.button('exit', W - 150, 32, 112, 96, '✕');

    let y = 78;
    ctx.fillStyle = COLORS.accent;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(c.equipment || guide.procedure.manualName || '', pad, y, W - 240);
    y += 14;
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 42px ${FONT}`;
    for (const line of wrapText(ctx, c.title, W - 240).slice(0, 2)) {
      y += 54;
      ctx.fillText(line, pad, y);
    }

    // Progress segments
    y += 34;
    const total = guide.total;
    const segW = (W - pad * 2 - (total - 1) * 8) / Math.max(1, total);
    for (let i = 0; i < total; i++) {
      ctx.fillStyle = guide.done.has(i) ? COLORS.done : i === guide.index ? COLORS.accent : COLORS.track;
      roundRect(ctx, pad + i * (segW + 8), y, segW, 14, 7);
      ctx.fill();
    }
    y += 70;

    const bodyTop = y;
    const bodyBottom = H - 230;
    ctx.font = `700 34px ${FONT}`;
    if (guide.index < 0) {
      ctx.fillStyle = COLORS.warn;
      ctx.fillText('⚠ ' + tl(lang, 'safety'), pad, y);
      const boxTop = y + 26;
      ctx.fillStyle = COLORS.warnBg;
      roundRect(ctx, pad - 16, boxTop, W - pad * 2 + 32, bodyBottom - boxTop, 24);
      ctx.fill();
      // One bullet paragraph per safety note, shrinking the font until all fit.
      const maxW = W - pad * 2 - 40;
      const maxH = bodyBottom - boxTop - 40;
      let size = 44;
      let blocks;
      for (; size >= 24; size -= 2) {
        ctx.font = `500 ${size}px ${FONT}`;
        blocks = c.safety.map((s) => wrapText(ctx, s, maxW));
        const height = blocks.reduce((h, b) => h + b.length * size * 1.35, 0) + (blocks.length - 1) * size * 0.6;
        if (height <= maxH) break;
      }
      let ty = boxTop + 20;
      for (const lines of blocks) {
        lines.forEach((line, i) => {
          ty += size * 1.35;
          ctx.fillStyle = COLORS.warn;
          if (i === 0) ctx.fillText('•', pad + 2, ty - size * 0.3);
          ctx.fillStyle = COLORS.text;
          ctx.fillText(line, pad + 34, ty - size * 0.3);
        });
        ty += size * 0.6;
      }
    } else if (guide.index >= total) {
      ctx.fillStyle = COLORS.done;
      ctx.font = `700 160px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('✓', W / 2, bodyTop + 200);
      ctx.font = `700 52px ${FONT}`;
      ctx.fillStyle = COLORS.text;
      ctx.fillText(tl(lang, 'finish'), W / 2, bodyTop + 300);
      ctx.font = `500 36px ${FONT}`;
      ctx.fillStyle = COLORS.muted;
      const n = lang === 'gu' ? `${toGuDigits(guide.done.size)} / ${toGuDigits(total)}` : `${guide.done.size} / ${total}`;
      ctx.fillText(n, W / 2, bodyTop + 360);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = guide.done.has(guide.index) ? COLORS.done : COLORS.accent;
      ctx.fillText((guide.done.has(guide.index) ? '✓ ' : '') + tl(lang, 'stepOf', guide.index + 1, total), pad, y);
      const nextStep = c.steps[guide.index + 1];
      const reserve = nextStep ? 110 : 0;
      const { lines, size } = fitText(ctx, c.steps[guide.index], W - pad * 2, bodyBottom - y - 30 - reserve, 56, 30, 500);
      ctx.fillStyle = COLORS.text;
      let ty = y + 24;
      for (const line of lines) {
        ty += size * 1.35;
        ctx.fillText(line, pad, ty - size * 0.25);
      }
      if (nextStep) {
        ctx.font = `500 28px ${FONT}`;
        ctx.fillStyle = COLORS.muted;
        const preview = wrapText(ctx, `${tl(lang, 'next')}: ${nextStep}`, W - pad * 2);
        ctx.fillText(preview[0] + (preview.length > 1 ? ' …' : ''), pad, bodyBottom - 20);
      }
    }

    if (opts.hint) {
      ctx.font = `500 26px ${FONT}`;
      ctx.fillStyle = COLORS.muted;
      const hint = wrapText(ctx, opts.hint, W - pad * 2).slice(0, 2);
      hint.forEach((line, i) => ctx.fillText(line, pad, H - 192 + i * 32 - (hint.length - 1) * 32));
    }

    const by = H - 160;
    const atEnd = guide.index >= total;
    this.button('back', pad - 16, by, 260, 124, '◀ ' + tl(lang, 'prev'));
    this.button('speak', pad + 264, by, 160, 124, '🔊');
    const nextLabel = atEnd ? '↺' : guide.index === total - 1 ? '✓ ' + tl(lang, 'done') : tl(lang, 'next') + ' ▶';
    this.button('next', pad + 444, by, W - pad * 2 - 428, 124, nextLabel, true);

    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

function makeMarker() {
  const group = new THREE.Group();
  const pin = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.025, 0.07, 24).rotateX(Math.PI).translate(0, 0.035, 0),
    new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x7c2d12, roughness: 0.4 }),
  );
  pin.add(cone);
  group.add(pin);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.035, 0.05, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.position.y = 0.002;
  group.add(ring);
  group.userData = { pin, ring };
  return group;
}

function makeReticle() {
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.065, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }),
  );
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.01, 16).rotateX(-Math.PI / 2), reticle.material);
  reticle.add(dot);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  return reticle;
}

function addVrRoom(scene) {
  scene.background = new THREE.Color(0x0b1220);
  const grid = new THREE.GridHelper(20, 40, 0x38bdf8, 0x1e293b);
  grid.position.y = -1.6;
  scene.add(grid);
}

function poseFromMatrix(m) {
  const position = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  m.decompose(position, quat, new THREE.Vector3());
  return { position, normal: UP.clone().applyQuaternion(quat) };
}

// Live handles into the running session, read by the automated smoke test.
export const xrDebug = {};

const isHeadsetUA = () => /OculusBrowser|Quest|Pico|Wolvic|VR/i.test(navigator.userAgent);

/**
 * Start an immersive session showing `guide`.
 * @param {{guide: import('./guide.js').Guide, mode: 'immersive-ar'|'immersive-vr', overlay?: HTMLElement, onEnd?: Function}} opts
 */
export async function startXR({ guide, mode, overlay, onEnd }) {
  const init = { optionalFeatures: ['local-floor', 'hand-tracking'] };
  if (mode === 'immersive-ar') {
    init.optionalFeatures.push('hit-test');
    if (overlay && !isHeadsetUA()) {
      init.optionalFeatures.push('dom-overlay');
      init.domOverlay = { root: overlay };
    }
  }
  // Request the session first, directly in the click handler's turn, so the
  // user-activation requirement is met on every browser.
  const session = await navigator.xr.requestSession(mode, init);
  await document.fonts?.load(`700 40px "Noto Sans Gujarati"`, 'ગુજરાતી').catch(() => {});

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  renderer.domElement.className = 'xr-canvas';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.5));
  if (mode === 'immersive-vr') addVrRoom(scene);

  await renderer.xr.setSession(session);
  const handheld = Boolean(session.domOverlayState) || (!isHeadsetUA() && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));
  const hintKey = handheld ? 'xrHintPhone' : 'xrHintQuest';

  const panel = new StepPanel(renderer);
  const panelGroup = new THREE.Group();
  panelGroup.add(panel.mesh);
  // Hidden until placed: in front of the headset after the first frames, or
  // where the phone user taps.
  panelGroup.visible = false;
  scene.add(panelGroup);

  const marker = makeMarker();
  marker.visible = false;
  scene.add(marker);

  const leader = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: 0xf97316, dashSize: 0.02, gapSize: 0.012 }),
  );
  leader.visible = false;
  leader.frustumCulled = false;
  scene.add(leader);

  let pinned = false;
  let grabbedBy = null;
  let initialised = false;
  let frameCount = 0;

  const redraw = () => panel.draw(guide, { hint: pinned ? '' : tl(guide.lang, hintKey) });
  const onChange = () => {
    redraw();
    if (overlay) fillStepCard(overlay, guide);
  };
  guide.addEventListener('change', onChange);
  redraw();

  // ----- DOM overlay (phones) -----
  const overlayClicks = (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act) { e.preventDefault(); action(act); }
  };
  const blockSelect = (e) => {
    if (e.target.closest('button, .step-card')) e.preventDefault();
  };
  if (overlay) {
    overlay.hidden = false;
    overlay.querySelector('.xr-hint').textContent = tl(guide.lang, hintKey);
    fillStepCard(overlay, guide);
    overlay.addEventListener('click', overlayClicks);
    overlay.addEventListener('beforexrselect', blockSelect);
  }

  // ----- Hit testing -----
  let viewerHitSource = null;
  let viewerHit = null;
  const viewerReticle = makeReticle();
  scene.add(viewerReticle);
  if (handheld && mode === 'immersive-ar' && session.requestHitTestSource) {
    try {
      const viewerSpace = await session.requestReferenceSpace('viewer');
      viewerHitSource = await session.requestHitTestSource({ space: viewerSpace });
    } catch (err) { console.info('hit-test unavailable', err); }
  }
  const sourceHits = new Map(); // XRInputSource -> { source, reticle, matrix }
  const addHitSource = (src) => {
    if (mode !== 'immersive-ar' || src.targetRayMode !== 'tracked-pointer' || !session.requestHitTestSource || sourceHits.has(src)) return;
    const reticle = makeReticle();
    scene.add(reticle);
    const entry = { source: null, reticle, matrix: null };
    sourceHits.set(src, entry);
    session.requestHitTestSource({ space: src.targetRaySpace })
      .then((h) => { entry.source = h; })
      .catch(() => {});
  };
  session.addEventListener('inputsourceschange', (e) => {
    e.added.forEach(addHitSource);
    for (const src of e.removed) {
      const entry = sourceHits.get(src);
      entry?.source?.cancel();
      if (entry) scene.remove(entry.reticle);
      sourceHits.delete(src);
    }
  });
  [...session.inputSources].forEach(addHitSource);

  // ----- Controllers / hands / screen taps -----
  const raycaster = new THREE.Raycaster();
  const rot = new THREE.Matrix4();
  const setRay = (ctrl) => {
    ctrl.updateMatrixWorld(true);
    rot.identity().extractRotation(ctrl.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rot);
  };
  const panelHit = (ctrl) => {
    if (!panelGroup.visible) return null;
    setRay(ctrl);
    return raycaster.intersectObject(panel.mesh, false)[0] || null;
  };

  const controllers = [0, 1].map((i) => {
    const ctrl = renderer.xr.getController(i);
    const ray = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
      new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.8 }),
    );
    ray.visible = false;
    ctrl.add(ray);
    ctrl.userData = { ray, source: null };
    ctrl.addEventListener('connected', (e) => {
      ctrl.userData.source = e.data;
      ray.visible = e.data.targetRayMode === 'tracked-pointer';
    });
    ctrl.addEventListener('disconnected', () => {
      ctrl.userData.source = null;
      ray.visible = false;
    });
    ctrl.addEventListener('select', () => onSelect(ctrl));
    ctrl.addEventListener('squeezestart', () => {
      if (grabbedBy || !panelGroup.visible) return;
      grabbedBy = ctrl;
      ctrl.attach(panelGroup);
    });
    ctrl.addEventListener('squeezeend', () => {
      if (grabbedBy !== ctrl) return;
      scene.attach(panelGroup);
      grabbedBy = null;
      pinned = true;
      redraw();
    });
    scene.add(ctrl);
    return ctrl;
  });

  function pulse(ctrl) {
    try { ctrl.userData.source?.gamepad?.hapticActuators?.[0]?.pulse(0.35, 30); } catch {}
  }

  function cameraPosition() {
    return renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());
  }

  function faceViewer() {
    const cam = cameraPosition();
    panelGroup.lookAt(cam.x, panelGroup.position.y, cam.z);
  }

  function placeInFront(distance = 0.9) {
    const xrCam = renderer.xr.getCamera();
    const pos = xrCam.getWorldPosition(new THREE.Vector3());
    const dir = xrCam.getWorldDirection(new THREE.Vector3());
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    panelGroup.position.copy(pos).addScaledVector(dir, distance);
    panelGroup.position.y = pos.y - 0.12;
    faceViewer();
    panelGroup.visible = true;
  }

  function placeAt({ position, normal }) {
    marker.position.copy(position);
    marker.quaternion.setFromUnitVectors(UP, normal.clone().normalize());
    marker.visible = true;
    const offset = normal.y > 0.6
      ? new THREE.Vector3(0, PANEL_H / 2 + 0.14, 0)
      : normal.clone().multiplyScalar(0.12).add(new THREE.Vector3(0, PANEL_H / 2 + 0.1, 0));
    panelGroup.position.copy(position).add(offset);
    faceViewer();
    panelGroup.visible = true;
    pinned = true;
    redraw();
  }

  function fallbackPose(ctrl) {
    setRay(ctrl);
    const dist = ctrl.userData.source?.targetRayMode === 'screen' ? 0.8 : 1.0;
    const position = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, dist);
    return { position, normal: raycaster.ray.direction.clone().negate() };
  }

  function onSelect(ctrl) {
    const hit = panelHit(ctrl);
    if (hit) {
      const id = panel.buttonAt(hit.uv);
      if (id) { pulse(ctrl); action(id); }
      return;
    }
    const src = ctrl.userData.source;
    let pose = null;
    if (src?.targetRayMode === 'screen') pose = viewerHit;
    else if (src && sourceHits.get(src)?.matrix) pose = poseFromMatrix(sourceHits.get(src).matrix);
    pulse(ctrl);
    placeAt(pose || fallbackPose(ctrl));
  }

  function action(id) {
    switch (id) {
      case 'exit': session.end(); break;
      case 'back': guide.prev(); break;
      case 'next': if (guide.index >= guide.total) guide.restart(); else guide.next(); break;
      case 'speak': speak(guide.speechText(), guide.lang); break;
      case 'recenter': placeInFront(0.7); break;
      default: break;
    }
  }

  Object.assign(xrDebug, {
    session, panel, panelGroup, marker, guide, controllers, W, H, PANEL_W, PANEL_H,
    isPinned: () => pinned,
  });

  // ----- Render loop -----
  const tmp = new THREE.Matrix4();
  renderer.setAnimationLoop((time, frame) => {
    if (!frame) return;
    const ref = renderer.xr.getReferenceSpace();
    // Wait a few frames so the XR camera carries a real head pose.
    if (!initialised && frame.getViewerPose(ref) && ++frameCount > 3) {
      initialised = true;
      if (!handheld) placeInFront(0.9);
    }

    if (viewerHitSource) {
      const r = frame.getHitTestResults(viewerHitSource)[0];
      const pose = r?.getPose(ref);
      viewerReticle.visible = Boolean(pose);
      if (pose) {
        viewerReticle.matrix.fromArray(pose.transform.matrix);
        viewerHit = poseFromMatrix(viewerReticle.matrix);
      } else viewerHit = null;
    }

    let hovered = null;
    for (const ctrl of controllers) {
      const src = ctrl.userData.source;
      if (!src || src.targetRayMode !== 'tracked-pointer') continue;
      setRay(ctrl);
      const hit = panelHit(ctrl);
      const entry = sourceHits.get(src);
      let rayLength = 2;
      if (hit) {
        rayLength = hit.distance;
        hovered = panel.buttonAt(hit.uv) || hovered;
        if (entry) entry.reticle.visible = false;
      } else if (entry?.source) {
        const pose = frame.getHitTestResults(entry.source)[0]?.getPose(ref);
        entry.reticle.visible = Boolean(pose);
        entry.matrix = pose ? tmp.fromArray(pose.transform.matrix).clone() : null;
        if (pose) {
          entry.reticle.matrix.copy(entry.matrix);
          rayLength = raycaster.ray.origin.distanceTo(new THREE.Vector3().setFromMatrixPosition(entry.matrix));
        }
      }
      ctrl.userData.ray.scale.z = rayLength;
    }
    panel.setHover(hovered);

    // Before pinning on a headset, keep the panel loosely in view.
    if (!pinned && !handheld && !grabbedBy && initialised) {
      const xrCam = renderer.xr.getCamera();
      const toPanel = panelGroup.position.clone().sub(xrCam.getWorldPosition(new THREE.Vector3())).setY(0).normalize();
      const fwd = xrCam.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
      if (toPanel.dot(fwd) < Math.cos(THREE.MathUtils.degToRad(40))) placeInFront(0.9);
    }

    if (marker.visible) {
      marker.userData.pin.position.y = 0.02 + Math.sin(time / 260) * 0.012;
      marker.userData.ring.scale.setScalar(1 + 0.15 * Math.sin(time / 300));
      const top = marker.localToWorld(new THREE.Vector3(0, 0.09, 0));
      const bottom = panelGroup.localToWorld(new THREE.Vector3(0, -PANEL_H / 2, 0));
      leader.geometry.setFromPoints([top, bottom]);
      leader.computeLineDistances();
      leader.visible = panelGroup.visible;
    }

    renderer.render(scene, camera);
  });

  session.addEventListener('end', () => {
    renderer.setAnimationLoop(null);
    guide.removeEventListener('change', onChange);
    viewerHitSource?.cancel();
    for (const entry of sourceHits.values()) entry.source?.cancel();
    if (overlay) {
      overlay.hidden = true;
      overlay.removeEventListener('click', overlayClicks);
      overlay.removeEventListener('beforexrselect', blockSelect);
    }
    stopSpeaking();
    panel.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    onEnd?.();
  });

  return session;
}
