const CACHE_NAME = 'ddxu2-launcher-v26';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Share Target (Essential for PWA functionality)
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

  // 2. HTML Sentinel: Revalidate with network (ETag/304 support)
  const isHtml = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHtml) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' }) // <--- Revalidate: Use cache only if server says 304
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 3. Assets: Cache-First
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
