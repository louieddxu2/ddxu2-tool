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

test('does not mirror active control highlights into the opponent action zone', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  await page.locator('#black-hand [data-card-id="b1"]').click();
  await expect(page.locator('#black-equation [data-role="stage-hand-cards"] [data-card-id="b1"]')).toBeVisible({ timeout: 2000 });
  await page.locator('#black-hand [data-card-id="b5"]').click();
  await expect(page.locator('#black-equation [data-role="stage-hand-cards"] [data-card-id="b5"]')).toBeVisible({ timeout: 2000 });
  await page.locator('#center-cards [data-card-id="w9"]').click();
  await expect(page.locator('#black-equation [data-role="stage-center-cards"] [data-card-id="w9"]')).toBeVisible({ timeout: 2000 });
  await page.locator('#black-actions [data-op="+"]').click();

  await expect(page.locator('#black-actions [data-op="+"]')).toHaveClass(/bg-blue-600/);
  await expect(page.locator('#white-actions [data-op="+"]')).not.toHaveClass(/bg-blue-600/);
  await expect(page.locator('#black-actions [data-role="main-btn"]')).toHaveClass(/bg-blue-600/);
  await expect(page.locator('#white-actions [data-role="main-btn"]')).not.toHaveClass(/bg-blue-600/);
  await expect(page.locator('#white-actions [data-role="main-btn"]')).toBeDisabled();
});

test('anchors deselection animation to the live card when history repeats its id', async ({ page }) => {
  await page.addInitScript(() => {
    const card = (id, val, color) => ({ id, val, color });
    const w1 = card('w1', 1, 'w');
    const w2 = card('w2', 2, 'w');
    const w3 = card('w3', 3, 'w');
    const b3 = card('b3', 3, 'b');
    localStorage.setItem('mathDuelLang', 'zh');
    localStorage.setItem('mathDuelState_v1.6.0', JSON.stringify({
      mode: 'PVP',
      ruleMode: 'CLASSIC',
      turn: 'BLACK',
      aiSide: null,
      aiColor: null,
      playerColor: null,
      state: 'PLAYING',
      winner: null,
      blackHand: Array.from({ length: 9 }, (_, i) => card(`b${i + 1}`, i + 1, 'b')),
      whiteHand: [w3, ...Array.from({ length: 5 }, (_, i) => card(`w${i + 4}`, i + 4, 'w')), b3],
      center: [w1, w2],
      selections: { hand: [], center: [], operator: null },
      discardSelections: [],
      lastMove: {
        handCards: [w1, w2],
        centerCards: [b3],
        op: '+',
        turn: 'WHITE',
        witness: {
          success: true,
          op: '+',
          operator: '+',
          left: { cards: [w1], cardIds: ['w1'], digits: [1], value: 1, display: '1' },
          right: { cards: [w2], cardIds: ['w2'], digits: [2], value: 2, display: '2' },
          target: { cards: [b3], cardIds: ['b3'], digits: [3], value: 3, display: '3' },
          eq: '1 + 2 = 3'
        },
        eq: '1 + 2 = 3'
      },
      aiMoveInfo: null,
      movePreview: null,
      uiBusy: false,
      scores: { BLACK: 0, WHITE: 0 },
      winScore: 2
    }));
  });
  await page.goto('/math-duel/index.html');

  await expect(page.locator('#white-equation [data-role="stage-hand-cards"] [data-card-id="w1"]')).toBeVisible();
  await page.locator('#center-cards [data-card-id="w1"]').click();
  await expect(page.locator('#black-equation [data-role="stage-center-cards"] [data-card-id="w1"]')).toBeVisible();
  await expect(page.locator('#white-equation [data-role="stage-hand-cards"] [data-card-id="w1"]')).not.toHaveClass(/ring-/);
  await expect(page.locator('#card-motion-layer')).toHaveCount(1, { timeout: 1000 });
  await expect(page.locator('#card-motion-layer [data-card-id="w1"]')).toHaveCount(0, { timeout: 2000 });

  const liveCardBefore = await page.locator('#black-equation [data-role="stage-center-cards"] [data-card-id="w1"]').boundingBox();
  const historyCardBefore = await page.locator('#white-equation [data-role="stage-hand-cards"] [data-card-id="w1"]').boundingBox();
  await page.locator('#black-equation [data-role="stage-center-cards"] [data-card-id="w1"]').click();
  await expect(page.locator('#card-motion-layer [data-card-id="w1"]')).toBeVisible({ timeout: 1000 });

  const ghostOrigin = await page.locator('#card-motion-layer [data-card-id="w1"]').evaluate((element) => ({
    left: Number.parseFloat(element.style.left),
    top: Number.parseFloat(element.style.top)
  }));
  expect(ghostOrigin.left).toBeCloseTo(liveCardBefore.x, 0);
  expect(ghostOrigin.top).toBeCloseTo(liveCardBefore.y, 0);
  expect(Math.abs(ghostOrigin.left - historyCardBefore.x)).toBeGreaterThan(5);
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
      centerContentTransforms: ['#ui-center-label', '#center-cards'].map(selector => getComputedStyle(document.querySelector(selector)).transform),
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
  expect(orientation.centerContentTransforms.every(transform => transform !== 'none')).toBe(true);
  expect(orientation.whiteActionTransform).not.toBe('none');
  expect(orientation.blackActionTransform).toBe('none');
  expect(orientation.centralZoneCount).toBe(5);
  expect(orientation.whiteRemainsNearestWhitePlayer).toBe(true);
  expect(orientation.titleTransform).toBe('none');
  expect(orientation.scrollHeight).toBeLessThanOrEqual(orientation.viewportHeight);
});
