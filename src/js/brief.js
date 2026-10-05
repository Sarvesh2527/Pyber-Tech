// The quote brief. There is no form to submit and no server: the visitor builds
// a short, editable email and opens it in their own mail app (or Gmail), or
// copies it. Nothing leaves the page until they press send themselves.

import { AREAS, CONFIG } from './content.js';
import { store } from './store.js';
import { $, h, icon } from './util.js';

const byId = Object.fromEntries(AREAS.map((a) => [a.id, a]));
const enc = encodeURIComponent;

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch (_) { /* fall through to the legacy path */ }
  const prev = document.activeElement;
  const ta = h('textarea', { readonly: true, 'aria-hidden': 'true', tabindex: '-1' });
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
  ta.remove();
  if (prev && prev.focus) prev.focus({ preventScroll: true });
  return ok;
}

export function initBrief() {
  const root = $('[data-brief]');
  if (!root) return;
  root.replaceChildren();

  const values = { name: '', company: '', site: '', notes: '' };

  // ---- 1 · what to test (shares state with the explorer)
  const chips = new Map();
  const chipRow = h('div', { class: 'chips', role: 'group', 'aria-label': 'What would you like tested?' });
  for (const a of AREAS) {
    const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', 'data-area': a.id }, icon(a.icon), a.label);
    b.addEventListener('click', () => store.toggle(a.id));
    chips.set(a.id, b);
    chipRow.append(b);
  }

  // ---- 2 · a little about you
  function field(key, label, hint, attrs, { tag = 'input', wide = false } = {}) {
    const id = `brief-${key}`;
    const control = h(tag, { id, name: key, ...attrs });
    control.addEventListener('input', () => { values[key] = control.value.trim(); renderPreview(); });
    return h('div', { class: 'field' + (wide ? ' field--wide' : '') },
      h('label', { for: id }, label, hint ? h('span', {}, hint) : null),
      control);
  }
  const fields = h('div', { class: 'fields' },
    field('name', 'Your name', '', { type: 'text', autocomplete: 'name' }),
    field('company', 'Company', '', { type: 'text', autocomplete: 'organization' }),
    field('site', 'Main web address', 'if you have one', { type: 'text', inputmode: 'url', autocomplete: 'url', autocapitalize: 'off', spellcheck: 'false', placeholder: 'example.com' }, { wide: true }),
    field('notes', 'Anything we should know?', 'timing, team size, compliance needs…', { rows: 3, placeholder: 'A sentence or two is plenty.' }, { tag: 'textarea', wide: true }),
  );

  // ---- 3 · preview + actions
  const prevSubject = h('dd', {});
  const prevBody = h('pre', { class: 'preview__body', tabindex: '0', role: 'region', 'aria-label': 'Email preview' });
  const preview = h('div', { class: 'preview' },
    h('dl', { class: 'preview__meta' },
      h('div', {}, h('dt', {}, 'To'), h('dd', {}, CONFIG.email)),
      h('div', {}, h('dt', {}, 'Subject'), prevSubject)),
    prevBody);

  const mailLink = h('a', { class: 'btn btn--lg', href: `mailto:${CONFIG.email}` }, 'Open in my email app', icon('i-mail'));
  const gmailLink = h('a', { class: 'btn btn--ghost btn--lg', href: 'https://mail.google.com/', target: '_blank', rel: 'noopener noreferrer' }, 'Open in Gmail', icon('i-external'));
  const copyBtn = h('button', { type: 'button', class: 'link-act' }, icon('i-copy'), h('span', {}, 'Copy email text'));
  const addrBtn = h('button', { type: 'button', class: 'link-act' }, icon('i-copy'), h('span', {}, 'Copy address'));
  const actions = h('div', { class: 'brief__actions' },
    h('div', { class: 'brief__primary' },
      h('span', { class: 'btn-shell' }, mailLink),
      h('span', { class: 'btn-shell btn-shell--ghost' }, gmailLink)),
    h('div', { class: 'brief__secondary' }, copyBtn, addrBtn));

  const note = h('p', { class: 'brief__note t-small', role: 'status', 'aria-live': 'polite' });
  const reply = CONFIG.responseTime ? ` We aim to reply ${CONFIG.responseTime}.` : '';
  const setNote = (...kids) => note.replaceChildren(...kids);
  const idleNote = () => setNote(`Opens your email app with this message filled in. Nothing is sent until you press send.${reply}`);

  const step = (n, title, extra) => h('h3', { class: 'brief__h' }, h('span', { class: 'brief__n', 'aria-hidden': 'true' }, n), title, extra || null);
  const form = h('form', { class: 'brief__form', novalidate: true, 'aria-label': 'Quote brief' },
    h('div', {}, step('1', 'What would you like tested?'), chipRow),
    h('div', {}, step('2', 'A little about you', h('span', { class: 'opt' }, 'Optional')), fields),
    h('div', {}, step('3', 'Your email, ready to send'), preview, actions, note));
  form.addEventListener('submit', (e) => e.preventDefault());
  root.append(form);

  // ---- the email itself (plain ASCII on purpose: it survives every mail client)
  function compose() {
    const picked = store.list();
    const L = [];
    L.push('Hello Pyber Solution team,', '', "I'd like a quote for a security assessment (VAPT).", '', 'What we would like tested:');
    if (!picked.length) L.push('- Not decided yet (please help us work out what is worth testing)');
    for (const id of picked) {
      L.push(id === 'unsure' ? '- Not sure yet (please help us work out what is worth testing)' : `- ${byId[id].label}`);
    }
    const about = [];
    if (values.name) about.push(`Name: ${values.name}`);
    if (values.company) about.push(`Company: ${values.company}`);
    if (values.site) about.push(`Web address: ${values.site}`);
    if (about.length) L.push('', 'About us:', ...about);
    if (values.notes) L.push('', 'Anything else you should know:', values.notes);
    L.push('', 'Thank you,');
    if (values.name) L.push(values.name);
    return {
      subject: 'Security assessment enquiry' + (values.company ? ` - ${values.company}` : ''),
      body: L.join('\n'),
    };
  }

  let mail = compose();
  function renderPreview() {
    mail = compose();
    prevSubject.textContent = mail.subject;
    prevBody.textContent = mail.body;
    mailLink.setAttribute('href', `mailto:${CONFIG.email}?subject=${enc(mail.subject)}&body=${enc(mail.body).replace(/%0A/g, '%0D%0A')}`);
    gmailLink.setAttribute('href', `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(CONFIG.email)}&su=${enc(mail.subject)}&body=${enc(mail.body)}`);
  }

  function renderChips() {
    for (const [id, b] of chips) b.setAttribute('aria-pressed', String(store.has(id)));
  }

  store.subscribe(() => { renderChips(); renderPreview(); });
  renderChips();
  renderPreview();
  idleNote();

  // ---- actions
  mailLink.addEventListener('click', () => {
    // A link can't tell us whether a mail app exists, so offer the fallbacks calmly.
    setTimeout(() => setNote(
      'Your email app should open with this ready to send. If it didn’t, use Gmail or copy the text and send it to ',
      h('strong', {}, CONFIG.email), '.'), 700);
  });

  const flash = (btn, label) => {
    const span = btn.querySelector('span');
    const original = span.textContent;
    span.textContent = label;
    btn.classList.add('is-done');
    setTimeout(() => { span.textContent = original; btn.classList.remove('is-done'); }, 2200);
  };

  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(`To: ${CONFIG.email}\nSubject: ${mail.subject}\n\n${mail.body}`);
    if (ok) { flash(copyBtn, 'Copied'); setNote('Copied. Paste it into an email to ', h('strong', {}, CONFIG.email), '.'); }
    else setNote('Couldn’t copy automatically. Select the preview above and copy it, then send it to ', h('strong', {}, CONFIG.email), '.');
  });

  addrBtn.addEventListener('click', async () => {
    const ok = await copyText(CONFIG.email);
    if (ok) { flash(addrBtn, 'Copied'); setNote('Address copied: ', h('strong', {}, CONFIG.email), '.'); }
    else setNote('Our address is ', h('strong', {}, CONFIG.email), '.');
  });
}
