const CACHE_NAME = 'ddxu2-launcher-v38';
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

function getImageTypeFromExtension(name) {
  const extension = String(name || '').toLowerCase().match(/\.([^.]+)$/)?.[1];
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
  return typesByExtension[extension] || null;
}

function getSharedBytesKind(bytes) {
  const startsWith = (...signature) =>
    signature.every((value, index) => bytes[index] === value);
  const asciiAt = (offset, value) =>
    Array.from(value).every(
      (character, index) => bytes[offset + index] === character.charCodeAt(0),
    );

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { kind: 'image', type: 'image/png' };
  }
  if (startsWith(0xff, 0xd8, 0xff)) {
    return { kind: 'image', type: 'image/jpeg' };
  }
  if (asciiAt(0, 'GIF87a') || asciiAt(0, 'GIF89a')) {
    return { kind: 'image', type: 'image/gif' };
  }
  if (asciiAt(0, 'RIFF') && asciiAt(8, 'WEBP')) {
    return { kind: 'image', type: 'image/webp' };
  }
  if (asciiAt(0, 'BM')) {
    return { kind: 'image', type: 'image/bmp' };
  }
  if (
    startsWith(0x49, 0x49, 0x2a, 0x00) ||
    startsWith(0x4d, 0x4d, 0x00, 0x2a)
  ) {
    return { kind: 'image', type: 'image/tiff' };
  }
  if (asciiAt(4, 'ftyp')) {
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
    if (['avif', 'avis'].includes(brand)) {
      return { kind: 'image', type: 'image/avif' };
    }
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) {
      return { kind: 'image', type: 'image/heic' };
    }
  }
  if (
    startsWith(0x50, 0x4b, 0x03, 0x04) ||
    startsWith(0x50, 0x4b, 0x05, 0x06) ||
    startsWith(0x50, 0x4b, 0x07, 0x08)
  ) {
    return { kind: 'zip', type: 'application/zip' };
  }
  return null;
}

async function getSharedFileInfo(file, fieldName) {
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();

  if (type.startsWith('image/')) {
    return { kind: 'image', type };
  }
  const extensionType = getImageTypeFromExtension(name);
  if (extensionType) {
    return { kind: 'image', type: extensionType };
  }
  if (type === 'application/zip' || type === 'application/x-zip-compressed' || /\.zip$/.test(name)) {
    return { kind: 'zip', type: 'application/zip' };
  }

  // Android share providers often expose content URIs without a useful name or
  // MIME type. Inspect the payload before trusting the manifest field name.
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const bytesKind = getSharedBytesKind(bytes);
  if (bytesKind) {
    return bytesKind;
  }

  // Preserve the manifest field meanings when the sender omits useful metadata.
  if (fieldName === 'image') return { kind: 'image', type: 'image/jpeg' };
  if (fieldName === 'file') return { kind: 'zip', type: 'application/zip' };
  return { kind: null, type };
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
      let cache;
      try {
        const formData = await req.formData();
        const entries = Array.from(formData.entries());
        const sharedFiles = await Promise.all(entries
          .filter(([, value]) => value && typeof value !== 'string')
          .map(async ([fieldName, file]) => ({
            fieldName,
            file,
            info: await getSharedFileInfo(file, fieldName),
          })));
        cache = await caches.open(SHARE_CACHE_NAME);

        // Each invocation represents a new share operation; never mix in stale payloads.
        await Promise.all([
          cache.delete(SHARED_PAYLOAD_KEY),
          cache.delete(SHARED_STATUS_KEY),
          cache.delete(SHARED_IMAGE_KEY),
          cache.delete(SHARED_ZIP_KEY),
        ]);

        const selectedEntry = sharedFiles.find(({ info }) => info.kind === 'image')
          || sharedFiles[0];

        if (!selectedEntry) {
          const status = {
            ok: false,
            stage: 'sw-no-file',
            fields: entries.map(([fieldName, value]) => ({
              fieldName,
              valueType: typeof value,
            })),
          };
          await writeShareStatus(cache, status);
          await notifyShareClients(status);
          return Response.redirect(getShareRedirectUrl({
            shared: '1',
            share_error: status.stage,
          }), 303);
        }

        const contentType = selectedEntry.info.type
          || selectedEntry.file.type
          || 'application/octet-stream';
        const status = {
          ok: true,
          stage: 'sw-stored',
          fieldName: selectedEntry.fieldName,
          fileName: selectedEntry.file.name || '',
          declaredType: selectedEntry.file.type || '',
          detectedKind: selectedEntry.info.kind || 'unknown',
          detectedType: selectedEntry.info.type || '',
          size: selectedEntry.file.size,
          fileCount: sharedFiles.length,
        };

        // Store one untouched payload. Format routing belongs to the foreground
        // page, where failures can be reported instead of silently redirecting.
        await cache.put(SHARED_PAYLOAD_KEY, new Response(selectedEntry.file, {
          headers: {
            'Content-Type': contentType,
            'X-Share-Field': encodeURIComponent(selectedEntry.fieldName),
            'X-Share-Name': encodeURIComponent(selectedEntry.file.name || ''),
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
