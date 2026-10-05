// Tiny shared store: the visitor's chosen scope is used by the explorer and
// carried into the quote brief, so they never have to say it twice.

const selected = new Set();
const listeners = new Set();
let focusId = null;

const emit = () => listeners.forEach((fn) => fn());

export const store = {
  has: (id) => selected.has(id),
  list: () => Array.from(selected),
  get focus() { return focusId; },

  toggle(id) {
    if (selected.has(id)) {
      selected.delete(id);
      if (focusId === id) focusId = Array.from(selected).pop() ?? null;
    } else {
      // "Not sure yet" is exclusive: it replaces real choices, and vice versa.
      if (id === 'unsure') selected.clear();
      else selected.delete('unsure');
      selected.add(id);
      focusId = id;
    }
    emit();
  },

  /** Which selected area the explorer panel is describing. */
  setFocus(id) {
    if (!selected.has(id) || focusId === id) return;
    focusId = id;
    emit();
  },

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
