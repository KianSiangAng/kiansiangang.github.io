/* ================================================================
   PROPS.JS — Everything in the room, built from code

   No model files: every object is assembled from box, cylinder,
   lathe and plane primitives. That keeps the whole room a few
   kilobytes of JavaScript instead of a multi-megabyte glTF, and it
   means a colour or a proportion is a one-line change.

   The objects deliberately echo the desktop launchers — books, a
   CRT, a mug, a potted plant, a paper crane — so the desktop and
   the room read as one place rather than two projects.

   Everything is measured in metres, with the origin on the floor at
   the centre of the desk. The desk surface is at y = 0.74, which is
   a real desk height and keeps the camera maths honest.
================================================================ */

import * as THREE from '../../libs/three.module.min.js';

const DESK_HEIGHT = 0.74;
const DESK_WIDTH = 1.8;
const DESK_DEPTH = 0.72;

/**
 * The window's metrics, published because the curtains hang off them.
 * The curtains used to carry their own copies of these numbers, which
 * is how they ended up swinging through the frame: two sets of
 * constants describing the same object, free to disagree.
 */
export const WINDOW = {
  x: -1.35,
  y: 1.33,
  z: -1.085,
  width: 1.15,
  height: 1.25,
  frameThickness: 0.055,
  frameDepth: 0.06,
  frameOffsetZ: 0.02,
};

/** Frontmost face of the window's timbers — what the curtains must clear. */
WINDOW.frontZ = WINDOW.z + WINDOW.frameOffsetZ + WINDOW.frameDepth / 2;

/** Top of the head casing, where a curtain rod would sit. */
WINDOW.headY = WINDOW.y + WINDOW.height / 2 + WINDOW.frameThickness;

/** Screen dimensions, exported because the camera rig needs them. */
export const SCREEN = {
  width: 0.62,
  height: 0.39,
  centre: new THREE.Vector3(0, DESK_HEIGHT + 0.30, -0.12),
  tilt: -0.06,                      // radians, leaning back slightly
};

export { DESK_HEIGHT, DESK_WIDTH, DESK_DEPTH };

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function mesh(geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/* ----------------------------------------------------------------
   Room shell
---------------------------------------------------------------- */

export function buildRoom(materials) {
  const group = new THREE.Group();
  group.name = 'room';

  const floor = mesh(new THREE.PlaneGeometry(9, 9), materials.floor, { rx: -Math.PI / 2, cast: false });
  group.add(floor);

  const rug = mesh(new THREE.PlaneGeometry(3.4, 2.4), materials.rug, { y: 0.002, z: 0.5, rx: -Math.PI / 2, cast: false });
  group.add(rug);

  // Back wall, behind the desk. Only the walls the camera can see
  // are built — there is no ceiling and no fourth wall.
  const back = mesh(box(9, 3.2, 0.1), materials.wall, { y: 1.6, z: -1.15, cast: false });
  group.add(back);

  const left = mesh(box(0.1, 3.2, 4.6), materials.wall, { x: -2.6, y: 1.6, z: 1.1, cast: false });
  group.add(left);

  // Skirting board: a small detail that makes a box read as a room.
  group.add(mesh(box(9, 0.09, 0.04), materials.wallTrim, { y: 0.045, z: -1.08, cast: false }));

  return group;
}

/* ----------------------------------------------------------------
   Window, with a view
---------------------------------------------------------------- */

export function buildWindow(materials) {
  const group = new THREE.Group();
  group.name = 'window';
  /* The wall's front face is at z = -1.10, so every part of the
     window has to sit in FRONT of that or the wall draws over it —
     which rendered the view as a flat grey pane.

     The height was lowered from 1.55: at the old one the head of the
     window, and any curtain rod above it, sat outside the camera's
     framing. */
  group.position.set(WINDOW.x, WINDOW.y, WINDOW.z);

  const W = WINDOW.width;
  const H = WINDOW.height;

  // The view: an unlit plane the room's lighting cannot touch, so it
  // reads as bright daylight (or night) rather than a lit surface.
  const view = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ color: 0xbcd8ee }),
  );
  view.position.z = 0.002;
  view.name = 'view';
  group.add(view);

  group.add(mesh(new THREE.PlaneGeometry(W, H), materials.glass, { z: 0.018, cast: false, receive: false }));

  const frame = WINDOW.frameThickness;
  const depth = WINDOW.frameDepth;
  const fz = WINDOW.frameOffsetZ;
  group.add(mesh(box(W + frame * 2, frame, depth), materials.frame, { y: H / 2 + frame / 2, z: fz }));
  group.add(mesh(box(W + frame * 2, frame, depth), materials.frame, { y: -H / 2 - frame / 2, z: fz }));
  group.add(mesh(box(frame, H + frame * 2, depth), materials.frame, { x: -W / 2 - frame / 2, z: fz }));
  group.add(mesh(box(frame, H + frame * 2, depth), materials.frame, { x: W / 2 + frame / 2, z: fz }));
  group.add(mesh(box(0.03, H, 0.05), materials.frame, { z: 0.024 }));      // centre mullion
  group.add(mesh(box(W, 0.03, 0.05), materials.frame, { z: 0.024 }));      // centre transom
  group.add(mesh(box(W + 0.22, 0.05, 0.16), materials.frame, { y: -H / 2 - frame - 0.02, z: 0.07 })); // sill

  return group;
}

/* ----------------------------------------------------------------
   Curtains

   Two hanging panels on a rod, swayed by displacing their vertices
   every frame rather than by any physics. A cloth simulation for
   something the camera only ever sees from one angle would be a lot
   of solver for a little movement; a travelling sine wave, pinned at
   the rod and free at the hem, reads as fabric and costs a few
   hundred multiplications.

   The rest positions are kept in a Float32Array so each frame
   displaces from the ORIGINAL shape. Displacing from the previous
   frame's positions compounds the error and the curtain slowly
   wanders off the rod.
---------------------------------------------------------------- */

export function buildCurtains(materials) {
  const group = new THREE.Group();
  group.name = 'curtains';

  /* ---- how far the fabric travels ----
     Every displacement the sway applies is declared here, because the
     standoff from the wall is COMPUTED from them. Previously the
     rest plane was a hand-picked -1.03 while the sway swung the hem
     63mm backwards from it — and the frame's front face is at
     -1.035, five millimetres behind. The curtains passed clean
     through the timber on every swing.

     Deriving the standoff means the two can never disagree again:
     raise the amplitude and the rod simply stands further off the
     wall to accommodate it. */
  const PLEAT = 0.012;             // fixed vertical folds
  const SWAY = 0.042;              // travelling wave, at the hem
  const DRIFT = 0.012;             // sideways, so it costs no depth
  const CLEARANCE = 0.02;          // daylight between fabric and frame

  const CENTRE_X = WINDOW.x;
  const Z = WINDOW.frontZ + PLEAT + SWAY + CLEARANCE;
  const TOP = WINDOW.headY - 0.01; // hung just under the head casing
  const HEIGHT = 1.24;
  const WIDTH = 0.40;

  const rod = mesh(new THREE.CylinderGeometry(0.013, 0.013, 1.44, 12), materials.curtainRod, {
    x: CENTRE_X, y: TOP + 0.03, z: Z, rz: Math.PI / 2, cast: false,
  });
  group.add(rod);

  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.SphereGeometry(0.024, 12, 12), materials.curtainRod, {
      x: CENTRE_X + side * 0.73, y: TOP + 0.03, z: Z, cast: false,
    }));
  }

  const panels = [];
  [-0.47, 0.47].forEach((offset, index) => {
    const geometry = new THREE.PlaneGeometry(WIDTH, HEIGHT, 16, 12);
    const panel = new THREE.Mesh(geometry, materials.curtain);
    panel.position.set(CENTRE_X + offset, TOP - HEIGHT / 2, Z);
    panel.castShadow = false;       // a shadow-casting curtain darkens the whole room
    panel.receiveShadow = true;
    panel.userData.rest = Float32Array.from(geometry.attributes.position.array);
    panel.userData.phase = index * 2.3;
    group.add(panel);
    panels.push(panel);
  });

  const HALF = HEIGHT / 2;

  group.userData.animate = (time) => {
    for (const panel of panels) {
      const positions = panel.geometry.attributes.position;
      const rest = panel.userData.rest;
      const phase = panel.userData.phase;

      for (let i = 0; i < positions.count; i++) {
        const x = rest[i * 3];
        const y = rest[i * 3 + 1];

        /* Pinned at the rod, free at the hem. Squaring it keeps the
           top few centimetres almost still, which is what stops the
           panel looking like it is flapping off its hooks. */
        const hang = Math.max(0, (HALF - y) / HEIGHT);
        const freedom = hang * hang;

        const pleat = Math.sin(x * 30) * PLEAT;
        const sway = Math.sin(time * 0.9 + x * 4 + phase) * SWAY * freedom;
        const drift = Math.sin(time * 0.55 + phase) * DRIFT * freedom;

        positions.setZ(i, pleat + sway);
        positions.setX(i, x + drift);
      }

      positions.needsUpdate = true;
      panel.geometry.computeVertexNormals();
    }
  };

  // One pass at rest, so the pleats exist before the first frame.
  group.userData.animate(0);

  return group;
}

/* ----------------------------------------------------------------
   Desk
---------------------------------------------------------------- */

export function buildDesk(materials) {
  const group = new THREE.Group();
  group.name = 'desk';

  const topThickness = 0.04;
  group.add(mesh(box(DESK_WIDTH, topThickness, DESK_DEPTH), materials.deskTop, {
    y: DESK_HEIGHT - topThickness / 2,
  }));
  group.add(mesh(box(DESK_WIDTH, 0.012, DESK_DEPTH + 0.004), materials.deskEdge, {
    y: DESK_HEIGHT - topThickness,
  }));

  const legInset = 0.09;
  const legY = (DESK_HEIGHT - topThickness) / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(mesh(box(0.06, DESK_HEIGHT - topThickness, 0.06), materials.deskLeg, {
        x: sx * (DESK_WIDTH / 2 - legInset),
        y: legY,
        z: sz * (DESK_DEPTH / 2 - legInset),
      }));
    }
  }

  // Modesty panel across the back, so the desk is not see-through.
  group.add(mesh(box(DESK_WIDTH - 0.24, 0.26, 0.02), materials.deskLeg, {
    y: DESK_HEIGHT - 0.30,
    z: -DESK_DEPTH / 2 + 0.07,
  }));

  return group;
}

/* ----------------------------------------------------------------
   The monitor — the important one
---------------------------------------------------------------- */

export function buildMonitor(materials) {
  const group = new THREE.Group();
  group.name = 'monitor';
  group.position.copy(SCREEN.centre);
  group.rotation.x = SCREEN.tilt;

  const bezel = 0.035;
  const shellDepth = 0.09;

  /* Built from UNIT geometries and sized by scale, so the screen can
     be reshaped to the visitor's viewport aspect every resize without
     rebuilding or disposing a single buffer. A monitor whose aspect
     matches your window is not a cheat — it is your screen. */
  const shell = mesh(box(1, 1, 1), materials.monitorShell, { cast: true, receive: true });
  shell.name = 'shell';
  group.add(shell);

  const screen = mesh(new THREE.PlaneGeometry(1, 1), materials.screen, {
    cast: false,
    receive: false,
  });
  screen.name = 'screen';
  group.add(screen);

  /* An empty at the screen's centre. The CSS3D overlay reads this
     object's world matrix; keeping it separate from the visible mesh
     means the overlay never inherits a scale meant for geometry. */
  const anchor = new THREE.Object3D();
  anchor.name = 'anchor';
  group.add(anchor);

  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.006, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x8fba92 }),
  );
  led.name = 'led';
  group.add(led);

  const neck = mesh(box(0.07, 0.14, 0.05), materials.monitorShellDark, { z: -0.05 });
  neck.name = 'neck';
  group.add(neck);

  const foot = mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.018, 24), materials.monitorShellDark, {
    z: -0.05,
  });
  foot.name = 'foot';
  group.add(foot);

  /**
   * Resize the screen in world units. Everything that hangs off the
   * screen's dimensions is repositioned here.
   */
  group.userData.setScreenSize = (width, height) => {
    SCREEN.width = width;
    SCREEN.height = height;

    screen.scale.set(width, height, 1);
    shell.scale.set(width + bezel * 2, height + bezel * 2 + 0.05, shellDepth);
    shell.position.set(0, -0.025, -shellDepth / 2 - 0.004);

    led.position.set(width / 2 + 0.012, -height / 2 - 0.028, 0.005);
    neck.position.set(0, -height / 2 - 0.10, -0.05);
    foot.position.set(0, -height / 2 - 0.175, -0.05);
  };

  group.userData.setScreenSize(SCREEN.width, SCREEN.height);
  return group;
}

/* ----------------------------------------------------------------
   Desk objects
---------------------------------------------------------------- */

export function buildKeyboard(materials) {
  const group = new THREE.Group();
  group.name = 'keyboard';
  group.position.set(0.02, DESK_HEIGHT + 0.008, 0.21);
  group.rotation.x = -0.03;

  group.add(mesh(box(0.42, 0.016, 0.14), materials.keyboardBase, {}));

  // Keycaps as one instanced mesh: ~70 tiny boxes as separate meshes
  // would be 70 draw calls for something the camera barely resolves.
  const keyGeometry = box(0.022, 0.008, 0.022);
  const columns = 14;
  const rows = 4;
  const keys = new THREE.InstancedMesh(keyGeometry, materials.keycap, columns * rows);
  keys.castShadow = true;

  const matrix = new THREE.Matrix4();
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      matrix.setPosition(
        -0.185 + c * 0.0285 + r * 0.004,
        0.013,
        -0.045 + r * 0.028,
      );
      keys.setMatrixAt(i++, matrix);
    }
  }
  keys.instanceMatrix.needsUpdate = true;
  group.add(keys);

  return group;
}

export function buildMug(materials) {
  const group = new THREE.Group();
  group.name = 'mug';
  group.position.set(0.62, DESK_HEIGHT, 0.15);

  const body = mesh(new THREE.CylinderGeometry(0.038, 0.033, 0.085, 20, 1, true), materials.mug, { y: 0.0425 });
  body.material = materials.mug.clone();
  body.material.side = THREE.DoubleSide;
  group.add(body);

  group.add(mesh(new THREE.CircleGeometry(0.036, 20), materials.mugInner, {
    y: 0.072, rx: -Math.PI / 2, cast: false,
  }));
  group.add(mesh(new THREE.CircleGeometry(0.033, 20), materials.mug, {
    y: 0.001, rx: -Math.PI / 2, cast: false,
  }));

  group.add(mesh(new THREE.TorusGeometry(0.024, 0.007, 8, 18, Math.PI * 1.2), materials.mug, {
    x: 0.045, y: 0.045, rz: -0.4,
  }));

  return group;
}

export function buildLamp(materials) {
  const group = new THREE.Group();
  group.name = 'lamp';
  group.position.set(-0.62, DESK_HEIGHT, -0.14);

  group.add(mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.016, 20), materials.lampArm, { y: 0.008 }));
  group.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.30, 12), materials.lampArm, { y: 0.16 }));
  group.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.20, 12), materials.lampArm, {
    y: 0.31, z: 0.07, rx: 0.9,
  }));

  /* ConeGeometry already opens downward — its apex is at +Y and its
     wide mouth at -Y — so a desk lamp needs only a small tilt, not a
     flip. The old `Math.PI + 0.75` turned the head right over and
     aimed the mouth up and back at the viewer, which is why the bulb
     was staring out of the screen instead of lighting the desk.

     A small NEGATIVE rotation about X tips the mouth toward +Z, out
     over the desk where the books and keyboard are. */
  const shade = mesh(new THREE.ConeGeometry(0.085, 0.10, 20, 1, true), materials.lampShade, {
    y: 0.368, z: 0.148, rx: -0.55,
  });
  shade.material = materials.lampShade;
  shade.material.side = THREE.DoubleSide;
  group.add(shade);

  /* The bulb: an unlit sphere so the source itself is visible, paired
     with the point light the lighting rig adds. MeshBasic ignores
     lighting, which is exactly right for something that IS the light.

     It is a CHILD OF THE SHADE, not a sibling. Positioning it in the
     lamp's own space meant hand-guessing a point that matched the
     shade's rotation, and it did not — the bulb hung outside the
     shade instead of sitting in its mouth. Parented, it inherits the
     rotation for free and stays put however the shade is aimed.

     Cone local space runs from the wide opening at y = -0.05 to the
     apex at +0.05, and the radius there is 0.085·0.65 ≈ 0.055, so a
     26mm bulb at y = -0.015 sits inside with room to spare. */
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff3d6 }),
  );
  bulb.position.set(0, -0.015, 0);
  bulb.name = 'bulb';
  shade.add(bulb);

  return group;
}

export function buildBooks(materials) {
  const group = new THREE.Group();
  group.name = 'books';
  group.position.set(-0.52, DESK_HEIGHT, 0.16);
  group.rotation.y = 0.18;

  const spines = [
    { material: materials.bookSage, w: 0.20, h: 0.026, d: 0.145 },
    { material: materials.bookPeach, w: 0.19, h: 0.030, d: 0.138 },
    { material: materials.bookBlue, w: 0.205, h: 0.024, d: 0.150 },
  ];

  let y = 0;
  for (const [index, spine] of spines.entries()) {
    group.add(mesh(box(spine.w, spine.h, spine.d), spine.material, {
      y: y + spine.h / 2,
      ry: index * 0.05 - 0.05,
    }));
    // Page block, very slightly inset so it reads as paper edges.
    group.add(mesh(box(spine.w - 0.012, spine.h * 0.72, spine.d - 0.008), materials.pages, {
      y: y + spine.h / 2,
      x: 0.004,
      ry: index * 0.05 - 0.05,
    }));
    y += spine.h;
  }

  return group;
}

export function buildPlant(materials) {
  const group = new THREE.Group();
  group.name = 'plant';
  group.position.set(0.66, DESK_HEIGHT, -0.18);

  group.add(mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.085, 18), materials.potTerracotta, { y: 0.0425 }));
  group.add(mesh(new THREE.CylinderGeometry(0.061, 0.058, 0.016, 18), materials.potRim, { y: 0.088 }));

  /* Leaves are single planes, each bent by moving one vertex — a
     flat quad reads as a leaf from any angle the camera can reach,
     and costs two triangles. */
  const leafGeometry = new THREE.PlaneGeometry(0.042, 0.105, 1, 2);
  const tones = [materials.leafLight, materials.leafMid, materials.leafDark];

  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2 + 0.4;
    const lean = 0.55 + (i % 3) * 0.16;
    const leaf = mesh(leafGeometry, tones[i % 3], {
      x: Math.cos(angle) * 0.03,
      y: 0.145 + (i % 3) * 0.016,
      z: Math.sin(angle) * 0.03,
      ry: -angle,
      rz: Math.cos(angle) * lean,
    });
    leaf.rotateX(lean * 0.4);
    group.add(leaf);
  }

  return group;
}

export function buildMouse(materials) {
  const group = new THREE.Group();
  group.name = 'mouse';
  group.position.set(0.33, DESK_HEIGHT, 0.20);
  group.rotation.y = -0.12;

  /* The body is a sphere squashed on two axes and cropped at the
     desk — cheaper and rounder than any hand-built shell, and a
     mouse is very nearly half an ellipsoid. */
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2), materials.mouseShell);
  body.scale.set(0.062, 0.052, 0.098);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // A flat base so it does not read as a floating dome.
  const base = mesh(new THREE.CircleGeometry(1, 24), materials.mouseShell, {
    y: 0.0015, rx: -Math.PI / 2, cast: false,
  });
  base.scale.set(0.062, 0.098, 1);
  group.add(base);

  /* The shell is a hemisphere of radius 0.5 scaled to semi-axes
     (0.031, 0.026, 0.049), so its crown is only 26mm off the desk.
     The button seam and wheel have to be placed against THAT surface,
     not at the sphere's unscaled radius — the first attempt put the
     wheel at y = 53mm and left it hovering above the mouse like an
     antenna. Surface height at a given z is y = 0.026·√(1 − (z/0.049)²). */
  group.add(mesh(box(0.0025, 0.006, 0.052), materials.mouseSeam, { y: 0.0215, z: -0.020 }));

  const wheel = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.005, 14), materials.mouseWheel, {
    y: 0.0225, z: -0.031, rz: Math.PI / 2,
  });
  group.add(wheel);

  /* A cable running off toward the monitor. Without it the silhouette
     is just a rounded lump; the tail is most of what says "mouse". */
  const cable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.014, -0.048),
    new THREE.Vector3(0.01, 0.012, -0.090),
    new THREE.Vector3(-0.02, 0.010, -0.135),
    new THREE.Vector3(-0.06, 0.008, -0.175),
  ]);
  const cableMesh = new THREE.Mesh(
    new THREE.TubeGeometry(cable, 24, 0.0022, 6, false),
    materials.mouseWheel,
  );
  cableMesh.castShadow = true;
  group.add(cableMesh);

  return group;
}

/** A framed print on the wall — somewhere for the eye to rest. */
export function buildPoster(materials) {
  const group = new THREE.Group();
  group.name = 'poster';
  group.position.set(0.78, 1.52, -1.093);

  const W = 0.34;
  const H = 0.44;

  group.add(mesh(box(W, H, 0.018), materials.frame, {}));
  // A paper mat inside the frame, so the print reads as a print.
  group.add(mesh(new THREE.PlaneGeometry(W - 0.035, H - 0.035), materials.pages, {
    z: 0.011, cast: false,
  }));

  /* The image is clipped by hand: every element is kept inside the
     mat's bounds rather than relying on a clip that 3D does not
     have. Hills that overflow their frame read as a second window. */
  const artW = W - 0.085;
  const artH = H - 0.085;
  group.add(mesh(new THREE.PlaneGeometry(artW, artH), new THREE.MeshLambertMaterial({ color: 0xdfe8ee }), {
    z: 0.0118, cast: false,
  }));

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(0.026, 20),
    new THREE.MeshLambertMaterial({ color: 0xf0c8a0 }),
  );
  sun.position.set(0.055, 0.075, 0.0122);
  group.add(sun);

  /* thetaStart 0 draws the TOP half of the circle, so the hills
     bulge upward from their baseline. Drawing the bottom half and
     sitting it on the baseline hangs the hills off the print. */
  for (const [i, colour] of [0x9d8fae, 0xb08a86, 0x8c7a92].entries()) {
    const radius = 0.075 - i * 0.010;
    const hill = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 20, 0, Math.PI),
      new THREE.MeshLambertMaterial({ color: colour }),
    );
    hill.position.set(-0.052 + i * 0.052, -artH / 2 + 0.002, 0.0124 + i * 0.0002);
    group.add(hill);
  }

  // A ground strip so the hills sit on something.
  group.add(mesh(new THREE.PlaneGeometry(artW, 0.03), new THREE.MeshLambertMaterial({ color: 0x8c7a92 }), {
    y: -artH / 2 + 0.015, z: 0.0131, cast: false,
  }));

  return group;
}
