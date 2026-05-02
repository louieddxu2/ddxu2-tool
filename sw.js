const CACHE_NAME = 'ddxu2-launcher-v1';

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

  // 1. Share Target (Essential)
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

  // 2. Efficient Update: Only revalidate HTML
  // Assets are served strictly from cache unless HTML changes.
  event.respondWith(
    caches.match(req).then((cached) => {
      // If it's a navigation or HTML request, always check network (Sentinel)
      if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        }).catch(() => cached);
      }
      
      // For everything else (JS/CSS), use cache if available, otherwise fetch once
      return cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
