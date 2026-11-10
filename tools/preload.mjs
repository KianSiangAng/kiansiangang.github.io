#!/usr/bin/env node
/* ================================================================
   PRELOAD.MJS — Flatten the module waterfall

   The site has no bundler, so the browser discovers its fifty-odd
   ES modules the slow way: fetch app.js, parse it, find its imports,
   fetch those, parse them, find theirs — one round trip per level
   of the dependency tree before anything can run.

   <link rel="modulepreload"> tells the browser about the whole graph
   up front, so every file is requested in the first round trip. That
   is most of what a bundler buys, without becoming a build step: the
   output is committed, and this is run by hand when imports change.

     node tools/preload.mjs

   It walks STATIC imports only, starting from js/app.js. Anything
   behind a dynamic import() — the 3D room, Three.js, the demo
   players — is deliberately left out: those are exactly the files a
   phone or a plain-page visitor must not be made to download.
================================================================ */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = join(ROOT, 'js', 'app.js');
const START = '<!-- modulepreload:start -->';
const END = '<!-- modulepreload:end -->';

const seen = new Set();
const order = [];

function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  // Static forms only: `import x from '…'`, `import '…'`, `export … from '…'`.
  const pattern = /^\s*(?:import|export)\s(?:[^'"]*?\sfrom\s)?['"](\.{1,2}\/[^'"]+)['"]/gm;
  for (const match of source.matchAll(pattern)) walk(resolve(dirname(file), match[1]));
  order.push(file);
}

walk(ENTRY);

const links = order
  .filter((file) => file !== ENTRY)
  .map((file) => `    <link rel="modulepreload" href="${relative(ROOT, file).replace(/\\/g, '/')}" />`)
  .join('\n');

const htmlPath = join(ROOT, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const a = html.indexOf(START);
const b = html.indexOf(END);
if (a === -1 || b === -1) {
  console.error(`index.html is missing the ${START} … ${END} markers.`);
  process.exit(1);
}

writeFileSync(htmlPath, `${html.slice(0, a + START.length)}\n${links}\n    ${html.slice(b)}`);
console.log(`${order.length - 1} modules preloaded`);
