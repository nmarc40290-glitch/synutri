 importScripts('version.js');

// On génère un nom de cache unique basé sur VERSION
const CACHE_NAME = `synutri-v${typeof VERSION !== 'undefined' ? VERSION : Date.now()}`;

const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// INSTALLATION : Force l'activation immédiate
self.addEventListener('install', (e) => {
    self.skipWaiting(); 
    e.waitUntil(
        caches.open(CACHE_NAME).then(c => {
            return c.addAll(ASSETS);
        })
    );
});

// ACTIVATION : Nettoie TOUS les anciens caches (très important)
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(k => {
                    if (k !== CACHE_NAME) {
                        console.log("SW: Nettoyage ancien cache", k);
                        return caches.delete(k);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// FETCH : Priorité au réseau pour les scripts
self.addEventListener('fetch', (e) => {
    // On ignore l'API OpenFoodFacts pour ne pas la mettre en cache
    if (e.request.url.includes('openfoodfacts.org')) return;

    e.respondWith(
        fetch(e.request)
            .then(res => res)
            .catch(() => caches.match(e.request))
    );
});
