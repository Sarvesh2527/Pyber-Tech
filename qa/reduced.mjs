import { launch } from './browser.mjs';
import path from 'node:path';
const b = await launch();
async function run(reduce) {
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
  await p.goto('file://' + path.resolve(process.env.PAGE || 'dist/standalone.html'), { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 2200));      // let the intro finish
  const clip = { x: 736, y: 80, width: 624, height: 800 };
  const a = await p.screenshot({ clip, encoding: 'base64' });
  await new Promise((r) => setTimeout(r, 1500));
  const c = await p.screenshot({ clip, encoding: 'base64' });
  const diff = await p.evaluate(async (a, c) => {
    const load = async (b64) => createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const [A, B] = await Promise.all([load(a), load(c)]);
    const g = (im) => { const cx = new OffscreenCanvas(im.width, im.height).getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0); return cx.getImageData(0, 0, im.width, im.height).data; };
    const d1 = g(A), d2 = g(B); let n = 0;
    for (let i = 0; i < d1.length; i += 4) if (Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]) > 30) n++;
    return n;
  }, a, c);
  const info = await p.evaluate(() => ({
    behavior: getComputedStyle(document.documentElement).scrollBehavior,
    pulse: getComputedStyle(document.querySelector('.stage__pulse')).animationName,
    revealHidden: [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity < 0.99).length,
    revealTotal: document.querySelectorAll('[data-reveal]').length,
  }));
  await p.close();
  return { diff, ...info };
}
console.log('no-preference →', JSON.stringify(await run(false)));
console.log('reduce        →', JSON.stringify(await run(true)));
await b.close();
