# Shared card motion

`card-motion.js` provides reusable DOM-based card movement for the static card games in this repository.

Each rendered card needs a stable `data-card-id` attribute. The game owns state and rendering; `CardMotion` measures the old positions, calls `commit()`, then animates temporary card ghosts into the new positions.

```js
await CardMotion.playExchange({
  moves: [{ id: 'card-a' }, { id: 'card-b' }],
  commit: () => renderNextState(),
  options: { duration: 390, stagger: 55 }
});
```

If the same card ID is intentionally shown in a non-interactive history view, pass a `find(id, document)` callback so source and destination measurements stay scoped to the live card.

Use `CardMotion.playRemoval({ ids, commit, getExitPoint })` for cards that leave the board. The module automatically respects `prefers-reduced-motion` and animates unaffected cards with FLIP when a hand or zone reflows.

# 可重用的流程引導

`flow-guide.js` 是輔助性的「觀察者」，不是另一套遊戲或業務流程。

應用程式先完成原本的操作，再通知引導器發生了什麼。引導器只決定目前的提示、標示與何時放行；出牌是否合法、檔案如何上傳、勝負如何判定，仍由原本程式處理。

```js
const state = FlowGuide.createGuideState(definition);
const next = FlowGuide.advanceGuide(state, definition, event, snapshot);
// next = { state, view, effects }
```

- `definition.steps`：步驟清單，每步有 `id`、`view(snapshot)`、`complete(event, snapshot)`，以及選用的 `checkpoints`。
- `event`：已發生的語意事件，例如 `turn.completed`；同一件事的 `id` 必須保持相同，避免重複推進。
- `snapshot`：目前應用狀態，只供讀取。引導器不會修改它或上一份引導狀態。
- `view`：應用自行呈現的資料，例如提示文字鍵、要標示的介面位置，以及選用的 `hintKind`、`detailKind` 語意類別。呈現層可把「規則／描述／例子／操作」分開標示；核心只傳遞資料，不查詢 DOM、不處理翻譯。
- `effects`：`hold` 表示需要等待；`release` 的 `proceed` 表示繼續或取消。應用的轉接層負責對應等待中的 Promise。

## 等待點與略過

每個 checkpoint 可以有數段解說。傳入 `{ type: 'checkpoint', key }` 後，操作在安全邊界等待；`continue` 逐段解說，最後一段才放行。不用定時器，也不用把整個應用設成忙碌。

`back` 只回看同一個等待點的上一段說明，不撤銷實際操作，也不回到已放行的等待點。操作教學不阻擋重新選牌；概念講解等待時，應用轉接層暫停會改變正在講解內容的操作，但仍保留規則、語系與略過入口。按鈕重複點按與鍵盤長按也由轉接層處理，核心不加入延遲。

`skip` 解除教學、放行當前操作；`cancel` 取消等待，供換局或離開頁面使用。已結束的引導忽略後續事件。等待中的操作只可由一個 resolver 放行一次；新一局也必須讓舊回呼失效。

## 範例：既有檔案上傳流程

以下示範轉接方式；`uploadFiles`、檔案狀態和提示呈現仍使用專案本來的實作。

```js
const definition = {
  steps: [
    {
      id: 'choose-files',
      view: () => ({ hint: '選擇要上傳的檔案' }),
      complete: event => event.type === 'files.selected'
    },
    {
      id: 'upload',
      view: () => ({ hint: '確認檔案後按上傳' }),
      checkpoints: {
        'before-upload': [
          { hint: '先確認檔名與大小' },
          { hint: '上傳後會顯示每個檔案的結果' }
        ]
      },
      complete: event => event.type === 'upload.completed'
    }
  ]
};
let guide = FlowGuide.createGuideState(definition);
let pending = null;

function observe(event) {
  const next = FlowGuide.advanceGuide(guide, definition, event, getFileSnapshot());
  guide = next.state;
  renderGuide(next.view);
  for (const effect of next.effects) {
    if (effect.type === 'release') {
      const resolve = pending;
      pending = null;
      resolve?.(effect.proceed);
    }
  }
}

function beforeUpload() {
  if (guide.status !== 'active') return Promise.resolve(true);
  return new Promise(resolve => {
    pending = resolve;
    observe({ type: 'checkpoint', key: 'before-upload' });
  });
}

// 原選檔處理結束後：
// observe({ id: 'selection-1', type: 'files.selected' });

async function onUpload() {
  if (!(await beforeUpload())) return;
  const result = await uploadFiles(); // 原本的上傳工作，不搬進引導器。
  observe({ id: 'upload-1', type: 'upload.completed', result });
}

// 「繼續」：observe({ type: 'continue' })
// 回看本等待點上一段：observe({ type: 'back' })
// 「略過」：observe({ type: 'skip' })
// 離開頁面：observe({ type: 'cancel' })
```

實際專案應為每次上傳分配穩定事件 ID，阻止重複送出，並在成功時才發出完成事件。教學未啟用時，不建立引導器，安全等待點直接放行。不要在每次 render 時發送「完成」事件。

## 視覺引導與遊戲流程分開

`guide-spotlight.js` 搭配 `guide-spotlight.css`，負責遊戲常見的聚光遮罩、目標光圈，以及「點按」手指／「觀看」箭頭。它只量測畫面上的元素，**不複製卡牌、不移動元素、不鎖定操作**。

```js
const spotlight = GuideSpotlight.create();
spotlight.update({
  hint: document.getElementById('current-tip'), // 既有提示，不再印一份
  targets: [document.getElementById('current-target')],
  context: [document.getElementById('current-result')],
  action: document.getElementById('next-button'), // 選用：講解時指向可點按的下一步
  avoid: [document.getElementById('help-button')],
  mode: 'tap' // 'observe' 改用觀看箭頭，適合暫停的 AI 行動
});
// 打開規則、略過或回到一般流程：spotlight.clear()
// 離開整個功能：spotlight.destroy()
```

`targets` 是當下要點按或看的目標；`context` 是仍需要看清楚的相關內容，例如已排好的完整算式。兩者都透出遮罩，只有目標有光圈。每次應用完成 render 後，重新傳入現存元素，避免元素更新後還指著舊位置。尺寸改變時會自動重新定位，支援減少動態效果設定；遮罩與標記永遠不接收點按。

觀看中的 `targets` 和下一步 `action` 分開：箭頭標示正在講解的牌，手指標示可點按的下一步。`action` 使用應用既有按鈕，不另建標籤或接管點按；結束等待後傳入 `null`，下一步光圈與手指就會消失。

引導器仍只提供語意資料，轉接層把 `focus` 對應成 DOM 元素，呈現器完全不需要知道遊戲規則。同一套呈現器也能接在上傳、表單或其他卡牌遊戲的引導器上。

## Math Duel 的分工

教學從正常開局開始，先分別介紹目標、換牌規則，再於第一次出牌前明確教「每個數字最多兩位（最多由兩張牌組成）」。特別說明這是每個數字的限制，不是整個算式只能出兩張；之後 AI 用 1、2、6 組成 `12 + 6` 示範三張牌如何分成兩個數字。各段等待仍使用 `opening`，不增加五次行動的計數。提示資料用 `hintKind`、`detailKind` 分清規則與描述，遊戲頁面只負責翻譯標籤與排版。每回合再用口語短句帶領操作，例如「這回合先把場上的白 9 換回來」、「不用排順序，我們會幫你湊算式」。

所有等待點都使用同一個「下一步」按鈕（英文 `Next`），固定在玩家側操作列中央。講解時收起該列不能操作的符號與送出按鈕，下一步維持清楚的大字、光圈與點按手指；每段解說不再自行定義不同的按鈕名稱。一般出牌與保留仍使用原本的操作列。

`math-duel/tutorial.js` 定義五次正式出牌、指定牌組、教學 AI 與雙語提示；遊戲頁面只轉接選牌、交換、保留與回合結束事件。教學與普通 AI 都使用原求解器及出牌流程。

第一手換牌完成後先停下來，標示實際拿回的白 9，並保持中央留下的牌清楚可見，確認成果後才讓 AI 行動。教學也在 AI 完整算式展示後、交換後保留牌之前等待；玩家第一次需要保留牌時，先說明「只留兩張」，再開放選牌。這些講解不增加正式行動次數。

玩家每次點按後，提示與光圈依序指向缺少的出牌、運算符號、場牌結果、送出或保留；選錯時指向可以取消的出牌，選牌順序仍然不限。超過選牌上限時顯示如何取消，不靜默忽略。進度與「你來出牌／看看對手／選保留牌」使用既有手牌標頭；操作提示仍在出牌區下方，版面不新增一列。

最後一手採用「合法除法、換掉所有黑牌」的目標判定，呼叫原求解器，不限定參考答案。需要幫忙時，可直接點操作列的「提示」取得參考牌組；例如 `96 ÷ 24 = 4` 與 `24 ÷ 6 = 4` 都能完成教學。最後留下的兩張也由玩家決定。全程仍只有五次正式行動，完成後標示真實全白手牌，提供「開始遊玩」回到正常新局。

未達成最後一手的目標時，先提醒還要換掉剩下黑牌，不自動揭露參考答案；下一局保留學習者的黑方座位，之後的一般重新開始仍沿用原本的隨機分色。

介面標示按玩家、區域及牌 ID 定位，不能只以全頁牌 ID 搜尋，因為歷史算式可能包含同一張牌。AI 的光圈只標示當前白方算式，完整算式保持清楚；單張牌的光圈貼合牌面，不外擴至相鄰牌；提示仍在黑方出牌區下方，不移到手牌區。教學未啟用時，不顯示視覺層，也不改一般遊戲版面。

首次入口的「不再顯示」與完整課程完成紀錄另存 `mathDuelGuide_v2`，不放進通用引導器，也不改普通遊戲存檔格式。略過繼續同一局；重新載入只恢復普通遊戲，不恢復半途的教學。
