/* ================================================================
   CAMERA-RIG.JS — Two places to stand

   The camera has exactly two poses:

     'room'    back from the desk, slightly above it, with a gentle
               parallax drift that follows the pointer
     'screen'  docked: square on to the monitor at the precise
               distance that makes the screen fill the viewport

   and it eases between them. The dock distance is computed rather
   than tuned by hand, from the screen's world height and the
   camera's field of view, so it stays exact at any window size:

       d = (h / 2) / tan(fov / 2)

   Transitions are guarded by a small state machine, because a
   visitor clicking the monitor repeatedly should queue, not launch
   four overlapping flights that fight each other.
================================================================ */

import * as THREE from '../../libs/three.module.min.js';
import { SCREEN } from './props.js';

const ROOM_POSITION = new THREE.Vector3(0.82, 1.44, 1.78);
const ROOM_TARGET = new THREE.Vector3(-0.02, 1.02, -0.16);
const FLIGHT_MS = 1500;

/* smoothstep-squared: slow to leave, slow to arrive, quick through
   the middle. Linear interpolation on a camera looks mechanical. */
function ease(t) {
  const s = t * t * (3 - 2 * t);
  return s * s * (3 - 2 * s);
}

export function createCameraRig({ camera, monitor, reducedMotion }) {
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  let mode = 'room';                 // 'room' | 'screen'
  let progress = 0;                  // 0 = room, 1 = docked
  let flight = null;                 // { from, to, start }
  let screenWorldHeight = SCREEN.height;

  const from = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  const to = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  /* MUST be a camera, not a plain Object3D.
     Object3D.lookAt() orients +Z at the target; Camera.lookAt()
     orients -Z at it, because cameras look down their negative Z.
     Borrowing a plain Object3D to compute a camera quaternion turns
     the camera through 180 degrees and points it at the empty half
     of the room — which renders as a flat field of clear colour and
     looks exactly like "the geometry failed to load". */
  const scratch = new THREE.PerspectiveCamera();

  /** Where the camera must stand for the screen to fill the frame. */
  function dockedPose() {
    monitor.updateMatrixWorld(true);

    const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const distance = (screenWorldHeight / 2) / Math.tan(halfFov);

    // The screen's own forward axis, so a tilted monitor is met
    // square-on rather than from a fixed world direction.
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(monitor.getWorldQuaternion(new THREE.Quaternion()));
    const centre = monitor.getWorldPosition(new THREE.Vector3());

    const position = centre.clone().addScaledVector(normal, distance);

    scratch.position.copy(position);
    scratch.lookAt(centre);

    return { position, quaternion: scratch.quaternion.clone() };
  }

  function roomPose() {
    const position = ROOM_POSITION.clone();

    // Parallax: a few centimetres of drift, no more. Enough to feel
    // hand-held, not enough to make anyone seasick.
    position.x += pointer.x * 0.16;
    position.y += pointer.y * 0.09;

    scratch.position.copy(position);
    scratch.lookAt(ROOM_TARGET);

    return { position, quaternion: scratch.quaternion.clone() };
  }

  function poseFor(which) {
    return which === 'screen' ? dockedPose() : roomPose();
  }

  function goTo(next, { instant = false } = {}) {
    if (next === mode && !flight) return false;
    if (flight) return false;                    // a flight is already in progress

    if (instant || reducedMotion) {
      mode = next;
      progress = next === 'screen' ? 1 : 0;
      const pose = poseFor(next);
      camera.position.copy(pose.position);
      camera.quaternion.copy(pose.quaternion);
      return true;
    }

    const start = poseFor(mode);
    const end = poseFor(next);
    from.position.copy(start.position);
    from.quaternion.copy(start.quaternion);
    to.position.copy(end.position);
    to.quaternion.copy(end.quaternion);

    flight = { to: next, started: performance.now() };
    return true;
  }

  function update() {
    // Pointer drift is eased separately so it keeps working while
    // the camera is otherwise still.
    pointer.x += (pointer.tx - pointer.x) * 0.055;
    pointer.y += (pointer.ty - pointer.y) * 0.055;

    if (flight) {
      const elapsed = performance.now() - flight.started;
      const t = Math.min(elapsed / FLIGHT_MS, 1);
      const k = ease(t);

      camera.position.lerpVectors(from.position, to.position, k);
      camera.quaternion.slerpQuaternions(from.quaternion, to.quaternion, k);
      progress = flight.to === 'screen' ? k : 1 - k;

      if (t >= 1) {
        mode = flight.to;
        flight = null;
      }
      return;
    }

    const pose = poseFor(mode);
    if (mode === 'room') {
      // Follow the drifting pose continuously.
      camera.position.copy(pose.position);
      camera.quaternion.copy(pose.quaternion);
    } else {
      // Docked: hold absolutely still. Any drift here would show up
      // as the whole desktop UI swimming under the cursor.
      camera.position.copy(pose.position);
      camera.quaternion.copy(pose.quaternion);
    }
  }

  return {
    update,
    dock: () => goTo('screen'),
    undock: () => goTo('room'),
    toggle: () => goTo(mode === 'screen' ? 'room' : 'screen'),
    set: (which, options) => goTo(which, options),

    get mode() { return mode; },
    get progress() { return progress; },
    get flying() { return flight !== null; },

    /** Told by the renderer whenever the screen plane is reshaped. */
    setScreenHeight(height) { screenWorldHeight = height; },

    setPointer(nx, ny) {
      pointer.tx = THREE.MathUtils.clamp(nx, -1, 1);
      pointer.ty = THREE.MathUtils.clamp(ny, -1, 1);
    },
  };
}
