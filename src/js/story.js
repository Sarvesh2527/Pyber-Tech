// The scroll story. Where the reader is in the conversation (0–5) drives the
// attack-surface model: the stack opens up, probes arrive, a scan sweeps through,
// findings line up into a path, and finally the path closes.
//
// Two positions are derived from scroll:
//   P — raw position, used for things that should scrub continuously (scan, path)
//   E — eased position that "rests" on each step, used for states (layout, labels)

import { createScene } from './scene.js';
import { $, $$, clamp, lerp, smoothstep, easeInOut, sampleKF, reduceMotion } from './util.js';

const mqWide = window.matchMedia('(min-width: 1024px)');

const STATE_LABELS = ['Observing', 'Probing', 'Mapping', 'Scanning', 'Path found', 'Resolved'];

// One value per story step (0 → 5), sampled at the eased position.
const KF = {
  explode: [0.0, 0.38, 1, 1, 1, 1],
  labels:  [0.6, 0.8, 1, 1, 1, 1],
  nodes:   [0, 0.5, 1, 1, 1, 1],
  links:   [0, 0, 0.9, 0.55, 0.4, 0.22],
  probes:  [0, 1, 0.3, 0, 0, 0],
  entry:   [0, 1, 1, 1, 1, 0.55],
};

const AMBIENT_CYCLE = 6500;   // ms: a slow sweep, then a rest
const INTRO_MS = 1500;

export function initStory(ch) {
  const svg = $('#stage-svg');
  const stage = $('#stage');
  const stageBox = $('.story__stage');
  const stepsWrap = $('.story__steps');
  const steps = $$('.step[data-step]');
  const stateEl = $('[data-stage-state]');
  const cChecked = $('[data-count="checked"]');
  const cTotal = $('[data-count="total"]');
  const cFind = $('[data-count="findings"]');
  if (!svg || !stage || !stepsWrap || !steps.length) return;

  const last = steps.length - 1;
  let scene = null;
  let anchors = [];
  let storyEnd = Infinity;
  let line = 0;
  let queued = false;
  let started = 0;
  let introOn = true;
  let curStep = -1;
  let curLabel = -1;
  const shown = { c: -1, f: -1 };

  function build() {
    scene = createScene(svg, mqWide.matches ? 'wide' : 'narrow');
    if (cTotal) cTotal.textContent = String(scene.total);
    shown.c = shown.f = -1;
  }

  // The vertical centre of each step's content, in document coordinates.
  function measure() {
    const y = window.scrollY;
    anchors = steps.map((s) => {
      const a = s.firstElementChild.getBoundingClientRect();
      const b = s.lastElementChild.getBoundingClientRect();
      return y + (a.top + b.bottom) / 2;
    });
    storyEnd = y + stepsWrap.getBoundingClientRect().bottom;
    const nav = ch.navH();
    const vh = window.innerHeight;
    if (mqWide.matches) {
      line = ch.line();
    } else {
      // text scrolls beneath the pinned stage: read at a line inside that lower area
      const stageBottom = nav + stageBox.offsetHeight;
      line = stageBottom + (vh - stageBottom) * 0.4;
    }
  }

  function position() {
    const at = window.scrollY + line;
    if (at <= anchors[0]) return 0;
    if (at >= anchors[last]) return last;
    let i = 0;
    while (i < last && at >= anchors[i + 1]) i++;
    return i + (at - anchors[i]) / (anchors[i + 1] - anchors[i]);
  }

  function frame(now) {
    queued = false;
    if (window.scrollY > storyEnd + window.innerHeight) return;   // story is behind us

    const P = position();
    const i = Math.min(Math.floor(P), last);
    const f = P - i;
    const E = i + smoothstep(0.25, 0.75, f);

    const s = {
      explode: sampleKF(KF.explode, E),
      labels: sampleKF(KF.labels, E),
      nodes: sampleKF(KF.nodes, E),
      links: sampleKF(KF.links, E),
      probes: sampleKF(KF.probes, E),
      entry: sampleKF(KF.entry, E),
      tags: smoothstep(3.6, 3.95, P),
      path: smoothstep(3.55, 4.0, P),
      pathOpacity: smoothstep(3.5, 3.7, P) * (1 - smoothstep(4.5, 5.0, P)),
      fixed: smoothstep(4.5, 5.0, P),
      scanU: -1,
      scanStrength: 0,
      checkedU: -1,
    };

    // the scan is scrubbed by scroll while the reader is on "What do you actually do?"
    const k = clamp((P - 2.4) / 1.2);
    s.scanU = lerp(-0.25, 1.25, k);
    s.scanStrength = smoothstep(2.4, 2.7, P) * (1 - smoothstep(3.6, 3.9, P));
    s.checkedU = s.scanU;

    // in the hero a slow ambient sweep keeps the model quietly alive
    const ambient = !reduceMotion() && !document.hidden && P < 0.9;
    if (ambient) {
      const t = ((now - started) % AMBIENT_CYCLE) / AMBIENT_CYCLE;
      if (t < 0.66) {
        s.scanU = lerp(-0.28, 1.28, easeInOut(t / 0.66));
        s.scanStrength = 0.55 * (1 - smoothstep(0.15, 0.85, P));
        s.checkedU = -1;
      }
    }

    // intro: the stack assembles itself the first time the page loads at the top
    if (introOn) {
      if (reduceMotion() || P > 1) introOn = false;
      else {
        const t = clamp((now - started) / INTRO_MS);
        const e = 1 - Math.pow(1 - t, 3);
        s.explode = lerp(Math.max(s.explode, 0.75), s.explode, e);
        s.labels *= e;
        if (t >= 1) introOn = false;
      }
    }

    const res = scene.setState(s);
    if (res) {
      if (cChecked && shown.c !== res.checked) { shown.c = res.checked; cChecked.textContent = String(res.checked); }
      if (cFind && shown.f !== res.findings) { shown.f = res.findings; cFind.textContent = String(res.findings); }
    }

    const li = Math.round(E);
    if (li !== curLabel) { curLabel = li; if (stateEl) stateEl.textContent = STATE_LABELS[li]; }

    // "current" step: matches the nav (same reading line, same chapter boundaries)
    const cur = Math.min(ch.indexAt(), last);
    if (cur !== curStep) {
      if (curStep >= 0) steps[curStep].classList.remove('is-current');
      steps[cur].classList.add('is-current');
      curStep = cur;
    }

    if (ambient || introOn) request();
  }

  function request() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }

  function relayout() { measure(); request(); }

  // ---- go
  build();
  measure();
  started = performance.now();
  request();

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', relayout);
  window.addEventListener('load', relayout);
  document.addEventListener('visibilitychange', request);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(stepsWrap);

  const onBreakpoint = () => { build(); relayout(); };
  if (mqWide.addEventListener) mqWide.addEventListener('change', onBreakpoint);
  else mqWide.addListener(onBreakpoint);
}
