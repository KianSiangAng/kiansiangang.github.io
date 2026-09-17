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

/* Attributes whose value the browser will treat as a URL to fetch or
   navigate to. Everything this site puts in one today is a constant
   from the data model, so none of it is attacker-controlled — but
   that is a property of today's callers, not of this helper, and the
   helper is what every future caller will reach for. */
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'srcset', 'data']);

/* javascript: and vbscript: execute on click; data: and blob: in an
   href can be navigated to and launder an origin. None has a
   legitimate use here, so the helper refuses rather than trusting
   its caller. Control characters and whitespace are stripped first:
   browsers ignore them when resolving a scheme, so a tab or a NUL
   dropped inside "javascript:" defeats a naive prefix check. */
const DANGEROUS_SCHEME = /^(?:javascript|vbscript|data|blob|file):/i;
const URL_NOISE = /[\u0000-\u0020\u00a0\u1680\u2000-\u200d\u2028\u2029\u202f\u205f\u3000\ufeff]/g;

function assertSafeUrl(value, attr, tag) {
  const cleaned = String(value).replace(URL_NOISE, '');
  if (!DANGEROUS_SCHEME.test(cleaned)) return;

  /* One exception: inline images. <img src="data:image/..."> cannot
     navigate or execute, and the icon set depends on it. */
  if (attr === 'src' && tag === 'img' && /^data:image\//i.test(cleaned)) return;

  throw new Error(`[dom] refused a "${cleaned.slice(0, 24)}" URL in ${tag}[${attr}]`);
}

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

    if (URL_ATTRS.has(key.toLowerCase())) assertSafeUrl(value, key.toLowerCase(), tag);

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
