import { test, expect } from '@playwright/test';

test('keeps navigation and settings as usable viewport-floating controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  await expect(page.locator('link[href*="tabletop.css"]')).toHaveAttribute('href', 'tabletop.css?v=1.7.0');
  const rail = page.locator('.utility-rail');
  await expect(rail).toBeVisible();
  await expect(rail).toHaveCSS('position', 'fixed');
  await expect(rail.locator('[data-home-link]')).toBeVisible();
  await expect(rail.locator('.settings-toggle')).toBeVisible();

  const geometry = await page.evaluate(() => {
    const rail = document.querySelector('.utility-rail').getBoundingClientRect();
    return {
      railRight: rail.right,
      railWidth: rail.width,
      viewportWidth: innerWidth,
      railIsOutsideGameBoard: !document.querySelector('.utility-rail').closest('#game-board'),
      mountedOnBody: document.querySelector('.utility-rail').parentElement === document.body
    };
  });

  expect(geometry.railRight).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.railWidth).toBeGreaterThanOrEqual(36);
  expect(geometry.railIsOutsideGameBoard).toBe(true);
  expect(geometry.mountedOnBody).toBe(true);

  await rail.locator('.settings-toggle').click();
  await expect(page.locator('#table-settings')).toBeVisible();
});
