import { test, expect } from '@playwright/test';

test('uses the wide tabletop and makes cards readable on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('mathDuelLang', 'en');
    localStorage.setItem('mathDuelGuide_v2', JSON.stringify({ dontShow: true, completed: false }));
  });
  await page.goto('/math-duel/index.html');

  const layout = await page.evaluate(() => {
    const rect = selector => {
      const { x, y, width, height, left, right, top, bottom } = document.querySelector(selector).getBoundingClientRect();
      return { x, y, width, height, left, right, top, bottom };
    };
    const zones = ['#white-actions', '#white-equation', '#center-area', '#black-equation', '#black-actions'];
    return {
      board: rect('#game-board'),
      table: rect('#table-area'),
      handCard: rect('#black-hand [data-card-id]'),
      centerCard: rect('#center-cards [data-card-id]'),
      equation: rect('#black-equation .equation-content'),
      zones: zones.map(rect),
      leftControl: rect('.utility-rail-left .table-icon'),
      rightControl: rect('.utility-rail-right .table-icon'),
      noScroll: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight,
    };
  });

  expect(layout.board.width).toBeGreaterThanOrEqual(1200);
  expect(layout.table.width).toBe(layout.board.width);
  expect(layout.handCard.width).toBeGreaterThanOrEqual(54);
  expect(layout.handCard.height).toBeGreaterThanOrEqual(68);
  expect(layout.centerCard.width).toBeGreaterThanOrEqual(48);
  expect(layout.centerCard.height).toBeGreaterThanOrEqual(68);
  expect(layout.equation.width).toBeGreaterThan(700);
  expect(layout.leftControl.right).toBeLessThan(layout.board.left);
  expect(layout.rightControl.left).toBeGreaterThan(layout.board.right);
  const zoneTops = layout.zones.map(zone => zone.top);
  expect(zoneTops).toEqual([...zoneTops].sort((a, b) => a - b));
  expect(layout.noScroll).toBe(true);

  await page.locator('#black-hand [data-card-id]').first().click();
  await expect(page.locator('#black-equation [data-role="stage-hand-cards"] [data-card-id]')).toHaveCount(1);
  const stagedCard = await page.locator('#black-equation [data-role="stage-hand-cards"] [data-card-id]').first().evaluate(element => {
    const { width, height } = element.getBoundingClientRect();
    return { width, height };
  });
  expect(stagedCard.width).toBeGreaterThanOrEqual(40);
  expect(stagedCard.height).toBeGreaterThanOrEqual(54);

  await page.setViewportSize({ width: 1024, height: 768 });
  const compactDesktop = await page.evaluate(() => ({
    boardWidth: document.getElementById('game-board').getBoundingClientRect().width,
    handCardWidth: document.querySelector('#black-hand [data-card-id]').getBoundingClientRect().width,
    noScroll: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight,
  }));
  expect(compactDesktop.boardWidth).toBeGreaterThanOrEqual(800);
  expect(compactDesktop.handCardWidth).toBeGreaterThanOrEqual(54);
  expect(compactDesktop.noScroll).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await page.evaluate(() => ({
    boardWidth: document.getElementById('game-board').getBoundingClientRect().width,
    handCard: document.querySelector('#black-hand [data-card-id]').getBoundingClientRect().toJSON(),
    noScroll: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight,
  }));
  expect(mobileLayout.boardWidth).toBeLessThanOrEqual(390);
  expect(mobileLayout.handCard.width).toBeLessThanOrEqual(48);
  expect(mobileLayout.handCard.height).toBeLessThanOrEqual(50);
  expect(mobileLayout.noScroll).toBe(true);
});

test('keeps desktop hot-seat content upright and places the active player nearest', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('mathDuelLang', 'en');
    localStorage.setItem('mathDuelGuide_v2', JSON.stringify({ dontShow: true, completed: false }));
  });
  await page.goto('/math-duel/index.html');

  const getLayout = () => page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const transform = selector => getComputedStyle(document.querySelector(selector)).transform;
    return {
      whiteSeat: rect('#white-area').toJSON(),
      blackSeat: rect('#black-area').toJSON(),
      table: rect('#table-area').toJSON(),
      zoneTops: ['#white-actions', '#white-equation', '#center-area', '#black-equation', '#black-actions']
        .map(selector => ({ selector, top: rect(selector).top })),
      transforms: [
        '#white-area', '#white-actions .action-content', '#black-actions .action-content',
        '#white-equation .equation-content', '#black-equation .equation-content', '#center-cards',
      ].map(transform),
      actionBorders: ['#black-actions', '#white-actions'].map(selector =>
        getComputedStyle(document.querySelector(selector)).borderBottomWidth,
      ),
      centerLabelMatrix: transform('#ui-center-label'),
    };
  });

  await expect(page.locator('body')).toHaveClass(/is-pvp/);
  const blackTurn = await getLayout();
  expect(blackTurn.whiteSeat.bottom).toBeLessThan(blackTurn.table.top);
  expect(blackTurn.blackSeat.top).toBeGreaterThan(blackTurn.table.bottom);
  expect(blackTurn.zoneTops.map(zone => zone.top)).toEqual(
    [...blackTurn.zoneTops.map(zone => zone.top)].sort((a, b) => a - b),
  );
  expect(blackTurn.transforms.every(value => value === 'none')).toBe(true);
  expect(blackTurn.centerLabelMatrix).toMatch(/^matrix\(1, 0, 0, 1,/);

  await page.locator('#black-hand [data-card-id="b1"]').click();
  await page.locator('#black-hand [data-card-id="b5"]').click();
  await page.locator('#center-cards [data-card-id="w9"]').click();
  await page.locator('#black-actions [data-op="+"]').click();
  await page.locator('#black-actions [data-role="main-btn"]').click();
  await expect(page.locator('body')).toHaveClass(/is-white-turn/, { timeout: 7000 });

  const whiteTurn = await getLayout();
  expect(whiteTurn.blackSeat.bottom).toBeLessThan(whiteTurn.table.top);
  expect(whiteTurn.whiteSeat.top).toBeGreaterThan(whiteTurn.table.bottom);
  const expectedOrder = ['#black-actions', '#black-equation', '#center-area', '#white-equation', '#white-actions'];
  const expectedTops = await page.evaluate(selectors => selectors.map(selector =>
    document.querySelector(selector).getBoundingClientRect().top,
  ), expectedOrder);
  expect(expectedTops).toEqual([...expectedTops].sort((a, b) => a - b));
  expect(whiteTurn.transforms.every(value => value === 'none')).toBe(true);
  expect(whiteTurn.actionBorders).toEqual(['1px', '0px']);
  expect(whiteTurn.centerLabelMatrix).toMatch(/^matrix\(1, 0, 0, 1,/);
});
