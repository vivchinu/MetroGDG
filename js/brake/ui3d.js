// Canvas-textured 3D UI panels with buttons that can be hit by a pointer ray
// (controller / pinch ray / phone tap) or poked directly with a fingertip.

import * as THREE from 'three';

export const FONT = '"Noto Sans Gujarati", "Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const C = {
  glass: 'rgba(10, 22, 44, 0.9)',
  glassEdge: 'rgba(56, 189, 248, 0.75)',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#38bdf8',
  primary: '#1d6fe0',
  primaryHover: '#3b8bff',
  btn: 'rgba(30, 41, 59, 0.95)',
  btnHover: 'rgba(51, 65, 85, 1)',
  danger: '#e11d48',
  dangerBg: 'rgba(127, 16, 32, 0.55)',
  ok: '#22c55e',
  okBg: 'rgba(21, 128, 61, 0.35)',
  cyanBg: 'rgba(8, 145, 178, 0.18)',
  track: '#334155',
};

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

// Largest font size (maxSize..minSize) at which text fits the box.
export function fitText(ctx, text, maxWidth, maxHeight, maxSize, minSize, weight = 500) {
  let lines = [];
  let size = maxSize;
  for (; size >= minSize; size -= 2) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    lines = wrapText(ctx, text, maxWidth);
    if (lines.length * size * 1.35 <= maxHeight) break;
  }
  size = Math.max(size, minSize);
  return { lines, size, lineHeight: size * 1.35 };
}

export function drawLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

export class Panel {
  /**
   * @param {number} pw canvas width px  @param {number} ph canvas height px
   * @param {number} width physical width in metres
   * @param {(panel: Panel) => void} drawFn
   */
  constructor(pw, ph, width, drawFn) {
    this.pw = pw;
    this.ph = ph;
    this.width = width;
    this.height = (width * ph) / pw;
    this.canvas = document.createElement('canvas');
    this.canvas.width = pw;
    this.canvas.height = ph;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.width, this.height),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false }),
    );
    this.mesh.renderOrder = 30;
    this.mesh.userData.panel = this;
    this.drawFn = drawFn;
    this.buttons = [];
    this.hover = null;
    this.pressed = null;
    this.pressedUntil = 0;
    this.onButton = null;
  }

  render() {
    this.buttons = [];
    this.ctx.clearRect(0, 0, this.pw, this.ph);
    this.drawFn(this);
    this.texture.needsUpdate = true;
  }

  setHover(id) {
    if (id === this.hover) return;
    this.hover = id;
    this.render();
  }

  // Visual press feedback + callback.
  press(id) {
    if (!id) return;
    this.pressed = id;
    this.pressedUntil = performance.now() + 180;
    this.render();
    this.onButton?.(id);
    setTimeout(() => { if (performance.now() >= this.pressedUntil) { this.pressed = null; this.render(); } }, 200);
  }

  buttonAtPx(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (!b.disabled && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
    }
    return null;
  }

  buttonAtUV(uv) {
    return this.buttonAtPx(uv.x * this.pw, (1 - uv.y) * this.ph);
  }

  // Point in the panel mesh's local space (metres) -> button id, plus depth.
  probeLocal(p) {
    const inside = Math.abs(p.x) <= this.width / 2 && Math.abs(p.y) <= this.height / 2;
    if (!inside) return { inside: false, id: null, depth: p.z };
    const x = (p.x / this.width + 0.5) * this.pw;
    const y = (0.5 - p.y / this.height) * this.ph;
    return { inside: true, id: this.buttonAtPx(x, y), depth: p.z };
  }

  // ---------- drawing helpers ----------

  background(radius = 44) {
    const { ctx } = this;
    ctx.fillStyle = C.glass;
    roundRect(ctx, 6, 6, this.pw - 12, this.ph - 12, radius);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = C.glassEdge;
    ctx.stroke();
  }

  button(id, x, y, w, h, label, opts = {}) {
    const { ctx } = this;
    const { style = 'secondary', disabled = false, active = false, size } = opts;
    this.buttons.push({ id, x, y, w, h, disabled });
    const hover = this.hover === id && !disabled;
    const pressed = this.pressed === id;
    ctx.save();
    ctx.globalAlpha = disabled ? 0.4 : 1;
    if (style === 'tab') {
      ctx.fillStyle = active ? C.accent : hover ? C.text : C.muted;
      ctx.font = `700 ${size || 38}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2);
      if (active || hover) {
        ctx.fillStyle = active ? C.accent : 'rgba(148,163,184,0.6)';
        roundRect(ctx, x + 16, y + h - 8, w - 32, 6, 3);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    let fill = C.btn;
    if (style === 'primary') fill = hover ? C.primaryHover : C.primary;
    else if (style === 'danger') fill = hover ? '#f43f5e' : C.danger;
    else if (style === 'chip') fill = active ? C.cyanBg : hover ? C.btnHover : C.btn;
    else if (hover) fill = C.btnHover;
    if (pressed) fill = '#60a5fa';
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w, h, Math.min(28, h / 2));
    ctx.fill();
    if (style === 'chip' && active) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = C.accent;
      ctx.stroke();
    }
    if (hover) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#bae6fd';
      ctx.stroke();
    }
    ctx.fillStyle = C.text;
    ctx.font = `700 ${size || Math.min(40, h * 0.36)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 2, w - 24);
    ctx.restore();
  }

  dispose() {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
