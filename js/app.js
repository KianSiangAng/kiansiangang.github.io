/* ================================================================
   APP.JS — Composition root

   Nothing in this file *does* anything: it registers services in
   the container, declares modules and their dependencies, and
   hands the whole thing to the kernel to boot in the right order.
   Every behaviour lives in its own module; this is the wiring
   diagram.

   Boot order is derived, not written down — the kernel topologically
   sorts the module graph, so adding a module means declaring what
   it needs, not finding the right line to insert it on.
================================================================ */

import { createEventBus } from './core/bus.js';
import { createContainer } from './core/di.js';
import { createKernel } from './core/kernel.js';
import { createStore, loggerMiddleware, persistMiddleware, loadPersisted } from './core/store.js';
import { createLogger, setLogLevel, drainLog } from './core/logger.js';

import { createScene } from './gfx/scene.js';
import { createAudioEngine } from './audio/synth.js';
import { createDuality } from './theme/duality.js';

import { createVFS } from './term/vfs.js';
import { createShell } from './term/shell.js';
import { createCommands } from './term/commands.js';
import { createTerminalUI } from './term/term-ui.js';

import { createPalette } from './ui/palette.js';
import { createHUD } from './ui/hud.js';
import { createCursor } from './ui/cursor.js';
import { createTilt } from './ui/tilt.js';
import { createAchievements } from './ui/achievements.js';
import { createSequences } from './ui/konami.js';
import { createBootScreen, shouldBoot } from './ui/boot.js';

import { createShell as createOSShell } from './os/shell.js';

import { identity } from './data/portfolio.js';

const log = createLogger('app');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ----------------------------------------------------------------
   1. Services
---------------------------------------------------------------- */

const bus = createEventBus();
const container = createContainer();

const initialState = loadPersisted('portfolio:state', {
  world: 'ghibli',
  commandsRun: 0,
  visits: 0,
});

function reducer(state, action) {
  switch (action.type) {
    case 'world/set':      return { ...state, world: action.payload };
    case 'command/ran':    return { ...state, commandsRun: state.commandsRun + 1 };
    case 'visit/count':    return { ...state, visits: state.visits + 1 };
    default:               return state;
  }
}

const store = createStore({
  reducer,
  initialState,
  middleware: [loggerMiddleware, persistMiddleware('portfolio:state')],
});

container.value('bus', bus);
container.value('store', store);
container.value('container', container);

const kernel = createKernel(container, bus);
container.value('kernel', kernel);

/* ----------------------------------------------------------------
   2. Modules
---------------------------------------------------------------- */

kernel.use({
  name: 'achievements',
  deps: ['bus'],
  setup: () => createAchievements({ bus }),
});

kernel.use({
  name: 'gfx',
  deps: ['bus'],
  setup() {
    const scene = createScene({ bus, reducedMotion });
    return { ...scene, start: scene.start, stop: scene.stop };
  },
});

kernel.use({
  name: 'audio',
  deps: ['bus'],
  setup() {
    const audio = createAudioEngine({ bus });
    bus.on('audio.request', ({ mode }) => {
      if (mode === 'on') audio.enable();
      else if (mode === 'off') audio.disable();
      else audio.toggle();
    });
    return audio;
  },
});

kernel.use({
  name: 'duality',
  deps: ['bus', 'gfx', 'audio'],
  setup: ({ container }) =>
    createDuality({
      bus,
      scene: container.resolve('gfx'),
      audio: container.resolve('audio'),
      reducedMotion,
    }),
});

kernel.use({
  name: 'shell',
  deps: ['bus'],
  setup() {
    const vfs = createVFS();
    const shell = createShell({
      vfs,
      services: { bus, store, kernel, container },
    });
    for (const command of createCommands()) shell.register(command);
    return shell;
  },
});

kernel.use({
  name: 'terminal',
  deps: ['shell', 'bus'],
  enabled: () => Boolean(document.querySelector('.terminal')),
  setup({ container }) {
    const ui = createTerminalUI({
      shell: container.resolve('shell'),
      bus,
      root: document.querySelector('.terminal'),
    });

    bus.on('term.command', () => {
      store.dispatch({ type: 'command/ran' });
      bus.emit('achievement.unlock', { id: 'terminal' });
    });

    // Reading the hidden flag is its own achievement.
    bus.on('term.command', ({ command }) => {
      if (/flag\.txt/.test(command)) bus.emit('achievement.unlock', { id: 'flag' });
    });

    return ui;
  },
});

kernel.use({
  name: 'os',
  deps: ['bus', 'shell', 'terminal', 'gfx', 'audio', 'achievements'],
  setup({ container }) {
    return createOSShell({
      bus,
      services: {
        audio: container.resolve('audio'),
        scene: container.resolve('gfx'),
        achievements: container.resolve('achievements'),
        terminal: container.has('terminal') ? container.resolve('terminal') : null,
        reducedMotion,
      },
    });
  },
});

kernel.use({
  name: 'hud',
  deps: ['bus'],
  setup: () => createHUD({ bus, kernel }),
});

kernel.use({
  name: 'palette',
  deps: ['bus', 'shell'],
  setup({ container }) {
    const shell = container.resolve('shell');
    const palette = createPalette({ bus, actions: () => buildActions(container, palette) });

    /* Global hotkeys. Bound on the document so they work anywhere
       except inside a text field, where they would be hostile. */
    window.addEventListener('keydown', (event) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        palette.toggle();
      } else if (event.key === '/' && !typing) {
        event.preventDefault();
        palette.open();
      } else if (event.key === '`' && !typing) {
        event.preventDefault();
        bus.emit('hud.toggle');
      }
    });

    bus.on('palette.request', () => palette.open());

    return palette;
  },
});

kernel.use({
  name: 'cursor',
  deps: [],
  setup: () => createCursor({ reducedMotion }),
});

kernel.use({
  name: 'tilt',
  deps: [],
  setup: () => createTilt({ reducedMotion }),
});

kernel.use({
  name: 'sequences',
  deps: ['bus'],
  setup: () => createSequences({ bus }),
});

kernel.use({
  name: 'pwa',
  deps: ['bus'],
  enabled: () => 'serviceWorker' in navigator && location.protocol !== 'file:',
  setup() {
    return {
      async start() {
        try {
          const registration = await navigator.serviceWorker.register('sw.js');
          log.info('service worker registered', registration.scope);
          bus.emit('pwa.ready', { scope: registration.scope });
        } catch (err) {
          log.warn('service worker registration failed', err);
        }
      },
    };
  },
});

/* Small page-level behaviours that do not deserve their own file. */
kernel.use({
  name: 'page',
  deps: ['bus'],
  setup() {
    /* World toggle button in the navbar. */
    const toggle = document.getElementById('world-toggle');
    toggle?.addEventListener('click', () => bus.emit('world.request', { world: 'toggle' }));

    bus.on('world.changed', ({ world }) => {
      store.dispatch({ type: 'world/set', payload: world });
      if (toggle) {
        toggle.setAttribute('aria-pressed', String(world === 'hacker'));
        toggle.setAttribute(
          'aria-label',
          world === 'hacker' ? 'Switch to the Ghibli world' : 'Switch to the hacker world',
        );
      }
    });

    /* Audio toggle button. */
    const audioButton = document.getElementById('audio-toggle');
    audioButton?.addEventListener('click', () => bus.emit('audio.request', { mode: 'toggle' }));
    bus.on('audio.state', ({ on }) => {
      audioButton?.classList.toggle('is-on', on);
      audioButton?.setAttribute('aria-pressed', String(on));
    });

    /* The ⌘K hint retires once the palette has been opened once. */
    const hint = document.getElementById('kbd-hint');
    if (hint) {
      const seen = (() => {
        try { return localStorage.getItem('portfolio:palette-seen') === '1'; } catch { return false; }
      })();
      if (seen) hint.classList.add('is-hidden');
      bus.on('palette.opened', () => {
        hint.classList.add('is-hidden');
        try { localStorage.setItem('portfolio:palette-seen', '1'); } catch { /* ignore */ }
      });
    }

    /* Reaching the footer means someone actually read the thing. */
    const footer = document.getElementById('footer');
    if (footer && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          bus.emit('achievement.unlock', { id: 'deep' });
          observer.disconnect();
        }
      }, { threshold: 0.4 });
      observer.observe(footer);
    }

    /* Clicking the mascot puffs petals out of it. */
    const mascot = document.getElementById('mascot');
    mascot?.addEventListener('click', () => {
      const rect = mascot.getBoundingClientRect();
      container.resolve('gfx')?.burst?.(rect.left + rect.width / 2, rect.top + rect.height / 2, 14);
    });

    store.dispatch({ type: 'visit/count' });
    return {};
  },
});

/* ----------------------------------------------------------------
   3. Palette actions — assembled from every other module
---------------------------------------------------------------- */

function buildActions(container, palette) {
  const shell = container.resolve('shell');
  const terminal = container.has('terminal') ? container.resolve('terminal') : null;
  const audio = container.resolve('audio');
  const achievements = container.resolve('achievements');

  const goto = (id) => () => {
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  const runInTerminal = (command) => async () => {
    document.getElementById('skills')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    await new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : 600));
    terminal?.demo(command, 35);
  };

  const actions = [
    { title: 'Go to About',    group: 'Navigate', icon: '§', run: goto('about'),    keywords: ['bio', 'me'] },
    { title: 'Go to Projects', group: 'Navigate', icon: '§', run: goto('projects'), keywords: ['work', 'repos'] },
    { title: 'Go to Skills',   group: 'Navigate', icon: '§', run: goto('skills'),   keywords: ['terminal', 'stack'] },
    { title: 'Go to Contact',  group: 'Navigate', icon: '§', run: goto('contact'),  keywords: ['email', 'hire'] },

    {
      title: 'Switch world (Ghibli ⇄ Hacker)',
      group: 'World',
      icon: '◐',
      hint: 'or type: hack',
      keywords: ['theme', 'matrix', 'green', 'sakura'],
      run: () => bus.emit('world.request', { world: 'toggle' }),
    },
    {
      title: 'Toggle dark mode',
      group: 'World',
      icon: '☾',
      keywords: ['light', 'night', 'colour scheme'],
      run: () => bus.emit('theme.set', { theme: 'toggle' }),
    },
    {
      title: () => (audio.isOn() ? 'Turn the soundtrack off' : 'Turn the soundtrack on'),
      group: 'World',
      icon: '♪',
      keywords: ['audio', 'music', 'sound', 'synth'],
      run: () => bus.emit('audio.request', { mode: 'toggle' }),
    },
    {
      title: 'Toggle performance HUD',
      group: 'System',
      icon: '▤',
      hint: '`',
      keywords: ['fps', 'debug', 'stats'],
      run: () => bus.emit('hud.toggle'),
    },
    {
      title: 'Show achievements',
      group: 'System',
      icon: '★',
      keywords: ['progress', 'easter eggs', 'secrets'],
      run: () => {
        const { count, total } = achievements.progress();
        const lines = achievements
          .list()
          .map((a) => `  ${a.unlocked ? '\x1b[32m★\x1b[0m' : '\x1b[2m☆\x1b[0m'} ${a.unlocked ? a.name : '\x1b[2m' + a.hint + '\x1b[0m'}`)
          .join('\n');
        terminal?.write(`\x1b[1mAchievements\x1b[0m ${count}/${total}\n${lines}`);
        document.getElementById('skills')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      },
    },

    { title: 'Email me',           group: 'Contact', icon: '✉', run: () => { location.href = `mailto:${identity.email}`; } },
    { title: 'Open GitHub',        group: 'Contact', icon: '⌥', run: () => window.open(identity.github, '_blank', 'noopener,noreferrer') },
    { title: 'Open LinkedIn',      group: 'Contact', icon: '⌥', run: () => window.open(identity.linkedin, '_blank', 'noopener,noreferrer') },
  ];

  /* Desktop apps, when the OS presentation is running. */
  const os = container.has('os') ? container.resolve('os') : null;
  if (os && os.mode() === 'os') {
    for (const app of os.apps()) {
      actions.push({
        title: `Open ${app.title}`,
        group: 'Apps',
        icon: '▣',
        keywords: [app.id, app.kind || '', app.description || ''],
        run: () => os.open(app.id),
      });
    }
  }

  /* Every shell command is also a palette action — one catalogue,
     two interfaces. */
  for (const command of shell.catalogue()) {
    actions.push({
      title: `${command.name} — ${command.summary}`,
      group: 'Terminal',
      icon: '›',
      keywords: [command.name, 'run', 'shell', 'command'],
      run: runInTerminal(command.name),
    });
  }

  return actions.map((action) => ({
    ...action,
    title: typeof action.title === 'function' ? action.title() : action.title,
  }));
}

/* ----------------------------------------------------------------
   4. Boot
---------------------------------------------------------------- */

if (new URLSearchParams(location.search).get('debug') === '1') setLogLevel('trace');

const bootScreen = createBootScreen({ bus });

kernel
  .boot()
  .then((report) => {
    if (shouldBoot(reducedMotion)) bootScreen.run(report);

    const failed = Object.entries(report).filter(([, state]) => state === 'failed');
    if (failed.length) log.warn(`${failed.length} module(s) degraded:`, failed.map(([n]) => n).join(', '));

    /* ---- the console API, for anyone who opens devtools ---- */
    const api = {
      help() {
        bus.emit('achievement.unlock', { id: 'source' });
        console.log(
          `%c${identity.name}%c — console API\n\n` +
            '  kian.run("nmap")      run a shell command\n' +
            '  kian.world("hacker")  switch worlds\n' +
            '  kian.stats()          renderer statistics\n' +
            '  kian.modules()        kernel module report\n' +
            '  kian.log()            the boot log\n' +
            '  kian.achievements()   what you have found\n' +
            '  kian.state()          the store\n',
          'font-weight:700;font-size:14px',
          'color:#888',
        );
        return '☺';
      },
      run: (command) => container.resolve('shell').run(command).then((r) => r.output.replace(/\x1b\[[0-9;]*m/g, '')),
      world: (world) => bus.emit('world.request', { world: world || 'toggle' }),
      theme: (theme) => bus.emit('theme.set', { theme: theme || 'toggle' }),
      stats: () => container.resolve('gfx').stats(),
      modules: () => kernel.report(),
      deps: () => container.graph(),
      log: () => drainLog(),
      achievements: () => container.resolve('achievements').list(),
      state: () => store.getState(),
      bus,
    };
    Object.defineProperty(window, 'kian', { value: Object.freeze(api), writable: false });

    console.log(
      `%c${identity.name}%c\n${identity.role} · ${identity.location}\n\n` +
        `This site is hand-written vanilla JavaScript: no framework, no build step,\n` +
        `no dependencies. ${kernel.modules().length} modules booted in dependency order.\n\n` +
        `Type %ckian.help()%c for the console API, or press ⌘K on the page.`,
      'font-weight:700;font-size:18px;color:#2E4070',
      'color:inherit',
      'font-family:monospace;background:#eee;padding:1px 4px;border-radius:3px',
      'color:inherit',
    );
  })
  .catch((err) => {
    log.error('boot failed', err);
  });
