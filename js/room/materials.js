/* ================================================================
   MATERIALS.JS — The room's palette

   One place for every surface in the room, so the whole scene can
   be re-lit for day or night by swapping a handful of values rather
   than hunting through geometry code.

   Everything is MeshLambertMaterial or MeshBasicMaterial on purpose:
   the room is lit by a few soft lights and wants a matte, flat,
   illustrated look, not physically-based reflections. Lambert is
   also markedly cheaper than Standard, which matters because this
   runs behind a whole desktop UI.
================================================================ */

import * as THREE from '../../libs/three.module.min.js';

/* Warm, desaturated woods and papers — the same family as the
   desktop launcher objects, so the two read as one world. */
export const PALETTE = {
  deskTop: 0xb08b66,
  deskEdge: 0x9d7a57,
  deskLeg: 0x846049,
  floor: 0x7d6454,
  rug: 0xb4917c,
  wall: 0xe8ded0,
  wallTrim: 0xd6c8b4,

  monitorShell: 0xece1cb,
  monitorShellDark: 0xd9cbb0,
  screenGlass: 0x11161f,

  keyboardBase: 0xd8cab2,
  keycap: 0xf2e9d8,

  mug: 0xdcb08a,
  mugInner: 0x5a4436,

  mouseShell: 0xe6dccb,
  mouseSeam: 0xb3a894,
  mouseWheel: 0x6f6558,

  lampShade: 0xf2d7a8,
  lampArm: 0x6f5a4a,

  potTerracotta: 0xd08a62,
  potRim: 0xe0a17a,
  leafLight: 0xb8d4b8,
  leafMid: 0x8fba92,
  leafDark: 0x6e9a74,

  bookBlue: 0x7fa9d4,
  bookPeach: 0xd98f62,
  bookSage: 0x8fba92,
  pages: 0xf6efdf,

  paper: 0xfbf6ea,
  paperShade: 0xe5d8be,

  frame: 0x7d6450,
  glassDay: 0xbcd8ee,
  glassNight: 0x1d2740,
};

/** Build the shared material set. Called once; reused everywhere. */
export function createMaterials() {
  const lambert = (color, extra = {}) =>
    new THREE.MeshLambertMaterial({ color, ...extra });

  const materials = {
    deskTop: lambert(PALETTE.deskTop),
    deskEdge: lambert(PALETTE.deskEdge),
    deskLeg: lambert(PALETTE.deskLeg),
    floor: lambert(PALETTE.floor),
    rug: lambert(PALETTE.rug),
    wall: lambert(PALETTE.wall),
    wallTrim: lambert(PALETTE.wallTrim),

    monitorShell: lambert(PALETTE.monitorShell),
    monitorShellDark: lambert(PALETTE.monitorShellDark),

    /* The screen is unlit and self-coloured: it is a light source in
       the fiction, so shading it like a wall would look wrong. The
       DOM desktop sits in front of it, so this is mostly the bezel
       glow and what shows before the overlay is placed. */
    screen: new THREE.MeshBasicMaterial({ color: PALETTE.screenGlass }),

    keyboardBase: lambert(PALETTE.keyboardBase),
    keycap: lambert(PALETTE.keycap),

    mug: lambert(PALETTE.mug),
    mugInner: lambert(PALETTE.mugInner),

    mouseShell: lambert(PALETTE.mouseShell),
    mouseSeam: lambert(PALETTE.mouseSeam),
    mouseWheel: lambert(PALETTE.mouseWheel),

    lampShade: new THREE.MeshLambertMaterial({
      color: PALETTE.lampShade,
      emissive: 0x000000,
    }),
    lampArm: lambert(PALETTE.lampArm),

    potTerracotta: lambert(PALETTE.potTerracotta),
    potRim: lambert(PALETTE.potRim),
    leafLight: lambert(PALETTE.leafLight, { side: THREE.DoubleSide }),
    leafMid: lambert(PALETTE.leafMid, { side: THREE.DoubleSide }),
    leafDark: lambert(PALETTE.leafDark, { side: THREE.DoubleSide }),

    bookBlue: lambert(PALETTE.bookBlue),
    bookPeach: lambert(PALETTE.bookPeach),
    bookSage: lambert(PALETTE.bookSage),
    pages: lambert(PALETTE.pages),

    paper: lambert(PALETTE.paper, { side: THREE.DoubleSide }),
    paperShade: lambert(PALETTE.paperShade, { side: THREE.DoubleSide }),

    frame: lambert(PALETTE.frame),
    glass: new THREE.MeshBasicMaterial({
      color: PALETTE.glassDay,
      transparent: true,
      opacity: 0.32,
    }),
  };

  /** Shift the whole room between day and night. */
  materials.setNight = (amount) => {
    // Walls and floor cool down and darken as the lamp takes over.
    const mix = (day, night) => new THREE.Color(day).lerp(new THREE.Color(night), amount);

    materials.wall.color.copy(mix(PALETTE.wall, 0x3a3a4e));
    materials.wallTrim.color.copy(mix(PALETTE.wallTrim, 0x32323f));
    materials.floor.color.copy(mix(PALETTE.floor, 0x33261f));
    materials.rug.color.copy(mix(PALETTE.rug, 0x453026));
    materials.deskTop.color.copy(mix(PALETTE.deskTop, 0x5c4028));
    materials.deskEdge.color.copy(mix(PALETTE.deskEdge, 0x503620));
    materials.deskLeg.color.copy(mix(PALETTE.deskLeg, 0x412c1c));
    materials.monitorShell.color.copy(mix(PALETTE.monitorShell, 0x7d7161));
    materials.mouseShell.color.copy(mix(PALETTE.mouseShell, 0x8b8172));
    materials.monitorShellDark.color.copy(mix(PALETTE.monitorShellDark, 0x6b6153));
    materials.glass.color.copy(mix(PALETTE.glassDay, PALETTE.glassNight));
    materials.glass.opacity = 0.32 + amount * 0.34;

    // The shade is lit from the inside at all times, more so at night.
    materials.lampShade.emissive.setHex(0xffc978);
    materials.lampShade.emissiveIntensity = 0.28 + amount * 0.72;
  };

  materials.dispose = () => {
    for (const value of Object.values(materials)) value?.dispose?.();
  };

  return materials;
}
