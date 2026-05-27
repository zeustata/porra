const CACHE_NAME = 'porra-cache-v4';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './logo.png',
    './manifest.json',
    './js/api-engine.js',
    './data/participants.json',
    './reglas.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            clients.claim(),
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Network First para HTML y CDNs externos
    if ((url.origin === location.origin && (url.pathname === '/' || url.pathname.endsWith('index.html'))) || url.origin !== location.origin) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response && (response.status === 200 || response.type === 'opaque')) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request, { ignoreSearch: true }))
        );
    } else {
        // Cache First para el resto (imágenes, scripts, css locales)
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then((response) => {
                return response || fetch(event.request).then((fetchRes) => {
                    if (fetchRes && fetchRes.status === 200) {
                        const copy = fetchRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return fetchRes;
                });
            })
        );
    }
});
