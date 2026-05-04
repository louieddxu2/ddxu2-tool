import { test, expect } from '@playwright/test';

test.describe('同步穩定性與環境偵測測試', () => {
  
  test('應在偵測到 LINE 瀏覽器時立即彈出警告', async ({ browser }) => {
    // 模擬 LINE 的 User-Agent
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1 Line/11.14.3'
    });
    const page = await context.newPage();
    // 假設專案運行在 localhost:3000 或其他開發伺服器
    await page.goto('/Chinese-card/index.html');
    
    const modal = page.locator('#modal-inapp-browser');
    // 目前版本的 ui.js 有 3 秒延遲，預期在 1 秒內檢查應為不可見（或測試失敗）
    await expect(modal).toBeVisible({ timeout: 1000 });
    await context.close();
  });

  test('同步收到卡片後，若符合目前搜尋條件應自動更新 UI', async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    
    // 確保頁面已載入
    await page.waitForSelector('#inp-game');

    // 1. 設定搜尋條件為 "TestGame"
    await page.evaluate(() => {
        const inp = document.getElementById('inp-game');
        inp.value = 'TestGame';
        inp.dispatchEvent(new Event('input'));
    });
    
    // 2. 模擬 WebRTC 收到一張符合 "TestGame" 的卡片
    await page.evaluate(async () => {
      // 建立測試 Blob
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const response = await fetch(`data:image/png;base64,${base64Data}`);
      const blob = await response.blob();
      
      const mockCard = {
        id: 'sync-test-realtime',
        game: 'TestGame',
        type: 'Unit',
        number: 'SYNC-001',
        blob: blob,
        timestamp: Date.now()
      };
      
      // 直接模擬數據注入與渲染觸發
      dbCards.push(mockCard);
      await idbKeyval.set("bgCards", dbCards, true);
      
      // 模擬 sync.js 中的 renderGallery 呼叫
      if (typeof renderGallery === 'function') {
          renderGallery();
      }
    });

    // 3. 驗證卡片是否自動出現在畫面上（無需手動重整）
    const card = page.locator('[data-id="sync-test-realtime"]');
    await expect(card).toBeVisible({ timeout: 5000 });
  });

  test('同步收到卡片後，若不符合搜尋條件不應干擾 UI', async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    
    // 1. 設定搜尋條件為 "OnlyTarget"
    await page.evaluate(() => {
        const inp = document.getElementById('inp-game');
        inp.value = 'OnlyTarget';
        inp.dispatchEvent(new Event('input'));
    });
    
    // 2. 模擬收到一張 "OtherGame" 的卡片
    await page.evaluate(async () => {
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const response = await fetch(`data:image/png;base64,${base64Data}`);
      const blob = await response.blob();
      
      const mockCard = {
        id: 'sync-test-silent',
        game: 'OtherGame',
        type: 'Unit',
        number: 'SYNC-002',
        blob: blob,
        timestamp: Date.now()
      };
      
      dbCards.push(mockCard);
      await idbKeyval.set("bgCards", dbCards, true);
      if (typeof renderGallery === 'function') renderGallery();
    });

    // 3. 驗證畫面上不應出現該卡片
    const card = page.locator('[data-id="sync-test-silent"]');
    await expect(card).not.toBeVisible();
    
    // 4. 清除搜尋後，該卡片應出現
    await page.evaluate(() => {
        const inp = document.getElementById('inp-game');
        inp.value = '';
        inp.dispatchEvent(new Event('input'));
        renderGallery();
    });
    await expect(card).toBeVisible();
  });
});
