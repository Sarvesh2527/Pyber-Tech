# Pyber Solution — website

One scroll-led page for Pyber Solution: affordable vulnerability assessment and penetration testing (VAPT) for startups and small businesses.

The page answers a visitor's questions in the order they would ask them (eleven of them, from *What is this?* to *How do I start?*) and ends in a quote brief that opens a ready-written email to **techpyber@gmail.com**.

Plain HTML, CSS and JavaScript. No framework, no runtime dependencies, no cookies, no third-party requests. About 130 KB on first load.

---

## Build and deploy

```bash
npm install
npm run build
```

| Output | What it is |
| --- | --- |
| `dist/site/` | The deployable site (`index.html` + `assets/`). Upload this folder to any static host (Netlify, Cloudflare Pages, Vercel, GitHub Pages, S3 + CDN). |
| `dist/standalone.html` | The same page as one self-contained file (fonts, logo, CSS and JS inlined). Handy for previews and sharing. |
| `dist/artifact.html` | The same page without the `<html>/<head>/<body>` shell, for hosts that supply their own (this is the file published as the Claude artifact). |

Edit files in `src/`, run `npm run build`, refresh.

---

## Before you launch — things only you can confirm

The site makes no claim it cannot back up: no customer names, testimonials, certifications, statistics, partners, awards or prices. These are the places where *you* need to confirm or add facts.

| # | Confirm / add | Where |
| --- | --- | --- |
| 1 | **Service scope.** Seven areas a visitor can pick (website, web app/SaaS, API, mobile app, cloud, network, not sure) with three "what we'd look at" lines each. This is typical VAPT scope. Keep only what you will actually test. | `src/js/content.js` → `AREAS` |
| 2 | **How it works.** Three phases (Scope, Test, Report) with "your part / our part". Check it matches how you will really run an engagement. | `src/index.html` → `#method` |
| 3 | **Trust principles.** Five promises (written permission, no surprises, honest severity, your data stays yours, plain words). Make sure you will keep each one. *"Your data stays yours"* says findings are kept only as long as the report needs them: confirm your real retention practice. | `src/index.html` → `#trust` |
| 4 | **Sample finding.** "Customers can see each other's invoices" is labelled *Illustrative example · not a real client*. Replace it with a sanitised real report when you have one. | `src/index.html` → `#report` |
| 5 | **Team and credentials.** A dashed placeholder marks where real names, experience and only the certifications you hold belong. Set `showPlaceholders: false` to hide it until then. | `src/js/content.js` → `CONFIG` |
| 6 | **Response time.** Empty on purpose, so no promise is shown. Add e.g. `'within two working days'` only if you will keep it. | `CONFIG.responseTime` |
| 7 | **Pricing.** Not shown. Nothing is invented. Add a "from" price to the `#start` intro when you are ready. | `src/index.html` → `#start` |
| 8 | **Domain.** Add the canonical URL, `og:url` and a 1200 × 630 share image (see the `TODO(domain)` comment in `<head>`). | `src/index.html` |
| 9 | **Contact address.** `techpyber@gmail.com` appears in `CONFIG.email`, the `mailto:` links in `index.html` and the JSON-LD block in `<head>`. If you move to a domain address, replace it in all three. | search `techpyber@gmail.com` |
| 10 | **Logo.** The mark and the PYBER wordmark are the supplied artwork, pixel for pixel. The second line, **SOLUTION**, is live text standing in for the old "TECH" line until the official Pyber Solution logo exists. To swap in the real one, replace the two `<a class="brand">` blocks (nav and footer) with the official logo file and delete the `.brand__sub` span. | `src/index.html`, `src/assets/logo/` |
| 11 | **Footer statement.** "Sets no cookies and loads no third-party trackers" is true of this build. If you add analytics, change it. | `src/index.html` → `<footer>` |

---

## Where to change things

| To change | Edit |
| --- | --- |
| Headlines and paragraphs | `src/index.html` |
| Company name, email, placeholder slot, response time | `src/js/content.js` → `CONFIG` |
| What can be tested, and the "what we'd look at" lines | `src/js/content.js` → `AREAS` |
| Colours, type scale, spacing, motion timings | `src/css/tokens.css` |
| The scroll-driven model (layers, nodes, the four findings, labels) | `src/js/scene.js` |
| What the model shows at each step of the story | `src/js/story.js` |
| The quote email text | `src/js/brief.js` → `compose()` |

```
src/
  index.html          all page copy and structure
  css/                tokens → base → components → stage → sections → brief
  js/                 content, scene (SVG model), story (scroll), nav, explorer,
                      method, report, brief, reveal, store (shared scope), util
  assets/fonts/       Hubot Sans + Geist Mono (SIL OFL 1.1, licences alongside)
  assets/logo/        web-ready logo files
assets/logo/          full-resolution PNG masters
build.mjs             esbuild bundler → dist/
qa/                   headless-browser checks (see below)
```

---

## Design system in brief

- **Colour.** A graphite ink scale anchored on the logo's charcoal, one signal red sampled from the mark (`#F51926` → `#D11E2C`), and the logo's own off-white (`#F8F8F8`) reserved for the final "start" section.
- **Type.** Two families only: Hubot Sans (variable; extended width for headings, echoing the wordmark) for text, Geist Mono for labels and data. Hubot Sans draws a capital "I" with slab serifs; that is the typeface's own character and is kept.
- **Spacing.** An 8-point rhythm (`--s-1` … `--s-11`), one container, one gutter.
- **Geometry.** The logo's diagonal is 30°, so 30° is the only diagonal anywhere: cut corners, the isometric model, the section transition. The three red bars of the "E" are the one recurring motif.
- **Motion.** Only where it explains something: the model assembling, a scan sweeping the layers, findings lining up into a path, the three method bars filling. Everything is switched off under `prefers-reduced-motion`.
- **The scene is labelled.** "Illustrative model · not a real company". The four findings are examples, not incidents.

---

## How the quote flow works

There is no form and no server. The visitor ticks what they want tested (the choices are shared with the explorer above), optionally adds a name, company and web address, and sees the email that will be sent. One button opens it in their mail app, another in Gmail, and there are copy fallbacks. Nothing leaves the page until they press send in their own mail client.

That keeps the site free of third-party scripts. The trade-off is that `mailto:` needs a mail app on the visitor's device, which is why the Gmail and copy options are always shown. If you later want submissions to land in a dashboard, add a form service or small backend behind the same fields.

---

## Checks

Run against the built page in headless Chromium. The scripts use the Linux browser bundled in `@sparticuz/chromium`; on macOS or Windows set `CHROME_PATH` to a local Chrome (that route is untested here). Every script takes optional arguments, e.g. `npm run qa:axe -- 390 844`.

```bash
npm run build
npm run qa:interact   # 26 checks: explorer, method, report, brief, index dialog, smooth scroll
npm run qa:axe        # axe-core, WCAG 2.2 AA
npm run qa:contrast   # pixel-level contrast of every piece of text (works through gradients)
npm run qa:keys       # tab order, visible focus, focus trap and return in the dialog
npm run qa:overflow   # any element wider than the viewport (pass a width: 320, 390, …)
npm run qa:targets    # size of every tappable thing (44 px on phones)
npm run qa:reveal     # nothing hidden at rest; blocks arrive as you scroll; jumps land on visible content
npm run qa:nojs       # renders with JavaScript off
npm run qa:motion     # reduced-motion behaviour
npm run qa:shots      # screenshots of every section into qa/shots/
```

Results on the delivered build:

- **axe-core:** 0 violations at 390, 768, 1100 and 1440 px. The remaining "needs review" items are text over gradients, which axe cannot resolve; the pixel audit covers them.
- **Contrast:** every piece of text meets 4.5:1 (3:1 for large text) at rest, checked at 390, 768, 1100, 1440 and 1920 px. While scrolling, the model's labels cross-fade, and for a moment mid-fade they are fainter; that is a transition, not a resting state.
- **Keyboard (desktop):** 41 tab stops in reading order, each with a visible focus ring, none hidden under the fixed nav. The question index traps focus while open and returns it to its button.
- **Layout:** no horizontal scroll from 320 to 1920 px. Buttons and form controls are at least 44 px on phones.
- **Complete at rest:** before the first scroll nothing is hidden, so a screenshot, thumbnail or failed script always shows the whole page. Blocks below the fold are tucked away only once scrolling starts, and arrive as they come into view (or the moment keyboard focus enters them).
- **Reduced motion:** the model is static, nothing pulses, all content shows immediately.
- **Phone safe areas:** the fixed nav adds the device's top inset to its own padding (simulated at 47 px; real devices untested).
- **No JavaScript:** the story reads as plain text and the quote section falls back to an email link.
- **Weight:** HTML 7 KB, CSS 9 KB, JS 12 KB (gzip), fonts 80 KB, no third-party requests.

**Not yet tested:** Safari, Firefox and real devices. Everything above ran in Chromium. Give it a quick pass on a real iPhone and in Firefox before launch.

---

## Licences

Hubot Sans (GitHub) and Geist Mono (Vercel) are licensed under the SIL Open Font License 1.1; the licence files sit next to the font files and are copied into `dist/site/assets/fonts/`.
