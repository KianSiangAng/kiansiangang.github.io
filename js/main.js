/* ================================================================
   MAIN.JS — Ang Kian Siang Portfolio

   This file is loaded with defer so the entire DOM is available
   before any code runs.

   Table of contents:
     1. Typed.js — cycling subtitle
     2. Navbar scroll effect — background opacity change
     3. Mobile menu auto-close — close on link click
     4. Intersection Observer — scroll-triggered fade-ins
     4b. Page Flip — vertical book-turn entrance animation
     5. Kitsune Guide — section-tracking fox spirit mascot
================================================================ */


/* ================================================================
   1. TYPED.JS — Cycling subtitle in the hero section

   Typed.js targets a <span> by CSS selector, clears its text,
   then "types" each string in the array one by one.
================================================================ */
const typed = new Typed('#typed-text', {
  /* "a cybersecurity analyst" used to lead this list. It is not what
     the degree says, so it does not get to be the first thing the
     page claims — the ambition is stated as an ambition instead. */
  strings: [
    'an ICT undergraduate.',
    'a cybersecurity diploma holder.',
    'a problem solver.',
    'a builder.',
    'heading into security.',
  ],
  /* Typed.js normally injects a <style> element at runtime for its
     caret animation. Our CSP sets style-src 'self' with no
     'unsafe-inline', so the browser blocks that injection and logs a
     violation. Opting out and defining .typed-cursor ourselves in
     css/runtime.css keeps the animation AND the strict policy. */
  autoInsertCss: false,

  typeSpeed:    60,    // ms per character typed
  backSpeed:    35,    // ms per character deleted
  backDelay:   1800,   // pause (ms) before deleting the current word
  startDelay:   500,   // initial wait before typing begins
  loop:         true,  // cycle forever
});


/* ================================================================
   2. NAVBAR — Background opacity change on scroll

   window.addEventListener('scroll', ...) fires every time the user
   scrolls. We toggle the CSS class .scrolled on the navbar when
   the user has scrolled past 60px.

   classList.toggle(class, condition) is a clean one-liner:
     - If condition is true  → add the class
     - If condition is false → remove the class
================================================================ */
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});


/* ================================================================
   3. MOBILE MENU — Auto-close on nav link click

   When the user clicks a nav link on mobile, the page scrolls to
   that section but the hamburger menu stays open (the checkbox
   remains checked). This code unchecks it to close the menu.
================================================================ */
const navToggle = document.getElementById('nav-toggle');
const navLinks  = document.querySelectorAll('.navbar__link');

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    /* Uncheck the hidden checkbox → CSS hides the menu */
    navToggle.checked = false;
  });
});


/* ================================================================
   3b. SMOOTH SCROLL — Anchor links with scroll-snap compatibility

   scroll-behavior: smooth on <html> handles most cases, but
   scroll-snap can sometimes fight with anchor navigation. This
   explicit handler ensures smooth scrolling for all internal
   anchor links (nav links, CTA, "Back to top", logo).
================================================================ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const targetId = anchor.getAttribute('href');
    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});


/* ================================================================
   4. INTERSECTION OBSERVER — Scroll-triggered fade-in animations

   The Intersection Observer API watches elements and tells you
   when they enter (or leave) the viewport. It's much more
   efficient than listening to scroll events and calculating
   positions manually.

   How it works:
   1. Create an observer with a callback function
   2. Tell it to .observe() all elements with class .fade-in
   3. When an element scrolls into view (isIntersecting = true),
      add the .visible class → CSS transitions handle the animation
   4. Call observer.unobserve() so it only animates once (not on
      every scroll back and forth)

   The { threshold: 0.15 } option means the callback fires when
   at least 15% of the element is visible. This ensures the
   animation triggers before the element is fully on screen.

   CYBERSECURITY LEARNING MOMENT: Intersection Observer is also
   used in ad-tracking and lazy loading. Understanding how the
   browser's observer APIs work helps you reason about what
   scripts can "see" about user behaviour — relevant to privacy
   analysis and threat modelling.
================================================================ */
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

/* Find every element with .fade-in and start watching it.
   SKIP elements inside .page-flip sections — those are handled
   by the page-flip reveal system (section 4b) to avoid two
   animation systems fighting over the same elements. */
document.querySelectorAll('.fade-in').forEach(el => {
  if (!el.closest('.page-flip')) {
    fadeObserver.observe(el);
  }
});


/* ================================================================
   4b. SECTION REVEAL — Scroll-snap-aware content entrance

   Each section (except hero) has .page-flip. Children start hidden
   (opacity 0, blurred, translated down) and animate in with a
   staggered cascade when the section is scrolled into view.

   ARCHITECTURE:
   Instead of IntersectionObserver (which can fire prematurely due
   to browser scroll-restoration), we use a scroll listener that
   checks which section is currently "snapped" — meaning its top
   is near the viewport top and it occupies most of the screen.
   This ONLY fires after the scroll-snap transition completes, so
   the animation always plays while the user is looking at it.

   Sections visible on initial load get .page-flip--no-anim for
   instant content reveal (no animation on stale content).

   Uses @keyframes (not transitions) because transitions can be
   skipped when the browser batches renders in the same frame.
================================================================ */

/* Prevent browser scroll restoration — we always start at top.
   Without this, the browser restores the previous scroll position
   and sections get revealed before the user sees them. */
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

/* Track which sections have already been revealed */
const revealedSections = new Set();

/* The petal wipe is decoration and nothing else, so it is simply not
   spawned when the visitor has asked for less motion. The content
   reveal still runs — it is a short fade, and without it the section
   would stay at opacity 0 forever. */
const prefersReducedMotion = window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;


/* ---- SAKURA PETAL WIPE: full-screen petal curtain ----

   Spawns 25-30 large sakura petals that fly across the section from
   left to right like a wave/curtain. Petals are staggered vertically
   to cover the entire section height, and staggered in time so they
   form a sweeping wall that covers the old scene and reveals the new
   content underneath as they pass.

   Each petal: 30-60px, random vertical position, wobble, spin.
   Total duration: ~1.2s for the wave to cross the screen. */

function spawnBloomPetals(section, direction) {
  direction = direction || 'down';                   /* 'down' = L→R, 'up' = R→L */
  /* Was 25-30. Each is an animated, compositor-promoted element, and
     with sections revealing sooner several waves can now overlap —
     peaks of 56 were measured. Sixteen still reads as a wave. */
  const count = 14 + Math.floor(Math.random() * 4); /* 14-17 petals */
  const sectionH = section.offsetHeight;

  for (let i = 0; i < count; i++) {
    const petal = document.createElement('div');
    const variant = 1 + Math.floor(Math.random() * 4);
    petal.className = 'bloom-petal bloom-petal--' + variant;

    /* Add reverse class when scrolling up — uses petalWipeReverse keyframes */
    if (direction === 'up') {
      petal.classList.add('bloom-petal--reverse');
    }

    /* Vertical start — spread petals across the full section height */
    const startY = Math.random() * sectionH;

    /* Vertical wobble — petals drift up or down mid-flight */
    const wobble = (Math.random() - 0.5) * 120;     /* -60 to +60px */

    /* Spin amount */
    const rot = 180 + Math.random() * 540;           /* 180°-720° */

    /* Size — large enough to form a visible curtain */
    const size = 0.8 + Math.random() * 1.4;          /* 0.8-2.2× */
    const baseW = 30 + Math.random() * 30;           /* 30-60px */
    const baseH = baseW * 1.3;

    /* Stagger — petals in the "wave" launch slightly apart.
       Earlier petals (lower i) start sooner. Spread over 0.2s
       so the wave has width as it crosses. */
    const delay = (i / count) * 0.2 + Math.random() * 0.05;

    /* Duration — slight variation so petals don't move in lockstep */
    const duration = 0.6 + Math.random() * 0.3;      /* 0.6-0.9s */

    petal.style.cssText =
      'width:' + baseW + 'px;' +
      'height:' + baseH + 'px;' +
      'top:0;left:0;' +
      '--start-y:' + startY + 'px;' +
      '--wobble:' + wobble + 'px;' +
      '--rot:' + rot + 'deg;' +
      '--size:' + size + ';' +
      '--delay:' + delay + 's;' +
      '--duration:' + duration + 's;';

    section.appendChild(petal);

    /* Clean up after animation finishes */
    petal.addEventListener('animationend', () => petal.remove(), { once: true });
  }
}


/* ---- SCROLL DIRECTION TRACKING ----

   We save the scroll position after each debounce fires as the
   baseline for the next gesture. When the next scroll settles,
   we compare the new position to the baseline.

   This is immune to scroll-snap overshoot/snap-back because
   the baseline is the resting position BEFORE the new gesture,
   and the comparison happens AFTER scroll has fully settled. */
let lastRestingScrollY = window.scrollY;

/* Check which section the user is currently looking at.
   A section is "snapped" when:
     - Its top is in the upper 40% of the viewport
     - Its bottom extends past the midpoint of the viewport
   This means the section is the dominant visible content.

   BIDIRECTIONAL LOGIC:
   - Sections that scroll OUT of view get their reveal reset
     (remove .page-flip--active, remove from revealedSections)
   - When they scroll back INTO view, the petal wipe re-triggers
     in the correct direction (L→R when scrolling down, R→L when
     scrolling up). */
function checkAndRevealSections() {
  const vh = window.innerHeight;
  const currentY = window.scrollY;

  /* NET direction: compare settled position to previous resting spot */
  const direction = currentY < lastRestingScrollY ? 'up' : 'down';
  lastRestingScrollY = currentY;    /* baseline for next gesture */

  /* ---- HERO section: replay dawn animation on re-entry ----
     The hero uses CSS class .hero--revealed to trigger its
     entrance animation. When it leaves the viewport, the class
     is removed so the animation replays when scrolling back. */
  const hero = document.getElementById('hero');
  if (hero) {
    const heroRect = hero.getBoundingClientRect();
    const heroInView = heroRect.top < vh * 0.4 && heroRect.bottom > vh * 0.5;
    const heroGone   = heroRect.bottom < vh * 0.05 || heroRect.top > vh * 0.95;

    if (heroGone && hero.classList.contains('hero--revealed')) {
      hero.classList.remove('hero--revealed');
    } else if (heroInView && !hero.classList.contains('hero--revealed')) {
      hero.classList.add('hero--revealed');
    }
  }

}

/* The hero's entrance replays on re-entry, so it stays on a scroll
   listener. It is a class toggle on one element and costs nothing. */
let revealTimer = null;
window.addEventListener('scroll', () => {
  clearTimeout(revealTimer);
  revealTimer = setTimeout(checkAndRevealSections, 40);
}, { passive: true });

/* ----------------------------------------------------------------
   SECTION REVEALS

   These used to run from the same debounced scroll handler, and the
   result was a page that felt broken to scroll through. Three things
   compounded:

     The handler waited 40ms after scrolling STOPPED. Mid-gesture,
     nothing revealed — so scrolling down the page meant dragging a
     column of empty boxes past the viewport and waiting at the
     bottom for them to fill in.

     A section only qualified when it was dominant on screen — top
     above 40% of the viewport AND bottom past the midpoint — so the
     reveal began long after the section was visible.

     Then the CSS staggered its children out to 0.52s with a 0.35s
     fade. Measured end to end: 1.2 to 1.5 SECONDS from arriving at a
     section to being able to read it.

   An IntersectionObserver fires while the gesture is still going,
   which is the whole fix: the reveal starts as the section comes
   into view rather than after everything stops moving.

   Sections are also unobserved once revealed. Re-hiding content the
   reader has already seen, every time they scroll back up, is an
   animation charging them repeatedly for a first impression.
---------------------------------------------------------------- */
const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;

    const section = entry.target;
    revealObserver.unobserve(section);       // reveal once, stay revealed
    revealedSections.add(section.id);

    /* Direction only decides which way the petals fly. Read it from
       the scroll position rather than the observer, which does not
       report direction. */
    const direction = window.scrollY < lastRestingScrollY ? 'up' : 'down';
    if (direction === 'up') section.classList.add('page-flip--up');

    section.classList.add('page-flip--active');
    if (!prefersReducedMotion) spawnBloomPetals(section, direction);
  }
}, {
  /* Start as the section's leading edge arrives, not once it owns the
     screen. 12% is enough to be sure the reader is heading there. */
  threshold: 0.12,
  rootMargin: '0px 0px -8% 0px',
});

document.querySelectorAll('.page-flip').forEach((section) => revealObserver.observe(section));

/* Initial load: force scroll to top, then check if any sections
   are visible (e.g. on very tall viewports). Those get instant
   reveal. Others wait for the user to scroll. */
window.scrollTo({ top: 0, behavior: 'instant' });
setTimeout(() => {
  /* Hero gets its dawn animation on initial load */
  const heroEl = document.getElementById('hero');
  if (heroEl) heroEl.classList.add('hero--revealed');

  document.querySelectorAll('.page-flip').forEach(section => {
    const rect = section.getBoundingClientRect();
    const visibleTop    = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, window.innerHeight);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const visibleRatio  = visibleHeight / rect.height;

    if (visibleRatio > 0.5) {
      /* More than half visible on load — show content instantly */
      revealedSections.add(section.id);
      section.classList.add('page-flip--active');
      section.classList.add('page-flip--no-anim');
    }
  });
}, 50);


/* ================================================================
   5. KITSUNE GUIDE — Section-tracking fox spirit mascot

   The kitsune (fox spirit) is a position: fixed element that acts
   as a guide for the user. Unlike the old roaming mascot that
   drifted randomly, the kitsune:
     a) Idles with a gentle CSS bob animation at all times
     b) Positions itself beside the currently visible section
     c) Alternates sides (left for even sections, right for odd)
     d) Shows speech bubble hints on section enter
     e) Hops when scrolling into a new section
     f) Does a surprised reaction when clicked

   ARCHITECTURE:
   - CSS handles idle bob, transitions, flip direction, animations
   - JS handles position tracking, speech bubble content, observers

   KEY CONCEPT — guide vs roaming:
   The kitsune doesn't wander randomly. It tracks the current
   section using an Intersection Observer and positions itself
   beside the section title. This creates a "guide" feeling —
   the fox leads the user through the page content.

   data-section-index on each <section> determines which side
   the kitsune appears on:
     even (0, 2, 4) → left side
     odd  (1, 3)    → right side
================================================================ */
const mascot = document.getElementById('mascot');

if (mascot) {

  /* ---- SECTION HINTS: messages for each section ---- */
  const sectionHints = {
    hero:     'Welcome!',
    about:    'Get to know me!',
    projects: 'Check these out!',
    skills:   'My toolkit!',
    contact:  'Say hello!',
  };

  /* ---- DOM REFERENCES ---- */
  const bubble     = mascot.querySelector('.kitsune-bubble');
  const bubbleText = mascot.querySelector('.kitsune-bubble__text');
  let currentSection = null;   // tracks currently visible section
  let bubbleTimeout  = null;   // auto-hide timer for speech bubble


  /* ---- 5a. SPEECH BUBBLE: show/hide ----

     showBubble(text) displays the speech bubble with the given
     text. After 2.5 seconds it automatically hides.

     The CSS transition on .kitsune-bubble handles the fade. */
  function showBubble(text) {
    if (!bubble || !bubbleText) return;

    /* Clear any pending hide timer */
    clearTimeout(bubbleTimeout);

    /* Set text and show */
    bubbleText.textContent = text;
    bubble.classList.add('kitsune-bubble--visible');

    /* Auto-hide after 2.5 seconds */
    bubbleTimeout = setTimeout(() => {
      bubble.classList.remove('kitsune-bubble--visible');
    }, 2500);
  }


  /* ---- 5b. POSITION KITSUNE BESIDE SECTION ----

     Reads the section's data-section-index attribute to decide
     which side to place the kitsune on:
       even index → left side (left: 3vw)
       odd index  → right side (left: calc(100vw - 100px))

     With scroll-snap, sections snap cleanly into the viewport,
     so we position the kitsune at a fixed vertical spot in the
     viewport (40% from top) rather than tracking absolute scroll
     position. This keeps the fox visible and stable after each
     page flip/snap. */
  function positionKitsuneBesideSection(sectionEl) {
    const index = parseInt(sectionEl.dataset.sectionIndex, 10) || 0;
    const isLeft = index % 2 === 0;

    /* Fixed viewport position — 40% down the screen.
       With scroll-snap centering each section in the viewport,
       this places the kitsune alongside the section title area. */
    mascot.style.top    = '40vh';
    mascot.style.bottom = 'auto';
    mascot.style.right  = 'auto';

    if (isLeft) {
      mascot.style.left = '3vw';
      mascot.classList.remove('kitsune-guide--flipped');
    } else {
      mascot.style.left = 'calc(100vw - 100px)';
      mascot.classList.add('kitsune-guide--flipped');
    }
  }


  /* ---- 5c. SECTION OBSERVER: track current section ----

     An Intersection Observer watches each <section>. When a new
     section enters the viewport:
       1. Update currentSection tracker
       2. Position the kitsune beside that section
       3. Trigger a hop animation
       4. Show the section's speech bubble hint */
  let lastSection = null;
  let trotTimer = null;   /* tracks the trot→hop timeout   */
  let hopTimer  = null;   /* tracks the hop→idle timeout    */

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.target.id !== lastSection) {
        lastSection = entry.target.id;
        currentSection = entry.target.id;

        /* Only skip if the click-reaction is playing (brief) */
        if (mascot.classList.contains('kitsune--surprised')) return;

        /* Cancel any in-progress trot / hop so we can redirect */
        clearTimeout(trotTimer);
        clearTimeout(hopTimer);
        mascot.classList.remove('kitsune--hop');

        /* 1. Start trotting animation (legs move) */
        mascot.classList.add('kitsune--trotting');

        /* 2. Reposition — CSS transition moves the kitsune over 1s */
        positionKitsuneBesideSection(entry.target);

        /* 3. After the CSS position transition ends (~1s), stop trotting
              and play a landing hop */
        trotTimer = setTimeout(() => {
          mascot.classList.remove('kitsune--trotting');
          mascot.classList.add('kitsune--hop');

          hopTimer = setTimeout(() => {
            mascot.classList.remove('kitsune--hop');
          }, 500);
        }, 1000);

        /* Show section hint in speech bubble */
        const hint = sectionHints[entry.target.id];
        if (hint) showBubble(hint);
      }
    });
  }, { threshold: 0.3 });

  /* Observe all sections */
  document.querySelectorAll('section').forEach(section => {
    sectionObserver.observe(section);
  });


  /* ---- 5d. CLICK REACTION: surprised ----

     When the user clicks the kitsune:
     1. Add .kitsune--surprised class (CSS triggers animation)
     2. Show "Kya~!" speech bubble
     3. On animationend, remove the class

     The { once: true } option auto-removes the listener after
     firing, preventing listener stacking on repeated clicks. */
  mascot.addEventListener('click', () => {
    /* Don't re-trigger if animation is already playing */
    if (mascot.classList.contains('kitsune--surprised') ||
        mascot.classList.contains('kitsune--hop') ||
        mascot.classList.contains('kitsune--trotting')) return;

    /* Show surprised speech bubble */
    showBubble('Kya~!');

    /* Trigger surprised animation */
    mascot.classList.add('kitsune--surprised');

    mascot.addEventListener('animationend', () => {
      mascot.classList.remove('kitsune--surprised');
    }, { once: true });
  });


  /* ---- 5e. INITIAL POSITION ----
     After a short delay, position beside the hero section
     and show the welcome bubble. */
  setTimeout(() => {
    const heroSection = document.getElementById('hero');
    if (heroSection) {
      positionKitsuneBesideSection(heroSection);
      currentSection = 'hero';
      showBubble('Welcome!');
    }
  }, 500);


  /* ---- 5f. EYE TRACKING: pupils follow the cursor ----

     The kitsune's pupils (CSS ::after pseudo-elements) follow the
     cursor by reading --pupil-x and --pupil-y custom properties
     set on the mascot element.

     mousemove stores cursor coords (cheap, no DOM work).
     requestAnimationFrame reads them, calculates direction from
     mascot center → cursor, clamps to max pupil offset, and sets
     the CSS custom properties.

     Max travel: 1.5px horizontal, 2px vertical — keeps the 4×4px
     pupil inside the 7×9px eye oval. */

  const MAX_PUPIL_X = 1.5;
  const MAX_PUPIL_Y = 2;
  let mouseX = 0;
  let mouseY = 0;
  let pupilRafPending = false;

  function updatePupils() {
    pupilRafPending = false;

    /* Mascot center in viewport coordinates */
    const rect = mascot.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    /* Direction vector from mascot center to cursor */
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let px = 0;
    let py = 0;

    if (dist > 0) {
      /* Smooth ramp — proportional when cursor is near (<100px),
         full offset when far. Prevents jittery snapping. */
      const scale = Math.min(1, dist / 100);
      px = (dx / dist) * scale * MAX_PUPIL_X;
      py = (dy / dist) * scale * MAX_PUPIL_Y;
    }

    /* No flip compensation needed — the scaleX(-1) on .kitsune
       already mirrors the pupil offset visually, so the raw
       direction vector works correctly in both orientations. */

    mascot.style.setProperty('--pupil-x', px + 'px');
    mascot.style.setProperty('--pupil-y', py + 'px');
  }

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!pupilRafPending) {
      pupilRafPending = true;
      requestAnimationFrame(updatePupils);
    }
  }, { passive: true });
}


/* ================================================================
   6. THEME TOGGLE — Light / Dark mode switch

   The toggle button (#theme-toggle) lives in the navbar. Clicking
   it flips the data-theme attribute on <html> between "light" and
   "dark", and saves the choice to localStorage so it persists
   across page loads.

   Initial theme detection happens in js/theme-init.js (loaded
   synchronously in <head>) to prevent a flash of the wrong theme.
   This section only handles the click interaction.
================================================================ */
const themeToggle = document.getElementById('theme-toggle');

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';

    /* Apply the new theme */
    document.documentElement.setAttribute('data-theme', next);

    /* Persist to localStorage for future visits */
    localStorage.setItem('theme', next);

    /* Replay hero dawn animation if hero is currently in view */
    const heroEl = document.getElementById('hero');
    if (heroEl && heroEl.classList.contains('hero--revealed')) {
      heroEl.classList.remove('hero--revealed');
      /* Small delay so the browser registers the class removal
         before re-adding it — triggers a fresh animation cycle. */
      setTimeout(() => heroEl.classList.add('hero--revealed'), 50);
    }
  });
}
