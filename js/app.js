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
import { createScheme } from './theme/scheme.js';

import { createVFS } from './term/vfs.js';
import { createShell } from './term/shell.js';
import { createCommands } from './term/commands.js';
import { createTerminalUI } from './term/term-ui.js';

import { createPalette } from './ui/palette.js';
import { createHUD } from './ui/hud.js';
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
  commandsRun: 0,
  visits: 0,
});

function reducer(state, action) {
  switch (action.type) {
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
  name: 'scheme',
  deps: ['bus', 'audio'],
  setup: ({ container }) => createScheme({ bus, audio: container.resolve('audio') }),
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

/* The room is the desktop's wallpaper, in three dimensions. It only
   boots for the OS presentation, and Three.js is pulled in with a
   dynamic import so the plain page and every phone never download it. */
kernel.use({
  name: 'room',
  deps: ['bus', 'os'],
  enabled: () => {
    if (new URLSearchParams(location.search).get('room') === '0') return false;
    const os = container.has('os') ? container.resolve('os') : null;
    return Boolean(os && os.mode() === 'os');
  },
  async setup({ container }) {
    const host = document.getElementById('os-root');
    if (!host) return null;

    let scene = null;
    try {
      const { createRoomScene } = await import('./room/room.js');
      scene = createRoomScene({ bus, desktopElement: host, reducedMotion });
    } catch (err) {
      // No WebGL, a blocked module, a driver that gives up — the flat
      // wallpaper is still there and the desktop is unaffected.
      log.warn('room unavailable, keeping the flat wallpaper', err);
      return null;
    }

    /* The flat wallpaper renderer is now redundant: its canvases are
       hidden by CSS, but a hidden full-screen fragment shader still
       costs a draw every frame. Park it. */
    container.resolve('gfx')?.stop?.();

    /* The desktop moves out of <body> and onto the screen plane. */
    document.body.appendChild(scene.canvas);
    scene.stage.querySelector('.room-stage__camera').appendChild(host);
    document.body.appendChild(scene.stage);

    const hint = document.createElement('div');
    hint.className = 'room-hint';
    hint.textContent = 'Click the screen';
    document.body.appendChild(hint);

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'room-back';
    back.textContent = 'Back to the room';
    back.addEventListener('click', () => scene.undock());
    document.body.appendChild(back);

    /* The room owns <html data-room> and the desktop's wallpaper, so
       it has to stand down completely when the visitor switches to
       the plain page — and the flat wallpaper renderer has to come
       back, since the room was the thing replacing it. */
    bus.on('shell.changed', ({ mode }) => {
      if (mode === 'page') {
        scene.suspend();
        container.resolve('gfx')?.start?.();
      } else {
        container.resolve('gfx')?.stop?.();
        scene.resume();
      }
    });

    bus.on('room.toggle', () => scene.toggle());
    bus.on('room.dock', () => scene.dock());
    bus.on('room.undock', () => scene.undock());

    window.addEventListener('keydown', (event) => {
      if (event.altKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        scene.toggle();
      }
    });

    return {
      ...scene,
      start() {
        scene.mount(document.body);

        /* First visit gets the establishing shot, then flies in on its
           own so nobody is stranded looking at a desk they did not
           know was clickable. After that, straight to the desktop:
           a cinematic you cannot skip stops being a gift. */
        let seen = true;
        try { seen = Boolean(localStorage.getItem('portfolio:room-seen')); } catch { /* ignore */ }

        if (reducedMotion || seen) {
          scene.dock();
        } else {
          /* Five seconds before the camera moves, and the flight
             itself is slower (see FLIGHT_MS in camera-rig.js). Three
             seconds still read as "the site opened mid-zoom": the
             establishing shot has to outlast the moment it takes to
             work out you are looking at a room. Clicking the screen
             still goes immediately, so the wait only applies to
             people who have not decided yet. */
          setTimeout(() => {
            if (scene.mode === 'room') scene.dock();
            try { localStorage.setItem('portfolio:room-seen', '1'); } catch { /* ignore */ }
          }, 5000);
        }
      },
      stop: scene.dispose,
    };
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
    /* A storm of petals, requested from the terminal, the Konami
       code or by typing "sakura". */
    bus.on('petals.storm', ({ intensity = 1.5 }) => {
      const scene = container.resolve('gfx');
      const count = Math.round(18 * intensity);
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          scene?.burst?.(Math.random() * window.innerWidth, -20, count);
        }, i * 220);
      }
      bus.emit('achievement.unlock', { id: 'storm' });
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
      title: 'Toggle dark mode',
      group: 'Appearance',
      icon: '☾',
      keywords: ['light', 'night', 'dark', 'colour scheme', 'theme'],
      run: () => bus.emit('theme.set', { theme: 'toggle' }),
    },
    {
      title: 'Summon a storm of petals',
      group: 'Appearance',
      icon: '❀',
      hint: 'or type: sakura',
      keywords: ['sakura', 'blossom', 'storm', 'petals', 'wind'],
      run: () => bus.emit('petals.storm', { intensity: 1.8 }),
    },
    {
      title: () => (audio.isOn() ? 'Turn the soundtrack off' : 'Turn the soundtrack on'),
      group: 'Appearance',
      icon: '♪',
      keywords: ['audio', 'music', 'sound', 'synth'],
      run: () => bus.emit('audio.request', { mode: 'toggle' }),
    },
    {
      title: 'Step back into the room',
      group: 'Appearance',
      icon: '⌂',
      hint: '⌥R',
      keywords: ['room', 'desk', '3d', 'camera', 'zoom out'],
      when: () => container.has('room'),
      run: () => bus.emit('room.toggle'),
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
            '  kian.theme("dark")    switch colour scheme\n' +
            '  kian.sakura()         a storm of petals\n' +
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
      theme: (theme) => bus.emit('theme.set', { theme: theme || 'toggle' }),
      sakura: (intensity = 1.8) => bus.emit('petals.storm', { intensity }),
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
