// Star Hopper service worker — offline play + fast loads.
// Strategy:
//   • Navigations (index.html): NETWORK-FIRST, so an online player always gets the
//     latest page (which then pulls fresh ?v=-stamped assets); falls back to cache offline.
//   • Versioned assets (JS/CSS/icons): CACHE-FIRST (they're immutable per ?v=), filled on miss.
// Bump the version below in lockstep with index.html's ?v=coach-vNN on every release.
const CACHE = 'star-hopper-coach-v399';
const CORE = [
  './',
  './index.html',
  './style.css?v=coach-v399',
  './manifest.json?v=coach-v399',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE).catch(() => {})) // tolerate a missing asset
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // let cross-origin (Google Fonts, links) pass through

  // The page itself: network-first so updates land while online.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return resp;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // Everything else: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((resp) => {
      if (resp && resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return resp;
    }).catch(() => hit))
  );
});
