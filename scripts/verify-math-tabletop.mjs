import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [800, 360]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto('http://127.0.0.1:3000/math-duel/');
    await page.waitForSelector('#black-hand [data-card-id]');

    const measure = () => page.evaluate(() => {
      const ids = ['white-area', 'table-area', 'white-operation', 'center-area', 'black-operation', 'black-area'];
      const clipped = [];
      for (const id of ids) {
        const area = document.getElementById(id).getBoundingClientRect();
        for (const card of document.querySelectorAll(`#${id} [data-card-id], #${id} .history-card`)) {
          const r = card.getBoundingClientRect();
          if (r.top < area.top - 1 || r.bottom > area.bottom + 1 || r.left < area.left - 1 || r.right > area.right + 1) clipped.push(`${id}:${card.dataset.cardId || 'history'}`);
        }
      }
      for (const button of document.querySelectorAll('.operation-zone.is-active button')) {
        if (getComputedStyle(button).display === 'none') continue;
        const r = button.getBoundingClientRect();
        const table = document.getElementById('table-area').getBoundingClientRect();
        if (r.top < table.top - 1 || r.bottom > table.bottom + 1 || r.left < table.left - 1 || r.right > table.right + 1) clipped.push(button.dataset.op || button.dataset.role);
      }
      const table = document.getElementById('table-area').getBoundingClientRect();
      const rail = document.querySelector('.utility-rail').getBoundingClientRect();
      return { clipped, width: document.body.scrollWidth, height: document.body.scrollHeight, table, rail };
    });

    const assertFits = async () => {
      const result = await measure();
      assert.deepEqual(result.clipped, [], JSON.stringify(result));
      assert.ok(result.width <= width && result.height <= height, JSON.stringify(result));
      assert.equal(await page.locator('.utility-rail').evaluate(el => getComputedStyle(el).position), 'fixed');
      assert.ok(result.rail.x >= width - result.rail.width - 14, JSON.stringify(result));
    };

    await assertFits();
    await page.locator('#black-hand [data-card-id="b1"]').click();
    await page.locator('#black-hand [data-card-id="b5"]').click();
    await page.locator('#center-cards [data-card-id="w9"]').click();
    await page.locator('#black-play-area [data-op="+"]').click();
    await page.waitForFunction(() => !document.querySelector('#black-play-area [data-role="main-btn"]').disabled);
    await page.waitForTimeout(700);
    await assertFits();
    await page.locator('#black-play-area [data-role="main-btn"]').click();
    await page.waitForFunction(() => game.turn === 'WHITE' && !document.body.classList.contains('is-turning'));
    await assertFits();
    assert.equal(await page.locator('#black-operation .history-card').count(), 3);
    assert.equal(await page.locator('#white-operation .history-card').count(), 0);
    await page.screenshot({ path: `test-results/math-tabletop-${width}.png` });
    console.log(`${width}x${height}: fixed table, floating utility buttons, active operation, history and no clipping passed`);
    await page.close();
  }
} finally {
  await browser.close();
}
