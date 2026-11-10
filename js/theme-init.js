/* ================================================================
   THEME-INIT.JS — Flash-free theme, and the frame guard

   This file is loaded SYNCHRONOUSLY (no defer) in the <head>, so it
   runs BEFORE the browser paints anything. It sets:

     data-theme = light | dark
                  localStorage > OS preference > light

   That attribute is what every stylesheet keys off. Setting it here
   prevents the flash of the wrong theme that happens when detection
   runs after first paint.

   Wrapped in try/catch: in private-browsing modes localStorage can
   throw on access, and a theme preference is not worth an
   exception that stops the rest of the page from initialising.
================================================================ */
(function () {
  var root = document.documentElement;

  try {
    var savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
      savedTheme = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
    }
    root.setAttribute('data-theme', savedTheme);
  } catch (err) {
    root.setAttribute('data-theme', 'light');
  }

  /* ---- Theme transitions ----------------------------------------
     Two scripts can change the theme — the navbar button in main.js
     and the scheme module behind the desktop's menu bar and ⌥D — and
     both should change it the same way, so the "how" lives here,
     where both can reach it.

     With the View Transitions API the new scheme opens out as a
     circle from wherever the visitor last pressed. Without it, or
     with reduced motion, `change` simply runs. Either way the caller
     never needs to know which happened. ----------------------- */
  var lastPress = { x: null, y: null };
  window.addEventListener('pointerdown', function (event) {
    lastPress.x = event.clientX;
    lastPress.y = event.clientY;
  }, { capture: true, passive: true });

  window.portfolioTheme = {
    swap: function (change) {
      var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (calm || typeof document.startViewTransition !== 'function') { change(); return; }
      var x = lastPress.x === null ? window.innerWidth / 2 : lastPress.x;
      var y = lastPress.y === null ? 0 : lastPress.y;
      root.style.setProperty('--reveal-x', x + 'px');
      root.style.setProperty('--reveal-y', y + 'px');
      try { document.startViewTransition(change); } catch (err) { change(); }
    }
  };

  /* ---- Room veil -------------------------------------------------
     On a desktop the site opens in a 3D room, but the room is 700KB
     of Three.js that arrives a couple of seconds after first paint.
     Until it does, the flat desktop is what is on screen — so the
     visitor saw a desktop, then a hard cut to a room, then a flight
     back into the same desktop. The first of those three is noise.

     This decides, before anything paints, whether the room is going
     to be the opening shot, and if so asks for a veil over the page
     until it is ready. The rules mirror the shell's own (wide enough,
     fine pointer, motion allowed, not opted out); app.js lifts the
     veil whatever happens, so a wrong guess here costs a second of
     soft colour rather than a stuck page. --------------------- */
  try {
    var params = new URLSearchParams(window.location.search);
    var forced = params.get('shell');
    var saved = null;
    try { saved = sessionStorage.getItem('portfolio:shell'); } catch (e) { /* ignore */ }
    var wantsPage = forced === 'page' || (forced !== 'os' && saved === 'page');
    var capable = window.innerWidth >= 900 && window.innerHeight >= 560
      && window.matchMedia('(pointer: fine)').matches;
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!wantsPage && (capable || forced === 'os') && !still && params.get('room') !== '0'
        && window.top === window.self) {
      root.setAttribute('data-veil', 'room');

      /* The same decision is the earliest moment anyone knows the room
         will be needed, so its files start downloading now rather than
         when the kernel reaches the room module a few hundred
         milliseconds later. Three.js is the long pole; every bit of
         head start comes straight off the time spent behind the veil.
         A phone never reaches this branch, so it still downloads none
         of it. */
      var early = [
        'libs/three.module.min.js', 'libs/three.core.min.js',
        'js/room/room.js', 'js/room/props.js', 'js/room/materials.js',
        'js/room/camera-rig.js', 'js/room/screen.js'
      ];
      for (var i = 0; i < early.length; i += 1) {
        var hint = document.createElement('link');
        hint.rel = 'modulepreload';
        hint.href = early[i];
        document.head.appendChild(hint);
      }
    }
  } catch (err) { /* no veil is always a safe answer */ }

  /* ---- Clickjacking guard --------------------------------------
     The right way to refuse being framed is the `frame-ancestors`
     CSP directive, or X-Frame-Options. Both are RESPONSE HEADERS,
     and this site is on GitHub Pages, which serves no custom
     headers — the _headers file in the repo is only honoured if it
     is ever moved to Netlify or Cloudflare Pages. `frame-ancestors`
     is explicitly ignored when delivered in a <meta> tag, so there
     is no declarative option available here at all.

     That leaves script. This deliberately does NOT bust out by
     assigning top.location: navigating someone's top-level window
     is itself a hostile act, it breaks legitimate archiving and
     preview tools, and a sandboxed frame blocks it anyway. Instead
     the page refuses to render its UI. Clickjacking needs something
     to click; an attacker overlaying this gets a notice and a link
     and nothing worth stealing a click on.

     Runs before first paint, so a framed page never flashes the
     real interface. ------------------------------------------- */
  try {
    if (window.top !== window.self) {
      root.setAttribute('data-framed', 'true');

      document.addEventListener('DOMContentLoaded', function () {
        var notice = document.createElement('div');
        notice.className = 'framed-notice';

        var text = document.createElement('p');
        text.textContent = 'This page cannot be displayed inside a frame.';
        notice.appendChild(text);

        var link = document.createElement('a');
        link.href = window.location.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Open it directly';
        notice.appendChild(link);

        document.body.appendChild(notice);
      });
    }
  } catch (err) {
    /* Cross-origin access to window.top throws in some embeddings.
       Throwing at all means we are framed by someone else, so treat
       it exactly like the check succeeding. */
    root.setAttribute('data-framed', 'true');
  }
})();
