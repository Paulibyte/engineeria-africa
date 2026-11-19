// Engineeria Africa service worker — offline reading + breaking-news push alerts
const VERSION = 'ea-v5';
const SHELL = ['/', '/app.js?v=5', '/styles.css?v=5', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/badge-72.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION + '-shell').then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error('offline');
  }
}
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/go/') || req.headers.get('range')) return; // ad redirects, video streaming
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/', { ignoreSearch: true })));
    return;
  }
  if (url.pathname.startsWith('/api/admin') || url.pathname.startsWith('/api/my') || url.pathname.startsWith('/api/auth')) return;
  if (url.pathname.startsWith('/api/')) { e.respondWith(networkFirst(req, VERSION + '-api').catch(() => new Response(JSON.stringify({ error: 'You are offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))); return; }
  if (url.pathname.startsWith('/uploads/') && /\.(webp|png|jpe?g|gif)$/i.test(url.pathname)) { e.respondWith(cacheFirst(req, VERSION + '-img')); return; }
  e.respondWith(networkFirst(req, VERSION + '-shell'));
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'Engineeria Africa', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Engineeria Africa', {
    body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', tag: d.tag || 'ea',
    renotify: true, requireInteraction: true, vibrate: [200, 100, 200, 100, 300], data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
