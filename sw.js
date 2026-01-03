/**
 * Hans Financial Note - Service Worker
 * Provides offline capability and caching
 */

const CACHE_NAME = 'hans-finance-v3.0.0';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/config.js',
    '/js/storage.js',
    '/js/firebase-service.js',
    '/js/google-api.js',
    '/js/exchange-rate.js',
    '/js/utilities.js',
    '/js/transactions.js',
    '/js/budget.js',
    '/js/investments.js',
    '/js/charts.js',
    '/js/modals.js',
    '/js/app.js'
];

const EXTERNAL_ASSETS = [
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/luxon@3/build/global/luxon.min.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // Cache external assets separately (may fail)
                return caches.open(CACHE_NAME)
                    .then(cache => {
                        return Promise.allSettled(
                            EXTERNAL_ASSETS.map(url => cache.add(url))
                        );
                    });
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip cross-origin requests except for CDNs
    const url = new URL(event.request.url);
    const isLocal = url.origin === location.origin;
    const isCDN = url.hostname.includes('cdn.jsdelivr.net') ||
                  url.hostname.includes('googleapis.com') ||
                  url.hostname.includes('gstatic.com');

    if (!isLocal && !isCDN) return;

    // Handle API requests differently (network first)
    if (url.pathname.includes('/api/') || url.hostname.includes('api.')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache successful API responses
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // For other requests - cache first, network fallback
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // Return cached response and update cache in background
                    event.waitUntil(
                        fetch(event.request)
                            .then(networkResponse => {
                                if (networkResponse.ok) {
                                    caches.open(CACHE_NAME).then(cache => {
                                        cache.put(event.request, networkResponse);
                                    });
                                }
                            })
                            .catch(() => {})
                    );
                    return cachedResponse;
                }

                // No cache - fetch from network
                return fetch(event.request)
                    .then(networkResponse => {
                        // Cache the response
                        if (networkResponse.ok) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Return offline page for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Background sync for transactions
self.addEventListener('sync', event => {
    if (event.tag === 'sync-transactions') {
        event.waitUntil(syncTransactions());
    }
});

async function syncTransactions() {
    try {
        // Get pending transactions from IndexedDB
        const pendingTransactions = await getPendingTransactions();

        for (const transaction of pendingTransactions) {
            await syncTransaction(transaction);
        }
    } catch (error) {
        console.error('Sync failed:', error);
    }
}

// Push notification handling
self.addEventListener('push', event => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'New notification',
        icon: '/images/icon-192.png',
        badge: '/images/badge-72.png',
        data: data.url || '/'
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Hans Financial Note', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // Focus existing window if available
                for (const client of windowClients) {
                    if (client.url === event.notification.data && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data);
                }
            })
    );
});

// Message handling from main app
self.addEventListener('message', event => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
