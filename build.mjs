// Build: bundles CSS + JS and writes two outputs.
//   dist/standalone.html  — one self-contained file (fonts, logo and code inlined)
//   dist/artifact.html    — the same page as a fragment, for hosts that provide their own document shell
//   dist/site/            — the deployable multi-file site (index.html + assets/)
//
// Usage: node build.mjs

import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const SITE = path.join(DIST, 'site');

const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(path.join(SITE, 'assets'), { recursive: true });

// ---------------------------------------------------------------- JavaScript
const jsResult = await build({
  entryPoints: [path.join(SRC, 'js/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  legalComments: 'none',
  write: false,
});
const js = jsResult.outputFiles[0].text;

// ------------------------------------------------------------------------ CSS
const cssInlineResult = await build({
  entryPoints: [path.join(SRC, 'css/main.css')],
  bundle: true,
  minify: true,
  loader: { '.woff2': 'dataurl' },
  write: false,
});
const cssInline = cssInlineResult.outputFiles[0].text;

await build({
  entryPoints: [path.join(SRC, 'css/main.css')],
  bundle: true,
  minify: true,
  loader: { '.woff2': 'file' },
  assetNames: 'fonts/[name]',
  outfile: path.join(SITE, 'assets/app.css'),
  logLevel: 'warning',
});

// ----------------------------------------------------------------------- HTML
const template = await fs.readFile(path.join(SRC, 'index.html'), 'utf8');
const devBlock = /<!-- dev-only:start -->[\s\S]*?<!-- dev-only:end -->\n?/;
const devMarkers = /<!-- dev-only:(start|end) -->\n?/g;
const safeScript = (code) => code.replace(/<\/script/gi, '<\\/script');

// 1 · standalone: everything inlined
const dataUri = async (rel) => {
  const buf = await fs.readFile(path.join(SRC, rel));
  return `data:${MIME[path.extname(rel)]};base64,${buf.toString('base64')}`;
};
let standalone = template
  .replace(devBlock, '')
  .replace('<!-- inject:css -->', () => `<style>${cssInline}</style>`)
  .replace('<!-- inject:js -->', () => `<script>${safeScript(js)}</script>`);

const assetRefs = [...new Set([...standalone.matchAll(/assets\/logo\/[\w.-]+\.(?:webp|png|svg)/g)].map((m) => m[0]))];
for (const ref of assetRefs) standalone = standalone.split(ref).join(await dataUri(ref));
await fs.writeFile(path.join(DIST, 'standalone.html'), standalone);

// 2 · artifact fragment: for hosts (like Claude artifacts) that supply the <html>/<head>/<body> shell
const bodyInner = standalone.match(/<body>([\s\S]*)<\/body>/)[1].trim();
const fragment = [
  '<title>Pyber Solution</title>',
  `<style>${cssInline}</style>`,
  '<script>document.documentElement.classList.add("js");document.documentElement.lang=document.documentElement.lang||"en"</script>',
  bodyInner,
].join('\n') + '\n';
await fs.writeFile(path.join(DIST, 'artifact.html'), fragment);

// 3 · deployable site: external CSS/JS + the logo files
let site = template
  .replace(devMarkers, '')
  .replace('<!-- inject:css -->', () => '<link rel="stylesheet" href="assets/app.css">')
  .replace('<!-- inject:js -->', () => '<script src="assets/app.js" defer></script>');
await fs.writeFile(path.join(SITE, 'index.html'), site);
await fs.writeFile(path.join(SITE, 'assets/app.js'), js);
await fs.cp(path.join(SRC, 'assets/logo'), path.join(SITE, 'assets/logo'), { recursive: true });
// the fonts are SIL OFL 1.1: ship their licences next to them
for (const f of await fs.readdir(path.join(SRC, 'assets/fonts'))) {
  if (f.startsWith('LICENSE')) await fs.cp(path.join(SRC, 'assets/fonts', f), path.join(SITE, 'assets/fonts', f));
}

// ---------------------------------------------------------------------- report
const size = async (p) => (await fs.stat(p)).size;
console.log('built');
console.log('  standalone.html', kb(await size(path.join(DIST, 'standalone.html'))));
console.log('  artifact.html  ', kb(await size(path.join(DIST, 'artifact.html'))));
console.log('  site/assets/app.js ', kb(await size(path.join(SITE, 'assets/app.js'))));
console.log('  site/assets/app.css', kb(await size(path.join(SITE, 'assets/app.css'))));
console.log('  JS (min)', kb(js.length), ' CSS (min, inlined fonts)', kb(cssInline.length));
