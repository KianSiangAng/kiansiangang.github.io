/* ================================================================
   THEME-INIT.JS — Flash-free theme and world detection

   This file is loaded SYNCHRONOUSLY (no defer) in the <head>, so it
   runs BEFORE the browser paints anything. It restores two
   independent axes of appearance:

     data-theme = light | dark      colour scheme
                  localStorage > OS preference > light

     data-world = ghibli | hacker   which world the site is in
                  localStorage > ghibli

   Both are attributes on <html>, which every stylesheet keys off.
   Setting them here prevents the flash of the wrong theme that
   happens when detection runs after first paint — and, now that
   the site has a second world, prevents a jarring flash of soft
   parchment before the terminal world loads.

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

    root.setAttribute('data-world', localStorage.getItem('portfolio:world') === 'hacker' ? 'hacker' : 'ghibli');
  } catch (err) {
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-world', 'ghibli');
  }
})();
