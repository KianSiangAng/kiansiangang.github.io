/* ================================================================
   WM.JS — Window manager

   Everything you expect from a desktop window, implemented on
   pointer events:

     - drag by the title bar, with edge snapping (top = zoom,
       left/right = half screen), previewed while you drag
     - resize from eight handles, respecting per-app minimum sizes
     - a focus stack that owns z-order; focusing raises, closing
       hands focus to whatever was beneath
     - minimise (to the dock), zoom (maximise), close
     - double-click the title bar to zoom
     - geometry persisted per app, so a window reopens where you
       left it — and is re-validated against the current viewport,
       because monitors change
     - cascade placement for first-run windows so they never land
       exactly on top of one another

   Windows are real DOM with role="dialog" and a labelled title, and
   the whole thing is keyboard reachable: Escape closes the focused
   window, Ctrl-Tab cycles.

   Pointer capture is used for drag and resize, so releasing the
   button outside the viewport (or over an iframe) still ends the
   gesture cleanly — the classic "window stuck to the cursor" bug.
================================================================ */

import { el, clamp } from './dom.js';
import { icon } from './icons.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('wm');

const MENUBAR_HEIGHT = 30;
const DOCK_RESERVE = 86;
const SNAP_EDGE = 18;
const STORAGE_KEY = 'portfolio:windows';
const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export function createWindowManager({ bus, root }) {
  const layer = el('div.wm-layer', { id: 'wm-layer' });
  const snapHint = el('div.wm-snap', { 'aria-hidden': 'true' });
  layer.appendChild(snapHint);
  root.appendChild(layer);

  /** @type {Map<string, object>} live windows, keyed by window id */
  const windows = new Map();
  const focusStack = [];
  let sequence = 0;
  let zCounter = 100;

  const geometry = loadGeometry();

  function loadGeometry() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveGeometry() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(geometry));
    } catch {
      /* best effort */
    }
  }

  function workArea() {
    return {
      top: MENUBAR_HEIGHT,
      left: 0,
      right: window.innerWidth,
      bottom: window.innerHeight - DOCK_RESERVE,
      width: window.innerWidth,
      height: window.innerHeight - MENUBAR_HEIGHT - DOCK_RESERVE,
    };
  }

  /* ----------------------------------------------------------------
     Placement
  ---------------------------------------------------------------- */

  function initialRect(appId, options) {
    const area = workArea();
    const width = Math.min(options.width ?? 720, area.width - 40);
    const height = Math.min(options.height ?? 480, area.height - 20);

    const saved = geometry[appId];
    if (saved && !options.ignoreSaved) {
      // Re-validate: the viewport may be smaller than it was last time.
      const w = clamp(saved.width, options.minWidth ?? 320, area.width);
      const h = clamp(saved.height, options.minHeight ?? 200, area.height);
      return {
        x: clamp(saved.x, 0, Math.max(0, area.width - w)),
        y: clamp(saved.y, area.top, Math.max(area.top, area.bottom - h)),
        width: w,
        height: h,
      };
    }

    // Cascade: each new window steps down and right from the last.
    const step = (windows.size % 6) * 28;
    return {
      x: clamp(Math.round(area.width / 2 - width / 2) + step - 70, 12, Math.max(12, area.width - width - 12)),
      y: clamp(area.top + 34 + step, area.top, Math.max(area.top, area.bottom - height)),
      width,
      height,
    };
  }

  /* ----------------------------------------------------------------
     Focus
  ---------------------------------------------------------------- */

  function focus(win) {
    if (!win || win.closed) return;

    const index = focusStack.indexOf(win);
    if (index !== -1) focusStack.splice(index, 1);
    focusStack.push(win);

    for (const other of windows.values()) other.el.classList.toggle('is-focused', other === win);
    win.el.style.setProperty('z-index', String(++zCounter));

    if (win.minimised) restore(win);
    bus.emit('wm.focused', { id: win.id, appId: win.appId, title: win.title });
  }

  function focusTop() {
    for (let i = focusStack.length - 1; i >= 0; i--) {
      const candidate = focusStack[i];
      if (candidate && !candidate.closed && !candidate.minimised) return focus(candidate);
    }
    bus.emit('wm.focused', { id: null, appId: null, title: null });
    return undefined;
  }

  /* ----------------------------------------------------------------
     Geometry mutation
  ---------------------------------------------------------------- */

  function applyRect(win, rect) {
    Object.assign(win.rect, rect);
    win.el.style.setProperty('left', `${win.rect.x}px`);
    win.el.style.setProperty('top', `${win.rect.y}px`);
    win.el.style.setProperty('width', `${win.rect.width}px`);
    win.el.style.setProperty('height', `${win.rect.height}px`);
  }

  function remember(win) {
    if (win.zoomed) return;                 // never persist the zoomed size
    geometry[win.appId] = { ...win.rect };
    saveGeometry();
  }

  function zoom(win) {
    const area = workArea();
    if (win.zoomed) {
      applyRect(win, win.restoreRect);
      win.zoomed = false;
    } else {
      win.restoreRect = { ...win.rect };
      applyRect(win, { x: 8, y: area.top + 6, width: area.width - 16, height: area.height - 12 });
      win.zoomed = true;
    }
    win.el.classList.toggle('is-zoomed', win.zoomed);
    win.el.querySelector('.win__zoom')?.setAttribute('aria-pressed', String(win.zoomed));
    bus.emit('wm.zoomed', { id: win.id, zoomed: win.zoomed });
  }

  function minimise(win) {
    win.minimised = true;
    win.el.classList.add('is-minimised');
    win.el.setAttribute('aria-hidden', 'true');
    bus.emit('wm.minimised', { id: win.id, appId: win.appId, title: win.title });
    focusTop();
  }

  function restore(win) {
    win.minimised = false;
    win.el.classList.remove('is-minimised');
    win.el.removeAttribute('aria-hidden');
    bus.emit('wm.restored', { id: win.id, appId: win.appId });
  }

  function close(win) {
    if (win.closed) return;
    win.closed = true;
    remember(win);
    win.el.classList.add('is-closing');

    /* Leave the focus stack immediately rather than when the close
       animation ends. Otherwise a window that is on its way out stays
       on top of the stack for ~200ms, and anything that acts on "the
       top window" during that gap (holding Escape, say) finds a dead
       window and does nothing. */
    const stackIndex = focusStack.indexOf(win);
    if (stackIndex !== -1) focusStack.splice(stackIndex, 1);

    const finish = () => {
      win.onClose?.();
      win.el.remove();
      windows.delete(win.id);
      bus.emit('wm.closed', { id: win.id, appId: win.appId });
      focusTop();
    };

    // Wait for the close animation, but never trust it to fire.
    let done = false;
    const once = () => { if (!done) { done = true; finish(); } };
    win.el.addEventListener('animationend', once, { once: true });
    setTimeout(once, 260);
  }

  /* ----------------------------------------------------------------
     Dragging
  ---------------------------------------------------------------- */

  function beginDrag(win, event) {
    if (win.zoomed) return;                       // zoomed windows do not move
    event.preventDefault();
    focus(win);

    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...win.rect };
    const area = workArea();
    let snapTarget = null;

    win.el.classList.add('is-dragging');
    document.body.classList.add('is-window-dragging');
    event.target.setPointerCapture?.(event.pointerId);

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      applyRect(win, {
        // Keep at least a strip of the title bar reachable at all times.
        x: clamp(origin.x + dx, -origin.width + 120, area.width - 120),
        y: clamp(origin.y + dy, area.top, area.bottom - 40),
      });

      snapTarget = detectSnap(moveEvent.clientX, moveEvent.clientY, area);
      showSnapHint(snapTarget, area);
    };

    const onUp = () => {
      win.el.classList.remove('is-dragging');
      document.body.classList.remove('is-window-dragging');
      snapHint.classList.remove('is-visible');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);

      if (snapTarget) applySnap(win, snapTarget, area);
      remember(win);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function detectSnap(x, y, area) {
    if (y <= area.top + SNAP_EDGE) return 'top';
    if (x <= SNAP_EDGE) return 'left';
    if (x >= area.right - SNAP_EDGE) return 'right';
    return null;
  }

  function snapRect(target, area) {
    if (target === 'top') return { x: 8, y: area.top + 6, width: area.width - 16, height: area.height - 12 };
    if (target === 'left') return { x: 8, y: area.top + 6, width: area.width / 2 - 12, height: area.height - 12 };
    return { x: area.width / 2 + 4, y: area.top + 6, width: area.width / 2 - 12, height: area.height - 12 };
  }

  function showSnapHint(target, area) {
    if (!target) {
      snapHint.classList.remove('is-visible');
      return;
    }
    const rect = snapRect(target, area);
    snapHint.style.setProperty('left', `${rect.x}px`);
    snapHint.style.setProperty('top', `${rect.y}px`);
    snapHint.style.setProperty('width', `${rect.width}px`);
    snapHint.style.setProperty('height', `${rect.height}px`);
    snapHint.classList.add('is-visible');
  }

  function applySnap(win, target, area) {
    win.restoreRect = { ...win.rect };
    applyRect(win, snapRect(target, area));
    if (target === 'top') {
      win.zoomed = true;
      win.el.classList.add('is-zoomed');
    }
  }

  /* ----------------------------------------------------------------
     Resizing
  ---------------------------------------------------------------- */

  function beginResize(win, edge, event) {
    event.preventDefault();
    event.stopPropagation();
    focus(win);

    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...win.rect };
    const area = workArea();
    const minWidth = win.minWidth;
    const minHeight = win.minHeight;

    win.el.classList.add('is-resizing');
    event.target.setPointerCapture?.(event.pointerId);

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const next = { ...origin };

      if (edge.includes('e')) next.width = clamp(origin.width + dx, minWidth, area.width - origin.x);
      if (edge.includes('s')) next.height = clamp(origin.height + dy, minHeight, area.bottom - origin.y);
      if (edge.includes('w')) {
        // Dragging the west edge moves x and changes width together;
        // clamping width first keeps x from overshooting the minimum.
        next.width = clamp(origin.width - dx, minWidth, origin.x + origin.width);
        next.x = origin.x + origin.width - next.width;
      }
      if (edge.includes('n')) {
        next.height = clamp(origin.height - dy, minHeight, origin.y + origin.height - area.top);
        next.y = origin.y + origin.height - next.height;
      }

      applyRect(win, next);
      win.onResize?.(win.rect);
    };

    const onUp = () => {
      win.el.classList.remove('is-resizing');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      remember(win);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  /* ----------------------------------------------------------------
     Construction
  ---------------------------------------------------------------- */

  function open(appId, options = {}) {
    // Singleton apps focus their existing window rather than duplicating.
    if (options.singleton !== false) {
      const existing = [...windows.values()].find((w) => w.appId === appId && !w.closed);
      if (existing) {
        focus(existing);
        return existing;
      }
    }

    const id = `win-${++sequence}`;
    const rect = initialRect(appId, options);
    const titleId = `${id}-title`;

    const body = el('div.win__body', { id: `${id}-body` });
    const title = el('span.win__title', { id: titleId, text: options.title || appId });

    const closeButton = el('button.win__light.win__light--close', {
      type: 'button', 'aria-label': `Close ${options.title || appId}`, title: 'Close',
    });
    const minButton = el('button.win__light.win__light--min', {
      type: 'button', 'aria-label': `Minimise ${options.title || appId}`, title: 'Minimise',
    });
    const zoomButton = el('button.win__light.win__light--zoom.win__zoom', {
      type: 'button', 'aria-label': `Zoom ${options.title || appId}`, title: 'Zoom', 'aria-pressed': 'false',
    });

    const bar = el('header.win__bar', {}, [
      el('div.win__lights', {}, [closeButton, minButton, zoomButton]),
      el('div.win__titlewrap', {}, [
        options.icon ? el('span.win__icon', {}, icon(options.icon, 14)) : null,
        title,
      ]),
      el('div.win__spacer'),
    ]);

    const frame = el('section.win', {
      id,
      role: 'dialog',
      'aria-labelledby': titleId,
      dataset: { app: appId },
      tabindex: '-1',
    }, [bar, body, ...HANDLES.map((edge) => el(`div.win__handle.win__handle--${edge}`, { dataset: { edge } }))]);

    const win = {
      id,
      appId,
      title: options.title || appId,
      el: frame,
      body,
      rect: { ...rect },
      restoreRect: { ...rect },
      minWidth: options.minWidth ?? 320,
      minHeight: options.minHeight ?? 200,
      zoomed: false,
      minimised: false,
      closed: false,
      onClose: options.onClose,
      onResize: options.onResize,
      setTitle(text) {
        win.title = text;
        title.textContent = text;
        bus.emit('wm.retitled', { id, title: text });
      },
      focus: () => focus(win),
      close: () => close(win),
      minimise: () => minimise(win),
      zoom: () => zoom(win),
    };

    applyRect(win, rect);
    windows.set(id, win);
    layer.appendChild(frame);

    /* -- wiring -- */
    bar.addEventListener('pointerdown', (event) => {
      if (event.target.closest('.win__light')) return;   // buttons are not a drag handle
      beginDrag(win, event);
    });
    bar.addEventListener('dblclick', (event) => {
      if (event.target.closest('.win__light')) return;
      zoom(win);
    });

    for (const handle of frame.querySelectorAll('.win__handle')) {
      handle.addEventListener('pointerdown', (event) => beginResize(win, handle.dataset.edge, event));
    }

    closeButton.addEventListener('click', () => close(win));
    minButton.addEventListener('click', () => minimise(win));
    zoomButton.addEventListener('click', () => zoom(win));
    frame.addEventListener('pointerdown', () => focus(win), true);

    if (options.content) body.appendChild(options.content);

    focus(win);
    requestAnimationFrame(() => frame.classList.add('is-open'));
    bus.emit('wm.opened', { id, appId, title: win.title });
    log.debug(`opened ${appId} as ${id}`);

    return win;
  }

  /* ----------------------------------------------------------------
     Global behaviour
  ---------------------------------------------------------------- */

  window.addEventListener('keydown', (event) => {
    const typing = event.target instanceof HTMLElement &&
      (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable);

    if (event.key === 'Escape' && !typing) {
      // Search down the stack: the top entry may be mid-close.
      for (let i = focusStack.length - 1; i >= 0; i--) {
        if (focusStack[i].closed) continue;
        event.preventDefault();
        close(focusStack[i]);
        break;
      }
    } else if (event.key === 'Tab' && event.ctrlKey) {
      // Cycle windows, oldest-focused first, like Ctrl-Tab elsewhere.
      const open = [...windows.values()].filter((w) => !w.closed && !w.minimised);
      if (open.length > 1) {
        event.preventDefault();
        const current = focusStack[focusStack.length - 1];
        const index = open.indexOf(current);
        focus(open[(index + 1) % open.length]);
      }
    }
  });

  /* Keep every window inside the work area when the viewport changes. */
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const area = workArea();
      for (const win of windows.values()) {
        if (win.zoomed) {
          applyRect(win, { x: 8, y: area.top + 6, width: area.width - 16, height: area.height - 12 });
          continue;
        }
        applyRect(win, {
          width: Math.min(win.rect.width, area.width - 16),
          height: Math.min(win.rect.height, area.height - 12),
          x: clamp(win.rect.x, -win.rect.width + 120, Math.max(0, area.width - 120)),
          y: clamp(win.rect.y, area.top, Math.max(area.top, area.bottom - 40)),
        });
        win.onResize?.(win.rect);
      }
    }, 120);
  }, { passive: true });

  return {
    open,
    close: (id) => { const w = windows.get(id); if (w) close(w); },
    focus: (id) => focus(windows.get(id)),
    get: (id) => windows.get(id),
    byApp: (appId) => [...windows.values()].find((w) => w.appId === appId && !w.closed),
    list: () => [...windows.values()].filter((w) => !w.closed),
    focused: () => focusStack[focusStack.length - 1] || null,
    closeAll() { for (const win of [...windows.values()]) close(win); },
    element: layer,
  };
}
