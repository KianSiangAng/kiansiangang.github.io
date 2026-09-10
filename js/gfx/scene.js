/* ================================================================
   SCENE.JS — The background renderer and the frame loop

   Owns two stacked fixed-position canvases behind the page:

     gl-layer  WebGL2 full-screen shader (the sky, or the rain)
     fx-layer  canvas2d particles (petals, or falling glyphs)

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
import { vertexShader, ghibliFragment, hackerFragment } from './shaders.js';
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
  let ghibliProgram = null;
  let hackerProgram = null;
  let backend = 'css-gradient';

  function buildGL() {
    /* No capability probe first: probing means creating a context
       purely to throw it away, and browsers cap how many live WebGL
       contexts a page may hold. Just try to build the real one and
       treat a throw as "no WebGL here". */
    try {
      renderer = createRenderer(glCanvas);
      ghibliProgram = renderer.createProgram(vertexShader, ghibliFragment, 'ghibli');
      hackerProgram = renderer.createProgram(vertexShader, hackerFragment, 'hacker');
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

  let worldTarget = 0;      // 0 = ghibli, 1 = hacker
  let worldMix = 0;         // eased toward the target
  let darkTarget = 0;
  let darkMix = 0;

  const pointer = { x: 0.5, y: 0.5, px: 0, py: 0 };

  /* Frame statistics, sampled rather than emitted every frame. */
  const stats = { fps: 0, frameMs: 0, frames: 0, backend, petals: 0 };
  let statWindowStart = 0;
  let statFrames = 0;
  let statTimeSum = 0;

  function syncColourScheme() {
    darkTarget = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
  }

  function resize() {
    renderer?.resize();
    petals.resize();
    flock.resize();
  }

  function renderFrame(now) {
    if (!running) return;
    frameHandle = requestAnimationFrame(renderFrame);

    const dt = lastFrame ? (now - lastFrame) / 1000 : 0.016;
    lastFrame = now;
    elapsed += Math.min(dt, 0.05);

    const frameStart = performance.now();

    // Exponential smoothing toward the target — frame-rate independent.
    const ease = 1 - Math.pow(0.001, Math.min(dt, 0.05));
    worldMix += (worldTarget - worldMix) * ease;
    darkMix += (darkTarget - darkMix) * ease;
    if (Math.abs(worldTarget - worldMix) < 0.001) worldMix = worldTarget;

    pointer.x += (pointer.px - pointer.x) * Math.min(dt * 4, 1);
    pointer.y += (pointer.py - pointer.y) * Math.min(dt * 4, 1);

    if (renderer) {
      renderer.clear();
      const uniforms = (program, alpha) => {
        program.use();
        program.set('uResolution', [glCanvas.width, glCanvas.height]);
        program.set('uTime', elapsed);
        program.set('uAlpha', alpha);
        program.set('uDark', darkMix);
        program.set('uPointer', [pointer.x, pointer.y]);
        renderer.drawQuad();
      };
      if (worldMix < 0.999) uniforms(ghibliProgram, 1 - worldMix);
      if (worldMix > 0.001) uniforms(hackerProgram, worldMix);
    }

    petals.setWorldMix(worldMix);
    flock.setWorldMix(worldMix);
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
    worldMix = worldTarget;
    if (renderer) {
      renderer.clear();
      const program = worldMix > 0.5 ? hackerProgram : ghibliProgram;
      program.use();
      program.set('uResolution', [glCanvas.width, glCanvas.height]);
      program.set('uTime', 8.0);            // a pleasant, arbitrary moment
      program.set('uAlpha', 1);
      program.set('uDark', darkMix);
      program.set('uPointer', [0.5, 0.5]);
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

    /** 0 = ghibli, 1 = hacker. The loop eases across. */
    setWorld(value) {
      worldTarget = value;
      if (reducedMotion) renderStatic();
    },

    burst: (x, y, n) => petals.burst(x, y, n),
    stats: () => ({ ...stats }),
    backend: () => backend,
  };
}
