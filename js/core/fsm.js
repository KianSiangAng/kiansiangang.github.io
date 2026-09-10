/* ================================================================
   FSM.JS — A tiny finite state machine

   Used for the boot sequence and for the Ghibli⇄Hacker world
   transition, where "which state are we in" genuinely matters:
   a transition must not be interrupted halfway, and both worlds
   need enter/exit hooks that always pair up.

     const m = createMachine({
       initial: 'ghibli',
       states: {
         ghibli:      { on: { TOGGLE: 'dissolving' } },
         dissolving:  { on: { DONE: 'hacker' }, enter: playWipe },
         hacker:      { on: { TOGGLE: 'restoring' } },
       },
     });
     m.send('TOGGLE');
================================================================ */

import { signal } from './signal.js';

export function createMachine(config) {
  const current = signal(config.initial);
  const listeners = new Set();
  let context = { ...(config.context || {}) };

  function definition(name) {
    const state = config.states[name];
    if (!state) throw new Error(`[fsm] unknown state "${name}"`);
    return state;
  }

  /* Run the initial state's enter hook so entry logic is not
     skipped just because it happens to be the starting state. */
  const initialEnter = definition(config.initial).enter;
  if (initialEnter) initialEnter(context, { from: null, event: 'INIT' });

  function send(event, payload) {
    const from = current.peek();
    const target = definition(from).on?.[event];

    if (!target) return false;              // event not accepted here

    const next = typeof target === 'string' ? target : target.target;
    const action = typeof target === 'object' ? target.action : null;
    const guard = typeof target === 'object' ? target.guard : null;

    if (guard && !guard(context, payload)) return false;

    definition(from).exit?.(context, { to: next, event, payload });
    if (action) context = action(context, payload) || context;
    current.set(next);
    definition(next).enter?.(context, { from, event, payload });

    for (const fn of listeners) fn({ from, to: next, event, payload });
    return true;
  }

  return {
    state: current,                          // a signal: reactive reads
    get value() { return current.peek(); },
    get context() { return context; },
    can: (event) => Boolean(definition(current.peek()).on?.[event]),
    matches: (name) => current.peek() === name,
    send,
    onTransition(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
