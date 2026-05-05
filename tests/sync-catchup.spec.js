import { test, expect } from '@playwright/test';

test.describe('同步補償測試 (Reconnection & Catch-up)', () => {
  
  test('新加入的裝置應能自動補齊連線前已存在的卡片', async ({ page }) => {
    page.on('console', msg => console.log(`PAGE: ${msg.text()}`));

    await page.goto('/Chinese-card/index.html');
    await page.waitForFunction(() => 
        window.dbCards !== undefined && 
        window.connections !== undefined && 
        typeof window.setupConnection === 'function'
    );

    // 1. 建立 Mock 連線並初始化
    await page.evaluate(() => {
        window.p2pSentMessages = [];
        window.p2pDataCallback = null;

        const mockConn = {
            open: true,
            peer: 'mock-host-peer-id-123456',
            send: (data) => {
                window.p2pSentMessages.push(JSON.parse(JSON.stringify(
                    data, (k, v) => v instanceof ArrayBuffer ? '[ArrayBuffer]' : v
                )));
                console.log(`[MOCK-SEND] ${data.type}${data.ids ? ' ids=' + data.ids : ''}`);
            },
            on: (event, callback) => {
                if (event === 'data') {
                    window.p2pDataCallback = callback;
                    console.log('[MOCK] data callback registered');
                }
                if (event === 'open') {
                    // 立即觸發 open 事件
                    setTimeout(callback, 0);
                }
                if (event === 'close') { /* no-op */ }
                if (event === 'error') { /* no-op */ }
            },
            close: () => {}
        };

        window.setupConnection(mockConn);
    });

    // 等待 open callback 執行完畢
    await page.waitForTimeout(500);

    // 2. 模擬收到 Host 的 HELLO 訊息
    await page.evaluate(() => {
        const now = Date.now();
        window.p2pDataCallback({ 
            type: 'HELLO', 
            sessionStart: now - 10000, 
            sessionGame: 'CatchupGame', 
            metas: [{ id: 'catchup-card-1', timestamp: now }]
        });
    });

    // 等待非同步處理完成
    await page.waitForTimeout(300);

    // 3. 驗證：Client 是否發出了 REQUEST_CARDS
    const sent = await page.evaluate(() => window.p2pSentMessages);
    console.log('Sent messages:', JSON.stringify(sent.map(m => m.type)));
    
    const requestMsg = sent.find(m => m.type === 'REQUEST_CARDS');
    expect(requestMsg).toBeDefined();
    expect(requestMsg.ids).toContain('catchup-card-1');
    console.log("✅ Client 成功識別缺失資料並發出 REQUEST_CARDS");

    // 4. 模擬 Host 回傳卡片（CARD_START + CARD_CHUNK）
    await page.evaluate(async () => {
        const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        const resp = await fetch(`data:image/png;base64,${base64}`);
        const blob = await resp.blob();
        const buffer = await blob.arrayBuffer();

        const metadata = {
            id: 'catchup-card-1',
            game: 'CatchupGame',
            type: 'Test',
            number: 'CU-001',
            timestamp: Date.now()
        };

        // 發送 CARD_START
        await window.p2pDataCallback({ 
            type: 'CARD_START', 
            cardId: metadata.id, 
            totalChunks: 1, 
            metadata 
        });

        // 發送 CARD_CHUNK
        await window.p2pDataCallback({ 
            type: 'CARD_CHUNK', 
            cardId: metadata.id, 
            index: 0, 
            chunk: buffer
        });

        console.log(`[TEST] dbCards count after injection: ${window.dbCards.length}`);
        const found = window.dbCards.find(c => c.id === 'catchup-card-1');
        console.log(`[TEST] Card found in dbCards: ${!!found}, has blob: ${!!(found && found.blob)}`);
    });

    // 等待 throttledRenderGallery（300ms 延遲）+ 渲染完成
    await page.waitForTimeout(1000);

    // 5. 驗證資料層：dbCards 包含補傳的卡片
    const cardInMemory = await page.evaluate(() => {
        const c = window.dbCards.find(x => x.id === 'catchup-card-1');
        return c ? { id: c.id, game: c.game, number: c.number, hasBlob: c.blob instanceof Blob } : null;
    });
    
    expect(cardInMemory).not.toBeNull();
    expect(cardInMemory.id).toBe('catchup-card-1');
    expect(cardInMemory.game).toBe('CatchupGame');
    expect(cardInMemory.number).toBe('CU-001');
    expect(cardInMemory.hasBlob).toBe(true);
    console.log("✅ 資料層驗證通過：卡片完整存入 dbCards");

    // 6. 驗證 UI 層：DOM 中出現該卡片元素
    const cardEl = page.locator('[data-id="catchup-card-1"]');
    await expect(cardEl).toBeVisible({ timeout: 5000 });
    
    // 驗證 data-number 屬性（非 Grid 模式下文字在 attribute 而非 textContent）
    await expect(cardEl).toHaveAttribute('data-number', 'CU-001');
    
    console.log("✅ 補償同步測試完全通過！卡片已成功補傳並渲染。");
  });
});
