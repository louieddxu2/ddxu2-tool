import { test, expect } from '@playwright/test';

test('keeps all utility actions as usable viewport-floating controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('mathDuelLang', 'zh'));
  await page.goto('/math-duel/index.html');

  await expect(page.locator('link[href*="tabletop.css"]')).toHaveAttribute('href', 'tabletop.css?v=2.2.5');
  await expect(page.locator('#black-turn-status')).toHaveText('輪到你了');
  await expect(page.locator('#white-turn-status')).toHaveText('輪到對手了');
  const leftRail = page.locator('.utility-rail-left');
  const rightRail = page.locator('.utility-rail-right');
  const controls = page.locator('.utility-rail .table-icon');
  await expect(leftRail.locator('.table-icon')).toHaveCount(2);
  await expect(rightRail.locator('.table-icon')).toHaveCount(4);
  await expect(controls).toHaveCount(6);
  for (const control of await controls.all()) {
    await expect(control).toBeVisible();
    await expect(control).toHaveCSS('position', 'fixed');
  }
  await expect(leftRail.locator('[data-home-link]')).toBeVisible();
  await expect(leftRail.locator('.utility-language')).toBeVisible();
  await expect(rightRail.locator('[data-role="utility-mode"]')).toBeVisible();
  await expect(rightRail.locator('[data-role="utility-rule"]')).toBeVisible();
  await expect(rightRail.locator('[data-role="utility-rules"]')).toBeVisible();
  await expect(rightRail.locator('.utility-reset')).toBeVisible();
  await expect(page.locator('#table-settings')).toHaveCount(0);
  await expect(page.locator('.settings-toggle')).toHaveCount(0);

  await rightRail.locator('[data-role="utility-mode"]').click();
  await expect(page.locator('#utility-mode-menu')).toBeVisible();
  await expect(page.locator('#utility-mode-menu [data-mode="PVP"]')).toHaveClass(/is-selected/);
  await rightRail.locator('[data-role="utility-mode"]').click();
  await expect(page.locator('#utility-mode-menu')).toHaveClass(/hidden/);

  await rightRail.locator('[data-role="utility-rule"]').click();
  await expect(page.locator('#utility-rule-menu')).toBeVisible();
  await expect(page.locator('#utility-rule-menu [data-rule-mode="CLASSIC"]')).toHaveClass(/is-selected/);
  await rightRail.locator('[data-role="utility-rule"]').click();
  await expect(page.locator('#utility-rule-menu')).toHaveClass(/hidden/);

  const geometry = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('.utility-rail .table-icon')].map((el) => {
      const rect = el.getBoundingClientRect();
      return { right: rect.right, y: rect.y, bottom: rect.bottom };
    });
    return {
      controls,
      viewportWidth: innerWidth,
      centerLabel: document.getElementById('ui-center-label').getBoundingClientRect(),
      leftHome: document.querySelector('.utility-home').getBoundingClientRect(),
      tableArea: (() => {
        const rect = document.getElementById('table-area').getBoundingClientRect();
        return { center: rect.top + (rect.height / 2) };
      })(),
      railsOutsideGameBoard: [...document.querySelectorAll('.utility-rail')].every((rail) => !rail.closest('#game-board')),
      mountedOnBody: [...document.querySelectorAll('.utility-rail')].every((rail) => rail.parentElement === document.body)
    };
  });

  expect(geometry.controls).toHaveLength(6);
  expect(geometry.controls.every(({ right }) => right <= geometry.viewportWidth)).toBe(true);
  expect(geometry.controls[1].y).toBeGreaterThan(geometry.controls[0].bottom);
  expect(geometry.controls[3].y).toBeGreaterThan(geometry.controls[2].bottom);
  expect(geometry.controls[4].y).toBeGreaterThan(geometry.controls[3].bottom);
  expect(geometry.controls[5].y).toBeGreaterThan(geometry.controls[4].bottom);
  expect(geometry.centerLabel.left).toBeGreaterThanOrEqual(geometry.leftHome.right);
  const leftRailCenter = (geometry.controls[0].y + geometry.controls[1].bottom) / 2;
  const rightRailCenter = (geometry.controls[2].y + geometry.controls[5].bottom) / 2;
  expect(Math.abs(leftRailCenter - geometry.tableArea.center)).toBeLessThan(1);
  expect(Math.abs(rightRailCenter - geometry.tableArea.center)).toBeLessThan(1);
  expect(geometry.railsOutsideGameBoard).toBe(true);
  expect(geometry.mountedOnBody).toBe(true);

  await rightRail.locator('[data-role="utility-rules"]').click();
  await expect(page.locator('#rules-modal')).toBeVisible();
  await page.locator('#modal-close-btn').click();
  await expect(page.locator('#rules-modal')).toHaveClass(/hidden/);
});
