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
   APP GLYPHS — filled, two-tone, for the desktop

   The line icons above are right for menus and the dock, where an
   icon is a label. They are wrong for a desktop launcher, where an
   icon has to look like an object worth clicking: a 1.6px hairline
   on a photographic wallpaper reads as faint UI chrome.

   These are solid shapes in two tones of white, drawn to sit on a
   coloured gradient tile. The lighter tone carries the detail (a
   folder's flap, a page's folded corner), which is what gives a
   flat glyph the suggestion of depth.
================================================================ */

const SOLID = 'rgba(255,255,255,0.96)';
const SHADE = 'rgba(255,255,255,0.58)';

/* Internal detail on a mostly-white glyph has to be DARKER, not
   lighter. A lighter-white fold on a pale tile disappears entirely,
   which turned the Contact envelope into a plain white rectangle. */
const DETAIL = 'rgba(46, 46, 58, 0.20)';

const APP_SHAPES = {
  person: () => [
    svg('circle', { fill: SOLID, cx: 12, cy: 8.4, r: 3.9 }),
    svg('path', {
      fill: SHADE,
      d: 'M12 13.4c-4.3 0-7.8 2.9-7.8 6.6 0 .6.5 1.1 1.1 1.1h13.4c.6 0 1.1-.5 1.1-1.1 0-3.7-3.5-6.6-7.8-6.6z',
    }),
  ],

  folder: () => [
    svg('path', {
      fill: SHADE,
      d: 'M2.8 7c0-1.1.9-2 2-2h4.3l2.2 2.6h7.9c1.1 0 2 .9 2 2v2.1H2.8z',
    }),
    svg('path', {
      fill: SOLID,
      d: 'M2.4 10.2h19.2l-1.4 8.4c-.15 1-1 1.7-2 1.7H5.8c-1 0-1.85-.7-2-1.7z',
    }),
    svg('path', { fill: DETAIL, d: 'M2.4 10.2h19.2l-.16 1H2.56z' }),
  ],

  terminal: () => [
    svg('rect', { fill: SHADE, x: 2.4, y: 4.2, width: 19.2, height: 15.6, rx: 2.8 }),
    svg('path', {
      fill: 'none', stroke: SOLID, 'stroke-width': 2.1,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      d: 'M6.9 9.9l3.1 2.6-3.1 2.6',
    }),
    svg('path', {
      fill: 'none', stroke: SOLID, 'stroke-width': 2.1, 'stroke-linecap': 'round',
      d: 'M12.9 15.4h4.4',
    }),
  ],

  document: () => [
    svg('path', {
      fill: SOLID,
      d: 'M6.2 2.6h6.5l5.3 5.3v12.1c0 1-.8 1.8-1.8 1.8H6.2c-1 0-1.8-.8-1.8-1.8V4.4c0-1 .8-1.8 1.8-1.8z',
    }),
    svg('path', { fill: SHADE, d: 'M12.7 2.6l5.3 5.3h-4.3c-.55 0-1-.45-1-1z' }),
    svg('path', {
      fill: 'none', stroke: 'rgba(120,110,90,0.55)', 'stroke-width': 1.5, 'stroke-linecap': 'round',
      d: 'M7.6 12.4h7.6M7.6 15.4h7.6M7.6 9.4h3.4',
    }),
  ],

  mail: () => [
    svg('rect', { fill: SOLID, x: 2.3, y: 5, width: 19.4, height: 14, rx: 2.6 }),
    svg('path', { fill: DETAIL, d: 'M3.4 6.5h17.2L12 13.2z' }),
    svg('path', {
      fill: 'none', stroke: DETAIL, 'stroke-width': 1.4, 'stroke-linecap': 'round',
      d: 'M3.6 17.6l5.6-4.7M20.4 17.6l-5.6-4.7',
    }),
  ],

  chart: () => [
    svg('rect', { fill: SHADE, x: 3.4, y: 12.6, width: 3.6, height: 7.8, rx: 1.3 }),
    svg('rect', { fill: SOLID, x: 8.9, y: 6.4, width: 3.6, height: 14, rx: 1.3 }),
    svg('rect', { fill: SHADE, x: 14.4, y: 9.8, width: 3.6, height: 10.6, rx: 1.3 }),
    svg('circle', { fill: SOLID, cx: 19.6, cy: 5.2, r: 2 }),
  ],
};

/**
 * A filled desktop-launcher glyph. Falls back to the line icon for
 * anything without a solid design.
 */
export function appGlyph(name, size = 34) {
  const shape = APP_SHAPES[name];
  if (!shape) return icon(name, size);
  return svg('svg', {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    'aria-hidden': 'true',
    focusable: 'false',
  }, shape());
}

