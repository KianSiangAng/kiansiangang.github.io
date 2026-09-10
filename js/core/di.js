/* ================================================================
   DI.JS — Service container with dependency resolution

   Services declare what they need by name; the container works
   out the instantiation order, detects cycles, and caches
   singletons.

     container.register('audio', { deps: ['bus'], factory: makeAudio });
     const audio = container.resolve('audio');   // 'bus' built first

   Why a portfolio needs an IoC container: it does not. It is
   here because the brief was "most over-engineered", and because
   it genuinely does keep the module wiring in js/app.js flat and
   declarative rather than a pyramid of constructor calls.
================================================================ */

import { createLogger } from './logger.js';

const log = createLogger('di');

export function createContainer() {
  const registry = new Map();      // name → { deps, factory, singleton }
  const instances = new Map();     // name → resolved value
  const resolving = new Set();     // names currently mid-construction

  function register(name, definition) {
    if (registry.has(name)) log.warn(`overwriting registration for "${name}"`);
    const normalised = typeof definition === 'function'
      ? { deps: [], factory: definition, singleton: true }
      : { deps: [], singleton: true, ...definition };
    registry.set(name, normalised);
    return api;
  }

  /** Register an already-built value (config objects, the DOM, …). */
  function value(name, instance) {
    registry.set(name, { deps: [], factory: () => instance, singleton: true });
    instances.set(name, instance);
    return api;
  }

  function resolve(name) {
    if (instances.has(name)) return instances.get(name);

    const definition = registry.get(name);
    if (!definition) throw new Error(`[di] no service registered as "${name}"`);

    if (resolving.has(name)) {
      throw new Error(`[di] circular dependency: ${[...resolving, name].join(' → ')}`);
    }
    resolving.add(name);

    let instance;
    try {
      const args = definition.deps.map(resolve);
      instance = definition.factory(...args);
    } finally {
      resolving.delete(name);
    }

    if (definition.singleton) instances.set(name, instance);
    return instance;
  }

  /** Full dependency graph, for the `deps` terminal command. */
  function graph() {
    const out = {};
    for (const [name, def] of registry) out[name] = def.deps.slice();
    return out;
  }

  const api = { register, value, resolve, graph, has: (n) => registry.has(n) };
  return api;
}
