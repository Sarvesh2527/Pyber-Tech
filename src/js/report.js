// Report: the same finding explained twice — for the owner and for the engineer.
// The card eases to the height of whichever explanation is showing.

import { $, $$, reduceMotion } from './util.js';

export function initReport() {
  const root = $('[data-finding]');
  if (!root) return;
  const buttons = $$('.seg__btn[data-view]', root);
  const panes = $$('[data-pane]', root);
  const wrap = $('[data-panes]', root);

  const active = () => panes.find((p) => p.classList.contains('is-active'));

  // size the wrapper to the active pane; animate only when the reader switched views
  function fit(animate) {
    if (!wrap) return;
    const target = active().offsetHeight;
    if (animate && !reduceMotion() && wrap.offsetHeight !== target) {
      wrap.style.height = `${wrap.offsetHeight}px`;
      wrap.classList.add('is-sizing');
      void wrap.offsetHeight;                       // commit the starting height
      wrap.style.height = `${target}px`;
      const done = () => { wrap.classList.remove('is-sizing'); wrap.removeEventListener('transitionend', done); };
      wrap.addEventListener('transitionend', done);
    } else {
      wrap.classList.remove('is-sizing');
      wrap.style.height = `${target}px`;
    }
  }

  function show(view, animate) {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    panes.forEach((p) => {
      const on = p.dataset.pane === view;
      p.classList.toggle('is-active', on);
      p.setAttribute('aria-hidden', String(!on));
    });
    fit(animate);
  }

  buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.view, true)));
  show('plain', false);

  // text reflows on resize and once fonts load: keep the height honest
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { if (!wrap.classList.contains('is-sizing')) fit(false); }).observe(wrap.parentElement);
    panes.forEach((p) => new ResizeObserver(() => { if (!wrap.classList.contains('is-sizing')) fit(false); }).observe(p));
  }
}
