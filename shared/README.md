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
- `view`：應用自行呈現的資料，例如提示文字鍵與要標示的介面位置。核心不查詢 DOM、不處理翻譯。
- `effects`：`hold` 表示需要等待；`release` 的 `proceed` 表示繼續或取消。應用的轉接層負責對應等待中的 Promise。

## 等待點與略過

每個 checkpoint 可以有數段解說。傳入 `{ type: 'checkpoint', key }` 後，操作在安全邊界等待；`continue` 逐段解說，最後一段才放行。不用定時器，也不用把整個應用設成忙碌。

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
// 「略過」：observe({ type: 'skip' })
// 離開頁面：observe({ type: 'cancel' })
```

實際專案應為每次上傳分配穩定事件 ID，阻止重複送出，並在成功時才發出完成事件。教學未啟用時，不建立引導器，安全等待點直接放行。不要在每次 render 時發送「完成」事件。

## Math Duel 的分工

`math-duel/tutorial.js` 定義五次正式出牌、指定牌組、教學 AI 與雙語提示；遊戲頁面只轉接選牌、交換、保留與回合結束事件。教學與普通 AI 都使用原求解器及出牌流程。

教學在 AI 完整算式展示後、交換後保留牌之前等待。介面標示按玩家、區域及牌 ID 定位，不能只以全頁牌 ID 搜尋，因為歷史算式可能包含同一張牌。

首次入口的「不再顯示」與完整課程完成紀錄另存 `mathDuelGuide_v2`，不放進通用引導器，也不改普通遊戲存檔格式。略過繼續同一局；重新載入只恢復普通遊戲，不恢復半途的教學。
