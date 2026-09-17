/* ================================================================
   SCENE.JS — The background renderer and the frame loop

   Owns two stacked fixed-position canvases behind the page:

     gl-layer  WebGL2 full-screen shader (the procedural sky)
     fx-layer  canvas2d particles (sakura petals) and the bird flock

   and the single requestAnimationFrame loop that drives both.
   One loop for the whole site: every animated subsystem hangs off
   this tick rather than starting its own, which is why the frame
   budget stays predictable.

   Degradation ladder, in order:
     1. prefers-reduced-motion → nothing animates; one static frame
     2. no WebGL2 → the CSS gradient shows through, particles stay
     3. tab hidden → loop parked, zero CPU
     4. context lost → programs rebuilt on restore
================================================================ */

import { createRenderer } from './gl.js';
import { vertexShader, ghibliFragment } from './shaders.js';
import { createPetalSystem } from './petals.js';
import { createFlock } from './birds.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('gfx');

export function createScene({ bus, reducedMotion = false }) {
  /* -- canvases ------------------------------------------------ */
  const glCanvas = document.createElement('canvas');
  glCanvas.className = 'gfx-layer gfx-layer--gl';
  glCanvas.setAttribute('aria-hidden', 'true');

  const fxCanvas = document.createElement('canvas');
  fxCanvas.className = 'gfx-layer gfx-layer--fx';
  fxCanvas.setAttribute('aria-hidden', 'true');

  document.body.prepend(glCanvas, fxCanvas);

  const petals = createPetalSystem(fxCanvas);
  const flock = createFlock(fxCanvas);

  /* -- WebGL, if we can have it -------------------------------- */
  let renderer = null;
  let skyProgram = null;
  let backend = 'css-gradient';

  function buildGL() {
    /* No capability probe first: probing means creating a context
       purely to throw it away, and browsers cap how many live WebGL
       contexts a page may hold. Just try to build the real one and
       treat a throw as "no WebGL here". */
    try {
      renderer = createRenderer(glCanvas);
      skyProgram = renderer.createProgram(vertexShader, ghibliFragment, 'sky');
      renderer.enableBlending();
      renderer.onContextLost(() => { running = false; });
      renderer.onContextRestored(() => { if (buildGL()) start(); });
      backend = 'webgl2';
      document.documentElement.classList.add('has-webgl');
      return true;
    } catch (err) {
      log.error('WebGL setup failed — falling back to the CSS gradient', err);
      renderer = null;
      return false;
    }
  }

  /* -- state --------------------------------------------------- */
  let running = false;
  let frameHandle = 0;
  let lastFrame = 0;
  let elapsed = 0;

  let darkTarget = 0;
  let darkMix = 0;          // eased toward the target, so dusk is gradual

  const pointer = { x: 0.5, y: 0.5, px: 0, py: 0 };

  /* Frame statistics, sampled rather than emitted every frame. */
  const stats = { fps: 0, frameMs: 0, frames: 0, backend, petals: 0, quality: '100%' };
  let statWindowStart = 0;
  let statFrames = 0;
  let statTimeSum = 0;

  function syncColourScheme() {
    darkTarget = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
  }

  /* ----------------------------------------------------------------
     Adaptive quality

     The sky is a full-screen fragment shader running several octaves
     of noise per pixel, every frame, forever. On a discrete GPU that
     is free. On integrated graphics driving a high-DPI panel — or on
     a software rasteriser — it is not, and because the browser cannot
     produce a frame until the shader finishes, a 60ms sky means the
     whole page, scrolling included, updates at 15fps. The background
     was making the foreground feel broken.

     So the renderer measures itself and gives away the quality nobody
     can see, in the order it is least missed:

       1. Resolution first. Cost is linear in pixels and the output is
          soft cloud, so rendering at 0.75x or 0.5x and letting the
          browser upscale is very nearly free to look at.
       2. Then frame rate. These clouds take tens of seconds to drift
          anywhere; at 30fps nobody can tell, and it halves the work
          again. The particles keep their own cadence on their own 2D
          canvas, so motion that IS noticeable stays smooth.

     It climbs back up when the machine proves it can afford it, with
     a wide gap between the step-down and step-up thresholds so a
     borderline device settles instead of oscillating.
  ---------------------------------------------------------------- */

  /* Rendering above 1.25x DPR buys nothing here: there is no text and
     no hard edge in the output for the extra pixels to sharpen. */
  const MAX_DPR = 1.25;
  const SCALES = [1, 0.75, 0.6, 0.45];
  /* Frame-rate ladder, in ms between sky redraws. 0 is every frame.
     The last rung is a still sky: on a machine that cannot afford
     even 20fps of cloud, a beautiful frozen sky behind a page that
     scrolls properly is a straight upgrade on a drifting one behind
     a page that judders. */
  const INTERVALS = [0, 33, 50, Infinity];
  /* The gap between these two is the dead zone, and it has to be wide.
     Every change reallocates the drawing buffer, so a narrow band
     makes the renderer oscillate between two steps forever, paying
     that cost every second to no benefit. Measured: at 18/24 it
     flip-flopped between 45% and 60% indefinitely. */
  const SLOW_MS = 26;        // worse than ~38fps: the page feels it
  const FAST_MS = 13;        // comfortably above 60fps: real headroom
  const SETTLE_FRAMES = 30;  // ~0.5s of evidence per decision
  const COOLDOWN_MS = 2000;  // let a change bed in before judging again

  /* Start one rung down rather than at full resolution. 0.75 is
     indistinguishable on this content, and it means a weak machine
     gets a usable first scroll instead of several seconds of judder
     while the controller works out what it can afford. A capable one
     climbs to 1.0 within a couple of seconds and nobody sees the
     difference either way. First impressions are the one thing an
     adaptive system cannot go back and fix. */
  let qualityStep = 1;
  let intervalStep = 0;
  let lastSky = 0;
  let intervalSum = 0;
  let intervalFrames = 0;
  let lastChange = 0;

  function applyQuality() {
    renderer?.resize(MAX_DPR, SCALES[qualityStep]);
  }

  /**
   * Judge the machine by how fast frames actually arrive.
   *
   * The obvious measurement — timing the draw call — reads near zero
   * and is useless: drawQuad only queues work, and the rasterisation
   * that actually costs 60ms happens later, off the main thread or
   * inside the compositor. The first version of this measured exactly
   * that and consequently never downgraded anything.
   *
   * The interval between animation frames has no such blind spot. If
   * the browser cannot deliver a frame on time, whatever the reason,
   * that IS the symptom being fixed — the page scrolling at 15fps —
   * so it is the right thing to react to even when the background is
   * only part of the cause.
   */
  function judgeQuality(frameInterval) {
    // A tab returning from the background reports an enormous gap.
    // Treat anything absurd as noise rather than evidence.
    if (frameInterval > 500) return;

    intervalSum += frameInterval;
    intervalFrames += 1;
    if (intervalFrames < SETTLE_FRAMES) return;

    const average = intervalSum / intervalFrames;
    intervalSum = 0;
    intervalFrames = 0;

    const nowMs = performance.now();
    if (nowMs - lastChange < COOLDOWN_MS) return;

    /* Resolution is spent before frame rate, and recovered after it:
       a sharp sky that stutters reads worse than a soft one that
       drifts, so the thing given away first is the thing least
       missed. */
    const before = `${qualityStep}:${intervalStep}`;

    if (average > SLOW_MS) {
      if (qualityStep < SCALES.length - 1) {
        qualityStep += 1;
        applyQuality();
      } else if (intervalStep < INTERVALS.length - 1) {
        intervalStep += 1;
      }
    } else if (average < FAST_MS) {
      if (intervalStep > 0) intervalStep -= 1;
      else if (qualityStep > 0) {
        qualityStep -= 1;
        applyQuality();
      }
    }

    if (`${qualityStep}:${intervalStep}` !== before) lastChange = nowMs;

    stats.quality = `${Math.round(SCALES[qualityStep] * 100)}%`
      + (INTERVALS[intervalStep] ? ` @${INTERVALS[intervalStep] === Infinity ? 'still' : Math.round(1000 / INTERVALS[intervalStep]) + 'fps'}` : '');
  }

  function resize() {
    applyQuality();
    petals.resize();
    flock.resize();
  }

  function renderFrame(now) {
    if (!running) return;
    frameHandle = requestAnimationFrame(renderFrame);

    const dt = lastFrame ? (now - lastFrame) / 1000 : 0.016;
    if (lastFrame) judgeQuality(now - lastFrame);
    lastFrame = now;
    elapsed += Math.min(dt, 0.05);

    const frameStart = performance.now();

    // Exponential smoothing toward the target — frame-rate independent,
    // so switching to dark mode fades the sky rather than cutting it.
    const ease = 1 - Math.pow(0.001, Math.min(dt, 0.05));
    darkMix += (darkTarget - darkMix) * ease;

    pointer.x += (pointer.px - pointer.x) * Math.min(dt * 4, 1);
    pointer.y += (pointer.py - pointer.y) * Math.min(dt * 4, 1);

    /* The sky is redrawn only when it is due. Skipping a frame leaves
       the previous one on screen rather than clearing to nothing, so
       a throttled sky looks like a still sky, not a flickering one. */
    const skyDue = INTERVALS[intervalStep] === 0 || now - lastSky >= INTERVALS[intervalStep];
    if (renderer && skyDue) {
      lastSky = now;

      renderer.clear();
      skyProgram.use();
      skyProgram.set('uResolution', [glCanvas.width, glCanvas.height]);
      skyProgram.set('uTime', elapsed);
      skyProgram.set('uAlpha', 1);
      skyProgram.set('uDark', darkMix);
      skyProgram.set('uPointer', [pointer.x, pointer.y]);
      renderer.drawQuad();
    }

    petals.update(dt, elapsed);
    flock.update(dt);

    petals.clearFrame();
    flock.draw();       // behind…
    petals.draw();      // …the petals

    /* -- stats sampling, once every ~500ms -- */
    statFrames++;
    statTimeSum += performance.now() - frameStart;
    stats.frames++;
    if (now - statWindowStart > 500) {
      stats.fps = Math.round((statFrames * 1000) / (now - statWindowStart));
      stats.frameMs = statTimeSum / statFrames;
      stats.petals = petals.count;
      stats.backend = backend;
      bus.emit('gfx.stats', stats);
      statWindowStart = now;
      statFrames = 0;
      statTimeSum = 0;
    }
  }

  /** Draw exactly one frame — used for reduced motion and on pause. */
  function renderStatic() {
    resize();
    syncColourScheme();
    darkMix = darkTarget;
    if (renderer) {
      renderer.clear();
      skyProgram.use();
      skyProgram.set('uResolution', [glCanvas.width, glCanvas.height]);
      skyProgram.set('uTime', 8.0);         // a pleasant, arbitrary moment
      skyProgram.set('uAlpha', 1);
      skyProgram.set('uDark', darkMix);
      skyProgram.set('uPointer', [0.5, 0.5]);
      renderer.drawQuad();
    }
    petals.clear();
  }

  function start() {
    if (running || reducedMotion) return;
    running = true;
    lastFrame = 0;
    statWindowStart = performance.now();
    frameHandle = requestAnimationFrame(renderFrame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frameHandle);
  }

  /* -- wiring -------------------------------------------------- */
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (!running) renderStatic();
    }, 150);
  };

  const onPointerMove = (event) => {
    pointer.px = event.clientX / window.innerWidth;
    pointer.py = 1 - event.clientY / window.innerHeight;
    petals.setPointer(event.clientX, event.clientY);
  };

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };

  const schemeObserver = new MutationObserver(syncColourScheme);

  return {
    start() {
      buildGL();
      resize();
      syncColourScheme();

      window.addEventListener('resize', onResize, { passive: true });
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);
      schemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

      if (reducedMotion) {
        log.info('reduced motion requested — rendering a single static frame');
        renderStatic();
      } else {
        start();
      }
      log.info(`scene online (${backend}, ${petals.count} particles, ${flock.count} boids)`);
    },

    stop() {
      stop();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);
      schemeObserver.disconnect();
      renderer?.dispose();
    },

    burst: (x, y, n) => petals.burst(x, y, n),
    stats: () => ({ ...stats }),
    backend: () => backend,
  };
}
