import { test, expect } from '@playwright/test';

test.describe('sync my-metas backfill', () => {
  test('host requests cards that client is missing', async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    await page.waitForFunction(() => window.dbCards !== undefined && typeof window.setupConnection === 'function');

    await page.evaluate(async () => {
      window.p2pSentMessages = [];
      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const resp = await fetch(`data:image/png;base64,${base64}`);
      const blob = await resp.blob();
      const now = Date.now();

      localStorage.setItem('bg_sync_role', 'host');
      localStorage.setItem('bg_session_start_time', String(now - 1000));
      localStorage.setItem('bg_session_game', 'MetaTest');

      window.dbCards.length = 0;
      window.dbCards.push({
        id: 'host-card-1',
        game: 'MetaTest',
        type: 'T',
        number: 'M-001',
        blob,
        timestamp: now,
      });

      const mockConn = {
        open: true,
        peer: 'mock-peer',
        send: (data) => window.p2pSentMessages.push(data),
        on: (event, cb) => {
          if (event === 'data') window.p2pDataCallback = cb;
          if (event === 'open') setTimeout(cb, 0);
        },
        close: () => {},
      };

      window.setupConnection(mockConn);
      await new Promise(r => setTimeout(r, 50));

      await window.p2pDataCallback({
        type: 'MY_METAS',
        metas: [],
      });
    });

    await page.waitForTimeout(100);
    const request = await page.evaluate(() => window.p2pSentMessages.find(x => x.type === 'REQUEST_CARDS'));
    expect(request).toBeTruthy();
    expect(request.ids).toContain('host-card-1');
  });
});
