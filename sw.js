/* ================================================================
   SW.JS — Service worker

   Strategy per request type:

     navigation (HTML)  network-first, falling back to the cached
                        shell. A portfolio must never serve a stale
                        page to a recruiter, but it should still
                        open on a train.

     same-origin static stale-while-revalidate: answer instantly
                        from cache, refresh in the background.

     Google Fonts       cache-first with a long life; the files are
                        immutable and versioned by URL.

     cross-origin other passed straight through, never cached.

   The cache name carries a version. On activate, every cache that
   is not the current one is deleted, so a deploy cannot leave a
   visitor pinned to old assets.
================================================================ */

const VERSION = 'v2.0.0';
const CACHE = `portfolio-${VERSION}`;

/* The shell: everything needed to render the page offline. */
const PRECACHE = [
  './',
  'index.html',
  'css/style.css',
  'css/duality.css',
  'css/os.css',
  'libs/typed.min.js',
  'js/theme-init.js',
  'js/main.js',
  'js/app.js',
  'js/core/signal.js',
  'js/core/bus.js',
  'js/core/store.js',
  'js/core/di.js',
  'js/core/kernel.js',
  'js/core/logger.js',
  'js/core/fsm.js',
  'js/gfx/gl.js',
  'js/gfx/shaders.js',
  'js/gfx/scene.js',
  'js/gfx/petals.js',
  'js/gfx/birds.js',
  'js/audio/synth.js',
  'js/term/vfs.js',
  'js/term/shell.js',
  'js/term/commands.js',
  'js/term/term-ui.js',
  'js/ui/palette.js',
  'js/ui/fuzzy.js',
  'js/ui/hud.js',
  'js/ui/cursor.js',
  'js/ui/tilt.js',
  'js/ui/boot.js',
  'js/ui/konami.js',
  'js/ui/achievements.js',
  'js/data/portfolio.js',
  'js/theme/duality.js',
  'js/os/shell.js',
  'js/os/wm.js',
  'js/os/desktop.js',
  'js/os/menubar.js',
  'js/os/dock.js',
  'js/os/router.js',
  'js/os/registry.js',
  'js/os/contextmenu.js',
  'js/os/dom.js',
  'js/os/icons.js',
  'js/os/apps/panels.js',
  'assets/icons/padlock.svg',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'site.webmanifest',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // addAll is atomic: one 404 fails the whole install. Each asset
      // is added individually so a single missing file cannot stop
      // the worker from installing at all.
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('[sw] precache skipped', url, err.message);
          }),
        ),
      );
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || network;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match('index.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/* The page can ask the worker to step aside after an update. */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
