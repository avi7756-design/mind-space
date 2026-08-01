/*
 * Service Worker for the Shopping Assistant.
 *
 * Deliberately hand-written and small. See PWA_AUDIT.md for why this exists
 * and what it does and does not solve.
 *
 * THE THREE RULES THIS FILE OBEYS
 *
 * 1. It never touches anything that is not ours.
 *    `CacheStorage` is scoped to the ORIGIN, not to a service worker, so a
 *    careless `caches.keys()` sweep here would delete the mind-space app's
 *    cache. Every deletion is gated on our own prefix.
 *
 * 2. It never answers a request that is not ours.
 *    Cross-origin, non-GET, and anything outside this app's base path is left
 *    untouched so the browser (or the parent scope's worker) handles it.
 *
 * 3. It never serves HTML in place of an asset.
 *    A navigation fallback returned for a missing .js would break the page in
 *    a way that is very hard to diagnose.
 */

const CACHE_PREFIX = 'shopping-assistant-';
const CACHE_VERSION = 'v1';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

/**
 * The app's base path, derived from where this script actually lives.
 * Locally that is `/`; on GitHub Pages it is `/mind-space/shopping/`.
 * Nothing here hardcodes a deployment URL.
 */
const BASE_PATH = new URL('./', self.location.href).pathname;

/** The shell only. Hashed build assets are cached lazily at runtime instead —
 *  their names are unknowable to a static file like this one. */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const isOurs = (url) => url.origin === self.location.origin && url.pathname.startsWith(BASE_PATH);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // reload bypasses the HTTP cache so an update never precaches stale files.
      cache.addAll(SHELL.map((path) => new Request(path, { cache: 'reload' }))),
    ),
  );
  // Safe here: navigations are network-first and build assets are content-hashed,
  // so a new worker can never pair fresh HTML with stale JS.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            // ONLY our own superseded caches. Foreign caches — mind-space's
            // included — are never enumerated for deletion.
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Network-first: the user should see a fresh app whenever the network allows. */
async function navigationStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    // Every route is the same document (HashRouter), so the shell entry is
    // what gets refreshed — not one entry per visited hash.
    if (response && response.ok) cache.put('./index.html', response.clone());
    return response;
  } catch {
    // Scoped to OUR cache on purpose: a bare caches.match() searches every
    // cache in the origin and would happily return mind-space's index.html.
    const cached = (await cache.match('./index.html')) ?? (await cache.match('./'));
    if (cached) return cached;
    return Response.error();
  }
}

/** Cache-first: build assets are content-hashed, so a hit is always correct. */
async function assetStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    cache.put(request, response.clone());
  }
  return response;
  // No HTML fallback here by design — see rule 3 above.
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supplier links, fonts, future APIs — all network-only, never cached.
  if (!isOurs(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationStrategy(request));
    return;
  }

  event.respondWith(assetStrategy(request));
});
