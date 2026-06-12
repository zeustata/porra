const CACHE_NAME = 'porra-cache-v52';
const ASSETS = [
    './',
    './index.html',
    './css/style.css?v=49',
    './logo.png',
    './manifest.json',
    './js/api-engine.js?v=49',
    './data/participants.json?v=49',
    './data/official_answers.json',
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
    // Ignorar esquemas no soportados (como extensiones de Chrome)
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);

    // 1. Excluir APIs externas de la caché del Service Worker (el motor de la app ya maneja su caché en localStorage)
    if (url.hostname.includes('api.football-data.org') || url.hostname.includes('api.rss2json.com') || url.hostname.includes('raw.githubusercontent.com')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 2. Network First para archivos de código y configuración local (HTML, JS, CSS, JSON)
    const isCriticalAsset = 
        url.origin === location.origin && (
            url.pathname === '/' || 
            url.pathname.endsWith('/') || 
            url.pathname.endsWith('.html') || 
            url.pathname.endsWith('.js') || 
            url.pathname.endsWith('.css') || 
            url.pathname.endsWith('.json')
        );

    if (isCriticalAsset) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request, { ignoreSearch: true }))
        );
    } else {
        // 3. Cache First con fallback de red para el resto (imágenes locales, fuentes externas)
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then((response) => {
                return response || fetch(event.request).then((fetchRes) => {
                    // Guardar en caché si es una respuesta válida o de origen externo (opaque)
                    if (fetchRes && (fetchRes.status === 200 || fetchRes.type === 'opaque')) {
                        const copy = fetchRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return fetchRes;
                });
            })
        );
    }
});
