/* ================================================================
   THEME-INIT.JS — Flash-free dark mode detection

   This file is loaded SYNCHRONOUSLY (no defer) in the <head>,
   so it runs BEFORE the browser paints anything. It reads the
   user's theme preference from localStorage (if they've toggled
   before) or falls back to their OS-level prefers-color-scheme
   setting. The result is applied as a data-theme attribute on
   <html>, which the CSS uses for all dark mode styling.

   Priority: localStorage > OS preference > "light" default

   This prevents the dreaded "flash of wrong theme" that happens
   when theme detection runs after the page has already painted
   in the wrong mode.
================================================================ */
(function () {
  var saved = localStorage.getItem('theme');
  if (!saved) {
    saved = window.matchMedia('(prefers-color-scheme:dark)').matches
      ? 'dark'
      : 'light';
  }
  document.documentElement.setAttribute('data-theme', saved);
})();
