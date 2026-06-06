'use strict';

const CACHE_NAME = 'telegram-aios-dashboard-static-v36-phase41-portfolio';
const STATIC_ASSETS = [
  '/dashboard',
  '/dashboard/styles.css',
  '/dashboard/mobile.css',
  '/dashboard/app.js',
  '/dashboard/api.js',
  '/dashboard/ui.js',
  '/dashboard/auth.js',
  '/dashboard/pwa.js',
  '/dashboard/utils.js',
  '/dashboard/state.js',
  '/dashboard/charts.js',
  '/dashboard/graph.js',
  '/dashboard/export.js',
  '/dashboard/downloads.js',
  '/dashboard/import-ui.js',
  '/dashboard/manifest.webmanifest',
  '/dashboard/icons/icon.svg',
  '/dashboard/realtime-monitoring.js',
  '/dashboard/cicd.js',
  '/dashboard/githubops.js',
  '/dashboard/deploy.js',
  '/dashboard/observability.js',
  '/dashboard/portfolio.js'
];

function isSensitiveRequest(request) {
  const url = new URL(request.url);
  return (
    url.pathname.startsWith('/api/dashboard') ||
    url.pathname.includes('/backup/') ||
    request.headers.has('authorization') ||
    request.method !== 'GET'
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_PWA_CACHE') {
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(key => caches.delete(key))))
        .then(() => self.clients.matchAll({ type: 'window' }))
        .then(clients => clients.forEach(client => client.postMessage({ type: 'PWA_CACHE_CLEARED' })))
    );
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (isSensitiveRequest(request)) return;

  const url = new URL(request.url);
  if (url.pathname === '/dashboard' || url.pathname === '/dashboard/') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/dashboard', clone));
          return response;
        })
        .catch(() => caches.match('/dashboard').then(cached => cached || new Response(
          '<!doctype html><html><body><main style="font-family:sans-serif;padding:24px"><h1>Dashboard offline</h1><p>Static shell belum tersedia. Sambungkan internet lalu reload.</p></main></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (!response || response.status !== 200 || response.type === 'opaque') return response;
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      return response;
    }))
  );
});
