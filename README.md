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

## Two worlds

The site exists in two complete themes, not one theme with a filter over it:

| | **Ghibli** | **Hacker** |
|---|---|---|
| Sky | Procedural fBm cloud shader, sun glow | Falling glyph columns, CRT scanlines |
| Particles | Sakura petals in a curl-noise wind field | The same physics, rendered as code glyphs |
| Wildlife | A boids flock of birds | — |
| Type | Nunito | Space Mono |
| Soundtrack | Pentatonic pad and bells | Saw drone and a 16th-note arpeggio |

Switch with the button in the navbar, `⌘K → switch world`, the terminal
command `theme hacker`, by typing `hack` anywhere, or with the Konami code.
The light/dark colour scheme is a separate axis and still works in both.

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
│   ├── fsm.js              ← finite state machine
│   └── logger.js           ← namespaced logging, ring buffer, perf marks
├── gfx/
│   ├── gl.js               ← WebGL2 wrapper, shader diagnostics
│   ├── shaders.js          ← GLSL: fBm sky · glyph rain
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
│   ├── cursor.js           ← custom cursor with magnetism
│   ├── tilt.js             ← 3D card tilt, gyroscope on mobile
│   ├── boot.js             ← BIOS-style POST screen
│   ├── konami.js           ← typed input sequences
│   └── achievements.js     ← 12 unlockables, persisted
├── audio/synth.js          ← Web Audio synthesiser, lookahead scheduler
├── theme/duality.js        ← the world switch, as a state machine
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
│   └── duality.css         ← hacker world + every runtime component
├── js/                     ← see Architecture above
├── libs/typed.min.js       ← Typed.js v2.0.16 (self-hosted)
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

Useful query parameters: `?boot=1` replays the boot screen, `?boot=0`
skips it, `?debug=1` turns on trace-level logging.

## Deployment (GitHub Pages)

1. Push this repository to GitHub
2. **Settings** → **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Choose `main`, `/ (root)`
5. **Save** — the site goes live at `https://kiansiangang.github.io/`

## Colour palette

### Ghibli

| Name | Hex | Usage |
|------|-----|-------|
| Parchment | `#E8E0D0` | Background |
| Sky blue | `#A8C8E8` | Primary accent |
| Sage green | `#B8D4B8` | Secondary accent |
| Peach | `#F0C8A0` | Highlights, CTA buttons |
| Navy | `#1A2744` | Text, footer background |

### Hacker

| Name | Hex | Usage |
|------|-----|-------|
| Void | `#04070A` | Background |
| Phosphor | `#3BFF88` | Primary accent, headings |
| Signal | `#23D977` | Secondary accent |
| Mint | `#C6FFD9` | Body text |

## License

Copyright 2026 Ang Kian Siang. All rights reserved.
