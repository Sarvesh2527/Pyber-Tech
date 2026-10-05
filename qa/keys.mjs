// Keyboard audit: tab through the whole page.
//  · lists the tab order
//  · checks every stop shows a visible focus indicator (pixel diff of focused vs blurred)
//  · checks the focused element is not hidden under the fixed nav / sticky stage (WCAG 2.4.11)
//  · checks the dialog traps focus and returns it on close
// usage: node qa/keys.mjs <w> <h>
import { launch } from './browser.mjs';
import path from 'node:path';

const [, , W = '1440', H = '900'] = process.argv;
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: +W, height: +H, deviceScaleFactor: 1 });
await p.goto('file://' + path.resolve(process.env.PAGE || 'dist/standalone.html'), { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(900);

await p.evaluate(() => {
  window.__desc = (el) => {
    if (!el || el === document.body) return 'body';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    if (c) s += '.' + c;
    const t = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('href') || '').replace(/\s+/g, ' ').trim().slice(0, 34);
    return s + ' "' + t + '"';
  };
  window.__diff = async (a64, b64, rect) => {
    const load = async (b64) => createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const [A, B] = await Promise.all([load(a64), load(b64)]);
    const c1 = new OffscreenCanvas(A.width, A.height).getContext('2d', { willReadFrequently: true });
    const c2 = new OffscreenCanvas(B.width, B.height).getContext('2d', { willReadFrequently: true });
    c1.drawImage(A, 0, 0); c2.drawImage(B, 0, 0);
    const d1 = c1.getImageData(0, 0, A.width, A.height).data, d2 = c2.getImageData(0, 0, B.width, B.height).data;
    let n = 0;
    for (let i = 0; i < d1.length; i += 4) if (Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]) > 36) n++;
    return n;
  };
});

const rows = [];
const MAX = 90;
await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
await p.keyboard.press('Tab'); // first stop: should be the skip link
for (let i = 0; i < MAX; i++) {
  await wait(900);
  const info = await p.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const r = el.getBoundingClientRect();
    const nav = document.querySelector('.nav');
    const navB = nav ? nav.getBoundingClientRect().bottom : 0;
    const cs = getComputedStyle(el);
    return {
      d: window.__desc(el),
      rect: { x: r.left, y: r.top, w: r.width, h: r.height },
      navB, vh: innerHeight, sy: scrollY, sx: scrollX,
      outline: cs.outlineStyle + ' ' + cs.outlineWidth,
      inNav: !!el.closest('.nav'),
      inDialog: !!el.closest('dialog'),
      wrapped: !!el.closest('.btn-shell'),
    };
  });
  if (!info) break;
  // visible-focus test
  const pad = 14;
  const clip = { x: Math.max(0, info.rect.x + info.sx - pad), y: Math.max(0, info.rect.y + info.sy - pad), width: Math.min(+W, info.rect.w + pad * 2), height: Math.min(+H, info.rect.h + pad * 2) };
  let diff = -1;
  if (clip.width > 2 && clip.height > 2 && info.rect.y + info.rect.h > 0 && info.rect.y < +H) {
    const withFocus = await p.screenshot({ clip, encoding: 'base64' });
    await p.evaluate(() => { window.__ae = document.activeElement; window.__ae.blur(); });
    await wait(260);
    const without = await p.screenshot({ clip, encoding: 'base64' });
    await p.evaluate(() => { window.__ae.focus({ preventScroll: true }); });
    await wait(260);
    diff = await p.evaluate((a, b) => window.__diff(a, b), withFocus, without);
  }
  const hidden = !info.inNav && info.rect.y < info.navB - 1 && info.rect.y + info.rect.h > 0;
  rows.push({ ...info, diff, hidden });
  const prev = info.d;
  await p.keyboard.press('Tab');
  const again = await p.evaluate(() => window.__desc(document.activeElement));
  if (again === rows[0].d && i > 3) break; // wrapped around
}

console.log(`${W}x${H} — ${rows.length} tab stops`);
for (const [i, r] of rows.entries()) {
  const flags = [];
  if (r.diff === 0) flags.push('NO VISIBLE FOCUS');
  if (r.hidden) flags.push('UNDER NAV');
  console.log(`${String(i + 1).padStart(2)}. ${r.d.padEnd(70)} Δ${String(r.diff).padStart(5)}  ${flags.join(' · ')}`);
}

// dialog behaviour
await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
await wait(400);
await p.focus('[data-open-index]');
await p.keyboard.press('Enter');
await wait(700);
const seen = new Set();
let inside = true;
for (let i = 0; i < 16; i++) {
  await p.keyboard.press('Tab');
  const s = await p.evaluate(() => ({ d: window.__desc(document.activeElement), in: !!document.activeElement.closest('dialog') }));
  seen.add(s.d);
  if (!s.in && s.d !== 'body') inside = false;
}
console.log(`\ndialog: focus stays inside while open → ${inside ? 'PASS' : 'FAIL'} (${seen.size} distinct stops)`);
await p.keyboard.press('Escape');
await wait(400);
const back = await p.evaluate(() => window.__desc(document.activeElement));
console.log(`dialog: focus returns to opener → ${back.includes('nav__index') ? 'PASS' : 'FAIL'} (${back})`);
await b.close();
