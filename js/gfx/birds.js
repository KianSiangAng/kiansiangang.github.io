/* ================================================================
   BIRDS.JS — A boids flock

   The original site drifted a few birds across the sky with CSS
   keyframes. They now fly as an actual flock, using Reynolds' three
   rules from the 1987 paper:

     separation  steer away from crowding neighbours
     alignment   steer toward the average heading of neighbours
     cohesion    steer toward the average position of neighbours

   plus two of our own: a gentle bias back toward the upper third of
   the sky, and a wander force so the flock never settles into a
   boring straight line. Wings flap faster when a bird is climbing,
   which is the sort of detail nobody asked for.

   Neighbour search is O(n²), which is fine and fast for a flock of
   fourteen; a spatial hash here would be over-engineering without
   the excuse of being fun.
================================================================ */

const PERCEPTION = 90;
const SEPARATION_RANGE = 34;
const MAX_SPEED = 46;
const MAX_FORCE = 34;

export function createFlock(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  const birds = [];
  let width = 0;
  let height = 0;
  let worldMix = 0;

  const count = options.count ?? 14;

  function spawn() {
    const angle = (Math.random() - 0.5) * 0.6;
    const speed = MAX_SPEED * (0.6 + Math.random() * 0.4);
    return {
      x: Math.random() * width,
      y: Math.random() * height * 0.45,
      vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
      vy: Math.sin(angle) * speed,
      size: 10 + Math.random() * 8,
      flap: Math.random() * Math.PI * 2,
      wander: Math.random() * Math.PI * 2,
    };
  }

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    birds.length = 0;
    // Fewer birds on a phone: the sky is smaller and so is the budget.
    const target = width < 640 ? Math.round(count * 0.5) : count;
    for (let i = 0; i < target; i++) birds.push(spawn());
  }

  function limit(vx, vy, max) {
    const magnitude = Math.hypot(vx, vy);
    if (magnitude > max && magnitude > 0) return [(vx / magnitude) * max, (vy / magnitude) * max];
    return [vx, vy];
  }

  function update(dt) {
    const step = Math.min(dt, 0.05);

    for (const bird of birds) {
      let sepX = 0, sepY = 0;
      let aliX = 0, aliY = 0;
      let cohX = 0, cohY = 0;
      let neighbours = 0;

      for (const other of birds) {
        if (other === bird) continue;
        const dx = other.x - bird.x;
        const dy = other.y - bird.y;
        const distance = Math.hypot(dx, dy);
        if (distance > PERCEPTION || distance === 0) continue;

        neighbours++;
        aliX += other.vx;
        aliY += other.vy;
        cohX += other.x;
        cohY += other.y;

        if (distance < SEPARATION_RANGE) {
          // Weight by inverse distance: the closer, the harder the shove.
          sepX -= (dx / distance) * (SEPARATION_RANGE - distance);
          sepY -= (dy / distance) * (SEPARATION_RANGE - distance);
        }
      }

      let ax = 0;
      let ay = 0;

      if (neighbours > 0) {
        const [alignX, alignY] = limit(aliX / neighbours - bird.vx, aliY / neighbours - bird.vy, MAX_FORCE);
        const [cohereX, cohereY] = limit(cohX / neighbours - bird.x, cohY / neighbours - bird.y, MAX_FORCE);
        ax += alignX * 0.6 + cohereX * 0.35 + sepX * 1.6;
        ay += alignY * 0.6 + cohereY * 0.35 + sepY * 1.6;
      }

      // Stay in the sky, not in the text.
      const preferredY = height * 0.22;
      ay += (preferredY - bird.y) * 0.25;

      // Wander, so the flock keeps changing its mind.
      bird.wander += (Math.random() - 0.5) * step * 8;
      ax += Math.cos(bird.wander) * 10;
      ay += Math.sin(bird.wander) * 6;

      bird.vx += ax * step;
      bird.vy += ay * step;
      [bird.vx, bird.vy] = limit(bird.vx, bird.vy, MAX_SPEED);

      bird.x += bird.vx * step;
      bird.y += bird.vy * step;

      // Wrap horizontally, bounce softly off the top and bottom.
      if (bird.x < -60) bird.x = width + 50;
      if (bird.x > width + 60) bird.x = -50;
      if (bird.y < 10) bird.vy += 40 * step;
      if (bird.y > height * 0.6) bird.vy -= 40 * step;

      // Climbing birds flap harder.
      bird.flap += step * (6 + Math.max(0, -bird.vy) * 0.2);
    }
  }

  function draw() {
    // Birds belong to the Ghibli world; they fade as it does.
    const opacity = (1 - worldMix) * 0.55;
    if (opacity <= 0.01) return;

    ctx.save();
    ctx.strokeStyle = `rgba(64, 54, 64, ${opacity})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (const bird of birds) {
      /* Floor the wing amplitude at 0.25: a bird whose wings are
         momentarily flat reads as a dash, not a bird. */
      const wing = 0.25 + ((Math.sin(bird.flap) + 1) / 2) * 0.75;
      const s = bird.size;
      const facing = bird.vx >= 0 ? 1 : -1;

      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.scale(facing, 1);
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.quadraticCurveTo(-s * 0.5, -s * wing, 0, 0);
      ctx.quadraticCurveTo(s * 0.5, -s * wing, s, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  return {
    resize,
    update,
    draw,
    setWorldMix(value) { worldMix = value; },
    get count() { return birds.length; },
  };
}
