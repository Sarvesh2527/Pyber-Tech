// The attack-surface scene: a stack of isometric planes (website, logins, APIs,
// cloud) with assets pinned on them, a scan plane, findings and an attack path.
//
// Geometry: isometric, so every plane edge runs at 30° — the same angle that
// cuts the Pyber mark. All of it is generated from the small data model below.
//
// The scene is a pure view: call setState(state) with numbers, get pixels.
// (The scroll story and the explorer mini-model both drive it.)

import { svgEl as el, lerp, clamp } from './util.js';

const C = Math.cos(Math.PI / 6);   // 0.866 — horizontal run of a 30° edge
const SN = 0.5;                    // vertical rise of a 30° edge
let uid = 0;

// ---- data model (illustrative — not a real company) ------------------------
export const LAYERS = [
  { id: 'web', name: 'Website', sub: 'what visitors see', nodes: [
    { id: 'home',     u: 0.20, v: 0.30 },
    { id: 'contact',  u: 0.58, v: 0.20 },
    { id: 'checkout', u: 0.80, v: 0.55 },
    { id: 'admin',    u: 0.38, v: 0.62, finding: { n: 1, label: 'Open admin page' } },
    { id: 'old',      u: 0.15, v: 0.78 },
  ] },
  { id: 'login', name: 'Logins', sub: 'who can get in', nodes: [
    { id: 'customer', u: 0.28, v: 0.26 },
    { id: 'reset',    u: 0.66, v: 0.42, finding: { n: 2, label: 'Guessable reset' } },
    { id: 'staff',    u: 0.30, v: 0.66 },
    { id: 'signup',   u: 0.78, v: 0.74 },
  ] },
  { id: 'api', name: 'APIs', sub: 'how apps talk', nodes: [
    { id: 'mobile',   u: 0.22, v: 0.34 },
    { id: 'partner',  u: 0.62, v: 0.24 },
    { id: 'invoices', u: 0.46, v: 0.62, finding: { n: 3, label: 'Other users’ data' } },
    { id: 'hooks',    u: 0.80, v: 0.66 },
    { id: 'public',   u: 0.16, v: 0.76 },
  ] },
  { id: 'cloud', name: 'Cloud', sub: 'servers & storage', nodes: [
    { id: 'server',   u: 0.26, v: 0.28 },
    { id: 'db',       u: 0.64, v: 0.26 },
    { id: 'files',    u: 0.40, v: 0.64, finding: { n: 4, label: 'Exposed files' } },
    { id: 'backup',   u: 0.78, v: 0.62 },
    { id: 'test',     u: 0.18, v: 0.80 },
  ] },
];

const LINKS = [
  ['web.home', 'login.customer'], ['web.admin', 'login.staff'], ['web.checkout', 'login.signup'],
  ['login.customer', 'api.mobile'], ['login.staff', 'api.invoices'],
  ['api.mobile', 'cloud.server'], ['api.partner', 'cloud.db'], ['api.hooks', 'cloud.backup'],
];
// automated probes from the internet fan out to assets on every layer
const PROBES = ['web.home', 'web.contact', 'login.customer', 'api.partner', 'api.mobile', 'cloud.db'];

// Units are SVG user units; the frame scales the whole scene to fit.
export const PRESETS = {
  wide:   { W: 670, H: 760, cx: 256, S: 224, dMin: 52, dMax: 150, thick: 8, lblX: 494, pin: 1,    badge: 10,   fs: { lbl: 14, sub: 12, find: 13 }, showSub: true,  wrap: 99 },
  narrow: { W: 520, H: 460, cx: 204, S: 188, dMin: 40, dMax: 80,  thick: 7, lblX: 388, pin: 1.35, badge: 13,   fs: { lbl: 19, sub: 0,  find: 15 }, showSub: false, wrap: 12 },
  mini:   { W: 500, H: 372, cx: 184, S: 168, dMin: 62, dMax: 62,  thick: 6, lblX: 364, pin: 0,    badge: 0,    fs: { lbl: 20, sub: 0,  find: 0 },  showSub: false, wrap: 99, mini: true },
};

const setOp = (node, v) => {
  v = Math.round(v * 1000) / 1000;
  if (node._o !== v) { node._o = v; node.style.opacity = v; }
};

/** Split a label into at most two balanced lines, only if it is longer than `max`. */
function wrapWords(text, max) {
  if (text.length <= max) return [text];
  const words = text.split(' ');
  let best = [text], score = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const s = Math.max(a.length, b.length);
    if (s < score) { score = s; best = [a, b]; }
  }
  return best;
}

export function createScene(svg, presetName) {
  const P = PRESETS[presetName];
  const k = P.pin;
  const id = ++uid;

  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${P.W} ${P.H}`);

  // ---- defs
  const defs = el('defs', {}, svg);
  const sheen = el('linearGradient', { id: `sh${id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 0.08 }, sheen);
  el('stop', { offset: 1, 'stop-color': '#ffffff', 'stop-opacity': 0 }, sheen);
  const bandG = el('linearGradient', { id: `bd${id}`, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
  el('stop', { offset: 0, 'stop-color': '#f51926', 'stop-opacity': 0 }, bandG);
  el('stop', { offset: 1, 'stop-color': '#f51926', 'stop-opacity': 0.26 }, bandG);

  // ---- groups, painted back to front
  const root = el('g', { class: 's-root' }, svg);
  const gLayers = el('g', {}, root);
  const gLinks = el('g', {}, root);
  const gProbes = el('g', {}, root);
  const gTracks = el('g', {}, gProbes);
  const gPulses = el('g', {}, gProbes);
  const gLabels = el('g', { class: 's-labels' }, root);
  const gFinds = el('g', { class: 's-finds' }, root);
  const gPath = el('g', {}, root);
  const gBadges = el('g', { class: 's-badges' }, root);
  const gEntry = el('g', { class: 's-end' }, root);

  // ---- local (per-layer) geometry; layer top corner sits at local y = 0
  const proj = (u, v) => [P.cx + (u - v) * C * P.S, (u + v) * SN * P.S];
  const [Tx, Ty] = proj(0, 0), [Rx, Ry] = proj(1, 0), [Bx, By] = proj(1, 1), [Lx, Ly] = proj(0, 1);
  const pts = (a) => a.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const t = P.thick;
  const N = 6;
  let gridD = '';
  for (let i = 0; i <= N; i++) {
    const a = proj(i / N, 0), b = proj(i / N, 1), c = proj(0, i / N), d = proj(1, i / N);
    gridD += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}M${c[0].toFixed(1)} ${c[1].toFixed(1)}L${d[0].toFixed(1)} ${d[1].toFixed(1)}`;
  }

  const recs = [];            // per layer, in LAYERS order (0 = top)
  const nodeIndex = {};       // 'layer.node' -> record
  const nodeList = [];
  const subs = [];            // sub-labels, which hand over to the finding rows
  const rows = [];            // finding rows (right-hand column)

  // build bottom layer first so upper layers paint over lower ones
  for (let li = LAYERS.length - 1; li >= 0; li--) {
    const L = LAYERS[li];
    const g = el('g', { class: 's-layer', 'data-layer': L.id }, gLayers);
    el('polygon', { class: 's-side', points: pts([[Lx, Ly], [Bx, By], [Bx, By + t], [Lx, Ly + t]]) }, g);
    el('polygon', { class: 's-side', points: pts([[Bx, By], [Rx, Ry], [Rx, Ry + t], [Bx, By + t]]) }, g);
    el('polygon', { class: 's-face', points: pts([[Tx, Ty], [Rx, Ry], [Bx, By], [Lx, Ly]]) }, g);
    el('polygon', { points: pts([[Tx, Ty], [Rx, Ry], [Bx, By], [Lx, Ly]]), fill: `url(#sh${id})`, stroke: 'none' }, g);
    el('path', { class: 's-grid', d: gridD }, g);

    const band = el('polygon', { points: '0,0 0,0 0,0 0,0', fill: `url(#bd${id})`, stroke: 'none', opacity: 0 }, g);
    const edgeGlow = el('line', { class: 's-scan-edge s-scan-edge--glow', opacity: 0 }, g);
    const edge = el('line', { class: 's-scan-edge', opacity: 0 }, g);

    const nodesG = el('g', { class: 's-nodes' }, g);
    const nodes = [];
    if (!P.mini) {
      for (const def of L.nodes) {
        const [x, y] = proj(def.u, def.v);
        const ng = el('g', { class: 's-node', transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` }, nodesG);
        el('ellipse', { class: 's-node__pulse', rx: 8 * k, ry: 4.6 * k }, ng);
        el('ellipse', { class: 's-node__ring', rx: 8 * k, ry: 4.6 * k }, ng);
        el('ellipse', { class: 's-node__base', rx: 2.6 * k, ry: 1.5 * k }, ng);
        el('line', { class: 's-node__stem', x1: 0, y1: -2 * k, x2: 0, y2: -14 * k }, ng);
        el('circle', { class: 's-node__cap', cx: 0, cy: -16 * k, r: 3.8 * k }, ng);
        el('path', { class: 's-node__tick', d: `M${-1.9 * k} ${-16 * k}l${1.3 * k} ${1.4 * k}l${2.7 * k} ${-2.9 * k}` }, ng);
        const rec = { li, def, el: ng, state: '', key: `${L.id}.${def.id}` };
        nodes.push(rec); nodeList.push(rec); nodeIndex[rec.key] = rec;
      }
    }

    // label (lives outside the layer group so it can fade independently)
    const lg = el('g', {}, gLabels);
    el('line', { class: 's-leader', x1: Rx + 8, y1: Ry, x2: P.lblX - 10, y2: Ry }, lg);
    const tx = el('text', { class: 's-lbl', x: P.lblX, y: Ry + P.fs.lbl * 0.36, 'font-size': P.fs.lbl }, lg);
    tx.textContent = L.name;
    let subEl = null;
    if (P.showSub) {
      subEl = el('text', { class: 's-lbl-sub', x: P.lblX, y: Ry + P.fs.lbl * 0.36 + P.fs.sub + 7, 'font-size': P.fs.sub }, lg);
      subEl.textContent = L.sub;
    }

    // the finding on this layer, listed in the same column as its label
    let row = null;
    const fnode = L.nodes.find((n) => n.finding);
    if (!P.mini && fnode) {
      const y1 = Ry + P.fs.lbl * 0.36 + (P.showSub ? P.fs.sub + 7 : P.fs.find + 8);
      const numW = P.fs.find * 0.64 + 7;
      row = el('g', { class: 's-find' }, gFinds);
      const n = el('text', { class: 's-find__n', x: P.lblX, y: y1, 'font-size': P.fs.find }, row);
      n.textContent = fnode.finding.n;
      const tt = el('text', { class: 's-find__t', x: P.lblX + numW, y: y1, 'font-size': P.fs.find }, row);
      wrapWords(fnode.finding.label, P.wrap).forEach((ln, i) => {
        const ts = el('tspan', { x: P.lblX + numW, dy: i ? (P.fs.find * 1.28).toFixed(1) : 0 }, tt);
        ts.textContent = ln;
      });
      rows.push({ g: row, li });
    }

    recs[li] = { id: L.id, g, lg, band, edgeGlow, edge, nodesG, nodes };
    if (subEl) subs.push(subEl);
  }

  // ---- overlays (only in the full scene)
  const links = [], probes = [], badges = [];
  let pathGlow, pathLine;
  const findings = nodeList.filter((n) => n.def.finding).sort((a, b) => a.def.finding.n - b.def.finding.n);
  const entry = [Math.round(P.W * 0.045), 0];

  if (!P.mini) {
    for (const [a, b] of LINKS) links.push({ line: el('line', { class: 's-link' }, gLinks), a: nodeIndex[a], b: nodeIndex[b] });
    PROBES.forEach((key, i) => {
      const track = el('line', { class: 's-probe-track' }, gTracks);
      const line = el('line', { class: 's-probe', pathLength: 100, style: `--pd:${(-i * 0.53).toFixed(2)}s` }, gPulses);
      probes.push({ track, line, to: nodeIndex[key] });
    });
    pathGlow = el('polyline', { class: 's-path-glow' }, gPath);
    pathLine = el('polyline', { class: 's-path' }, gPath);
    for (const f of findings) {
      const g = el('g', { class: 's-badge' }, gBadges);
      el('circle', { r: P.badge }, g);
      const fs = P.badge * 1.12;
      const n = el('text', { 'font-size': fs.toFixed(1), y: (fs * 0.36).toFixed(2) }, g);
      n.textContent = f.def.finding.n;
      badges.push({ g, f });
    }
    el('circle', { r: 4.5 * Math.max(1, k * 0.85), cx: 0, cy: 0 }, gEntry);
    const et = el('text', { x: -4, y: -(4.5 * Math.max(1, k * 0.85) + 8), 'font-size': P.fs.find }, gEntry);
    et.textContent = 'Internet';
  }

  // ---- layout (depends on how far the stack is exploded)
  const layerY = [0, 0, 0, 0];
  let explode = NaN;
  let pathLen = 1;

  const capAbs = (rec) => [
    P.cx + (rec.def.u - rec.def.v) * C * P.S,
    layerY[rec.li] + (rec.def.u + rec.def.v) * SN * P.S - 16 * k,
  ];

  function applyLayout(e) {
    const d = lerp(P.dMin, P.dMax, e);
    const total = 3 * d + P.S + P.thick;
    const y0 = (P.H - total) / 2 - (P.mini ? 0 : 4);
    for (let i = 0; i < 4; i++) {
      layerY[i] = y0 + i * d;
      const tr = `translate(0 ${layerY[i].toFixed(2)})`;
      recs[i].g.setAttribute('transform', tr);
      recs[i].lg.setAttribute('transform', tr);
    }
    for (const r of rows) r.g.setAttribute('transform', `translate(0 ${layerY[r.li].toFixed(2)})`);
    if (P.mini) return;

    for (const { line, a, b } of links) {
      const [x1, y1] = capAbs(a), [x2, y2] = capAbs(b);
      line.setAttribute('x1', x1.toFixed(1)); line.setAttribute('y1', y1.toFixed(1));
      line.setAttribute('x2', x2.toFixed(1)); line.setAttribute('y2', y2.toFixed(1));
    }

    // the internet sits just outside the top layer's upper-left edge
    entry[1] = layerY[0] + P.S * 0.3;
    gEntry.setAttribute('transform', `translate(${entry[0]} ${entry[1].toFixed(1)})`);

    // probes fan out from the internet to assets on every layer
    for (const { track, line, to } of probes) {
      const [tx, ty] = capAbs(to);
      const dx = tx - entry[0], dy = ty - entry[1], len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const x1 = entry[0] + ux * 10, y1 = entry[1] + uy * 10, x2 = tx - ux * 7, y2 = ty - uy * 7;
      for (const l of [track, line]) {
        l.setAttribute('x1', x1.toFixed(1)); l.setAttribute('y1', y1.toFixed(1));
        l.setAttribute('x2', x2.toFixed(1)); l.setAttribute('y2', y2.toFixed(1));
      }
    }

    // attack path: internet → the findings, in order
    const path = [[...entry], ...findings.map(capAbs)];
    const pstr = pts(path);
    pathGlow.setAttribute('points', pstr); pathLine.setAttribute('points', pstr);
    pathLen = 0;
    for (let i = 1; i < path.length; i++) pathLen += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    for (const p of [pathGlow, pathLine]) p.setAttribute('stroke-dasharray', `${pathLen.toFixed(1)} ${(pathLen + 8).toFixed(1)}`);

    for (const b of badges) {
      const [bx, by] = capAbs(b.f);
      b.g.setAttribute('transform', `translate(${bx.toFixed(1)} ${by.toFixed(1)})`);
    }
  }

  // ---- state
  // s: { explode, labels, nodes, links, probes, tags, entry, path, pathOpacity,
  //      scanU, scanStrength, checkedU, fixed }
  function setState(s) {
    if (!(Math.abs(s.explode - explode) < 0.0004)) { explode = s.explode; applyLayout(explode); }
    setOp(gLabels, s.labels);
    if (P.mini) return null;

    setOp(gLinks, s.links);
    setOp(gProbes, s.probes);
    setOp(gFinds, s.tags);
    setOp(gBadges, s.tags);
    setOp(gEntry, s.entry);
    setOp(gPath, s.pathOpacity);
    for (const sub of subs) setOp(sub, 1 - s.tags);
    for (const r of recs) setOp(r.nodesG, s.nodes);

    // draw the path progressively
    const off = (1 - s.path) * (pathLen + 4);
    pathGlow.setAttribute('stroke-dashoffset', off.toFixed(1));
    pathLine.setAttribute('stroke-dashoffset', off.toFixed(1));

    // scan plane: a band on every layer at the same u (a slice through the stack)
    const on = s.scanStrength > 0.01 && s.scanU > -0.3 && s.scanU < 1.3;
    const bw = 0.2;
    for (const r of recs) {
      if (!on) { setOp(r.band, 0); setOp(r.edge, 0); setOp(r.edgeGlow, 0); continue; }
      const u1 = clamp(s.scanU), u0 = clamp(s.scanU - bw);
      const inside = s.scanU > 0 && s.scanU < 1;
      const a = proj(u0, 0), b = proj(u1, 0), c = proj(u1, 1), d = proj(u0, 1);
      r.band.setAttribute('points', pts([a, b, c, d]));
      setOp(r.band, s.scanStrength);
      if (inside) {
        for (const e of [r.edge, r.edgeGlow]) {
          e.setAttribute('x1', b[0].toFixed(1)); e.setAttribute('y1', b[1].toFixed(1));
          e.setAttribute('x2', c[0].toFixed(1)); e.setAttribute('y2', c[1].toFixed(1));
        }
        setOp(r.edge, s.scanStrength); setOp(r.edgeGlow, s.scanStrength);
      } else { setOp(r.edge, 0); setOp(r.edgeGlow, 0); }
    }

    // node states
    const ok = s.fixed >= 0.5;
    let checked = 0, found = 0;
    for (const n of nodeList) {
      const isChecked = n.def.u <= s.checkedU;
      let st = '';
      if (isChecked) {
        checked++;
        if (n.def.finding) {
          if (ok) st = ' is-fixed'; else { st = ' is-finding'; found++; }
        } else st = ' is-checked';
      }
      if (n.state !== st) { n.state = st; n.el.setAttribute('class', 's-node' + st); }
    }
    const badgeCls = 's-badge' + (ok ? ' s-badge--ok' : '');
    for (const b of badges) if (b.g.getAttribute('class') !== badgeCls) b.g.setAttribute('class', badgeCls);
    const rowCls = 's-find' + (ok ? ' s-find--ok' : '');
    for (const r of rows) if (r.g.getAttribute('class') !== rowCls) r.g.setAttribute('class', rowCls);
    return { checked, total: nodeList.length, findings: found };
  }

  /** Mini-model: highlight the layers a set of areas touches. */
  function setOn(set) {
    const any = set.size > 0;
    for (const r of recs) {
      r.g.classList.toggle('is-on', set.has(r.id));
      r.g.classList.toggle('is-dim', any && !set.has(r.id));
    }
  }

  return { setState, setOn, preset: presetName, total: nodeList.length };
}
