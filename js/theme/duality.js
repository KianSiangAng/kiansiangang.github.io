/* ================================================================
   DUALITY.JS — Two worlds, one site

   The site exists in two states:

     ghibli — warm parchment, sakura, a procedural sky
     hacker — green phosphor on black, glyph rain, CRT scanlines

   Both are complete themes, not a filter over the other: the
   stylesheet keys off <html data-world>, the shader crossfades,
   the particles change shape, and the soundtrack changes bed.

   The transition itself is a state machine, because it must not
   be re-entrant: a visitor mashing the toggle should queue, not
   interleave. Two of the four states are the transitions.

   Orthogonal to this is the existing light/dark colour scheme,
   which keeps working exactly as it did.
================================================================ */

import { createMachine } from '../core/fsm.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('world');
const STORAGE_KEY = 'portfolio:world';
const TRANSITION_MS = 900;

export function createDuality({ bus, scene, audio, reducedMotion }) {
  /* The wipe overlay: a full-screen element the CSS animates. */
  const wipe = document.createElement('div');
  wipe.className = 'world-wipe';
  wipe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(wipe);

  function persisted() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'hacker' ? 'hacker' : 'ghibli';
    } catch {
      return 'ghibli';
    }
  }

  function applyWorld(world) {
    document.documentElement.dataset.world = world;
    scene?.setWorld(world === 'hacker' ? 1 : 0);
    audio?.setWorld(world === 'hacker' ? 1 : 0);
    try { localStorage.setItem(STORAGE_KEY, world); } catch { /* best effort */ }
    bus.emit('world.changed', { world });
    if (world === 'hacker') bus.emit('achievement.unlock', { id: 'hacker' });
  }

  /* ---- the machine ---- */
  const machine = createMachine({
    initial: persisted(),
    states: {
      ghibli: { on: { TOGGLE: 'toHacker', HACKER: 'toHacker' } },
      hacker: { on: { TOGGLE: 'toGhibli', GHIBLI: 'toGhibli' } },

      toHacker: {
        on: { DONE: 'hacker' },
        enter() { beginTransition('hacker'); },
      },
      toGhibli: {
        on: { DONE: 'ghibli' },
        enter() { beginTransition('ghibli'); },
      },
    },
  });

  let transitionTimer = 0;

  function beginTransition(target) {
    audio?.blip(target === 'hacker' ? 180 : 720);

    if (reducedMotion) {
      applyWorld(target);
      machine.send('DONE');
      return;
    }

    wipe.classList.remove('is-active', 'is-to-hacker', 'is-to-ghibli');
    // Force a reflow so restarting the animation actually restarts it.
    void wipe.offsetWidth;
    wipe.classList.add('is-active', target === 'hacker' ? 'is-to-hacker' : 'is-to-ghibli');
    document.documentElement.classList.add('is-shifting');

    // Swap the world at the midpoint, under cover of the wipe.
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => applyWorld(target), TRANSITION_MS * 0.42);

    setTimeout(() => {
      wipe.classList.remove('is-active');
      document.documentElement.classList.remove('is-shifting');
      machine.send('DONE');
      log.info(`world → ${target}`);
    }, TRANSITION_MS);
  }

  /* ---- initial paint: no animation, just the stored world ---- */
  applyWorld(machine.value);

  /* ---- requests from anywhere: palette, terminal, konami ---- */
  bus.on('world.request', ({ world }) => {
    const current = machine.value;
    if (current === 'toHacker' || current === 'toGhibli') return;   // mid-transition
    if (world === 'toggle') machine.send('TOGGLE');
    else if (world === 'hacker' && current !== 'hacker') machine.send('HACKER');
    else if (world === 'ghibli' && current !== 'ghibli') machine.send('GHIBLI');
  });

  /* ---- the light/dark colour scheme, unchanged in behaviour ---- */
  bus.on('theme.set', ({ theme }) => {
    const next = theme === 'toggle'
      ? (document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')
      : theme;
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* best effort */ }
    bus.emit('theme.changed', { theme: next });
    audio?.blip(next === 'dark' ? 420 : 640);
  });

  return {
    machine,
    get world() { return machine.value; },
    toggle: () => bus.emit('world.request', { world: 'toggle' }),
    set: (world) => bus.emit('world.request', { world }),
  };
}
