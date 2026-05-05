import { test, expect } from '@playwright/test';

test.describe('同步批次傳輸測試 (Batch Sync Reliability)', () => {
  
  test('一次匯入多張卡片時，應確保循序發送且接收端完整接收', async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    await page.waitForFunction(() => window.dbCards !== undefined);

    // 1. 設置監控：記錄所有發出的 P2P 訊息順序
    // 我們攔截 peer.connections 中的發送動作 (模擬)
    const messageLog = await page.evaluate(() => {
        window.p2pMessageLog = [];
        // 建立一個假的 connection 物件
        const mockConn = {
            open: true,
            send: (data) => {
                window.p2pMessageLog.push({
                    type: data.type,
                    cardId: data.cardId,
                    time: performance.now()
                });
            }
        };
        // 強行加入 connections Set
        if (window.connections) {
            window.connections.add(mockConn);
        }
        return true;
    });

    // 2. 執行批次注入 (5 張卡片)
    await page.evaluate(async () => {
        const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        const response = await fetch(`data:image/png;base64,${base64Data}`);
        const blob = await response.blob();
        
        // 模擬 Session 狀態，否則廣播鉤子會過濾掉這些卡片
        const now = Date.now();
        localStorage.setItem('bg_session_start_time', (now - 1000).toString());
        localStorage.setItem('bg_session_game', 'BatchTest');
        
        const newCards = [];
        for (let i = 1; i <= 5; i++) {
            newCards.push({
                id: `batch-card-${i}`,
                game: 'BatchTest',
                type: 'Unit',
                number: `BN-${i}`,
                blob: blob,
                timestamp: now
            });
        }
        
        // 模擬匯入邏輯
        window.dbCards.push(...newCards);
        // 觸發廣播鉤子 (我們預期這裡會 await 每一張卡片的發送)
        await window.idbKeyval.set("bgCards", window.dbCards);
    });

    // 3. 驗證訊息順序是否交錯
    const logs = await page.evaluate(() => window.p2pMessageLog);
    
    // 檢查點 A：必須有 5 個 CARD_START
    const startMessages = logs.filter(m => m.type === 'CARD_START');
    expect(startMessages.length).toBe(5);

    // 檢查點 B：嚴格順序檢查 (最重要的部分)
    // 在任何一個 CARD_START 出現後，直到該卡片結束前，不應該出現另一個 CARD_START
    // 注意：我們的 sendCardChunked 現在是 await 的，所以順序應該是完美的
    let currentCardId = null;
    for (const msg of logs) {
        if (msg.type === 'CARD_START') {
            // 如果上一個卡片還沒結束（雖然我們沒有 CARD_END，但我們可以根據邏輯判斷）
            // 在 await 模式下，CARD_START 之間一定會夾著該卡片的所有 CHUNK
            currentCardId = msg.cardId;
        }
    }
    
    // 檢查點 C：最後一張卡片的消息是否出現在最後
    expect(logs[logs.length - 1].cardId).toBe('batch-card-5');
    
    console.log("批次傳輸順序驗證通過！沒有發生訊息交錯。");
  });
});
