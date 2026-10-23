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
  await expect(page.locator('#turn-swap-motion-layer')).toHaveCount(0);
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

test('animates desktop player labels toward their exchanged sides', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('mathDuelLang', 'zh');
    localStorage.setItem('mathDuelGuide_v2', JSON.stringify({ dontShow: true, completed: false }));
  });
  await page.goto('/math-duel/index.html');

  const labelSelectors = ['#white-label', '#black-label'];
  const centerTop = await page.locator('#center-area').evaluate(element => element.getBoundingClientRect().top);
  const initialLabels = await page.evaluate(selectors => Object.fromEntries(selectors.map(selector => {
    const element = document.querySelector(selector);
    return [selector, { top: element.getBoundingClientRect().top, text: element.textContent }];
  })), labelSelectors);

  await page.locator('#black-hand [data-card-id="b1"]').click();
  await page.locator('#black-hand [data-card-id="b5"]').click();
  await page.locator('#center-cards [data-card-id="w9"]').click();
  await page.locator('#black-actions [data-op="+"]').click();
  await page.locator('#black-actions [data-role="main-btn"]').click();
  await expect(page.locator('body')).toHaveClass(/is-white-turn/, { timeout: 7000 });
  await expect(page.locator('body')).toHaveClass(/is-turning/);

  await page.waitForFunction(() => {
    const ghosts = [...document.querySelectorAll('#turn-swap-motion-layer .turn-swap-nameplate')];
    return ghosts.length === 2 && ghosts.every(ghost => ghost.getAnimations().some(animation =>
      animation.effect?.getTiming().duration === 520 &&
      animation.effect.getKeyframes().some(frame => frame.transform?.includes('translate3d(')),
    ));
  });

  const animationState = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('#turn-swap-motion-layer .turn-swap-nameplate')].map(ghost => {
      const animation = ghost.getAnimations().find(candidate => candidate.effect?.getTiming().duration === 520);
      const frames = animation?.effect.getKeyframes() || [];
      return {
        side: ghost.dataset.playerSide,
        text: ghost.textContent,
        fromY: Number(ghost.dataset.fromY),
        toY: Number(ghost.dataset.toY),
        duration: animation?.effect.getTiming().duration,
        frames: frames.map(frame => frame.transform),
      };
    }),
    centerTop: document.querySelector('#center-area').getBoundingClientRect().top,
    liveLabelsHidden: ['#white-label', '#black-label'].every(selector =>
      getComputedStyle(document.querySelector(selector)).visibility === 'hidden',
    ),
    overlayIsClickThrough: getComputedStyle(document.querySelector('#turn-swap-motion-layer')).pointerEvents === 'none',
    seatsExchanged: document.querySelector('#white-area').getBoundingClientRect().top >
      document.querySelector('#table-area').getBoundingClientRect().bottom &&
      document.querySelector('#black-area').getBoundingClientRect().bottom <
        document.querySelector('#table-area').getBoundingClientRect().top,
  }));

  expect(animationState.labels).toHaveLength(2);
  expect(animationState.labels.every(label => label.duration === 520 && label.frames.length === 3)).toBe(true);
  expect(animationState.labels.find(label => label.side === 'WHITE').fromY)
    .toBeLessThan(animationState.labels.find(label => label.side === 'WHITE').toY);
  expect(animationState.labels.find(label => label.side === 'BLACK').fromY)
    .toBeGreaterThan(animationState.labels.find(label => label.side === 'BLACK').toY);
  expect(animationState.labels.map(label => label.text)).toEqual([initialLabels['#white-label'].text, initialLabels['#black-label'].text]);
  expect(animationState.centerTop).toBe(centerTop);
  expect(animationState.liveLabelsHidden).toBe(true);
  expect(animationState.overlayIsClickThrough).toBe(true);
  expect(animationState.seatsExchanged).toBe(true);

  await page.waitForTimeout(150);
  const inMotion = await page.locator('#turn-swap-motion-layer .turn-swap-nameplate').evaluateAll(ghosts =>
    ghosts.map(ghost => ghost.getAnimations()[0]?.currentTime),
  );
  expect(inMotion.every(time => time > 100 && time < 520)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('desktop-player-labels-in-motion.png') });
  await page.locator('#white-actions [data-op="+"]').click();
  await expect(page.locator('#white-actions [data-op="+"]')).toHaveClass(/bg-blue-600/);

  await expect(page.locator('body')).not.toHaveClass(/is-turning/, { timeout: 2000 });
  await expect(page.locator('#turn-swap-motion-layer')).toHaveCount(0);
  await expect(page.locator('#white-label')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('#black-label')).toHaveCSS('visibility', 'visible');
});
