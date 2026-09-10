/* ================================================================
   STORE.JS — Reducer store with middleware and time travel

   A Redux-shaped store whose state lives in a signal, so any
   component can subscribe to a *slice* and only re-run when that
   slice changes.

     const store = createStore({
       reducer,
       initialState,
       middleware: [loggerMiddleware, persistMiddleware('key')],
     });

     store.dispatch({ type: 'theme/set', payload: 'hacker' });
     store.select(s => s.theme).subscribe(console.log);

   Time travel is real: every dispatched action is recorded with
   the state that preceded it, and store.undo() rewinds. The
   command palette exposes it, because of course it does.
================================================================ */

import { signal, computed, untrack } from './signal.js';
import { createLogger } from './logger.js';

const log = createLogger('store');

export function createStore({ reducer, initialState, middleware = [], historyLimit = 50 }) {
  const state = signal(initialState);

  /* Undo/redo stacks hold whole state snapshots. The state tree
     here is small (a few dozen fields), so snapshotting is cheaper
     and far simpler than computing inverse patches. */
  const past = [];
  const future = [];
  const actionLog = [];

  function baseDispatch(action) {
    const previous = untrack(() => state.peek());
    let next;
    try {
      next = reducer(previous, action);
    } catch (err) {
      log.error(`reducer threw on "${action.type}"`, err);
      return action;
    }

    if (next !== previous) {
      past.push(previous);
      if (past.length > historyLimit) past.shift();
      future.length = 0;                     // a new action forks the timeline
      state.set(next);
    }

    actionLog.push({ type: action.type, t: performance.now() });
    if (actionLog.length > historyLimit * 4) actionLog.shift();
    return action;
  }

  /* Compose middleware right-to-left, Redux style. Each middleware
     is (store) => (next) => (action) => result. */
  const api = {
    getState: () => state.peek(),
    dispatch: (action) => dispatch(action),
  };
  const dispatch = middleware
    .slice()
    .reverse()
    .reduce((next, mw) => mw(api)(next), baseDispatch);

  return {
    state,
    getState: () => state.peek(),
    dispatch,

    /** A derived, memoised signal for one slice of the tree. */
    select(selector, options) {
      return computed(() => selector(state()), options);
    },

    undo() {
      if (past.length === 0) return false;
      future.push(state.peek());
      state.set(past.pop());
      return true;
    },

    redo() {
      if (future.length === 0) return false;
      past.push(state.peek());
      state.set(future.pop());
      return true;
    },

    history: () => ({ past: past.length, future: future.length, actions: actionLog.slice(-20) }),
  };
}

/* ----------------------------------------------------------------
   Stock middleware
---------------------------------------------------------------- */

/** Log every action and the resulting state at debug level. */
export const loggerMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  log.debug(`${action.type}`, action.payload !== undefined ? action.payload : '');
  return result;
};

/** Persist selected keys to localStorage after every action. */
export function persistMiddleware(storageKey, pick = (s) => s) {
  return (store) => (next) => (action) => {
    const result = next(action);
    try {
      localStorage.setItem(storageKey, JSON.stringify(pick(store.getState())));
    } catch {
      /* Private mode, quota exceeded — persistence is best effort. */
    }
    return result;
  };
}

/** Rehydrate a persisted slice, ignoring anything malformed. */
export function loadPersisted(storageKey, fallback) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}
