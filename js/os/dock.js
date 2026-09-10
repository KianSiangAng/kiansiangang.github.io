/* ================================================================
   DOCK.JS — The dock

   Pinned launchers plus anything currently running. A dot under a
   tile means the app has a window; clicking a running app focuses
   it, or restores it if it was minimised; clicking a pinned app
   that is not running launches it.

   The magnification is deliberately mild. A dock that balloons to
   three times its size is a lovely demo and a miserable target to
   actually hit, so tiles grow by a quarter at most, and not at all
   when the visitor has asked for reduced motion.
================================================================ */

import { el } from './dom.js';
import { icon } from './icons.js';

export function createDock({ bus, root, apps, wm, onOpen, reducedMotion }) {
  const list = el('div.dock__items', { role: 'toolbar', 'aria-label': 'Dock' });
  const dock = el('div.dock', { id: 'dock' }, [list]);
  root.appendChild(dock);

  /** appId → { el, dot, app } */
  const tiles = new Map();

  function buildTile(app) {
    const dot = el('span.dock__dot', { 'aria-hidden': 'true' });
    const tile = el('button.dock__tile', {
      type: 'button',
      'aria-label': app.title,
      title: app.title,
      dataset: { app: app.id },
      onclick: () => {
        const existing = wm.byApp(app.id);
        if (existing) existing.focus();
        else onOpen(app.id);
      },
    }, [
      el('span.dock__glyph', {}, icon(app.icon, 26)),
      el('span.dock__label', { text: app.title }),
      dot,
    ]);

    tiles.set(app.id, { el: tile, dot, app });
    list.appendChild(tile);
    return tile;
  }

  for (const app of apps.filter((a) => a.pinned)) buildTile(app);

  /* ---- running indicators ---- */
  function sync() {
    const running = new Set(wm.list().map((win) => win.appId));
    const focused = wm.focused();

    for (const [appId, tile] of tiles) {
      const isRunning = running.has(appId);
      tile.el.classList.toggle('is-running', isRunning);
      tile.el.classList.toggle('is-focused', focused?.appId === appId);
      tile.dot.hidden = !isRunning;
      if (!isRunning && !tile.app.pinned) {
        tile.el.remove();
        tiles.delete(appId);
      }
    }

    // A running app that is not pinned earns a temporary tile.
    for (const win of wm.list()) {
      if (tiles.has(win.appId)) continue;
      const app = apps.find((a) => a.id === win.appId) || {
        id: win.appId, title: win.title, icon: 'window',
      };
      buildTile(app);
      tiles.get(win.appId).el.classList.add('is-running', 'is-transient');
      tiles.get(win.appId).dot.hidden = false;
    }
  }

  for (const topic of ['wm.opened', 'wm.closed', 'wm.focused', 'wm.minimised', 'wm.restored']) {
    bus.on(topic, sync);
  }

  /* ---- magnification ---- */
  if (!reducedMotion) {
    list.addEventListener('pointermove', (event) => {
      const bounds = list.getBoundingClientRect();
      for (const tile of tiles.values()) {
        const box = tile.el.getBoundingClientRect();
        const distance = Math.abs(event.clientX - (box.left + box.width / 2));
        // Falls off over ~110px; peaks at 1.25×.
        const scale = 1 + Math.max(0, 1 - distance / 110) * 0.25;
        tile.el.style.setProperty('--dock-scale', scale.toFixed(3));
      }
      dock.classList.toggle('is-hovered', event.clientY > bounds.top - 20);
    });

    list.addEventListener('pointerleave', () => {
      for (const tile of tiles.values()) tile.el.style.setProperty('--dock-scale', '1');
      dock.classList.remove('is-hovered');
    });
  }

  sync();

  return { element: dock, sync };
}
