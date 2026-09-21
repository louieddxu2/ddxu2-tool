const CACHE_NAME = 'ddxu2-launcher-v36';
const CACHE_NAME_PREFIX = 'ddxu2-launcher-';
const SHARE_CACHE_NAME = 'share-target-cache';
const SHARED_IMAGE_KEY = '/_shared_image';
const SHARED_ZIP_KEY = '/_shared_zip';

function getSharedFileKind(file, fieldName) {
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();

  if (type.startsWith('image/') || /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/.test(name)) {
    return 'image';
  }
  if (type === 'application/zip' || type === 'application/x-zip-compressed' || /\.zip$/.test(name)) {
    return 'zip';
  }

  // Preserve the manifest field meanings when the sender omits useful metadata.
  if (fieldName === 'image') return 'image';
  if (fieldName === 'file') return 'zip';
  return null;
}

function getSharedImageContentType(file) {
  const type = String(file.type || '').toLowerCase();
  if (type.startsWith('image/')) return type;

  const extension = String(file.name || '').toLowerCase().match(/\.([^.]+)$/)?.[1];
  const typesByExtension = {
    avif: 'image/avif',
    bmp: 'image/bmp',
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    webp: 'image/webp',
  };
  return typesByExtension[extension] || 'image/jpeg';
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_NAME_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
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
        const sharedFiles = Array.from(formData.entries())
          .filter(([, value]) => value && typeof value !== 'string')
          .map(([fieldName, file]) => ({
            file,
            kind: getSharedFileKind(file, fieldName),
          }));
        const imageFile = sharedFiles.find(({ kind }) => kind === 'image')?.file;
        const zipFile = sharedFiles.find(({ kind }) => kind === 'zip')?.file;
        const cache = await caches.open(SHARE_CACHE_NAME);

        // Each invocation represents a new share operation; never mix in stale payloads.
        await Promise.all([
          cache.delete(SHARED_IMAGE_KEY),
          cache.delete(SHARED_ZIP_KEY),
        ]);

        if (imageFile) {
          await cache.put(SHARED_IMAGE_KEY, new Response(imageFile, {
            headers: { 'Content-Type': getSharedImageContentType(imageFile) },
          }));
        }
        if (zipFile) {
          await cache.put(SHARED_ZIP_KEY, new Response(zipFile, {
            headers: { 'Content-Type': zipFile.type || 'application/zip' },
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
        .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(req)))
    );
    return;
  }

  // 3. Assets: Cache-First
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => cache.match(req).then((cached) => {
      return cached || fetch(req).then((res) => {
        const copy = res.clone();
        cache.put(req, copy);
        return res;
      });
    }))
  );
});
