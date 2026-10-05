// Visual QA: load the built page, scroll to named positions, screenshot each.
// usage: node qa/qa.mjs <prefix> <w> <h> [dpr] [names...]
import { launch } from './browser.mjs';
import path from 'node:path';
import fs from 'node:fs';

const [,, prefix = 'd', w = '1440', h = '900', dpr = '1', ...names] = process.argv;
const OUT = path.resolve('qa/shots');
fs.mkdirSync(OUT, { recursive: true });

const FILE = path.resolve(process.env.PAGE || 'dist/standalone.html');
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: +w, height: +h, deviceScaleFactor: +dpr, isMobile: +w < 700, hasTouch: +w < 700 });

const logs = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
p.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
p.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url().slice(0, 100)}`));

await p.goto('file://' + FILE, { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 1800));   // let the intro settle

// positions: step:N → story step N centred; id → section top under nav; number → px
const targets = names.length ? names : ['top', 'step:1', 'step:2', 'step:3', 'step:4', 'step:5', 'explorer', 'method', 'report', 'trust', 'start'];

async function scrollTo(t) {
  await p.evaluate((t) => {
    const nav = document.getElementById('nav').offsetHeight;
    let y = 0;
    if (t === 'top') y = 0;
    else if (t === 'end') y = document.documentElement.scrollHeight;
    else if (t.startsWith('step:')) {
      const el = document.getElementById(t === 'step:0' ? 'top' : `step-${t.slice(5)}`);
      const wide = matchMedia('(min-width:1024px)').matches;
      const stage = document.querySelector('.story__stage');
      const off = wide ? nav : nav + stage.offsetHeight + 4;
      y = scrollY + el.getBoundingClientRect().top - off;
    } else if (/^\d+$/.test(t)) y = +t;
    else {
      const [id, extra] = t.split('+');
      const el = document.getElementById(id);
      y = scrollY + el.getBoundingClientRect().top - nav + (extra ? +extra : 0);
    }
    window.scrollTo(0, y);
  }, t);
  await new Promise((r) => setTimeout(r, 1100));
}

for (const t of targets) {
  await scrollTo(t);
  const file = path.join(OUT, `${prefix}-${t.replace(/[^\w+-]/g, '_')}.png`);
  await p.screenshot({ path: file });
  console.log('shot', path.basename(file));
}

const overflow = await p.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
  docH: document.documentElement.scrollHeight,
}));
console.log('overflow check', JSON.stringify(overflow));
console.log(logs.length ? logs.join('\n') : 'no console errors');
await b.close();
