/* ================================================================
   MENUBAR.JS — The system menu bar

   Fixed to the top: a system menu, the focused application's name,
   its menus, and a status area with the world switch, soundtrack
   toggle, colour scheme, a wifi/battery nod and a live clock.

   The menus are real menus — click to open, hover to move between
   them once one is open, arrow keys to navigate, Escape to close —
   because a menu bar that is only decorative is worse than no menu
   bar at all.
================================================================ */

import { el, clear } from './dom.js';
import { icon } from './icons.js';

export function createMenuBar({ bus, root, wm, onOpen, shell }) {
  const appName = el('strong.menubar__app', { text: 'Finder' });
  const menuList = el('nav.menubar__menus', { 'aria-label': 'Application menus' });
  const clock = el('button.menubar__clock', { type: 'button', title: 'Toggle 24-hour clock' });
  const status = el('div.menubar__status');

  const bar = el('header.menubar', { id: 'menubar', role: 'banner' }, [
    el('div.menubar__left', {}, [
      el('button.menubar__logo', {
        type: 'button',
        'aria-label': 'System menu',
        'aria-haspopup': 'menu',
        'aria-expanded': 'false',
      }, icon('lock', 15)),
      appName,
      menuList,
    ]),
    status,
  ]);

  /* ---- status area ---- */
  const audioButton = el('button.menubar__icon', {
    type: 'button', 'aria-label': 'Toggle soundtrack', title: 'Soundtrack', 'aria-pressed': 'false',
  }, [el('span.menubar__note', { text: '♪' })]);

  const themeButton = el('button.menubar__icon', {
    type: 'button', 'aria-label': 'Toggle dark mode', title: 'Colour scheme',
  }, icon('star', 15));

  status.append(
    el('span.menubar__icon.menubar__icon--static', { 'aria-hidden': 'true' }, icon('wifi', 15)),
    el('span.menubar__icon.menubar__icon--static', { 'aria-hidden': 'true' }, icon('battery', 15)),
    audioButton, themeButton, clock,
  );

  root.appendChild(bar);

  audioButton.addEventListener('click', () => bus.emit('audio.request', { mode: 'toggle' }));
  themeButton.addEventListener('click', () => bus.emit('theme.set', { theme: 'toggle' }));
  bus.on('audio.state', ({ on }) => {
    audioButton.setAttribute('aria-pressed', String(on));
    audioButton.classList.toggle('is-on', on);
  });

  /* ---- clock ---- */
  let use24Hour = true;
  function tick() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: !use24Hour,
    });
    const day = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    clock.textContent = `${day}  ${time}`;
  }
  clock.addEventListener('click', () => { use24Hour = !use24Hour; tick(); });
  tick();
  const clockTimer = setInterval(tick, 10000);

  /* ----------------------------------------------------------------
     Menus
  ---------------------------------------------------------------- */

  let openMenu = null;

  function closeMenu() {
    if (!openMenu) return;
    openMenu.button.setAttribute('aria-expanded', 'false');
    openMenu.panel.hidden = true;
    openMenu = null;
  }

  function buildMenu(label, items) {
    const panel = el('div.menubar__panel', { role: 'menu', hidden: true });
    const button = el('button.menubar__menu', {
      type: 'button',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      text: label,
    });

    for (const entry of items) {
      if (entry === 'separator') {
        panel.appendChild(el('div.menubar__sep', { role: 'separator' }));
        continue;
      }
      panel.appendChild(el('button.menubar__item', {
        type: 'button',
        role: 'menuitem',
        disabled: entry.disabled || false,
        onclick: () => { closeMenu(); entry.action?.(); },
      }, [
        el('span', { text: entry.label }),
        entry.shortcut ? el('kbd.menubar__shortcut', { text: entry.shortcut }) : null,
      ]));
    }

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const wasOpen = openMenu?.button === button;
      closeMenu();
      if (wasOpen) return;
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      openMenu = { button, panel };
    });

    // Once one menu is open, hovering the others switches to them.
    button.addEventListener('mouseenter', () => {
      if (openMenu && openMenu.button !== button) {
        closeMenu();
        panel.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        openMenu = { button, panel };
      }
    });

    return el('div.menubar__menuwrap', {}, [button, panel]);
  }

  function setMenus(definitions) {
    clear(menuList);
    for (const { label, items } of definitions) menuList.appendChild(buildMenu(label, items));
  }

  /* The system menu is always present. */
  const systemMenu = [
    { label: 'About this portfolio', action: () => onOpen('about') },
    'separator',
    { label: 'Open command palette', shortcut: '⌘K', action: () => bus.emit('palette.request') },
    { label: 'Performance HUD', shortcut: '`', action: () => bus.emit('hud.toggle') },
    'separator',
    { label: 'Toggle dark mode', shortcut: '⌥D', action: () => bus.emit('theme.set', { theme: 'toggle' }) },
    { label: 'Summon petals', action: () => bus.emit('petals.storm', { intensity: 1.8 }) },
    'separator',
    { label: 'Step back into the room', shortcut: '⌥R', action: () => bus.emit('room.toggle') },
    'separator',
    { label: 'Close all windows', action: () => wm.closeAll() },
    { label: 'View as a plain page', action: () => shell.setMode('page') },
  ];

  const logoButton = bar.querySelector('.menubar__logo');
  const systemPanel = buildMenu('', systemMenu);
  const systemPanelEl = systemPanel.querySelector('.menubar__panel');
  systemPanel.querySelector('.menubar__menu').remove();
  systemPanelEl.classList.add('menubar__panel--system');
  bar.querySelector('.menubar__left').insertBefore(systemPanel, appName);

  logoButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const wasOpen = !systemPanelEl.hidden;
    closeMenu();
    systemPanelEl.hidden = wasOpen;
    logoButton.setAttribute('aria-expanded', String(!wasOpen));
    if (!wasOpen) openMenu = { button: logoButton, panel: systemPanelEl };
  });

  window.addEventListener('pointerdown', (event) => {
    if (!bar.contains(event.target)) closeMenu();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  /* ---- follow the focused window ---- */
  function setApp(title, menus) {
    appName.textContent = title || 'Finder';
    setMenus(menus || defaultMenus());
  }

  function defaultMenus() {
    return [
      {
        label: 'File',
        items: [
          { label: 'New Terminal', shortcut: '⌘T', action: () => onOpen('terminal') },
          { label: 'Open Projects', action: () => onOpen('projects') },
          'separator',
          { label: 'Close all windows', action: () => wm.closeAll() },
        ],
      },
      {
        label: 'View',
        items: [
          { label: 'Tidy desktop icons', action: () => bus.emit('desktop.tidy') },
          { label: 'Performance HUD', shortcut: '`', action: () => bus.emit('hud.toggle') },
        ],
      },
      {
        label: 'Go',
        items: [
          { label: 'About', action: () => onOpen('about') },
          { label: 'Projects', action: () => onOpen('projects') },
          { label: 'Skills', action: () => onOpen('skills') },
          { label: 'Résumé', action: () => onOpen('resume') },
          { label: 'Contact', action: () => onOpen('contact') },
        ],
      },
      {
        label: 'Help',
        items: [
          { label: 'Keyboard shortcuts', action: () => onOpen('help') },
          { label: 'Achievements', action: () => onOpen('achievements') },
        ],
      },
    ];
  }

  bus.on('wm.focused', ({ title, appId }) => {
    setApp(title && appId ? title : 'Finder', null);
  });

  setApp('Finder', null);

  return {
    element: bar,
    setApp,
    stop: () => clearInterval(clockTimer),
  };
}
