/* ================================================================
   ICONS.JS — The system icon set

   Every icon is inline SVG built through createElementNS, so there
   are no icon files to fetch, no icon font, and nothing that needs
   innerHTML. Icons inherit currentColor and therefore re-theme for
   free when the world changes.

   Desktop icons are drawn larger and with a second accent colour;
   `icon(name, size)` returns a fresh <svg> each call because a node
   can only live in one place in the document.
================================================================ */

import { svg } from './dom.js';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.6,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

/* Each entry returns an array of child elements drawn in a 24×24 box. */
const SHAPES = {
  folder: () => [
    svg('path', { ...stroke, d: 'M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
    svg('path', { ...stroke, opacity: 0.5, d: 'M3 10.5h18' }),
  ],
  terminal: () => [
    svg('rect', { ...stroke, x: 2.5, y: 4, width: 19, height: 16, rx: 2.5 }),
    svg('path', { ...stroke, d: 'M6.5 10l3 2.5-3 2.5' }),
    svg('path', { ...stroke, d: 'M12.5 15.5h5' }),
  ],
  person: () => [
    svg('circle', { ...stroke, cx: 12, cy: 8.5, r: 3.6 }),
    svg('path', { ...stroke, d: 'M4.5 20a7.5 7.5 0 0 1 15 0' }),
  ],
  document: () => [
    svg('path', { ...stroke, d: 'M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z' }),
    svg('path', { ...stroke, d: 'M13 3v5h5' }),
    svg('path', { ...stroke, opacity: 0.6, d: 'M8.5 13h7M8.5 16.5h7M8.5 9.5h3' }),
  ],
  mail: () => [
    svg('rect', { ...stroke, x: 2.5, y: 5, width: 19, height: 14, rx: 2.5 }),
    svg('path', { ...stroke, d: 'M3 7.5l9 6 9-6' }),
  ],
  gear: () => [
    svg('circle', { ...stroke, cx: 12, cy: 12, r: 3.2 }),
    svg('path', {
      ...stroke,
      d: 'M12 2.8v2.4M12 18.8v2.4M4.5 12H2.1M21.9 12h-2.4M6.4 6.4L4.7 4.7M19.3 19.3l-1.7-1.7M17.6 6.4l1.7-1.7M4.7 19.3l1.7-1.7',
    }),
  ],
  star: () => [
    svg('path', { ...stroke, d: 'M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z' }),
  ],
  lock: () => [
    svg('rect', { ...stroke, x: 4, y: 10.5, width: 16, height: 10, rx: 2.4 }),
    svg('path', { ...stroke, d: 'M7.6 10.5V7.4a4.4 4.4 0 0 1 8.8 0v3.1' }),
    svg('circle', { ...stroke, cx: 12, cy: 15.4, r: 1.4 }),
  ],
  trash: () => [
    svg('path', { ...stroke, d: 'M4.5 6.5h15M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7' }),
    svg('path', { ...stroke, d: 'M6.5 6.5l.9 13a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13' }),
  ],
  globe: () => [
    svg('circle', { ...stroke, cx: 12, cy: 12, r: 8.8 }),
    svg('path', { ...stroke, d: 'M3.2 12h17.6' }),
    svg('path', { ...stroke, d: 'M12 3.2a13.5 13.5 0 0 1 0 17.6a13.5 13.5 0 0 1 0-17.6z' }),
  ],
  github: () => [
    svg('path', {
      fill: 'currentColor',
      d: 'M12 1.3a10.7 10.7 0 0 0-3.38 20.85c.53.1.73-.23.73-.51v-1.99c-2.98.65-3.6-1.28-3.6-1.28-.49-1.24-1.19-1.57-1.19-1.57-.97-.66.08-.65.08-.65 1.07.08 1.64 1.1 1.64 1.1.96 1.64 2.5 1.17 3.11.89.1-.69.37-1.17.68-1.44-2.38-.27-4.88-1.19-4.88-5.29 0-1.17.42-2.13 1.1-2.88-.11-.27-.48-1.36.1-2.83 0 0 .9-.29 2.94 1.1a10.2 10.2 0 0 1 5.36 0c2.04-1.39 2.94-1.1 2.94-1.1.58 1.47.21 2.56.1 2.83.69.75 1.1 1.71 1.1 2.88 0 4.11-2.5 5.02-4.89 5.28.38.33.72.98.72 1.98v2.93c0 .28.19.62.74.51A10.7 10.7 0 0 0 12 1.3z',
    }),
  ],
  linkedin: () => [
    svg('path', {
      fill: 'currentColor',
      d: 'M4.6 3a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM3.1 8.1h3v12.8h-3zM9.1 8.1h2.9v1.75h.04c.4-.76 1.4-1.56 2.87-1.56 3.07 0 3.64 2.02 3.64 4.65v7.96h-3v-7.06c0-1.68-.03-3.85-2.35-3.85-2.35 0-2.71 1.83-2.71 3.72v7.19h-3z',
    }),
  ],
  chart: () => [
    svg('path', { ...stroke, d: 'M4 20V9M9.7 20V4M15.3 20v-8M21 20V7' }),
  ],
  window: () => [
    svg('rect', { ...stroke, x: 2.8, y: 4.5, width: 18.4, height: 15, rx: 2.2 }),
    svg('path', { ...stroke, d: 'M2.8 8.6h18.4' }),
    svg('circle', { fill: 'currentColor', cx: 5.6, cy: 6.5, r: 0.8 }),
    svg('circle', { fill: 'currentColor', cx: 8, cy: 6.5, r: 0.8 }),
  ],
  play: () => [
    svg('circle', { ...stroke, cx: 12, cy: 12, r: 8.8 }),
    svg('path', { ...stroke, d: 'M10 8.4l5.4 3.6L10 15.6z' }),
  ],
  info: () => [
    svg('circle', { ...stroke, cx: 12, cy: 12, r: 8.8 }),
    svg('path', { ...stroke, d: 'M12 11v5.5' }),
    svg('circle', { fill: 'currentColor', cx: 12, cy: 7.9, r: 1.05 }),
  ],
  search: () => [
    svg('circle', { ...stroke, cx: 10.8, cy: 10.8, r: 6.6 }),
    svg('path', { ...stroke, d: 'M15.7 15.7L21 21' }),
  ],
  wifi: () => [
    svg('path', { ...stroke, d: 'M2.6 9.2a14 14 0 0 1 18.8 0' }),
    svg('path', { ...stroke, d: 'M5.9 12.7a9.4 9.4 0 0 1 12.2 0' }),
    svg('path', { ...stroke, d: 'M9.2 16.2a4.6 4.6 0 0 1 5.6 0' }),
    svg('circle', { fill: 'currentColor', cx: 12, cy: 19.3, r: 1.15 }),
  ],
  battery: () => [
    svg('rect', { ...stroke, x: 2.2, y: 7.5, width: 17, height: 9, rx: 2.4 }),
    svg('rect', { fill: 'currentColor', x: 4, y: 9.3, width: 11.5, height: 5.4, rx: 1.2 }),
    svg('path', { ...stroke, d: 'M21.4 10.6v2.8' }),
  ],
};

/**
 * Build an icon.
 * @param {string} name  a key of SHAPES
 * @param {number} size  pixel box (viewBox is always 24)
 */
export function icon(name, size = 20) {
  const shape = SHAPES[name] || SHAPES.document;
  return svg('svg', {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    'aria-hidden': 'true',
    focusable: 'false',
  }, shape());
}

export const iconNames = Object.keys(SHAPES);

/* ================================================================
   OBJECT ICONS — the desktop launchers

   The line icons above are right for menus and the dock, where an
   icon is a label. They were wrong for the desktop, and so was what
   replaced them first: a grid of glossy gradient squares is an
   app-store shelf, and it dates the moment the trend moves on.

   These are objects instead. Each launcher is a thing that could sit
   on a desk — a stack of books, a small CRT, a folded paper crane —
   drawn as flat shapes in two or three tones with a contact shadow,
   and placed directly on the wallpaper with no tile around it.

   They are bespoke rather than fashionable, which is the only
   reliable way for an icon set not to look dated in two years. They
   are also the objects that will be sitting on the desk in the 3D
   room, so the desktop and the room share one vocabulary.

   Drawn in a 64x64 box (the line icons use 24x24), because objects
   need the extra room for detail that still reads at 44px.
================================================================ */

const PAPER = '#FBF6EA', PAPER_SHADE = '#E5D8BE', PAPER_EDGE = 'rgba(150,128,96,.34)';
const INK = 'rgba(120,104,78,.45)';

const OBJECTS = {
  /* ---- About Me: the kitsune ---- */
  kitsune: () => [
    svg('ellipse', { cx: 32, cy: 57, rx: 17, ry: 3, fill: 'rgba(70,52,44,.16)' }),
    // tail, behind
    svg('path', { d: 'M44 48c10-1 16-8 15-17-1-6-5-9-8-8 3 3 4 7 2 11-2 4-6 6-11 6z', fill: '#E8A46A' }),
    svg('path', { d: 'M51 23c3-1 7 2 8 8 .4 3 0 6-1 8 .6-7-2-13-7-13z', fill: '#FBF2E4' }),
    // body
    svg('path', { d: 'M32 30c8 0 14 6 14 14v6a3 3 0 0 1-3 3H21a3 3 0 0 1-3-3v-6c0-8 6-14 14-14z', fill: '#EE9F5E' }),
    svg('path', { d: 'M32 38c4 0 7 3 7 7v6H25v-6c0-4 3-7 7-7z', fill: '#FDF4E6' }),
    // ears
    svg('path', { d: 'M18 20l3 10-8-3z', fill: '#EE9F5E' }),
    svg('path', { d: 'M46 20l-3 10 8-3z', fill: '#EE9F5E' }),
    svg('path', { d: 'M18.8 23l1.6 5-4-1.6z', fill: '#F2B7C2' }),
    svg('path', { d: 'M45.2 23l-1.6 5 4-1.6z', fill: '#F2B7C2' }),
    // head
    svg('ellipse', { cx: 32, cy: 27, rx: 14, ry: 12, fill: '#F3A868' }),
    svg('path', { d: 'M32 21c5 0 9 3.5 9 8 0 3.4-4 6-9 6s-9-2.6-9-6c0-4.5 4-8 9-8z', fill: '#FDF4E6' }),
    // face
    svg('circle', { cx: 26.5, cy: 25.5, r: 1.9, fill: '#2A2438' }),
    svg('circle', { cx: 37.5, cy: 25.5, r: 1.9, fill: '#2A2438' }),
    svg('circle', { cx: 27.1, cy: 24.8, r: .6, fill: '#fff' }),
    svg('circle', { cx: 38.1, cy: 24.8, r: .6, fill: '#fff' }),
    svg('path', { d: 'M32 29.4l-1.6-1.4h3.2z', fill: '#2A2438' }),
    svg('circle', { cx: 21.5, cy: 29.5, r: 2.4, fill: 'rgba(240,150,160,.45)' }),
    svg('circle', { cx: 42.5, cy: 29.5, r: 2.4, fill: 'rgba(240,150,160,.45)' }),
  ],

  /* ---- Projects: a stack of books ---- */
  books: () => [
    svg('ellipse', { cx: 32, cy: 56, rx: 20, ry: 3.2, fill: 'rgba(70,52,44,.17)' }),
    svg('path', { d: 'M13 44h30a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H13z', fill: '#7FA9D4' }),
    svg('path', { d: 'M13 44h30a3 3 0 0 1 3 3v1.4H13z', fill: '#A8C8E8' }),
    svg('rect', { x: 13, y: 44, width: 4.2, height: 11, fill: 'rgba(0,0,0,.13)' }),
    svg('path', { d: 'M16 33h30a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H16z', fill: '#D98F62' }),
    svg('path', { d: 'M16 33h30a3 3 0 0 1 3 3v1.4H16z', fill: '#F0C8A0' }),
    svg('rect', { x: 16, y: 33, width: 4.2, height: 12, fill: 'rgba(0,0,0,.13)' }),
    svg('path', { d: 'M12 22h29a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H12z', fill: '#8FBA92' }),
    svg('path', { d: 'M12 22h29a3 3 0 0 1 3 3v1.4H12z', fill: '#B8D4B8' }),
    svg('rect', { x: 12, y: 22, width: 4.2, height: 12, fill: 'rgba(0,0,0,.13)' }),
    // a bookmark ribbon
    svg('path', { d: 'M36 22v8l-2.2-2-2.2 2v-8z', fill: '#E07A6A' }),
  ],

  /* ---- Terminal: a small CRT ---- */
  crt: () => [
    svg('ellipse', { cx: 32, cy: 57, rx: 17, ry: 3, fill: 'rgba(70,52,44,.17)' }),
    svg('rect', { x: 25, y: 45, width: 14, height: 7, rx: 1.6, fill: '#C9BBA4' }),
    svg('rect', { x: 18, y: 50, width: 28, height: 4.4, rx: 2.2, fill: '#E0D3BC' }),
    svg('rect', { x: 7, y: 12, width: 50, height: 36, rx: 5.5, fill: '#EDE2CC' }),
    svg('rect', { x: 7, y: 12, width: 50, height: 36, rx: 5.5, fill: 'none', stroke: PAPER_EDGE, 'stroke-width': 1.3 }),
    svg('rect', { x: 11.5, y: 16.5, width: 41, height: 25, rx: 3.2, fill: '#22304E' }),
    svg('path', { d: 'M17.5 24.5l4.8 4-4.8 4', fill: 'none', stroke: '#7FE3A8', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    svg('rect', { x: 26, y: 30.2, width: 11, height: 2.6, rx: 1.3, fill: '#7FE3A8' }),
    svg('path', { d: 'M11.5 16.5h41v8H11.5z', fill: 'rgba(255,255,255,.06)' }),
    svg('circle', { cx: 51, cy: 44.6, r: 1.2, fill: '#8FBA92' }),
  ],

  /* ---- Résumé: a sheet with a wax seal ---- */
  letter: () => [
    svg('ellipse', { cx: 32, cy: 56, rx: 16, ry: 2.8, fill: 'rgba(70,52,44,.15)' }),
    svg('path', { d: 'M15 9h24l10 10v33a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3z', fill: PAPER }),
    svg('path', { d: 'M39 9l10 10H41a2 2 0 0 1-2-2z', fill: PAPER_SHADE }),
    svg('path', { d: 'M15 9h24l10 10v33a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3z', fill: 'none', stroke: PAPER_EDGE, 'stroke-width': 1.3 }),
    svg('path', { d: 'M21 26h16M21 31h20M21 36h20M21 41h11', stroke: INK, 'stroke-width': 1.7, 'stroke-linecap': 'round' }),
    svg('circle', { cx: 41, cy: 45, r: 6.4, fill: '#D9705E' }),
    svg('circle', { cx: 41, cy: 45, r: 6.4, fill: 'none', stroke: 'rgba(150,60,50,.35)', 'stroke-width': 1 }),
    svg('path', { d: 'M41 41.4c1.4 1.4 1.4 2.8 0 3.6 1.4-.8 2.8-.8 3.6.6-1.4-.6-2.6 0-2.6 1.8-.8-1.4-2.2-1.4-3.6-.6 1.4-1 1.4-2.4-.6-3.4 1.4.4 2.4 0 3.2-2z', fill: 'rgba(255,255,255,.5)' }),
  ],

  /* ---- Skills: a potted plant ---- */
  plant: () => [
    svg('ellipse', { cx: 32, cy: 57, rx: 15, ry: 2.8, fill: 'rgba(70,52,44,.17)' }),
    // five leaves, alternating tone so the foliage reads as layered
    svg('path', { d: 'M32 39c-2-10-8-14-15-14 1 9 6 14 15 14z', fill: '#8FBA92' }),
    svg('path', { d: 'M32 39c2-10 8-14 15-14-1 9-6 14-15 14z', fill: '#B8D4B8' }),
    svg('path', { d: 'M32 38c-4-8-3-15 1-20 4 6 4 13-1 20z', fill: '#A3C9A6' }),
    svg('path', { d: 'M32 39c-5-5-10-6-15-4 4 5 9 6 15 4z', fill: '#7FAE86' }),
    svg('path', { d: 'M32 39c5-5 10-6 15-4-4 5-9 6-15 4z', fill: '#9FC6A3' }),
    svg('path', { d: 'M32 41V28', stroke: '#6E9A74', 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    // pot
    svg('path', { d: 'M21 41h22l-2.6 12.6a3 3 0 0 1-3 2.4H26.6a3 3 0 0 1-3-2.4z', fill: '#D08A62' }),
    svg('path', { d: 'M19.6 37.4h24.8a1.7 1.7 0 0 1 1.7 1.7v1.4a1.7 1.7 0 0 1-1.7 1.7H19.6a1.7 1.7 0 0 1-1.7-1.7v-1.4a1.7 1.7 0 0 1 1.7-1.7z', fill: '#E0A17A' }),
    svg('path', { d: 'M25.4 45l-1 8', stroke: 'rgba(255,255,255,.3)', 'stroke-width': 2, 'stroke-linecap': 'round' }),
  ],

  /* ---- Demos: a little projector throwing a beam ---- */
  projector: () => [
    svg('ellipse', { cx: 32, cy: 57, rx: 19, ry: 3, fill: 'rgba(70,52,44,.17)' }),
    // the beam, thrown up and to the right, behind the body
    svg('path', { d: 'M46 30l16-9v22z', fill: 'rgba(255,214,140,.38)' }),
    svg('path', { d: 'M46 30l16-9v10z', fill: 'rgba(255,229,178,.42)' }),
    // feed and take-up reels
    svg('circle', { cx: 23, cy: 19, r: 8.2, fill: '#8FB6C9' }),
    svg('circle', { cx: 23, cy: 19, r: 8.2, fill: 'none', stroke: 'rgba(60,90,105,.35)', 'stroke-width': 1.1 }),
    svg('circle', { cx: 23, cy: 19, r: 2.4, fill: '#EDE2CC' }),
    svg('circle', { cx: 39, cy: 22, r: 5.8, fill: '#A8C8D8' }),
    svg('circle', { cx: 39, cy: 22, r: 5.8, fill: 'none', stroke: 'rgba(60,90,105,.3)', 'stroke-width': 1 }),
    svg('circle', { cx: 39, cy: 22, r: 1.8, fill: '#EDE2CC' }),
    // body
    svg('path', { d: 'M12 32h34a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V35a3 3 0 0 1 3-3z', fill: '#EDE2CC' }),
    svg('path', { d: 'M12 32h34a3 3 0 0 1 3 3v2.2H9V35a3 3 0 0 1 3-3z', fill: '#FBF6EA' }),
    svg('path', { d: 'M12 32h34a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V35a3 3 0 0 1 3-3z', fill: 'none', stroke: PAPER_EDGE, 'stroke-width': 1.2 }),
    // lens barrel
    svg('rect', { x: 45, y: 36, width: 8.5, height: 9, rx: 2.2, fill: '#C9BBA4' }),
    svg('circle', { cx: 53, cy: 40.5, r: 4.2, fill: '#FFE7B4' }),
    svg('circle', { cx: 53, cy: 40.5, r: 4.2, fill: 'none', stroke: 'rgba(150,128,96,.4)', 'stroke-width': 1 }),
    svg('circle', { cx: 51.6, cy: 39.2, r: 1.2, fill: 'rgba(255,255,255,.75)' }),
    // vents and a switch, so it reads as a machine
    svg('path', { d: 'M15 41h10M15 45h10', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    svg('circle', { cx: 33, cy: 43.5, r: 2.6, fill: '#E07A6A' }),
    // feet
    svg('rect', { x: 14, y: 50, width: 5, height: 3.4, rx: 1.2, fill: '#C9BBA4' }),
    svg('rect', { x: 39, y: 50, width: 5, height: 3.4, rx: 1.2, fill: '#C9BBA4' }),
  ],

  /* ---- Contact: a paper crane ---- */
  crane: () => [
    svg('ellipse', { cx: 32, cy: 55, rx: 14, ry: 2.6, fill: 'rgba(70,52,44,.15)' }),
    // tail, up and to the right
    svg('path', { d: 'M34 34l20-20-4 12 4 1-19 8z', fill: PAPER_SHADE }),
    svg('path', { d: 'M34 34l20-20-4 12 4 1-19 8z', fill: 'none', stroke: PAPER_EDGE, 'stroke-width': .9 }),
    // far wing, sweeping down-left
    svg('path', { d: 'M32 35L9 22l14 23z', fill: PAPER_SHADE }),
    svg('path', { d: 'M32 35L9 22l14 23z', fill: 'none', stroke: PAPER_EDGE, 'stroke-width': .9 }),
    // neck and head, up to the left, with a beak
    svg('path', { d: 'M31 34L16 9l6 1 9 20z', fill: PAPER }),
    svg('path', { d: 'M16 9l-7 1.5 6.5 4z', fill: PAPER_SHADE }),
    svg('path', { d: 'M31 34L16 9l6 1 9 20z', fill: 'none', stroke: PAPER_EDGE, 'stroke-width': .9 }),
    // body
    svg('path', { d: 'M26 33h13l-6 17z', fill: PAPER_SHADE }),
    // near wing, sweeping down-right, the brightest plane
    svg('path', { d: 'M33 34l22-9-9 23z', fill: PAPER }),
    svg('path', { d: 'M33 34l22-9-9 23z', fill: 'none', stroke: PAPER_EDGE, 'stroke-width': .9 }),
    // the fold that makes it read as folded paper
    svg('path', { d: 'M33 34l6 6', stroke: PAPER_EDGE, 'stroke-width': .9 }),
  ],

};


/**
 * A desktop launcher object. Falls back to the line icon so a new
 * app without an illustration still gets something sensible.
 */
export function objectIcon(name, size = 72) {
  const shape = OBJECTS[name];
  if (!shape) return icon(name, Math.round(size * 0.55));
  return svg('svg', {
    viewBox: '0 0 64 64',
    width: size,
    height: size,
    'aria-hidden': 'true',
    focusable: 'false',
  }, shape());
}

export const objectNames = Object.keys(OBJECTS);
