importScripts('version.js');
const CACHE_NAME = `synutri-v${VERSION}`;

const ASSETS = [
    './',
    './index.html',
    './app.js',
    './version.js',
    './manifest.json'
];

self.addEventListener('install', (e) => {
    self.skipWaiting(); 
    e.waitUntil(
        caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : null)
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('openfoodfacts.org')) {
        e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ products: [] }))));
        return;
    }
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
