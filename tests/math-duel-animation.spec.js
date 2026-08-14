import { test, expect } from '@playwright/test';

test('animates a card exchange and resolves it into the correct zones', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  await page.locator('[data-card-id="b1"]').click();
  await page.locator('[data-card-id="b8"]').click();
  await page.locator('[data-card-id="w9"]').click();
  await page.locator('[data-op="+"]').click();

  await expect(page.locator('#move-preview')).toContainText('1 + 8 = 9');

  await page.locator('#main-btn').click();
  await expect(page.locator('#status-banner')).toContainText('行動結算中', { timeout: 1000 });
  await expect(page.locator('#main-btn')).toBeHidden();

  await expect(page.locator('#center-cards [data-card-id="b1"]')).toBeVisible({ timeout: 2500 });
  await expect(page.locator('#center-cards [data-card-id="b8"]')).toBeVisible({ timeout: 2500 });
  await expect(page.locator('#black-hand [data-card-id="w9"]')).toBeVisible({ timeout: 2500 });
  await expect(page.locator('#white-area')).toHaveClass(/border-blue-500/);
});
