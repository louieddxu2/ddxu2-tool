import { test, expect } from '@playwright/test';

const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const caught = [];
  errors.set(page, caught);
  page.on('pageerror', error => caught.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

async function start(page) {
  await page.goto('/math-duel/index.html');
  await page.locator('#welcome-start').click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-1');
  await expect(page.locator('body')).not.toHaveAttribute('data-tutorial-checkpoint');
  await expect(page.locator('.guide-spotlight')).toBeVisible();
}

async function focus(page, selector, count = 1) {
  await expect(page.locator(selector)).toHaveCount(count);
  await expect(page.locator('.guide-spotlight')).toHaveAttribute('data-target-count', String(count));
}

async function expectHintFits(page) {
  const layout = await page.evaluate(() => {
    const hint = document.getElementById('black-play-hint');
    const box = hint.getBoundingClientRect();
    const equation = document.getElementById('black-equation').getBoundingClientRect();
    const textFits = [...hint.querySelectorAll('span')].filter(span => span.children.length === 0).flatMap(span => {
      const range = document.createRange(); range.selectNodeContents(span);
      return [...range.getClientRects()];
    }).every(rect => rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1 && rect.left >= box.left - 1 && rect.right <= box.right + 1);
    const equationClear = [...document.querySelectorAll('#black-equation [data-card-id], #black-equation .operand-divider')]
      .every(element => element.getBoundingClientRect().bottom <= box.top);
    return { inside: box.top >= equation.top && box.bottom <= equation.bottom, textFits, equationClear,
      noScroll: document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth };
  });
  expect(layout, JSON.stringify(layout)).toEqual({ inside: true, textFits: true, equationClear: true, noScroll: true });
}

async function expectNextAction(page, language = 'zh') {
  const next = page.locator('#black-actions [data-role="plan-continue-btn"]');
  const label = language === 'zh' ? '下一步' : 'Next';
  await expect(next).toHaveText(label);
  await expect(next).toHaveAccessibleName(label);
  await expect(next).toBeEnabled();
  await expect(page.locator('[data-role="plan-continue-btn"]:visible')).toHaveCount(1);
  await expect(page.locator('#black-actions [data-role="operator-group"]')).toBeHidden();
  await expect(page.locator('#black-actions [data-role="main-btn"]')).toBeHidden();
  await expect(page.locator('#black-actions [data-role="giveup-btn"]')).toBeHidden();
  await expect(page.locator('.guide-spotlight-action-ring')).toHaveCount(0);
  await expect(page.locator('[data-cue="action"]')).toHaveCount(0);
  const measure = () => page.evaluate(() => {
    const button = document.querySelector('#black-actions [data-role="plan-continue-btn"]');
    const rect = button.getBoundingClientRect();
    const zone = document.getElementById('black-actions').getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      centered: Math.abs(rect.x + rect.width / 2 - zone.x - zone.width / 2) < 1,
      contained: rect.left >= zone.left && rect.right <= zone.right && rect.top >= zone.top && rect.bottom <= zone.bottom,
      width: rect.width, height: rect.height, font: parseFloat(style.fontSize),
      buttonAccent: style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.color === 'rgb(255, 255, 255)' && style.borderColor === 'rgb(229, 196, 119)',
      nextArrow: getComputedStyle(button, '::after').content,
      topElement: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === button,
      passive: getComputedStyle(document.querySelector('.guide-spotlight')).pointerEvents
    };
  });
  // The blue button and its inline arrow carry the action cue without a second pointer.
  await expect.poll(measure).toMatchObject({ buttonAccent: true, nextArrow: '"→"' });
  const layout = await measure();
  expect(layout.centered, JSON.stringify(layout)).toBe(true);
  expect(layout.contained, JSON.stringify(layout)).toBe(true);
  expect(layout.buttonAccent, JSON.stringify(layout)).toBe(true);
  expect(layout.nextArrow, JSON.stringify(layout)).toBe('"→"');
  expect(layout.topElement).toBe(true);
  expect(layout.passive).toBe('none');
  expect(layout.width).toBeGreaterThanOrEqual(144);
  expect(layout.height).toBeGreaterThanOrEqual(28);
  expect(layout.font).toBeGreaterThanOrEqual(14);
  return next;
}

async function firstMove(page) {
  for (const id of ['b1', 'b8']) await page.locator(`#black-hand [data-card-id="${id}"]`).click();
  await page.locator('#black-actions [data-op="+"]').click();
  await page.locator('#center-cards [data-card-id="w9"]').click();
  await page.locator('#black-actions [data-role="main-btn"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-checkpoint', 'before-exchange:0');
}

test('pairs the two-digit rule with the real AI move and keeps the live cue legible', async ({ page }, testInfo) => {
  await page.goto('/math-duel/index.html');
  await expect(page.locator('#welcome-detail')).toContainText('目標：把手牌全換成對手顏色');
  await expect(page.locator('#welcome-detail')).toContainText('算式結果等於場牌組成的數字');
  await page.locator('#welcome-start').click();
  await page.locator('.utility-rules').click();
  await expect(page.locator('#rule-4')).toContainText('算式中的每個數最多兩位');
  await expect(page.locator('#rule-4')).toContainText('6 和 9 可以翻面互換');
  await page.evaluate(() => { LANG = 'en'; render(); });
  await expect(page.locator('#rule-4')).toContainText('Each number in the equation can have at most two digits');
  await expect(page.locator('#rule-4')).toContainText('6 and 9 can be flipped');
  await page.evaluate(() => { LANG = 'zh'; render(); });
  await page.locator('#modal-close-btn').click();

  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-1');
  await expect(page.locator('body')).not.toHaveAttribute('data-tutorial-checkpoint');
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-phase', 'play');
  await expect(page.locator('#black-play-hint')).toContainText('請從手牌選黑 1、黑 8');
  await expect(page.locator('#black-play-hint [data-hint-label="arrange"]')).toHaveText('規則');
  await expect(page.locator('#black-play-hint [data-hint="arrange"]')).toContainText('算式結果須等於所選場牌組成的數字');
  await focus(page, '#black-hand [data-tutorial-focus="hand"]', 2);
  await expect(page.locator('#black-actions [data-role="main-btn"]')).toBeVisible();
  await expect(page.locator('#black-actions [data-role="giveup-btn"]')).toBeVisible();
  await expect(page.locator('.guide-spotlight-action-ring')).toHaveCount(0);
  await expect(page.locator('[data-cue="action"]')).toHaveCount(0);

  for (const size of [{ width: 320, height: 480 }, { width: 390, height: 844 }, { width: 800, height: 360 }]) {
    await page.setViewportSize(size);
    for (const language of ['zh', 'en']) {
      await page.evaluate(lang => { LANG = lang; render(); }, language);
      await expectHintFits(page);
      await page.screenshot({ path: testInfo.outputPath(`first-action-${size.width}-${language}.png`) });
    }
  }

  await page.evaluate(() => { LANG = 'zh'; render(); });
  await firstMove(page);
  await expect(page.locator('#black-play-hint')).toContainText('黑 1、黑 8 留在場上；白 9 回到你手牌');
  await expect(page.locator('#black-play-hint')).toContainText('算式中的每個數最多兩位');
  await expect(page.locator('#black-turn-status')).toHaveText('輪到 AI');
  await expect(page.locator('#black-play-hint [data-hint-label="select"]')).toHaveText('結果');
  await expect(page.locator('#black-play-hint [data-hint-label="arrange"]')).toHaveText('規則');
  expect(await page.evaluate(() => ({ equation: game.aiMoveInfo.eq, action: gameSession.action, prepared: Boolean(game.aiMoveInfo) })))
    .toEqual({ equation: '12 + 6 = 18', action: 1, prepared: true });
  for (const size of [{ width: 320, height: 480 }, { width: 390, height: 844 }, { width: 800, height: 360 }]) {
    await page.setViewportSize(size);
    for (const language of ['zh', 'en']) {
      await page.evaluate(lang => { LANG = lang; render(); }, language);
      await expectNextAction(page, language);
      await expectHintFits(page);
    }
  }
  await page.evaluate(() => { LANG = 'zh'; render(); });
  await page.locator('#black-actions [data-role="plan-continue-btn"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-checkpoint', 'before-keep:0');
  await expect(page.locator('body')).toHaveAttribute('data-game-state', 'DISCARDING');
  await expect(page.locator('#black-play-hint')).toContainText('12 + 6 = 18');
  await expect(page.locator('#black-play-hint')).toContainText('中央多於兩張，須留兩張');
  expect(await page.evaluate(() => game.center.map(card => card.id).sort())).toEqual(['w1', 'w2', 'w6']);
  await page.locator('#black-actions [data-role="plan-continue-btn"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-3');
});

test('can skip from the first live action without performing it or marking the lesson complete', async ({ page }) => {
  await start(page);
  await page.locator('.utility-rules').click();
  await page.locator('#rules-skip-tutorial').click();
  await expect(page.locator('body')).not.toHaveClass(/is-tutorial/);
  await expect(page.locator('.guide-spotlight')).toBeHidden();
  await expect(page.locator('[data-tutorial-focus]')).toHaveCount(0);
  expect(await page.evaluate(() => ({ turn: game.turn, action: gameSession.action, cards: game.blackHand.length + game.whiteHand.length + game.center.length, completed: MathDuelTutorial.readPreferences(localStorage).completed, gate: Boolean(tutorialGate) })))
    .toEqual({ turn: 'BLACK', action: 0, cards: 18, completed: false, gate: false });
});

test('moves the tap cue through the real controls, including undo and previous choices', async ({ page }, testInfo) => {
  await start(page);
  await focus(page, '#black-hand [data-tutorial-focus="hand"]', 2);
  await expect(page.locator('.guide-spotlight')).toHaveAttribute('data-mode', 'tap');
  await expect(page.locator('[data-cue="focus"]')).toHaveCount(0);
  await page.locator('#black-hand [data-card-id="b1"]').click();
  await focus(page, '#black-hand [data-tutorial-focus="hand"][data-card-id="b8"]');
  await expect(page.locator('[data-cue="focus"] .guide-tap-hand')).toHaveCount(1);
  await expect(page.locator('#black-play-hint')).toContainText('已選 1/2');
  await page.locator('#black-equation [data-card-id="b1"]').click();
  await focus(page, '#black-hand [data-tutorial-focus="hand"]', 2);
  for (const id of ['b8', 'b1']) await page.locator(`#black-hand [data-card-id="${id}"]`).click();
  await focus(page, '#black-actions [data-op="+"][data-tutorial-focus="operator"]');
  await page.locator('#black-actions [data-op="+"]').click();
  await focus(page, '#center-cards [data-tutorial-focus="center"][data-card-id="w9"]');
  await page.locator('#center-cards [data-card-id="w9"]').click();
  await focus(page, '#black-actions [data-role="main-btn"][data-tutorial-focus="send"]');
  await page.screenshot({ path: testInfo.outputPath('ready-to-send.png') });
  expect(await page.evaluate(() => game.uiBusy)).toBe(false);
  // The passive shade does not force the indicated action or prevent reconsidering it.
  await page.locator('#black-equation [data-card-id="b8"]').click();
  await focus(page, '#black-hand [data-card-id="b8"][data-tutorial-focus="hand"]');
  await expect(page.locator('#black-actions [data-op="+"]')).toBeEnabled();
  expect(await page.locator('#game-board [data-card-id="b8"]').count()).toBe(1);
});

test('points corrections at the live played card, not a duplicated explanation', async ({ page }) => {
  await start(page);
  await page.locator('#black-hand [data-card-id="b5"]').click();
  await focus(page, '#black-equation [data-card-id="b5"][data-tutorial-focus="equation-hand"]');
  await expect(page.locator('#black-play-hint')).toContainText('再點出牌區的黑 5，取消選取');
  await expect(page.locator('#white-equation [data-tutorial-focus]')).toHaveCount(0);
  await page.locator('#black-equation [data-card-id="b5"]').click();
  await focus(page, '#black-hand [data-tutorial-focus="hand"]', 2);
  expect(await page.locator('#game-board [data-card-id="b5"]').count()).toBe(1);
});

test('keeps AI observation highlights separate from the next action and restores focus after help', async ({ page }, testInfo) => {
  await start(page);
  await firstMove(page);
  await focus(page, '#white-equation [data-tutorial-focus="equation-hand"]', 3);
  await expect(page.locator('.guide-spotlight')).toHaveAttribute('data-mode', 'observe');
  await expect(page.locator('[data-cue="focus"]')).toHaveCount(0);
  await expect(page.locator('#black-play-hint')).toContainText('算式中的每個數最多兩位');
  await expect(page.locator('#black-play-hint')).toContainText('黑 1、黑 8 留在場上；白 9 回到你手牌');
  await expect(page.locator('#black-score')).toHaveText('1/5');
  await expect(page.locator('#black-turn-status')).toHaveText('輪到 AI');
  await expect(page.locator('#black-equation [data-tutorial-focus]')).toHaveCount(0);
  const next = page.locator('#black-actions [data-role="plan-continue-btn"]');
  await expectNextAction(page);
  await next.click();
  await focus(page, '#center-cards [data-tutorial-focus="center"]', 2);
  await expect(page.locator('#black-play-hint')).toContainText('12 + 6 = 18');
  await expect(page.locator('#black-play-hint')).toContainText('中央多於兩張，須留兩張');
  await page.screenshot({ path: testInfo.outputPath('ai-focused-result.png') });
  await page.locator('.utility-rules').click();
  await expect(page.locator('.guide-spotlight')).toBeHidden();
  await page.locator('#modal-close-btn').click();
  await focus(page, '#center-cards [data-tutorial-focus="center"]', 2);
  await page.locator('.utility-language').click();
  await expectNextAction(page, 'en');
  await next.click();
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-3');
  await page.locator('.utility-rules').click();
  await page.locator('#rules-skip-tutorial').click();
  await expect(page.locator('.guide-spotlight')).toBeHidden();
  await expect(page.locator('[data-tutorial-focus]')).toHaveCount(0);
  await expect(page.locator('#black-play-hint')).not.toHaveClass(/is-guidance/);
  await expect(page.locator('.guide-spotlight-action-ring')).toHaveCount(0);
  await expect(page.locator('[data-cue="action"]')).toHaveCount(0);
});

test('keeps the same centered next action through AI exchange and keep beats in portrait and landscape', async ({ page }, testInfo) => {
  await start(page);
  await firstMove(page);
  for (const checkpoint of ['before-exchange:0', 'before-keep:0']) {
    await expect(page.locator('body')).toHaveAttribute('data-tutorial-checkpoint', checkpoint);
    for (const size of [{ width: 320, height: 480 }, { width: 390, height: 844 }, { width: 800, height: 360 }]) {
      await page.setViewportSize(size);
      for (const language of ['zh', 'en']) {
        await page.evaluate(lang => { LANG = lang; render(); }, language);
        await expectNextAction(page, language);
      }
      await page.screenshot({ path: testInfo.outputPath(`next-${checkpoint.replace(':', '-')}-${size.width}.png`) });
    }
    await page.locator('#black-actions [data-role="plan-continue-btn"]').click();
  }
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-step', 'move-3');
  await expect(page.locator('.guide-spotlight-action-ring')).toHaveCount(0);
  await expect(page.locator('#black-actions [data-role="operator-group"]')).toBeVisible();
});

test('keeps mask, rings and complete hints aligned after resizing, in both languages', async ({ page }, testInfo) => {
  await start(page);
  for (const size of [{ width: 320, height: 480 }, { width: 390, height: 844 }, { width: 800, height: 360 }]) {
    await page.setViewportSize(size);
    for (const language of ['zh', 'en']) {
      await page.evaluate(lang => { LANG = lang; render(); }, language);
      await expect(page.locator('.guide-spotlight > svg')).toHaveAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
      const geometry = await page.evaluate(() => {
        const hint = document.getElementById('black-play-hint');
        const hintBox = hint.getBoundingClientRect();
        const equation = document.getElementById('black-equation').getBoundingClientRect();
        const overflowingText = [...hint.querySelectorAll('span')].filter(span => span.children.length === 0).flatMap(span => {
          const range = document.createRange(); range.selectNodeContents(span);
          return [...range.getClientRects()].filter(rect => rect.top < hintBox.top || rect.bottom > hintBox.bottom || rect.left < hintBox.left || rect.right > hintBox.right)
            .map(rect => ({ text: span.textContent.trim(), top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right) }));
        });
        const rings = [...document.querySelectorAll('.guide-spotlight-ring')].map(ring => ring.getBoundingClientRect());
        const targets = [...document.querySelectorAll('#black-hand [data-tutorial-focus]')].map(element => element.getBoundingClientRect());
        const mask = document.querySelector('.guide-spotlight mask');
        const shade = document.querySelector('.guide-spotlight-shade').getBoundingClientRect();
        const controls = [...document.querySelectorAll('.utility-rail .table-icon')].map(element => element.getBoundingClientRect());
        return {
          maskOrigin: [mask.getAttribute('x'), mask.getAttribute('y')],
          shade: shade.toJSON(), shadeOpacity: getComputedStyle(document.querySelector('.guide-spotlight-shade')).fillOpacity,
          hint: hintBox.toJSON(), equation: equation.toJSON(),
          noOverflow: document.body.scrollHeight <= innerHeight && document.body.scrollWidth <= innerWidth,
          textFits: overflowingText.length === 0, overflowingText,
          clearOfUtilities: controls.every(control => hintBox.bottom <= control.top || hintBox.top >= control.bottom || hintBox.right <= control.left || hintBox.left >= control.right),
          ringsAligned: rings.length === targets.length && rings.every((ring, index) => Math.abs(ring.x + ring.width / 2 - targets[index].x - targets[index].width / 2) < 1 && Math.abs(ring.y + ring.height / 2 - targets[index].y - targets[index].height / 2) < 1),
          passive: getComputedStyle(document.querySelector('.guide-spotlight')).pointerEvents
        };
      });
      expect(geometry.maskOrigin).toEqual(['0', '0']);
      expect(geometry.shade.width).toBe(size.width);
      expect(geometry.shade.height).toBe(size.height);
      expect(geometry.shadeOpacity).toBe('0.28');
      expect(geometry.passive).toBe('none');
      expect(geometry.noOverflow, JSON.stringify(geometry)).toBe(true);
      expect(geometry.textFits, JSON.stringify(geometry)).toBe(true);
      expect(geometry.clearOfUtilities, JSON.stringify(geometry)).toBe(true);
      expect(geometry.ringsAligned, JSON.stringify(geometry)).toBe(true);
      expect(geometry.hint.top).toBeGreaterThanOrEqual(geometry.equation.top);
      expect(geometry.hint.bottom).toBeLessThanOrEqual(geometry.equation.bottom);
      await page.screenshot({ path: testInfo.outputPath(`spotlight-${size.width}-${language}.png`) });
    }
  }
});

test('keeps adjacent AI equation cards readable under spotlight', async ({ page }, testInfo) => {
  await start(page);
  await firstMove(page);
  await focus(page, '#white-equation [data-tutorial-focus="equation-hand"]', 3);
  const geometry = await page.evaluate(() => {
    const rings = [...document.querySelectorAll('.guide-spotlight-card-ring')].map(element => element.getBoundingClientRect());
    const cards = [...document.querySelectorAll('#white-equation [data-role="stage-hand-cards"] [data-card-id]')].map(element => element.getBoundingClientRect());
    const separated = rings.every((a, index) => rings.slice(index + 1).every(b =>
      a.right + 1 <= b.left || b.right + 1 <= a.left || a.bottom + 1 <= b.top || b.bottom + 1 <= a.top));
    const ringsAvoidOtherCards = rings.every((ring, index) => cards.every((card, cardIndex) => cardIndex === index ||
      ring.right <= card.left || card.right <= ring.left || ring.bottom <= card.top || card.bottom <= ring.top));
    return {
      count: rings.length,
      separated,
      ringsAvoidOtherCards,
      focusCueCount: document.querySelectorAll('[data-cue="focus"]').length,
      actionCueCount: document.querySelectorAll('[data-cue="action"]').length,
      stroke: getComputedStyle(document.querySelector('.guide-spotlight-card-ring')).strokeWidth,
      targetCount: document.querySelectorAll('#white-equation [data-tutorial-focus="equation-hand"]').length
    };
  });
  expect(geometry).toEqual({ count: 3, separated: true, ringsAvoidOtherCards: true, focusCueCount: 0, actionCueCount: 0, stroke: '2px', targetCount: 3 });
  await page.screenshot({ path: testInfo.outputPath('ai-card-focus-separated.png') });
});

test('the reusable presenter preserves DOM and game state, and disposes cleanly', async ({ page }) => {
  await page.goto('/math-duel/index.html');
  await page.locator('#welcome-play').click();
  const result = await page.evaluate(async () => {
    const state = JSON.stringify(game);
    const card = document.querySelector('#black-hand [data-card-id="b1"]');
    const parent = card.parentElement;
    const hint = document.getElementById('black-play-hint');
    hint.classList.add('is-visible');
    const a = GuideSpotlight.create();
    const b = GuideSpotlight.create();
    a.update({ hint, targets: [card] });
    b.update({ hint, targets: [document.querySelector('#black-actions [data-op="+"]')], mode: 'observe' });
    await new Promise(resolve => requestAnimationFrame(resolve));
    const ids = [...document.querySelectorAll('.guide-spotlight mask')].map(mask => mask.id);
    const changed = JSON.stringify(game) !== state || card.parentElement !== parent;
    a.clear();
    b.destroy();
    a.update({ hint, targets: [document.createElement('button')] });
    await new Promise(resolve => requestAnimationFrame(resolve));
    const hidden = [...document.querySelectorAll('.guide-spotlight')].every(element => element.hidden);
    a.destroy();
    return { changed, uniqueIds: new Set(ids).size === ids.length, hidden, remaining: document.querySelectorAll('.guide-spotlight').length, cards: document.querySelectorAll('#game-board [data-card-id="b1"]').length };
  });
  expect(result).toEqual({ changed: false, uniqueIds: true, hidden: true, remaining: 1, cards: 1 });
});
