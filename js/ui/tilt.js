/* ================================================================
   TILT.JS — 3D card tilt with a moving specular highlight

   Cards rotate toward the pointer in perspective, and a radial
   "glare" follows the cursor across the surface via CSS custom
   properties. On phones the device's own gyroscope drives the
   tilt instead, where the browser grants access.

   All writes are batched into one rAF per pointer move, so moving
   the mouse across a grid of cards costs one style recalculation
   per frame rather than one per event.
================================================================ */

export function createTilt({ selector = '.project-card, .stat-card', maxTilt = 8, reducedMotion }) {
  if (reducedMotion) return { stop() {}, enabled: false };

  const cards = [...document.querySelectorAll(selector)];
  if (cards.length === 0) return { stop() {}, enabled: false };

  let pending = null;

  function apply(card, rotateX, rotateY, glareX, glareY) {
    card.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
    card.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
    card.style.setProperty('--glare-x', `${glareX.toFixed(1)}%`);
    card.style.setProperty('--glare-y', `${glareY.toFixed(1)}%`);
  }

  function onMove(event) {
    const card = event.currentTarget;
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;    // 0…1
      const py = (event.clientY - rect.top) / rect.height;
      apply(card, (0.5 - py) * maxTilt * 2, (px - 0.5) * maxTilt * 2, px * 100, py * 100);
    });
  }

  function onLeave(event) {
    const card = event.currentTarget;
    card.classList.remove('is-tilting');
    apply(card, 0, 0, 50, 50);
  }

  function onEnter(event) {
    event.currentTarget.classList.add('is-tilting');
  }

  for (const card of cards) {
    card.addEventListener('pointermove', onMove, { passive: true });
    card.addEventListener('pointerenter', onEnter, { passive: true });
    card.addEventListener('pointerleave', onLeave, { passive: true });
  }

  /* -- gyroscope on mobile ------------------------------------- */
  let gyroHandler = null;
  if (window.DeviceOrientationEvent && window.matchMedia('(pointer: coarse)').matches) {
    gyroHandler = (event) => {
      if (event.beta == null || event.gamma == null) return;
      const rotateX = Math.max(-maxTilt, Math.min(maxTilt, (event.beta - 45) * 0.25));
      const rotateY = Math.max(-maxTilt, Math.min(maxTilt, event.gamma * 0.25));
      for (const card of cards) apply(card, rotateX, rotateY, 50 + rotateY * 3, 50 + rotateX * 3);
    };
    // iOS requires a permission prompt, which requires a gesture;
    // we simply listen and do nothing if events never arrive.
    window.addEventListener('deviceorientation', gyroHandler, { passive: true });
  }

  return {
    enabled: true,
    count: cards.length,
    stop() {
      for (const card of cards) {
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerenter', onEnter);
        card.removeEventListener('pointerleave', onLeave);
      }
      if (gyroHandler) window.removeEventListener('deviceorientation', gyroHandler);
    },
  };
}
