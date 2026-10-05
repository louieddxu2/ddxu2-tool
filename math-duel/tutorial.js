(function attachTutorial(global) {
  'use strict';

  const STORAGE_KEY = 'mathDuelGuide_v2';
  const actions = [
    { side: 'BLACK', hand: ['b1', 'b8'], op: '+', center: ['w9'], keep: ['b1', 'b8'] },
    { side: 'WHITE', hand: ['w1', 'w2', 'w6'], op: '+', center: ['b1', 'b8'], keep: ['w1', 'w2'] },
    { side: 'BLACK', hand: ['b3', 'b5', 'b6', 'b7'], op: '-', center: ['w1', 'w2'], keep: ['b3', 'b6'] },
    { side: 'WHITE', hand: ['w4', 'w5'], op: '+', center: ['b6'], keep: ['w4', 'w5'] },
    { side: 'BLACK', hand: ['b2', 'b4', 'b9', 'w9'], op: '/', center: ['w4'], keep: ['b9', 'w9'] }
  ];
  actions.forEach(action => { Object.values(action).filter(Array.isArray).forEach(Object.freeze); Object.freeze(action); });
  Object.freeze(actions);

  const COPY = {
    zh: {
      labels: { objective: '目標', rule: '規則', description: '說明', example: '例子', demonstration: '示範', result: '結果', status: '狀態', next: '操作', tip: '說明' },
      twoDigitRule: '算式中的每個數最多兩位數。',
      aiTrade: 'AI 會用算式收下黑 1、8。',
      choose: '請從手牌選{cards}。', goal: '算式答案要和中央目標相同。',
      anyOrder: '手牌可依任意順序選；再點已選牌可取消。', operator: '請點「＋」，選擇加法。',
      selected: '已選 {selected}/{total} 張；點已選牌可取消。',
      undoHand: '再點出牌區的{cards}，取消選取。', undoTarget: '再點目標區的{cards}，取消選取。',
      requiredOne: '這一步要用黑 1 和黑 8。', requiredThree: '這一步要用黑 3、黑 5、黑 6、黑 7。',
      requiredFive: '這一步要用黑 2、黑 4、黑 9 和白 9。',
      subtract: '請點「−」，選擇減法。', divide: '請點「÷」，選擇除法。',
      targetThree: '選中央的{cards}，組成目標數字。', targetFive: '選中央的{cards}作為目標牌；白 9 翻面當作 6。',
      undoKeep: '再點已選的{cards}，取消保留。', keepCount: '已選 {selected}/2 張；未選的中央牌會移出遊戲。',
      practiceStart: '先試著用除法完成這次交換。', practiceSelect: '請再選亮起的黑牌。',
      practiceAddWhite: '再選手牌白 9，翻面當作 6。', practiceAddWhiteDetail: '再和黑 9 組成 96。',
      practiceOperator: '請點「÷」，選擇除法。', practiceOperatorDetail: '黑 2、黑 4 排成 24。',
      practiceTarget: '選中央的白 4，作為目標牌。', practiceTargetDetail: '系統會排成 96 ÷ 24 = 4。',
      practiceNoEquation: '目前算式答案和目標數字不同；換手牌或運算符號再試。',
      practiceExtra: '白牌也能出；6 和 9 可以翻面互換。', practiceMakeRoom: '點出牌區已選白牌，取消一張。',
      handLimit: '手牌最多四張；取消一張已選牌。', targetLimit: '目標牌最多兩張；取消一張已選牌。',
      keepLimit: '中央最多留兩張；取消一張已選牌。',
      target: '選中央的{cards}，組成目標數字。', automatic: '系統會自動排列算式。',
      ready: '算式已成立；按「送出算式」交換。', exchange: '你出的牌留在中央；你選的目標牌回到手牌。',
      opponentExchange: 'AI 出牌留中央；目標牌回手。',
      taskOne: '請改選黑 1、黑 8 和「＋」。', taskOneDetail: '目標牌選白 9；已選牌再點一次可取消。',
      waiting: '現在輪到白方行動。', resolving: '正在交換牌。', history: '你上一手的算式會留在場上給對手看。',
      centerLimitRule: '中央超過兩張時，選兩張留下；其餘移出。', aiKeeps: 'AI 會留白 1、白 2。',
      fourRule: '每回合可出 2～4 張手牌。', four: '這一步請選{cards}。',
      fourEquation: '系統會排成 57 − 36 = 21。',
      keepConcept: '中央超過兩張時，選兩張留下；其餘移出。', keepConceptDetail: '請選黑 3、黑 6 保留。',
      keepThree: '請選{cards}，留在中央。', keepDetail: '選中的兩張留在中央；其他牌移出遊戲。',
      keepReady: '已選好兩張；按「確認保留」繼續。', taskKeep: '請從場中央選兩張牌留下。',
      sixNineRule: '牌面 6 和 9 可以翻面互換。',
      flipDemo: '白方用算式收下翻成 9 的黑 6。',
      division: '讓手牌全部變成白牌，就能獲勝。', divisionHelp: '請選亮起的手牌，完成除法。',
      divisionTarget: '選白 4 作為目標牌；白 9 翻面當作 6。',
      keepFive: '從場中央選兩張留下。', keepPractice: '還要選 {remaining} 張中央牌。',
      wrongFive: '這組牌沒能讓手牌全變白；重新選牌再試。',
      complete: '手牌全是白牌，你贏了！', completeDetail: '現在開始一般對局吧。'
    },
    en: {
      labels: { objective: 'Goal', rule: 'Rule', description: 'Details', example: 'Example', demonstration: 'Demo', result: 'Result', status: 'Status', next: 'Action', tip: 'Details' },
      twoDigitRule: 'Each number in an equation has at most two digits.',
      aiTrade: 'AI takes black 1 and 8.',
      choose: 'Choose {cards} from your hand.', goal: 'Match the answer to the center target.',
      anyOrder: 'Choose hand cards in any order; tap again to undo.', operator: 'Tap + to choose addition.',
      selected: '{selected}/{total} selected; tap a selected card to undo.',
      undoHand: 'Tap {cards} in the play area to undo.', undoTarget: 'Tap {cards} in the target area to undo.',
      requiredOne: 'Use black 1 and black 8 for this move.', requiredThree: 'Use black 3, black 5, black 6, and black 7.',
      requiredFive: 'Use black 2, black 4, black 9, and white 9.',
      subtract: 'Tap − to choose subtraction.', divide: 'Tap ÷ to choose division.',
      targetThree: 'Choose {cards} from the center to make the target number.', targetFive: 'Choose {cards} from the center as targets; flip white 9 to 6.',
      undoKeep: 'Tap {cards} again to undo keeping them.', keepCount: '{selected}/2 kept; other center cards leave play.',
      practiceStart: 'Try using division for this trade.', practiceSelect: 'Choose the highlighted black cards.',
      practiceAddWhite: 'Choose white 9; flip it to make 6.', practiceAddWhiteDetail: 'Combine it with black 9 to make 96.',
      practiceOperator: 'Tap ÷ to choose division.', practiceOperatorDetail: 'Black 2 and 4 make 24.',
      practiceTarget: 'Choose white 4 from the center as the target card.', practiceTargetDetail: 'Auto-arranges: 96 ÷ 24 = 4.',
      practiceNoEquation: 'The equation answer does not match the target number; change a card or operator.',
      practiceExtra: 'White cards work; 6 and 9 can be flipped.', practiceMakeRoom: 'Tap a selected white card to undo.',
      handLimit: 'Four hand cards max; undo one.', targetLimit: 'Two target cards max; undo one.',
      keepLimit: 'Keep two center cards max; undo one.',
      target: 'Choose {cards} from the center to make the target number.', automatic: 'The equation arranges itself.',
      ready: 'Equation is ready; tap Send Equation to trade.', exchange: 'Your played cards stay in the center; your target cards return to your hand.',
      opponentExchange: 'AI cards stay; targets return.',
      taskOne: 'Use black 1, black 8, and + for this move.', taskOneDetail: 'Choose white 9 as the target; tap again to undo.',
      waiting: 'White moves now.', resolving: 'Cards are trading.', history: 'Your last equation stays on the table for your opponent to see.',
      centerLimitRule: 'Center over 2: keep two; remove the rest.', aiKeeps: 'AI keeps white 1 and 2.',
      fourRule: 'Use 2–4 hand cards on each turn.', four: 'Choose {cards} for this move.',
      fourEquation: 'The equation auto-arranges as 57 − 36 = 21.',
      keepConcept: 'Center over 2: keep two; remove the rest.', keepConceptDetail: 'Keep black 3 and 6.',
      keepThree: 'Keep {cards} in the center.', keepDetail: 'The two selected cards stay; the others leave play.',
      keepReady: 'Two selected; tap Confirm Keep to continue.', taskKeep: 'Choose two cards from the center to keep.',
      sixNineRule: 'A 6 or 9 can be flipped to become the other number.',
      flipDemo: 'White uses its equation to take flipped black 6.',
      division: 'Turn every card in your hand white to win.', divisionHelp: 'Choose the highlighted cards for division.',
      divisionTarget: 'Choose white 4 as the target card; flip white 9 to 6.',
      keepFive: 'Choose two center cards to keep.', keepPractice: 'Choose {remaining} more center card(s).',
      wrongFive: 'That set did not turn every hand card white; choose again.',
      complete: 'Your hand is all white—you win!', completeDetail: 'Tutorial complete. Start a game!'
    }
  };

  const sameIds = (actual, expected) => actual.length === expected.length && new Set(actual).size === actual.length && expected.every(id => actual.includes(id));
  const focus = (area, side, cardIds = [], operator = null) => ({ area, side, cardIds, operator });
  const view = (hint, detail, targets = [], values = {}, hintKind = 'next', detailKind = 'description') => ({ hint, detail, focus: targets, values, mode: 'tap', hintKind, detailKind });
  const observe = (hint, detail, targets, hintKind = 'demonstration', detailKind = 'description') => ({ ...view(hint, detail, targets, {}, hintKind, detailKind), mode: 'observe' });

  // Expected identity sets are derived from ordinary exchange/keep operations.
  const initialBoard = { BLACK: Array.from({ length: 9 }, (_, i) => `b${i + 1}`), WHITE: Array.from({ length: 8 }, (_, i) => `w${i + 1}`), center: ['w9'] };
  const boards = [initialBoard];
  actions.forEach(action => {
    const before = boards[boards.length - 1];
    boards.push({ ...before, [action.side]: before[action.side].filter(id => !action.hand.includes(id)).concat(action.center), center: [...action.keep] });
  });

  function isExpectedBoard(index, game) {
    const board = boards[index];
    return Boolean(board && sameIds(game.blackHand.map(card => card.id), board.BLACK) &&
      sameIds(game.whiteHand.map(card => card.id), board.WHITE) && sameIds(game.center.map(card => card.id), board.center) &&
      [...game.blackHand, ...game.whiteHand, ...game.center].every(card => card.color === card.id[0] && card.val === Number(card.id.slice(1))));
  }

  function matchesTask(index, game, phase = 'play') {
    const action = actions[index];
    if (!action || game.turn !== action.side) return false;
    if (index === actions.length - 1 && game.blackHand && game.center) {
      if (phase === 'keep') return game.discardSelections.length === 2 &&
        new Set(game.discardSelections).size === 2 && game.discardSelections.every(id => game.center.some(card => card.id === id));
      const selectedHand = game.blackHand.filter(card => game.selections.hand.includes(card.id));
      const selectedCenter = game.center.filter(card => game.selections.center.includes(card.id));
      const remaining = game.blackHand.filter(card => !game.selections.hand.includes(card.id)).concat(selectedCenter);
      return game.selections.operator === '/' && selectedHand.length >= 2 && selectedHand.length <= 4 &&
        sameIds(game.selections.hand, selectedHand.map(card => card.id)) && sameIds(game.selections.center, selectedCenter.map(card => card.id)) &&
        selectedCenter.length >= 1 && selectedCenter.length <= 2 && remaining.length > 0 && remaining.every(card => card.color === 'w') &&
        global.MathDuelEquation.checkEquation(selectedHand, '/', selectedCenter).success;
    }
    if (phase === 'keep') return sameIds(game.discardSelections, action.keep);
    return game.selections.operator === action.op && sameIds(game.selections.hand, action.hand) && sameIds(game.selections.center, action.center);
  }

  function getGuidance(index, snapshot) {
    const guidance = getTaskGuidance(index, snapshot);
    if (!snapshot.notice) return guidance;
    const { game, notice } = snapshot;
    const correction = notice === 'hand'
      ? {
        hint: 'undoHand',
        area: 'equation-hand',
        cardIds: guidance.focus.find(target => target.area === 'equation-hand')?.cardIds || game.selections.hand
      }
      : notice === 'target'
        ? { hint: 'undoTarget', area: 'equation-target', cardIds: game.selections.center }
        : { hint: 'undoKeep', area: 'center', cardIds: game.discardSelections };
    return {
      ...guidance,
      hint: correction.hint,
      detail: `${notice}Limit`,
      focus: [focus(correction.area, 'BLACK', [...correction.cardIds])],
      values: { ...guidance.values, cards: [...correction.cardIds] },
      hintKind: 'next',
      detailKind: 'rule'
    };
  }

  function getTaskGuidance(index, { game, help = false, rejected = false }) {
    const action = actions[index];
    if (game.state === 'ANIMATING' || game.uiBusy) {
      const exchangeDetail = action.side === 'WHITE' ? 'opponentExchange' : 'exchange';
      return view('resolving', exchangeDetail, [], {}, 'status', 'description');
    }
    if (action.side === 'WHITE') return { ...view('waiting', 'history', game.aiMoveInfo ? [focus('equation', 'WHITE')] : [], {}, 'demonstration', 'description'), mode: 'observe' };
    if (game.state === 'DISCARDING') {
      if (index === actions.length - 1 && game.center) {
        const ready = matchesTask(index, game, 'keep');
        if (ready) return view('keepReady', 'keepDetail', [focus('send', 'BLACK')]);
        return view('keepPractice', 'keepCount', [focus('center-area', 'BLACK')], {
          selected: game.discardSelections.length,
          remaining: Math.max(0, 2 - game.discardSelections.length)
        });
      }
      const wrongKeep = game.discardSelections.filter(id => !action.keep.includes(id));
      if (wrongKeep.length) return view(rejected ? 'taskKeep' : 'undoKeep', rejected ? 'undoKeep' : 'keepDetail',
        [focus('center', 'BLACK', wrongKeep)], { cards: wrongKeep });
      const keepMatches = matchesTask(index, game, 'keep');
      const missingKeep = action.keep.filter(id => !game.discardSelections.includes(id));
      return view(keepMatches ? 'keepReady' : index === 2 ? 'keepThree' : 'keepFive', keepMatches ? 'keepDetail' : 'keepCount',
        keepMatches ? [focus('send', 'BLACK')] : [focus('center', 'BLACK', missingKeep)], {
          selected: game.discardSelections.length,
          cards: missingKeep,
          remaining: Math.max(0, 2 - game.discardSelections.length)
        });
    }
    const selection = game.selections;
    const ready = matchesTask(index, game);
    // Final practice still points to the current control, without giving away the cards.
    if (index === 4 && !help) {
      if (ready) return view('ready', 'exchange', [focus('send', 'BLACK')]);
      if (rejected) return view('division', 'wrongFive', [focus('hand-area', 'BLACK')], {}, 'objective', 'description');
      if (!selection.hand.length) return view('division', 'practiceStart', [focus('hand-area', 'BLACK')], {}, 'objective', 'next');
      const missingBlack = game.blackHand ? game.blackHand.filter(card => card.color === 'b' && !selection.hand.includes(card.id)) :
        action.hand.filter(id => id[0] === 'b' && !selection.hand.includes(id));
      const whiteCards = selection.hand.filter(id => id[0] === 'w');
      if (selection.hand.length >= 4 && whiteCards.length && (missingBlack.length || !selection.hand.includes('w9'))) {
        return view('division', 'practiceMakeRoom', [focus('equation-hand', 'BLACK', whiteCards)], { cards: whiteCards }, 'objective', 'next');
      }
      if (missingBlack.length) {
        const missingIds = missingBlack.map(card => card.id);
        return view('division', 'practiceSelect', [focus('hand', 'BLACK', missingIds)], { selected: selection.hand.length, cards: missingIds }, 'objective', 'next');
      }
      if (!selection.hand.includes('w9')) return view('practiceAddWhite', 'practiceAddWhiteDetail', [focus('hand', 'BLACK', ['w9'])], {}, 'next', 'description');
      if (selection.operator !== action.op) return view('practiceOperator', 'practiceOperatorDetail', [focus('operator', 'BLACK', [], '/')], {}, 'next', 'description');
      if (!selection.center.length) return view('practiceTarget', 'practiceTargetDetail', [focus('center', 'BLACK', ['w4'])], {}, 'next', 'description');
      return view('practiceNoEquation', 'practiceExtra', [focus('equation-hand', 'BLACK', selection.hand)]);
    }
    if (ready) return view('ready', index === 0 ? 'exchange' : 'automatic', [focus('send', 'BLACK')]);
    const wrongHand = selection.hand.filter(id => !action.hand.includes(id));
    const wrongCenter = selection.center.filter(id => !action.center.includes(id));
    if (wrongHand.length) return view(rejected && index === 0 ? 'taskOne' : 'undoHand', rejected && index === 0 ? 'undoHand' : index === 0 ? 'requiredOne' : index === 2 ? 'requiredThree' : 'requiredFive',
      [focus('equation-hand', 'BLACK', wrongHand)], { cards: wrongHand });
    if (wrongCenter.length) return view('undoTarget', 'targetLimit', [focus('equation-target', 'BLACK', wrongCenter)], { cards: wrongCenter }, 'next', 'rule');
    if (!sameIds(selection.hand, action.hand)) {
      const missingHand = action.hand.filter(id => !selection.hand.includes(id));
      if (index === 2 && !selection.hand.length) {
        return view('fourRule', 'four', [focus('hand', 'BLACK', missingHand)], { cards: missingHand }, 'rule', 'next');
      }
      return view(index === 0 ? 'choose' : index === 2 ? 'four' : 'divisionHelp', !selection.hand.length && index === 0 ? 'goal' : 'selected',
        [focus('hand', 'BLACK', missingHand)], { selected: selection.hand.length, total: action.hand.length, cards: missingHand }, 'next', index === 0 && !selection.hand.length ? 'rule' : 'description');
    }
    if (selection.operator !== action.op) return view(index === 0 ? 'operator' : index === 2 ? 'subtract' : 'divide', 'automatic', [focus('operator', 'BLACK', [], action.op)]);
    const missingTarget = action.center.filter(id => !selection.center.includes(id));
    return view(index === 0 ? 'target' : index === 2 ? 'targetThree' : 'targetFive', index === 2 ? 'fourEquation' : 'automatic',
      [focus('center', 'BLACK', missingTarget)], { cards: missingTarget }, 'next', index === 2 ? 'demonstration' : 'description');
  }

  const definition = {
    id: 'math-duel-five-moves-v2',
    steps: actions.map((action, index) => ({
      id: `move-${index + 1}`,
      complete: event => event.type === 'turn.completed' && event.actor === action.side && event.action === index + 1,
      view: snapshot => getGuidance(index, snapshot),
        checkpoints: index === 1 ? {
        'before-exchange': [{ ...observe('twoDigitRule', 'aiTrade', [focus('equation-hand', 'WHITE', action.hand)], 'rule', 'demonstration'),
          actionNumber: 1, context: [focus('center-area', 'BLACK')] }],
        'before-keep': [observe('centerLimitRule', 'aiKeeps', [focus('center', 'WHITE', action.keep)], 'rule', 'next')]
      } : index === 2 ? {
        'before-keep': [observe('keepConcept', 'keepConceptDetail', [focus('center', 'BLACK', action.keep)], 'rule', 'next')]
      } : index === 3 ? {
        'before-exchange': [observe('sixNineRule', 'flipDemo', [focus('equation-target', 'WHITE', action.center)], 'rule', 'demonstration')]
      } : {}
    }))
  };

  function createAiMove(index, game, solve) {
    const action = actions[index];
    if (!action || action.side !== 'WHITE' || game.turn !== action.side || !isExpectedBoard(index, game)) return null;
    const hand = game.whiteHand.filter(card => action.hand.includes(card.id));
    const center = game.center.filter(card => action.center.includes(card.id));
    const witness = solve(hand, action.op, center);
    if (!witness.success) return null;
    return { hand: [...action.hand], center: [...action.center], op: action.op, discard: [...action.keep], witness, eq: witness.eq, cardsA: witness.cardsA, cardsB: witness.cardsB };
  }

  function readPreferences(storage) {
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
      return { dontShow: saved?.dontShow === true, completed: saved?.completed === true };
    } catch { return { dontShow: false, completed: false }; }
  }

  function writePreferences(storage, preferences) {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify({ dontShow: preferences.dontShow === true, completed: preferences.completed === true })); } catch { /* The lesson also works without persistent storage. */ }
  }

  global.MathDuelTutorial = Object.freeze({
    STORAGE_KEY, actions, definition, sameIds, matchesTask, isExpectedBoard, createAiMove, getGuidance,
    readPreferences, writePreferences, shouldOffer: preferences => !preferences.dontShow && !preferences.completed,
    label: (kind, language) => (COPY[language] || COPY.zh).labels[kind] || COPY.zh.labels[kind] || kind || '',
    text: (key, language, values = {}) => {
      const copy = key ? (COPY[language] || COPY.zh)[key] || key : '';
      return copy.replace(/\{(\w+)\}/g, (_, name) => {
        const value = values[name];
        if (name === 'cards' && Array.isArray(value)) return value.map(id => `${language === 'en' ? id[0] === 'b' ? 'black ' : 'white ' : id[0] === 'b' ? '黑 ' : '白 '}${id.slice(1)}`).join(language === 'en' ? ', ' : '、');
        return value == null ? '' : String(value);
      });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
