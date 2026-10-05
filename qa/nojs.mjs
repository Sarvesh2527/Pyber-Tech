import { launch } from './browser.mjs';
import path from 'node:path';
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900);
const b = await launch();
const p = await b.newPage();
await p.setJavaScriptEnabled(false);
await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await p.goto('file://' + path.resolve(process.env.PAGE || 'dist/standalone.html'), { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready).catch(() => {});
await new Promise((r) => setTimeout(r, 800));
const info = await p.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight,
  hiddenReveal: [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity < 0.99).length,
  htmlClass: document.documentElement.className,
}));
console.log(JSON.stringify(info));
await p.screenshot({ path: `qa/shots/nojs-${W}.png`, fullPage: true });
await b.close();
