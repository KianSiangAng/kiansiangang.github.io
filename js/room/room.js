/* ================================================================
   ROOM.JS — The scene, the lights and the loop

   Assembles the desk, lights it for day or night, drives one frame
   loop, and owns the dock/undock interaction.

   Degradation ladder, same discipline as the flat renderer:
     1. no WebGL2        → the room never boots, the flat wallpaper
                           stays and the desktop behaves as before
     2. reduced motion   → no flight, no drift; the camera simply
                           starts docked and the room is a still life
     3. tab hidden       → loop parked
     4. small viewport   → the OS shell has already fallen back to
                           the scrolling page, so we are not here

   Only one light casts shadows. A second shadow-casting light is
   another full depth pass over the scene for detail nobody looks
   at, and this renderer is running behind a live UI.
================================================================ */

import * as THREE from '../../libs/three.module.min.js';
import { createMaterials } from './materials.js';
import {
  buildRoom, buildWindow, buildDesk, buildMonitor, buildKeyboard,
  buildMug, buildLamp, buildBooks, buildPlant, buildCrane, buildPoster,
  SCREEN,
} from './props.js';
import { createCameraRig } from './camera-rig.js';
import { createScreenProjection } from './screen.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('room');
const MAX_DPR = 1.5;

export function createRoomScene({ bus, desktopElement, reducedMotion }) {
  /* ---- renderer ---- */
  const canvas = document.createElement('canvas');
  canvas.className = 'room-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    throw new Error(`WebGL renderer unavailable: ${err.message}`);
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  /* ---- scene ---- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9cfc0);   // mutated in place, never replaced
  scene.fog = new THREE.Fog(0xd9cfc0, 6, 13);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 40);

  const materials = createMaterials();

  const room = buildRoom(materials);
  const windowFrame = buildWindow(materials);
  const desk = buildDesk(materials);
  const monitor = buildMonitor(materials);

  scene.add(room, windowFrame, desk, monitor);
  scene.add(
    buildKeyboard(materials), buildMug(materials), buildLamp(materials),
    buildBooks(materials), buildPlant(materials), buildCrane(materials),
    buildPoster(materials),
  );

  /* ---- lights ---- */
  const ambient = new THREE.AmbientLight(0xbcc9d8, 0.55);
  scene.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0xcfe2f2, 0x8a6a52, 0.7);
  scene.add(hemisphere);

  /* The sun, coming through the window. The only shadow caster. */
  const sun = new THREE.DirectionalLight(0xffe9c9, 1.5);
  sun.position.set(-3.4, 3.2, 1.4);
  sun.target.position.set(0, 0.75, -0.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 9;
  // Tight bounds around the desk: a shadow camera sized to the whole
  // room spends its texels on empty floor.
  sun.shadow.camera.left = -2;
  sun.shadow.camera.right = 2;
  sun.shadow.camera.top = 2;
  sun.shadow.camera.bottom = -1.6;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  /* The lamp, which only matters after dark. */
  const lamp = new THREE.PointLight(0xffc978, 0, 2.2, 2);
  lamp.position.set(-0.62, 1.09, 0.02);
  scene.add(lamp);

  /* The monitor's own glow, spilling onto the desk and the keyboard. */
  const screenGlow = new THREE.PointLight(0x9fc4ff, 0.25, 1.4, 2);
  screenGlow.position.set(0, SCREEN.centre.y, SCREEN.centre.z + 0.3);
  scene.add(screenGlow);

  /* ---- the view through the window ---- */
  const viewCanvas = document.createElement('canvas');
  viewCanvas.width = 512;
  viewCanvas.height = 512;
  const viewTexture = new THREE.CanvasTexture(viewCanvas);
  viewTexture.colorSpace = THREE.SRGBColorSpace;
  windowFrame.getObjectByName('view').material = new THREE.MeshBasicMaterial({ map: viewTexture });

  function paintView(night) {
    const ctx = viewCanvas.getContext('2d');
    const { width: w, height: h } = viewCanvas;

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    if (night) {
      sky.addColorStop(0, '#101a33');
      sky.addColorStop(0.55, '#202c4a');
      sky.addColorStop(1, '#39405e');
    } else {
      sky.addColorStop(0, '#7fb2e0');
      sky.addColorStop(0.5, '#bcd8ee');
      sky.addColorStop(1, '#f0dcc4');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Sun or moon.
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.26, night ? 26 : 34, 0, Math.PI * 2);
    ctx.fillStyle = night ? 'rgba(226,232,255,.92)' : 'rgba(255,243,214,.95)';
    ctx.fill();

    // Hills, back to front.
    const hills = night
      ? ['#2c3350', '#242a43', '#1b2036']
      : ['#9aaec4', '#8f9db4', '#7c8aa2'];
    /* Wide, low ridges sampled from two sine waves. The previous
       version drew a quadratic arc every 40px, which produced a row
       of identical scallops rather than a horizon. */
    hills.forEach((colour, index) => {
      const base = h * (0.60 + index * 0.11);
      const amplitude = 46 - index * 10;
      const frequency = 0.0042 + index * 0.0016;
      const phase = index * 2.1;

      ctx.beginPath();
      ctx.moveTo(-10, h + 20);
      for (let x = -10; x <= w + 10; x += 6) {
        const y = base
          - Math.sin(x * frequency + phase) * amplitude
          - Math.sin(x * frequency * 2.7 + phase * 1.7) * amplitude * 0.3;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 10, h + 20);
      ctx.closePath();
      ctx.fillStyle = colour;
      ctx.fill();
    });

    viewTexture.needsUpdate = true;
  }
  paintView(false);

  /* ---- the desktop, on the screen ---- */
  const anchor = monitor.getObjectByName('anchor');
  const projection = createScreenProjection({
    anchor,
    camera,
    element: desktopElement,
    worldWidth: SCREEN.width,
  });

  const rig = createCameraRig({ camera, monitor, reducedMotion });

  /* ---- sizing ---- */
  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / Math.max(height, 1);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(width, height, false);

    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    /* Reshape the screen to the viewport's aspect, then tell the
       projection how many metres wide it is. Matching aspects is what
       lets the docked view be pixel-exact with no letterboxing. */
    const worldWidth = SCREEN.width;
    const worldHeight = worldWidth / aspect;
    monitor.userData.setScreenSize(worldWidth, worldHeight);
    monitor.updateMatrixWorld(true);

    const metrics = projection.resize(width, height);
    rig.setScreenHeight(metrics.worldHeight);

    screenGlow.position.set(0, SCREEN.centre.y, SCREEN.centre.z + 0.3);
  }

  /* ---- day and night ---- */
  let nightTarget = 0;
  let night = 0;

  function syncScheme() {
    const wantsNight = document.documentElement.dataset.theme === 'dark';
    nightTarget = wantsNight ? 1 : 0;
    paintView(wantsNight);
  }

  /* Reused rather than allocated: this used to build a dozen Colors
     every frame, which is a steady drip of garbage behind a UI that
     is trying to stay at 60fps. */
  const backgroundDay = new THREE.Color(0xd9cfc0);
  const backgroundNight = new THREE.Color(0x1a1a26);
  const backgroundScratch = new THREE.Color();

  function applyLighting() {
    ambient.intensity = 0.55 - night * 0.38;
    hemisphere.intensity = 0.7 - night * 0.55;
    hemisphere.color.setHex(night > 0.5 ? 0x3a4566 : 0xcfe2f2);

    sun.intensity = 1.5 * (1 - night);
    lamp.intensity = night * 2.4;
    screenGlow.intensity = 0.25 + night * 0.85;

    backgroundScratch.copy(backgroundDay).lerp(backgroundNight, night);
    scene.background.copy(backgroundScratch);
    scene.fog.color.copy(backgroundScratch);

    materials.setNight(night);
    renderer.toneMappingExposure = 1.05 - night * 0.15;
  }

  /* ---- loop ---- */
  let running = false;
  let frame = 0;
  let lastTime = 0;
  const stats = { fps: 0, frameMs: 0, calls: 0, tris: 0 };
  let statWindow = 0;
  let statFrames = 0;

  function tick(now) {
    if (!running) return;
    frame = requestAnimationFrame(tick);

    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;
    const started = performance.now();

    /* Only re-light when the day/night blend is actually moving.
       Settled scenes should cost a render and nothing else. */
    if (night !== nightTarget) {
      night += (nightTarget - night) * (1 - Math.pow(0.002, dt));
      if (Math.abs(nightTarget - night) < 0.002) night = nightTarget;
      applyLighting();
    }

    rig.update();
    camera.updateMatrixWorld(true);

    renderer.render(scene, camera);

    /* Flatten the moment the flight lands, un-flatten the moment one
       starts. The swap is invisible because at that instant the 3D
       projection and the flat layout agree exactly. */
    projection.setFlat(rig.mode === 'screen' && !rig.flying);
    projection.render();

    statFrames++;
    if (now - statWindow > 500) {
      stats.fps = Math.round((statFrames * 1000) / (now - statWindow));
      stats.frameMs = performance.now() - started;
      stats.calls = renderer.info.render.calls;
      stats.tris = renderer.info.render.triangles;
      bus.emit('gfx.stats', { ...stats, backend: 'three/webgl2', petals: 0 });
      statWindow = now;
      statFrames = 0;
    }
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = 0;
    statWindow = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frame);
  }

  /* ---- interaction ---- */
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();

  function onPointerMove(event) {
    const nx = (event.clientX / window.innerWidth) * 2 - 1;
    const ny = -((event.clientY / window.innerHeight) * 2 - 1);
    rig.setPointer(nx, ny);
    pointerNDC.set(nx, ny);

    if (rig.mode === 'room' && !rig.flying) {
      raycaster.setFromCamera(pointerNDC, camera);
      const hit = raycaster.intersectObject(monitor, true).length > 0;
      canvas.classList.toggle('is-over-screen', hit);
    }
  }

  function onClick(event) {
    if (rig.mode !== 'room' || rig.flying) return;

    const nx = (event.clientX / window.innerWidth) * 2 - 1;
    const ny = -((event.clientY / window.innerHeight) * 2 - 1);
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);

    if (raycaster.intersectObject(monitor, true).length > 0) dock();
  }

  function dock() {
    if (!rig.dock()) return;
    projection.setInteractive(true);
    document.documentElement.dataset.room = 'docked';
    bus.emit('room.docked');
  }

  function undock() {
    // Back into 3D before the camera starts moving, or the desktop
    // would sit flat against the viewport for the whole flight out.
    projection.setFlat(false);
    if (!rig.undock()) return;
    projection.setInteractive(false);
    document.documentElement.dataset.room = 'away';
    bus.emit('room.away');
  }

  const onResize = debounce(resize, 120);
  const onVisibility = () => (document.hidden ? stop() : start());
  const schemeObserver = new MutationObserver(syncScheme);

  function debounce(fn, ms) {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  return {
    canvas,
    stage: projection.stage,

    mount(host) {
      host.append(canvas, projection.stage);
      resize();
      syncScheme();
      night = nightTarget;
      applyLighting();

      window.addEventListener('resize', onResize, { passive: true });
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      canvas.addEventListener('click', onClick);
      document.addEventListener('visibilitychange', onVisibility);
      schemeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });

      /* Reduced motion starts docked: the flight is the part that
         moves, and without it the room view is a picture the visitor
         cannot get out of. */
      if (reducedMotion) {
        rig.set('screen', { instant: true });
        projection.setInteractive(true);
        projection.setFlat(true);
        document.documentElement.dataset.room = 'docked';
      } else {
        document.documentElement.dataset.room = 'away';
      }

      start();
      log.info(`room mounted (${renderer.info.render.triangles} triangles)`);
    },

    dock,
    undock,
    toggle: () => (rig.mode === 'screen' ? undock() : dock()),
    get mode() { return rig.mode; },
    stats: () => ({ ...stats }),

    dispose() {
      stop();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVisibility);
      schemeObserver.disconnect();
      projection.dispose();
      materials.dispose();
      renderer.dispose();
      canvas.remove();
      delete document.documentElement.dataset.room;
    },
  };
}
