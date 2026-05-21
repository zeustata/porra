const CACHE_NAME = 'porra-cache-v1';
const urlsToCache = [
  '/porra/',
  '/porra/index.html',
  '/porra/logo.png',
  '/porra/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
