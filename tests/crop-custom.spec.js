import { test, expect } from '@playwright/test';

async function openTestImage(page) {
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // 讓兩種預設比例的裁切框都位於圖片內，避免觸發邊界限制。
    localStorage.setItem('bg_crop_widthPct', '0.4');
    localStorage.setItem('bg_crop_centerYPct', '0.85');
    localStorage.setItem('bg_crop_angle', '0');
    await new Promise((resolve, reject) => {
      window.openCropView(canvas.toDataURL(), '', {
        onLoad: resolve,
        onError: reject,
      });
    });
  });
  await expect(page.locator('#view-crop')).toBeVisible();
  await expect(page.locator('#crop-loading')).toBeHidden();
  await expect(page.locator('#canvas-source')).toHaveJSProperty('width', 1000);
  await expect(page.locator('#canvas-source')).toHaveJSProperty('height', 1000);
}

async function readCropGeometry(page) {
  return page.locator('#crop-polygon').evaluate((polygon) => {
    const points = polygon.getAttribute('points').split(' ').map((point) => {
      const [x, y] = point.split(',').map(Number);
      return { x, y };
    });
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    return {
      top: points.slice(0, 2),
      bottom: [points[3], points[2]],
      width: distance(points[3], points[2]),
      height: distance(points[3], points[0]),
    };
  });
}

function expectBottomUnchanged(actual, expected) {
  for (let index = 0; index < expected.bottom.length; index += 1) {
    expect(actual.bottom[index].x).toBeCloseTo(expected.bottom[index].x, 6);
    expect(actual.bottom[index].y).toBeCloseTo(expected.bottom[index].y, 6);
  }
}

async function clickImageCenter(page) {
  const box = await page.locator('#canvas-source').boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test.describe('裁切核心邏輯測試', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    await expect.poll(() => page.evaluate(() => window.UIState?.isDBReady)).toBe(true);

    // 手機瀏覽器會顯示安裝提示；先以正常操作關閉，才能操作裁切工具。
    const prompt = page.locator('#pwa-prompt');
    await prompt.getByRole('button', { name: '我了解了', exact: true }).click();
    await expect(prompt).toHaveCount(0);
    await openTestImage(page);
  });

  test('切換預設比例時，底邊兩端必須固定不動', async ({ page }) => {
    const before = await readCropGeometry(page);

    const ratioButton = page.locator('.ratio-btn[data-ratio="70:120"]');
    await ratioButton.click();
    await expect(ratioButton).toHaveClass(/bg-emerald-600/);
    const after = await readCropGeometry(page);

    expectBottomUnchanged(after, before);
    expect(after.height).not.toBeCloseTo(before.height, 6);
    expect(await page.evaluate(() => window.cropRatio)).toBeCloseTo(70 / 120, 6);
  });

  test('自訂模式可拖曳上緣線調整高度，切回預設時隱藏上緣線', async ({ page }) => {
    const edge = page.locator('#ind-top-edge');
    await expect(edge).toHaveCount(0);
    await page.locator('#custom-ratio-box').click();
    // 水平 SVG 線的幾何高度為零，應檢查顯示狀態並實際拖曳驗證。
    await expect(edge).toHaveCSS('display', 'block');
    await expect(page.locator('#crop-svg')).toBeVisible();
    await expect(page.locator('#ind-p3')).toHaveCount(0);

    const before = await readCropGeometry(page);
    const canvasBox = await page.locator('#canvas-source').boundingBox();
    expect(canvasBox).not.toBeNull();
    const edgeX = canvasBox.x + (before.top[0].x + before.top[1].x) / 2;
    const edgeY = canvasBox.y + (before.top[0].y + before.top[1].y) / 2;
    await page.mouse.move(edgeX, edgeY);
    await page.mouse.down();
    await page.mouse.move(edgeX, edgeY + canvasBox.height * 0.1, { steps: 5 });
    await page.mouse.up();
    const after = await readCropGeometry(page);

    expect(after.height).toBeLessThan(before.height);
    expectBottomUnchanged(after, before);

    await page.locator('.ratio-btn[data-ratio="70:120"]').click();
    await expect(edge).toHaveCSS('display', 'none');
  });

  test('自訂模式點擊底邊上方可調整高度，底邊兩端保持不動', async ({ page }) => {
    const customButton = page.locator('#custom-ratio-box');
    await customButton.click();
    await expect(customButton).toHaveClass(/bg-emerald-600/);
    await expect(page.locator('#ind-top-edge')).toHaveCSS('display', 'block');
    const before = await readCropGeometry(page);

    await clickImageCenter(page);
    const after = await readCropGeometry(page);

    expect(after.height).not.toBeCloseTo(before.height, 6);
    expectBottomUnchanged(after, before);
  });

  test('標準模式點擊移動底角後，仍維持原本長寬比', async ({ page }) => {
    expect(await page.evaluate(() => Boolean(window.isCustomMode))).toBe(false);
    const before = await readCropGeometry(page);

    await clickImageCenter(page);
    const after = await readCropGeometry(page);

    // 確認點擊確實移動了底角，再檢查幾何比例，避免未操作就誤判通過。
    expect(after.bottom).not.toEqual(before.bottom);
    expect(before.width).toBeGreaterThan(0);
    expect(before.height).toBeGreaterThan(0);
    expect(after.width).toBeGreaterThan(0);
    expect(after.height).toBeGreaterThan(0);
    expect(after.width / after.height).toBeCloseTo(before.width / before.height, 6);
  });
});
