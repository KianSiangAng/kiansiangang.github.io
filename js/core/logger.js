/* ================================================================
   LOGGER.JS — Structured, namespaced logging with a ring buffer

   Every subsystem gets its own logger:

     const log = createLogger('gfx');
     log.info('renderer online', { backend: 'webgl2' });

   Features that a portfolio site absolutely does not need, and
   which this portfolio site therefore has:
     - Level filtering (trace < debug < info < warn < error < silent)
     - A bounded in-memory ring buffer, readable from the terminal
       via `dmesg`, so the site can show its own boot log
     - performance.mark()/measure() integration via log.time()
     - Per-namespace colour coding in the devtools console
================================================================ */

export const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, silent: 60 };

/* Ring buffer — fixed size, oldest entries overwritten. Keeps the
   log bounded no matter how long the page stays open. */
const RING_CAPACITY = 512;
const ring = new Array(RING_CAPACITY);
let ringWrite = 0;
let ringCount = 0;

/* Deterministic per-namespace hue so `gfx` is always the same colour. */
function hueFor(namespace) {
  let hash = 0;
  for (let i = 0; i < namespace.length; i++) {
    hash = (hash << 5) - hash + namespace.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

let globalLevel = LEVELS.info;

/** Raise or lower the threshold for every logger at once. */
export function setLogLevel(name) {
  if (name in LEVELS) globalLevel = LEVELS[name];
  return Object.keys(LEVELS).find((k) => LEVELS[k] === globalLevel);
}

export function getLogLevel() {
  return Object.keys(LEVELS).find((k) => LEVELS[k] === globalLevel);
}

/** Snapshot the ring buffer in chronological order. */
export function drainLog() {
  const out = [];
  const start = ringCount < RING_CAPACITY ? 0 : ringWrite;
  for (let i = 0; i < Math.min(ringCount, RING_CAPACITY); i++) {
    out.push(ring[(start + i) % RING_CAPACITY]);
  }
  return out;
}

function record(entry) {
  ring[ringWrite] = entry;
  ringWrite = (ringWrite + 1) % RING_CAPACITY;
  ringCount++;
}

export function createLogger(namespace) {
  const hue = hueFor(namespace);
  const badge = `background:hsl(${hue} 70% 45%);color:#fff;padding:1px 5px;border-radius:4px;font-weight:700`;

  function emit(level, args) {
    const entry = {
      t: performance.now(),
      level,
      ns: namespace,
      msg: args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' '),
    };
    record(entry);

    if (LEVELS[level] < globalLevel) return;
    const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[method](`%c${namespace}`, badge, ...args);
  }

  return {
    namespace,
    trace: (...a) => emit('trace', a),
    debug: (...a) => emit('debug', a),
    info:  (...a) => emit('info',  a),
    warn:  (...a) => emit('warn',  a),
    error: (...a) => emit('error', a),

    /** log.time('boot') → returns end() which logs the duration. */
    time(label) {
      const mark = `${namespace}:${label}`;
      const startedAt = performance.now();
      try { performance.mark(`${mark}:start`); } catch { /* mark budget exhausted */ }
      return function end(extra) {
        const ms = performance.now() - startedAt;
        try {
          performance.mark(`${mark}:end`);
          performance.measure(mark, `${mark}:start`, `${mark}:end`);
        } catch { /* measure unsupported */ }
        emit('debug', [`${label} took ${ms.toFixed(1)}ms`, extra].filter(Boolean));
        return ms;
      };
    },
  };
}

/** JSON.stringify that survives circular references and DOM nodes. */
function safeStringify(value) {
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (_key, val) => {
      if (val instanceof Node) return `<${val.nodeName.toLowerCase()}>`;
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[circular]';
        seen.add(val);
      }
      if (typeof val === 'function') return `[fn ${val.name || 'anonymous'}]`;
      return val;
    });
  } catch {
    return String(value);
  }
}
