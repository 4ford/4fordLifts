/* Offline support. Network-first so a new deploy is picked up on the
   next online load; the cache is the fallback when there is no signal
   (gym basements, etc). Bump CACHE when the file list changes. */
var CACHE = 'lift-tracker-v3';
var SHELL = [
  './',
  'index.html',
  'styles.css',
  'data.js',
  'app.js',
  'chart.js',
  'manifest.webmanifest',
  'icon.svg',
  'fonts/BarlowCondensed-ExtraBold.ttf',
  'fonts/BarlowCondensed-SemiBold.ttf'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      })
      .catch(function () {
        return caches.match(e.request).then(function (hit) {
          return hit || caches.match('index.html');
        });
      })
  );
});
