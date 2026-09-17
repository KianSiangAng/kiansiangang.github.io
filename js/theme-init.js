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
