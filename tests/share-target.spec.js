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

async function shareGeneratedPng(page, { fieldName, fileName, type }) {
  return page.evaluate(async ({ fieldName, fileName, type }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 3;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ef4444';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const file = new File([await png.arrayBuffer()], fileName, { type });
    const form = new FormData();
    form.append(fieldName, file);
    const response = await fetch('/_share-target/chinese-card', {
      method: 'POST',
      body: form,
    });
    return response.url;
  }, { fieldName, fileName, type });
}

test.beforeEach(async ({ page }) => {
  await openControlledLauncher(page);
  await clearSharedFiles(page);
});

test('opens crop view when an image uses the manifest image field', async ({ page }) => {
  const targetUrl = await shareGeneratedPng(page, {
    fieldName: 'image',
    fileName: 'camera.png',
    type: 'image/png',
  });

  await page.goto(targetUrl);
  await expect(page.locator('#view-crop')).toBeVisible();
  await expect(page.locator('#canvas-source')).toHaveJSProperty('width', 2);
  await expect(page.locator('#canvas-source')).toHaveJSProperty('height', 3);
  await expect.poll(() => page.evaluate(async ({ cacheName, payloadKey }) => {
    const cache = await caches.open(cacheName);
    return Boolean(await cache.match(payloadKey));
  }, { cacheName: SHARE_CACHE, payloadKey: SHARED_PAYLOAD })).toBe(false);
});

test('opens crop view when a phone sends an image through the generic file field', async ({ page }) => {
  const targetUrl = await shareGeneratedPng(page, {
    fieldName: 'file',
    fileName: 'camera.png',
    type: 'application/octet-stream',
  });

  await page.goto(targetUrl);
  await expect(page.locator('#view-crop')).toBeVisible();
  await expect(page.locator('#canvas-source')).toHaveJSProperty('width', 2);
  await expect(page.locator('#canvas-source')).toHaveJSProperty('height', 3);
});

test('stores an extensionless generic Android file as one raw payload', async ({ page }) => {
  const targetUrl = await shareGeneratedPng(page, {
    fieldName: 'file',
    fileName: 'camera',
    type: 'application/octet-stream',
  });

  const cached = await page.evaluate(async ({ cacheName, payloadKey, imageKey, zipKey }) => {
    const cache = await caches.open(cacheName);
    const payload = await cache.match(payloadKey);
    return {
      payload: Boolean(payload),
      field: payload?.headers.get('X-Share-Field'),
      image: Boolean(await cache.match(imageKey)),
      zip: Boolean(await cache.match(zipKey)),
    };
  }, {
    cacheName: SHARE_CACHE,
    payloadKey: SHARED_PAYLOAD,
    imageKey: SHARED_IMAGE,
    zipKey: SHARED_ZIP,
  });

  expect(cached).toEqual({ payload: true, field: 'file', image: false, zip: false });
  await page.goto(targetUrl);
  await expect(page.locator('#view-crop')).toBeVisible();
  await expect(page.locator('#canvas-source')).toHaveJSProperty('width', 2);
  await expect(page.locator('#canvas-source')).toHaveJSProperty('height', 3);
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
      <input id="shared-file" type="file" name="file">
      <button type="submit">share</button>
    </form>
  `);
  await page.locator('#shared-file').setInputFiles({
    name: 'camera',
    mimeType: 'application/octet-stream',
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
  await shareGeneratedPng(page, {
    fieldName: 'image',
    fileName: 'camera.png',
    type: 'image/png',
  });

  await page.goto('/Chinese-card/index.html');
  await expect(page.locator('#view-crop')).toBeVisible();
  await expect(page.locator('#canvas-source')).toHaveJSProperty('width', 2);
  await expect(page.locator('#canvas-source')).toHaveJSProperty('height', 3);
});

test('consumes a cached image when Android resumes an existing PWA window', async ({ page }) => {
  await page.goto('/Chinese-card/index.html');
  await shareGeneratedPng(page, {
    fieldName: 'image',
    fileName: 'camera.png',
    type: 'image/png',
  });

  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#view-crop')).toBeVisible();
  await expect(page.locator('#canvas-source')).toHaveJSProperty('width', 2);
  await expect(page.locator('#canvas-source')).toHaveJSProperty('height', 3);
});

test('keeps zip files on the import path', async ({ page }) => {
  await page.evaluate(async () => {
    const form = new FormData();
    form.append('file', new File(['PK\u0003\u0004'], 'backup.zip', { type: 'application/zip' }));
    await fetch('/_share-target/chinese-card', { method: 'POST', body: form });
  });

  const cached = await page.evaluate(async ({ cacheName, payloadKey, imageKey, zipKey }) => {
    const cache = await caches.open(cacheName);
    const payload = await cache.match(payloadKey);
    return {
      payload: Boolean(payload),
      contentType: payload?.headers.get('Content-Type'),
      image: Boolean(await cache.match(imageKey)),
      zip: Boolean(await cache.match(zipKey)),
    };
  }, {
    cacheName: SHARE_CACHE,
    payloadKey: SHARED_PAYLOAD,
    imageKey: SHARED_IMAGE,
    zipKey: SHARED_ZIP,
  });

  expect(cached).toEqual({
    payload: true,
    contentType: 'application/zip',
    image: false,
    zip: false,
  });
});

test('shows a visible diagnostic when Android opens the target without a file', async ({ page }) => {
  const targetUrl = await page.evaluate(async () => {
    const form = new FormData();
    form.append('text', 'camera provider did not attach a file');
    const response = await fetch('/_share-target/chinese-card', {
      method: 'POST',
      body: form,
    });
    return response.url;
  });

  await page.goto(targetUrl);
  const error = page.locator('#share-target-error');
  await expect(error).toBeVisible();
  await expect(error).toHaveAttribute('data-share-error', 'sw-no-file');
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
