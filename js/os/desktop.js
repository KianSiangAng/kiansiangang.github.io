/* ================================================================
   DESKTOP.JS — The icon surface

   The desktop is a grid of launchers over the live wallpaper.
   What it supports, because a desktop that does not support these
   feels broken within about four seconds of use:

     - click to select, ⌘/Ctrl-click to add, drag a marquee to
       select a region
     - drag icons anywhere; positions snap to a grid and persist
     - double-click, Enter or Space to open
     - arrow keys move the selection, so it is fully keyboard usable
     - right-click on an icon or on empty space for a context menu
     - the whole surface is a listbox with roving tabindex, so
       screen readers see a list of launchers rather than a soup
       of divs
================================================================ */

import { el, clamp } from './dom.js';
import { appGlyph } from './icons.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('desktop');

const GRID = 104;
const ICON_WIDTH = 104;
const ICON_HEIGHT = 106;
const TOP_MARGIN = 54;
const LEFT_MARGIN = 30;
const STORAGE_KEY = 'portfolio:desktop-icons';

export function createDesktop({ bus, root, apps, onOpen, contextMenu }) {
  const surface = el('div.desktop', {
    id: 'desktop',
    role: 'listbox',
    'aria-label': 'Desktop',
    'aria-multiselectable': 'true',
  });
  const marquee = el('div.desktop__marquee', { 'aria-hidden': 'true', hidden: true });
  surface.appendChild(marquee);
  root.appendChild(surface);

  const positions = loadPositions();
  const icons = [];
  let selection = new Set();
  let activeIndex = 0;

  function loadPositions() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function savePositions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch {
      /* best effort */
    }
  }

  /** Default layout: one generous column down the left.
      Six launchers in a single column read as a menu; the same six
      spread across the right-hand side read as a folder someone
      forgot to tidy. Left-hand also matches reading order, and it
      keeps the right side of the wallpaper clear. */
  function defaultPosition(index) {
    const perColumn = Math.max(1, Math.floor((window.innerHeight - TOP_MARGIN - 130) / ICON_HEIGHT));
    const column = Math.floor(index / perColumn);
    const row = index % perColumn;
    return {
      x: LEFT_MARGIN + column * GRID,
      y: TOP_MARGIN + row * ICON_HEIGHT,
    };
  }

  function place(entry, x, y) {
    const maxX = Math.max(0, window.innerWidth - ICON_WIDTH - 8);
    const maxY = Math.max(TOP_MARGIN, window.innerHeight - ICON_HEIGHT - 90);
    entry.x = clamp(Math.round(x), 8, maxX);
    entry.y = clamp(Math.round(y), TOP_MARGIN, maxY);
    entry.el.style.setProperty('left', `${entry.x}px`);
    entry.el.style.setProperty('top', `${entry.y}px`);
  }

  function snapToGrid(value, origin) {
    return origin + Math.round((value - origin) / (GRID / 2)) * (GRID / 2);
  }

  /** The attention ring on the featured launcher retires for good
      the first time anything on the desktop is opened. */
  function retireHint() {
    surface.classList.add('has-been-used');
    try { localStorage.setItem('portfolio:desktop-used', '1'); } catch { /* ignore */ }
  }

  /* ----------------------------------------------------------------
     Selection
  ---------------------------------------------------------------- */

  function syncSelection() {
    for (const entry of icons) {
      const selected = selection.has(entry.app.id);
      entry.el.classList.toggle('is-selected', selected);
      entry.el.setAttribute('aria-selected', String(selected));
    }
  }

  function select(appId, { additive = false } = {}) {
    if (!additive) selection.clear();
    if (appId) {
      if (additive && selection.has(appId)) selection.delete(appId);
      else selection.add(appId);
    }
    syncSelection();
  }

  function setActive(index) {
    activeIndex = clamp(index, 0, icons.length - 1);
    for (const [i, entry] of icons.entries()) {
      entry.el.tabIndex = i === activeIndex ? 0 : -1;
    }
    icons[activeIndex]?.el.focus({ preventScroll: true });
  }

  /* ----------------------------------------------------------------
     Icon construction
  ---------------------------------------------------------------- */

  function buildIcon(app, index) {
    const label = el('span.desktop-icon__label', { text: app.title });
    /* The tile's gradient comes from the app definition, written
       through CSSOM custom properties — which CSP permits, unlike a
       style attribute in markup. */
    const [from, to] = app.tint || ['#cfd8e6', '#a8b8cc'];
    const glyph = el('span.desktop-icon__glyph', {
      dataset: { kind: app.kind || 'app', app: app.id },
      style: { '--icon-from': from, '--icon-to': to },
    }, appGlyph(app.icon, 38));

    const node = el('div.desktop-icon', {
      role: 'option',
      'aria-selected': 'false',
      tabindex: index === 0 ? '0' : '-1',
      dataset: { app: app.id, featured: String(Boolean(app.featured)) },
      title: app.description || app.title,
    }, [
      glyph,
      label,
      el('span.desktop-icon__caption', { text: app.description || '' }),
    ]);

    const entry = { app, el: node, x: 0, y: 0 };
    const saved = positions[app.id];
    const initial = saved || defaultPosition(index);
    place(entry, initial.x, initial.y);

    /* -- open -- */
    node.addEventListener('dblclick', () => { retireHint(); onOpen(app.id); });
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        retireHint();
        onOpen(app.id);
      }
    });

    /* -- select + drag -- */
    node.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();

      const additive = event.metaKey || event.ctrlKey;
      if (!selection.has(app.id) || additive) select(app.id, { additive });
      setActive(icons.indexOf(entry));

      const startX = event.clientX;
      const startY = event.clientY;
      const moving = [...icons].filter((candidate) => selection.has(candidate.app.id));
      const origins = moving.map((candidate) => ({ entry: candidate, x: candidate.x, y: candidate.y }));
      let dragged = false;

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (!dragged && Math.hypot(dx, dy) < 4) return;    // tolerance before it counts as a drag
        dragged = true;
        node.classList.add('is-dragging');
        for (const origin of origins) place(origin.entry, origin.x + dx, origin.y + dy);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        node.classList.remove('is-dragging');
        if (!dragged) return;

        for (const origin of origins) {
          place(origin.entry, snapToGrid(origin.entry.x, 8), snapToGrid(origin.entry.y, TOP_MARGIN));
          positions[origin.entry.app.id] = { x: origin.entry.x, y: origin.entry.y };
        }
        savePositions();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    /* -- context menu -- */
    node.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      select(app.id);
      contextMenu.open(event.clientX, event.clientY, [
        { label: `Open ${app.title}`, icon: app.icon, action: () => onOpen(app.id) },
        app.url
          ? { label: 'Open source in new tab', icon: 'globe', action: () => window.open(app.url, '_blank', 'noopener,noreferrer') }
          : null,
        'separator',
        { label: 'Tidy icons', icon: 'window', action: tidy },
      ].filter(Boolean));
    });

    surface.appendChild(node);
    return entry;
  }

  /* ----------------------------------------------------------------
     Marquee selection over empty space
  ---------------------------------------------------------------- */

  surface.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target !== surface) return;

    select(null);
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;

    const onMove = (moveEvent) => {
      const x = Math.min(startX, moveEvent.clientX);
      const y = Math.min(startY, moveEvent.clientY);
      const width = Math.abs(moveEvent.clientX - startX);
      const height = Math.abs(moveEvent.clientY - startY);
      if (!active && Math.hypot(width, height) < 6) return;

      active = true;
      marquee.hidden = false;
      marquee.style.setProperty('left', `${x}px`);
      marquee.style.setProperty('top', `${y}px`);
      marquee.style.setProperty('width', `${width}px`);
      marquee.style.setProperty('height', `${height}px`);

      selection.clear();
      for (const entry of icons) {
        const box = entry.el.getBoundingClientRect();
        const hit = box.right > x && box.left < x + width && box.bottom > y && box.top < y + height;
        if (hit) selection.add(entry.app.id);
      }
      syncSelection();
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      marquee.hidden = true;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  surface.addEventListener('contextmenu', (event) => {
    if (event.target !== surface) return;
    event.preventDefault();
    contextMenu.open(event.clientX, event.clientY, [
      { label: 'Tidy icons', icon: 'window', action: tidy },
      { label: 'Reset icon positions', icon: 'trash', action: reset },
      'separator',
      { label: 'Toggle dark mode', icon: 'star', action: () => bus.emit('theme.set', { theme: 'toggle' }) },
      { label: 'Summon petals', icon: 'globe', action: () => bus.emit('petals.storm', { intensity: 1.8 }) },
      'separator',
      { label: 'Open Settings', icon: 'gear', action: () => onOpen('settings') },
    ]);
  });

  /* Arrow-key navigation across the icon grid. */
  surface.addEventListener('keydown', (event) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();

    const current = icons[activeIndex];
    if (!current) return;

    // Nearest icon in the direction of travel, by centre distance.
    const best = icons
      .filter((entry) => entry !== current)
      .map((entry) => ({ entry, dx: entry.x - current.x, dy: entry.y - current.y }))
      .filter(({ dx, dy }) => {
        if (event.key === 'ArrowRight') return dx > 4;
        if (event.key === 'ArrowLeft') return dx < -4;
        if (event.key === 'ArrowDown') return dy > 4;
        return dy < -4;
      })
      .sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy))[0];

    if (best) {
      setActive(icons.indexOf(best.entry));
      select(best.entry.app.id);
    }
  });

  function tidy() {
    icons.forEach((entry, index) => {
      const spot = defaultPosition(index);
      place(entry, spot.x, spot.y);
      positions[entry.app.id] = { x: entry.x, y: entry.y };
    });
    savePositions();
  }

  function reset() {
    for (const key of Object.keys(positions)) delete positions[key];
    savePositions();
    tidy();
  }

  /* Keep icons on screen when the window shrinks. */
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      for (const entry of icons) place(entry, entry.x, entry.y);
    }, 150);
  }, { passive: true });

  try {
    if (localStorage.getItem('portfolio:desktop-used')) surface.classList.add('has-been-used');
  } catch { /* ignore */ }

  for (const [index, app] of apps.entries()) icons.push(buildIcon(app, index));
  log.info(`${icons.length} desktop icons`);

  return {
    element: surface,
    tidy,
    reset,
    select,
    retireHint,
    icons: () => icons.map((entry) => entry.app.id),
  };
}
