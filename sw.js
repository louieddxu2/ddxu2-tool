const CACHE_NAME = 'ddxu2-launcher-v40';
const CACHE_NAME_PREFIX = 'ddxu2-launcher-';
const SHARE_CACHE_NAME = 'share-target-cache';
const SHARED_PAYLOAD_KEY = '/_shared_payload';
const SHARED_STATUS_KEY = '/_shared_status';
const SHARED_IMAGE_KEY = '/_shared_image';
const SHARED_ZIP_KEY = '/_shared_zip';

function getShareRedirectUrl(params = {}) {
  const url = new URL('/Chinese-card/', self.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.href;
}

async function writeShareStatus(cache, status) {
  await cache.put(SHARED_STATUS_KEY, new Response(JSON.stringify({
    timestamp: Date.now(),
    ...status,
  }), {
    headers: { 'Content-Type': 'application/json' },
  }));
}

async function notifyShareClients(status) {
  try {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    windows.forEach((client) => client.postMessage({
      type: 'chinese-card-share-ready',
      status,
    }));
  } catch (_) {
    // Redirect + foreground polling remain the authoritative delivery path.
  }
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
  const sharePath = url.pathname.replace(/\/+$/, '');

  // 1. Share Target (Essential for PWA functionality)
  if (req.method === 'POST' && sharePath === '/_share-target/chinese-card') {
    event.respondWith((async () => {
      let cache;
      try {
        const formData = await req.formData();
        const entries = Array.from(formData.entries());
        const fields = entries.map(([name, value]) => ({
          name,
          kind: value instanceof File ? 'file' : 'text',
          ...(value instanceof File ? {
            size: value.size,
            type: value.type,
          } : {}),
        }));
        const imageFile = formData.get('image');
        cache = await caches.open(SHARE_CACHE_NAME);

        // Each invocation represents a new share operation; never mix in stale payloads.
        await Promise.all([
          cache.delete(SHARED_PAYLOAD_KEY),
          cache.delete(SHARED_STATUS_KEY),
          cache.delete(SHARED_IMAGE_KEY),
          cache.delete(SHARED_ZIP_KEY),
        ]);

        if (!(imageFile instanceof File) || imageFile.size <= 0) {
          const status = {
            ok: false,
            stage: 'sw-no-image',
            fields,
          };
          await writeShareStatus(cache, status);
          await notifyShareClients(status);
          return Response.redirect(getShareRedirectUrl({
            shared: '1',
            share_error: status.stage,
          }), 303);
        }

        const status = {
          ok: true,
          stage: 'sw-stored',
          fieldName: 'image',
          fileName: imageFile.name || '',
          declaredType: imageFile.type || '',
          size: imageFile.size,
          fields,
        };

        await cache.put(SHARED_PAYLOAD_KEY, new Response(imageFile, {
          headers: {
            'Content-Type': imageFile.type || 'application/octet-stream',
            'X-Share-Name': encodeURIComponent(imageFile.name || 'shared_image'),
          },
        }));
        try {
          await writeShareStatus(cache, status);
        } catch (_) {
          // Diagnostics must not turn a stored photo into a failed share.
        }
        await notifyShareClients(status);
        return Response.redirect(getShareRedirectUrl({ shared: '1' }), 303);
      } catch (error) {
        const status = {
          ok: false,
          stage: 'sw-receive-failed',
          error: error instanceof Error ? error.message : String(error),
        };
        try {
          cache = cache || await caches.open(SHARE_CACHE_NAME);
          await writeShareStatus(cache, status);
          await notifyShareClients(status);
        } catch (_) {
          // The URL error code remains available even when Cache Storage fails.
        }
        return Response.redirect(getShareRedirectUrl({
          shared: '1',
          share_error: status.stage,
        }), 303);
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
