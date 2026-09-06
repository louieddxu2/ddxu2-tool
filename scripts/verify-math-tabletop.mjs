import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [width, height] of [[360,640], [390,844], [800,360]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto('http://127.0.0.1:3000/math-duel/');
    await page.waitForSelector('#black-hand [data-card-id]');
    const measure = () => page.evaluate(() => {
      const zones = ['white-area','black-area','center-area','play-area'];
      const clipped = zones.flatMap(id => {
        const area = document.getElementById(id).getBoundingClientRect();
        return [...document.querySelectorAll(`#${id} [data-card-id]`)].filter(card => {
          const r = card.getBoundingClientRect();
          return r.top < area.top-1 || r.bottom > area.bottom+1 || r.left < area.left-1 || r.right > area.right+1;
        }).map(card => card.dataset.cardId);
      });
      return { clipped, width: document.body.scrollWidth, height: document.body.scrollHeight };
    });
    let result = await measure();
    assert.deepEqual(result.clipped, []);
    assert.ok(result.width <= width && result.height <= height, JSON.stringify(result));
    await page.locator('#black-hand [data-card-id="b1"]').click();
    await page.locator('#black-hand [data-card-id="b5"]').click();
    await page.locator('#center-cards [data-card-id="w9"]').click();
    await page.locator('[data-op="+"]').click();
    await page.waitForFunction(() => !document.querySelector('#main-btn').disabled);
    await page.waitForTimeout(800);
    result = await measure();
    assert.deepEqual(result.clipped, []);
    await page.screenshot({ path: `test-results/math-tabletop-${width}.png` });
    await page.locator('#main-btn').click();
    await page.waitForFunction(() => document.body.classList.contains('is-white-turn') && !document.body.classList.contains('is-turning'));
    result = await measure();
    assert.deepEqual(result.clipped, []);
    assert.ok(result.width <= width && result.height <= height);
    await page.locator('#white-hand [data-card-id="w2"]').click();
    await page.locator('#white-hand [data-card-id="w3"]').click();
    await page.locator('#center-cards [data-card-id="b5"]').click();
    await page.locator('[data-op="+"]').click();
    await page.waitForFunction(() => !document.querySelector('#main-btn').disabled);
    console.log(`${width}x${height}: fits, cards unclipped, equation selectable`);
    await page.close();
  }
} finally { await browser.close(); }
