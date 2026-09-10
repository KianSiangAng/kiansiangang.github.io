/* ================================================================
   PALETTE.JS — ⌘K command palette

   The keyboard interface to the whole site: navigate sections,
   flip worlds, run shell commands, open links, toggle the HUD.
   Fuzzy-ranked, fully keyboard driven, and wired up as a proper
   ARIA combobox so it is usable with a screen reader rather than
   just impressive-looking.

   Opened with ⌘K / Ctrl-K, or by pressing / outside a text field.
================================================================ */

import { fuzzyRank } from './fuzzy.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('palette');

export function createPalette({ bus, actions }) {
  /* ---- DOM ---- */
  const overlay = document.createElement('div');
  overlay.className = 'palette';
  overlay.hidden = true;

  const dialog = document.createElement('div');
  dialog.className = 'palette__dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Command palette');

  const input = document.createElement('input');
  input.className = 'palette__input';
  input.type = 'text';
  input.placeholder = 'Type a command or search…';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', 'palette-list');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('spellcheck', 'false');

  const list = document.createElement('ul');
  list.className = 'palette__list';
  list.id = 'palette-list';
  list.setAttribute('role', 'listbox');

  const footer = document.createElement('div');
  footer.className = 'palette__footer';
  footer.textContent = '↑↓ navigate · ↵ run · esc close';

  dialog.append(input, list, footer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  /* ---- state ---- */
  let results = [];
  let cursor = 0;
  let lastFocused = null;

  function searchText(action) {
    return `${action.title} ${action.group || ''} ${(action.keywords || []).join(' ')}`;
  }

  function render() {
    list.replaceChildren();

    if (results.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'palette__empty';
      empty.setAttribute('role', 'option');
      empty.setAttribute('aria-selected', 'false');
      empty.textContent = 'No matches. Try: projects, hacker, terminal, resume.';
      list.appendChild(empty);
      input.removeAttribute('aria-activedescendant');
      return;
    }

    results.forEach((entry, index) => {
      const action = entry.item;
      const item = document.createElement('li');
      item.className = 'palette__item' + (index === cursor ? ' is-active' : '');
      item.id = `palette-item-${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index === cursor));

      const icon = document.createElement('span');
      icon.className = 'palette__icon';
      icon.textContent = action.icon || '›';

      const label = document.createElement('span');
      label.className = 'palette__label';
      label.textContent = action.title;

      const group = document.createElement('span');
      group.className = 'palette__group';
      group.textContent = action.group || '';

      item.append(icon, label, group);
      if (action.hint) {
        const hint = document.createElement('kbd');
        hint.className = 'palette__hint';
        hint.textContent = action.hint;
        item.appendChild(hint);
      }

      item.addEventListener('mousemove', () => { cursor = index; syncActive(); });
      item.addEventListener('click', () => run(index));
      list.appendChild(item);
    });

    input.setAttribute('aria-activedescendant', `palette-item-${cursor}`);
  }

  function syncActive() {
    [...list.children].forEach((child, index) => {
      child.classList.toggle('is-active', index === cursor);
      child.setAttribute('aria-selected', String(index === cursor));
    });
    input.setAttribute('aria-activedescendant', `palette-item-${cursor}`);
    list.children[cursor]?.scrollIntoView({ block: 'nearest' });
  }

  function search(query) {
    const available = actions().filter((a) => !a.when || a.when());
    results = query
      ? fuzzyRank(query, available, searchText).slice(0, 12)
      : available.slice(0, 12).map((item) => ({ item, score: 0 }));
    cursor = 0;
    render();
  }

  async function run(index) {
    const entry = results[index];
    if (!entry) return;
    close();
    try {
      await entry.item.run();
    } catch (err) {
      log.error(`action "${entry.item.title}" failed`, err);
    }
  }

  function open(prefill = '') {
    if (!overlay.hidden) return;
    lastFocused = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    input.value = prefill;
    search(prefill);
    input.focus();
    bus.emit('achievement.unlock', { id: 'palette' });
    bus.emit('palette.opened');
  }

  function close() {
    if (overlay.hidden) return;
    overlay.classList.remove('is-open');
    overlay.hidden = true;
    lastFocused?.focus?.();
    bus.emit('palette.closed');
  }

  /* ---- events ---- */
  input.addEventListener('input', () => search(input.value));

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      cursor = (cursor + 1) % Math.max(results.length, 1);
      syncActive();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      cursor = (cursor - 1 + results.length) % Math.max(results.length, 1);
      syncActive();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(cursor);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      // Keep focus inside the dialog: there is only one focusable
      // element, so the trap is simply "stay here".
      event.preventDefault();
    }
    event.stopPropagation();
  });

  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close();
  });

  return {
    open,
    close,
    toggle: () => (overlay.hidden ? open() : close()),
    isOpen: () => !overlay.hidden,
    element: overlay,
  };
}
