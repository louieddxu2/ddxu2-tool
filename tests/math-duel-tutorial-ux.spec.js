import { test, expect } from '@playwright/test';

const errors = new WeakMap();
const next = page => page.locator('#black-actions [data-role="plan-continue-btn"]');
const main = page => page.locator('#black-actions [data-role="main-btn"]');
const back = page => page.locator('#black-actions [data-role="guide-back-btn"]');
const hand = (page, id) => page.locator(`#black-hand [data-card-id="${id}"]`);
const field = (page, id) => page.locator(`#center-cards [data-card-id="${id}"]`);
const held = (page, key) => expect(page.locator('body')).toHaveAttribute('data-tutorial-checkpoint', key);
const phase = (page, value) => expect(page.locator('body')).toHaveAttribute('data-tutorial-phase', value);

test.beforeEach(async ({ page }) => {
  const caught = [];
  errors.set(page, caught);
  page.on('pageerror', error => caught.push(error.message));
  page.on('console', message => { if (message.type() === 'error') caught.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

async function start(page) {
  await page.goto('/math-duel/index.html');
  await page.locator('#welcome-start').click();
  await held(page, 'opening:0');
  await next(page).click();
  await held(page, 'opening:1');
  await next(page).click();
  await held(page, 'opening:2');
  await next(page).click();
  await phase(page, 'play');
}

async function send(page, cards, results, operator) {
  for (const id of cards) await hand(page, id).click();
  await page.locator(`#black-actions [data-op="${operator}"]`).click();
  for (const id of results) await field(page, id).click();
  await main(page).click();
}

async function firstTrade(page) {
  await start(page);
  await send(page, ['b1', 'b8'], ['w9'], '+');
  await held(page, 'after-player-exchange:0');
}

async function thirdMove(page) {
  await firstTrade(page);
  await next(page).click();
  await held(page, 'before-exchange:0');
  await next(page).click();
  await held(page, 'before-exchange:1');
  await next(page).click();
  await held(page, 'before-keep:0');
  await next(page).click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-3');
}

async function finalMove(page) {
  await thirdMove(page);
  await send(page, ['b3', 'b5', 'b6', 'b7'], ['w1', 'w2'], '-');
  await held(page, 'before-keep:0');
  await next(page).click();
  await field(page, 'b3').click();
  await field(page, 'b6').click();
  await main(page).click();
  await held(page, 'before-exchange:0');
  await next(page).click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-5');
  await phase(page, 'play');
}

async function board(page) {
  return page.evaluate(() => ({
    actions: gameSession.action, turn: game.turn, state: game.state,
    black: game.blackHand.map(card => card.id).sort(),
    white: game.whiteHand.map(card => card.id).sort(),
    center: game.center.map(card => card.id).sort(),
    hand: [...game.selections.hand], result: [...game.selections.center],
    operator: game.selections.operator, keep: [...game.discardSelections]
  }));
}

async function expectHintFits(page) {
  const layout = await page.evaluate(() => {
    const hint = document.getElementById('black-play-hint');
    const box = hint.getBoundingClientRect();
    const equation = document.getElementById('black-equation').getBoundingClientRect();
    const status = document.getElementById('black-turn-status').getBoundingClientRect();
    const progress = document.getElementById('black-score').getBoundingClientRect();
    const label = document.getElementById('black-label').getBoundingClientRect();
    const separate = (a, b) => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
    const hintBox = { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    const overflowingText = [...hint.querySelectorAll('span')].filter(span => span.children.length === 0).flatMap(span => {
      const range = document.createRange();
      range.selectNodeContents(span);
      return [...range.getClientRects()].filter(rect => rect.top < box.top || rect.bottom > box.bottom || rect.left < box.left || rect.right > box.right)
        .map(rect => ({ hint: span.dataset.hint || span.dataset.hintLabel || '', text: span.textContent.trim(), top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), hintBox }));
    });
    return {
      inPlayedArea: box.top >= equation.top && box.bottom <= equation.bottom,
      linesFit: overflowingText.length === 0,
      overflowingText,
      headerFits: [status, progress, label].every(rect => rect.left >= 0 && rect.right <= innerWidth) &&
        separate(status, label) && separate(progress, label) && separate(status, progress),
      equationFits: [...document.querySelectorAll('#black-equation [data-card-id], #black-equation .operand-divider')].every(element => {
        const rect = element.getBoundingClientRect();
        const face = element.querySelector('.card-face-number')?.getBoundingClientRect();
        return rect.bottom <= box.top && (!face || face.bottom <= box.top);
      }),
      scroll: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth
    };
  });
  expect(layout, JSON.stringify(layout)).toEqual({ inPlayedArea: true, linesFit: true, overflowingText: [], headerFits: true, equationFits: true, scroll: false });
}

test('keeps opening explanations read-only, supports back, and does not skip on double-click or key repeat', async ({ page }) => {
  await page.goto('/math-duel/index.html');
  await page.locator('#welcome-start').click();
  await held(page, 'opening:0');
  await expect(next(page)).toBeFocused();
  const opening = await board(page);
  await hand(page, 'b1').click();
  await field(page, 'w9').click();
  expect(await board(page)).toEqual(opening);
  await next(page).dblclick();
  await held(page, 'opening:1');
  await expect(back(page)).toHaveAccessibleName('上一段說明');
  const prevented = await next(page).evaluate(button => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await held(page, 'opening:1');
  await back(page).click();
  await held(page, 'opening:0');
  await expect(back(page)).toBeHidden();
  await expect(next(page)).toBeFocused();
  expect(await board(page)).toEqual(opening);
  await next(page).click();
  await held(page, 'opening:1');
  await next(page).click();
  await held(page, 'opening:2');
  await expect(page.locator('#black-play-hint')).toContainText('算式中的每個數最多兩位數');
  await expect(page.locator('#black-play-hint [data-hint-label="select"]')).toHaveText('規則');
  await expect(page.locator('#black-play-hint [data-hint-label="arrange"]')).toHaveText('例子');
  await back(page).click();
  await held(page, 'opening:1');
  await back(page).click();
  await held(page, 'opening:0');
  await next(page).click();
  await next(page).click();
  await next(page).click();
  await phase(page, 'play');
  await hand(page, 'b1').click();
  expect((await board(page)).hand).toEqual(['b1']);
});

test('reviews the real first trade before requesting AI, while help and bilingual compact layouts stay usable', async ({ page }, testInfo) => {
  await firstTrade(page);
  await phase(page, 'review');
  await expect(page.locator('#black-score')).toHaveText('1/5');
  await expect(page.locator('#black-turn-status')).toHaveText('換牌完成');
  await expect(hand(page, 'w9')).toHaveAttribute('data-tutorial-focus', 'hand');
  await expect(page.locator('#black-equation [data-tutorial-focus]')).toHaveCount(0);
  expect(await page.evaluate(() => ({ requested: aiRequestPending, prepared: Boolean(game.aiMoveInfo), turn: game.turn, actions: gameSession.action })))
    .toEqual({ requested: false, prepared: false, turn: 'WHITE', actions: 1 });
  const review = await board(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mathDuelState_v1.6.0')));
  expect(saved.turn).toBe('WHITE');
  expect(saved.state).toBe('PLAYING');
  await page.locator('.utility-rules').click();
  await page.locator('#modal-close-btn').click();
  await held(page, 'after-player-exchange:0');
  expect(await board(page)).toEqual(review);
  expect(await page.evaluate(() => aiRequestPending)).toBe(false);
  for (const size of [{ width: 802, height: 293 }, { width: 320, height: 480 }, { width: 390, height: 844 }, { width: 800, height: 360 }]) {
    await page.setViewportSize(size);
    for (const language of ['zh', 'en']) {
      await page.evaluate(lang => { LANG = lang; render(); }, language);
      await expectHintFits(page);
      await page.screenshot({ path: testInfo.outputPath(`first-trade-${size.width}-${language}.png`) });
    }
  }
  await next(page).click();
  await held(page, 'before-exchange:0');
  await next(page).click();
  await held(page, 'before-exchange:1');
  const beforeExchange = await board(page);
  await back(page).click();
  await held(page, 'before-exchange:0');
  expect(await board(page)).toEqual(beforeExchange);
  await next(page).click();
  await next(page).click();
  await held(page, 'before-keep:0');
  await next(page).click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-3');
  expect((await board(page)).actions).toBe(2);
});

test('uses the opponent as the subject while the AI move is animating', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 320, height: 480 });
  await firstTrade(page);
  await next(page).click();
  await held(page, 'before-exchange:0');
  await next(page).click();
  await held(page, 'before-exchange:1');
  await next(page).click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-phase', 'resolving');
  await expect(page.locator('#black-play-hint')).toContainText('對手的牌留在場上');
  await expect(page.locator('#black-play-hint')).not.toContainText('你出的牌留下');
  await expectHintFits(page);
  await page.evaluate(() => { LANG = 'en'; render(); });
  await expect(page.locator('#black-play-hint')).toContainText('AI takes results; its cards stay.');
  await expectHintFits(page);
  await page.setViewportSize({ width: 800, height: 360 });
  await expectHintFits(page);
});

for (const exit of ['skip', 'reload']) {
  test(`can ${exit} the first-trade review and resume exactly one ordinary AI turn`, async ({ page }) => {
    await firstTrade(page);
    if (exit === 'skip') {
      await page.locator('.utility-rules').click();
      await page.locator('#rules-skip-tutorial').click();
    } else {
      await page.reload();
      await page.locator('#welcome-play').click();
    }
    await expect(page.locator('#black-turn-status')).toHaveText('輪到你了');
    await expect(page.locator('.guide-spotlight')).toBeHidden();
    await expect(page.locator('#black-score')).toBeHidden();
    expect(await page.evaluate(() => ({ actions: gameSession.action, gate: Boolean(tutorialGate), completed: MathDuelTutorial.readPreferences(localStorage).completed })))
      .toEqual({ actions: exit === 'skip' ? 2 : 1, gate: false, completed: false });
  });
}

test('explains retention before accepting choices, reports the two-card limit, and allows skipping without an extra move', async ({ page }, testInfo) => {
  await thirdMove(page);
  await send(page, ['b3', 'b5', 'b6', 'b7'], ['w1', 'w2'], '-');
  await held(page, 'before-keep:0');
  await phase(page, 'keep');
  await expect(page.locator('#black-play-hint')).toContainText('場上只留兩張');
  const heldBoard = await board(page);
  await field(page, 'b3').click();
  expect(await board(page)).toEqual(heldBoard);
  await expectHintFits(page);
  await page.screenshot({ path: testInfo.outputPath('keep-rule-before-selection.png') });
  await next(page).click();
  await field(page, 'b3').click();
  await field(page, 'b6').click();
  await field(page, 'b5').click();
  expect((await board(page)).keep).toEqual(['b3', 'b6']);
  await expect(page.locator('#black-play-hint')).toContainText('只留兩張；再點已選的牌可取消');
  await page.locator('.utility-rules').click();
  await page.locator('#rules-skip-tutorial').click();
  expect((await board(page)).actions).toBe(2);
  expect((await board(page)).keep).toEqual(['b3', 'b6']);
  await main(page).click();
  await expect(page.locator('#black-turn-status')).toHaveText('輪到你了');
  expect((await board(page)).actions).toBe(4);
});

test('makes the final hint directly available and explains overflow without changing the selected cards', async ({ page }) => {
  await finalMove(page);
  const hint = page.locator('#black-actions .is-guide-help');
  await expect(hint).toHaveAccessibleName('提示');
  await expect(page.locator('#black-play-hint')).not.toContainText('選黑 2');
  for (const id of ['b2', 'b4', 'w1', 'w2']) await hand(page, id).click();
  await expect(page.locator('#black-play-hint')).toContainText('點出牌區取消一張');
  await expect(page.locator('#black-equation [data-tutorial-focus="equation-hand"]')).toHaveCount(2);
  const beforeOverflow = await board(page);
  await hand(page, 'b9').click();
  expect(await board(page)).toEqual(beforeOverflow);
  await expect(page.locator('#black-play-hint')).toContainText('最多四張；先取消一張再選');
  await hint.click();
  await expect(page.locator('#rules-modal')).toBeHidden();
  await expect(hint).toBeFocused();
  await expect(page.locator('#black-play-hint')).toContainText('點出牌區的白 1、白 2，取消選取');
  expect(await board(page)).toEqual(beforeOverflow);
  await page.locator('#black-equation [data-card-id="w1"]').click();
  await page.locator('#black-equation [data-card-id="w2"]').click();
  await hand(page, 'b9').click();
  await expect(page.locator('#black-play-hint')).toContainText('已選 3/4');
});

test('accepts a different winning division, preserves any two field cards, and hands off to a clean normal game', async ({ page }, testInfo) => {
  await finalMove(page);
  // Legal arithmetic alone is not enough: this leaves two black cards in hand.
  const beforeAttempt = await board(page);
  await send(page, ['b4', 'w1'], ['w4'], '/');
  expect((await board(page)).actions).toBe(4);
  expect((await board(page)).center).toEqual(beforeAttempt.center);
  await expect(page.locator('#black-play-hint')).toContainText('用除法把剩下的黑牌換掉');
  await expect(page.locator('#black-play-hint')).not.toContainText('選黑 2');
  await page.locator('#black-equation [data-card-id="w1"]').click();
  await hand(page, 'b2').click();
  await hand(page, 'b9').click();
  await main(page).click();
  await expect(page.locator('body')).toHaveAttribute('data-game-state', 'DISCARDING');
  await expect(page.locator('#black-play-hint')).toContainText('選兩張你想留');
  await field(page, 'b2').click();
  await field(page, 'b4').click();
  await main(page).click();
  await phase(page, 'complete');
  await expect(page.locator('body')).not.toHaveClass(/is-tutorial/);
  await expect(page.locator('#black-hand')).toHaveAttribute('data-tutorial-focus', 'hand-area');
  await expect(main(page)).toHaveAccessibleName('開始遊玩');
  await expect(next(page)).toBeHidden();
  await expect(page.locator('#black-score')).toHaveText('5/5');
  expect(await page.evaluate(() => ({ winner: game.winner, action: gameSession.action, black: game.blackHand.filter(card => card.color === 'b').length, center: game.center.map(card => card.id).sort(), completed: MathDuelTutorial.readPreferences(localStorage).completed })))
    .toEqual({ winner: 'BLACK', action: 5, black: 0, center: ['b2', 'b4'], completed: true });
  for (const size of [{ width: 802, height: 293 }, { width: 320, height: 480 }, { width: 390, height: 844 }, { width: 800, height: 360 }]) {
    await page.setViewportSize(size);
    for (const language of ['zh', 'en']) {
      await page.evaluate(lang => { LANG = lang; render(); }, language);
      await expectHintFits(page);
      await page.screenshot({ path: testInfo.outputPath(`completion-${size.width}-${language}.png`) });
    }
  }
  await main(page).click();
  await expect(page.locator('body')).toHaveAttribute('data-game-state', 'PLAYING');
  await expect(page.locator('body')).not.toHaveAttribute('data-tutorial-phase');
  await expect(page.locator('.guide-spotlight')).toBeHidden();
  await expect(page.locator('[data-tutorial-focus]')).toHaveCount(0);
  await expect(page.locator('#black-score')).toBeHidden();
  await expect(back(page)).toBeHidden();
  await expect(page.locator('#black-actions .is-guide-help')).toHaveCount(0);
  await expect(page.locator('#black-actions [data-role="giveup-btn"]')).toHaveText('Give up');
  expect(await page.evaluate(() => ({ aiSide: game.aiSide, playerColor: game.playerColor }))).toEqual({ aiSide: 'WHITE', playerColor: 'b' });
  expect((await board(page)).actions).toBe(0);
  await hand(page, 'b1').click();
  expect((await board(page)).hand).toEqual(['b1']);
});
