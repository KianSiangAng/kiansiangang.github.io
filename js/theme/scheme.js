/* ================================================================
   SCHEME.JS — Light and dark

   This module used to run two entire visual identities with a state
   machine driving the transition between them. The second one has
   been removed — it was a good demo and a bad portfolio, splitting
   the site's identity in half and doubling every styling decision.

   What remains is the part that was always useful: the colour
   scheme, respecting the visitor's OS preference until they
   explicitly choose otherwise, and persisting that choice.
================================================================ */

import { createLogger } from '../core/logger.js';

const log = createLogger('scheme');
const STORAGE_KEY = 'theme';

export function createScheme({ bus, audio }) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function stored() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch {
      return null;
    }
  }

  function current() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function apply(next, { persist = true } = {}) {
    const scheme = next === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = scheme;

    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, scheme); } catch { /* best effort */ }
    }

    audio?.blip(scheme === 'dark' ? 420 : 640);
    bus.emit('theme.changed', { theme: scheme });
    log.debug(`scheme → ${scheme}`);
    return scheme;
  }

  bus.on('theme.set', ({ theme }) => {
    apply(theme === 'toggle' ? (current() === 'dark' ? 'light' : 'dark') : theme);
  });

  /* Follow the OS while the visitor has not made a choice of their
     own. Once they have, their choice wins and this stops mattering. */
  media.addEventListener('change', (event) => {
    if (stored()) return;
    apply(event.matches ? 'dark' : 'light', { persist: false });
  });

  /* theme-init.js already set the attribute before first paint; this
     just re-announces it so anything listening starts in sync. */
  bus.emit('theme.changed', { theme: current() });

  return {
    get scheme() { return current(); },
    set: (theme) => apply(theme),
    toggle: () => apply(current() === 'dark' ? 'light' : 'dark'),
  };
}
