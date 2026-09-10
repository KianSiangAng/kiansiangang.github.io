/* ================================================================
   REGISTRY.JS — What the desktop can open

   One declarative table. Each app says how it looks on the desktop
   and in the dock, what size its window wants to be, and how to
   build its contents.

   Content strategy matters here. The editorial apps do not
   duplicate their copy — they LIFT it out of the document that is
   already in index.html. That document stays the single source of
   truth, so it remains crawlable, readable with JavaScript off,
   and identical to what the plain-page presentation shows. The
   desktop is a different *view* of the same content, not a fork
   of it.

   The Terminal is the exception: it does not clone, it adopts.
   The live shell element is moved into the window, because two
   copies of a terminal wired to one shell would be a mess.
================================================================ */

import { el } from './dom.js';
import { identity } from '../data/portfolio.js';
import {
  buildProjects, buildProject, buildResume, buildSkills,
  buildSettings, buildAchievements, buildHelp,
} from './apps/panels.js';

/**
 * Clone a section of the document for display in a window.
 * IDs are stripped: a cloned id would be a duplicate, which breaks
 * label associations and anchor links.
 */
function lift(selector) {
  const source = document.querySelector(selector);
  if (!source) return el('p.app__missing', { text: 'This content could not be found.' });

  const clone = source.cloneNode(true);
  clone.removeAttribute('id');
  for (const node of clone.querySelectorAll('[id]')) node.removeAttribute('id');

  // These classes exist to hide content until a scroll observer
  // reveals it. Inside a window there is no scroll to observe.
  for (const node of clone.querySelectorAll('.fade-in')) node.classList.add('visible');
  clone.classList.add('app__lifted');
  return clone;
}

/** Move a live element into the window, remembering where it came from. */
function adopt(selector) {
  const node = document.querySelector(selector);
  if (!node) return { node: el('p.app__missing', { text: 'Not available.' }), restore() {} };

  const placeholder = document.createComment('adopted');
  node.parentNode?.insertBefore(placeholder, node);

  return {
    node,
    restore() {
      placeholder.parentNode?.insertBefore(node, placeholder);
      placeholder.remove();
    },
  };
}

export function createRegistry({ bus, wm, shell, services, onOpen }) {
  const { audio, scene, achievements } = services;

  /** Open one project in its own window, from the folder. */
  function openProject(project) {
    wm.open(`project-${project.slug}`, {
      title: project.title,
      icon: 'lock',
      width: 560,
      height: 460,
      minWidth: 340,
      content: buildProject(project),
    });
  }

  const apps = [
    {
      id: 'about',
      title: 'About Me',
      icon: 'person',
      kind: 'app',
      pinned: true,
      description: 'Who I am and what I have done',
      window: { width: 760, height: 520 },
      build: () => lift('#about .container'),
    },
    {
      id: 'projects',
      title: 'Projects',
      icon: 'folder',
      kind: 'folder',
      pinned: true,
      description: 'A folder of things I have built',
      window: { width: 700, height: 470 },
      build: () => buildProjects({ onOpenProject: openProject }),
    },
    {
      id: 'terminal',
      title: 'Terminal',
      icon: 'terminal',
      kind: 'app',
      pinned: true,
      description: 'A real shell — try `help`',
      window: { width: 720, height: 460, minWidth: 420, minHeight: 260 },
      build(win) {
        const adopted = adopt('.terminal');
        win.onClose = () => adopted.restore();
        // The terminal fills its window rather than sitting in the flow.
        adopted.node.classList.add('terminal--windowed');
        setTimeout(() => services.terminal?.focus(), 80);
        return adopted.node;
      },
    },
    {
      id: 'resume',
      title: 'Résumé',
      icon: 'document',
      kind: 'file',
      pinned: true,
      description: 'The one-page version',
      window: { width: 620, height: 560 },
      build: () => buildResume(),
    },
    {
      id: 'skills',
      title: 'Skills',
      icon: 'chart',
      kind: 'app',
      description: 'Languages, tools and concepts',
      window: { width: 640, height: 440 },
      build: () => buildSkills({ onOpen }),
    },
    {
      id: 'contact',
      title: 'Contact',
      icon: 'mail',
      kind: 'app',
      pinned: true,
      description: 'Email, GitHub, LinkedIn',
      window: { width: 560, height: 380 },
      build: () => lift('#contact .container'),
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'gear',
      kind: 'app',
      description: 'World, colour scheme, audio, presentation',
      window: { width: 560, height: 520 },
      build: () => buildSettings({ bus, shell, audio, scene }),
    },
    {
      id: 'achievements',
      title: 'Achievements',
      icon: 'star',
      kind: 'app',
      description: 'Twelve things to find',
      window: { width: 480, height: 520 },
      build: () => buildAchievements({ achievements }),
    },
    {
      id: 'help',
      title: 'Help',
      icon: 'info',
      kind: 'app',
      description: 'Keyboard shortcuts and hints',
      window: { width: 520, height: 480 },
      build: () => buildHelp(),
    },
    {
      id: 'readme',
      title: 'README.md',
      icon: 'document',
      kind: 'file',
      description: 'Why this site is like this',
      window: { width: 620, height: 500 },
      build: () => el('div.app.app--readme', {}, [
        el('h1', { text: 'README.md' }),
        el('p', {
          text: 'This is a portfolio pretending to be a desktop operating system, '
            + 'running on a hand-written module kernel, a signals reactivity core and a '
            + 'WebGL renderer. None of that is necessary. All of it was the point.',
        }),
        el('h2', { text: 'What is actually real here' }),
        el('ul', {}, [
          el('li', { text: 'The terminal parses and executes commands against an in-memory filesystem.' }),
          el('li', { text: 'The window manager does drag, resize, snap, focus stacks and persistence.' }),
          el('li', { text: 'The background is a live GLSL shader, not a video or a GIF.' }),
          el('li', { text: 'The soundtrack is synthesised in the browser. There are no audio files.' }),
          el('li', { text: 'Every window is real DOM: selectable, keyboard-navigable, screen-reader-readable.' }),
        ]),
        el('h2', { text: 'What it costs' }),
        el('p', {
          text: 'Nothing you cannot opt out of. Reduced motion stops the animation, '
            + 'phones get a conventional scrolling site, and with JavaScript disabled '
            + 'the whole portfolio is still there as plain semantic HTML.',
        }),
        el('h2', { text: 'Contact' }),
        el('p', { text: `${identity.email} · ${identity.github}` }),
      ]),
    },
    {
      id: 'github',
      title: 'GitHub',
      icon: 'github',
      kind: 'link',
      url: identity.github,
      description: 'My repositories',
      external: identity.github,
    },
    {
      id: 'linkedin',
      title: 'LinkedIn',
      icon: 'linkedin',
      kind: 'link',
      url: identity.linkedin,
      description: 'Professional profile',
      external: identity.linkedin,
    },
    {
      id: 'trash',
      title: 'Trash',
      icon: 'trash',
      kind: 'system',
      description: 'Ideas that did not survive review',
      window: { width: 480, height: 320 },
      build: () => el('div.app.app--trash', {}, [
        el('h1', { text: 'Trash' }),
        el('p', { text: 'Things considered for this site and deliberately thrown away:' }),
        el('ul', {}, [
          el('li', { text: 'An auto-playing background video (weight, autoplay policy, and rude).' }),
          el('li', { text: 'A cookie banner (there are no cookies, so there is nothing to consent to).' }),
          el('li', { text: 'Third-party analytics (nothing here needs to know who you are).' }),
          el('li', { text: 'A CDN for the JavaScript (a supply chain I do not control).' }),
          el('li', { text: 'A password strength checker as a web app — see the Password Analyzer.' }),
        ]),
        el('p.app__aside', { text: 'Emptying the trash is not implemented. The decisions stand.' }),
      ]),
    },
  ];

  const byId = new Map(apps.map((app) => [app.id, app]));

  return {
    apps,
    get: (id) => byId.get(id),
    openProject,
    /** Everything the desktop should show as an icon. */
    desktopIcons: () => apps.filter((app) => app.kind !== 'hidden'),
  };
}
