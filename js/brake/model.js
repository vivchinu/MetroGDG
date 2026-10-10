// Procedural 3D model of a metro Brake Control Unit (BCU) with its pneumatic
// panel. Built from primitives (no model files), so it works offline and is
// light enough for Quest 3. Parts can be highlighted for the current step and
// the faulty unit glows red with a callout, like an equipment overlay.

import * as THREE from 'three';
import { BCU, L } from './procedure.js';

const FONT = '"Noto Sans Gujarati", "Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FOCUS = new THREE.Color(0x22d3ee);
const FAULT = new THREE.Color(0xff3344);
const OK = new THREE.Color(0x22c55e);
const BLACK = new THREE.Color(0x000000);

function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
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

// Billboard label: title + optional subtitle, coloured border.
class Label {
  constructor(height = 0.065) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 176;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, depthTest: false, transparent: true }));
    this.sprite.renderOrder = 20;
    this.sprite.center.set(0.5, 0);
    this.height = height;
    this.sprite.scale.set(height * (640 / 176), height, 1);
  }

  set(title, sub, color) {
    const ctx = this.canvas.getContext('2d');
    const { width: w, height: h } = this.canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color === 'fault' ? 'rgba(127, 16, 24, 0.92)' : 'rgba(8, 22, 40, 0.92)';
    roundRect(ctx, 6, 6, w - 12, h - 12, 26);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = color === 'fault' ? '#ff5566' : '#22d3ee';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${sub ? 54 : 60}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 34, sub ? 66 : h / 2, w - 68);
    if (sub) {
      ctx.font = `600 40px ${FONT}`;
      ctx.fillStyle = color === 'fault' ? '#ffb3ba' : '#a5f3fc';
      ctx.fillText(sub, 34, 126, w - 68);
    }
    this.texture.needsUpdate = true;
  }
}

function warningSprite() {
  const tex = canvasTexture(256, 256, (ctx) => {
    ctx.shadowColor = 'rgba(255, 40, 60, 0.9)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ff2d3d';
    ctx.beginPath();
    ctx.moveTo(128, 30);
    ctx.lineTo(232, 214);
    ctx.lineTo(24, 214);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#ffffff';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 120px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 128, 196);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.renderOrder = 21;
  s.scale.set(0.09, 0.09, 1);
  return s;
}

export class BrakeUnitModel {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'brake-control-unit';
    this.content = new THREE.Group();
    this.content.position.set(0.16, 0.09, 0); // centre the unit + pneumatic panel, base at y = 0
    this.root.add(this.content);
    this.parts = {};
    this.state = { focus: [], faultCleared: false, coverOpen: false, lang: 'en' };
    this.coverAngle = 0;
    this._box = new THREE.Box3();
    this._inv = new THREE.Matrix4();
    this._m = new THREE.Matrix4();
    this.build();
    this.buildOverlays();
  }

  // ---------- construction helpers ----------

  part(id) {
    this.parts[id] ??= { id, meshes: [] };
    this.current = this.parts[id];
    return this;
  }

  mesh(geometry, material, parent, pos = [0, 0, 0], rot = [0, 0, 0]) {
    const m = new THREE.Mesh(geometry, material.clone());
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.userData.part = this.current?.id;
    m.userData.baseEmissive = m.material.emissive?.clone();
    parent.add(m);
    this.current?.meshes.push(m);
    return m;
  }

  tube(points, radius, material, parent) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return this.mesh(new THREE.TubeGeometry(curve, 40, radius, 10, false), material, parent);
  }

  build() {
    const c = this.content;
    const M = {
      body: new THREE.MeshStandardMaterial({ color: 0x4a5d73, metalness: 0.65, roughness: 0.42 }),
      cover: new THREE.MeshStandardMaterial({ color: 0x5d7590, metalness: 0.55, roughness: 0.38 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1c232d, metalness: 0.4, roughness: 0.6 }),
      frame: new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.6, roughness: 0.55 }),
      alu: new THREE.MeshStandardMaterial({ color: 0xb9c2cc, metalness: 0.85, roughness: 0.3 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xc8a24a, metalness: 0.85, roughness: 0.35 }),
      copper: new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8, roughness: 0.35 }),
      terminal: new THREE.MeshStandardMaterial({ color: 0xd9a400, metalness: 0.1, roughness: 0.55 }),
      grey: new THREE.MeshStandardMaterial({ color: 0x8a939e, metalness: 0.3, roughness: 0.6 }),
      cable: new THREE.MeshStandardMaterial({ color: 0x121417, metalness: 0.1, roughness: 0.8 }),
      red: new THREE.MeshStandardMaterial({ color: 0xd62828, metalness: 0.2, roughness: 0.45 }),
      blue: new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.2, roughness: 0.5 }),
      pcb: new THREE.MeshStandardMaterial({ color: 0x17633a, metalness: 0.2, roughness: 0.6 }),
      chip: new THREE.MeshStandardMaterial({ color: 0x0f1115, metalness: 0.3, roughness: 0.5 }),
    };
    this.materials = M;

    // Mounting frame (not highlightable)
    this.current = null;
    for (const y of [0.12, 0.4]) this.mesh(new THREE.BoxGeometry(1.12, 0.035, 0.03), M.frame, c, [-0.18, y, -0.135]);
    for (const x of [-0.7, 0.34]) this.mesh(new THREE.BoxGeometry(0.035, 0.42, 0.03), M.frame, c, [x, 0.26, -0.135]);

    // Enclosure: hollow box, open at the front, closed by the hinged cover.
    const W = 0.56, H = 0.36, D = 0.22, T = 0.012, cy = 0.25;
    this.part('unit');
    this.mesh(new THREE.BoxGeometry(W, H, T), M.body, c, [0, cy, -D / 2 + T / 2]);
    this.mesh(new THREE.BoxGeometry(W, T, D), M.body, c, [0, cy + H / 2 - T / 2, 0]);
    this.mesh(new THREE.BoxGeometry(W, T, D), M.body, c, [0, cy - H / 2 + T / 2, 0]);
    this.mesh(new THREE.BoxGeometry(T, H, D), M.body, c, [-W / 2 + T / 2, cy, 0]);
    this.mesh(new THREE.BoxGeometry(T, H, D), M.body, c, [W / 2 - T / 2, cy, 0]);
    // mounting lugs
    for (const x of [-0.24, 0.24]) for (const y of [0.1, 0.4]) this.mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), M.body, c, [x, y, -0.13]);

    // Hinged front cover (pivot on the left edge)
    this.coverPivot = new THREE.Group();
    this.coverPivot.position.set(-W / 2, cy, D / 2 + 0.006);
    c.add(this.coverPivot);
    const cp = this.coverPivot;
    this.part('unit');
    this.mesh(new THREE.BoxGeometry(W - 0.01, H - 0.01, 0.012), M.cover, cp, [W / 2, 0, 0]);
    for (let i = 0; i < 6; i++) this.mesh(new THREE.BoxGeometry(0.2, 0.008, 0.006), M.dark, cp, [W / 2 - 0.12, -0.13 + i * 0.016, 0.008]);
    this.mesh(new THREE.BoxGeometry(0.012, 0.12, 0.02), M.alu, cp, [W - 0.03, 0, 0.016]);
    for (const y of [-0.15, 0.15]) this.mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 12), M.alu, cp, [0.004, y, 0], [0, 0, 0]);
    const plate = canvasTexture(320, 100, (ctx, w, h) => {
      ctx.fillStyle = '#d7dde4'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#111'; ctx.font = '700 38px system-ui, sans-serif'; ctx.fillText('BCU  B2', 16, 44);
      ctx.font = '500 24px system-ui, sans-serif'; ctx.fillText('24 V DC · IP65 · KB-EP', 16, 80);
    });
    this.mesh(new THREE.PlaneGeometry(0.15, 0.047), new THREE.MeshStandardMaterial({ map: plate, roughness: 0.7 }), cp, [0.12, 0.13, 0.0065]);

    this.part('display');
    const screen = canvasTexture(320, 160, (ctx, w, h) => {
      ctx.fillStyle = '#05080a'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#5eead4'; ctx.font = '600 24px monospace'; ctx.fillText('BCU B2  BOGIE 2', 14, 32);
      ctx.fillStyle = '#ff3b4a'; ctx.font = '700 80px monospace'; ctx.fillText('E51', 14, 116);
      ctx.fillStyle = '#fca5a5'; ctx.font = '600 22px monospace'; ctx.fillText('BRAKE NOT RELEASED', 14, 148);
    });
    this.mesh(new THREE.BoxGeometry(0.15, 0.08, 0.01), M.dark, cp, [W / 2 + 0.1, 0.1, 0.008]);
    this.mesh(new THREE.PlaneGeometry(0.13, 0.065), new THREE.MeshBasicMaterial({ map: screen, toneMapped: false }), cp, [W / 2 + 0.1, 0.1, 0.0135]);
    this.ledPower = this.mesh(new THREE.SphereGeometry(0.007, 12, 8), new THREE.MeshStandardMaterial({ color: 0x0a3, emissive: 0x22c55e, emissiveIntensity: 1.5 }), cp, [W / 2 - 0.0, 0.12, 0.012]);
    this.ledFault = this.mesh(new THREE.SphereGeometry(0.007, 12, 8), new THREE.MeshStandardMaterial({ color: 0x600, emissive: 0xff2030, emissiveIntensity: 2 }), cp, [W / 2 - 0.0, 0.09, 0.012]);

    this.part('reset');
    this.mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 20), M.dark, cp, [W / 2 + 0.215, 0.1, 0.01], [Math.PI / 2, 0, 0]);
    this.mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 20), new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4 }), cp, [W / 2 + 0.215, 0.1, 0.018], [Math.PI / 2, 0, 0]);

    // Electronics module inside the enclosure
    this.part('module');
    this.mesh(new THREE.BoxGeometry(0.46, 0.27, 0.012), M.pcb, c, [0, cy, -0.02]);
    for (let i = 0; i < 6; i++) this.mesh(new THREE.BoxGeometry(0.04, 0.04, 0.008), M.chip, c, [-0.17 + (i % 3) * 0.08, cy + 0.05 - Math.floor(i / 3) * 0.08, -0.01]);
    this.mesh(new THREE.BoxGeometry(0.08, 0.05, 0.03), M.grey, c, [0.15, cy + 0.06, -0.002]);
    this.mesh(new THREE.BoxGeometry(0.3, 0.02, 0.02), M.dark, c, [0, cy - 0.11, -0.005]);
    for (let i = 0; i < 3; i++) this.mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 14), M.blue, c, [0.13 + i * 0.03, cy - 0.04, 0.005], [Math.PI / 2, 0, 0]);

    // Terminal block TB1 on the right side
    this.part('tb1');
    this.mesh(new THREE.BoxGeometry(0.01, 0.012, 0.19), M.alu, c, [W / 2 + 0.006, 0.31, 0]);
    const wireColors = [0xd62828, 0x1d4ed8, 0x111111, 0xd9a400, 0xd62828, 0x1d4ed8, 0x111111, 0xd9a400];
    for (let i = 0; i < 8; i++) {
      const z = -0.077 + i * 0.022;
      this.mesh(new THREE.BoxGeometry(0.03, 0.05, 0.018), i < 2 ? M.red : M.terminal, c, [W / 2 + 0.026, 0.31, z]);
      this.mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.006, 10), M.alu, c, [W / 2 + 0.042, 0.322, z], [0, 0, Math.PI / 2]);
      this.tube([[W / 2 + 0.03, 0.285, z], [W / 2 + 0.05, 0.2, z * 0.6], [W / 2 + 0.07, 0.1, -0.05], [W / 2 + 0.06, 0.02, -0.11]], 0.003,
        new THREE.MeshStandardMaterial({ color: wireColors[i], roughness: 0.6 }), c);
    }
    const tbTex = canvasTexture(128, 48, (ctx, w, h) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#000'; ctx.font = '700 34px system-ui'; ctx.fillText('TB1', 30, 36); });
    this.mesh(new THREE.PlaneGeometry(0.05, 0.019), new THREE.MeshBasicMaterial({ map: tbTex }), c, [W / 2 + 0.0125, 0.36, 0.05], [0, Math.PI / 2, 0]);

    // Connectors X1 / X2 on the underside, with cables
    this.part('connectors');
    for (const [x, label] of [[-0.15, 'X1'], [-0.03, 'X2']]) {
      this.mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.035, 24), M.alu, c, [x, cy - H / 2 - 0.017, 0.02]);
      this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24, 1, false), M.brass, c, [x, cy - H / 2 - 0.03, 0.02]);
      this.tube([[x, cy - H / 2 - 0.035, 0.02], [x, 0.0, 0.03], [x - 0.04, -0.06, -0.04], [x - 0.08, -0.08, -0.13]], 0.011, M.cable, c);
      const t = canvasTexture(96, 48, (ctx, w, h) => { ctx.fillStyle = '#ffeb3b'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#000'; ctx.font = '700 34px system-ui'; ctx.fillText(label, 22, 36); });
      this.mesh(new THREE.PlaneGeometry(0.035, 0.018), new THREE.MeshBasicMaterial({ map: t }), c, [x, cy - H / 2 - 0.006, 0.112]);
    }

    // Pneumatic panel on the left: manifold, EP valves, sensors, gauge, pipes, isolation cock
    const mx = -0.49;
    this.current = null;
    this.mesh(new THREE.BoxGeometry(0.34, 0.3, 0.012), M.frame, c, [mx, 0.25, -0.115]);

    this.part('valves');
    this.mesh(new THREE.BoxGeometry(0.27, 0.07, 0.1), M.alu, c, [mx, 0.2, -0.04]);
    for (let i = 0; i < 3; i++) {
      const x = mx - 0.08 + i * 0.08;
      this.mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.06, 20), M.chip, c, [x, 0.265, -0.04]);
      this.mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 16), M.grey, c, [x, 0.305, -0.04]);
      this.mesh(new THREE.BoxGeometry(0.03, 0.02, 0.02), M.dark, c, [x + 0.025, 0.27, -0.04]);
    }

    this.part('sensors');
    for (const [x, label] of [[mx - 0.07, 'PT1'], [mx + 0.07, 'PT2']]) {
      this.mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 16), M.grey, c, [x, 0.2, 0.04], [Math.PI / 2, 0, 0]);
      this.mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 6), M.alu, c, [x, 0.2, 0.017], [Math.PI / 2, 0, 0]);
      this.mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 10), M.cable, c, [x, 0.2, 0.09], [Math.PI / 2, 0, 0]);
      const t = canvasTexture(96, 48, (ctx, w, h) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#000'; ctx.font = '700 30px system-ui'; ctx.fillText(label, 16, 35); });
      this.mesh(new THREE.PlaneGeometry(0.03, 0.015), new THREE.MeshBasicMaterial({ map: t }), c, [x, 0.226, 0.03]);
    }

    this.part('gauge');
    const dial = canvasTexture(256, 256, (ctx, w) => {
      const r = w / 2;
      ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(r, r, r - 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
      for (let v = 0; v <= 10; v++) {
        const a = Math.PI * 0.75 + (v / 10) * Math.PI * 1.5;
        ctx.beginPath(); ctx.moveTo(r + Math.cos(a) * (r - 14), r + Math.sin(a) * (r - 14)); ctx.lineTo(r + Math.cos(a) * (r - 34), r + Math.sin(a) * (r - 34)); ctx.stroke();
        ctx.fillStyle = '#111'; ctx.font = '600 20px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(String(v), r + Math.cos(a) * (r - 54), r + Math.sin(a) * (r - 54) + 7);
      }
      ctx.fillStyle = '#b91c1c'; ctx.font = '700 22px system-ui'; ctx.fillText('BC  bar', r, r + 60);
      const a = Math.PI * 0.75 + (3.6 / 10) * Math.PI * 1.5; // stuck at 3.6 bar: brake not released
      ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(r, r); ctx.lineTo(r + Math.cos(a) * (r - 30), r + Math.sin(a) * (r - 30)); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(r, r, 12, 0, Math.PI * 2); ctx.fill();
    });
    this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.025, 32), M.alu, c, [mx, 0.36, -0.02], [Math.PI / 2, 0, 0]);
    this.mesh(new THREE.CircleGeometry(0.045, 32), new THREE.MeshBasicMaterial({ map: dial, toneMapped: false }), c, [mx, 0.36, -0.006]);
    this.mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 10), M.copper, c, [mx, 0.285, -0.03]);

    this.current = null;
    this.tube([[mx + 0.135, 0.2, -0.06], [mx + 0.2, 0.2, -0.08], [mx + 0.22, 0.05, -0.09], [mx + 0.22, -0.08, -0.1]], 0.011, M.copper, c);
    this.tube([[mx - 0.135, 0.2, -0.04], [mx - 0.17, 0.15, -0.04], [mx - 0.17, 0.0, -0.04], [mx - 0.17, -0.08, -0.06]], 0.011, M.copper, c);

    this.part('cock');
    this.mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.16, 14), M.copper, c, [mx, 0.09, -0.04], [0, 0, Math.PI / 2]);
    this.mesh(new THREE.BoxGeometry(0.05, 0.045, 0.045), M.brass, c, [mx, 0.09, -0.04]);
    this.mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 10), M.brass, c, [mx, 0.12, -0.04]);
    this.mesh(new THREE.BoxGeometry(0.12, 0.016, 0.022), M.red, c, [mx + 0.05, 0.138, -0.04]);
    this.tube([[mx, 0.165, -0.04], [mx, 0.13, -0.04]], 0.008, M.copper, c);

    this.current = null;
    // Contact shadow to ground the model in AR
    const shadow = canvasTexture(256, 256, (ctx, w) => {
      const g = ctx.createRadialGradient(w / 2, w / 2, 10, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, w);
    });
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.5), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false }));
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(-0.16, -0.085, -0.04);
    c.add(shadowMesh);
    this.shadow = shadowMesh;
  }

  buildOverlays() {
    // Corner brackets around highlighted parts (24 thin bars per part).
    this.brackets = [FOCUS, FAULT].map((color) => {
      const im = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95, toneMapped: false }),
        24 * 3,
      );
      im.renderOrder = 15;
      im.count = 0;
      im.frustumCulled = false;
      this.root.add(im);
      return im;
    });

    this.faultLabel = new Label(0.07);
    this.root.add(this.faultLabel.sprite);
    this.warning = warningSprite();
    this.root.add(this.warning);
    this.faultLine = this.leader(0xff4455);

    this.focusLabels = [0, 1].map(() => {
      const label = new Label(0.055);
      label.sprite.visible = false;
      this.root.add(label.sprite);
      return { label, line: this.leader(0x22d3ee) };
    });
    this.refreshLabels();
  }

  leader(color) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }),
    );
    line.renderOrder = 19;
    line.frustumCulled = false;
    this.root.add(line);
    return line;
  }

  // ---------- state ----------

  setLang(lang) { this.state.lang = lang; this.refreshLabels(); }
  setFocus(ids) { this.state.focus = ids || []; this.refreshLabels(); }
  setCoverOpen(open) { this.state.coverOpen = open; }
  setFaultCleared(cleared) { this.state.faultCleared = cleared; this.refreshLabels(); }

  refreshLabels() {
    const lang = this.state.lang;
    if (this.state.faultCleared) this.faultLabel.set(L(BCU.name, lang), lang === 'gu' ? 'ખામી દૂર થઈ' : 'Fault cleared', 'focus');
    else this.faultLabel.set(L(BCU.name, lang), `${L(BCU.faultTitle, lang)} · E51`, 'fault');
    this.focusLabels.forEach((f, i) => {
      const id = this.state.focus[i];
      f.label.sprite.visible = Boolean(id);
      f.line.visible = Boolean(id);
      if (id) f.label.set(L(BCU.partNames[id], lang), null, 'focus');
    });
  }

  partBox(id, target = this._box) {
    target.makeEmpty();
    this.root.updateMatrixWorld(true);
    this._inv.copy(this.root.matrixWorld).invert();
    for (const m of this.parts[id].meshes) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox.clone().applyMatrix4(this._m.multiplyMatrices(this._inv, m.matrixWorld));
      target.union(b);
    }
    return target;
  }

  pick(raycaster) {
    const meshes = Object.values(this.parts).flatMap((p) => p.meshes);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? { part: hit.object.userData.part, point: hit.point, distance: hit.distance } : null;
  }

  // World-space bounding box of the whole unit (for grabbing).
  worldBounds(target = new THREE.Box3()) {
    return target.setFromObject(this.content);
  }

  _setBrackets(im, boxes) {
    const dummy = new THREE.Object3D();
    let n = 0;
    const th = 0.004;
    for (const box of boxes) {
      const size = box.getSize(new THREE.Vector3());
      const len = Math.min(0.05, Math.max(size.x, size.y, size.z) * 0.25);
      for (const sx of [0, 1]) for (const sy of [0, 1]) for (const sz of [0, 1]) {
        const corner = new THREE.Vector3(sx ? box.max.x : box.min.x, sy ? box.max.y : box.min.y, sz ? box.max.z : box.min.z);
        const dir = new THREE.Vector3(sx ? -1 : 1, sy ? -1 : 1, sz ? -1 : 1);
        for (const axis of ['x', 'y', 'z']) {
          dummy.position.copy(corner);
          dummy.position[axis] += (dir[axis] * len) / 2;
          dummy.scale.set(axis === 'x' ? len : th, axis === 'y' ? len : th, axis === 'z' ? len : th);
          dummy.updateMatrix();
          im.setMatrixAt(n++, dummy.matrix);
        }
      }
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
  }

  update(time, cameraWorldPos) {
    const t = time / 1000;
    // Cover hinge animation
    const target = this.state.coverOpen ? -1.95 : 0;
    this.coverAngle += (target - this.coverAngle) * 0.12;
    this.coverPivot.rotation.y = this.coverAngle;

    // LEDs
    const blink = Math.sin(t * Math.PI * 4) > 0;
    this.ledFault.material.emissiveIntensity = this.state.faultCleared ? 0 : blink ? 2.5 : 0.1;

    // Emissive pulse on focused / faulty parts
    const pulse = 0.35 + 0.3 * Math.sin(t * 4);
    const focus = new Set(this.state.focus);
    for (const [id, part] of Object.entries(this.parts)) {
      let color = null;
      let k = pulse;
      if (focus.has(id)) color = FOCUS;
      else if (id === 'unit' && !this.state.faultCleared) { color = FAULT; k = pulse * (focus.size ? 0.12 : 0.38); }
      else if (id === 'unit') { color = OK; k = 0.12; }
      for (const m of part.meshes) {
        if (!m.material.emissive || m === this.ledFault || m === this.ledPower) continue;
        if (color) m.material.emissive.copy(color).multiplyScalar(k);
        else m.material.emissive.copy(m.userData.baseEmissive || BLACK);
      }
    }

    // Brackets
    const focusBoxes = this.state.focus.filter((id) => this.parts[id]).map((id) => this.partBox(id, new THREE.Box3()).expandByScalar(0.012));
    this._setBrackets(this.brackets[0], focusBoxes);
    const unitBox = this.partBox('unit', new THREE.Box3()).expandByScalar(0.015);
    this._setBrackets(this.brackets[1], this.state.faultCleared ? [] : [unitBox]);
    this.brackets[1].material.opacity = focus.size ? 0.35 : 0.95;

    // Fault callout above the unit
    const top = new THREE.Vector3((unitBox.min.x + unitBox.max.x) / 2, unitBox.max.y, unitBox.max.z);
    const labelPos = top.clone().add(new THREE.Vector3(0.12, 0.17, 0.05));
    this.faultLabel.sprite.position.copy(labelPos);
    this.faultLine.geometry.setFromPoints([top, labelPos]);
    this.warning.position.set((unitBox.min.x + unitBox.max.x) / 2 - 0.06, (unitBox.min.y + unitBox.max.y) / 2 + 0.02, unitBox.max.z + 0.07);
    this.warning.visible = !this.state.faultCleared && !focus.size;
    this.warning.scale.setScalar(0.085 * (1 + 0.08 * Math.sin(t * 5)));
    const faultOpacity = focus.size ? 0.45 : 1;
    this.faultLabel.sprite.material.opacity = faultOpacity;
    this.faultLine.material.opacity = faultOpacity;

    // Focus callouts: pushed outwards from the unit centre
    const centre = new THREE.Vector3(0, 0.34, 0);
    this.focusLabels.forEach((f, i) => {
      const box = focusBoxes[i];
      if (!box) return;
      const c = box.getCenter(new THREE.Vector3());
      const out = c.clone().sub(centre).setY(0);
      if (out.lengthSq() < 1e-4) out.set(0, 0, 1);
      out.normalize();
      const pos = c.clone().addScaledVector(out, 0.16).add(new THREE.Vector3(0, 0.14 + i * 0.09, 0.08));
      f.label.sprite.position.copy(pos);
      f.line.geometry.setFromPoints([c, pos]);
    });
  }
}
