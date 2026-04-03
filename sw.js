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

// INSTALLATION : On force l'installation et on saute l'attente
self.addEventListener('install', (e) => {
    self.skipWaiting(); 
    e.waitUntil(
        caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
    );
});

// ACTIVATION : Nettoyage immédiat des anciens caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        }).then(() => self.clients.claim()) // Prend le contrôle des pages immédiatement
    );
});

// GESTION DES REQUÊTES : Stratégie ultra-rapide (Stale-While-Revalidate)
self.addEventListener('fetch', (e) => {
    // Ne pas intercepter les requêtes API (toujours réseau)
    if (e.request.url.includes('openfoodfacts.org')) {
        return; 
    }

    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            const fetchPromise = fetch(e.request).then((networkResponse) => {
                // On met à jour le cache en arrière-plan pour la prochaine fois
                if (networkResponse && networkResponse.status === 200) {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, cacheCopy));
                }
                return networkResponse;
            });

            // On renvoie le cache s'il existe, sinon on attend le réseau
            return cachedResponse || fetchPromise;
        })
    );
});
