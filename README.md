# Ang Kian Siang — Portfolio

Personal portfolio website built with vanilla HTML, CSS and JavaScript.
No frameworks, no build tools, one runtime dependency — hand-written code
with a security-first mindset, and rather more engineering than a
portfolio strictly requires.

**Live site:** *(to be added after GitHub Pages deployment)*

---

## About

I'm an ICT undergraduate at the Singapore University of Social Sciences
(SUSS), specialising in cybersecurity. This portfolio showcases my
projects, skills and certifications — and doubles as the place I get to
build the things I find interesting.

## Two presentations

On a desktop the site boots as **an operating system**: a menu bar, desktop
icons, a dock, and draggable, resizable, snappable windows. Each section of
the portfolio is an app. On a phone — or whenever you ask for it — it is a
**conventional scrolling page**, which is also exactly what you get with
JavaScript disabled.

Both are views of the same document. The windows lift their content out of
the semantic HTML in `index.html` rather than duplicating it, so there is one
source of truth, and the portfolio stays crawlable and screen-reader-readable
in either presentation.

| | |
|---|---|
| Drag a window to a screen edge | Snap left, right or full screen |
| Double-click a title bar | Zoom |
| `Esc` | Close the focused window |
| `Ctrl-Tab` | Cycle windows |
| Right-click | Context menus on icons and the desktop |
| Drag icons | Positions snap to a grid and persist |
| `⌥D` | Toggle dark mode |
| `⌥R` | Step back into the room |
| Type `sakura` | A storm of blossom |
| `#/projects` | Every app is deep-linkable; back/forward work |

## The room

On a desktop the site opens on a cozy desk at dusk: a lamp, a mug, a stack
of books, a plant, a paper crane, and a monitor. The camera drifts with your
pointer, then flies into the screen — and the desktop takes over.

The monitor is not showing a picture of the desktop. The desktop is **live
DOM**, placed onto the screen plane with a `matrix3d` derived from the
Three.js camera every frame, so the windows on that monitor are real HTML:
selectable, focusable, screen-reader-readable and crawlable. A canvas
texture would have thrown all of that away at the last step.

The whole room is procedural — no model files, no textures to download.
Every object is assembled from boxes, cylinders, lathes and planes, which
is why the scene costs a few kilobytes of JavaScript instead of a
multi-megabyte glTF. The objects are the same ones as the desktop
launchers, so the two surfaces are one place.

Dark mode is the same room after dark: the sun goes down behind the
window, the lamp becomes the only warm light, and the monitor lights the
desk. `⌥R`, the menu bar, or the button in the corner steps back out.

Three.js is self-hosted in `/libs` and pulled in with a **dynamic import**,
so the plain page and every phone never download a byte of it.

## The desktop

Six launchers, each drawn as an object rather than an icon in a tile: a
stack of books for Projects, a small CRT for Terminal, a folded paper crane
for Contact, a potted plant for Skills, a sealed letter for Résumé, and the
kitsune for About Me. They sit directly on the wallpaper with a contact
shadow and lift when you point at them.

They are deliberately bespoke rather than fashionable — a grid of glossy
gradient squares is an app-store shelf, and it dates the moment the trend
moves on. These are also the objects that will be on the desk in the 3D
room, so the desktop and the room share one vocabulary.

Utilities and links live in the dock as quiet line glyphs. Nothing appears
on both surfaces: a desktop that mirrors its own dock is twice the clutter
and half the hierarchy.

## Tech stack

| Layer | Technology |
|-------|------------|
| Structure | HTML5 (semantic, accessible) |
| Styling | CSS3 — custom properties, Grid, mobile-first |
| Logic | Vanilla JavaScript, ES modules, no bundler |
| Graphics | WebGL2 + GLSL ES 3.0, canvas2d fallback |
| Audio | Web Audio API (generated at runtime — no audio files) |
| Offline | Service worker + web app manifest |
| Fonts | Google Fonts — Nunito (body), Space Mono (terminal) |
| 3D | [Three.js](https://threejs.org) r180, self-hosted, dynamically imported |
| Libraries | [Typed.js](https://github.com/mattboldt/typed.js) v2.0.16, self-hosted |

## Architecture

`js/app.js` is a composition root: it registers services, declares modules
and hands them to a kernel that topologically sorts the dependency graph
and boots them in order. Boot order is derived, never written down.

```
js/
├── app.js                  ← composition root: wiring, nothing else
├── core/
│   ├── signal.js           ← fine-grained reactivity (signal/computed/effect/batch)
│   ├── bus.js              ← pub/sub with wildcard topics (theme.*, gfx.**)
│   ├── store.js            ← reducer store, middleware, time travel
│   ├── di.js               ← service container, cycle detection
│   ├── kernel.js           ← module lifecycle, Kahn topological boot
│   └── logger.js           ← namespaced logging, ring buffer, perf marks
├── gfx/
│   ├── gl.js               ← WebGL2 wrapper, shader diagnostics
│   ├── shaders.js          ← GLSL: procedural fBm sky, day and night
│   ├── scene.js            ← the single rAF loop, world crossfade
│   ├── petals.js           ← particles in a curl-noise wind field
│   └── birds.js            ← boids flock (separation/alignment/cohesion)
├── term/
│   ├── vfs.js              ← in-memory filesystem built from the data model
│   ├── shell.js            ← tokeniser, pipelines, globs, completion
│   ├── commands.js         ← 33 commands
│   └── term-ui.js          ← ANSI → DOM renderer, input line
├── ui/
│   ├── palette.js          ← ⌘K command palette
│   ├── fuzzy.js            ← fzf-style subsequence scoring
│   ├── hud.js              ← FPS / frame time / module state
│   ├── tilt.js             ← 3D card tilt, gyroscope on mobile
│   ├── boot.js             ← BIOS-style POST screen
│   ├── konami.js           ← typed input sequences
│   └── achievements.js     ← 12 unlockables, persisted
├── os/
│   ├── shell.js            ← chooses the desktop or the page presentation
│   ├── wm.js               ← window manager: drag, resize, snap, focus, persist
│   ├── desktop.js          ← icons, selection, marquee, keyboard navigation
│   ├── menubar.js          ← menus, status area, clock
│   ├── dock.js             ← running and pinned apps
│   ├── router.js           ← #/app/param deep links, bidirectional
│   ├── registry.js         ← the app table; lifts content from the document
│   ├── contextmenu.js      ← right-click menus
│   ├── dom.js · icons.js   ← element helpers; line glyphs + object icons
│   └── apps/panels.js      ← Finder, résumé, settings, achievements, help
├── room/
│   ├── room.js             ← scene, lights, frame loop, dock/undock
│   ├── props.js            ← every object, built from primitives
│   ├── materials.js        ← one palette, re-lit for day or night
│   ├── camera-rig.js       ← two poses and the flight between them
│   └── screen.js           ← the DOM desktop, projected onto the monitor
├── audio/synth.js          ← Web Audio synthesiser, lookahead scheduler
├── theme/scheme.js         ← the light/dark colour scheme
└── data/portfolio.js       ← single source of truth for all content
```

## Things to try

| | |
|---|---|
| `⌘K` / `Ctrl-K` | Command palette — navigate, switch worlds, run commands |
| `/` | Also the command palette |
| `` ` `` | Performance HUD: FPS, frame time, module state, heap |
| The terminal | It is real. `help`, `ls -a`, `cat resume.txt \| grep -i risk`, `nmap`, `sudo` |
| `↑` `↑` `↓` `↓` `←` `→` `←` `→` `B` `A` | Still works |
| `kian.help()` in devtools | A console API onto the whole runtime |

The terminal parses quotes, pipes and globs, completes with Tab, and walks
history with the arrow keys. There is a flag hidden in the filesystem.

## Security practices

As a cybersecurity student, I practise what I learn:

| Practice | Detail |
|----------|--------|
| Self-hosted libraries | All JS in `/libs/` — no CDN runtime dependencies (supply chain) |
| Content Security Policy | `script-src 'self'`, `style-src 'self'` — no `unsafe-inline`, anywhere |
| No inline styles | Typed.js's runtime `<style>` injection is switched off and replaced with a real rule, so the strict policy holds |
| Link protection | `rel="noopener noreferrer"` on all external links |
| MIME sniffing prevention | `X-Content-Type-Options: nosniff` |
| Referrer control | `strict-origin-when-cross-origin` |
| Zero tracking | No analytics, no cookies, no third-party requests for JS |
| Safe rendering | The terminal writes with `textContent` only — command output can never become markup |

## Accessibility and performance

- `prefers-reduced-motion` is honoured throughout: the frame loop renders
  one static frame and stops, transitions become instant, the custom
  cursor and the boot screen never appear.
- Every module fails independently. No WebGL, no Web Audio, no service
  worker, no JavaScript at all — the page is still readable, and the
  skills terminal still shows its full contents as static HTML.
- One `requestAnimationFrame` loop for the entire site, parked when the
  tab is hidden. Device pixel ratio is capped; particles are pooled.
- The palette is a real ARIA combobox; the terminal announces output via
  a live region; focus outlines survive both worlds.

## Project structure

```
portfolio/
├── index.html              ← single-page HTML (all 7 sections)
├── css/
│   ├── style.css           ← the original Ghibli site
│   ├── runtime.css         ← everything the JS renders at load
│   └── os.css              ← the desktop presentation
├── js/                     ← see Architecture above
├── libs/
│   ├── three.module.min.js ← Three.js r180 (self-hosted, no CDN)
│   ├── three.core.min.js   ← its core chunk
│   └── typed.min.js        ← Typed.js v2.0.16
├── assets/icons/           ← favicon, PWA icons
├── sw.js                   ← service worker (offline support)
├── site.webmanifest        ← PWA manifest
├── _headers                ← HTTP security headers (Netlify/Cloudflare)
└── README.md
```

## Local development

1. Clone this repository:
   ```bash
   git clone https://github.com/KianSiangAng/kiansiangang.github.io.git
   cd kiansiangang.github.io
   ```

2. Serve it over HTTP — ES modules and the service worker will not load
   from `file://`:
   ```bash
   npx http-server -p 8080 -c-1
   ```
   Or right-click `index.html` → **Open with Live Server** in VS Code.

3. Open <http://127.0.0.1:8080>.

Useful query parameters: `?room=0` skips the 3D room, `?shell=os` and
`?shell=page` force a presentation,
`?boot=1` replays the boot screen, `?boot=0` skips it, and `?debug=1` turns on
trace-level logging.

## Deployment (GitHub Pages)

1. Push this repository to GitHub
2. **Settings** → **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Choose `main`, `/ (root)`
5. **Save** — the site goes live at `https://kiansiangang.github.io/`

## Colour palette

| Name | Hex | Usage |
|------|-----|-------|
| Parchment | `#E8E0D0` | Background |
| Sky blue | `#A8C8E8` | Primary accent |
| Sage green | `#B8D4B8` | Secondary accent |
| Peach | `#F0C8A0` | Highlights, CTA buttons |
| Navy | `#1A2744` | Text, footer background |

## License

Copyright 2026 Ang Kian Siang. All rights reserved.
