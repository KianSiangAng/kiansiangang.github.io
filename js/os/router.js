/* ================================================================
   ROUTER.JS — Hash routing for a windowed UI

   Deep links matter even here: someone should be able to send a
   link that lands on an open Projects window, and the browser's
   back button should close it again.

   The URL reflects the *focused* window:

     #/                     desktop, nothing focused
     #/projects             the Projects folder
     #/projects/password-analyzer   one project's window

   Routing is bidirectional, which is the fiddly part: window
   changes rewrite the URL, and URL changes open windows. A guard
   flag stops the two from ping-ponging.
================================================================ */

import { createLogger } from '../core/logger.js';

const log = createLogger('router');

export function createRouter({ bus, wm, onOpen }) {
  let suppress = false;

  function parse(hash) {
    const path = (hash || '').replace(/^#\/?/, '').replace(/\/$/, '');
    if (!path) return { app: null, param: null };
    const [app, param] = path.split('/');
    return { app: decodeURIComponent(app), param: param ? decodeURIComponent(param) : null };
  }

  function format(appId, param) {
    if (!appId) return '#/';
    return param ? `#/${appId}/${encodeURIComponent(param)}` : `#/${appId}`;
  }

  /** Called when the URL changes (including on first load). */
  function apply() {
    if (suppress) return;
    const { app, param } = parse(location.hash);

    if (!app) {
      // Back to the desktop: the URL is the source of truth here.
      return;
    }
    suppress = true;
    try {
      onOpen(app, { param, fromRouter: true });
    } catch (err) {
      log.warn(`no route for "${app}"`, err);
    } finally {
      suppress = false;
    }
  }

  /** Called when window focus changes. Replaces rather than pushes,
      so dragging focus around does not fill the history stack. */
  function reflect(appId, param) {
    const next = format(appId, param);
    if (location.hash === next) return;
    suppress = true;
    history.replaceState(null, '', next);
    suppress = false;
  }

  /** Opening an app is a navigation and does earn a history entry. */
  function push(appId, param) {
    const next = format(appId, param);
    if (location.hash === next) return;
    suppress = true;
    history.pushState(null, '', next);
    suppress = false;
  }

  window.addEventListener('hashchange', apply);
  window.addEventListener('popstate', () => {
    const { app } = parse(location.hash);
    if (!app) {
      // Navigating back to the root closes the focused window.
      const focused = wm.focused();
      if (focused) focused.close();
      return;
    }
    apply();
  });

  bus.on('wm.focused', ({ appId, param }) => {
    if (!appId) reflect(null);
    else reflect(appId, param);
  });

  bus.on('wm.closed', () => {
    const focused = wm.focused();
    reflect(focused?.appId || null, focused?.param || null);
  });

  return {
    apply,
    push,
    reflect,
    current: () => parse(location.hash),
  };
}
