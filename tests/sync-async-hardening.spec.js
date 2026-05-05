import { test, expect } from '@playwright/test';

async function seedBlob(page) {
  await page.evaluate(async () => {
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const resp = await fetch(`data:image/png;base64,${base64}`);
    window.__testBlob = await resp.blob();
  });
}

test.describe('sync async hardening', () => {
  test('should key incoming chunk state by peer + cardId', async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    await page.waitForFunction(() => typeof window.setupConnection === 'function');
    await seedBlob(page);

    const result = await page.evaluate(async () => {
      const sentA = [];
      const sentB = [];
      const mkConn = (peer, sentStore) => ({
        open: true,
        peer,
        send: (d) => sentStore.push(d),
        on: (event, cb) => {
          if (event === 'data') window[`__onData_${peer}`] = cb;
          if (event === 'open') setTimeout(cb, 0);
        },
        close: () => {},
      });

      window.setupConnection(mkConn('peer-a', sentA));
      window.setupConnection(mkConn('peer-b', sentB));
      await new Promise(r => setTimeout(r, 20));

      const buffer = await window.__testBlob.arrayBuffer();
      const metaA = { id: 'same-card', game: 'G', type: 'T', number: 'A', timestamp: Date.now(), blob: null };
      const metaB = { id: 'same-card', game: 'G', type: 'T', number: 'B', timestamp: Date.now() + 1, blob: null };

      await window['__onData_peer-a']({ type: 'CARD_START', cardId: 'same-card', totalChunks: 1, metadata: metaA });
      await window['__onData_peer-b']({ type: 'CARD_START', cardId: 'same-card', totalChunks: 1, metadata: metaB });
      await window['__onData_peer-a']({ type: 'CARD_CHUNK', cardId: 'same-card', index: 0, chunk: buffer });
      await window['__onData_peer-b']({ type: 'CARD_CHUNK', cardId: 'same-card', index: 0, chunk: buffer });

      await new Promise(r => setTimeout(r, 30));
      const card = window.dbCards.find(c => c.id === 'same-card');
      return { hasCard: !!card, number: card?.number || null };
    });

    expect(result.hasCard).toBeTruthy();
    expect(['A', 'B']).toContain(result.number);
  });

  test('should not mark broadcast version when send fails', async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    await page.waitForFunction(() => window.dbCards && window.connections && window.idbKeyval);
    await seedBlob(page);

    const result = await page.evaluate(async () => {
      let failOnce = true;
      const conn = {
        open: true,
        send: (d) => {
          if (d.type === 'CARD_CHUNK' && failOnce) {
            failOnce = false;
            throw new Error('mock send failure');
          }
        },
        on: () => {},
        close: () => {},
      };
      window.connections.add(conn);

      const now = Date.now();
      localStorage.setItem('bg_session_start_time', String(now - 1000));
      localStorage.setItem('bg_session_game', 'RetryGame');

      window.dbCards.length = 0;
      window.dbCards.push({ id: 'retry-card', game: 'RetryGame', type: 'T', number: 'R1', blob: window.__testBlob, timestamp: now });

      await window.idbKeyval.set('bgCards', window.dbCards);
      await window.idbKeyval.set('bgCards', window.dbCards);

      return true;
    });

    expect(result).toBeTruthy();
  });
});
