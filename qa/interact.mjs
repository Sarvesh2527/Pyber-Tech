// Interaction tests against the built standalone page.
import { launch } from './browser.mjs';
import path from 'node:path';
import fs from 'node:fs';

const OUT = path.resolve('qa/shots');
fs.mkdirSync(OUT, { recursive: true });
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900), TAG = process.argv[4] || 'i';

const b = await launch();
const ctx = b.defaultBrowserContext();
try { await ctx.overridePermissions('file://', ['clipboard-read', 'clipboard-write']); } catch (_) {}
const p = await b.newPage();
await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const logs = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
p.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await p.goto('file://' + path.resolve(process.env.PAGE || 'dist/standalone.html'), { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(800);

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { (ok ? pass++ : fail++); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const shot = (n) => p.screenshot({ path: path.join(OUT, `${TAG}-${n}.png`) });
const scrollToId = async (id, extra = 0) => {
  await p.evaluate((id, extra) => { const el = document.getElementById(id); window.scrollTo(0, scrollY + el.getBoundingClientRect().top - 68 + extra); }, id, extra);
  await wait(900);
};

// ---- 1. explorer
await scrollToId('explorer', 330);
const pressed = () => p.$$eval('.area', (b) => b.map((x) => x.getAttribute('aria-pressed')));
check('explorer renders 7 areas', (await pressed()).length === 7);
await p.click('.area[data-area="web"]');
await wait(500);
check('Website selected', (await pressed())[0] === 'true');
check('panel shows Website', (await p.$eval('.panel__body h3', (e) => e.textContent)) === 'Website');
await p.click('.area[data-area="api"]');
await p.click('.area[data-area="cloud"]');
await wait(500);
const tabs = await p.$$eval('.ptab', (t) => t.map((x) => x.textContent));
check('tabs appear for 3 selections', tabs.length === 3, tabs.join(' | '));
check('focus follows last pick (Cloud setup)', (await p.$eval('.panel__body h3', (e) => e.textContent)) === 'Cloud setup');
await p.click('.ptab:nth-child(1)');
await wait(500);
check('tab switches the panel back to Website', (await p.$eval('.panel__body h3', (e) => e.textContent)) === 'Website');
const litLayers = await p.$$eval('.panel__stack .s-layer.is-on', (l) => l.map((x) => x.dataset.layer));
check('mini model lights web, api, cloud', ['web', 'api', 'cloud'].every((x) => litLayers.includes(x)) && !litLayers.includes('login'), litLayers.join(','));
await shot('explorer-selected');
await p.click('.area[data-area="unsure"]');
await wait(400);
const pr = await pressed();
check('"Not sure yet" is exclusive', pr.filter((x) => x === 'true').length === 1 && pr[6] === 'true');
await p.click('.area[data-area="unsure"]');
await p.click('.area[data-area="webapp"]');
await p.click('.area[data-area="mobile"]');
await wait(300);

// ---- 2. method accordion
await scrollToId('method', 100);
await p.click('.phase:nth-child(2) .phase__toggle');
await wait(700);
const exp = await p.$$eval('.phase__toggle', (b) => b.map((x) => x.getAttribute('aria-expanded')));
check('accordion opens step 2 and closes step 1', exp.join() === 'false,true,false', exp.join());
await shot('method-open');

// ---- 3. report toggle
await scrollToId('report', 90);
await p.click('.seg__btn[data-view="tech"]');
await wait(600);
check('Technical view active', await p.$eval('[data-pane="tech"]', (e) => e.classList.contains('is-active')));
check('Plain view hidden from AT', (await p.$eval('[data-pane="plain"]', (e) => e.getAttribute('aria-hidden'))) === 'true');
await shot('report-tech');
await p.click('.seg__btn[data-view="plain"]');
await wait(400);

// ---- 4. brief
await scrollToId('start', 280);
const chips = await p.$$eval('.chip', (b) => b.map((x) => x.getAttribute('aria-pressed')));
check('brief chips mirror the explorer (webapp, mobile)', chips[1] === 'true' && chips[3] === 'true' && chips[0] === 'false', chips.join());
await p.type('#brief-name', 'Asha Rao');
await p.type('#brief-company', 'Northwind Labs');
await p.type('#brief-site', 'northwind.example');
await p.type('#brief-notes', 'Launching in six weeks.');
await wait(300);
const body = await p.$eval('.preview__body', (e) => e.textContent);
const subj = await p.$eval('.preview__meta dd:nth-of-type(1)', (e) => e.textContent);
check('preview lists chosen areas', body.includes('- Web app or SaaS') && body.includes('- Mobile app'));
check('preview includes details', body.includes('Name: Asha Rao') && body.includes('Company: Northwind Labs') && body.includes('Web address: northwind.example') && body.includes('Launching in six weeks.'));
const href = await p.$eval('.brief__primary .btn:not(.btn--ghost)', (a) => a.getAttribute('href'));
check('mailto goes to techpyber@gmail.com', href.startsWith('mailto:techpyber@gmail.com?subject='));
check('mailto body uses CRLF', href.includes('%0D%0A') && !/%0A(?<!%0D%0A)/.test(href.replace(/%0D%0A/g, '')));
console.log('      subject:', decodeURIComponent(href.split('subject=')[1].split('&')[0]));
const gm = await p.$eval('.brief__primary .btn--ghost', (a) => a.getAttribute('href'));
check('gmail compose url', gm.startsWith('https://mail.google.com/mail/?view=cm') && gm.includes('to=techpyber%40gmail.com'));
await shot('brief-filled');
await p.click('.brief__secondary .link-act:nth-child(1)');
await wait(500);
const note = await p.$eval('.brief__note', (e) => e.textContent);
check('copy gives feedback', /Copied|Couldn/.test(note), note);
const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => 'n/a'));
console.log('      clipboard:', clip === 'n/a' ? 'n/a (headless)' : JSON.stringify(clip.slice(0, 60)));

// ---- 5. index dialog + smooth scroll
await p.evaluate(() => window.scrollTo(0, 0));
await wait(600);
await p.click('[data-open-index]');
await wait(700);
check('index dialog opens', await p.$eval('#index-dialog', (d) => d.open));
const items = await p.$$eval('.index__list a', (a) => a.length);
check('index lists 11 questions', items === 11, String(items));
await shot('index-open');
await p.keyboard.press('Escape');
await wait(300);
check('Escape closes dialog', !(await p.$eval('#index-dialog', (d) => d.open)));
await p.click('[data-open-index]');
await wait(500);
await p.click('.index__list li:nth-child(8) a');
await wait(2200);
check('index link closes dialog', !(await p.$eval('#index-dialog', (d) => d.open)));
const y8 = await p.evaluate(() => Math.round(document.getElementById('method').getBoundingClientRect().top));
check('smooth-scrolled to #method', Math.abs(y8 - 68) < 6, `top=${y8}`);
check('hash updated', (await p.evaluate(() => location.hash)) === '#method');
check('target received focus', await p.evaluate(() => document.activeElement === document.getElementById('method')));
await p.click('.nav [data-cta]');
await wait(2600);
const yS = await p.evaluate(() => Math.round(document.getElementById('start').getBoundingClientRect().top));
check('nav CTA scrolls to #start', Math.abs(yS - 68) < 8, `top=${yS}`);
const navText = await p.$eval('[data-nav-text]', (e) => e.textContent);
console.log('      nav shows:', navText);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(logs.length ? logs.join('\n') : 'no console errors');
await b.close();
