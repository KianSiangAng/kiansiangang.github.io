/* ================================================================
   ACHIEVEMENTS.JS — Because a portfolio should reward curiosity

   Visitors who poke at the site get told they found something.
   Unlocks persist in localStorage, and the palette can list them.
   Every unlock is idempotent and announced to screen readers via
   an aria-live region.
================================================================ */

import { createLogger } from '../core/logger.js';

const log = createLogger('achv');
const STORAGE_KEY = 'portfolio:achievements';

export const CATALOGUE = [
  { id: 'terminal',  name: 'Shell Access',        hint: 'Run a command in the terminal' },
  { id: 'sudo',      name: 'Least Privilege',     hint: 'Try to sudo' },
  { id: 'nmap',      name: 'Recon',               hint: 'Scan the site for open ports' },
  { id: 'matrix',    name: 'Red Pill',            hint: 'Follow the white rabbit' },
  { id: 'hacker',    name: 'Two Worlds',          hint: 'Switch to the hacker world' },
  { id: 'konami',    name: 'Up Up Down Down',     hint: 'An old cheat code still works' },
  { id: 'palette',   name: 'Power User',          hint: 'Open the command palette' },
  { id: 'flag',      name: 'Capture the Flag',    hint: 'Find the hidden flag' },
  { id: 'audio',     name: 'Soundtrack',          hint: 'Turn on the generated audio' },
  { id: 'hud',       name: 'Instrumented',        hint: 'Open the performance HUD' },
  { id: 'deep',      name: 'Thorough Reader',     hint: 'Read all the way to the footer' },
  { id: 'source',    name: 'Source Diver',        hint: 'Open the developer console' },
];

export function createAchievements({ bus }) {
  const unlocked = new Set(load());

  const layer = document.createElement('div');
  layer.className = 'achv-layer';
  layer.setAttribute('role', 'status');
  layer.setAttribute('aria-live', 'polite');
  document.body.appendChild(layer);

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked]));
    } catch {
      /* best effort */
    }
  }

  function toast(achievement) {
    const card = document.createElement('div');
    card.className = 'achv-toast';

    const icon = document.createElement('span');
    icon.className = 'achv-toast__icon';
    icon.textContent = '★';

    const text = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = 'Achievement unlocked';
    const name = document.createElement('span');
    name.className = 'achv-toast__name';
    name.textContent = achievement.name;
    text.append(title, document.createElement('br'), name);

    card.append(icon, text);
    layer.appendChild(card);

    // Animate out, then remove — no timers left dangling.
    setTimeout(() => card.classList.add('is-leaving'), 4200);
    card.addEventListener('animationend', (event) => {
      if (event.animationName === 'achv-out') card.remove();
    });
  }

  function unlock(id) {
    if (unlocked.has(id)) return false;
    const achievement = CATALOGUE.find((a) => a.id === id);
    if (!achievement) return false;

    unlocked.add(id);
    persist();
    toast(achievement);
    log.info(`unlocked "${achievement.name}" (${unlocked.size}/${CATALOGUE.length})`);
    bus.emit('achievement.unlocked', { id, count: unlocked.size, total: CATALOGUE.length });
    return true;
  }

  bus.on('achievement.unlock', ({ id }) => unlock(id));

  return {
    unlock,
    has: (id) => unlocked.has(id),
    progress: () => ({ count: unlocked.size, total: CATALOGUE.length }),
    list: () => CATALOGUE.map((a) => ({ ...a, unlocked: unlocked.has(a.id) })),
    reset() { unlocked.clear(); persist(); },
  };
}
