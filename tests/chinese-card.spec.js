import { test, expect } from '@playwright/test';

test.describe('卡牌翻譯圖庫 UI 互動測試', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/Chinese-card/index.html');
    // Wait for JS to initialize (e.g., Lucide icons, setupSmartDropdown)
    await page.waitForLoadState('domcontentloaded');
  });

  test('首頁載入檢查', async ({ page }) => {
    // 檢查 Header 是否存在
    await expect(page.locator('h1')).toHaveText('卡牌翻譯圖庫');
    // 檢查搜尋欄位是否存在
    await expect(page.locator('#inp-game')).toBeVisible();
    await expect(page.locator('#inp-type')).toBeVisible();
    await expect(page.locator('#inp-number')).toBeVisible();
  });

  test('下拉選單一鍵清除功能 (X 按鈕)', async ({ page }) => {
    const gameInput = page.locator('#inp-game');
    const clearBtn = page.locator('#wrap-game button[title="清除"]');
    
    // 初始化時，輸入框應該是空的，且清除按鈕是隱藏的 (opacity-0 / pointer-events-none)
    await expect(gameInput).toHaveValue('');
    // 註：Tailwind peer-placeholder-shown:opacity-0 不一定能用 toBeVisible() 準確測出，我們可以測它的 class 或透過強制點擊來看會不會被擋住
    
    // 模擬使用者操作：填入值
    // 因為它是 readonly，所以不能直接 fill，我們模擬 UI 觸發或強塞值來觸發
    await gameInput.evaluate((el) => {
      el.value = 'TestGame';
      el.dispatchEvent(new Event('input'));
    });
    
    // 現在輸入框應該有值
    await expect(gameInput).toHaveValue('TestGame');
    
    // 點擊清除按鈕 (強制點擊，因為 opacity 在測試中可能不影響 hit target，但我們可以確保事件正確綁定)
    await clearBtn.click({ force: true });
    
    // 驗證輸入框被清空
    await expect(gameInput).toHaveValue('');
  });

  test('編輯彈窗防呆與關閉', async ({ page }) => {
    // 直接強制顯示編輯彈窗，跳過需要真實卡片資料的步驟
    await page.evaluate(() => {
      document.getElementById('modal-edit').classList.replace('hidden', 'flex');
      document.getElementById('modal-edit-overlay').classList.remove('hidden');
    });
    
    const editModal = page.locator('#modal-edit');
    await expect(editModal).toBeVisible();

    // 嘗試點擊外部遮罩 (modal-edit-overlay)
    const overlay = page.locator('#modal-edit-overlay');
    // 點擊遮罩 (在 (0,0) 位置)
    await page.mouse.click(5, 5);
    
    // 驗證防呆機制生效：彈窗仍然開著
    await expect(editModal).toBeVisible();

    // 點擊「取消」按鈕
    await page.getByRole('button', { name: '取消' }).click();
    
    // 驗證彈窗關閉
    await expect(editModal).toBeHidden();
  });
});
