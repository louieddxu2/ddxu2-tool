import { test, expect } from '@playwright/test';

const SHARE_CACHE = 'share-target-cache';
const SHARED_PAYLOAD = '/_shared_payload';
const SHARED_STATUS = '/_shared_status';
const SHARED_IMAGE = '/_shared_image';
const SHARED_ZIP = '/_shared_zip';

async function openControlledLauncher(page) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function clearSharedFiles(page) {
  await page.evaluate(async ({ cacheName, keys }) => {
    const cache = await caches.open(cacheName);
    await Promise.all(keys.map((key) => cache.delete(key)));
  }, {
    cacheName: SHARE_CACHE,
    keys: [SHARED_PAYLOAD, SHARED_STATUS, SHARED_IMAGE, SHARED_ZIP],
  });
}

async function shareGeneratedPng(page, {
  fieldName = 'image',
  fileName = 'translated-image.png',
  type = 'image/png',
  path = '/_share-target/chinese-card',
} = {}) {
  return page.evaluate(async ({ fieldName, fileName, type, path }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 3;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ef4444';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const file = new File([await png.arrayBuffer()], fileName, { type });
    const form = new FormData();
    form.append('title', 'Google 圖片翻譯');
    form.append('text', '這是一段應被忽略的分享文字');
    form.append(fieldName, file);
    const response = await fetch(path, {
      method: 'POST',
      body: form,
    });
    return response.url;
  }, { fieldName, fileName, type, path });
}

test.beforeEach(async ({ page }) => {
  await openControlledLauncher(page);
  await clearSharedFiles(page);
});

test('manifest exposes one image-only Android share field', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  const files = manifest.share_target.params.files;

  expect(manifest.share_target.action).toBe('/_share-target/chinese-card');
  expect(manifest.share_target.method).toBe('POST');
  expect(manifest.share_target.enctype).toBe('multipart/form-data');
  expect(manifest.share_target.params.title).toBe('title');
  expect(manifest.share_target.params.text).toBe('text');
  expect(files).toHaveLength(1);
  expect(files[0]).toEqual({
    name: 'image',
    accept: ['image/*'],
  });
});

test('opens crop view for a Google image translation share', async ({ page }) => {
  const targetUrl = await shareGeneratedPng(page);

  await page.goto(targetUrl);
  await expect(page.locator('#view-crop')).toBeVisible();
  const canvasSize = await page.locator('#canvas-source').evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
  }));
  expect(canvasSize.width).toBeGreaterThan(0);
  expect(canvasSize.height).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(async ({ cacheName, payloadKey }) => {
    const cache = await caches.open(cacheName);
    return Boolean(await cache.match(payloadKey));
  }, { cacheName: SHARE_CACHE, payloadKey: SHARED_PAYLOAD })).toBe(false);
});

test('recovers an image that an older service worker stored as a zip', async ({ page }) => {
  await page.evaluate(async ({ cacheName, zipKey }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 3;
    const context = canvas.getContext('2d');
    context.fillStyle = '#22c55e';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const cache = await caches.open(cacheName);
    await cache.put(zipKey, new Response(png, {
      headers: { 'Content-Type': 'application/octet-stream' },
    }));
  }, { cacheName: SHARE_CACHE, zipKey: SHARED_ZIP });

  await page.goto('/Chinese-card/index.html?shared=1');
  await expect(page.locator('#view-crop')).toBeVisible();
  await expect(page.locator('#canvas-source')).toHaveJSProperty('width', 2);
  await expect(page.locator('#canvas-source')).toHaveJSProperty('height', 3);
});

test('recovers an image that an older service worker stored with a generic MIME', async ({ page }) => {
  await page.evaluate(async ({ cacheName, imageKey }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 3;
    const context = canvas.getContext('2d');
    context.fillStyle = '#3b82f6';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const cache = await caches.open(cacheName);
    await cache.put(imageKey, new Response(await png.arrayBuffer(), {
      headers: { 'Content-Type': 'application/octet-stream' },
    }));
  }, { cacheName: SHARE_CACHE, imageKey: SHARED_IMAGE });

  await page.goto('/Chinese-card/?shared=1');
  await expect(page.locator('#view-crop')).toBeVisible();
  await expect(page.locator('#canvas-source')).toHaveJSProperty('width', 2);
  await expect(page.locator('#canvas-source')).toHaveJSProperty('height', 3);
});

test('opens crop view from a top-level multipart share navigation', async ({ page }) => {
  const pngBytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 3;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f97316';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return Array.from(new Uint8Array(await png.arrayBuffer()));
  });

  await page.goto('http://127.0.0.1:3000/__share_source__');
  await page.setContent(`
    <form method="POST" enctype="multipart/form-data" action="http://localhost:3000/_share-target/chinese-card">
      <input id="shared-file" type="file" name="image">
      <button type="submit">share</button>
    </form>
  `);
  await page.locator('#shared-file').setInputFiles({
    name: 'translated-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from(pngBytes),
  });

  await Promise.all([
    page.waitForURL(/\/Chinese-card\/(?:\?shared=1)?$/),
    page.getByRole('button', { name: 'share' }).click(),
  ]);

  await expect(page.locator('#view-crop')).toBeVisible();
  await expect(page.locator('#canvas-source')).toHaveJSProperty('width', 2);
  await expect(page.locator('#canvas-source')).toHaveJSProperty('height', 3);
});

test('consumes a cached image when PWA navigation drops the shared query flag', async ({ page }) => {
  await shareGeneratedPng(page);

  await page.goto('/Chinese-card/index.html');
  await expect(page.locator('#view-crop')).toBeVisible();
  await expect(page.locator('#canvas-source')).toHaveJSProperty('width', 2);
  await expect(page.locator('#canvas-source')).toHaveJSProperty('height', 3);
});

test('consumes a cached image when Android resumes an existing PWA window', async ({ page }) => {
  await page.goto('/Chinese-card/index.html');
  await shareGeneratedPng(page);

  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#view-crop')).toBeVisible();
  await expect(page.locator('#canvas-source')).toHaveJSProperty('width', 2);
  await expect(page.locator('#canvas-source')).toHaveJSProperty('height', 3);
});

test('does not accept zip files from an unrelated share field', async ({ page }) => {
  await page.evaluate(async () => {
    const form = new FormData();
    form.append('file', new File(['PK\u0003\u0004'], 'backup.zip', { type: 'application/zip' }));
    await fetch('/_share-target/chinese-card', { method: 'POST', body: form });
  });

  const cached = await page.evaluate(async ({ cacheName, payloadKey, imageKey, zipKey, statusKey }) => {
    const cache = await caches.open(cacheName);
    const payload = await cache.match(payloadKey);
    const status = await cache.match(statusKey);
    return {
      payload: Boolean(payload),
      image: Boolean(await cache.match(imageKey)),
      zip: Boolean(await cache.match(zipKey)),
      status: status ? await status.json() : null,
    };
  }, {
    cacheName: SHARE_CACHE,
    payloadKey: SHARED_PAYLOAD,
    imageKey: SHARED_IMAGE,
    zipKey: SHARED_ZIP,
    statusKey: SHARED_STATUS,
  });

  expect(cached.payload).toBe(false);
  expect(cached.image).toBe(false);
  expect(cached.zip).toBe(false);
  expect(cached.status.stage).toBe('sw-no-image');
});

test('records sw-no-image for title and text without an image', async ({ page }) => {
  const targetUrl = await page.evaluate(async () => {
    const form = new FormData();
    form.append('title', 'Google 圖片翻譯');
    form.append('text', '這是一段應被忽略的分享文字');
    const response = await fetch('/_share-target/chinese-card', {
      method: 'POST',
      body: form,
    });
    return response.url;
  });

  const status = await page.evaluate(async ({ cacheName, statusKey }) => {
    const cache = await caches.open(cacheName);
    const response = await cache.match(statusKey);
    return response ? response.json() : null;
  }, { cacheName: SHARE_CACHE, statusKey: SHARED_STATUS });

  expect(status.stage).toBe('sw-no-image');
  expect(status.fields).toEqual([
    { name: 'title', kind: 'text' },
    { name: 'text', kind: 'text' },
  ]);
  expect(JSON.stringify(status)).not.toContain('Google 圖片翻譯');
  expect(JSON.stringify(status)).not.toContain('這是一段應被忽略的分享文字');

  await page.goto(targetUrl);
  await expect(page.locator('#view-crop')).toBeHidden();
  const error = page.locator('#share-target-error');
  await expect(error).toBeVisible();
  await expect(error).toHaveAttribute('data-share-error', 'sw-no-image');

  await expect(page).toHaveURL(/\/Chinese-card\/$/);
  await page.reload();
  await expect(page.locator('#share-target-error')).toHaveCount(0);

  const savedStatus = await page.evaluate(async ({ cacheName, statusKey }) => {
    const cache = await caches.open(cacheName);
    const response = await cache.match(statusKey);
    return response ? response.json() : null;
  }, { cacheName: SHARE_CACHE, statusKey: SHARED_STATUS });
  expect(savedStatus.stage).toBe('sw-no-image');
});

test('accepts the share target path with a trailing slash', async ({ page }) => {
  const targetUrl = await shareGeneratedPng(page, {
    path: '/_share-target/chinese-card/',
  });

  await page.goto(targetUrl);
  await expect(page.locator('#view-crop')).toBeVisible();
});

test('waits for a payload that arrives after the PWA page resumes', async ({ page }) => {
  await page.goto('/Chinese-card/?shared=1');

  await page.evaluate(async ({ cacheName, payloadKey }) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 3;
    const context = canvas.getContext('2d');
    context.fillStyle = '#a855f7';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const cache = await caches.open(cacheName);
    await cache.put(payloadKey, new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'X-Share-Name': 'camera.png',
      },
    }));
  }, { cacheName: SHARE_CACHE, payloadKey: SHARED_PAYLOAD });

  await expect(page.locator('#view-crop')).toBeVisible();
  await expect(page.locator('#canvas-source')).toHaveJSProperty('width', 2);
  await expect(page.locator('#canvas-source')).toHaveJSProperty('height', 3);
});

test('keeps an undecodable payload and reports the page processing stage', async ({ page }) => {
  await page.evaluate(async ({ cacheName, payloadKey }) => {
    const cache = await caches.open(cacheName);
    await cache.put(payloadKey, new Response(new Uint8Array([1, 2, 3, 4]), {
      headers: {
        'Content-Type': 'image/jpeg',
        'X-Share-Name': 'broken.jpg',
      },
    }));
  }, { cacheName: SHARE_CACHE, payloadKey: SHARED_PAYLOAD });

  await page.goto('/Chinese-card/?shared=1');
  const error = page.locator('#share-target-error');
  await expect(error).toBeVisible();
  await expect(error).toHaveAttribute('data-share-error', 'page-process-failed');
  await expect.poll(() => page.evaluate(async ({ cacheName, payloadKey }) => {
    const cache = await caches.open(cacheName);
    return Boolean(await cache.match(payloadKey));
  }, { cacheName: SHARE_CACHE, payloadKey: SHARED_PAYLOAD })).toBe(true);
});
