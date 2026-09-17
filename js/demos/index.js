/* ================================================================
   INDEX.JS — One demo surface, two presentations

   The desktop opens this in a window; the plain page mounts it in a
   section. Both get the same thing, because a demo that only exists
   in the 3D-room-and-windows version of the site is a demo half the
   visitors never see — and phones get the plain page.

   The dispatcher is the only place that knows kind -> player, and
   every player returns the same small interface:

     { node, play, pause, isPlaying, destroy }

   so this file never needs to care which kind it is showing. Adding
   a filmed demo later touches demos.js and nothing else.

   Players are built lazily, one at a time, and the previous one is
   destroyed on switch. An embedded iframe and a running animation
   are not things to leave lying around in the background.
================================================================ */

import { el, clear } from '../os/dom.js';
import { icon, objectIcon } from '../os/icons.js';
import { demos, demoBySlug } from '../data/demos.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('demos');

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/* The players are dynamically imported so that a visitor who never
   opens a demo never downloads a terminal emulator. */
async function playerFor(demo, options) {
  switch (demo.kind) {
    case 'cast': {
      const { createCastPlayer, loadCast } = await import('./cast.js');
      const cast = await loadCast(demo.src);
      return createCastPlayer({ ...cast, title: cast.title || demo.title }, options);
    }
    case 'live': {
      const { createLiveDemo } = await import('./live.js');
      return createLiveDemo(demo, options);
    }
    case 'video': {
      const { createVideoDemo } = await import('./media.js');
      return createVideoDemo(demo, options);
    }
    case 'walkthrough': {
      const { createWalkthroughDemo } = await import('./media.js');
      return createWalkthroughDemo(demo, options);
    }
    default:
      throw new Error(`unknown demo kind "${demo.kind}"`);
  }
}

/* ----------------------------------------------------------------
   Provenance line

   A vendored copy of someone else's tool should say out loud which
   commit it is, or it is just a fork quietly rotting.
---------------------------------------------------------------- */

async function provenanceLine(demo, into) {
  if (!demo.provenance) return;
  try {
    const { loadProvenance } = await import('./live.js');
    const meta = await loadProvenance(demo.provenance);
    if (!meta) return;
    clear(into).append(
      el('span', { text: 'Running commit ' }),
      el('a.demo__commit', {
        href: `${demo.upstream}/commit/${meta.commit}`,
        target: '_blank',
        rel: 'noopener noreferrer',
        text: meta.commit.slice(0, 8),
      }),
      el('span', { text: ` — “${meta.commitSubject}”, ${meta.commitDate}. Vendored ${meta.vendored}.` }),
    );
  } catch (err) {
    log.warn('provenance unavailable', err);
  }
}

/* ----------------------------------------------------------------
   The panel
---------------------------------------------------------------- */

export function buildDemos({ initial = null, onOpenProject = null } = {}) {
  const reducedMotion = prefersReducedMotion();
  let active = null;      // the live player instance
  let activeSlug = null;

  const stage = el('div.demo__stage', { 'aria-live': 'polite' });
  const meta = el('div.demo__meta');
  const tabs = el('div.demo__tabs', { role: 'tablist', 'aria-label': 'Project demos' });

  const tabButtons = new Map();

  function setPending(demo) {
    clear(stage).appendChild(el('div.demo__pending', {}, [
      el('span.demo__spinner', { 'aria-hidden': 'true' }),
      el('p', { text: `Loading the ${demo.title} demo…` }),
    ]));
  }

  function setFailed(demo, err) {
    clear(stage).appendChild(el('div.demo__failed', {}, [
      el('p', { text: 'This demo could not load.' }),
      el('p.demo__failed-detail', { text: String(err?.message || err) }),
      demo.upstream || demo.url
        ? el('a.demo__link', {
            href: demo.upstream || demo.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            text: 'Open the project on GitHub instead',
          })
        : null,
    ]));
  }

  function renderMeta(demo) {
    const provenance = el('p.demo__provenance');
    clear(meta).append(
      el('header.demo__head', {}, [
        el('h2.demo__title', { text: demo.title }),
        el('p.demo__subtitle', { text: demo.subtitle }),
      ]),
      el('p.demo__blurb', { text: demo.blurb }),
      demo.takeaway
        ? el('aside.demo__takeaway', {}, [
            el('h3', { text: 'What this shows' }),
            el('p', { text: demo.takeaway }),
          ])
        : null,
      demo.notes?.length
        ? el('ul.demo__notes', {}, demo.notes.map((note) => el('li', { text: note })))
        : null,
      provenance,
      el('div.demo__links', {}, [
        onOpenProject && demo.project
          ? el('button.demo__link', {
              type: 'button',
              onclick: () => onOpenProject(demo.project),
              text: 'Project details',
            })
          : null,
        demo.upstream
          ? el('a.demo__link', {
              href: demo.upstream,
              target: '_blank',
              rel: 'noopener noreferrer',
            }, [icon('github', 15), el('span', { text: 'Source' })])
          : null,
      ]),
    );
    provenanceLine(demo, provenance);
  }

  async function select(slug) {
    const demo = demoBySlug.get(slug);
    if (!demo || slug === activeSlug) return;

    activeSlug = slug;
    for (const [id, button] of tabButtons) {
      const on = id === slug;
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    }

    active?.destroy();
    active = null;
    renderMeta(demo);
    setPending(demo);

    try {
      const player = await playerFor(demo, { reducedMotion });
      // Another tab may have been chosen while this was loading.
      if (activeSlug !== slug) { player.destroy(); return; }
      active = player;
      clear(stage).appendChild(player.node);
    } catch (err) {
      log.warn(`demo "${slug}" failed`, err);
      if (activeSlug === slug) setFailed(demo, err);
    }
  }

  for (const demo of demos) {
    const button = el('button.demo__tab', {
      type: 'button',
      role: 'tab',
      'aria-selected': 'false',
      tabIndex: -1,
      onclick: () => select(demo.slug),
      onkeydown(e) {
        const order = demos.map((d) => d.slug);
        const at = order.indexOf(demo.slug);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          const next = order[(at + 1) % order.length];
          tabButtons.get(next)?.focus(); select(next); e.preventDefault();
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          const prev = order[(at - 1 + order.length) % order.length];
          tabButtons.get(prev)?.focus(); select(prev); e.preventDefault();
        }
      },
    }, [
      el('span.demo__tab-icon', {}, objectIcon(demo.icon, 34)),
      el('span.demo__tab-text', {}, [
        el('strong', { text: demo.title }),
        el('span', { text: KIND_LABEL[demo.kind] || demo.kind }),
      ]),
    ]);
    tabButtons.set(demo.slug, button);
    tabs.appendChild(button);
  }

  const node = el('section.app.app--demos', {}, [
    el('p.demos__intro', {
      text: 'Claims about software are cheap. These run.',
    }),
    tabs,
    meta,
    stage,
  ]);

  select(initial && demoBySlug.has(initial) ? initial : demos[0].slug);

  node.destroy = () => { active?.destroy(); active = null; };
  node.selectDemo = select;
  return node;
}

const KIND_LABEL = {
  cast: 'Recorded session',
  live: 'Running live',
  video: 'Screen recording',
  walkthrough: 'Step by step',
};

/* ----------------------------------------------------------------
   Plain-page mount

   The section already contains a readable static description of
   every demo, written into index.html so it survives with
   JavaScript off. On enhancement that fallback is replaced, not
   hidden: leaving both in the document would read the whole thing
   twice to a screen reader.
---------------------------------------------------------------- */

export function mountPageDemos(root = document.getElementById('demos-mount')) {
  if (!root || root.dataset.mounted === 'true') return null;
  const panel = buildDemos({});
  root.dataset.mounted = 'true';
  clear(root).appendChild(panel);
  return panel;
}
