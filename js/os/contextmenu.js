/* ================================================================
   CONTEXTMENU.JS — Right-click menus

   One menu element is reused for every context: building a fresh
   DOM tree per right-click is wasteful, and keeping one around
   makes dismissal logic trivial (there is only ever one to close).

   Items: { label, icon, action, disabled, checked } or 'separator'.
   Keyboard: arrows move, Enter activates, Escape dismisses. The
   menu flips itself when it would overflow the viewport.
================================================================ */

import { el, clear } from './dom.js';
import { icon } from './icons.js';

export function createContextMenu() {
  const menu = el('div.ctxmenu', { role: 'menu', hidden: true });
  document.body.appendChild(menu);

  let items = [];
  let cursor = -1;

  function close() {
    if (menu.hidden) return;
    menu.hidden = true;
    menu.classList.remove('is-open');
    cursor = -1;
  }

  function activate(index) {
    const entry = items[index];
    if (!entry || entry === 'separator' || entry.disabled) return;
    close();
    entry.action?.();
  }

  function move(delta) {
    const selectable = items
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry !== 'separator' && !entry.disabled);
    if (selectable.length === 0) return;

    const position = selectable.findIndex(({ index }) => index === cursor);
    const next = selectable[(position + delta + selectable.length) % selectable.length];
    cursor = next.index;

    for (const child of menu.children) child.classList.remove('is-active');
    menu.querySelector(`[data-index="${cursor}"]`)?.classList.add('is-active');
  }

  function open(x, y, entries) {
    items = entries;
    clear(menu);

    entries.forEach((entry, index) => {
      if (entry === 'separator') {
        menu.appendChild(el('div.ctxmenu__sep', { role: 'separator' }));
        return;
      }
      const item = el('button.ctxmenu__item', {
        type: 'button',
        role: 'menuitem',
        disabled: entry.disabled || false,
        dataset: { index: String(index) },
        onclick: () => activate(index),
        onmousemove: () => {
          cursor = index;
          for (const child of menu.children) child.classList.remove('is-active');
          item.classList.add('is-active');
        },
      }, [
        el('span.ctxmenu__icon', {}, entry.icon ? icon(entry.icon, 14) : null),
        el('span.ctxmenu__label', { text: entry.label }),
        entry.checked ? el('span.ctxmenu__check', { text: '✓' }) : null,
      ]);
      menu.appendChild(item);
    });

    // Measure before positioning so the flip is accurate.
    menu.hidden = false;
    menu.style.setProperty('left', '0px');
    menu.style.setProperty('top', '0px');
    const rect = menu.getBoundingClientRect();

    const left = x + rect.width > window.innerWidth - 8 ? x - rect.width : x;
    const top = y + rect.height > window.innerHeight - 8 ? y - rect.height : y;

    menu.style.setProperty('left', `${Math.max(6, left)}px`);
    menu.style.setProperty('top', `${Math.max(6, top)}px`);
    menu.classList.add('is-open');
    cursor = -1;
  }

  window.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !menu.contains(event.target)) close();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (menu.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Enter') { event.preventDefault(); activate(cursor); }
  });

  window.addEventListener('blur', close);
  window.addEventListener('resize', close, { passive: true });

  return { open, close, isOpen: () => !menu.hidden };
}
