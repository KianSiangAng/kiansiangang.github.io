/* ================================================================
   BUS.JS — Pub/sub event bus with wildcard topics

   Modules never import each other directly; they talk over the
   bus. That keeps the dependency graph shallow and means any
   module can be removed without breaking its listeners.

   Topics are dot-delimited:  'theme.changed', 'gfx.frame'
   Subscriptions may wildcard a segment or a whole tail:
     bus.on('theme.*',  fn)   → theme.changed, theme.locked
     bus.on('gfx.**',   fn)   → gfx.frame, gfx.shader.compiled
     bus.on('*',        fn)   → every single-segment topic
================================================================ */

import { createLogger } from './logger.js';

const log = createLogger('bus');

export function createEventBus(options = {}) {
  /** Map<pattern, Set<handler>> */
  const listeners = new Map();
  const historyLimit = options.historyLimit ?? 64;
  const history = [];

  /** Turn 'gfx.**' into a RegExp that matches emitted topics. */
  function patternToRegExp(pattern) {
    const escaped = pattern
      .split('.')
      .map((segment) => {
        if (segment === '**') return '[\\s\\S]+';       // greedy tail
        if (segment === '*') return '[^.]+';            // one segment
        return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('\\.');
    return new RegExp(`^${escaped}$`);
  }

  const compiled = new Map();
  function matcherFor(pattern) {
    if (!compiled.has(pattern)) compiled.set(pattern, patternToRegExp(pattern));
    return compiled.get(pattern);
  }

  function on(pattern, handler) {
    if (!listeners.has(pattern)) listeners.set(pattern, new Set());
    listeners.get(pattern).add(handler);
    return function off() {
      const set = listeners.get(pattern);
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) listeners.delete(pattern);
    };
  }

  function once(pattern, handler) {
    const off = on(pattern, (...args) => { off(); handler(...args); });
    return off;
  }

  function emit(topic, payload) {
    if (historyLimit > 0) {
      history.push({ topic, payload, t: performance.now() });
      if (history.length > historyLimit) history.shift();
    }

    let delivered = 0;
    for (const [pattern, handlers] of listeners) {
      // Fast path: exact string match, no regex needed.
      const hit = pattern === topic || (pattern.includes('*') && matcherFor(pattern).test(topic));
      if (!hit) continue;
      for (const handler of Array.from(handlers)) {
        try {
          handler(payload, topic);
          delivered++;
        } catch (err) {
          log.error(`handler for "${pattern}" threw on "${topic}"`, err);
        }
      }
    }
    return delivered;
  }

  /** Resolve the next time `pattern` fires (with an optional timeout). */
  function waitFor(pattern, timeoutMs = 0) {
    return new Promise((resolve, reject) => {
      const off = once(pattern, resolve);
      if (timeoutMs > 0) {
        setTimeout(() => { off(); reject(new Error(`bus.waitFor("${pattern}") timed out`)); }, timeoutMs);
      }
    });
  }

  return {
    on,
    once,
    emit,
    waitFor,
    history: () => history.slice(),
    topics: () => Array.from(listeners.keys()),
    clear: () => listeners.clear(),
  };
}
