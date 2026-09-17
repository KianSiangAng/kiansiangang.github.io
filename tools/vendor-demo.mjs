#!/usr/bin/env node
/* ================================================================
   VENDOR-DEMO.MJS — Bring a single-file tool in-house, CSP intact

   The Calendar Exporter is one self-contained HTML file, which is
   exactly what makes it good software and exactly what makes it
   un-embeddable here: this site ships `script-src 'self'` with no
   inline allowance and no hashes, so an inline <script> inside an
   iframe is dead on arrival.

   Rather than weaken the policy for one embed, this script splits
   the file: the inline <style> and <script> move out to sibling
   files and the HTML points at them. The tool's own source is not
   otherwise touched -- no reformatting, no edits -- so a diff
   against upstream stays readable.

   It also stamps provenance. A vendored copy that cannot tell you
   which upstream commit it came from is a fork nobody admits to,
   and it goes stale silently. `demo.json` records the commit and
   the date, the demo page shows them, and re-running this script
   is the whole update procedure:

     node tools/vendor-demo.mjs <path-to-clone>

   Exit codes: 0 fine, 1 the source moved in a way this cannot
   handle -- which is a prompt to look, not to guess.
================================================================ */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(HERE, '..', 'assets', 'demos', 'suss-calendar-exporter');

const src = resolve(process.argv[2] || '/home/user/kiansiangang/suss-calendar-exporter');
const html = readFileSync(join(src, 'index.html'), 'utf8');

/* One <style>, one <script>, no inline handlers. Assert all three:
   if upstream grows a second block or an onclick, silently vendoring
   a half-working copy is worse than stopping. */
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const handlers = [...html.matchAll(/\son(?:click|input|change|submit|load)=/gi)];

const problems = [];
if (styles.length !== 1) problems.push(`expected 1 <style>, found ${styles.length}`);
if (scripts.length !== 1) problems.push(`expected 1 inline <script>, found ${scripts.length}`);
if (handlers.length) problems.push(`${handlers.length} inline event handler(s) — CSP would block these`);
if (problems.length) {
  console.error('Upstream has changed shape; not vendoring blind:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const subject = execFileSync('git', ['-C', src, 'log', '-1', '--format=%s'], { encoding: 'utf8' }).trim();
const authored = execFileSync('git', ['-C', src, 'log', '-1', '--format=%cs'], { encoding: 'utf8' }).trim();

/* The embed runs inside the portfolio, so it inherits a page that
   already set a colour scheme. Leave the tool's own styling alone
   and let it keep its identity -- it is someone else's design and
   repainting it would misrepresent the project. */
const out = html
  .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="app.css" />')
  .replace(/<script>[\s\S]*?<\/script>/, '<script src="app.js"></script>')
  .replace(/<link rel="stylesheet" href="app\.css" \/>/,
    '<link rel="stylesheet" href="app.css" />\n'
    + '  <link rel="stylesheet" href="demo-drive.css" />')
  .replace(
    /<\/head>/,
    /* The parent page's CSP does not reach into a child document, and
       GitHub Pages serves no headers at all, so the embed states its
       own policy. The tool talks to nothing and loads nothing: every
       directive below is the tightest one it can still run under. */
    `  <meta http-equiv="Content-Security-Policy" content="${[
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self'",
      /* The tool hides its own panels with style="display:none" in the
         markup, and a style ATTRIBUTE is governed by style-src-attr, not
         style-src. Without this the panels start visible and the console
         fills with violations. Allowing attributes is a far narrower
         grant than 'unsafe-inline' on style-src would be: <style>
         elements and injected sheets stay blocked. */
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'none'",
      "form-action 'none'",
      "base-uri 'none'",
      /* frame-ancestors is deliberately absent: it is ignored when
         delivered in a meta tag and only logs an error. The parent's
         frame-src 'self' is what actually decides who may frame this. */
    ].join('; ')}\" />\n`
    + `  <!-- Vendored from ${commit} for offline embedding. Do not edit here:\n`
    + `       change it upstream and re-run tools/vendor-demo.mjs. -->\n</head>`,
  );

mkdirSync(DEST, { recursive: true });
writeFileSync(join(DEST, 'index.html'), out);
writeFileSync(join(DEST, 'app.css'), styles[0][1].replace(/^\n/, ''));

/* The guided run marks up what it is doing inside the frame. Those rules
   ship as a file rather than being injected as a <style> element, because
   the policy above blocks injected sheets — correctly, and this is what
   satisfying it rather than weakening it looks like. */
writeFileSync(join(DEST, 'demo-drive.css'), `/* Written by tools/vendor-demo.mjs — not part of the upstream tool.
   Feedback for the guided demo, which drives this page from the parent. */
.demo-pressed { outline: 3px solid #7FE3A8; outline-offset: 3px; transform: translateY(1px); }
.demo-glow    { outline: 3px solid #7FE3A8; outline-offset: 4px; border-radius: 12px; }
@media (prefers-reduced-motion: reduce) { .demo-pressed { transform: none; } }
`);
writeFileSync(join(DEST, 'app.js'), scripts[0][1].replace(/^\n/, ''));
writeFileSync(join(DEST, 'demo.json'), `${JSON.stringify({
  source: 'https://github.com/KianSiangAng/suss-calendar-exporter',
  commit,
  commitSubject: subject,
  commitDate: authored,
  vendored: new Date().toISOString().slice(0, 10),
  note: 'Generated by tools/vendor-demo.mjs. Inline <style>/<script> were '
    + 'extracted so the embed satisfies this site\'s script-src \'self\' policy. '
    + 'No other changes to the tool\'s source.',
}, null, 2)}\n`);

console.log(`vendored ${commit.slice(0, 8)} (${authored}) -> assets/demos/suss-calendar-exporter/`);
