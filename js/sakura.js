/* ================================================================
   SAKURA.JS — Custom Sakura Petal Background

   A lightweight custom-built petal spawner that replaces tsParticles.
   Petals drift diagonally downward across the entire page at varying
   speeds and opacities, rotating gently as they fall.

   How it works:
     1. createPetal() builds a small <div> styled as a petal
     2. Each petal gets randomised CSS properties (size, speed, opacity)
     3. A CSS @keyframes animation handles the falling + rotating
     4. When the animation finishes, the petal is removed from the DOM
     5. setInterval() spawns a new petal every 700ms

   PERFORMANCE NOTES:
   - Petals are removed from the DOM after animationend (no memory leak)
   - A max cap of 25 active petals prevents too many simultaneous elements
   - pointer-events: none on the container so petals don't block clicks
   - Each petal is a tiny div — far lighter than a canvas-based library
   - --base-scale gives each petal a randomised size for depth illusion

   CYBERSECURITY LEARNING MOMENT:
   By building this ourselves instead of importing a 170KB library,
   we eliminated a supply chain dependency. Every line of code running
   on your page is code YOU wrote and can audit.
================================================================ */


/* ----------------------------------------------------------------
   GRAB THE CONTAINER
   The #sakura-container is a position: fixed div that covers
   the entire viewport. It's defined in index.html and styled
   in style.css with pointer-events: none so it doesn't block
   any clicks on page content beneath it.
---------------------------------------------------------------- */
const sakuraContainer = document.getElementById('sakura-container');

/* Maximum number of petals on screen at once.
   Reduced from 40 → 25 for a subtler, more dreamy atmosphere. */
const MAX_PETALS = 25;


/* ----------------------------------------------------------------
   HELPER: random number between min and max
   Math.random() returns 0–1 (exclusive), so:
     Math.random() * (max - min) + min
   gives a float between min (inclusive) and max (exclusive).
---------------------------------------------------------------- */
function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}


/* ----------------------------------------------------------------
   CREATE A SINGLE PETAL

   Each petal is a <div> with randomised properties:
     - left:              where it appears horizontally (0–100vw)
     - width / height:    8–16px (randomised independently)
     - opacity:           0.3–0.6 (softer, more ghost-like)
     - animation-duration: 8–14 seconds (slow, dreamy drift)
     - animation-delay:   negative value to stagger start positions
     - --base-scale:      0.6–1.2 (depth illusion — near/far petals)

   The CSS class .sakura-petal handles the shape and colour.
   The CSS @keyframes sakura-fall handles the falling + rotation.

   After the animation finishes, the animationend event fires
   and we remove the div from the DOM so it doesn't pile up.
---------------------------------------------------------------- */
function createPetal() {
  /* Performance guard — skip if we already have too many petals */
  if (sakuraContainer.children.length >= MAX_PETALS) return;

  /* Create the petal element */
  const petal = document.createElement('div');
  petal.classList.add('sakura-petal');

  /* ---- Randomise properties ---- */

  /* Horizontal start position — anywhere across the viewport */
  const left = randomBetween(0, 100);

  /* Petal size — each axis randomised independently for
     natural-looking non-square shapes */
  const width  = randomBetween(8, 16);
  const height = randomBetween(8, 16);

  /* How see-through the petal is — softer than before (0.3–0.6)
     for a more ethereal, dreamy feel */
  const opacity = randomBetween(0.3, 0.6);

  /* Fall duration — 8–14 seconds for a slow, gentle drift
     (doubled from original 4–8s for a calmer atmosphere) */
  const duration = randomBetween(8, 14);

  /* Negative delay = petal starts partway through the animation,
     so not all petals begin at the very top simultaneously */
  const delay = randomBetween(-3, 0);

  /* Random horizontal sway direction — petals drift left or right
     as they fall. We set this as a CSS custom property that the
     @keyframes animation reads via var(). */
  const sway = randomBetween(-60, 60);

  /* Depth scale — a random size multiplier that gives the illusion
     of petals at different distances. Smaller petals look farther
     away; larger ones feel closer. The CSS keyframes apply this
     via scale(var(--base-scale)). */
  const baseScale = randomBetween(0.6, 1.2);

  /* ---- Apply styles ---- */
  petal.style.left             = left + 'vw';
  petal.style.width            = width + 'px';
  petal.style.height           = height + 'px';
  petal.style.opacity          = opacity;
  petal.style.animationDuration = duration + 's';
  petal.style.animationDelay   = delay + 's';

  /* Custom properties read by @keyframes sakura-fall:
     --sway:       horizontal drift amount (px)
     --base-scale: depth-based size multiplier */
  petal.style.setProperty('--sway', sway + 'px');
  petal.style.setProperty('--base-scale', baseScale);

  /* ---- Clean up after animation ends ----
     The animationend event fires when the CSS animation completes.
     We remove the petal from the DOM to prevent memory buildup.

     { once: true } ensures this listener auto-removes after firing,
     so we don't accidentally stack listeners. */
  petal.addEventListener('animationend', () => {
    petal.remove();
  }, { once: true });

  /* ---- Add to page ---- */
  sakuraContainer.appendChild(petal);
}


/* ----------------------------------------------------------------
   START SPAWNING
   setInterval calls createPetal() every 700ms (≈ 1.4 petals/sec).
   With an 8–14 second lifetime and 25-petal cap, there will be
   roughly 8–15 petals visible at any time — a subtler, more
   dreamy effect than the original faster spawn rate.
---------------------------------------------------------------- */
setInterval(createPetal, 700);


/* ================================================================
   BIRDS — Subtle Ghibli-style birds gliding across the sky

   Small V-shaped SVG silhouettes that drift slowly across the
   upper portion of the viewport. Very sparse — only 2-4 visible
   at a time to keep the effect gentle and atmospheric.

   Each bird is an inline SVG with a gentle wing-flap animation
   and a slow horizontal glide via CSS @keyframes (birdGlide).
================================================================ */

const MAX_BIRDS = 4;
let activeBirds = 0;

function createBird() {
  if (activeBirds >= MAX_BIRDS) return;

  activeBirds++;
  const bird = document.createElement('div');
  bird.className = 'sky-bird';

  /* Bird is a tiny SVG V-shape */
  const size = randomBetween(10, 20);
  bird.innerHTML = '<svg viewBox="0 0 24 10" width="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 8 Q6 0 12 5 Q18 0 24 8"/></svg>';

  /* Vertical position — upper 50% of the viewport (sky area) */
  const top = randomBetween(5, 45);

  /* Direction — 70% fly left-to-right, 30% right-to-left */
  const goRight = Math.random() > 0.3;
  const startX  = goRight ? -5 : 105;
  const endX    = goRight ? 105 : -5;

  /* Speed — slow and gentle, 18-30 seconds to cross the screen */
  const duration = randomBetween(18, 30);

  /* Slight vertical drift during flight */
  const drift = randomBetween(-3, 3);

  /* Opacity — faint, like distant birds */
  const opacity = randomBetween(0.12, 0.28);

  bird.style.cssText =
    'position:fixed;' +
    'top:' + top + '%;' +
    'left:0;' +
    'opacity:' + opacity + ';' +
    'color:#604050;' +
    'pointer-events:none;' +
    'z-index:1;' +
    'animation:birdGlide ' + duration + 's linear forwards;' +
    '--bird-start:' + startX + 'vw;' +
    '--bird-end:' + endX + 'vw;' +
    '--bird-drift:' + drift + 'vh;';

  /* Wing flap — gentle scale-y oscillation on the SVG */
  var svg = bird.querySelector('svg');
  svg.style.animation = 'birdFlap ' + randomBetween(0.8, 1.4) + 's ease-in-out infinite alternate';

  bird.addEventListener('animationend', function(e) {
    if (e.target === bird) {
      bird.remove();
      activeBirds--;
    }
  });

  sakuraContainer.appendChild(bird);
}

/* Spawn a bird every 6-10 seconds — very sparse */
function scheduleBird() {
  createBird();
  setTimeout(scheduleBird, randomBetween(6000, 10000));
}

/* Start bird spawning after a short delay */
setTimeout(scheduleBird, 2000);
