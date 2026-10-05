// Navigation: the "which question am I in" indicator, the scroll progress line,
// the question index (a dialog that doubles as a table of contents) and smooth
// in-page scrolling with proper focus handling.

import { $, $$, h, clamp, easeInOut, reduceMotion } from './util.js';

const mqWide = window.matchMedia('(min-width: 1024px)');

export function initNav(ch) {
  const numEl = $('[data-nav-num]');
  const textEl = $('[data-nav-text]');
  const bar = $('[data-progress]');
  const dialog = $('#index-dialog');
  const listEl = $('[data-index-list]');
  const openers = $$('[data-open-index]');

  // ---- question index ------------------------------------------------------
  const links = [];
  if (listEl) {
    for (const c of ch.list) {
      const a = h('a', { href: `#${c.id}`, 'data-scroll': '', 'data-close-index': '' },
        h('span', { class: 'num' }, c.q),
        h('span', { class: 'txt' }, c.text));
      listEl.append(h('li', {}, a));
      links.push(a);
    }
  }

  const canModal = dialog && typeof dialog.showModal === 'function';
  const openIndex = () => { if (canModal && !dialog.open) dialog.showModal(); };
  const closeIndex = () => { if (canModal && dialog.open) dialog.close(); };

  if (!canModal) {
    // very old browsers: the button simply jumps to the first section list
    openers.forEach((b) => b.setAttribute('hidden', ''));
  } else {
    openers.forEach((b) => b.addEventListener('click', openIndex));
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeIndex(); });
  }

  // ---- current question + progress ----------------------------------------
  let cur = -1;
  let swap = 0;

  function setCurrent(i) {
    if (i === cur) return;
    const first = cur < 0;
    cur = i;
    const c = ch.list[i];
    links.forEach((a, n) => (n === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    if (!numEl || !textEl) return;
    clearTimeout(swap);
    if (first || reduceMotion()) {
      numEl.textContent = c.q; textEl.textContent = c.text;
    } else {
      textEl.classList.add('is-swap');
      swap = setTimeout(() => {
        numEl.textContent = c.q; textEl.textContent = c.text;
        textEl.classList.remove('is-swap');
      }, 160);
    }
  }

  let queued = false;
  function update() {
    queued = false;
    const y = window.scrollY;
    if (bar) bar.style.setProperty('--p', ch.progress(y).toFixed(4));
    setCurrent(ch.indexAt(y));
  }
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();

  // ---- smooth in-page scrolling -------------------------------------------
  let raf = 0;
  const cancel = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((ev) =>
    window.addEventListener(ev, cancel, { passive: true }));

  function scrollToY(target, done) {
    cancel();
    const from = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const to = clamp(target, 0, Math.max(0, max));
    const dist = Math.abs(to - from);
    if (reduceMotion() || dist < 2) { window.scrollTo(0, to); if (done) done(); return; }
    const dur = clamp(420 + dist * 0.26, 560, 1400);
    const t0 = performance.now();
    const tick = (now) => {
      const t = clamp((now - t0) / dur);
      window.scrollTo(0, from + (to - from) * easeInOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else { raf = 0; if (done) done(); }
    };
    raf = requestAnimationFrame(tick);
  }

  function targetY(el) {
    if (el.id === 'top') return 0;
    const nav = ch.navH();
    let offset = nav;
    // on small screens the story's stage is pinned under the nav; land beneath it
    if (el.classList.contains('step') && !mqWide.matches) {
      const stage = $('.story__stage');
      offset = nav + (stage ? stage.offsetHeight : 0) + 4;
    }
    return window.scrollY + el.getBoundingClientRect().top - offset;
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    if (a.hasAttribute('data-close-index')) closeIndex();
    scrollToY(targetY(el), () => {
      if (id === 'top') return;
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    });
    try { history.replaceState(null, '', `#${id}`); } catch (_) { /* sandboxed frames */ }
  });

  // Close buttons inside the dialog that are not links
  $$('[data-close-index]').forEach((b) => {
    if (b.tagName === 'BUTTON') b.addEventListener('click', closeIndex);
  });
}
