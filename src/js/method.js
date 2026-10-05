// Method: a three-step accordion. One step open at a time keeps the column calm.

import { $, $$ } from './util.js';

export function initMethod() {
  const root = $('[data-phases]');
  if (!root) return;
  const phases = $$('.phase', root);

  function set(phase, open) {
    phase.classList.toggle('is-open', open);
    phase.querySelector('.phase__toggle').setAttribute('aria-expanded', String(open));
  }

  for (const phase of phases) {
    phase.querySelector('.phase__toggle').addEventListener('click', () => {
      const willOpen = !phase.classList.contains('is-open');
      for (const p of phases) set(p, p === phase ? willOpen : false);
    });
  }
}
