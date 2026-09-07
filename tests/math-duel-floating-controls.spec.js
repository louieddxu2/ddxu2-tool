import { test, expect } from '@playwright/test';

test('keeps navigation and settings as usable viewport-floating controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  await expect(page.locator('link[href*="tabletop.css"]')).toHaveAttribute('href', 'tabletop.css?v=2.1.1');
  const rail = page.locator('.utility-rail');
  const controls = rail.locator('.table-icon');
  await expect(controls).toHaveCount(2);
  await expect(controls.nth(0)).toBeVisible();
  await expect(controls.nth(1)).toBeVisible();
  await expect(controls.nth(0)).toHaveCSS('position', 'fixed');
  await expect(controls.nth(1)).toHaveCSS('position', 'fixed');
  await expect(rail.locator('[data-home-link]')).toBeVisible();
  await expect(rail.locator('.settings-toggle')).toBeVisible();

  const geometry = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('.utility-rail .table-icon')].map((el) => {
      const rect = el.getBoundingClientRect();
      return { right: rect.right, y: rect.y, bottom: rect.bottom };
    });
    return {
      controls,
      viewportWidth: innerWidth,
      railIsOutsideGameBoard: !document.querySelector('.utility-rail').closest('#game-board'),
      mountedOnBody: document.querySelector('.utility-rail').parentElement === document.body
    };
  });

  expect(geometry.controls).toHaveLength(2);
  expect(geometry.controls.every(({ right }) => right <= geometry.viewportWidth)).toBe(true);
  expect(geometry.controls[1].y).toBeGreaterThan(geometry.controls[0].bottom);
  expect(geometry.railIsOutsideGameBoard).toBe(true);
  expect(geometry.mountedOnBody).toBe(true);

  await rail.locator('.settings-toggle').click();
  await expect(page.locator('#table-settings')).toBeVisible();
});
