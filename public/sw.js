const V = 'swipee-v3', SHELL = ['/', '/style.css', '/app.js', '/manifest.webmanifest', '/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting() });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => clients.claim())) });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/auth/')) return; // APIと認証は常にネットワーク
  // {cache:'no-store'}でブラウザ側の通常HTTPキャッシュも無視し、常にサーバーの最新版を取りにいく(取れなければservice worker自体のキャッシュにフォールバック)
  const fresh = new Request(e.request, {cache: 'no-store'});
  e.respondWith(fetch(fresh).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r }).catch(() => caches.match(e.request)));
});
