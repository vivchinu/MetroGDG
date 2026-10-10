// Compact current-step card used by the phone AR overlay and the camera view.

import { tl } from './i18n.js';

export function fillStepCard(root, guide) {
  const c = guide.content;
  const label = root.querySelector('.step-label');
  const text = root.querySelector('.step-text');
  const title = root.querySelector('.step-title');
  const lang = guide.lang;
  root.lang = lang;
  if (title) title.textContent = c.title;
  if (guide.index < 0) {
    label.textContent = '⚠ ' + tl(lang, 'safety');
    text.innerHTML = '';
    for (const s of c.safety) {
      const li = document.createElement('div');
      li.className = 'step-safety';
      li.textContent = s;
      text.appendChild(li);
    }
  } else if (guide.index >= guide.total) {
    label.textContent = '✓ ' + tl(lang, 'finish');
    text.textContent = `${guide.done.size} / ${guide.total}`;
  } else {
    label.textContent = tl(lang, 'stepOf', guide.index + 1, guide.total);
    text.textContent = c.steps[guide.index];
  }
  const back = root.querySelector('[data-act="back"]');
  if (back) back.disabled = guide.index <= guide.minIndex;
  const next = root.querySelector('[data-act="next"]');
  if (next) next.textContent = guide.index >= guide.total ? '↺' : guide.index === guide.total - 1 ? '✓' : '▶';
}
