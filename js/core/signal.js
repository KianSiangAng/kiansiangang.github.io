/* ================================================================
   SIGNAL.JS — Fine-grained reactivity primitives

   A hand-rolled implementation of the "signals" pattern that
   powers SolidJS, Preact Signals and Vue's reactivity core.
   Roughly 120 lines, zero dependencies.

   The idea:
     - A *signal* is a box holding a value.
     - Reading a signal INSIDE a reaction records a dependency.
     - Writing a signal re-runs every reaction that read it.

   Because dependencies are tracked at read time (not declared
   up front), a reaction automatically re-subscribes to exactly
   the signals it touched on its last run. Conditional branches
   therefore never leak stale subscriptions.

   Exports:
     signal(value)      → getter fn with .set / .peek / .subscribe
     computed(fn)       → derived read-only signal
     effect(fn)         → runs fn, re-runs on dependency change
     batch(fn)          → coalesce many writes into one flush
     untrack(fn)        → read without subscribing
================================================================ */

/* The reaction currently executing. Signal reads consult this to
   know who to subscribe. null means "reading outside a reaction". */
let activeReaction = null;

/* Batching state. While batchDepth > 0 we queue reactions instead
   of running them, so ten writes cause one re-render, not ten. */
let batchDepth = 0;
const pendingReactions = new Set();

/* Guards against a reaction that writes a signal it also reads,
   which would otherwise recurse until the stack blows. */
const MAX_RECURSION = 100;
let recursionDepth = 0;

/* ----------------------------------------------------------------
   Dependency bookkeeping
---------------------------------------------------------------- */

/** Unsubscribe a reaction from every signal it currently observes. */
function releaseDependencies(reaction) {
  for (const subscribers of reaction.deps) subscribers.delete(reaction);
  reaction.deps.clear();
}

/** Execute a reaction with dependency tracking enabled. */
function runReaction(reaction) {
  if (reaction.disposed) return;
  if (recursionDepth > MAX_RECURSION) {
    console.warn('[signal] recursion limit hit — reaction suspended', reaction.name);
    return;
  }

  // Old dependencies are dropped so the new run re-declares them.
  releaseDependencies(reaction);

  const previous = activeReaction;
  activeReaction = reaction;
  recursionDepth++;
  try {
    reaction.cleanup = reaction.fn(reaction.cleanup);
  } catch (err) {
    console.error('[signal] reaction threw:', reaction.name || '(anonymous)', err);
  } finally {
    recursionDepth--;
    activeReaction = previous;
  }
}

/** Wake every reaction subscribed to a signal (or queue them). */
function notify(subscribers) {
  // Copy first: a reaction may re-subscribe while we iterate.
  for (const reaction of Array.from(subscribers)) {
    if (batchDepth > 0) pendingReactions.add(reaction);
    else runReaction(reaction);
  }
}

/* ----------------------------------------------------------------
   Public API
---------------------------------------------------------------- */

/**
 * Create a writable reactive value.
 *
 *   const count = signal(0);
 *   count();          // read (and subscribe, if inside an effect)
 *   count.set(1);     // write
 *   count.set(n => n + 1);
 *   count.peek();     // read WITHOUT subscribing
 */
export function signal(initialValue, options = {}) {
  const subscribers = new Set();
  const equals = options.equals || Object.is;
  let value = initialValue;

  const read = () => {
    if (activeReaction) {
      subscribers.add(activeReaction);
      activeReaction.deps.add(subscribers);
    }
    return value;
  };

  read.set = (next) => {
    const resolved = typeof next === 'function' ? next(value) : next;
    if (equals(resolved, value)) return value;  // no-op writes are free
    value = resolved;
    notify(subscribers);
    return value;
  };

  read.peek = () => value;
  read.subscribe = (fn) => effect(() => fn(read()));
  read.subscriberCount = () => subscribers.size;
  read.isSignal = true;

  return read;
}

/**
 * A read-only signal derived from other signals. Recomputed
 * eagerly whenever a dependency changes; readers only re-run when
 * the computed VALUE actually changes (thanks to the equals check
 * inside the backing signal).
 */
export function computed(fn, options = {}) {
  const backing = signal(undefined, options);
  effect(() => backing.set(fn()), { name: options.name || 'computed' });

  const read = () => backing();
  read.peek = backing.peek;
  read.subscribe = backing.subscribe;
  read.isSignal = true;
  return read;
}

/**
 * Run fn now and again whenever any signal it read changes.
 * fn may return a cleanup value which is passed back on the next
 * run — handy for holding timers or DOM handles between runs.
 *
 * Returns a dispose() function.
 */
export function effect(fn, options = {}) {
  const reaction = {
    fn,
    name: options.name || fn.name || 'effect',
    deps: new Set(),
    cleanup: undefined,
    disposed: false,
  };

  runReaction(reaction);

  return function dispose() {
    reaction.disposed = true;
    releaseDependencies(reaction);
  };
}

/**
 * Coalesce writes. Every reaction touched inside fn runs at most
 * once, after fn returns. Nested batches flush with the outermost.
 */
export function batch(fn) {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const queue = Array.from(pendingReactions);
      pendingReactions.clear();
      for (const reaction of queue) runReaction(reaction);
    }
  }
}

/** Read signals without creating a subscription. */
export function untrack(fn) {
  const previous = activeReaction;
  activeReaction = null;
  try {
    return fn();
  } finally {
    activeReaction = previous;
  }
}
