/* ================================================================
   KERNEL.JS — Module lifecycle and boot orchestration

   The site is a collection of modules. Each one declares its
   name, its dependencies, and a setup function:

     kernel.use({
       name: 'gfx',
       deps: ['bus', 'store'],
       setup(ctx) { …; return { start(), stop() }; },
     });

   boot() then:
     1. topologically sorts modules (Kahn's algorithm)
     2. detects dependency cycles and missing deps up front
     3. runs setup in order, timing each one
     4. isolates failures — one broken module does not take the
        page down, it is marked degraded and boot continues
     5. runs every start() hook, then emits 'kernel.ready'

   Failure isolation matters here: the fancy stuff (WebGL, Web
   Audio, service workers) is exactly the stuff most likely to be
   unavailable in a locked-down browser, and none of it should be
   able to break scrolling and reading the page.
================================================================ */

import { createLogger } from './logger.js';

const log = createLogger('kernel');

export function createKernel(container, bus) {
  const modules = new Map();
  const started = [];
  const status = new Map();      // name → 'pending' | 'ready' | 'failed' | 'skipped'

  function use(definition) {
    if (!definition?.name) throw new Error('[kernel] module needs a name');
    modules.set(definition.name, { deps: [], optional: false, ...definition });
    status.set(definition.name, 'pending');
    return api;
  }

  /** Kahn topological sort — returns boot order, throws on cycles. */
  function order() {
    const indegree = new Map();
    const dependents = new Map();

    for (const [name, mod] of modules) {
      indegree.set(name, 0);
      if (!dependents.has(name)) dependents.set(name, []);
    }

    for (const [name, mod] of modules) {
      for (const dep of mod.deps) {
        if (!modules.has(dep)) {
          // Container-provided services (bus, store) are not modules.
          if (container.has(dep)) continue;
          throw new Error(`[kernel] "${name}" depends on unknown "${dep}"`);
        }
        indegree.set(name, indegree.get(name) + 1);
        dependents.get(dep).push(name);
      }
    }

    const queue = [...indegree.entries()].filter(([, n]) => n === 0).map(([n]) => n).sort();
    const sorted = [];

    while (queue.length) {
      const name = queue.shift();
      sorted.push(name);
      for (const dependent of dependents.get(name) || []) {
        indegree.set(dependent, indegree.get(dependent) - 1);
        if (indegree.get(dependent) === 0) queue.push(dependent);
      }
    }

    if (sorted.length !== modules.size) {
      const stuck = [...modules.keys()].filter((n) => !sorted.includes(n));
      throw new Error(`[kernel] dependency cycle among: ${stuck.join(', ')}`);
    }
    return sorted;
  }

  async function boot() {
    const endBoot = log.time('boot');
    const sequence = order();
    log.info(`booting ${sequence.length} modules:`, sequence.join(' → '));

    for (const name of sequence) {
      const mod = modules.get(name);

      // A module can opt out at runtime (no WebGL, reduced motion…).
      if (mod.enabled && !mod.enabled()) {
        status.set(name, 'skipped');
        log.debug(`${name} skipped (disabled)`);
        continue;
      }

      const endModule = log.time(`setup:${name}`);
      try {
        const ctx = { container, bus, kernel: api, log: log };
        const instance = await mod.setup(ctx);
        if (instance) container.value(name, instance);
        if (instance?.start) started.push({ name, instance });
        status.set(name, 'ready');
      } catch (err) {
        status.set(name, 'failed');
        log.error(`${name} failed to set up — continuing without it`, err);
        bus.emit('kernel.module.failed', { name, error: String(err) });
      }
      endModule();
    }

    // Start hooks run after every setup, so modules may reference
    // one another's instances without ordering surprises.
    for (const { name, instance } of started) {
      try {
        await instance.start();
      } catch (err) {
        status.set(name, 'failed');
        log.error(`${name}.start() failed`, err);
      }
    }

    const ms = endBoot();
    bus.emit('kernel.ready', { modules: report(), ms });
    return report();
  }

  function report() {
    return Object.fromEntries(status);
  }

  function dispose() {
    for (const { name, instance } of started.reverse()) {
      try { instance.stop?.(); } catch (err) { log.warn(`${name}.stop() failed`, err); }
    }
    started.length = 0;
  }

  const api = { use, boot, order, report, dispose, modules: () => [...modules.keys()] };
  return api;
}
