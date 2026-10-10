// Step-through state for one procedure, shared by the 2D page, the camera
// overlay and the 3D panel in AR/VR so they always show the same step.

import { tl } from './i18n.js';

export class Guide extends EventTarget {
  constructor(procedure, lang) {
    super();
    this.procedure = procedure;
    this.lang = procedure.content[lang] ? lang : Object.keys(procedure.content)[0];
    this.done = new Set();
    this.index = this.content.safety?.length ? -1 : 0;
  }

  get content() {
    return this.procedure.content[this.lang];
  }

  get total() {
    return this.content.steps.length;
  }

  // -1 = safety page, 0..total-1 = steps, total = finished page
  get minIndex() {
    return this.content.safety?.length ? -1 : 0;
  }

  setLang(lang) {
    if (!this.procedure.content[lang] || lang === this.lang) return;
    this.lang = lang;
    this.emit();
  }

  go(i) {
    this.index = Math.max(this.minIndex, Math.min(this.total, i));
    this.emit();
  }

  next() {
    if (this.index >= 0 && this.index < this.total) this.done.add(this.index);
    this.go(this.index + 1);
  }

  prev() {
    this.go(this.index - 1);
  }

  toggle(i) {
    if (this.done.has(i)) this.done.delete(i);
    else this.done.add(i);
    this.emit();
  }

  restart() {
    this.done.clear();
    this.go(this.minIndex);
  }

  // Text for read-aloud of the current page.
  speechText() {
    const c = this.content;
    if (this.index < 0) return `${tl(this.lang, 'safety')}. ${c.safety.join('. ')}`;
    if (this.index >= this.total) return tl(this.lang, 'finish');
    return `${tl(this.lang, 'stepOf', this.index + 1, this.total)}. ${c.steps[this.index]}`;
  }

  emit() {
    this.dispatchEvent(new Event('change'));
  }
}
