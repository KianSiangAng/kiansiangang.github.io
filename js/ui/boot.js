/* ================================================================
   BOOT.JS — POST screen

   A short BIOS-style boot sequence on a visitor's first arrival,
   showing the actual module boot report rather than fake text: if
   WebGL failed, the boot screen says so.

   Rules it obeys, so it stays a flourish and not an obstacle:
     - first visit only (a localStorage flag), or ?boot=1
     - never with prefers-reduced-motion
     - skippable with any key, click or scroll
     - hard-capped duration; it removes itself no matter what
     - aria-hidden throughout, and the page underneath is fully
       rendered the whole time — this is a curtain, not a loader
================================================================ */

const STORAGE_KEY = 'portfolio:booted';
const MAX_DURATION = 3600;

export function shouldBoot(reducedMotion) {
  if (reducedMotion) return false;
  const params = new URLSearchParams(location.search);
  if (params.get('boot') === '1') return true;
  if (params.get('boot') === '0') return false;
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

export function createBootScreen({ bus }) {
  const overlay = document.createElement('div');
  overlay.className = 'boot';
  overlay.setAttribute('aria-hidden', 'true');

  const screen = document.createElement('pre');
  screen.className = 'boot__screen';
  overlay.appendChild(screen);

  const skip = document.createElement('p');
  skip.className = 'boot__skip';
  skip.textContent = 'press any key to skip';
  overlay.appendChild(skip);

  let finished = false;
  let timers = [];

  function line(text) {
    screen.append(document.createTextNode(text + '\n'));
    screen.scrollTop = screen.scrollHeight;
  }

  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    timers = [];
    overlay.classList.add('is-done');
    document.documentElement.classList.remove('is-booting');
    setTimeout(() => overlay.remove(), 650);
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* ignore */ }
    window.removeEventListener('keydown', finish);
    window.removeEventListener('pointerdown', finish);
    window.removeEventListener('wheel', finish);
    bus.emit('boot.finished');
  }

  function run(report) {
    document.documentElement.classList.add('is-booting');
    document.body.appendChild(overlay);

    const modules = Object.entries(report || {});
    const script = [
      'PortfolioOS BIOS v2.0.0 — kiansiangang.github.io',
      'Copyright (C) 2026 Ang Kian Siang. All rights reserved.',
      '',
      'Detecting hardware ................ OK',
      `Display ........................... ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
      `Colour scheme ..................... ${document.documentElement.dataset.theme || 'light'}`,
      '',
      'Loading kernel modules:',
      ...modules.map(([name, state]) => {
        const dots = '.'.repeat(Math.max(2, 26 - name.length));
        const label = state === 'ready' ? '[  OK  ]' : state === 'failed' ? '[ FAIL ]' : '[ SKIP ]';
        return `  ${name} ${dots} ${label}`;
      }),
      '',
      'Mounting /home/kian ............... OK',
      'Starting shell (ksh) .............. OK',
      '',
      'Welcome. Type `help` in the terminal, or press ⌘K anywhere.',
    ];

    const interval = Math.min(70, MAX_DURATION / (script.length + 4));
    script.forEach((text, index) => {
      timers.push(setTimeout(() => line(text), index * interval));
    });
    timers.push(setTimeout(finish, Math.min(script.length * interval + 550, MAX_DURATION)));

    window.addEventListener('keydown', finish);
    window.addEventListener('pointerdown', finish);
    window.addEventListener('wheel', finish, { passive: true });
  }

  return { run, finish };
}
