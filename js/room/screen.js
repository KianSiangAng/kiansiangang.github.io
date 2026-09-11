/* ================================================================
   SCREEN.JS — The desktop, projected onto the monitor

   The obvious way to show a UI on a 3D monitor is to render it to a
   canvas and use that canvas as a texture. It is also the wrong way:
   a texture is a picture. You cannot select its text, tab through
   its buttons, read it with a screen reader, or have Google index
   it. Everything that makes the desktop a real interface would be
   thrown away at the last step.

   So the desktop stays real DOM, and we move the DOM to match the
   camera instead. Every frame we take the monitor's world matrix and
   the camera's inverse world matrix, convert both to CSS `matrix3d`
   strings, and hand them to the browser's own 3D compositor. The
   result is live HTML — selectable, focusable, crawlable — sitting
   on a plane in a WebGL scene, in perfect registration with it.

   This is the technique Three.js ships as CSS3DRenderer. It is
   hand-rolled here because we have exactly one plane to place, and
   because vendoring the addon would have required an import map,
   which would have meant an inline <script> and a hole in the
   Content-Security-Policy. Fifty lines of matrix maths is a better
   trade than `script-src 'unsafe-inline'`.

   The two coordinate systems disagree about which way Y points and
   about winding, which is what the sign flips below are correcting.
================================================================ */

import { createLogger } from '../core/logger.js';

const log = createLogger('screen3d');

/* CSS matrix3d is column-major, same as Three.js, so the elements go
   out in order. The negations flip Y: CSS screen space grows
   downward, WebGL world space grows upward. */
function cameraMatrixToCSS(elements) {
  const e = elements;
  return `matrix3d(${[
    round(e[0]), round(-e[1]), round(e[2]), round(e[3]),
    round(e[4]), round(-e[5]), round(e[6]), round(e[7]),
    round(e[8]), round(-e[9]), round(e[10]), round(e[11]),
    round(e[12]), round(-e[13]), round(e[14]), round(e[15]),
  ].join(',')})`;
}

function objectMatrixToCSS(elements) {
  const e = elements;
  return `matrix3d(${[
    round(e[0]), round(e[1]), round(e[2]), round(e[3]),
    round(-e[4]), round(-e[5]), round(-e[6]), round(-e[7]),
    round(e[8]), round(e[9]), round(e[10]), round(e[11]),
    round(e[12]), round(e[13]), round(e[14]), round(e[15]),
  ].join(',')})`;
}

/* Sub-micron precision in a transform string is noise that defeats
   the browser's own "did this change?" check and forces a recomposite
   every frame. Rounding keeps idle frames genuinely idle. */
function round(value) {
  return Math.abs(value) < 1e-6 ? 0 : Number(value.toFixed(6));
}

export function createScreenProjection({ anchor, camera, element, worldWidth }) {
  /* The stage owns the perspective; the stack holds the camera
     transform. Splitting them matters: `perspective` on the same
     element that carries a 3D transform is applied in the wrong
     order and the scene shears. */
  const stage = document.createElement('div');
  stage.className = 'room-stage';

  const stack = document.createElement('div');
  stack.className = 'room-stage__camera';
  stage.appendChild(stack);
  stack.appendChild(element);

  let width = 0;
  let height = 0;
  let lastCamera = '';
  let lastObject = '';

  /**
   * Size the DOM element in pixels and scale the anchor so those
   * pixels map exactly onto `worldWidth` metres of screen. Authoring
   * the element at the viewport's true pixel size is what makes the
   * docked view pixel-perfect instead of a scaled-up blur.
   */
  function resize(viewportWidth, viewportHeight) {
    width = Math.max(1, Math.round(viewportWidth));
    height = Math.max(1, Math.round(viewportHeight));

    element.style.setProperty('width', `${width}px`);
    element.style.setProperty('height', `${height}px`);

    const scale = worldWidth / width;
    anchor.scale.setScalar(scale);
    anchor.updateMatrixWorld(true);

    // The world height the element now occupies, which the camera rig
    // needs in order to frame the screen exactly when docked.
    return { width, height, worldHeight: height * scale };
  }

  /* Once the camera has arrived at the screen, the projection is
     effectively the identity: the plane fills the viewport exactly.
     Holding the DOM in a 3D transform past that point buys nothing
     and costs a great deal — every `overflow: hidden` container in a
     3D-transformed subtree loses hit-testing across a band at its
     top edge in Chrome, so the menu bar, then the first desktop
     icon, then window content, are all visible, correctly placed and
     unclickable.
     Flattening on arrival is visually identical and makes the docked
     desktop ordinary DOM again. */
  let flat = false;

  function setFlat(on) {
    if (flat === on) return;
    flat = on;
    stage.classList.toggle('is-flat', on);
    if (on) {
      // Drop the inline transforms so the flat rules are unopposed.
      stack.style.removeProperty('transform');
      element.style.removeProperty('transform');
      lastCamera = '';
      lastObject = '';
    }
  }

  function render() {
    if (flat) return;

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // projectionMatrix[5] is 1/tan(fov/2); multiplied by the half
    // height it is the focal length in pixels, which is exactly what
    // CSS `perspective` wants.
    const focal = camera.projectionMatrix.elements[5] * halfHeight;
    stage.style.setProperty('perspective', `${focal}px`);

    const cameraCSS =
      `translateZ(${round(focal)}px)${cameraMatrixToCSS(camera.matrixWorldInverse.elements)}` +
      `translate(${halfWidth}px,${halfHeight}px)`;

    if (cameraCSS !== lastCamera) {
      stack.style.setProperty('transform', cameraCSS);
      lastCamera = cameraCSS;
    }

    const objectCSS = `translate(-50%,-50%)${objectMatrixToCSS(anchor.matrixWorld.elements)}`;
    if (objectCSS !== lastObject) {
      element.style.setProperty('transform', objectCSS);
      lastObject = objectCSS;
    }
  }

  log.debug('screen projection ready');

  return {
    stage,
    resize,
    render,
    setFlat,
    get isFlat() { return flat; },
    /** Only the docked view should receive clicks and focus. */
    setInteractive(on) {
      stage.classList.toggle('is-interactive', on);
    },
    dispose() {
      stage.remove();
    },
  };
}
