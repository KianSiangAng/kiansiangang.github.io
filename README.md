# Ang Kian Siang — Portfolio

Personal portfolio website built with vanilla HTML, CSS, and JavaScript.
No frameworks, no build tools — just clean, hand-written code with a
security-first mindset.

**Live site:** *(to be added after GitHub Pages deployment)*

---

## About

I'm an ICT undergraduate at the Singapore University of Social Sciences
(SUSS), specialising in cybersecurity. This portfolio showcases my
projects, skills, and certifications.

## Tech Stack

| Layer     | Technology                                               |
|-----------|----------------------------------------------------------|
| Structure | HTML5 (semantic, accessible)                             |
| Styling   | CSS3 (custom properties, Grid, mobile-first responsive)  |
| Logic     | Vanilla JavaScript (no frameworks)                       |
| Fonts     | Google Fonts — Nunito (body), Space Mono (terminal)      |
| Libraries | [Typed.js](https://github.com/mattboldt/typed.js) v2.0.16 (self-hosted) |

## Features

- **Typed.js hero subtitle** — cycles through role titles with a typing animation
- **Custom sakura petal background** — hand-built CSS/JS petal system (replaced 170KB tsParticles library)
- **Roaming Kodama mascot** — CSS-only Ghibli-inspired spirit that drifts across the page, hops on section changes, and reacts on click
- **Terminal-style skills section** — monospace font, blinking cursor, macOS title bar
- **Responsive design** — mobile-first CSS with breakpoints at 375px, 768px, and 1024px
- **Scroll-triggered animations** — Intersection Observer API for fade-in effects
- **CSS checkbox hack** — hamburger menu toggle without JavaScript
- **Frosted-glass navbar** — `backdrop-filter: blur()` with scroll-triggered opacity change

## Security Practices

This portfolio is built with security best practices — as a cybersecurity
student, I practice what I learn:

| Practice | Detail |
|----------|--------|
| Self-hosted libraries | All JS in `/libs/` — no CDN runtime dependencies (supply chain security) |
| Content Security Policy | `<meta http-equiv="Content-Security-Policy">` restricts script/style/font sources |
| Link protection | `rel="noopener noreferrer"` on all external links (prevents reverse tabnapping) |
| MIME sniffing prevention | `X-Content-Type-Options: nosniff` meta tag |
| Referrer control | `strict-origin-when-cross-origin` referrer policy |
| Zero tracking | No analytics, no cookies, no third-party data collection |

## Project Structure

```
portfolio/
├── index.html              ← Single-page HTML (all 7 sections)
├── css/
│   └── style.css           ← Mobile-first CSS (~1200 lines)
├── js/
│   ├── main.js             ← Typed.js init, navbar, observer, roaming mascot
│   └── sakura.js           ← Custom sakura petal spawner (replaces tsParticles)
├── libs/
│   └── typed.min.js        ← Typed.js v2.0.16 (self-hosted)
├── assets/
│   └── icons/
│       └── padlock.svg     ← Padlock icon for project cards
├── _headers                ← HTTP security headers (Netlify/Cloudflare)
└── README.md
```

## Local Development

1. Clone this repository:
   ```bash
   git clone https://github.com/KianSiangAng/portfolio.git
   cd portfolio
   ```

2. Open the project in VS Code

3. Install the **Live Server** extension (if you haven't):
   - Open the Extensions panel (`Cmd+Shift+X` on Mac / `Ctrl+Shift+X` on Windows)
   - Search for "Live Server" by Ritwick Dey
   - Click Install

4. Right-click `index.html` → **Open with Live Server**

5. Your browser will open with hot-reload — any saved changes appear instantly.

## Deployment (GitHub Pages)

1. Push this repository to GitHub
2. Go to **Settings** → **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Choose `main` branch, `/ (root)` folder
5. Click **Save** — your site will be live at `https://kiansiangang.github.io/portfolio/`

## Colour Palette

| Swatch | Name       | Hex       | Usage                    |
|--------|------------|-----------|--------------------------|
| ![#FAFAF2](https://via.placeholder.com/12/FAFAF2/FAFAF2.png) | Off-white  | `#FAFAF2` | Background               |
| ![#A8C8E8](https://via.placeholder.com/12/A8C8E8/A8C8E8.png) | Sky blue   | `#A8C8E8` | Primary accent           |
| ![#B8D4B8](https://via.placeholder.com/12/B8D4B8/B8D4B8.png) | Sage green | `#B8D4B8` | Secondary accent         |
| ![#F0C8A0](https://via.placeholder.com/12/F0C8A0/F0C8A0.png) | Peach      | `#F0C8A0` | Highlights, CTA buttons  |
| ![#1A2744](https://via.placeholder.com/12/1A2744/1A2744.png) | Navy       | `#1A2744` | Text, footer background  |

## License

Copyright 2026 Ang Kian Siang. All rights reserved.
