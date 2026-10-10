// WebXR hand tracking: renders the 25 joints, detects pinches (for grabbing
// the 3D model), fingertip pokes on 3D panels (direct touch UI) and whether
// the left palm faces the user (to show the wrist menu).

import * as THREE from 'three';

const JOINTS = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip',
];

const PINCH_START = 0.018;
const PINCH_END = 0.035;
const POKE_HOVER = 0.05; // fingertip within 5 cm in front of a panel: hover
const POKE_PRESS = 0.008; // crosses 8 mm: press
const POKE_RELEASE = 0.025;

export class Hands {
  constructor(renderer, scene) {
    this.scene = scene;
    this._v = new THREE.Vector3();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this.onPinchStart = null;
    this.onPinchEnd = null;
    this.onPoke = null;
    this.hands = [0, 1].map((i) => {
      const hand = renderer.xr.getHand(i);
      scene.add(hand);
      const joints = new THREE.InstancedMesh(
        new THREE.SphereGeometry(1, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.35, transparent: true, opacity: 0.6 }),
        JOINTS.length,
      );
      joints.frustumCulled = false;
      joints.visible = false;
      scene.add(joints);
      const tipMarker = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 12), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9, depthTest: false }));
      tipMarker.renderOrder = 40;
      tipMarker.visible = false;
      scene.add(tipMarker);
      const state = {
        hand, joints, tipMarker,
        source: null, handedness: null, tracked: false,
        tip: new THREE.Vector3(), thumb: new THREE.Vector3(), pinchPoint: new THREE.Vector3(), wrist: new THREE.Vector3(),
        palmNormal: new THREE.Vector3(), pinching: false, grabbing: false, grabbedThisPinch: false,
        nearPanel: false, pokeReady: false, poke: null,
      };
      hand.addEventListener('connected', (e) => {
        if (!e.data?.hand) return;
        state.source = e.data;
        state.handedness = e.data.handedness;
      });
      hand.addEventListener('disconnected', () => {
        state.source = null;
        state.tracked = false;
        joints.visible = false;
        tipMarker.visible = false;
      });
      return state;
    });
  }

  bySource(src) { return this.hands.find((h) => h.source === src) || null; }
  get any() { return this.hands.some((h) => h.tracked); }
  get left() { return this.hands.find((h) => h.tracked && h.handedness === 'left') || null; }
  get right() { return this.hands.find((h) => h.tracked && h.handedness === 'right') || null; }

  jointPos(state, name, target) {
    const j = state.hand.joints?.[name];
    if (!j || !j.visible) return null;
    return j.getWorldPosition(target);
  }

  /**
   * @param {import('./ui3d.js').Panel[]} panels visible pokeable panels
   * @param {THREE.Vector3} head world position of the head
   * @returns hover candidates [{ panel, id }]
   */
  update(panels, head) {
    const hovers = [];
    for (const s of this.hands) {
      const tip = s.source && this.jointPos(s, 'index-finger-tip', s.tip);
      s.tracked = Boolean(tip);
      s.joints.visible = s.tracked;
      s.tipMarker.visible = s.tracked;
      if (!s.tracked) { s.nearPanel = false; continue; }

      // Joint spheres
      let n = 0;
      for (const name of JOINTS) {
        const j = s.hand.joints[name];
        if (!j || !j.visible) continue;
        j.getWorldPosition(this._v);
        const r = (j.jointRadius || 0.008) * 0.9;
        this._m.compose(this._v, this._q.identity(), new THREE.Vector3(r, r, r));
        s.joints.setMatrixAt(n++, this._m);
      }
      s.joints.count = n;
      s.joints.instanceMatrix.needsUpdate = true;

      // Pinch
      this.jointPos(s, 'thumb-tip', s.thumb);
      this.jointPos(s, 'wrist', s.wrist);
      s.pinchPoint.addVectors(s.tip, s.thumb).multiplyScalar(0.5);
      const d = s.tip.distanceTo(s.thumb);
      if (!s.pinching && d < PINCH_START) {
        s.pinching = true;
        s.grabbedThisPinch = false;
        this.onPinchStart?.(s);
      } else if (s.pinching && d > PINCH_END) {
        s.pinching = false;
        this.onPinchEnd?.(s);
      }

      // Palm normal (towards the viewer when the palm faces them)
      const idx = this.jointPos(s, 'index-finger-metacarpal', new THREE.Vector3());
      const pinky = this.jointPos(s, 'pinky-finger-metacarpal', new THREE.Vector3());
      if (idx && pinky) {
        s.palmNormal.crossVectors(idx.sub(s.wrist), pinky.sub(s.wrist)).normalize();
        if (s.handedness === 'right') s.palmNormal.negate();
      }
      s.palmFacingHead = head ? s.palmNormal.dot(head.clone().sub(s.wrist).normalize()) > 0.55 : false;

      // Poke: nearest panel in front of the fingertip
      let best = null;
      for (const panel of panels) {
        if (panel.pokeExclude && panel.pokeExclude === s.handedness) continue;
        const local = panel.mesh.worldToLocal(s.tip.clone());
        const probe = panel.probeLocal(local);
        if (!probe.inside || probe.depth < -0.04 || probe.depth > 0.15) continue;
        if (!best || probe.depth < best.depth) best = { panel, ...probe };
      }
      s.nearPanel = Boolean(best);
      s.poke = best;
      s.tipMarker.position.copy(s.tip);
      s.tipMarker.material.color.set(best && best.depth < POKE_HOVER ? 0x22d3ee : 0x94a3b8);
      if (best) {
        if (best.depth < POKE_HOVER && best.id) hovers.push({ panel: best.panel, id: best.id });
        if (best.depth < POKE_PRESS && s.pokeReady && best.depth > -0.03) {
          s.pokeReady = false;
          if (best.id) this.onPoke?.(best.panel, best.id, s);
        }
        if (best.depth > POKE_RELEASE) s.pokeReady = true;
      } else {
        // Only a fingertip that approaches from the front can press, so a hand
        // sweeping in from the side does not trigger buttons by accident.
        s.pokeReady = false;
      }
    }
    return hovers;
  }

  dispose() {
    for (const s of this.hands) {
      this.scene.remove(s.hand, s.joints, s.tipMarker);
      s.joints.geometry.dispose();
      s.joints.material.dispose();
    }
  }
}
