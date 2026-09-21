import { test, expect } from '@playwright/test';

const SHARE_CACHE = 'share-target-cache';
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
  }, { cacheName: SHARE_CACHE, keys: [SHARED_IMAGE, SHARED_ZIP] });
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

test('keeps zip files on the import path', async ({ page }) => {
  await page.evaluate(async () => {
    const form = new FormData();
    form.append('file', new File(['PK\u0003\u0004'], 'backup.zip', { type: 'application/zip' }));
    await fetch('/_share-target/chinese-card', { method: 'POST', body: form });
  });

  const cached = await page.evaluate(async ({ cacheName, imageKey, zipKey }) => {
    const cache = await caches.open(cacheName);
    return {
      image: Boolean(await cache.match(imageKey)),
      zip: Boolean(await cache.match(zipKey)),
    };
  }, { cacheName: SHARE_CACHE, imageKey: SHARED_IMAGE, zipKey: SHARED_ZIP });

  expect(cached).toEqual({ image: false, zip: true });
});
