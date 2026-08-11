// Justin Blog Service Worker - Local Browser Caching & Offline Support
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `justin-static-${CACHE_VERSION}`;
const PAGES_CACHE = `justin-pages-${CACHE_VERSION}`;
const IMAGES_CACHE = `justin-images-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
    '/app.css',
    '/site.webmanifest',
    '/favicon.svg',
    '/favicon-32x32.png',
    '/favicon-16x16.png',
    '/apple-touch-icon.png',
    '/icon-192.png',
    '/og-image.png'
];

// Install: Pre-cache core static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch((err) => {
                console.warn('Pre-cache error during install:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activate: Clean up previous cache versions
self.addEventListener('activate', (event) => {
    const currentCaches = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE];
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (!currentCaches.includes(key)) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Apply optimal caching strategies
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Only handle same-origin GET requests
    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    // Bypass analytics, auth and admin routes
    if (url.pathname.startsWith('/_/') || url.pathname.startsWith('/api/admins') || url.pathname.includes('/auth-')) {
        return;
    }

    // 1. Static Assets (CSS, JS, Fonts, Icons, Manifest) -> Cache-First
    if (
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.woff2') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.ico') ||
        url.pathname.endsWith('.webmanifest')
    ) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // 2. Images (PocketBase /api/files/* and media) -> Cache-First with Runtime Caching
    if (
        url.pathname.startsWith('/api/files/') ||
        url.pathname.endsWith('.webp') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg')
    ) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(IMAGES_CACHE).then((cache) => cache.put(request, responseClone));
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // 3. HTML Pages (Navigation requests) -> Stale-While-Revalidate (Instant 0ms loads + background refresh)
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            caches.open(PAGES_CACHE).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    const fetchPromise = fetch(request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => cachedResponse);

                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }
});
