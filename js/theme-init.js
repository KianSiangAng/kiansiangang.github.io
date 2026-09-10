/* ================================================================
   THEME-INIT.JS — Flash-free theme and world detection

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
})();
