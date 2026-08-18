import { test, expect } from '@playwright/test';

test('animates a card exchange and resolves it into the correct zones', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  await expect(page.locator('#main-btn')).toBeDisabled();

  await page.locator('[data-card-id="b1"]').click();
  await expect(page.locator('#stage-hand-cards [data-card-id="b1"]')).toBeVisible({ timeout: 2000 });
  await page.waitForTimeout(700);
  await page.locator('[data-card-id="b8"]').click();
  await expect(page.locator('#stage-hand-cards [data-card-id="b8"]')).toBeVisible({ timeout: 2000 });
  await page.waitForTimeout(700);
  await page.locator('[data-card-id="w9"]').click();
  await expect(page.locator('#stage-center-cards [data-card-id="w9"]')).toBeVisible({ timeout: 2000 });
  await page.waitForTimeout(700);
  await page.locator('[data-op="+"]').click();

  await expect(page.locator('#main-btn')).toBeEnabled();
  await expect(page.locator('#move-preview .equation-line')).toHaveAttribute('data-equation', '1 + 8 = 9');

  await page.locator('#main-btn').click();
  await expect(page.locator('#status-banner')).toContainText('行動結算中', { timeout: 1000 });
  await expect(page.locator('#main-btn')).toBeHidden();

  await expect(page.locator('#center-cards [data-card-id="b1"]')).toBeVisible({ timeout: 7000 });
  await expect(page.locator('#center-cards [data-card-id="b8"]')).toBeVisible({ timeout: 7000 });
  await expect(page.locator('#black-hand [data-card-id="w9"]')).toBeVisible({ timeout: 7000 });
  await expect(page.locator('#white-area')).toHaveClass(/border-blue-500/);
});

test('reveals the AI plan in the play area before resolving it', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mathDuelLang', 'zh');
    localStorage.setItem('mathDuelState_v1.2.8', JSON.stringify({
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
