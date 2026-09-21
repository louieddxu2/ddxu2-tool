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

  test('host relays a received card to B without echoing it to A', async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    await page.waitForFunction(() => window.dbCards && window.connections && typeof window.setupConnection === 'function');
    await seedBlob(page);

    const outcome = await page.evaluate(async () => {
      const sourceOutbound = [];
      const recipientOutbound = [];
      localStorage.setItem('bg_sync_role', 'host');
      localStorage.setItem('bg_session_start_time', String(Date.now() - 1000));
      localStorage.setItem('bg_session_game', 'EchoGame');

      const sourceConn = {
        open: true,
        peer: 'peer-a',
        send: (d) => sourceOutbound.push(d),
        on: (event, cb) => {
          if (event === 'data') window.__sourceData = cb;
          if (event === 'open') setTimeout(cb, 0);
        },
        close: () => {},
      };
      const recipientConn = {
        open: true,
        peer: 'peer-b',
        send: (d) => recipientOutbound.push(d),
        on: (event, cb) => {
          if (event === 'data') window.__recipientData = cb;
          if (event === 'open') setTimeout(cb, 0);
        },
        close: () => {},
      };
      window.setupConnection(sourceConn);
      window.setupConnection(recipientConn);
      await new Promise(r => setTimeout(r, 20));
      sourceOutbound.length = 0;
      recipientOutbound.length = 0;

      const buffer = await window.__testBlob.arrayBuffer();
      const metadata = { id: 'recv-1', game: 'EchoGame', type: 'T', number: 'R1', timestamp: Date.now(), blob: null };
      await window.__sourceData({ type: 'CARD_START', cardId: 'recv-1', totalChunks: 1, metadata });
      await window.__sourceData({ type: 'CARD_CHUNK', cardId: 'recv-1', index: 0, chunk: buffer });
      await new Promise(r => setTimeout(r, 50));

      return {
        sourceStarts: sourceOutbound.filter(x => x.type === 'CARD_START').length,
        recipientStarts: recipientOutbound.filter(x => x.type === 'CARD_START').length,
        recipientChunks: recipientOutbound.filter(x => x.type === 'CARD_CHUNK').length,
      };
    });

    expect(outcome.sourceStarts).toBe(0);
    expect(outcome.recipientStarts).toBe(1);
    expect(outcome.recipientChunks).toBe(1);
  });

  test('host requests a missed card after waking and relays the recovered card to B', async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    await page.waitForFunction(() => window.dbCards && window.connections && typeof window.setupConnection === 'function');
    await seedBlob(page);

    const outcome = await page.evaluate(async () => {
      const sourceOutbound = [];
      const recipientOutbound = [];
      const now = Date.now();
      localStorage.setItem('bg_sync_role', 'host');
      localStorage.setItem('bg_session_start_time', String(now - 1000));
      localStorage.setItem('bg_session_game', 'WakeGame');
      window.dbCards.length = 0;

      const sourceConn = {
        open: true,
        peer: 'peer-a',
        send: (d) => sourceOutbound.push(d),
        on: (event, cb) => {
          if (event === 'data') window.__wakeSourceData = cb;
          if (event === 'open') setTimeout(cb, 0);
        },
        close: () => {},
      };
      const recipientConn = {
        open: true,
        peer: 'peer-b',
        send: (d) => recipientOutbound.push(d),
        on: (event, cb) => {
          if (event === 'data') window.__wakeRecipientData = cb;
          if (event === 'open') setTimeout(cb, 0);
        },
        close: () => {},
      };
      window.setupConnection(sourceConn);
      window.setupConnection(recipientConn);
      await new Promise(r => setTimeout(r, 20));
      sourceOutbound.length = 0;
      recipientOutbound.length = 0;

      await window.__wakeSourceData({
        type: 'MY_METAS',
        metas: [{ id: 'wake-card', timestamp: now }],
      });

      const request = sourceOutbound.find(x => x.type === 'REQUEST_CARDS');
      const buffer = await window.__testBlob.arrayBuffer();
      const metadata = { id: 'wake-card', game: 'WakeGame', type: 'T', number: 'W1', timestamp: now, blob: null };
      await window.__wakeSourceData({ type: 'CARD_START', cardId: 'wake-card', totalChunks: 1, metadata });
      await window.__wakeSourceData({ type: 'CARD_CHUNK', cardId: 'wake-card', index: 0, chunk: buffer });
      await new Promise(r => setTimeout(r, 50));

      return {
        requestedId: request?.ids?.[0],
        hostHasCard: window.dbCards.some(card => card.id === 'wake-card'),
        recipientStarts: recipientOutbound.filter(x => x.type === 'CARD_START').length,
      };
    });

    expect(outcome.requestedId).toBe('wake-card');
    expect(outcome.hostHasCard).toBe(true);
    expect(outcome.recipientStarts).toBe(1);
  });
});
