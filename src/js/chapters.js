// The page is a conversation: every step of the story and every section is a
// "chapter" that answers one question. This module knows where each chapter is
// and which one the reader is in, so the nav, the index and the scene agree.

import { $, $$, clamp } from './util.js';

export function initChapters() {
  const nav = $('#nav');
  const list = $$('[data-q][data-qtext]').map((el) => ({
    el,
    id: el.id,
    q: el.dataset.q,
    text: el.dataset.qtext,
    top: 0,
    kind: el.classList.contains('step') ? 'step' : 'section',
  }));

  let vh = window.innerHeight;
  let navH = 68;
  let docH = 1;

  function measure() {
    const y = window.scrollY;
    vh = window.innerHeight;
    navH = nav ? nav.offsetHeight : 68;
    docH = document.documentElement.scrollHeight;
    for (const c of list) c.top = y + c.el.getBoundingClientRect().top;
  }

  /** The horizontal "reading line": the chapter that crosses it is the current one. */
  const line = () => navH + (vh - navH) * 0.5;

  function indexAt(y = window.scrollY) {
    const at = y + line();
    let idx = 0;
    for (let i = 0; i < list.length; i++) if (list[i].top <= at) idx = i;
    return idx;
  }

  const progress = (y = window.scrollY) => clamp(y / Math.max(1, docH - vh));

  measure();

  // Layout can move after fonts load, on resize, or when content above changes height.
  let t = 0;
  const remeasure = () => { clearTimeout(t); t = setTimeout(measure, 80); };
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);

  return { list, measure, indexAt, progress, line, navH: () => navH };
}
