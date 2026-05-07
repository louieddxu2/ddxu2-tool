import { test, expect } from '@playwright/test';

test.describe('卡牌照片雙擊縮放與滾動鎖定測試 (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await page.goto('/Chinese-card/index.html');
    await page.waitForLoadState('domcontentloaded');
  });

  test('雙擊卡牌時應正確切換縮放狀態，並動態鎖定/解鎖外層滾動', async ({ page }) => {
    // 1. 透過 Canvas 動態產生一張高解析度 (600x600) 的自然圖片，確保 Panzoom 初始 scale 恰好為 1.0
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, 0, 600, 600);
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

      dbCards = [{ 
        id: 'test-card-zoom', 
        game: 'TestGame', 
        type: 'TestType', 
        number: '123', 
        blob: blob 
      }];
      
      renderGallery();
    });

    const container = page.locator('#gallery-container');

    // 2. 斷言初始狀態：具有 snap-y 且 overflow-y 為預設
    await expect(container).toHaveClass(/snap-y/);
    await expect(container).not.toHaveCSS('overflow-y', 'hidden');

    // 等待確保 Panzoom 異步初始化完成
    await page.waitForTimeout(500);

    // 3. 程式化觸發第一下雙擊（放大）
    await page.evaluate(() => {
      const img = document.querySelector('#gallery-grid img');
      if (img && img.parentElement) {
        img.parentElement.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      }
    });
    await page.waitForTimeout(500); // 等待縮放與狀態變更

    // 4. 斷言放大狀態：snap-y 與 snap-mandatory 應被移除，且 overflow-y 被設為 hidden
    await expect(container).not.toHaveClass(/snap-y/);
    await expect(container).toHaveCSS('overflow-y', 'hidden');

    // 5. 程式化觸發第二下雙擊（還原）
    await page.evaluate(() => {
      const img = document.querySelector('#gallery-grid img');
      if (img && img.parentElement) {
        img.parentElement.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      }
    });
    await page.waitForTimeout(500);

    // 6. 斷言還原狀態：snap-y 應被恢復，且 overflow-y 還原為 auto
    await expect(container).toHaveClass(/snap-y/);
    await expect(container).toHaveCSS('overflow-y', 'auto');
  });
});
