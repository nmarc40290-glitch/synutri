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
    // Force le nouveau SW à devenir actif tout de suite
    self.skipWaiting(); 
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
    // Permet au SW de prendre le contrôle des pages immédiatement
    e.waitUntil(clients.claim()); 
    e.waitUntil(caches.keys().then(keys => Promise.all(
        keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)
    )));
});

self.addEventListener('fetch', (e) => {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
