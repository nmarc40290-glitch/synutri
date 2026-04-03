importScripts('version.js');
// On s'assure que le nom du cache change bien avec la VERSION
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

// INSTALLATION : On force l'installation immédiate
self.addEventListener('install', (e) => {
    self.skipWaiting(); 
    e.waitUntil(
        caches.open(CACHE_NAME).then(c => {
            console.log("Caching assets for version:", VERSION);
            return c.addAll(ASSETS);
        })
    );
});

// ACTIVATION : On nettoie TOUS les anciens caches (ex: 1.2.7)
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(k => {
                    if (k !== CACHE_NAME) {
                        console.log("Deleting old cache:", k);
                        return caches.delete(k);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// GESTION DES REQUÊTES (FETCH)
self.addEventListener('fetch', (e) => {
    // 1. Priorité absolue au réseau pour l'API OpenFoodFacts
    if (e.request.url.includes('openfoodfacts.org')) {
        e.respondWith(
            fetch(e.request).catch(() => {
                return new Response(JSON.stringify({ products: [] }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // 2. Stratégie "Network-First" pour les fichiers de l'App (app.js, index.html)
    // On essaie de récupérer la version en ligne, sinon on prend le cache.
    e.respondWith(
        fetch(e.request)
            .then(response => {
                // Si on a le réseau, on renvoie la réponse fraîche
                return response;
            })
            .catch(() => {
                // Si pas de réseau (mode avion), on pioche dans le cache
                return caches.match(e.request);
            })
    );
});
                              
