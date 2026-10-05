// "What would you check for us?" — the visitor picks what they run; the panel
// lights the matching layers of the model and lists what we'd actually look at.
// Their choice is shared with the quote brief through the store.

import { AREAS, DEFAULT_LOOKS } from './content.js';
import { store } from './store.js';
import { createScene } from './scene.js';
import { $, h, icon, svgEl, reduceMotion } from './util.js';

const byId = Object.fromEntries(AREAS.map((a) => [a.id, a]));

export function initExplorer() {
  const root = $('[data-explorer]');
  if (!root) return;
  root.replaceChildren();

  // ---- left: the things you might run
  const buttons = new Map();
  const list = h('div', { class: 'areas', role: 'group', 'aria-label': 'What do you run?' });
  for (const a of AREAS) {
    const btn = h('button', { type: 'button', class: 'area', 'aria-pressed': 'false', 'data-area': a.id },
      h('span', { class: 'area__icon' }, icon(a.icon)),
      h('span', {},
        h('span', { class: 'area__label' }, a.label),
        h('span', { class: 'area__desc' }, a.desc)),
      h('span', { class: 'area__check' }, icon('i-check')));
    btn.addEventListener('click', () => store.toggle(a.id));
    buttons.set(a.id, btn);
    list.append(btn);
  }

  // ---- right: the mini model + what we'd look at
  const svg = svgEl('svg', { role: 'presentation', 'aria-hidden': 'true' });
  const scene = createScene(svg, 'mini');
  scene.setState({ explode: 1, labels: 1 });

  const tabs = h('div', { class: 'panel__tabs', role: 'group', 'aria-label': 'Selected areas' });
  const body = h('div', { class: 'panel__body', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const sumLabel = h('p', { class: 't-label' });
  const sumLink = h('a', { class: 'link-arrow link-arrow--down', href: '#start' });
  const panel = h('div', { class: 'panel cut-panel' },
    h('div', { class: 'panel__stack' }, svg),
    tabs,
    body,
    h('div', { class: 'panel__sum' }, sumLabel, sumLink));

  root.append(list, h('div', { class: 'explorer__panel' }, panel));

  // ---- rendering
  let shownKey = null;
  let swapTimer = 0;

  const looksFor = (id) => (id && byId[id]
    ? { eyebrow: 'What we’d look at', title: byId[id].label, items: byId[id].looks }
    : { eyebrow: 'Your scope', title: DEFAULT_LOOKS.title, items: DEFAULT_LOOKS.items });

  function buildBody(id) {
    const d = looksFor(id);
    body.replaceChildren(
      h('div', { class: 'panel__title' },
        h('p', { class: 't-label' }, d.eyebrow),
        h('h3', { class: 't-h3' }, d.title)),
      h('ul', { class: 'panel__list' },
        d.items.map((it) => h('li', {}, h('div', {}, h('p', {}, it.t), h('span', { class: 'tag' }, it.tag))))));
  }

  function render() {
    const picked = store.list();
    const focus = store.focus;

    // left column
    for (const [id, btn] of buttons) btn.setAttribute('aria-pressed', String(store.has(id)));

    // mini model: light every layer any chosen area touches
    const layers = new Set();
    picked.forEach((id) => byId[id].layers.forEach((l) => layers.add(l)));
    scene.setOn(layers);

    // tabs appear once there is more than one thing to switch between
    tabs.replaceChildren();
    if (picked.length > 1) {
      for (const id of picked) {
        const b = h('button', { type: 'button', class: 'ptab', 'aria-pressed': String(id === focus) }, byId[id].label);
        b.addEventListener('click', () => store.setFocus(id));
        tabs.append(b);
      }
    }

    // details
    const key = focus || '';
    if (shownKey === null) { buildBody(focus); }
    else if (key !== shownKey) {
      if (reduceMotion()) buildBody(focus);
      else {
        body.classList.add('is-swap');
        clearTimeout(swapTimer);
        swapTimer = setTimeout(() => { buildBody(store.focus); body.classList.remove('is-swap'); }, 170);
      }
    }
    shownKey = key;

    // summary
    const n = picked.length;
    sumLabel.textContent = n === 0 ? 'Nothing selected yet' : n === 1 ? '1 area selected' : `${n} areas selected`;
    sumLink.replaceChildren(n === 0 ? 'Or go straight to the brief' : 'Continue to your brief', icon('i-arrow-down'));
  }

  store.subscribe(render);
  render();
}
