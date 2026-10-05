import { launch } from './browser.mjs';
import path from 'node:path';
const W = +(process.argv[2] || 390), H = +(process.argv[3] || 844);
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: W, height: H, deviceScaleFactor: 1, isMobile: W < 700, hasTouch: W < 700 });
await p.goto('file://' + path.resolve(process.env.PAGE || 'dist/standalone.html'), { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 800));
const res = await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('a[href], button, input, textarea, select, summary, [role="button"], [tabindex]:not([tabindex="-1"])')) {
    if (el.closest('dialog:not([open])')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    // inline links inside running text are exempt (WCAG 2.5.8 "inline" exception)
    const inline = cs.display === 'inline' && el.closest('p, li');
    out.push({ d: el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '') + ' "' + (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 26) + '"', w: Math.round(r.width), h: Math.round(r.height), inline: !!inline });
  }
  return out;
});
const small = res.filter((r) => !r.inline && (r.w < 44 || r.h < 44));
console.log(`${W}x${H}: ${res.length} targets, ${small.length} under 44px (non-inline)`);
for (const r of small) console.log(`  ${r.w}x${r.h}  ${r.d}`);
const tiny = res.filter((r) => !r.inline && (r.w < 24 || r.h < 24));
console.log(`under 24px (WCAG 2.2 AA minimum): ${tiny.length}`);
await b.close();
