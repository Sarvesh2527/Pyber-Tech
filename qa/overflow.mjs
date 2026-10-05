// Find elements that stick out past the viewport (horizontal overflow culprits).
// usage: node qa/overflow.mjs <w> [h]
import { launch } from './browser.mjs';
import path from 'node:path';

const [,, w = '390', h = '844'] = process.argv;
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
await p.goto('file://' + path.resolve(process.env.PAGE || 'dist/standalone.html'), { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 1500));

const res = await p.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' && el.closest('dialog')) continue;
      out.push({
        el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
      });
    }
  }
  return { vw, scrollW: document.documentElement.scrollWidth, out: out.slice(0, 40) };
});
console.log(JSON.stringify(res, null, 1));
await b.close();
