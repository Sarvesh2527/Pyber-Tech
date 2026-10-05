// Pixel-based WCAG contrast audit.
// For every visible piece of text in the viewport: take its computed colour (with opacity),
// repaint the page with the text made transparent, sample the real pixels behind the text,
// and compute the worst-case contrast ratio. Works through gradients, glows and pseudo-elements,
// which axe cannot resolve.
//
// usage: node qa/contrast.mjs <w> <h> [mode]
//   mode: scroll (default) | explorer | method | report | dialog | all
import { launch } from './browser.mjs';
import path from 'node:path';

const [, , W = '1440', H = '900', MODE = 'all'] = process.argv;
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: +W, height: +H, deviceScaleFactor: 1 });
await p.goto('file://' + path.resolve(process.env.PAGE || 'dist/standalone.html'), { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(1000);

// ---------------------------------------------------------------- in-page helpers
await p.evaluate(() => {
  window.__collect = () => {
    const vw = innerWidth, vh = innerHeight;
    const out = [];
    const parseColor = (s) => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    };
    const opacityChain = (el) => {
      let o = 1;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const cs = getComputedStyle(n);
        o *= parseFloat(cs.opacity);
        if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      }
      return o;
    };
    const label = (el) => {
      let s = el.tagName.toLowerCase();
      if (el.id) s += '#' + el.id;
      const c = typeof el.className === 'string' ? el.className : el.className && el.className.baseVal;
      if (c) s += '.' + c.trim().split(/\s+/).slice(0, 3).join('.');
      return s;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let node;
    while ((node = walker.nextNode())) {
      const txt = node.nodeValue.replace(/\s+/g, ' ').trim();
      if (!txt) continue;
      const el = node.parentElement;
      if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE'].includes(el.tagName)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
      if (!rects.length) continue;
      const rr = rects.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }), { left: 1e9, top: 1e9, right: -1e9, bottom: -1e9 });
      // visible part only (and not the strip hidden under the fixed nav)
      const nav = document.querySelector('.nav');
      const navB = nav && !nav.contains(el) ? nav.getBoundingClientRect().bottom : 0;
      const L = Math.max(0, rr.left), T = Math.max(navB, rr.top), R = Math.min(vw, rr.right), B = Math.min(vh, rr.bottom);
      if (R - L < 2 || B - T < 2) continue;
      const cs = getComputedStyle(el);
      const isSvg = el instanceof SVGElement;
      const col = parseColor(isSvg ? cs.fill : cs.color);
      if (!col) continue;
      let alpha = col.a * opacityChain(el);
      if (isSvg) alpha *= parseFloat(cs.fillOpacity || '1');
      if (alpha <= 0.01) continue;
      const key = label(el) + '|' + txt.slice(0, 24) + '|' + Math.round(L) + ',' + Math.round(T);
      if (seen.has(key)) continue;
      seen.add(key);
      const size = parseFloat(cs.fontSize) * (isSvg ? (el.getBoundingClientRect().height / (parseFloat(cs.fontSize) * 1.2 || 1) > 0 ? 1 : 1) : 1);
      // SVG text is scaled by the viewBox: measure the rendered glyph box instead
      let px = parseFloat(cs.fontSize);
      if (isSvg) {
        const ctm = el.getScreenCTM && el.getScreenCTM();
        if (ctm) px = px * Math.hypot(ctm.a, ctm.b);
      }
      out.push({
        sel: label(el), text: txt.slice(0, 40), L, T, R, B,
        color: col, alpha, px, weight: parseInt(cs.fontWeight, 10) || 400,
        svg: isSvg,
        // hit-test: is it covered by something else (fixed nav, sticky stage, dialog backdrop…)?
        hit: (() => {
          const cx = (L + R) / 2, cy = (T + B) / 2;
          const top = document.elementFromPoint(cx, cy);
          if (!top) return false;
          return top === el || el.contains(top) || top.contains(el);
        })(),
      });
    }
    // placeholders
    for (const inp of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
      if (inp.value) continue;
      const r = inp.getBoundingClientRect();
      if (r.width < 2 || r.bottom < 0 || r.top > vh) continue;
      const cs = getComputedStyle(inp, '::placeholder');
      const col = parseColor(cs.color);
      const base = getComputedStyle(inp);
      const nv = document.querySelector('.nav');
      const nb = nv ? nv.getBoundingClientRect().bottom : 0;
      if (r.top + 28 <= nb + 2) continue;
      out.push({
        sel: label(inp) + '::placeholder', text: inp.getAttribute('placeholder'), L: r.left + 12, T: Math.max(nb, r.top + 8), R: Math.min(r.right - 12, r.left + 140), B: Math.min(vh, r.top + 28),
        color: col, alpha: col.a * opacityChain(inp), px: parseFloat(base.fontSize), weight: 400, svg: false, hit: true,
      });
    }
    return out;
  };
  window.__hide = (on) => {
    let s = document.getElementById('__hide');
    if (on && !s) {
      s = document.createElement('style');
      s.id = '__hide';
      s.textContent = '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;transition:none!important;animation:none!important;caret-color:transparent!important} svg text{fill:transparent!important;stroke:none!important} ::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}';
      document.head.append(s);
    } else if (!on && s) s.remove();
  };
  window.__measure = async (b64, items) => {
    const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
    const bmp = await createImageBitmap(blob);
    const cv = new OffscreenCanvas(bmp.width, bmp.height);
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(bmp, 0, 0);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ratio = (a, b) => { const hi = Math.max(a, b), lo = Math.min(a, b); return (hi + 0.05) / (lo + 0.05); };
    return items.map((it) => {
      const w = Math.max(1, Math.round(it.R - it.L)), h = Math.max(1, Math.round(it.B - it.T));
      const cols = Math.min(24, w), rows = Math.min(6, h);
      let worst = 99, worstBg = null;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = Math.min(bmp.width - 1, Math.floor(it.L + ((i + 0.5) / cols) * w));
          const y = Math.min(bmp.height - 1, Math.floor(it.T + ((j + 0.5) / rows) * h));
          const d = cx.getImageData(x, y, 1, 1).data;
          const a = it.alpha;
          const fr = it.color.r * a + d[0] * (1 - a), fg = it.color.g * a + d[1] * (1 - a), fb = it.color.b * a + d[2] * (1 - a);
          const c = ratio(lum(fr, fg, fb), lum(d[0], d[1], d[2]));
          if (c < worst) { worst = c; worstBg = [d[0], d[1], d[2]]; }
        }
      }
      return { ...it, ratio: worst, bg: worstBg };
    });
  };
});

const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const hexA = (a) => '#' + a.map((v) => v.toString(16).padStart(2, '0')).join('');
const problems = new Map();
let checked = 0;

async function audit(tag) {
  const items = await p.evaluate(() => window.__collect());
  const slug = tag.replace(/[^a-z0-9]+/gi, '_');
  if (process.env.SHOT) await p.screenshot({ path: `qa/shots/c-${slug}.png` });
  await p.evaluate(() => window.__hide(true));
  await wait(120);
  const png = await p.screenshot({ type: 'png', encoding: 'base64' });
  if (process.env.SHOT) await p.screenshot({ path: `qa/shots/c-${slug}-hidden.png` });
  await p.evaluate(() => window.__hide(false));
  const live = items.filter((i) => i.hit);
  const res = await p.evaluate((b64, items) => window.__measure(b64, items), png, live);
  for (const r of res) {
    checked++;
    const large = r.px >= 24 || (r.px >= 18.66 && r.weight >= 700);
    const need = large ? 3 : 4.5;
    if (r.ratio + 0.005 < need) {
      const key = r.sel + '|' + r.text;
      const prev = problems.get(key);
      if (!prev || r.ratio < prev.ratio) {
        problems.set(key, { ...r, need, tag });
      }
    }
  }
}

async function scrollStops() {
  const total = await p.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.round(+H * 0.6);
  for (let y = 0, i = 0; y < total; y += step, i++) {
    await p.evaluate((y) => window.scrollTo(0, y), y);
    await wait(1150);   // let reveal transitions finish
    await audit(`scroll ${y}`);
  }
}
async function goTo(id, extra = 0) {
  await p.evaluate((id, extra) => { const el = document.getElementById(id); window.scrollTo(0, scrollY + el.getBoundingClientRect().top - 68 + extra); }, id, extra);
  await wait(900);
}

async function storyRests() {
  const n = await p.evaluate(() => document.querySelectorAll('.step[data-step]').length);
  for (let k = 0; k < n; k++) {
    // same maths as story.js: park the reading line on the centre of step k's content
    await p.evaluate((k) => {
      const steps = [...document.querySelectorAll('.step[data-step]')];
      const s = steps[k];
      const a = s.firstElementChild.getBoundingClientRect(), b = s.lastElementChild.getBoundingClientRect();
      const anchor = scrollY + (a.top + b.bottom) / 2;
      const nav = document.querySelector('#nav').offsetHeight;
      const vh = innerHeight;
      let line;
      if (matchMedia('(min-width: 1024px)').matches) line = nav + (vh - nav) * 0.5;
      else { const sb = nav + document.querySelector('.story__stage').offsetHeight; line = sb + (vh - sb) * 0.4; }
      window.scrollTo(0, Math.max(0, anchor - line));
    }, k);
    await wait(1400);
    await audit(`story rest ${k}`);
  }
}

if (['rests', 'all'].includes(MODE)) await storyRests();
if (['scroll', 'all'].includes(MODE)) await scrollStops();

if (['explorer', 'all'].includes(MODE)) {
  await goTo('explorer', 330);
  for (const id of ['web', 'webapp', 'api', 'mobile', 'cloud', 'network']) await p.click(`.area[data-area="${id}"]`).catch(() => {});
  await wait(600);
  await audit('explorer selected');
  await p.evaluate(() => window.scrollBy(0, 360));
  await wait(500);
  await audit('explorer panel');
}
if (['method', 'all'].includes(MODE)) {
  await goTo('method', 100);
  await p.click('.phase:nth-child(2) .phase__toggle').catch(() => {});
  await wait(800);
  await audit('method open');
  await p.evaluate(() => window.scrollBy(0, 420));
  await wait(500);
  await audit('method open (lower)');
}
if (['report', 'all'].includes(MODE)) {
  await goTo('report', 90);
  await p.click('.seg__btn[data-view="tech"]').catch(() => {});
  await wait(700);
  await audit('report tech');
  await p.evaluate(() => window.scrollBy(0, 400));
  await wait(500);
  await audit('report tech (lower)');
}
if (['dialog', 'all'].includes(MODE)) {
  await p.evaluate(() => window.scrollTo(0, 0));
  await wait(500);
  await p.click('[data-open-index]').catch(() => {});
  await wait(800);
  await audit('index dialog');
  await p.keyboard.press('Escape');
}

console.log(`${W}x${H} · mode=${MODE} · ${checked} text samples checked`);
const list = [...problems.values()].sort((a, b) => a.ratio - b.ratio);
if (!list.length) console.log('All text meets WCAG AA (4.5:1 body, 3:1 large).');
for (const r of list) {
  console.log(`${r.ratio.toFixed(2)} < ${r.need}  ${r.sel}  "${r.text}"  fg ${hex(r.color)}${r.alpha < 0.999 ? ' @' + r.alpha.toFixed(2) : ''} on ${hexA(r.bg)}  ${r.px.toFixed(1)}px/${r.weight}  [${r.tag}]`);
}
await b.close();
