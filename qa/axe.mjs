// Run axe-core against the built standalone page at a given viewport.
// usage: node qa/axe.mjs <w> <h> [scrollTo]
import { launch } from './browser.mjs';
import path from 'node:path';
import fs from 'node:fs';

const [,, w = '1440', h = '900'] = process.argv;
const axeSrc = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
await p.goto('file://' + path.resolve(process.env.PAGE || 'dist/standalone.html'), { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 1200));
await p.evaluate(axeSrc);

// Run with the scene in several scroll positions so state-dependent text is checked too.
const stops = (process.env.STOPS || '0,1,2,3,4,5').split(',').map(Number);
const seen = new Map();
for (const s of stops) {
  await p.evaluate((s) => {
    const el = s === 0 ? document.getElementById('top') : document.getElementById('step-' + s);
    if (el) window.scrollTo(0, scrollY + el.getBoundingClientRect().top + el.offsetHeight / 2 - innerHeight / 2);
  }, s);
  await new Promise((r) => setTimeout(r, 900));
  const res = await p.evaluate(async () => {
    const r = await axe.run(document, { resultTypes: ['violations', 'incomplete'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    const map = (arr) => arr.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 60).map((n) => ({ t: n.target.join(' '), s: (n.failureSummary || '').split('\n').slice(1, 3).join(' | ').slice(0, 220), h: n.html.slice(0, 120) })), count: v.nodes.length }));
    return { v: map(r.violations), i: map(r.incomplete) };
  });
  for (const kind of ['v', 'i']) {
    for (const item of res[kind]) {
      const key = kind + ':' + item.id;
      if (!seen.has(key)) seen.set(key, { ...item, kind, stops: [s] }); else seen.get(key).stops.push(s);
    }
  }
}
console.log(`viewport ${w}x${h}`);
for (const item of seen.values()) {
  console.log(`\n[${item.kind === 'v' ? 'VIOLATION' : 'needs-review'}] ${item.id} (${item.impact}) ×${item.count} @stops ${item.stops.join(',')}\n  ${item.help}`);
  for (const n of item.nodes) console.log(`   - ${n.t}\n     ${n.h}\n     ${n.s}`);
}
if (!seen.size) console.log('no violations, nothing to review');
await b.close();
