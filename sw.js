importScripts('version.js');
const CACHE_NAME = `synutri-v${VERSION}`;

const ASSETS = [
    './',
    './index.html',
    './app.js',
    './version.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting(); 
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim()); 
    e.waitUntil(caches.keys().then(keys => Promise.all(
        keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)
    )));
});

// STRATÉGIE DE NAVIGATION RÉSEAU
self.addEventListener('fetch', (e) => {
    // CONDITION CRUCIALE : Si on cherche un aliment, on ignore le cache
    if (e.request.url.includes('openfoodfacts.org')) {
        return e.respondWith(
            fetch(e.request).catch(() => {
                // En cas de panne totale de réseau
                return new Response(JSON.stringify({ error: "no-network" }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
    }

    // Pour les fichiers de l'application (HTML, JS, CSS)
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
