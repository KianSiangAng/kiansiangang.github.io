/* ================================================================
   KONAMI.JS — Hidden input sequences

   A generic sequence matcher: register any list of keys with a
   handler and it fires when a visitor types them. Used for the
   Konami code and for a couple of typed magic words.

   The matcher keeps one rolling buffer for all sequences rather
   than an index per sequence, and ignores input while focus is in
   a text field — otherwise typing "matrix" in the terminal would
   trigger the easter egg as well as the command.
================================================================ */

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

export function createSequences({ bus }) {
  const sequences = [];
  let buffer = [];
  const maxLength = 16;

  function register(keys, handler, name) {
    sequences.push({ keys: keys.map((k) => k.toLowerCase()), handler, name });
  }

  function onKeyDown(event) {
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (typing) return;

    buffer.push(event.key.toLowerCase());
    if (buffer.length > maxLength) buffer.shift();

    for (const sequence of sequences) {
      const tail = buffer.slice(-sequence.keys.length);
      if (tail.length === sequence.keys.length && tail.every((k, i) => k === sequence.keys[i])) {
        buffer = [];
        sequence.handler();
        bus.emit('sequence.matched', { name: sequence.name });
        return;
      }
    }
  }

  window.addEventListener('keydown', onKeyDown);

  /* ---- the stock sequences ---- */
  register(KONAMI, () => {
    bus.emit('achievement.unlock', { id: 'konami' });
    bus.emit('petals.storm', { intensity: 2.2 });
  }, 'konami');

  register([...'sakura'], () => bus.emit('petals.storm', { intensity: 1.4 }), 'sakura');
  register([...'night'], () => bus.emit('theme.set', { theme: 'toggle' }), 'night');

  return {
    register,
    stop: () => window.removeEventListener('keydown', onKeyDown),
    sequences: () => sequences.map((s) => s.name),
  };
}
