const CACHE_NAME = 'ddxu2-launcher-v8';

self.addEventListener('install', (event) => {
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

  // 1. Share Target logic
  if (req.method === 'POST' && url.pathname === '/_share-target/chinese-card') {
    event.respondWith((async () => {
      try {
        const formData = await req.formData();
        const imageFile = formData.get('image');
        const zipFile = formData.get('file');
        const cache = await caches.open('share-target-cache');
        if (imageFile) await cache.put('/_shared_image', new Response(imageFile, { headers: { 'Content-Type': imageFile.type } }));
        if (zipFile) await cache.put('/_shared_zip', new Response(zipFile, { headers: { 'Content-Type': zipFile.type || 'application/zip' } }));
        return Response.redirect('/Chinese-card/index.html?shared=1', 303);
      } catch (e) {
        return Response.redirect('/Chinese-card/index.html', 303);
      }
    })());
    return;
  }

  if (req.method !== 'GET') return;

  // 2. HTML: Network-First (Ensure versioning info is fresh, fallback to cache)
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('/Chinese-card/index.html')))
    );
    return;
  }

  // 3. Versioned Assets (JS/CSS/Img): Cache-First (Fastest, no network if cached)
  // Because we use ?v= query strings, the URL will change if the content changes.
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
