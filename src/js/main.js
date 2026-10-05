// Pyber Solution — entry point. Each module is independent: if one fails, the
// rest of the page still works (and the content is readable without any of them).

import { CONFIG } from './content.js';
import { initChapters } from './chapters.js';
import { initReveal } from './reveal.js';
import { initStory } from './story.js';
import { initNav } from './nav.js';
import { initExplorer } from './explorer.js';
import { initMethod } from './method.js';
import { initReport } from './report.js';
import { initBrief } from './brief.js';
import { $ } from './util.js';

function safe(name, fn) {
  try { return fn(); } catch (err) { console.error(`[pyber] ${name} failed`, err); }
}

function boot() {
  // Hide the dashed placeholder slot when real credentials are ready (see content.js).
  if (!CONFIG.showPlaceholders) {
    const slot = $('[data-placeholder]');
    if (slot) slot.remove();
  }

  const ch = safe('chapters', initChapters);
  safe('reveal', initReveal);
  safe('explorer', initExplorer);
  safe('brief', initBrief);
  safe('method', initMethod);
  safe('report', initReport);
  if (ch) {
    safe('story', () => initStory(ch));
    safe('nav', () => initNav(ch));
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
