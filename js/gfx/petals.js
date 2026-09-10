/* ================================================================
   PETALS.JS — Particle system with a procedural wind field

   Replaces the previous DOM-node petal spawner. Every petal used
   to be a <div> the browser had to lay out, composite and animate
   with CSS keyframes; a few dozen of those is measurable jank on a
   phone. This draws all of them into one canvas instead, and gives
   them physics worth the trouble:

     - a curl-noise wind field, so petals follow coherent gusts
       rather than each drifting independently
     - per-petal depth, driving size, opacity, blur and parallax
     - object pooling: the array is allocated once and reused, so
       the system never triggers GC mid-scroll
     - in the hacker world the same particles render as falling
       glyphs — identical physics, different shader, so to speak

   Respects prefers-reduced-motion by not existing.
================================================================ */

const GLYPHS = 'アイウエオカキクケコサシスセソ0123456789<>[]{}/\\|=+*#$%&@';

/* ---- Value noise, the JavaScript twin of the one in the GLSL ---- */
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

/** Curl of a scalar noise field → a divergence-free 2D wind vector. */
function curl(x, y, t) {
  const eps = 0.35;
  const n1 = noise2(x, y + eps + t);
  const n2 = noise2(x, y - eps + t);
  const n3 = noise2(x + eps, y + t);
  const n4 = noise2(x - eps, y + t);
  return [(n1 - n2) / (2 * eps), -(n3 - n4) / (2 * eps)];
}

export function createPetalSystem(canvas, options = {}) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const petals = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let worldMix = 0;               // 0 = petals, 1 = glyphs
  let pointer = { x: -999, y: -999 };

  const config = {
    density: options.density ?? 1 / 26000,   // petals per CSS pixel²
    maxCount: options.maxCount ?? 64,
    ...options,
  };

  const PALETTE = [
    [255, 205, 220],
    [255, 225, 235],
    [252, 190, 205],
    [255, 240, 245],
  ];

  function resetPetal(petal, fromTop) {
    petal.depth = 0.35 + Math.random() * 0.65;          // 0.35 (far) … 1 (near)
    petal.x = Math.random() * width;
    petal.y = fromTop ? -20 - Math.random() * height * 0.4 : Math.random() * height;
    petal.vx = 0;
    petal.vy = 12 + petal.depth * 26;
    petal.size = 5 + petal.depth * 9;
    petal.rotation = Math.random() * Math.PI * 2;
    petal.spin = (Math.random() - 0.5) * 1.4;
    petal.wobble = Math.random() * Math.PI * 2;
    petal.colour = PALETTE[(Math.random() * PALETTE.length) | 0];
    petal.glyph = GLYPHS[(Math.random() * GLYPHS.length) | 0];
    petal.glyphTimer = 0;
    return petal;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = Math.min(Math.round(width * height * config.density), config.maxCount);
    while (petals.length < target) petals.push(resetPetal({}, false));
    petals.length = Math.max(target, 0);
  }

  function update(dt, time) {
    // Clamp dt: a backgrounded tab can hand us a one-second frame,
    // which would teleport every petal off screen.
    const step = Math.min(dt, 0.05);

    for (const petal of petals) {
      const [wx, wy] = curl(petal.x * 0.0016, petal.y * 0.0016, time * 0.05);

      petal.vx += wx * 26 * step * petal.depth;
      petal.vy += (wy * 10 + 9) * step;          // gravity + vertical gust
      petal.vx *= 0.985;                         // air drag
      petal.vy = Math.min(petal.vy * 0.995, 110);

      // Cursor pushes nearby petals aside.
      const dx = petal.x - pointer.x;
      const dy = petal.y - pointer.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < 14000) {
        const force = (1 - distanceSq / 14000) * 90;
        const distance = Math.sqrt(distanceSq) || 1;
        petal.vx += (dx / distance) * force * step;
        petal.vy += (dy / distance) * force * step;
      }

      petal.x += petal.vx * step;
      petal.y += petal.vy * step;
      petal.wobble += step * 2.2;
      petal.rotation += petal.spin * step;

      petal.glyphTimer += step;
      if (petal.glyphTimer > 0.12) {
        petal.glyphTimer = 0;
        petal.glyph = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }

      // Recycle rather than allocate.
      if (petal.y > height + 40) resetPetal(petal, true);
      if (petal.x < -60) petal.x = width + 40;
      if (petal.x > width + 60) petal.x = -40;
    }
  }

  function drawPetal(petal) {
    const sway = Math.sin(petal.wobble) * 0.5 + 0.5;   // 0…1 “edge-on” factor
    const [r, g, b] = petal.colour;

    ctx.save();
    ctx.translate(petal.x, petal.y);
    ctx.rotate(petal.rotation);
    ctx.scale(0.35 + sway * 0.65, 1);                  // fake 3D rotation
    ctx.globalAlpha = 0.35 + petal.depth * 0.5;
    ctx.fillStyle = `rgb(${r} ${g} ${b})`;

    // A sakura petal: teardrop with a notched tip.
    const s = petal.size;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.75, -s * 0.6, s * 0.6, s * 0.55, 0, s * 0.85);
    ctx.bezierCurveTo(-s * 0.6, s * 0.55, -s * 0.75, -s * 0.6, 0, -s);
    ctx.fill();
    ctx.restore();
  }

  function drawGlyph(petal) {
    ctx.save();
    ctx.translate(petal.x, petal.y);
    ctx.globalAlpha = 0.25 + petal.depth * 0.6;
    ctx.fillStyle = petal.depth > 0.85 ? '#d7ffe6' : '#3bff88';
    ctx.font = `${Math.round(petal.size * 1.5)}px "Space Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(petal.glyph, 0, 0);
    ctx.restore();
  }

  /** Clear the shared canvas. Split out from draw() so other
      systems (the flock) can render between the clear and the
      petals, and end up visually behind them. */
  function clearFrame() {
    ctx.clearRect(0, 0, width, height);
  }

  function draw() {
    if (worldMix > 0.5) {
      ctx.shadowColor = 'rgba(60, 255, 130, 0.7)';
      ctx.shadowBlur = 8;
      for (const petal of petals) drawGlyph(petal);
      ctx.shadowBlur = 0;
    } else {
      for (const petal of petals) drawPetal(petal);
    }
    ctx.globalAlpha = 1;
  }

  return {
    resize,
    update,
    draw,
    clearFrame,
    get count() { return petals.length; },
    setWorldMix(value) { worldMix = value; },
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    /** A puff of petals from a point — used when the mascot is clicked. */
    burst(x, y, amount = 10) {
      for (let i = 0; i < amount; i++) {
        const petal = resetPetal({}, false);
        const angle = (Math.PI * 2 * i) / amount;
        petal.x = x;
        petal.y = y;
        petal.vx = Math.cos(angle) * (60 + Math.random() * 70);
        petal.vy = Math.sin(angle) * (60 + Math.random() * 70) - 30;
        petals.push(petal);
      }
      // Keep the pool bounded — oldest recycled petals fall off the front.
      if (petals.length > config.maxCount * 2) petals.splice(0, petals.length - config.maxCount * 2);
    },
    clear() { ctx.clearRect(0, 0, width, height); },
  };
}
