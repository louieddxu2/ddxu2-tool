# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: crop-custom.spec.js >> 裁切核心邏輯測試 (TDD) >> 在標準模式下，單擊上方不應改變裁切框高度
- Location: tests\crop-custom.spec.js:124:7

# Error details

```
Error: expect(received).toBeCloseTo(expected, precision)

Expected: -43.00333333333332
Received: 35.023333333333326

Expected precision:    1
Expected difference: < 0.05
Received difference:   78.02666666666664
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - complementary [ref=e2]:
    - generic [ref=e4]:
      - link "返回目錄" [ref=e5] [cursor=pointer]:
        - /url: /?home=1
        - img [ref=e6]
      - heading "卡牌翻譯圖庫" [level=1] [ref=e9]
      - generic [ref=e10]:
        - button "即時同步" [ref=e11] [cursor=pointer]:
          - img [ref=e12]
        - button "匯出資料" [ref=e17] [cursor=pointer]:
          - img [ref=e18]
        - button "匯入資料" [ref=e21] [cursor=pointer]:
          - img [ref=e22]
        - button "進入簡潔模式" [ref=e25] [cursor=pointer]:
          - img [ref=e26]
    - generic [ref=e31]:
      - generic [ref=e32]:
        - generic [ref=e33]:
          - generic [ref=e34]:
            - textbox "遊戲名稱" [ref=e35] [cursor=pointer]
            - generic:
              - img
            - button "清除":
              - img
          - generic [ref=e36]:
            - textbox "卡牌類型" [ref=e37] [cursor=pointer]
            - generic:
              - img
            - button "清除":
              - img
        - searchbox "編號或名稱" [ref=e38]
        - generic [ref=e39]:
          - link "Google 翻譯 截圖分享回此 App" [ref=e40] [cursor=pointer]:
            - /url: https://translate.google.com/?sl=auto&tl=zh-TW&op=images
            - img [ref=e41]
            - generic [ref=e45]:
              - generic [ref=e46]: Google 翻譯
              - generic [ref=e47]: 截圖分享回此 App
          - button "從相簿匯入圖片" [ref=e48] [cursor=pointer]:
            - img [ref=e49]
      - generic [ref=e53]:
        - img [ref=e54]
        - paragraph [ref=e58]: 目前無搜尋結果
  - main [ref=e60]
  - generic [ref=e63]:
    - banner [ref=e64]:
      - generic [ref=e65]:
        - button "取消" [ref=e66] [cursor=pointer]
        - generic [ref=e67]: 裁切與比例
        - button "完成裁切" [ref=e68] [cursor=pointer]
    - generic [ref=e70]:
      - img
    - contentinfo [ref=e72]:
      - generic [ref=e74]:
        - button "預設 (直)" [ref=e75] [cursor=pointer]:
          - img [ref=e76]
          - generic [ref=e78]: 預設 (直)
        - generic [ref=e81]:
          - button "標準 (63x88)" [ref=e82] [cursor=pointer]:
            - generic [ref=e83]: 標準
            - generic [ref=e84]: (63x88)
          - button "歐式 (59x92)" [ref=e85] [cursor=pointer]:
            - generic [ref=e86]: 歐式
            - generic [ref=e87]: (59x92)
          - button "日式 (59x86)" [ref=e88] [cursor=pointer]:
            - generic [ref=e89]: 日式
            - generic [ref=e90]: (59x86)
          - button "塔羅 (70x120)" [ref=e91] [cursor=pointer]:
            - generic [ref=e92]: 塔羅
            - generic [ref=e93]: (70x120)
          - button "美式迷你 (41x63)" [ref=e94] [cursor=pointer]:
            - generic [ref=e95]: 美式迷你
            - generic [ref=e96]: (41x63)
          - button "迷你歐式 (44x68)" [ref=e97] [cursor=pointer]:
            - generic [ref=e98]: 迷你歐式
            - generic [ref=e99]: (44x68)
          - button "大尺寸 (80x120)" [ref=e100] [cursor=pointer]:
            - generic [ref=e101]: 大尺寸
            - generic [ref=e102]: (80x120)
          - button "正方 (1:1)" [ref=e103] [cursor=pointer]:
            - generic [ref=e104]: 正方
            - generic [ref=e105]: (1:1)
        - button "自訂 (自由高度)" [ref=e106] [cursor=pointer]:
          - generic [ref=e107]: 自訂
          - generic [ref=e108]: (自由高度)
```

# Test source

```ts
  56  | 
  57  |     const p3 = page.locator('#ind-p3');
  58  |     
  59  |     // 一開始預設是 63:88，不該有 p3
  60  |     await expect(p3).toBeHidden();
  61  | 
  62  |     // 點擊自訂比例按鈕
  63  |     const customBtn = page.locator('#custom-ratio-box');
  64  |     await customBtn.click();
  65  | 
  66  |     // 斷言：點擊後必須出現第三控制點
  67  |     await expect(p3).toBeVisible();
  68  |   });
  69  | 
  70  |   test('在自訂模式下單擊上方，應能改變裁切框高度 (3-Tap)', async ({ page }) => {
  71  |     await page.evaluate(() => {
  72  |       const canvas = document.createElement('canvas');
  73  |       canvas.width = 1000;
  74  |       canvas.height = 1000;
  75  |       window.openCropView(canvas.toDataURL());
  76  |     });
  77  |     await page.waitForTimeout(500);
  78  | 
  79  |     // 1. 進入自訂模式
  80  |     const customBtn = page.locator('#custom-ratio-box');
  81  |     await customBtn.click();
  82  |     
  83  |     // 檢查樣式是否變為選中狀態 (bg-emerald-600)
  84  |     await expect(customBtn).toHaveClass(/bg-emerald-600/);
  85  |     
  86  |     // 檢查 p3 是否出現
  87  |     const p3 = page.locator('#ind-p3');
  88  |     await expect(p3).toBeVisible();
  89  | 
  90  |     const polygon = page.locator('#crop-polygon');
  91  |     const getPoints = async () => {
  92  |       const ptsStr = await polygon.getAttribute('points');
  93  |       return ptsStr.split(' ').map(p => {
  94  |         const [x, y] = p.split(',').map(Number);
  95  |         return { x, y };
  96  |       });
  97  |     };
  98  | 
  99  |     const initialPoints = await getPoints();
  100 |     const initialTopY = initialPoints[0].y;
  101 | 
  102 |     // 2. 在畫面上方點擊 (Y=100)
  103 |     const container = page.locator('#crop-container');
  104 |     const box = await container.boundingBox();
  105 |     // 我們直接使用 dispatchEvent 來模擬精確的點擊，避免 mouse.click 可能的偏移
  106 |     await page.mouse.click(box.x + box.width / 2, box.y + 100);
  107 | 
  108 |     await page.waitForTimeout(500);
  109 | 
  110 |     // 3. 驗證高度是否改變
  111 |     const newPoints = await getPoints();
  112 |     const newTopY = newPoints[0].y;
  113 | 
  114 |     console.log(`Initial TopY: ${initialTopY}, New TopY: ${newTopY}`);
  115 | 
  116 |     // 在自訂模式下，高度應該改變
  117 |     expect(newTopY).not.toBeCloseTo(initialTopY, 1);
  118 |     
  119 |     // 驗證底線 (p1, p2) 依然沒動 (p3 is bottom-left in calculatePolygon [p4, p3, p2, p1])
  120 |     // Wait, pts[3] is p1 (bottom-left).
  121 |     expect(newPoints[3].y).toBeCloseTo(initialPoints[3].y, 1);
  122 |   });
  123 | 
  124 |   test('在標準模式下，單擊上方不應改變裁切框高度', async ({ page }) => {
  125 |     await page.evaluate(() => {
  126 |       const canvas = document.createElement('canvas');
  127 |       canvas.width = 1000;
  128 |       canvas.height = 1000;
  129 |       window.openCropView(canvas.toDataURL());
  130 |     });
  131 |     await page.waitForTimeout(500);
  132 | 
  133 |     const polygon = page.locator('#crop-polygon');
  134 |     const getPoints = async () => {
  135 |       const ptsStr = await polygon.getAttribute('points');
  136 |       return ptsStr.split(' ').map(p => {
  137 |         const [x, y] = p.split(',').map(Number);
  138 |         return { x, y };
  139 |       });
  140 |     };
  141 | 
  142 |     const initialPoints = await getPoints();
  143 |     const initialTopY = initialPoints[0].y;
  144 | 
  145 |     // 在畫面上方點擊
  146 |     const container = page.locator('#crop-container');
  147 |     const box = await container.boundingBox();
  148 |     await page.mouse.click(box.x + box.width / 2, box.y + 100);
  149 | 
  150 |     await page.waitForTimeout(500);
  151 | 
  152 |     const newPoints = await getPoints();
  153 |     const newTopY = newPoints[0].y;
  154 | 
  155 |     // 在標準模式下，高度不應改變 (應該只是移動了 p1 或 p2)
> 156 |     expect(newTopY).toBeCloseTo(initialTopY, 1);
      |                     ^ Error: expect(received).toBeCloseTo(expected, precision)
  157 |   });
  158 | });
  159 | 
```