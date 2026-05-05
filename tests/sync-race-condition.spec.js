import { test, expect } from '@playwright/test';

test.describe('同步競態條件測試 (Async Race Condition)', () => {
  
  test('當資料庫讀取尚未完成時，收到 P2P 卡片應被保留並與舊資料合併', async ({ page }) => {
    // 診斷日誌
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));

    // 1. 網路層攔截：人為延遲 db.js 的載入，製造出「記憶體已注入但 DB 未載入」的空窗期
    await page.route('**/js/db.js*', async route => {
        console.log("[TEST-MOCK] 攔截到 db.js，故意延遲 3 秒載入...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        await route.continue();
    });

    // 2. 前往頁面，使用 commit 模式，這會在 HTML 剛開始下載、還沒解析到腳本時就回傳
    await page.goto('/Chinese-card/index.html', { waitUntil: 'commit' });

    // 3. 此時 db.js 還在被我們「扣留」中，我們趁機注入資料
    // 因為 db.js 還沒跑，我們需要自己先建立這個陣列
    await page.evaluate(() => {
        window.dbCards = window.dbCards || [];
        const mockCard = {
            id: 'race-condition-card',
            game: 'RaceGame',
            type: 'Test',
            number: 'RC-999',
            blob: new Blob(['mock-data'], { type: 'image/png' }),
            timestamp: Date.now()
        };
        window.dbCards.push(mockCard);
        console.log(`[TEST] 資料已提前注入。目前記憶體數量: ${window.dbCards.length}`);
    });

    // 4. 等待資料庫載入完成標記 (這是在 db.js 載入後才會設定的)
    await page.waitForFunction(() => window.UIState && window.UIState.isDBReady === true, { timeout: 10000 });

    // 5. 驗證：P2P 的卡片不應該被覆蓋
    const card = page.locator('[data-id="race-condition-card"]');
    await expect(card).toBeVisible({ timeout: 5000 });
    
    // 檢查陣列內容
    const count = await page.evaluate(() => window.dbCards.filter(c => c.id === 'race-condition-card').length);
    expect(count).toBe(1);
    console.log("[TEST] 競態條件測試通過！資料成功合併。");
  });
});
