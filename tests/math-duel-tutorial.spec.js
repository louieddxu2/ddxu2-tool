import { test, expect } from '@playwright/test';

const pageErrors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
});
test.afterEach(async ({ page }) => expect(pageErrors.get(page)).toEqual([]));

const continueButton = page => page.locator('#black-actions [data-role="plan-continue-btn"]');
const fieldIds = page => page.evaluate(() => game.center.map(card => card.id).sort());
const checkpoint = (page, step, key) => Promise.all([
  expect(page.locator('body')).toHaveAttribute('data-tutorial-step', `move-${step}`),
  expect(page.locator('body')).toHaveAttribute('data-tutorial-checkpoint', key)
]);

async function beginPlay(page) {
  await checkpoint(page, 1, 'opening:0');
  await continueButton(page).click();
  await checkpoint(page, 1, 'opening:1');
  await continueButton(page).click();
}

async function startLesson(page) {
  await page.goto('/math-duel/index.html');
  await page.locator('#welcome-start').click();
  await beginPlay(page);
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-1');
}

async function send(page, hand, targets, op) {
  // Deliberately choose the result and operator before the hand cards.
  for (const id of targets) await page.locator(`#center-cards [data-card-id="${id}"]`).click();
  await page.locator(`#black-actions [data-op="${op}"]`).click();
  for (const id of hand) {
    await page.locator(`#black-hand [data-card-id="${id}"]`).click();
    await expect(page.locator('#black-play-hint')).toBeVisible();
  }
  await page.locator('#black-actions [data-role="main-btn"]').click();
}

async function reachSecondMove(page) {
  await startLesson(page);
  await send(page, ['b8', 'b1'], ['w9'], '+');
  await checkpoint(page, 2, 'before-exchange:0');
}

async function finishSecondMove(page) {
  await continueButton(page).click();
  await checkpoint(page, 2, 'before-exchange:1');
  await continueButton(page).click();
  await checkpoint(page, 2, 'before-keep:0');
  await continueButton(page).click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-3');
}

async function reachFourthMove(page) {
  await finishSecondMove(page);
  await send(page, ['b7', 'b3', 'b6', 'b5'], ['w2', 'w1'], '-');
  await expect(page.locator('body')).toHaveAttribute('data-game-state', 'DISCARDING');
  await page.locator('#center-cards [data-card-id="b6"]').click();
  await page.locator('#center-cards [data-card-id="b3"]').click();
  await page.locator('#black-actions [data-role="main-btn"]').click();
  await checkpoint(page, 4, 'before-exchange:0');
}

test('offers teaching or written rules, remembers the checkbox, and keeps manual replay', async ({ page }) => {
  await page.goto('/math-duel/index.html');
  await expect(page.locator('#welcome-modal')).toBeVisible();
  await expect(page.locator('#welcome-dont-show')).not.toBeChecked();
  await expect(page.locator('#welcome-start')).toHaveText('開始教學');
  await page.locator('#welcome-rules').click();
  await expect(page.locator('#welcome-modal')).toBeHidden();
  await expect(page.locator('#rules-modal')).toBeVisible();
  await expect(page.locator('#rules-start-tutorial')).toHaveText('再次教學');
  await page.locator('#modal-close-btn').click();
  await expect(page.locator('body')).not.toHaveClass(/is-tutorial/);
  await page.reload();
  await expect(page.locator('#welcome-modal')).toBeVisible();
  await page.locator('#welcome-dont-show').check();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mathDuelGuide_v2')).dontShow)).toBe(true);
  await page.locator('#welcome-play').click();
  await page.reload();
  await expect(page.locator('#welcome-modal')).toBeHidden();
  await page.locator('.utility-rules').click();
  await page.locator('#rules-start-tutorial').click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-1');
});

test('finishes five real moves with AI pauses, division and the ordinary win condition', async ({ page }, testInfo) => {
  await reachSecondMove(page);
  expect(await fieldIds(page)).toEqual(['b1', 'b8']);
  await expect(page.locator('#white-equation [data-role="stage-hand-cards"] [data-card-id]')).toHaveCount(3);
  await expect(page.locator('#white-equation [data-role="stage-center-cards"] [data-card-id]')).toHaveCount(2);
  await expect(page.locator('#black-equation [data-tutorial-focus]')).toHaveCount(0);
  const storedFirst = await page.evaluate(() => JSON.parse(localStorage.getItem('mathDuelState_v1.6.0')));
  expect(storedFirst.turn).toBe('WHITE');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mathDuelGuide_v2') || '{}').completed === true)).toBe(false);
  await continueButton(page).click();
  await checkpoint(page, 2, 'before-exchange:1');
  expect(await fieldIds(page)).toEqual(['b1', 'b8']);
  await page.screenshot({ path: testInfo.outputPath('ai-two-digit-result.png') });
  await continueButton(page).click();
  await checkpoint(page, 2, 'before-keep:0');
  expect(await fieldIds(page)).toEqual(['w1', 'w2', 'w6']);
  await continueButton(page).click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-3');
  await send(page, ['b7', 'b3', 'b6', 'b5'], ['w2', 'w1'], '-');
  await expect(page.locator('body')).toHaveAttribute('data-game-state', 'DISCARDING');
  await expect(page.locator('#white-equation [data-tutorial-focus]')).toHaveCount(0);
  await page.locator('#center-cards [data-card-id="b3"]').click();
  await page.locator('#center-cards [data-card-id="b6"]').click();
  await page.locator('#black-actions [data-role="main-btn"]').click();
  await checkpoint(page, 4, 'before-exchange:0');
  await expect(page.locator('#white-equation [data-card-id="b6"]')).toHaveAttribute('data-effective-value', '9');
  expect(await page.evaluate(() => game.center.find(card => card.id === 'b6').val)).toBe(6);
  await continueButton(page).click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-5');
  await expect(page.locator('#black-play-hint')).toContainText('用除法把剩下的黑牌換掉');
  await expect(page.locator('#black-play-hint')).not.toContainText('選黑 2');
  await page.locator('.utility-rules').click();
  await page.locator('#rules-step-help').click();
  await expect(page.locator('#black-play-hint')).toContainText('選黑 2、4、9 和白 9');
  // Check the solver's effective digits before sending the last play.
  await page.locator('#center-cards [data-card-id="w4"]').click();
  await page.locator('#black-actions [data-op="/"]').click();
  for (const id of ['w9', 'b4', 'b2', 'b9']) await page.locator(`#black-hand [data-card-id="${id}"]`).click();
  await expect(page.locator('#black-equation [data-role="move-preview"] .equation-line')).toHaveAttribute('data-equation', '96 ÷ 24 = 4');
  await expect(page.locator('#black-equation [data-card-id="w9"]')).toHaveAttribute('data-effective-value', '6');
  await page.screenshot({ path: testInfo.outputPath('division-last-move.png') });
  await page.locator('#black-actions [data-role="main-btn"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-game-state', 'DISCARDING');
  await page.locator('#center-cards [data-card-id="w9"]').click();
  await page.locator('#center-cards [data-card-id="b9"]').click();
  await page.locator('#black-actions [data-role="main-btn"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-game-state', 'GAMEOVER');
  await expect(page.locator('body')).not.toHaveClass(/is-tutorial/);
  expect(await page.evaluate(() => ({ winner: game.winner, hand: game.blackHand.map(card => card.id).sort(), actions: gameSession.action }))).toEqual({ winner: 'BLACK', hand: ['w1', 'w2', 'w4'], actions: 5 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mathDuelGuide_v2')).completed)).toBe(true);
  await page.reload();
  await expect(page.locator('#welcome-modal')).toBeHidden();
  await page.locator('.utility-rules').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#rules-start-tutorial').click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-1');
  expect(await page.evaluate(() => gameSession.action)).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mathDuelGuide_v2')).completed)).toBe(true);
});

for (const pause of ['before-exchange:0', 'before-exchange:1', 'before-keep:0', 'fourth-move']) {
  test(`skips at ${pause} without duplicating the revealed AI action`, async ({ page }) => {
    await reachSecondMove(page);
    if (pause === 'before-exchange:1' || pause === 'before-keep:0') {
      await continueButton(page).click();
      await checkpoint(page, 2, 'before-exchange:1');
    }
    if (pause === 'before-keep:0') {
      await continueButton(page).click();
      await checkpoint(page, 2, 'before-keep:0');
    }
    if (pause === 'fourth-move') await reachFourthMove(page);
    await page.locator('.utility-rules').click();
    await page.locator('#rules-skip-tutorial').click();
    await expect(page.locator('body')).not.toHaveClass(/is-tutorial/);
    await expect(page.locator('#black-turn-status')).toHaveText('輪到你了');
    expect(await fieldIds(page)).toEqual(pause === 'fourth-move' ? ['w4', 'w5'] : ['w1', 'w2']);
    expect(await page.evaluate(() => gameSession.action)).toBe(pause === 'fourth-move' ? 4 : 2);
    expect(await page.evaluate(() => ({ gate: Boolean(tutorialGate), plan: Boolean(aiPlanResolver) }))).toEqual({ gate: false, plan: false });
    await expect(page.locator('[data-tutorial-focus]')).toHaveCount(0);
  });
}

test('rejects a different legal task without changing the board or claiming bad arithmetic', async ({ page }) => {
  await startLesson(page);
  await send(page, ['b1', 'b5'], ['w9'], '+');
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-1');
  await expect(page.locator('#black-play-hint')).toContainText('這步請用黑 1、8');
  expect(await fieldIds(page)).toEqual(['w9']);
  expect(await page.evaluate(() => game.blackHand.length)).toBe(9);
  await page.locator('#black-equation [data-card-id="b5"]').click();
  await page.locator('#black-hand [data-card-id="b8"]').click();
  await page.locator('#black-actions [data-role="main-btn"]').click();
  await checkpoint(page, 2, 'before-exchange:0');
});

test('restarts a held lesson and rejects the old worker and repeated continue callbacks', async ({ page }) => {
  await reachSecondMove(page);
  await page.evaluate(() => { window.oldLessonWorker = worker; });
  page.on('dialog', dialog => dialog.accept());
  await page.locator('.utility-reset').click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-1');
  await page.evaluate(() => {
    oldLessonWorker.onmessage({ data: { hand: ['w1', 'w2'], center: ['b1'], op: '+' } });
    continueAiPlan(); continueAiPlan();
  });
  expect(await fieldIds(page)).toEqual(['w9']);
  expect(await page.evaluate(() => ({ action: gameSession.action, hand: game.blackHand.length, turn: game.turn, busy: game.uiBusy }))).toEqual({ action: 0, hand: 9, turn: 'BLACK', busy: false });
  await send(page, ['b1', 'b8'], ['w9'], '+');
  await checkpoint(page, 2, 'before-exchange:0');
  await page.evaluate(() => { continueAiPlan(); continueAiPlan(); continueAiPlan(); });
  await checkpoint(page, 2, 'before-keep:0');
  await page.evaluate(() => { continueAiPlan(); continueAiPlan(); });
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-3');
  expect(await page.evaluate(() => gameSession.action)).toBe(2);
});

test('keeps a wrong retention choice reversible without advancing the teaching action', async ({ page }) => {
  await reachSecondMove(page);
  await finishSecondMove(page);
  await send(page, ['b3', 'b5', 'b6', 'b7'], ['w1', 'w2'], '-');
  await expect(page.locator('body')).toHaveAttribute('data-game-state', 'DISCARDING');
  const before = await fieldIds(page);
  for (const id of ['b5', 'b7']) await page.locator(`#center-cards [data-card-id="${id}"]`).click();
  await page.locator('#black-actions [data-role="main-btn"]').click();
  await expect(page.locator('#black-play-hint')).toContainText('請留下這步指定的兩張牌');
  expect(await fieldIds(page)).toEqual(before);
  expect(await page.evaluate(() => gameSession.action)).toBe(2);
  for (const id of ['b5', 'b7', 'b3', 'b6']) await page.locator(`#center-cards [data-card-id="${id}"]`).click();
  await page.locator('#black-actions [data-role="main-btn"]').click();
  await checkpoint(page, 4, 'before-exchange:0');
});

test('traps keyboard focus in help and closes it without leaving the lesson', async ({ page }) => {
  await startLesson(page);
  await page.locator('.utility-rules').click();
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.closest('.game-dialog')?.id)).toBe('rules-modal');
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#rules-modal')).toBeHidden();
  await expect(page.locator('.utility-rules')).toBeFocused();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-1');
});

test('confirms a manual restart, lets mode and rule changes end the lesson, and retains surrender', async ({ page }) => {
  await page.goto('/math-duel/index.html');
  await page.locator('#welcome-play').click();
  await page.locator('#black-hand [data-card-id="b1"]').click();
  await page.locator('.utility-rules').click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#rules-start-tutorial').click();
  await expect(page.locator('#rules-modal')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/is-tutorial/);
  expect(await page.evaluate(() => game.selections.hand)).toEqual(['b1']);
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#rules-start-tutorial').click();
  await expect(page.locator('#black-actions [data-role="giveup-btn"]')).toHaveText('放棄');
  await page.locator('[data-role="utility-mode"]').click();
  await page.locator('#utility-mode-menu [data-mode="PVP"]').click();
  await expect(page.locator('body')).not.toHaveClass(/is-tutorial/);
  expect(await page.evaluate(() => game.mode)).toBe('PVP');
  await page.locator('.utility-rules').click();
  await page.locator('#rules-start-tutorial').click();
  await page.locator('[data-role="utility-rule"]').click();
  await page.locator('#utility-rule-menu [data-rule-mode="RACE2"]').click();
  await expect(page.locator('body')).not.toHaveClass(/is-tutorial/);
  expect(await page.evaluate(() => game.ruleMode)).toBe('RACE2');
  await page.locator('.utility-rules').click();
  await page.locator('#rules-start-tutorial').click();
  expect(await page.evaluate(() => game.ruleMode)).toBe('CLASSIC');
  await beginPlay(page);
  await page.locator('#black-actions [data-role="giveup-btn"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-game-state', 'GAMEOVER');
  expect(await page.evaluate(() => game.winner)).toBe('WHITE');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mathDuelGuide_v2') || '{}').completed === true)).toBe(false);
});

test('reloads a paused lesson as an ordinary saved game and safely leaves via home', async ({ page }) => {
  await reachSecondMove(page);
  await page.reload();
  await expect(page.locator('#welcome-modal')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/is-tutorial/);
  await page.locator('#welcome-dont-show').check();
  await page.locator('#welcome-play').click();
  await expect(page.locator('#black-turn-status')).toHaveText('輪到你了');
  expect(await fieldIds(page)).toEqual(['w1', 'w2']);
  await page.locator('.utility-rules').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#rules-start-tutorial').click();
  await beginPlay(page);
  await send(page, ['b1', 'b8'], ['w9'], '+');
  await checkpoint(page, 2, 'before-exchange:0');
  await page.locator('.utility-home').click();
  await expect(page).toHaveURL(/home=1/);
  await page.goto('/math-duel/index.html');
  await expect(page.locator('body')).not.toHaveClass(/is-tutorial/);
  await expect(page.locator('#black-turn-status')).toHaveText('輪到你了');
});

test('keeps selection animations non-blocking during the lesson', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await startLesson(page);
  await page.locator('#black-hand [data-card-id="b1"]').click();
  expect(await page.evaluate(() => game.uiBusy)).toBe(false);
  await expect(page.locator('#black-actions [data-op="+"]')).toBeEnabled();
  await page.locator('#black-actions [data-op="+"]').click();
  await page.locator('#black-hand [data-card-id="b8"]').click();
  await page.locator('#center-cards [data-card-id="w9"]').click();
  await expect(page.locator('#black-actions [data-role="main-btn"]')).toBeEnabled();
  expect(await page.evaluate(() => game.uiBusy)).toBe(false);
});

test('does not start an existing AI turn behind the entry dialog', async ({ page }) => {
  await page.goto('/math-duel/index.html');
  await page.locator('#welcome-play').click();
  await page.evaluate(() => {
    game = createInitialState('AI_EASY', MathDuelRuleModes.RULE_MODE.CLASSIC, 'BLACK');
    saveState();
  });
  await page.reload();
  await expect(page.locator('#welcome-modal')).toBeVisible();
  expect(await page.evaluate(() => ({ requested: aiRequestPending, prepared: Boolean(game.aiMoveInfo), hand: game.blackHand.length }))).toEqual({ requested: false, prepared: false, hand: 9 });
  await page.locator('#welcome-play').click();
  await expect(page.locator('#white-turn-status')).toHaveText('輪到你了');
});

test('holds the teaching AI after real animations while language and help remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await reachSecondMove(page);
  expect(await page.evaluate(() => ({ gate: Boolean(tutorialGate), automaticTimer: Boolean(aiPlanResolver), busy: game.uiBusy }))).toEqual({ gate: true, automaticTimer: false, busy: false });
  await page.locator('.utility-language').click();
  await expect(page.locator('#black-play-hint')).toContainText('Three cards');
  await expect(continueButton(page)).toHaveText('See result');
  await page.locator('.utility-rules').click();
  await page.locator('#modal-close-btn').click();
  await checkpoint(page, 2, 'before-exchange:0');
  await continueButton(page).click();
  await checkpoint(page, 2, 'before-exchange:1');
  await continueButton(page).click();
  await checkpoint(page, 2, 'before-keep:0');
  await continueButton(page).click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-3');
});

test('fits welcome, help and long teaching hints in portrait and short landscape', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  for (const size of [{ width: 320, height: 480 }, { width: 390, height: 844 }, { width: 800, height: 360 }]) {
    for (const language of ['zh', 'en']) {
      await page.setViewportSize(size);
      await page.goto('/math-duel/index.html');
      await expect(page.locator('#welcome-modal')).toBeVisible();
      await page.evaluate(lang => { LANG = lang; refreshDialogText(); }, language);
      for (const selector of ['#welcome-start', '#welcome-rules', '#welcome-play', '#welcome-dont-show']) {
        const box = await page.locator(selector).boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      }
      await page.locator('#welcome-start').click();
      await beginPlay(page);
      await send(page, ['b1', 'b8'], ['w9'], '+');
      await checkpoint(page, 2, 'before-exchange:0');
      for (const key of ['before-exchange:0', 'before-exchange:1', 'before-keep:0']) {
        await checkpoint(page, 2, key);
        const layout = await page.evaluate(() => {
          const hint = document.getElementById('black-play-hint');
          const hintBox = hint.getBoundingClientRect();
          const equation = document.getElementById('black-equation').getBoundingClientRect();
          const textBoxes = [...hint.querySelectorAll('span')].flatMap(span => {
            const range = document.createRange(); range.selectNodeContents(span); return [...range.getClientRects()];
          });
          const controls = [...document.querySelectorAll('.utility-rail .table-icon')].map(button => button.getBoundingClientRect());
          return {
            noOverflow: document.body.scrollHeight <= innerHeight && document.body.scrollWidth <= innerWidth,
            hintInside: hintBox.top >= equation.top - 1 && hintBox.bottom <= equation.bottom + 1,
            noCollision: textBoxes.every(text => controls.every(control => text.bottom <= control.top || text.top >= control.bottom || text.right <= control.left || text.left >= control.right)),
            textFits: textBoxes.every(text => text.top >= hintBox.top && text.bottom <= hintBox.bottom && text.left >= hintBox.left && text.right <= hintBox.right),
            textLines: textBoxes.map(text => ({ top: text.top, bottom: text.bottom })),
            hint: hintBox.toJSON(), equation: equation.toJSON()
          };
        });
        expect(layout.noOverflow, JSON.stringify(layout)).toBe(true);
        expect(layout.hintInside, JSON.stringify(layout)).toBe(true);
        expect(layout.noCollision, JSON.stringify(layout)).toBe(true);
        expect(layout.textFits, JSON.stringify(layout)).toBe(true);
        await continueButton(page).click();
      }
      await page.locator('.utility-rules').click();
      for (const selector of ['#rules-start-tutorial', '#rules-step-help', '#rules-skip-tutorial', '#modal-close-btn']) {
        const box = await page.locator(selector).boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      }
      await page.screenshot({ path: testInfo.outputPath(`lesson-help-${size.width}-${language}.png`) });
      await page.evaluate(() => { localStorage.removeItem('mathDuelState_v1.6.0'); });
    }
  }
});
