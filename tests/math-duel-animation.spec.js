import { test, expect } from '@playwright/test';

test('animates a card exchange and resolves it into the correct zones', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  await expect(page.locator('#main-btn')).toBeDisabled();

  await page.locator('[data-card-id="b1"]').click();
  await expect(page.locator('#stage-hand-cards [data-card-id="b1"]')).toBeVisible({ timeout: 2000 });
  await page.locator('[data-card-id="b5"]').click();
  await expect(page.locator('#stage-hand-cards [data-card-id="b5"]')).toBeVisible({ timeout: 2000 });
  await page.locator('[data-card-id="w9"]').click();
  await expect(page.locator('#stage-center-cards [data-card-id="w9"]')).toBeVisible({ timeout: 2000 });
  await page.locator('[data-op="+"]').click();

  await expect(page.locator('#main-btn')).toBeEnabled();
  await expect(page.locator('#move-preview .equation-line')).toHaveAttribute('data-equation', '1 + 5 = 6');
  await expect(page.locator('#stage-center-cards .card-face-number.is-transformed')).toBeVisible();

  await page.locator('#main-btn').click();
  await expect(page.locator('#status-banner')).toContainText('行動結算中', { timeout: 1000 });
  await expect(page.locator('#main-btn')).toBeHidden();

  await expect(page.locator('#center-cards [data-card-id="b1"]')).toBeVisible({ timeout: 7000 });
  await expect(page.locator('#center-cards [data-card-id="b5"]')).toBeVisible({ timeout: 7000 });
  await expect(page.locator('#black-hand [data-card-id="w9"]')).toBeVisible({ timeout: 7000 });
  await expect(page.locator('#white-area')).toHaveClass(/border-blue-500/);
});

test('reveals the AI plan in the play area before resolving it', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mathDuelLang', 'zh');
    localStorage.setItem('mathDuelState_v1.3.2', JSON.stringify({
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
  await expect(page.locator('#stage-hand-cards [data-card-id]').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#stage-center-cards [data-card-id]').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#plan-continue-btn')).toBeVisible();
  await expect(page.locator('#move-preview')).toContainText('AI 的行動計畫');

  await page.locator('#plan-continue-btn').click();
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
    tableTransform: getComputedStyle(document.querySelector('#play-area')).transform,
    visibleCards: document.querySelectorAll('#white-hand [data-card-id], #black-hand [data-card-id], #center-cards [data-card-id]').length
  }));

  expect(layout.bodyHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.boardBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.tableTransform).toBe('none');
  expect(layout.visibleCards).toBe(18);
});

test('keeps a no-scroll landscape tabletop with players across from each other', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  const layout = await page.evaluate(() => {
    const white = document.querySelector('#white-area').getBoundingClientRect();
    const play = document.querySelector('#play-area').getBoundingClientRect();
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

test('rotates the entire tabletop toward white after the turn changes', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  await page.locator('#black-hand [data-card-id="b1"]').click();
  await page.locator('#black-hand [data-card-id="b5"]').click();
  await page.locator('#center-cards [data-card-id="w9"]').click();
  await page.locator('[data-op="+"]').click();
  await page.locator('#main-btn').click();

  await expect(page.locator('body')).toHaveClass(/is-white-turn/, { timeout: 4000 });
  await expect(page.locator('body')).toHaveClass(/is-turning/);
  await expect(page.locator('body')).not.toHaveClass(/is-turning/, { timeout: 2000 });

  const orientation = await page.evaluate(() => {
    const white = document.querySelector('#white-area').getBoundingClientRect();
    const black = document.querySelector('#black-area').getBoundingClientRect();
    const surfaces = ['.app-header', '#game-meta', '#white-area', '#center-area', '#play-area', '#black-area'];
    return {
      transforms: surfaces.map(selector => getComputedStyle(document.querySelector(selector)).transform),
      whiteRemainsNearestWhitePlayer: white.top < black.top,
      titleTransform: getComputedStyle(document.querySelector('#ui-title')).transform,
      scrollHeight: document.body.scrollHeight,
      viewportHeight: innerHeight
    };
  });

  expect(orientation.transforms.every(transform => transform !== 'none')).toBe(true);
  expect(orientation.whiteRemainsNearestWhitePlayer).toBe(true);
  expect(orientation.titleTransform).toBe('none');
  expect(orientation.scrollHeight).toBeLessThanOrEqual(orientation.viewportHeight);
});
