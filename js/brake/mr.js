// Mixed reality session for the Brake Control Unit guide.
//
//  Meta Quest 3: passthrough (immersive-ar), hand tracking + controllers.
//    - Point and pinch / trigger to place the 3D unit on the real equipment,
//      floor or a table. It is held by a WebXR anchor (and saved as a
//      persistent anchor where supported, so it comes back next session).
//    - Poke panel buttons with your index finger, or pinch-ray from afar.
//    - Pinch inside the model (or squeeze the grip) to grab and move it.
//    - Turn your left palm towards you for the wrist menu.
//  Android phones: immersive-ar with hit-test, tap to place, DOM overlay.

import * as THREE from 'three';
import { BCU, L } from './procedure.js';
import { Panel } from './ui3d.js';
import { drawMainPanel, drawPlacePanel, drawWristMenu, ui } from './panels.js';
import { Hands } from './hands.js';
import { speak, stopSpeaking } from '../speech.js';

export async function mrSupport() {
  if (!navigator.xr || !window.isSecureContext) return { ar: false, vr: false };
  const check = (m) => navigator.xr.isSessionSupported(m).catch(() => false);
  const [ar, vr] = await Promise.all([check('immersive-ar'), check('immersive-vr')]);
  return { ar, vr };
}

const ANCHOR_KEY = 'mfa.bcu.anchor';
const SIZES = [1, 0.5, 0.25];
const UP = new THREE.Vector3(0, 1, 0);
const isHeadsetUA = () => /OculusBrowser|Quest|Pico|Wolvic|VR\b/i.test(navigator.userAgent);

// Live handles for the automated test.
export const mrDebug = {};

function makeReticle() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.065, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  ring.add(new THREE.Mesh(new THREE.CircleGeometry(0.01, 16).rotateX(-Math.PI / 2), ring.material));
  ring.matrixAutoUpdate = false;
  ring.visible = false;
  return ring;
}

function decompose(m) {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  m.decompose(position, quaternion, new THREE.Vector3());
  return { position, quaternion, normal: UP.clone().applyQuaternion(quaternion) };
}

/**
 * @param {object} o
 * @param {THREE.WebGLRenderer} o.renderer  shared with the 2D preview (xr.enabled = true)
 * @param {THREE.Scene} o.scene
 * @param {THREE.Camera} o.camera
 * @param {import('./model.js').BrakeUnitModel} o.model
 * @param {import('./procedure.js').BrakeSession} o.session
 * @param {'immersive-ar'|'immersive-vr'} o.mode
 * @param {HTMLElement} [o.overlay] DOM overlay root for phones
 * @param {THREE.Object3D[]} [o.previewOnly] objects hidden while immersive
 * @param {(lang: string) => void} [o.onLang]
 * @param {() => void} [o.onEnd]
 */
export async function startMR(o) {
  const { renderer, scene, camera, model, session: bs, mode, overlay } = o;
  const handheldUA = !isHeadsetUA() && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const init = { optionalFeatures: ['local-floor', 'hand-tracking'] };
  if (mode === 'immersive-ar') {
    init.optionalFeatures.push('hit-test', 'anchors');
    if (overlay && handheldUA) {
      init.optionalFeatures.push('dom-overlay');
      init.domOverlay = { root: overlay };
    }
  }
  const xr = await navigator.xr.requestSession(mode, init);
  const floor = !xr.enabledFeatures || xr.enabledFeatures.includes('local-floor');
  renderer.xr.setReferenceSpaceType(floor ? 'local-floor' : 'local');
  await renderer.xr.setSession(xr);
  const handheld = Boolean(xr.domOverlayState) || handheldUA;

  // ---------- scene setup ----------
  const saved = {
    background: scene.background,
    parent: model.root.parent,
    position: model.root.position.clone(),
    quaternion: model.root.quaternion.clone(),
    scale: model.root.scale.clone(),
  };
  scene.background = mode === 'immersive-ar' ? null : new THREE.Color(0x0b1220);
  (o.previewOnly || []).forEach((obj) => { obj.userData.wasVisible = obj.visible; obj.visible = mode === 'immersive-vr' && obj.isGridHelper; });

  const xrRoot = new THREE.Group();
  scene.add(xrRoot);
  const modelGroup = new THREE.Group();
  modelGroup.visible = false;
  xrRoot.add(modelGroup);
  modelGroup.add(model.root);
  model.root.position.set(0, 0, 0);
  model.root.quaternion.identity();
  model.root.scale.setScalar(1);
  let sizeIndex = 0;

  // ---------- panels ----------
  let savedAt = null;
  const mainPanel = new Panel(1024, 1300, 0.44, (p) => drawMainPanel(p, bs, { savedAt }));
  const placePanel = new Panel(1024, 420, 0.42, (p) => drawPlacePanel(p, bs.lang, handheld ? 'phone' : inputMode()));
  const wristPanel = new Panel(560, 320, 0.17, (p) => drawWristMenu(p, bs.lang));
  wristPanel.pokeExclude = 'left'; // pressed with the right index finger only
  for (const p of [mainPanel, placePanel, wristPanel]) {
    p.mesh.visible = false;
    xrRoot.add(p.mesh);
    p.onButton = (id) => action(id);
  }
  const panels = [mainPanel, placePanel, wristPanel];

  // ---------- input ----------
  const hands = new Hands(renderer, xrRoot);
  const raycaster = new THREE.Raycaster();
  const rot = new THREE.Matrix4();
  const setRay = (obj) => {
    obj.updateMatrixWorld(true);
    rot.identity().extractRotation(obj.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(obj.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rot);
    return raycaster.ray;
  };
  const rayPanels = (ctrl) => {
    setRay(ctrl);
    const meshes = panels.filter((p) => p.mesh.visible).map((p) => p.mesh);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const panel = hit.object.userData.panel;
    return { panel, id: panel.buttonAtUV(hit.uv), distance: hit.distance };
  };

  const controllers = [0, 1].map((i) => {
    const ctrl = renderer.xr.getController(i);
    const ray = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
      new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.85 }),
    );
    ray.visible = false;
    ctrl.add(ray);
    ctrl.userData = { ray, source: null };
    ctrl.addEventListener('connected', (e) => { ctrl.userData.source = e.data; });
    ctrl.addEventListener('disconnected', () => { ctrl.userData.source = null; ray.visible = false; });
    ctrl.addEventListener('select', (e) => onSelect(ctrl, e.data));
    ctrl.addEventListener('squeezestart', (e) => { if (!e.data?.hand) startGrab({ kind: 'controller', obj: ctrl }); });
    ctrl.addEventListener('squeezeend', (e) => { if (!e.data?.hand) endGrab(); });
    xrRoot.add(ctrl);
    return ctrl;
  });

  function inputMode() {
    return [...xr.inputSources].some((s) => s.hand) ? 'hand' : 'controller';
  }

  // ---------- hit testing ----------
  let viewerHitSource = null;
  let viewerHit = null;
  const viewerReticle = makeReticle();
  xrRoot.add(viewerReticle);
  if (handheld && mode === 'immersive-ar' && xr.requestHitTestSource) {
    try {
      viewerHitSource = await xr.requestHitTestSource({ space: await xr.requestReferenceSpace('viewer') });
    } catch (err) { console.info('viewer hit-test unavailable', err); }
  }
  const sourceHits = new Map();
  const addHitSource = (src) => {
    if (mode !== 'immersive-ar' || src.targetRayMode !== 'tracked-pointer' || !xr.requestHitTestSource || sourceHits.has(src)) return;
    const entry = { source: null, reticle: makeReticle(), pose: null };
    xrRoot.add(entry.reticle);
    sourceHits.set(src, entry);
    xr.requestHitTestSource({ space: src.targetRaySpace }).then((h) => { entry.source = h; }).catch(() => {});
  };
  xr.addEventListener('inputsourceschange', (e) => {
    e.added.forEach(addHitSource);
    for (const src of e.removed) {
      const entry = sourceHits.get(src);
      entry?.source?.cancel();
      if (entry) xrRoot.remove(entry.reticle);
      sourceHits.delete(src);
    }
    placePanel.render();
  });
  [...xr.inputSources].forEach(addHitSource);

  // ---------- placement & anchors ----------
  let modeState = 'place';
  let anchor = null;
  let pendingAnchor = null; // { position, quaternion } to anchor on the next frame
  let restoring = null;

  const cameraPos = () => renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());

  function facingQuat(position, normal) {
    // Vertical surface (wall / equipment face): back of the unit against it.
    if (normal && Math.abs(normal.y) < 0.5) {
      const n = normal.clone().setY(0).normalize();
      return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    }
    const toCam = cameraPos().sub(position).setY(0);
    if (toCam.lengthSq() < 1e-6) toCam.set(0, 0, 1);
    return new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(toCam.x, toCam.z));
  }

  function poseForRay(ctrl, src) {
    if (src?.targetRayMode === 'screen') return viewerHit;
    const entry = src && sourceHits.get(src);
    if (entry?.pose) return entry.pose;
    // No hit-test result: intersect with the floor (local-floor y = 0), else 1 m out.
    const ray = setRay(ctrl);
    if (floor && ray.direction.y < -0.15) {
      const t = -ray.origin.y / ray.direction.y;
      if (t > 0 && t < 4) return { position: ray.origin.clone().addScaledVector(ray.direction, t), normal: UP.clone() };
    }
    return { position: ray.origin.clone().addScaledVector(ray.direction, 1.0), normal: null };
  }

  function placeModel(position, normal) {
    const quaternion = facingQuat(position, normal);
    const p = position.clone();
    if (normal && Math.abs(normal.y) < 0.5) p.addScaledVector(normal.clone().setY(0).normalize(), 0.16 * SIZES[sizeIndex]);
    modelGroup.position.copy(p);
    modelGroup.quaternion.copy(quaternion);
    modelGroup.visible = true;
    pendingAnchor = { position: p, quaternion };
    enterGuide();
  }

  function placeInFront() {
    const cam = renderer.xr.getCamera();
    const pos = cam.getWorldPosition(new THREE.Vector3());
    const dir = cam.getWorldDirection(new THREE.Vector3()).setY(0);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const p = pos.clone().addScaledVector(dir, 1.0);
    p.y = floor ? Math.max(0, pos.y - 0.95) : pos.y - 0.6;
    placeModel(p, UP.clone());
  }

  function enterPlace() {
    modeState = 'place';
    placePanel.mesh.visible = true;
    mainPanel.mesh.visible = false;
    positionPanel(placePanel, null, 0.8);
    placePanel.render();
    updateOverlay();
  }

  function enterGuide() {
    modeState = 'guide';
    placePanel.mesh.visible = false;
    mainPanel.mesh.visible = true;
    positionMainPanel();
    renderAll();
  }

  // Panel beside the model, facing the viewer.
  function positionMainPanel() {
    const cam = cameraPos();
    const base = modelGroup.position.clone();
    const toModel = base.clone().sub(cam).setY(0);
    if (toModel.lengthSq() < 1e-6) toModel.set(0, 0, -1);
    toModel.normalize();
    const right = new THREE.Vector3().crossVectors(toModel, UP).normalize();
    const s = SIZES[sizeIndex];
    const pos = base.clone().addScaledVector(right, 0.42 * s + 0.3).addScaledVector(toModel, -0.15);
    pos.y = THREE.MathUtils.clamp(cam.y - 0.12, base.y + 0.3, base.y + 1.7);
    if (handheld) pos.copy(base).addScaledVector(right, 0.35 * s + 0.25).setY(base.y + 0.45 * s + 0.2);
    mainPanel.mesh.position.copy(pos);
    mainPanel.mesh.lookAt(cam.x, pos.y, cam.z);
  }

  function positionPanel(panel, at, distance) {
    const xrCam = renderer.xr.getCamera();
    const pos = xrCam.getWorldPosition(new THREE.Vector3());
    const dir = xrCam.getWorldDirection(new THREE.Vector3()).setY(0);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    panel.mesh.position.copy(at || pos.clone().addScaledVector(dir, distance));
    if (!at) panel.mesh.position.y = pos.y - 0.18;
    panel.mesh.lookAt(pos.x, panel.mesh.position.y, pos.z);
  }

  async function makeAnchor(frame, ref) {
    const req = pendingAnchor;
    pendingAnchor = null;
    if (!frame.createAnchor) return;
    try {
      const old = anchor;
      anchor = await frame.createAnchor(new XRRigidTransform(req.position, req.quaternion), ref);
      old?.delete?.();
      if (anchor.requestPersistentHandle) {
        const prev = localStorage.getItem(ANCHOR_KEY);
        if (prev && xr.deletePersistentAnchor) xr.deletePersistentAnchor(prev).catch(() => {});
        const handle = await anchor.requestPersistentHandle();
        localStorage.setItem(ANCHOR_KEY, JSON.stringify({ handle, size: sizeIndex }));
      }
    } catch (err) {
      console.info('anchor not created', err);
      anchor = null;
    }
  }

  async function tryRestoreAnchor() {
    if (!xr.restorePersistentAnchor) return;
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(ANCHOR_KEY) || 'null'); } catch {}
    if (!stored?.handle) return;
    try {
      restoring = true;
      anchor = await xr.restorePersistentAnchor(stored.handle);
      sizeIndex = stored.size || 0;
      modelGroup.scale.setScalar(SIZES[sizeIndex]);
    } catch (err) {
      console.info('persistent anchor not restored', err);
      anchor = null;
    } finally {
      restoring = false;
    }
  }

  // ---------- grabbing ----------
  let grab = null;
  const grabOffset = new THREE.Vector3();
  function grabberPos(g) {
    return g.kind === 'hand' ? g.hand.pinchPoint.clone() : g.obj.getWorldPosition(new THREE.Vector3());
  }
  function startGrab(g) {
    if (modeState !== 'guide' || grab) return;
    if (g.kind === 'controller') {
      // Only when the controller points at / is near the model.
      setRay(g.obj);
      const near = model.worldBounds().expandByScalar(0.25).containsPoint(grabberPos(g));
      if (!near && !model.pick(raycaster)) return;
    }
    grab = g;
    grab.startYaw = g.kind === 'controller' ? yawOf(g.obj) : 0;
    grab.modelYaw = new THREE.Euler().setFromQuaternion(modelGroup.quaternion, 'YXZ').y;
    grabOffset.copy(modelGroup.position).sub(grabberPos(g));
    anchor?.delete?.();
    anchor = null;
  }
  function endGrab() {
    if (!grab) return;
    grab = null;
    pendingAnchor = { position: modelGroup.position.clone(), quaternion: modelGroup.quaternion.clone() };
  }
  function yawOf(obj) {
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion()));
    return Math.atan2(-d.x, -d.z);
  }

  hands.onPinchStart = (h) => {
    if (modeState !== 'guide' || h.nearPanel) return;
    if (model.worldBounds().expandByScalar(0.04).containsPoint(h.pinchPoint)) {
      h.grabbedThisPinch = true;
      startGrab({ kind: 'hand', hand: h });
    }
  };
  hands.onPinchEnd = (h) => { if (grab?.hand === h) endGrab(); };
  hands.onPoke = (panel, id) => panel.press(id);

  // ---------- select (trigger / pinch-ray / screen tap) ----------
  function onSelect(ctrl, src) {
    actionLog.push(`select:${src?.hand ? 'hand' : src?.targetRayMode}`);
    const h = src?.hand ? hands.bySource(src) : null;
    if (h && (h.grabbedThisPinch || h.nearPanel)) return;
    const hit = rayPanels(ctrl);
    if (hit) {
      if (hit.id) hit.panel.press(hit.id);
      return;
    }
    if (modeState === 'place') {
      const pose = poseForRay(ctrl, src);
      if (pose) placeModel(pose.position, pose.normal);
    }
  }

  // ---------- actions ----------
  const actionLog = [];
  function action(id) {
    actionLog.push(id);
    if (actionLog.length > 20) actionLog.shift();
    try { [...xr.inputSources].forEach((s) => s.gamepad?.hapticActuators?.[0]?.pulse?.(0.3, 25)); } catch {}
    if (id === 'exit') return xr.end();
    if (id.startsWith('tab:')) return bs.setTab(id.slice(4));
    if (id.startsWith('step:')) return bs.go(Number(id.slice(5)));
    if (id.startsWith('obs:')) return bs.toggleObservation(Number(id.slice(4)));
    switch (id) {
      case 'start': if (bs.index < 0 || bs.index >= bs.total) bs.start(); else bs.setTab('steps'); break;
      case 'back': bs.prev(); break;
      case 'next': bs.next(); break;
      case 'restart': bs.done.clear(); bs.go(0); break;
      case 'speak': speak(bs.speechText(), bs.lang); break;
      case 'save': bs.saveReport(); savedAt = Date.now(); renderAll(); break;
      case 'tool:anchor': enterPlace(); break;
      case 'tool:cover': bs.toggleCover(); break;
      case 'tool:size':
        sizeIndex = (sizeIndex + 1) % SIZES.length;
        modelGroup.scale.setScalar(SIZES[sizeIndex]);
        pendingAnchor = { position: modelGroup.position.clone(), quaternion: modelGroup.quaternion.clone() };
        renderAll();
        break;
      case 'tool:lang': o.onLang?.(bs.lang === 'gu' ? 'en' : 'gu'); break;
      case 'place-front': placeInFront(); break;
      default: break;
    }
  }

  function renderAll() {
    mainPanel.render();
    placePanel.render();
    wristPanel.render();
    updateOverlay();
  }

  const onChange = () => {
    model.setLang(bs.lang);
    model.setFocus(bs.focusParts);
    model.setCoverOpen(bs.coverOpen);
    model.setFaultCleared(bs.observations.has(6));
    renderAll();
  };
  bs.addEventListener('change', onChange);
  onChange();

  // ---------- phone DOM overlay ----------
  const overlayClick = (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act) { e.preventDefault(); action(act); }
  };
  const blockSelect = (e) => { if (e.target.closest('button, .step-card')) e.preventDefault(); };
  function updateOverlay() {
    if (!overlay || overlay.hidden) return;
    const lang = bs.lang;
    overlay.querySelector('.xr-hint').textContent = modeState === 'place' ? ui(lang, 'placePhone') : `${L(BCU.name, lang)} · ${BCU.code}`;
    const label = overlay.querySelector('.step-label');
    const text = overlay.querySelector('.step-text');
    if (bs.step) {
      label.textContent = `${ui(lang, 'stepOf', bs.index + 1, bs.total)} · ${L(bs.step.title, lang)}`;
      text.textContent = L(bs.step.detail, lang);
    } else if (bs.index >= bs.total) {
      label.textContent = '✓ ' + ui(lang, 'allDone');
      text.textContent = '';
    } else {
      label.textContent = `⚠ ${L(BCU.faultTitle, lang)} · ${BCU.code}`;
      text.textContent = L(BCU.faultDetail, lang);
    }
  }
  if (overlay && handheld) {
    overlay.hidden = false;
    overlay.addEventListener('click', overlayClick);
    overlay.addEventListener('beforexrselect', blockSelect);
  }

  // ---------- frame loop ----------
  let frames = 0;
  const tmpM = new THREE.Matrix4();
  renderer.setAnimationLoop((time, frame) => {
    if (!frame) return;
    const ref = renderer.xr.getReferenceSpace();
    frames++;
    if (frames === 4) {
      // Head pose is now valid: restore a saved anchor or ask for placement.
      tryRestoreAnchor().then(() => {
        // A restored anchor shows the model once its pose is tracked (below).
        if (anchor) enterGuide(); else enterPlace();
      });
    }

    if (pendingAnchor && !restoring) makeAnchor(frame, ref);
    if (anchor && !grab) {
      const pose = frame.trackedAnchors?.has(anchor) !== false ? frame.getPose(anchor.anchorSpace, ref) : null;
      if (pose) {
        tmpM.fromArray(pose.transform.matrix);
        const d = decompose(tmpM);
        modelGroup.position.copy(d.position);
        modelGroup.quaternion.copy(d.quaternion);
        if (!modelGroup.visible) { modelGroup.visible = true; positionMainPanel(); }
      }
    }

    // Hit tests
    const showReticles = modeState === 'place';
    if (viewerHitSource) {
      const r = frame.getHitTestResults(viewerHitSource)[0];
      const pose = r?.getPose(ref);
      viewerReticle.visible = Boolean(pose) && showReticles;
      if (pose) {
        viewerReticle.matrix.fromArray(pose.transform.matrix);
        viewerHit = decompose(viewerReticle.matrix);
      } else viewerHit = null;
    }

    // Grab follow
    if (grab) {
      const p = grabberPos(grab).add(grabOffset);
      modelGroup.position.copy(p);
      if (grab.kind === 'controller') {
        const yaw = grab.modelYaw + (yawOf(grab.obj) - grab.startYaw);
        modelGroup.quaternion.setFromAxisAngle(UP, yaw);
      }
    }

    // Wrist menu on the left palm
    const head = cameraPos();
    const left = hands.left;
    wristPanel.mesh.visible = Boolean(left?.palmFacingHead) && !grab;
    if (wristPanel.mesh.visible) {
      wristPanel.mesh.position.copy(left.wrist).addScaledVector(left.palmNormal, 0.06).add(new THREE.Vector3(0, 0.07, 0));
      wristPanel.mesh.lookAt(head);
    }

    // Hover from hands (poke) and rays
    const hovers = new Map();
    for (const hv of hands.update(panels.filter((p) => p.mesh.visible), head)) hovers.set(hv.panel, hv.id);
    for (const ctrl of controllers) {
      const src = ctrl.userData.source;
      const isPointer = src?.targetRayMode === 'tracked-pointer';
      const h = src?.hand ? hands.bySource(src) : null;
      const showRay = isPointer && !(h && (h.nearPanel || h.grabbing || grab?.hand === h));
      ctrl.userData.ray.visible = showRay;
      const entry = src && sourceHits.get(src);
      if (!isPointer) continue;
      const hit = showRay ? rayPanels(ctrl) : null;
      let length = 2;
      if (hit) {
        length = hit.distance;
        if (hit.id && !hovers.has(hit.panel)) hovers.set(hit.panel, hit.id);
        if (entry) entry.reticle.visible = false;
      } else if (entry?.source) {
        const pose = frame.getHitTestResults(entry.source)[0]?.getPose(ref);
        entry.reticle.visible = Boolean(pose) && showReticles && showRay;
        entry.pose = pose ? decompose(tmpM.fromArray(pose.transform.matrix)) : null;
        if (pose) {
          entry.reticle.matrix.fromArray(pose.transform.matrix);
          length = raycaster.ray.origin.distanceTo(entry.pose.position);
        }
      }
      ctrl.userData.ray.scale.z = length;
    }
    for (const p of panels) p.setHover(hovers.get(p) || null);

    model.update(time, head);
    renderer.render(scene, camera);
  });

  Object.assign(mrDebug, {
    xr, model, modelGroup, mainPanel, placePanel, wristPanel, hands, session: bs,
    actionLog, mode: () => modeState, anchored: () => Boolean(anchor), grabbing: () => Boolean(grab),
  });

  // ---------- teardown ----------
  xr.addEventListener('end', () => {
    renderer.setAnimationLoop(null);
    bs.removeEventListener('change', onChange);
    viewerHitSource?.cancel();
    for (const e of sourceHits.values()) e.source?.cancel();
    if (overlay) {
      overlay.hidden = true;
      overlay.removeEventListener('click', overlayClick);
      overlay.removeEventListener('beforexrselect', blockSelect);
    }
    stopSpeaking();
    hands.dispose();
    panels.forEach((p) => p.dispose());
    saved.parent.add(model.root);
    model.root.position.copy(saved.position);
    model.root.quaternion.copy(saved.quaternion);
    model.root.scale.copy(saved.scale);
    scene.remove(xrRoot);
    scene.background = saved.background;
    (o.previewOnly || []).forEach((obj) => { obj.visible = obj.userData.wasVisible; });
    renderer.xr.setReferenceSpaceType('local-floor');
    o.onEnd?.();
  });

  return xr;
}
