importScripts('version.js');
const CACHE_NAME = `synutri-v${VERSION}`;

// On n'enregistre PAS le sw.js lui-même dans le cache !
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
    self.skipWaiting(); // Prend la place immédiatement
    e.waitUntil(
        caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim()); // Prend le contrôle des pages ouvertes
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(k => {
                if (k !== CACHE_NAME) return caches.delete(k);
            })
        ))
    );
});

// Stratégie : Réseau d'abord, sinon Cache
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
