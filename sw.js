const CACHE_NAME = 'ddxu2-launcher-v5';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([
      '/',
      '/index.html',
      '/manifest.webmanifest',
      '/pwa-icon.svg',
      '/pwa-maskable.svg',
    ]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key)))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method === 'POST' && url.pathname === '/_share-target/chinese-card') {
    event.respondWith((async () => {
      try {
        const formData = await req.formData();
        const imageFile = formData.get('image');
        
        if (imageFile) {
          const cache = await caches.open('share-target-cache');
          await cache.put('/_shared_image', new Response(imageFile, {
            headers: { 'Content-Type': imageFile.type }
          }));
        }
        
        return Response.redirect('/Chinese-card/index.html?shared=1', 303);
      } catch (e) {
        return Response.redirect('/Chinese-card/index.html', 303);
      }
    })());
    return;
  }

  if (req.method !== 'GET') return;

  // HTML 導航：以網路為主（拿最新），失敗才回快取
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('/index.html')))
    );
    return;
  }

  // 其他靜態：快取優先，沒有再走網路並寫回快取
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      });
    })
  );
});
