/* ================================================================
   CURSOR.JS — Custom cursor with trailing ring and magnetism

   Two elements: a dot that tracks the pointer exactly, and a ring
   that lags behind with spring damping. Interactive elements pull
   the ring toward their centre ("magnetism") and expand it.

   Only enabled for fine pointers (mouse/trackpad) on devices that
   have not asked for reduced motion — never on touch, where a
   custom cursor is nonsense, and never at the cost of the real
   cursor being available.
================================================================ */

export function createCursor({ reducedMotion }) {
  const fine = window.matchMedia('(pointer: fine)').matches;
  if (!fine || reducedMotion) return { enabled: false, stop() {} };

  const dot = document.createElement('div');
  dot.className = 'cursor cursor--dot';
  const ring = document.createElement('div');
  ring.className = 'cursor cursor--ring';
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(ring, dot);
  document.documentElement.classList.add('has-custom-cursor');

  const MAGNETIC = 'a, button, .project-card, .stat-card, label[for], input, .tag';

  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let ringX = pointerX;
  let ringY = pointerY;
  let scale = 1;
  let targetScale = 1;
  let running = true;

  function onMove(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;

    const target = event.target instanceof Element ? event.target.closest(MAGNETIC) : null;
    if (target) {
      const rect = target.getBoundingClientRect();
      // Pull the ring 30% of the way to the element's centre.
      pointerX += (rect.left + rect.width / 2 - event.clientX) * 0.3;
      pointerY += (rect.top + rect.height / 2 - event.clientY) * 0.3;
      targetScale = 2.1;
    } else {
      targetScale = 1;
    }

    dot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  }

  function frame() {
    if (!running) return;
    // Critically damped-ish follow.
    ringX += (pointerX - ringX) * 0.18;
    ringY += (pointerY - ringY) * 0.18;
    scale += (targetScale - scale) * 0.18;
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) scale(${scale.toFixed(3)})`;
    requestAnimationFrame(frame);
  }

  const onDown = () => ring.classList.add('is-pressed');
  const onUp = () => ring.classList.remove('is-pressed');
  const onLeave = () => { dot.style.opacity = '0'; ring.style.opacity = '0'; };
  const onEnter = () => { dot.style.opacity = ''; ring.style.opacity = ''; };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  document.addEventListener('pointerenter', onEnter);
  requestAnimationFrame(frame);

  return {
    enabled: true,
    stop() {
      running = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      dot.remove();
      ring.remove();
      document.documentElement.classList.remove('has-custom-cursor');
    },
  };
}
