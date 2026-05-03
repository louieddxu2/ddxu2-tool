import { test, expect } from '@playwright/test';

test.describe('圖庫排版與滑動測試 (TDD)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    await page.waitForLoadState('domcontentloaded');
  });

  test('橫式卡片不應觸發左右滑動，且必須保持全貌', async ({ page }) => {
    // 注入一張測試圖片，並強制將環境設為「橫向卡片模式」(isLandscapeMode = true)
    await page.evaluate(() => {
      // 建立一個 1x1 像素的透明 PNG 作為測試圖片
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      dbCards = [{ 
        id: 'test-landscape', 
        game: 'TestGame', 
        type: 'TestType', 
        number: '001', 
        blob: blob 
      }];
      
      // 這是當初引發 Bug 的關鍵變數
      isLandscapeMode = true; 
      
      // 強制重新渲染
      renderGallery();
    });

    const container = page.locator('#gallery-container');
    const grid = page.locator('#gallery-grid');
    const firstCard = grid.locator('> div').first();

    // 斷言 1：容器必須永遠保持上下滑動 (snap-y)，絕對不能變成左右滑動 (snap-x)
    await expect(container).toHaveClass(/snap-y/);
    await expect(container).not.toHaveClass(/snap-x/);

    // 斷言 2：格線必須維持垂直排列 (grid-cols-1)，絕對不能變成 flex-row
    await expect(grid).toHaveClass(/grid-cols-1/);
    await expect(grid).not.toHaveClass(/flex-row/);

    // 斷言 3：圖片的卡片外框寬度不能超出容器，確保不會被螢幕邊緣裁切
    // 等待圖片載入完成，或渲染完成
    await page.waitForTimeout(500); 

    const containerBox = await container.boundingBox();
    const cardBox = await firstCard.boundingBox();

    // 在之前的 Bug 中，卡片被強加了 w-screen，導致寬度超出容器寬度
    expect(cardBox.width).toBeLessThanOrEqual(containerBox.width);
  });
});
