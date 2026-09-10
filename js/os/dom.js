/* ================================================================
   DOM.JS — Element construction helpers

   The OS builds a lot of DOM. Doing it with document.createElement
   by hand is verbose; doing it with innerHTML is how you end up
   with an XSS hole and a CSP violation. These helpers are the
   middle path: terse to write, and text always goes in as a text
   node.

     el('div.window', { role: 'dialog' }, [
       el('header.window__bar', {}, [ el('span', {}, 'Projects') ]),
     ])

   The tag string supports CSS-ish shorthand: 'div.a.b#id'.
================================================================ */

const TAG_PATTERN = /^([a-z0-9-]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/i;

/**
 * @param {string} spec      tag with optional #id and .classes
 * @param {object} props     attributes, plus on* handlers and style
 * @param {any}    children  string | Node | array of either
 */
export function el(spec, props = {}, children = []) {
  const match = TAG_PATTERN.exec(spec);
  if (!match) throw new Error(`[dom] bad element spec: "${spec}"`);

  const [, tag = 'div', id, classes] = match;
  const node = document.createElement(tag);

  if (id) node.id = id.slice(1);
  if (classes) node.className = classes.slice(1).split('.').join(' ');

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'style' && typeof value === 'object') {
      // Written through CSSOM, which CSP permits — unlike a style attribute.
      for (const [property, v] of Object.entries(value)) {
        node.style.setProperty(property, v);
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key === 'text') {
      node.textContent = String(value);
    } else if (key in node && key !== 'list' && typeof value !== 'object') {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }

  append(node, children);
  return node;
}

export function append(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** SVG needs createElementNS; same shorthand, different namespace. */
export function svg(spec, props = {}, children = []) {
  const NS = 'http://www.w3.org/2000/svg';
  const match = TAG_PATTERN.exec(spec);
  const [, tag = 'svg', id, classes] = match;
  const node = document.createElementNS(NS, tag);

  if (id) node.setAttribute('id', id.slice(1));
  if (classes) node.setAttribute('class', classes.slice(1).split('.').join(' '));

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    node.setAttribute(key, String(value));
  }

  for (const child of Array.isArray(children) ? children : [children]) {
    if (child) node.appendChild(child);
  }
  return node;
}

/** Remove every child without touching innerHTML. */
export function clear(node) {
  node.replaceChildren();
  return node;
}

/** Clamp a number, used constantly by the window manager. */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
