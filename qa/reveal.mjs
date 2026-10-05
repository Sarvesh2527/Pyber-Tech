// The page must be complete at rest, and blocks must still arrive as the visitor scrolls.
import { launch } from './browser.mjs';
import path from 'node:path';
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900);
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await p.goto('file://' + path.resolve(process.env.PAGE || 'dist/standalone.html'), { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(1200);
const stats = () => p.evaluate(() => {
  const els = [...document.querySelectorAll('[data-reveal]')];
  const op = els.map((e) => +getComputedStyle(e).opacity);
  const bars = [...document.querySelectorAll('.phase')].map((e) => e.classList.contains('is-pending'));
  return { total: els.length, hidden: op.filter((o) => o < 0.99).length, pending: els.filter((e) => e.classList.contains('is-pending')).length, barsPending: bars.filter(Boolean).length };
});
let ok = true;
const check = (name, cond, extra = '') => { if (!cond) ok = false; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

let s = await stats();
check('at rest: every block is visible (no scroll yet)', s.hidden === 0 && s.pending === 0, JSON.stringify(s));

await p.evaluate(() => window.scrollBy(0, 6));
await wait(1000);
s = await stats();
check('after first scroll: blocks below the fold are tucked away', s.pending > 0 && s.hidden > 0, JSON.stringify(s));

// scroll down in steps like a reader; at each stop, whatever is in view must be visible
let bad = 0;
const total = await p.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < total; y += Math.round(H * 0.5)) {
  await p.evaluate((y) => window.scrollTo(0, y), y);
  await wait(900);
  const inView = await p.evaluate(() => {
    const vh = innerHeight;
    return [...document.querySelectorAll('[data-reveal]')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.top < vh * 0.85 && r.bottom > 80 && +getComputedStyle(e).opacity < 0.99;
    }).map((e) => (e.className || e.tagName).toString().slice(0, 30));
  });
  if (inView.length) { bad++; console.log('   not yet visible at', y, inView.join(' | ')); }
}
check('scrolling: everything in view is revealed', bad === 0, `${bad} stops with hidden content`);

// jump straight to the end (End key / anchor): the destination must show up
await p.evaluate(() => window.scrollTo(0, 0));
await wait(600);
await p.evaluate(() => window.scrollBy(0, 4));
await wait(500);
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await wait(1400);
const endHidden = await p.evaluate(() => {
  const vh = innerHeight;
  return [...document.querySelectorAll('[data-reveal]')].filter((e) => { const r = e.getBoundingClientRect(); return r.top < vh && r.bottom > 0 && +getComputedStyle(e).opacity < 0.99; }).length;
});
check('jump to the end: destination is revealed', endHidden === 0, `${endHidden} hidden`);
console.log(ok ? '\nall reveal checks passed' : '\nSOME CHECKS FAILED');
await b.close();
