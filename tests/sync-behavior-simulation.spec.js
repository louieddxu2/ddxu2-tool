import { test, expect } from '@playwright/test';

async function seedBlob(page) {
  await page.evaluate(async () => {
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const resp = await fetch(`data:image/png;base64,${base64}`);
    window.__testBlob = await resp.blob();
  });
}

test.describe('sync behavior simulation', () => {
  test('same id + same timestamp should not rebroadcast', async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    await page.waitForFunction(() => window.dbCards && window.connections && window.idbKeyval);
    await seedBlob(page);

    const result = await page.evaluate(async () => {
      const sent = [];
      const conn = { open: true, send: (d) => sent.push(d), on: () => {}, close: () => {} };
      window.connections.add(conn);

      const now = Date.now();
      localStorage.setItem('bg_session_start_time', String(now - 1000));
      localStorage.setItem('bg_session_game', 'SimGame');

      window.dbCards.length = 0;
      window.dbCards.push({ id: 'same-id', game: 'SimGame', type: 'T', number: 'N1', blob: window.__testBlob, timestamp: now });
      await window.idbKeyval.set('bgCards', window.dbCards);
      const firstStarts = sent.filter(x => x.type === 'CARD_START').length;

      sent.length = 0;
      window.dbCards[0] = { ...window.dbCards[0], number: 'N1-same-ts' };
      await window.idbKeyval.set('bgCards', window.dbCards);
      const secondStarts = sent.filter(x => x.type === 'CARD_START').length;

      return { firstStarts, secondStarts };
    });

    expect(result.firstStarts).toBe(1);
    expect(result.secondStarts).toBe(0);
  });

  test('same id + newer timestamp should rebroadcast once', async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    await page.waitForFunction(() => window.dbCards && window.connections && window.idbKeyval);
    await seedBlob(page);

    const result = await page.evaluate(async () => {
      const sent = [];
      const conn = { open: true, send: (d) => sent.push(d), on: () => {}, close: () => {} };
      window.connections.add(conn);

      const now = Date.now();
      localStorage.setItem('bg_session_start_time', String(now - 1000));
      localStorage.setItem('bg_session_game', 'SimGame');

      window.dbCards.length = 0;
      window.dbCards.push({ id: 'same-id', game: 'SimGame', type: 'T', number: 'N1', blob: window.__testBlob, timestamp: now });
      await window.idbKeyval.set('bgCards', window.dbCards);

      sent.length = 0;
      window.dbCards[0] = { ...window.dbCards[0], timestamp: now + 1000, number: 'N1-updated' };
      await window.idbKeyval.set('bgCards', window.dbCards);
      const secondStarts = sent.filter(x => x.type === 'CARD_START').length;
      return { secondStarts };
    });

    expect(result.secondStarts).toBe(1);
  });

  test('B receives sync-added card: should not echo back to A', async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    await page.waitForFunction(() => window.dbCards && window.connections && typeof window.setupConnection === 'function');
    await seedBlob(page);

    const outcome = await page.evaluate(async () => {
      const outbound = [];
      localStorage.setItem('bg_sync_role', 'host');
      localStorage.setItem('bg_session_start_time', String(Date.now() - 1000));
      localStorage.setItem('bg_session_game', 'EchoGame');

      const conn = {
        open: true,
        peer: 'peer-1',
        send: (d) => outbound.push(d),
        on: (event, cb) => {
          if (event === 'data') window.__onData = cb;
          if (event === 'open') setTimeout(cb, 0);
        },
        close: () => {},
      };
      window.setupConnection(conn);
      await new Promise(r => setTimeout(r, 20));
      outbound.length = 0;

      const buffer = await window.__testBlob.arrayBuffer();
      await window.__onData({ type: 'CARD_START', cardId: 'recv-1', totalChunks: 1, metadata: { id: 'recv-1', game: 'EchoGame', type: 'T', number: 'R1', timestamp: Date.now(), blob: null } });
      await window.__onData({ type: 'CARD_CHUNK', cardId: 'recv-1', index: 0, chunk: buffer });
      await new Promise(r => setTimeout(r, 50));

      return { cardStartOutbound: outbound.filter(x => x.type === 'CARD_START').length };
    });

    expect(outcome.cardStartOutbound).toBe(0);
  });
});
