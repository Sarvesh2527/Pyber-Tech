// Small, dependency-free helpers shared by every module.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoothstep = (a, b, v) => smooth(clamp((v - a) / (b - a)));
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reduceMotion = () => mqReduce.matches;

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Create an SVG element with attributes, optionally appended to a parent. */
export function svgEl(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
}

/** Create an HTML element: h('button', {class:'x'}, 'text' | Node | [..]) */
export function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

/** An <svg><use/></svg> icon from the page sprite. */
export function icon(id, cls = '') {
  const s = svgEl('svg', { 'aria-hidden': 'true', focusable: 'false', class: cls });
  const u = svgEl('use', { href: `#${id}` }, s);
  return s;
}

/** Run fn at most once per animation frame. */
export function frameThrottle(fn) {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(...args); });
  };
}

/** Piecewise-linear sample of keyframe array `arr` at fractional index `x`. */
export function sampleKF(arr, x) {
  const i = clamp(Math.floor(x), 0, arr.length - 1);
  const j = Math.min(i + 1, arr.length - 1);
  return lerp(arr[i], arr[j], clamp(x - i));
}
