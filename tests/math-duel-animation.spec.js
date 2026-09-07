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
  await page.locator('#action-panel [data-op="+"]').click();

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
    localStorage.setItem('mathDuelState_v1.7.0', JSON.stringify({
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
  await expect(page.locator('#status-banner')).toContainText('AI 的行動計畫');
  await expect(page.locator('#move-preview .equation-line')).toHaveAttribute('data-equation', / = /);

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

test('turns the three reading surfaces while keeping seats and utilities fixed', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  await page.locator('#black-hand [data-card-id="b1"]').click();
  await page.locator('#black-hand [data-card-id="b5"]').click();
  await page.locator('#center-cards [data-card-id="w9"]').click();
  await page.locator('#action-panel [data-op="+"]').click();
  await page.locator('#main-btn').click();

  await expect(page.locator('body')).toHaveClass(/is-white-turn/, { timeout: 4000 });
  await expect(page.locator('body')).toHaveClass(/is-turning/);
  await expect(page.locator('body')).not.toHaveClass(/is-turning/, { timeout: 2000 });

  const orientation = await page.evaluate(() => {
    const white = document.querySelector('#white-area').getBoundingClientRect();
    const black = document.querySelector('#black-area').getBoundingClientRect();
    const surfaces = ['#white-operation .equation-view', '#center-area .center-content', '#black-operation .equation-view'];
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

test('keeps white card flights facing white and accepts input during a flight', async ({ page }) => {
  await page.goto('/math-duel/index.html');
  await page.evaluate(() => { game.turn = 'WHITE'; render(); });
  await page.locator('#white-hand [data-card-id="w2"]').click();
  await page.waitForSelector('#card-motion-layer [data-card-id="w2"]');
  const flight = await page.locator('#card-motion-layer [data-card-id="w2"]').evaluate(el => ({
    transform: el.style.transform,
    busy: game.uiBusy
  }));
  expect(flight.transform).toContain('rotate(180deg)');
  expect(flight.busy).toBe(false);
  await page.locator('#action-panel [data-op="+"]').click();
  expect(await page.evaluate(() => game.selections.operator)).toBe('+');
  await page.locator('.settings-toggle').click();
  await expect(page.locator('#table-settings')).toBeVisible();
});

test('restarting during settlement does not let the previous game change the new turn', async ({ page }) => {
  await page.goto('/math-duel/index.html');
  await page.evaluate(() => {
    game.selections = {hand:['b1','b5'],center:['w9'],operator:'+'};
    render(); handleMainAction(); resetGame(false);
  });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => ({turn:game.turn, state:game.state, count:game.blackHand.length})))
    .toEqual({turn:'BLACK',state:'PLAYING',count:9});
});

test('race mode awards a pass point and clears only the unfinished selection', async ({ page }) => {
  await page.goto('/math-duel/index.html');
  await page.evaluate(() => {
    game = createInitialState('PVP','RACE2');
    game.selections={hand:['b1'],center:[],operator:'+'};render();
  });
  await page.locator('#giveup-btn').click();
  expect(await page.evaluate(()=>({turn:game.turn,points:game.scores.WHITE,selected:game.selections.hand.length})))
    .toEqual({turn:'WHITE',points:1,selected:0});
  await expect(page.locator('#black-hand [data-card-id="b1"]')).toBeVisible();
  await expect(page.locator('#white-info')).toContainText('1/2');
});
