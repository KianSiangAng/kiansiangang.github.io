/* ================================================================
   PANELS.JS — The richer app window contents

   Simple apps lift their markup straight out of the document (see
   registry.js). These four build their own UI because they are
   interactive rather than editorial:

     projects      a Finder-style folder, list/grid, opens details
     settings      world, colour scheme, motion, audio, shell mode
     achievements  progress against the twelve unlockables
     help          the keyboard map
================================================================ */

import { el, clear } from '../dom.js';
import { icon, objectIcon } from '../icons.js';
import {
  projects, identity, skills, experience, education, achievements,
} from '../../data/portfolio.js';
import { demoForProject } from '../../data/demos.js';


/* ----------------------------------------------------------------
   Welcome

   The first-run problem with any desktop metaphor is that a visitor
   arrives to a wallpaper and a row of icons with no idea which one
   matters. Real operating systems answer this with a welcome
   screen, so this one does too: a short greeting and three large,
   obvious places to start.

   It opens once, remembers that it has, and is closed like any
   other window. It is not a modal and never blocks anything.
---------------------------------------------------------------- */

export function buildWelcome({ onOpen, onDismiss }) {
  function action(title, description, appId, objectName) {
    return el('button.welcome__action', {
      type: 'button',
      onclick: () => { onDismiss(); onOpen(appId); },
    }, [
      el('span.welcome__action-icon', { dataset: { app: appId } }, objectIcon(objectName, 42)),
      el('span.welcome__action-text', {}, [
        el('strong', { text: title }),
        el('span', { text: description }),
      ]),
      el('span.welcome__chevron', { text: '›', 'aria-hidden': 'true' }),
    ]);
  }

  return el('div.app.app--welcome', {}, [
    el('p.welcome__greeting', { text: 'Hi, I\u2019m' }),
    el('h1.welcome__name', { text: identity.name }),
    el('p.welcome__role', { text: `${identity.role} · ${identity.location}` }),
    el('p.welcome__blurb', {
      text: 'This portfolio is a small operating system. Open a window, drag it '
        + 'around, and have a look at whatever you like \u2014 or start here:',
    }),

    el('div.welcome__actions', {}, [
      action('See my projects', 'Three things I have built', 'projects', 'books'),
      action('Open the terminal', 'It is a real shell, not a screenshot', 'terminal', 'crt'),
      action('Read my résumé', 'The one-page version', 'resume', 'letter'),
    ]),

    /* Straight to a reply, without opening anything. Someone who has
       already decided they want to get in touch should not have to
       navigate a desktop metaphor to do it. Real links, not buttons:
       they are navigations, so they should be middle-clickable,
       copyable and openable in a new tab like any other link. */
    el('div.welcome__contact', {}, [
      el('span.welcome__contact-label', { text: 'Or get in touch:' }),
      el('div.welcome__contact-row', {}, [
        el('a.welcome__contact-btn', {
          href: `mailto:${identity.email}`,
          'aria-label': `Email ${identity.name}`,
        }, [icon('mail', 16), el('span', { text: 'Email' })]),
        el('a.welcome__contact-btn', {
          href: identity.linkedin,
          target: '_blank',
          rel: 'noopener noreferrer',
          'aria-label': 'LinkedIn profile (opens in a new tab)',
        }, [icon('linkedin', 16), el('span', { text: 'LinkedIn' })]),
        el('a.welcome__contact-btn', {
          href: identity.github,
          target: '_blank',
          rel: 'noopener noreferrer',
          'aria-label': 'GitHub profile (opens in a new tab)',
        }, [icon('github', 16), el('span', { text: 'GitHub' })]),
      ]),
    ]),

    el('button.welcome__dismiss', {
      type: 'button',
      text: 'I\u2019ll explore on my own',
      onclick: () => onDismiss(true),
    }),
  ]);
}

/* ----------------------------------------------------------------
   Projects — a folder
---------------------------------------------------------------- */

export function buildProjects({ onOpenProject }) {
  const body = el('div.app.app--finder');

  const toolbar = el('div.finder__toolbar', {}, [
    el('span.finder__path', {}, [icon('folder', 14), el('span', { text: ' /home/kian/projects' })]),
    el('div.finder__views'),
  ]);

  const grid = el('ul.finder__grid', { role: 'list' });

  function render(view) {
    clear(grid);
    grid.className = `finder__grid finder__grid--${view}`;

    for (const project of projects) {
      const item = el('li.finder__item', { role: 'listitem' }, [
        el('button.finder__button', {
          type: 'button',
          onclick: () => onOpenProject(project),
          'aria-label': `Open ${project.title}`,
        }, [
          el('span.finder__icon', {}, icon(project.slug === 'this-portfolio' ? 'window' : 'lock', 30)),
          el('span.finder__meta', {}, [
            el('span.finder__name', { text: project.title }),
            el('span.finder__badge', { text: project.badge }),
            view === 'list' ? el('span.finder__summary', { text: project.summary }) : null,
          ]),
        ]),
      ]);
      grid.appendChild(item);
    }
  }

  for (const view of ['grid', 'list']) {
    toolbar.querySelector('.finder__views').appendChild(
      el('button.finder__view', {
        type: 'button',
        text: view,
        dataset: { view },
        onclick: (event) => {
          for (const button of toolbar.querySelectorAll('.finder__view')) {
            button.classList.toggle('is-active', button === event.currentTarget);
          }
          render(view);
        },
      }),
    );
  }
  toolbar.querySelector('.finder__view').classList.add('is-active');

  render('grid');
  body.append(toolbar, grid, el('footer.finder__status', { text: `${projects.length} items` }));
  return body;
}

/** One project, opened from the folder. */
export function buildProject(project, { onOpenDemo = null } = {}) {
  const demo = demoForProject(project.slug);

  return el('article.app.app--project', {}, [
    el('header.project__head', {}, [
      el('h1.project__title', { text: project.title }),
      el('span.project__badge', { text: project.badge }),
    ]),
    el('p.project__summary', { text: project.summary }),

    /* A description of a tool is an assertion. The demo is the
       evidence, so it gets the prominent button and the GitHub
       link goes below it. */
    demo && onOpenDemo
      ? el('button.project__demo', {
          type: 'button',
          onclick: () => onOpenDemo(demo.slug),
        }, [
          icon('play', 16),
          el('span', { text: demo.kind === 'live' ? 'Try it running' : 'Watch it run' }),
        ])
      : null,
    project.threatModel
      ? el('section.project__note', {}, [
          el('h2', { text: 'Threat modelling' }),
          el('p', { text: project.threatModel }),
        ])
      : null,
    el('section.project__stack', {}, [
      el('h2', { text: 'Stack' }),
      el('ul.project__tags', {}, project.tags.map((tag) => el('li.tag', { text: tag }))),
    ]),
    el('a.project__link', {
      href: project.url,
      target: '_blank',
      rel: 'noopener noreferrer',
    }, [icon('github', 16), el('span', { text: 'View on GitHub' })]),
  ]);
}

/* ----------------------------------------------------------------
   Résumé — built from the data model, with the real PDF attached

   This used to end in a "Print / Save as PDF" button wired to
   window.print(). It produced an empty document, and it was never
   going to produce a good one: printing from here prints whatever
   the print stylesheet makes of a windowed desktop, which is a
   fight not worth having and a worse artefact than the résumé that
   already exists.

   So the button is a download of the authored PDF instead. That
   file is the thing recruiters actually receive, it is typeset the
   way he wants it, and it cannot silently diverge from the layout
   a print dialog happens to produce. This view stays as the
   readable, linkable, screen-reader-friendly version of the same
   facts.
---------------------------------------------------------------- */

export function buildResume() {
  return el('article.app.app--resume', {}, [
    el('header.resume__head', {}, [
      el('h1', { text: identity.name }),
      el('p.resume__role', { text: `${identity.role} · ${identity.location}` }),
      el('p.resume__contact', { text: `${identity.email} · ${identity.github}` }),
      el('a.resume__download', {
        href: identity.resume,
        download: '',
        /* Not target=_blank: a download is not a navigation, and a
           blank tab that immediately closes itself is worse than no
           tab at all. */
      }, [icon('document', 16), el('span', { text: 'Download the PDF' })]),
    ]),

    el('section', {}, [
      el('h2.resume__heading', { text: 'Experience' }),
      ...experience.map((job) =>
        el('div.resume__entry', {}, [
          el('h3', { text: `${job.title} — ${job.org}` }),
          el('p.resume__period', { text: `${job.period} · ${job.location}` }),
          el('p', { text: job.summary }),
          job.points?.length
            ? el('ul.resume__points', {}, job.points.map((point) => el('li', { text: point })))
            : null,
          job.tools?.length ? el('p.resume__tools', { text: job.tools.join(' · ') }) : null,
        ]),
      ),
    ]),

    el('section', {}, [
      el('h2.resume__heading', { text: 'Education' }),
      ...education.map((entry) =>
        el('div.resume__entry', {}, [
          el('h3', { text: entry.qualification }),
          el('p.resume__period', { text: `${entry.school} · ${entry.period}` }),
          entry.detail ? el('p', { text: entry.detail }) : null,
          entry.points?.length
            ? el('ul.resume__points', {}, entry.points.map((point) => el('li', { text: point })))
            : null,
        ]),
      ),
    ]),

    el('section', {}, [
      el('h2.resume__heading', { text: 'Skills' }),
      ...Object.entries(skills).map(([category, items]) =>
        el('div.resume__entry', {}, [
          el('h3', { text: category.replace(/-/g, ' ') }),
          el('p', { text: items.join(', ') }),
        ]),
      ),
    ]),

    achievements.length
      ? el('section', {}, [
          el('h2.resume__heading', { text: 'Achievements' }),
          el('ul.resume__points', {}, achievements.map((item) => el('li', { text: item }))),
        ])
      : null,
  ]);
}

/* ----------------------------------------------------------------
   Skills

   Deliberately NOT lifted from #skills: that section contains the
   live terminal element, and cloning it would produce a dead copy
   with an input box wired to nothing. This builds the same matrix
   from the data model and points at the real Terminal instead.
---------------------------------------------------------------- */

export function buildSkills({ onOpen }) {
  return el('div.app.app--skills', {}, [
    el('h1', { text: 'Skills' }),
    el('div.skills__grid', {}, Object.entries(skills).map(([category, items]) =>
      el('section.skills__group', {}, [
        el('h2.skills__category', { text: category.replace(/-/g, ' ') }),
        el('ul.skills__tags', {}, items.map((item) => el('li.tag', { text: item }))),
      ]),
    )),
    el('div.skills__cta', {}, [
      el('p', { text: 'The same list is in the filesystem. Open a shell and read it yourself:' }),
      el('code.skills__code', { text: 'cat skills/languages.txt' }),
      el('button.skills__button', {
        type: 'button',
        onclick: () => onOpen('terminal'),
      }, [icon('terminal', 15), el('span', { text: 'Open Terminal' })]),
    ]),
  ]);
}

/* ----------------------------------------------------------------
   Settings
---------------------------------------------------------------- */

export function buildSettings({ bus, shell, audio, scene }) {
  function row(label, description, control) {
    return el('div.settings__row', {}, [
      el('div.settings__text', {}, [
        el('span.settings__label', { text: label }),
        el('span.settings__desc', { text: description }),
      ]),
      control,
    ]);
  }

  function segmented(options, current, onChange) {
    const group = el('div.settings__segmented', { role: 'radiogroup' });
    for (const option of options) {
      group.appendChild(el('button.settings__segment', {
        type: 'button',
        role: 'radio',
        'aria-checked': String(option.value === current()),
        text: option.label,
        onclick: () => {
          onChange(option.value);
          for (const button of group.children) {
            button.setAttribute('aria-checked', String(button.textContent === option.label));
          }
        },
      }));
    }
    return group;
  }

  const body = el('div.app.app--settings', {}, [
    el('h1.settings__title', { text: 'Settings' }),

    row('Colour scheme', 'Follows your system until you choose.',
      segmented(
        [{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }],
        () => document.documentElement.dataset.theme,
        (theme) => bus.emit('theme.set', { theme }),
      )),

    row('Presentation', 'The desktop, or a conventional scrolling page.',
      segmented(
        [{ label: 'Desktop', value: 'os' }, { label: 'Plain page', value: 'page' }],
        () => shell.mode(),
        (mode) => shell.setMode(mode),
      )),

    row('Soundtrack', 'Generated live with Web Audio. Nothing is downloaded.',
      el('button.settings__toggle', {
        type: 'button',
        text: audio?.isOn() ? 'On' : 'Off',
        'aria-pressed': String(Boolean(audio?.isOn())),
        onclick: (event) => {
          bus.emit('audio.request', { mode: 'toggle' });
          setTimeout(() => {
            const on = Boolean(audio?.isOn());
            event.currentTarget.textContent = on ? 'On' : 'Off';
            event.currentTarget.setAttribute('aria-pressed', String(on));
          }, 60);
        },
      })),

    row('Renderer', `Backend in use: ${scene?.backend?.() || 'unknown'}`,
      el('button.settings__toggle', {
        type: 'button',
        text: 'Show HUD',
        onclick: () => bus.emit('hud.toggle'),
      })),

    el('div.settings__danger', {}, [
      el('p.settings__desc', {
        text: 'Everything this site remembers lives in localStorage on this device: theme, world, window positions, icon layout and achievements. Nothing leaves the browser.',
      }),
      el('button.settings__reset', {
        type: 'button',
        text: 'Forget everything and reload',
        onclick: () => {
          try {
            for (const key of Object.keys(localStorage)) {
              if (key.startsWith('portfolio:') || key === 'theme') localStorage.removeItem(key);
            }
          } catch { /* best effort */ }
          location.reload();
        },
      }),
    ]),
  ]);

  return body;
}

/* ----------------------------------------------------------------
   Achievements
---------------------------------------------------------------- */

export function buildAchievements({ achievements }) {
  const list = el('ul.achv-list', { role: 'list' });
  const { count, total } = achievements.progress();

  const header = el('header.achv-head', {}, [
    el('h1', { text: 'Achievements' }),
    el('p.achv-progress', { text: `${count} of ${total} found` }),
    el('div.achv-bar', {}, [
      el('span.achv-bar__fill', { style: { width: `${(count / total) * 100}%` } }),
    ]),
  ]);

  for (const entry of achievements.list()) {
    list.appendChild(el('li.achv-item', { dataset: { unlocked: String(entry.unlocked) } }, [
      el('span.achv-item__star', { text: entry.unlocked ? '★' : '☆' }),
      el('div', {}, [
        el('span.achv-item__name', { text: entry.unlocked ? entry.name : 'Locked' }),
        el('span.achv-item__hint', { text: entry.hint }),
      ]),
    ]));
  }

  return el('div.app.app--achievements', {}, [header, list]);
}

/* ----------------------------------------------------------------
   Help
---------------------------------------------------------------- */

export function buildHelp() {
  const shortcuts = [
    ['⌘K / Ctrl-K', 'Command palette'],
    ['/', 'Command palette'],
    ['`', 'Performance HUD'],
    ['Esc', 'Close the focused window'],
    ['Ctrl-Tab', 'Cycle windows'],
    ['Double-click title bar', 'Zoom a window'],
    ['Drag to a screen edge', 'Snap left, right or full'],
    ['Arrow keys on the desktop', 'Move between icons'],
    ['Enter on an icon', 'Open it'],
    ['⌥D', 'Toggle dark mode'],
    ['Type "sakura"', 'A storm of blossom'],
    ['↑↑↓↓←→←→BA', 'You know what this does'],
    ['kian.help() in devtools', 'A console API onto the runtime'],
  ];

  return el('div.app.app--help', {}, [
    el('h1', { text: 'Keyboard & shortcuts' }),
    el('dl.help__list', {}, shortcuts.flatMap(([keys, description]) => [
      el('dt', {}, [el('kbd', { text: keys })]),
      el('dd', { text: description }),
    ])),
    el('h2', { text: 'The terminal is real' }),
    el('p', {
      text: 'It parses quotes, pipes and globs, completes with Tab and walks history with the arrow keys. '
        + 'Try: ls -la · cat resume.txt | grep -i risk · tree · nmap · neofetch · sudo. There is a flag hidden somewhere.',
    }),
  ]);
}
