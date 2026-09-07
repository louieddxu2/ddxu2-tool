import { test, expect } from '@playwright/test';

test('animates a card exchange and resolves it into the correct zones', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  await expect(page.locator('#black-actions [data-role="main-btn"]')).toBeDisabled();

  await page.locator('[data-card-id="b1"]').click();
  await expect(page.locator('#black-equation [data-role="stage-hand-cards"] [data-card-id="b1"]')).toBeVisible({ timeout: 2000 });
  await page.locator('[data-card-id="b5"]').click();
  await expect(page.locator('#black-equation [data-role="stage-hand-cards"] [data-card-id="b5"]')).toBeVisible({ timeout: 2000 });
  await page.locator('[data-card-id="w9"]').click();
  await expect(page.locator('#black-equation [data-role="stage-center-cards"] [data-card-id="w9"]')).toBeVisible({ timeout: 2000 });
  await page.locator('#black-actions [data-op="+"]').click();

  await expect(page.locator('#black-actions [data-role="main-btn"]')).toBeEnabled();
  await expect(page.locator('#black-equation [data-role="move-preview"] .equation-line')).toHaveAttribute('data-equation', '1 + 5 = 6');
  await expect(page.locator('#black-equation [data-role="stage-center-cards"] .card-face-number.is-transformed')).toBeVisible();

  await page.locator('#black-actions [data-role="main-btn"]').click();
  await expect(page.locator('#status-banner')).toContainText('行動結算中', { timeout: 1000 });
  await expect(page.locator('#black-actions [data-role="main-btn"]')).toBeHidden();

  await expect(page.locator('#center-cards [data-card-id="b1"]')).toBeVisible({ timeout: 7000 });
  await expect(page.locator('#center-cards [data-card-id="b5"]')).toBeVisible({ timeout: 7000 });
  await expect(page.locator('#black-hand [data-card-id="w9"]')).toBeVisible({ timeout: 7000 });
  await expect(page.locator('#black-equation [data-role="stage-hand-cards"] [data-card-id="b1"]')).toHaveCount(1);
  await expect(page.locator('#history-area')).toBeHidden();
  await expect(page.locator('#white-area')).toHaveClass(/border-blue-500/);
});

test('reveals the AI plan in the play area before resolving it', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mathDuelLang', 'zh');
    localStorage.setItem('mathDuelState_v1.6.0', JSON.stringify({
      mode: 'AI_EASY',
      ruleMode: 'CLASSIC',
      turn: 'BLACK',
      aiSide: 'BLACK',
      aiColor: 'b',
      playerColor: 'w',
      state: 'PLAYING',
      winner: null,
      blackHand: Array.from({ length: 9 }, (_, i) => ({ id: `b${i + 1}`, val: i + 1, color: 'b' })),
      whiteHand: Array.from({ length: 8 }, (_, i) => ({ id: `w${i + 1}`, val: i + 1, color: 'w' })),
      center: [{ id: 'w9', val: 9, color: 'w' }],
      selections: { hand: [], center: [], operator: null },
      discardSelections: [],
      lastMove: null,
      aiMoveInfo: null,
      movePreview: null,
      uiBusy: false,
      scores: { BLACK: 0, WHITE: 0 },
      winScore: 2
    }));
  });
  await page.goto('/math-duel/index.html');

  await expect(page.locator('#status-banner')).toContainText('AI 的行動計畫', { timeout: 10000 });
  await expect(page.locator('#black-equation [data-role="stage-hand-cards"] [data-card-id]').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#black-equation [data-role="stage-center-cards"] [data-card-id]').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#black-actions [data-role="plan-continue-btn"]')).toBeVisible();
  await expect(page.locator('#status-banner')).toContainText('AI 的行動計畫');
  await expect(page.locator('#black-equation [data-role="move-preview"] .equation-line')).toHaveAttribute('data-equation', / = /);

  await page.locator('#black-actions [data-role="plan-continue-btn"]').click();
  await expect(page.locator('#status-banner')).toContainText('行動結算中', { timeout: 2000 });
});

test('keeps the full tabletop fixed inside a portrait phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  const layout = await page.evaluate(() => ({
    bodyHeight: document.body.scrollHeight,
    viewportHeight: window.innerHeight,
    boardBottom: document.querySelector('#game-board').getBoundingClientRect().bottom,
    tableTransform: getComputedStyle(document.querySelector('#table-surface')).transform,
    visibleCards: document.querySelectorAll('#white-hand [data-card-id], #black-hand [data-card-id], #center-cards [data-card-id]').length
  }));

  expect(layout.bodyHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.boardBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.tableTransform).toBe('none');
  expect(layout.visibleCards).toBe(18);
});

test('fits the tabletop under a short portrait viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  const layout = await page.evaluate(() => {
    const board = document.querySelector('#game-board').getBoundingClientRect();
    const white = document.querySelector('#white-area').getBoundingClientRect();
    const black = document.querySelector('#black-area').getBoundingClientRect();
    const handsFit = ['#white-hand', '#black-hand'].every((selector) => {
      const area = selector === '#white-hand' ? white : black;
      return [...document.querySelectorAll(`${selector} [data-card-id]`)].every((card) => {
        const rect = card.getBoundingClientRect();
        return rect.top >= area.top && rect.bottom <= area.bottom;
      });
    });
    return {
      bodyHeight: document.body.scrollHeight,
      viewportHeight: innerHeight,
      boardBottom: board.bottom,
      blackBottom: black.bottom,
      handsFit
    };
  });

  expect(layout.bodyHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.boardBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.blackBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.handsFit).toBe(true);
});

test('keeps a no-scroll landscape tabletop with players across from each other', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  const layout = await page.evaluate(() => {
    const white = document.querySelector('#white-area').getBoundingClientRect();
    const play = document.querySelector('#table-surface').getBoundingClientRect();
    const black = document.querySelector('#black-area').getBoundingClientRect();
    return {
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      ordered: white.bottom <= play.top && play.bottom <= black.top
    };
  });

  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.bodyHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.ordered).toBe(true);
});

test('rotates only equation contents toward white after the turn changes', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  await page.locator('#black-hand [data-card-id="b1"]').click();
  await page.locator('#black-hand [data-card-id="b5"]').click();
  await page.locator('#center-cards [data-card-id="w9"]').click();
  await page.locator('#black-actions [data-op="+"]').click();
  await page.locator('#black-actions [data-role="main-btn"]').click();

  await expect(page.locator('body')).toHaveClass(/is-white-turn/, { timeout: 4000 });
  await expect(page.locator('body')).toHaveClass(/is-turning/);
  await expect(page.locator('body')).not.toHaveClass(/is-turning/, { timeout: 2000 });

  const orientation = await page.evaluate(() => {
    const white = document.querySelector('#white-area').getBoundingClientRect();
    const black = document.querySelector('#black-area').getBoundingClientRect();
    const equationTransforms = [...document.querySelectorAll('.equation-zone .equation-content')].map(el => getComputedStyle(el).transform);
    return {
      equationTransforms,
      tableTransform: getComputedStyle(document.querySelector('#table-area')).transform,
      centerTransform: getComputedStyle(document.querySelector('#center-area')).transform,
      whiteActionTransform: getComputedStyle(document.querySelector('#white-actions .action-content')).transform,
      blackActionTransform: getComputedStyle(document.querySelector('#black-actions .action-content')).transform,
      centralZoneCount: document.querySelectorAll('#table-surface > *').length,
      whiteRemainsNearestWhitePlayer: white.top < black.top,
      titleTransform: getComputedStyle(document.querySelector('#ui-title')).transform,
      scrollHeight: document.body.scrollHeight,
      viewportHeight: innerHeight
    };
  });

  expect(orientation.equationTransforms.every(transform => transform !== 'none')).toBe(true);
  expect(orientation.tableTransform).toBe('none');
  expect(orientation.centerTransform).toBe('none');
  expect(orientation.whiteActionTransform).not.toBe('none');
  expect(orientation.blackActionTransform).toBe('none');
  expect(orientation.centralZoneCount).toBe(5);
  expect(orientation.whiteRemainsNearestWhitePlayer).toBe(true);
  expect(orientation.titleTransform).toBe('none');
  expect(orientation.scrollHeight).toBeLessThanOrEqual(orientation.viewportHeight);
});
