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
      firstTrade: '黑 1、黑 8 留在場上；白 9 回到你手牌。',
      firstTradeDetail: '算式中的每個數最多兩位數。',
      choose: '請從手牌選{cards}。', goal: '算式結果須等於所選場牌組成的數字。',
      anyOrder: '手牌可依任意順序選；再點已選牌可取消。', operator: '請點「＋」，選擇加法。',
      selected: '已選 {selected}/{total} 張；點已選牌可取消。',
      undoHand: '再點出牌區的{cards}，取消選取。', undoTarget: '再點結果區的{cards}，取消選取。',
      requiredOne: '這一步要用黑 1 和黑 8。', requiredThree: '這一步要用黑 3、黑 5、黑 6、黑 7。',
      requiredFive: '這一步要用黑 2、黑 4、黑 9 和白 9。',
      subtract: '請點「−」，選擇減法。', divide: '請點「÷」，選擇除法。',
      targetThree: '選場牌{cards}作為結果。', targetFive: '選場牌{cards}作結果；白 9 翻面代表 6。',
      undoKeep: '再點已選的{cards}，取消保留。', keepCount: '已選 {selected}/2 張；未選的中央牌會移出遊戲。',
      practiceStart: '先試著用除法完成交換。', practiceSelect: '請再選亮起的手牌。',
      practiceAddWhite: '接著選手牌白 9。', practiceAddWhiteDetail: '白 9 翻面為 6，和黑 9 組成 96。',
      practiceOperator: '請點「÷」，選擇除法。', practiceOperatorDetail: '本次算式用黑 2、黑 4 組成除數 24。',
      practiceTarget: '選場牌白 4 作為結果。', practiceTargetDetail: '系統會排成 96 ÷ 24 = 4。',
      practiceNoEquation: '目前算式不成立；換手牌或運算符號再試。',
      practiceExtra: '白牌也能出；牌面 6、9 可翻面互換。', practiceMakeRoom: '點出牌區已選白牌，取消一張。',
      handLimit: '手牌最多四張；取消一張已選牌。', targetLimit: '結果最多兩張；取消一張已選牌。',
      keepLimit: '中央最多留兩張；取消一張已選牌。',
      target: '選場牌{cards}作為結果。', automatic: '系統會自動排好算式。',
      ready: '算式已成立；請按「送出算式」交換牌。', exchange: '你出牌留場；你收回結果牌。',
      opponentExchange: 'AI 出牌留場；AI 收回結果牌。',
      taskOne: '請改選黑 1、黑 8 和「＋」。', taskOneDetail: '結果選白 9；已選牌再點一次可取消。',
      waiting: '現在輪到白方行動。', resolving: '交換牌張中。', history: '你的上一手算式留在場上，對手看得到。',
      aiKeep: 'AI 用 12 + 6 = 18，換回黑 1、黑 8。', aiKeepDetail: '中央多於兩張，須留兩張；其餘移出。',
      four: '請從手牌選{cards}。', fourDetail: '這步會排成 57 − 36 = 21；再選白 1、白 2 作結果。',
      keepConcept: '中央多於兩張，須留兩張；其餘移出。', keepConceptDetail: '請選黑 3、黑 6 保留。',
      keepThree: '請選{cards}留在場中央。', keepDetail: '所選兩張留在中央；其他牌移出遊戲。',
      keepReady: '已選好兩張；按「確認保留」繼續。', taskKeep: '請從場中央選兩張牌留下。',
      flip: '白方把黑 6 翻面，當作 9。', flipDetail: '白方以白 4 + 白 5 = 9，換回黑 6。',
      division: '目標是把手上剩下的黑牌全換成白牌。', divisionHelp: '請選亮起的手牌，完成除法。',
      divisionTarget: '選白 4 作結果；白 9 翻面代表 6。',
      keepFive: '請從場中央選兩張留下。', keepPractice: '還要選 {remaining} 張場牌。',
      wrongFive: '交換後手上仍有黑牌；調整出牌，直到手牌全變白。',
      complete: '手牌全是白牌，你贏了！', completeDetail: '現在開始一般對局吧。'
    },
    en: {
      labels: { objective: 'Goal', rule: 'Rule', description: 'Details', example: 'Example', demonstration: 'Demo', result: 'Result', status: 'Status', next: 'Action', tip: 'Details' },
      firstTrade: 'Black 1, 8 stay; take white 9.',
      firstTradeDetail: 'Max two digits per number.',
      choose: 'Choose {cards} from your hand.', goal: 'Result must match center value.',
      anyOrder: 'Choose hand cards in any order; tap again to undo.', operator: 'Tap + to choose addition.',
      selected: '{selected}/{total} selected; tap a selected card to undo.',
      undoHand: 'Tap {cards} in the play area to undo.', undoTarget: 'Tap {cards} in the result area to undo.',
      requiredOne: 'Use black 1 and black 8 for this move.', requiredThree: 'Use black 3, black 5, black 6, and black 7.',
      requiredFive: 'Use black 2, black 4, black 9, and white 9.',
      subtract: 'Tap − to choose subtraction.', divide: 'Tap ÷ to choose division.',
      targetThree: 'Choose center {cards} as result.', targetFive: 'Choose {cards} as result; flip white 9 to 6.',
      undoKeep: 'Tap {cards} again to undo keeping them.', keepCount: '{selected}/2 kept; other center cards leave play.',
      practiceStart: 'Try trading with a division equation.', practiceSelect: 'Choose the highlighted hand cards.',
      practiceAddWhite: 'Now choose white 9 from your hand.', practiceAddWhiteDetail: 'White 9 flips to 6; black 9 makes 96.',
      practiceOperator: 'Tap ÷ to choose division.', practiceOperatorDetail: 'Black 2 and 4 make divisor 24.',
      practiceTarget: 'Choose white 4 from the center as the result.', practiceTargetDetail: 'Auto-arranges: 96 ÷ 24 = 4.',
      practiceNoEquation: 'This equation is not valid yet; change a card or operator.',
      practiceExtra: 'White cards work; flip a 6 or 9.', practiceMakeRoom: 'Tap a selected white card to undo.',
      handLimit: 'Four hand cards max; undo one.', targetLimit: 'Two result cards max; undo one.',
      keepLimit: 'Keep two center cards max; undo one.',
      target: 'Choose center {cards} as result.', automatic: 'The equation arranges itself.',
      ready: 'Equation is ready; tap Send Equation to trade.', exchange: 'Your cards stay; you take results.',
      opponentExchange: 'AI cards stay; AI takes results.',
      taskOne: 'Use black 1, black 8, and + for this move.', taskOneDetail: 'Choose white 9 as the result; tap it again to undo.',
      waiting: 'White moves now.', resolving: 'Cards are trading.', history: 'Your last equation stays visible to your opponent.',
      aiKeep: 'AI: 12 + 6 = 18; takes black 1, 8.', aiKeepDetail: 'Center >2: keep two; remove rest.',
      four: 'Choose {cards} from your hand.', fourDetail: '57 − 36 = 21; choose white 1, 2 as result.',
      keepConcept: 'Center >2: keep two; remove rest.', keepConceptDetail: 'Choose black 3 and 6 to keep.',
      keepThree: 'Keep {cards} in the center.', keepDetail: 'The other center cards leave play.',
      keepReady: 'Two selected; tap Confirm Keep to continue.', taskKeep: 'Choose two cards from the center to keep.',
      flip: 'White flips black 6 to 9.', flipDetail: 'White uses 4 + 5 = 9 to take black 6.',
      division: 'Goal: turn remaining black cards white.', divisionHelp: 'Choose highlighted cards for division.',
      divisionTarget: 'Choose white 4 as result; flip white 9 to 6.',
      keepFive: 'Choose two center cards to keep.', keepPractice: 'Choose {remaining} more center card(s).',
      wrongFive: 'Black cards remain; adjust your trade.',
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
      return view(index === 0 ? 'choose' : index === 2 ? 'four' : 'divisionHelp', !selection.hand.length && index === 0 ? 'goal' : !selection.hand.length && index === 2 ? 'fourDetail' : 'selected',
        [focus('hand', 'BLACK', missingHand)], { selected: selection.hand.length, total: action.hand.length, cards: missingHand }, 'next', index === 0 && !selection.hand.length ? 'rule' : 'description');
    }
    if (selection.operator !== action.op) return view(index === 0 ? 'operator' : index === 2 ? 'subtract' : 'divide', 'automatic', [focus('operator', 'BLACK', [], action.op)]);
    const missingTarget = action.center.filter(id => !selection.center.includes(id));
    return view(index === 0 ? 'target' : index === 2 ? 'targetThree' : 'targetFive', 'automatic',
      [focus('center', 'BLACK', missingTarget)], { cards: missingTarget });
  }

  const definition = {
    id: 'math-duel-five-moves-v2',
    steps: actions.map((action, index) => ({
      id: `move-${index + 1}`,
      complete: event => event.type === 'turn.completed' && event.actor === action.side && event.action === index + 1,
      view: snapshot => getGuidance(index, snapshot),
        checkpoints: index === 1 ? {
        'before-exchange': [{ ...observe('firstTrade', 'firstTradeDetail', [focus('equation-hand', 'WHITE', action.hand)], 'result', 'rule'),
          actionNumber: 1, context: [focus('center-area', 'BLACK')] }],
        'before-keep': [observe('aiKeep', 'aiKeepDetail', [focus('center', 'WHITE', action.keep)], 'result', 'rule')]
      } : index === 2 ? {
        'before-keep': [observe('keepConcept', 'keepConceptDetail', [focus('center', 'BLACK', action.keep)], 'rule', 'next')]
      } : index === 3 ? {
        'before-exchange': [observe('flip', 'flipDetail', [focus('equation-target', 'WHITE', action.center)], 'rule', 'description')]
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
