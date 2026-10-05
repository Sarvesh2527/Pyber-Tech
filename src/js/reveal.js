// Reveal-on-scroll, built so that nothing is ever hidden at rest.
//
// The page loads fully visible. The moment the visitor first scrolls, blocks that are
// still below the fold are tucked away (is-pending) and then arrive as they come into
// view. If scripts fail, the observer is missing, motion is reduced, or the page is only
// looked at (a screenshot, a thumbnail), the whole page is simply there.

import { $, $$, reduceMotion } from './util.js';

export function initReveal() {
  if (!('IntersectionObserver' in window) || reduceMotion()) return;

  const items = $$('[data-reveal]');
  const phases = $('[data-phases]');
  const bars = phases ? $$('.phase', phases) : [];
  const FOLD = 0.92;   // matches the observer's bottom margin

  const reveal = (el) => { el.classList.remove('is-pending'); el.classList.add('is-in'); };

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      reveal(en.target);
      io.unobserve(en.target);
    }
  }, { rootMargin: `0px 0px -${Math.round((1 - FOLD) * 100)}% 0px`, threshold: 0 });

  // the three method bars fill, one after another, when the list scrolls into view
  const ioBars = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    bars.forEach((p) => p.classList.remove('is-pending'));
    ioBars.disconnect();
  }, { rootMargin: '0px 0px -15% 0px' });

  let armed = false;
  function arm() {
    if (armed) return;
    armed = true;
    window.removeEventListener('scroll', arm);
    const fold = window.innerHeight * FOLD;
    for (const el of items) {
      if (el.getBoundingClientRect().top > fold) { el.classList.add('is-pending'); io.observe(el); }
      else el.classList.add('is-in');
    }
    if (phases && phases.getBoundingClientRect().top > window.innerHeight * 0.85) {
      bars.forEach((p) => p.classList.add('is-pending'));
      ioBars.observe(phases);
    }
  }
  window.addEventListener('scroll', arm, { passive: true });

  // keyboard focus can jump into a block that is still tucked away: show it at once
  document.addEventListener('focusin', (e) => {
    const host = e.target.closest && e.target.closest('[data-reveal].is-pending');
    if (host) { reveal(host); io.unobserve(host); }
  });
}
