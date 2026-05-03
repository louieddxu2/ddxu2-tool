import { test, expect } from '@playwright/test';

test.describe('裁切核心邏輯測試 (TDD)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    await page.waitForLoadState('domcontentloaded');
  });

  test('切換比例時，底邊 (p1/p2) 必須固定不動', async ({ page }) => {
    // 注入一張測試圖片
    await page.evaluate(() => {
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      
      const url = URL.createObjectURL(blob);
      window.openCropView(url);
    });

    // 等待初始化
    await page.waitForTimeout(500);

    const p1 = page.locator('#ind-p1');
    const p2 = page.locator('#ind-p2');

    // 取得原本的座標
    const originalP1 = await p1.boundingBox();
    const originalP2 = await p2.boundingBox();

    // 點擊另一個預設比例按鈕 (例如 70:120)
    await page.locator('.ratio-btn[data-ratio="70:120"]').click();

    // 取得切換後的座標
    const newP1 = await p1.boundingBox();
    const newP2 = await p2.boundingBox();

    // 斷言：切換比例後，底線 (p1, p2) 的座標必須完全不變
    // 在原本的 Bug 中，因為以中心放大，p1 和 p2 會往下移，所以這個測試會失敗！
    expect(newP1.x).toBeCloseTo(originalP1.x, 0);
    expect(newP1.y).toBeCloseTo(originalP1.y, 0);
    expect(newP2.x).toBeCloseTo(originalP2.x, 0);
    expect(newP2.y).toBeCloseTo(originalP2.y, 0);
  });

  test('點擊自訂比例時，應出現第三控制點 (ind-p3)', async ({ page }) => {
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      window.openCropView(canvas.toDataURL());
    });
    await page.waitForTimeout(500);

    const p3 = page.locator('#ind-p3');
    
    // 一開始預設是 63:88，不該有 p3
    await expect(p3).toBeHidden();

    // 點擊自訂比例按鈕
    const customBtn = page.locator('#custom-ratio-box');
    await customBtn.click();

    // 斷言：點擊後必須出現第三控制點
    await expect(p3).toBeVisible();
  });

  test('在自訂模式下單擊上方，應能改變裁切框高度 (3-Tap)', async ({ page }) => {
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      window.openCropView(canvas.toDataURL());
    });
    await page.waitForTimeout(500);

    // 1. 進入自訂模式
    const customBtn = page.locator('#custom-ratio-box');
    await customBtn.click();
    
    // 檢查樣式是否變為選中狀態 (bg-emerald-600)
    await expect(customBtn).toHaveClass(/bg-emerald-600/);
    
    // 檢查 p3 是否出現
    const p3 = page.locator('#ind-p3');
    await expect(p3).toBeVisible();

    const polygon = page.locator('#crop-polygon');
    const getPoints = async () => {
      const ptsStr = await polygon.getAttribute('points');
      return ptsStr.split(' ').map(p => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      });
    };

    const initialPoints = await getPoints();
    const initialTopY = initialPoints[0].y;

    // 2. 在畫面上方點擊 (Y=100)
    const container = page.locator('#crop-container');
    const box = await container.boundingBox();
    // 我們直接使用 dispatchEvent 來模擬精確的點擊，避免 mouse.click 可能的偏移
    await page.mouse.click(box.x + box.width / 2, box.y + 100);

    await page.waitForTimeout(500);

    // 3. 驗證高度是否改變
    const newPoints = await getPoints();
    const newTopY = newPoints[0].y;

    console.log(`Initial TopY: ${initialTopY}, New TopY: ${newTopY}`);

    // 在自訂模式下，高度應該改變
    expect(newTopY).not.toBeCloseTo(initialTopY, 1);
    
    // 驗證底線 (p1, p2) 依然沒動 (p3 is bottom-left in calculatePolygon [p4, p3, p2, p1])
    // Wait, pts[3] is p1 (bottom-left).
    expect(newPoints[3].y).toBeCloseTo(initialPoints[3].y, 1);
  });

  test('在標準模式下，單擊上方不應改變裁切框高度', async ({ page }) => {
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      window.openCropView(canvas.toDataURL());
    });
    await page.waitForTimeout(500);

    const polygon = page.locator('#crop-polygon');
    const getPoints = async () => {
      const ptsStr = await polygon.getAttribute('points');
      return ptsStr.split(' ').map(p => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      });
    };

    const initialPoints = await getPoints();
    const initialTopY = initialPoints[0].y;

    // 在畫面上方點擊
    const container = page.locator('#crop-container');
    const box = await container.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + 100);

    await page.waitForTimeout(500);

    const newPoints = await getPoints();
    const newTopY = newPoints[0].y;

    // 在標準模式下，高度不應改變 (應該只是移動了 p1 或 p2)
    expect(newTopY).toBeCloseTo(initialTopY, 1);
  });
});
