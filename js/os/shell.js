/* ================================================================
   SHELL.JS — Which presentation the visitor gets

   The site has two front ends over one document:

     'page'  the conventional scrolling portfolio. This is the
             document as authored in index.html, and it is what you
             get with JavaScript disabled, on a phone, or by asking.

     'os'    the desktop: menu bar, icons, dock, windows. It does
             not replace the content — it re-presents the same
             sections inside windows.

   The choice is: an explicit override (?shell=, or the setting) >
   viewport and pointer capability > default. A desktop metaphor on
   a 390px touch screen is a worse portfolio than a good scrolling
   page, so phones get the page and that is a feature.

   Switching modes is non-destructive: page-mode nodes are hidden,
   never removed, so we can switch back and forth at runtime
   without a reload.
================================================================ */

import { createWindowManager } from './wm.js';
import { createDesktop } from './desktop.js';
import { createMenuBar } from './menubar.js';
import { createDock } from './dock.js';
import { createRouter } from './router.js';
import { createRegistry } from './registry.js';
import { createContextMenu } from './contextmenu.js';
import { el } from './dom.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('shell');
const STORAGE_KEY = 'portfolio:shell';
const MIN_WIDTH = 900;
const MIN_HEIGHT = 560;

/** Is this device a plausible home for a desktop metaphor? */
export function capableOfOS() {
  const wideEnough = window.innerWidth >= MIN_WIDTH && window.innerHeight >= MIN_HEIGHT;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  return wideEnough && finePointer;
}

/**
 * Which presentation to open in.
 *
 * The choice is remembered for the SESSION, not forever, and that
 * distinction turned out to matter a lot. It used to live in
 * localStorage, which meant a single click of "View as a plain page"
 * permanently retired the 3D room: every subsequent visit, on that
 * browser, went straight to the scrolling page and the landing
 * nobody had asked to disable was simply gone.
 *
 * Remembering it within a session is still right — switching back
 * and forth inside one visit should stick. Remembering it across
 * visits is a decision the visitor did not make: they asked to see
 * the page now, not to never be shown the room again.
 */
export function preferredMode() {
  const forced = new URLSearchParams(location.search).get('shell');
  if (forced === 'os' || forced === 'page') return forced;

  try {
    /* Clear the old permanent key on sight. Without this, everyone who
       ever pressed the button stays stuck on whatever they picked
       months ago, and the fix reaches nobody who needs it. */
    if (localStorage.getItem(STORAGE_KEY) !== null) localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }

  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === 'os' || saved === 'page') return saved;
  } catch {
    /* ignore */
  }
  return capableOfOS() ? 'os' : 'page';
}

export function createShell({ bus, services }) {
  /* Starts as null, not 'page': setMode short-circuits when the mode
     is unchanged, so seeding it with a real mode would make the very
     first call a no-op and leave data-shell unset. */
  let mode = null;
  let os = null;
  let welcomeShown = false;

  const root = el('div.os', { id: 'os-root', hidden: true });
  document.body.appendChild(root);

  /* A way back, always visible in OS mode. */
  const escapeHatch = el('button.os-escape', {
    type: 'button',
    text: 'View as a plain page',
    onclick: () => api.setMode('page'),
  });

  const returnButton = el('button.page-return', {
    type: 'button',
    hidden: true,
    onclick: () => api.setMode('os'),
  }, [el('span', { text: 'Enter the desktop' })]);
  document.body.appendChild(returnButton);

  function buildOS() {
    if (os) return os;

    const contextMenu = createContextMenu();
    const wm = createWindowManager({ bus, root });

    /* The registry needs `open`, and `open` needs the registry, so
       the reference is threaded in after construction. */
    let registry = null;

    function open(appId, options = {}) {
      const app = registry?.get(appId);
      if (!app) {
        log.warn(`no such app: ${appId}`);
        return null;
      }

      if (app.external) {
        window.open(app.external, '_blank', 'noopener,noreferrer');
        return null;
      }

      const existing = wm.byApp(appId);
      if (existing) {
        /* A deep link to an app that is already open should move it
           to the right place, not be swallowed by the raise. */
        if (options.param && options.param !== existing.param) {
          existing.param = options.param;
          existing.setParam?.(options.param);
        }
        existing.focus();
        return existing;
      }

      const win = wm.open(appId, {
        title: app.title,
        icon: app.icon,
        ...(app.window || {}),
      });
      win.param = options.param || null;

      const content = app.build(win);
      if (content) win.body.appendChild(content);

      if (!options.fromRouter) router.push(appId, win.param);
      bus.emit('app.opened', { appId });
      return win;
    }

    registry = createRegistry({ bus, wm, shell: api, services, onOpen: open });

    const desktop = createDesktop({
      bus,
      root,
      apps: registry.desktopIcons(),
      onOpen: open,
      contextMenu,
    });

    const menubar = createMenuBar({ bus, root, wm, onOpen: open, shell: api });
    const dock = createDock({
      bus,
      root,
      apps: registry.apps,
      wm,
      onOpen: open,
      reducedMotion: services.reducedMotion,
    });
    const router = createRouter({ bus, wm, onOpen: open });

    root.appendChild(escapeHatch);

    bus.on('desktop.tidy', () => desktop.tidy());
    bus.on('os.open', ({ appId, param }) => open(appId, { param }));

    /* ⌥D toggles the colour scheme, matching the menu bar hint. */
    window.addEventListener('keydown', (event) => {
      if (event.altKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        bus.emit('theme.set', { theme: 'toggle' });
      }
    });

    os = { wm, desktop, menubar, dock, router, registry, open, contextMenu };
    log.info(`desktop assembled with ${registry.apps.length} apps`);
    return os;
  }

  function enterOS() {
    const built = buildOS();
    document.documentElement.dataset.shell = 'os';
    root.hidden = false;
    returnButton.hidden = true;
    bus.emit('shell.changed', { mode: 'os' });

    // Deep link on first entry: #/projects should open Projects.
    const route = built.router.current();
    if (route.app) {
      built.open(route.app, { param: route.param, fromRouter: true });
      return built;
    }

    /* No deep link and never been here before: offer a starting point.
       Once is enough — a welcome screen that reappears is an obstacle. */
    let welcomed = true;
    try { welcomed = Boolean(localStorage.getItem('portfolio:welcomed')); } catch { /* ignore */ }
    if (!welcomed && !welcomeShown) {
      welcomeShown = true;
      built.open('welcome');
    }
    return built;
  }

  function enterPage() {
    document.documentElement.dataset.shell = 'page';
    root.hidden = true;
    returnButton.hidden = !capableOfOS();
    bus.emit('shell.changed', { mode: 'page' });
  }

  const api = {
    mode: () => mode,

    setMode(next, { persist = true } = {}) {
      if (next === mode) return mode;
      mode = next;
      if (persist) {
        // Session-scoped on purpose — see preferredMode().
        try { sessionStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      }
      if (next === 'os') enterOS();
      else enterPage();
      log.info(`shell → ${next}`);
      return mode;
    },

    open(appId, options) {
      if (mode !== 'os') api.setMode('os');
      return os?.open(appId, options);
    },

    apps: () => os?.registry.apps || [],
    wm: () => os?.wm || null,
    element: root,
  };

  /* Initial mode, without persisting a choice the visitor never made. */
  api.setMode(preferredMode(), { persist: false });

  /* If the window becomes too small for a desktop, fall back — but
     only automatically, and only once, so a deliberate choice on a
     small window is not overridden on every resize. */
  let autoSwitched = false;
  window.addEventListener('resize', () => {
    if (autoSwitched || mode !== 'os') return;
    if (window.innerWidth < 720) {
      autoSwitched = true;
      api.setMode('page', { persist: false });
    }
  }, { passive: true });

  return api;
}
