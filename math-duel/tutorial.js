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
      labels: { objective: '目標', rule: '規則', description: '描述', example: '例子', demonstration: '示範', result: '結果', status: '狀態', next: '操作', tip: '提示' },
      firstTrade: '黑 1、8 留場，白 9 回手。',
      firstTradeDetail: '每個數最多兩位數；看 AI 出牌。',
      choose: '先點黑 1 和黑 8。', goal: '目標是換回場牌白 9。',
      anyOrder: '牌的順序不限；再點一次可取消。', operator: '再點 ＋，使用加法。',
      selected: '已選 {selected}/{total} 張；再點可取消。',
      undoHand: '再點出牌區的{cards}，取消選取。',
      undoTarget: '再點結果區的{cards}，取消選取。',
      requiredOne: '這步需要黑 1 和黑 8。', requiredThree: '這步需要黑 3、5、6、7。',
      requiredFive: '這步需要黑 2、4、9 和白 9。',
      subtract: '再點 −，使用減法。', divide: '再點 ÷，使用除法。',
      targetThree: '點場牌白 1、白 2，作為結果。',
      targetFive: '點場牌白 4，作為結果；白 9 可當成 6。',
      undoKeep: '再點 {cards}，取消保留。', keepCount: '已保留 {selected}/2 張；其餘會移出。',
      practiceSelect: '先選出牌；目前已選 {selected} 張。',
      practiceAddWhite: '再選手牌白 9。', practiceAddWhiteDetail: '白 9 可當成 6，和黑 9 組成 96。',
      practiceOperator: '再點 ÷，使用除法。', practiceOperatorDetail: '黑 2、4 可組成 24。',
      practiceTarget: '點場牌白 4，作為結果。', practiceTargetDetail: '系統會自動排成 96 ÷ 24 = 4。',
      practiceNoEquation: '這組數還不成立；調整選牌再試。',
      practiceExtra: '白牌也能參與；6 和 9 可以互換。', practiceMakeRoom: '最多選四張；先取消一張白牌。',
      practiceMakeRoomDetail: '再依亮起的牌補選。',
      handLimit: '最多選四張；取消一張後才能再選。', targetLimit: '結果最多選兩張；再點可取消。',
      keepLimit: '只能保留兩張；再點已選的牌可取消。',
      target: '再點場牌白 9，作為結果。', automatic: '系統會依數值自動排好算式。',
      ready: '算式完成了，按「送出算式」。', exchange: '出牌留場；結果回手。',
      opponentExchange: '對手出牌留場；結果牌回手。',
      taskOne: '這步請用黑 1、黑 8 和 ＋。', taskOneDetail: '結果選場牌白 9，再點可取消。',
      waiting: '接著輪到白方行動。', resolving: '換牌動畫進行中。', history: '你的上一手留在場上，對手看得到。',
      aiKeep: '12 + 6 = 18，AI 換回黑 1、8。', aiKeepDetail: '最多留兩張；AI 留 1、2，6 離場。',
      four: '點黑 3、5、6、7。', fourDetail: '算式會排成 57 − 36 = 21，換回白 1、2。',
      keepConcept: '場上最多保留兩張牌。', keepConceptDetail: '這手留下黑 3、6；其他牌會離場。',
      keepThree: '點黑 3 和黑 6，讓它們留在場上。', keepDetail: '其餘牌會移出場中央。',
      keepReady: '兩張選好了，按「確認保留」。', taskKeep: '請選兩張牌留在中央。',
      flip: '白方可把場牌黑 6 當成 9。', flipDetail: '白 4 + 白 5 = 9，所以換回黑 6。',
      division: '最後一手用除法，換掉剩下的黑牌。', divisionHelp: '選黑 2、4、9 和白 9。',
      divisionTarget: '結果選白 4；白 9 可當成 6。',
      keepFive: '選兩張你想留在場上的牌。',
      keepPractice: '選兩張你想留在場上的牌。',
      wrongFive: '這步請用指定的除法牌組。',
      complete: '手牌全白，你贏了！', completeDetail: '接著自己玩一局。'
    },
    en: {
      labels: { objective: 'Goal', rule: 'Rule', description: 'Description', example: 'Example', demonstration: 'Demo', result: 'Result', status: 'Status', next: 'Next', tip: 'Tip' },
      firstTrade: 'Black 1 and 8 stay; white 9 returns to your hand.',
      firstTradeDetail: 'Two digits max; watch AI play.',
      choose: 'First, tap black 1 and black 8.', goal: 'Trade for the table white 9.',
      anyOrder: 'Card order does not matter; tap again to undo.', operator: 'Tap + for addition.',
      selected: 'Selected {selected}/{total}; tap again to undo.',
      undoHand: 'Tap played {cards} again to undo.', undoTarget: 'Tap result {cards} again to undo.',
      requiredOne: 'Use black 1 and black 8 for this move.', requiredThree: 'Use black 3, 5, 6, and 7 for this move.',
      requiredFive: 'Use black 2, 4, 9, and white 9 for this move.',
      subtract: 'Tap − for subtraction.', divide: 'Tap ÷ for division.',
      targetThree: 'Tap table white 1 and white 2 as the result.', targetFive: 'Tap table white 4 as the result; white 9 counts as 6.',
      undoKeep: 'Tap {cards} again to undo keeping it.', keepCount: 'Kept {selected}/2; the rest leave play.',
      practiceSelect: 'Choose cards; {selected} selected.',
      practiceAddWhite: 'Now select hand white 9.', practiceAddWhiteDetail: 'White 9 can count as 6; with black 9 they make 96.',
      practiceOperator: 'Tap ÷ for division.', practiceOperatorDetail: 'Black 2 and 4 can make 24.',
      practiceTarget: 'Tap table white 4 as the result.', practiceTargetDetail: 'The equation arranges as 96 ÷ 24 = 4.',
      practiceNoEquation: 'This set does not work yet; adjust your cards and try again.',
      practiceExtra: 'White cards work too; 6 and 9 can swap.', practiceMakeRoom: 'Four max; undo one white card.',
      practiceMakeRoomDetail: 'Choose the highlighted card next.',
      handLimit: 'Four cards max; undo one before adding another.', targetLimit: 'Two result cards max; tap again to undo.',
      keepLimit: 'Keep only two; tap a chosen card to undo.',
      target: 'Tap table white 9 as the result.', automatic: 'The equation arranges itself from the values.',
      ready: 'Equation ready; tap Send Equation.', exchange: 'Cards stay; results return.',
      opponentExchange: 'AI cards stay; results return.',
      taskOne: 'Use black 1, black 8, and + for this move.', taskOneDetail: 'Target table white 9; tap again to undo.',
      waiting: 'White moves next.', resolving: 'The trade animation is playing.', history: 'Your last move stays for White to see.',
      aiKeep: '12 + 6 = 18, so AI takes black 1 and 8.', aiKeepDetail: 'Up to 2 stay; AI keeps 1, 2; 6 leaves.',
      four: 'Tap black 3, 5, 6, and 7.', fourDetail: 'They arrange as 57 − 36 = 21 to take white 1 and 2.',
      keepConcept: 'Keep no more than two cards.', keepConceptDetail: 'Keep black 3, 6; the rest leave.',
      keepThree: 'Keep black 3 and black 6 on the table.', keepDetail: 'The other cards leave the center.',
      keepReady: 'Two selected; tap Confirm Keep.', taskKeep: 'Choose two cards to keep in the center.',
      flip: 'Use black 6 as a 9.', flipDetail: 'White 4 + 5 = 9; take black 6.',
      division: 'Use division on the final move to trade the remaining black cards.', divisionHelp: 'Choose black 2, 4, 9, and white 9.',
      divisionTarget: 'Target white 4; white 9 can count as 6.', keepFive: 'Choose any two cards to keep on the table.',
      keepPractice: 'Choose any two cards to keep on the table.',
      wrongFive: 'Use the division cards for this task.',
      complete: 'All white—you win!', completeDetail: 'Play on your own.'
    }
  };

  const sameIds = (actual, expected) => actual.length === expected.length && new Set(actual).size === actual.length && expected.every(id => actual.includes(id));
  const focus = (area, side, cardIds = [], operator = null) => ({ area, side, cardIds, operator });
  const view = (hint, detail, targets = [], values = {}, hintKind = 'next', detailKind = 'tip') => ({ hint, detail, focus: targets, values, mode: 'tap', hintKind, detailKind });
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
    return snapshot.notice ? { ...guidance, detail: `${snapshot.notice}Limit` } : guidance;
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
        return view(ready ? 'keepReady' : 'keepPractice', ready ? 'keepDetail' : 'keepCount',
          ready ? [focus('send', 'BLACK')] : [focus('center-area', 'BLACK')], { selected: game.discardSelections.length });
      }
      const wrongKeep = game.discardSelections.filter(id => !action.keep.includes(id));
      if (wrongKeep.length) return view(rejected ? 'taskKeep' : 'undoKeep', rejected ? 'undoKeep' : 'keepDetail',
        [focus('center', 'BLACK', wrongKeep)], { cards: wrongKeep });
      const keepMatches = matchesTask(index, game, 'keep');
      return view(keepMatches ? 'keepReady' : index === 2 ? 'keepThree' : 'keepFive', keepMatches ? 'keepDetail' : 'keepCount',
        keepMatches ? [focus('send', 'BLACK')] : [focus('center', 'BLACK', action.keep.filter(id => !game.discardSelections.includes(id)))], { selected: game.discardSelections.length });
    }
    const selection = game.selections;
    const ready = matchesTask(index, game);
    // Final practice still points to the current control, without giving away the cards.
    if (index === 4 && !help) {
      if (ready) return view('ready', 'exchange', [focus('send', 'BLACK')]);
      const missingBlack = game.blackHand ? game.blackHand.filter(card => card.color === 'b' && !selection.hand.includes(card.id)) :
        action.hand.filter(id => id[0] === 'b' && !selection.hand.includes(id));
      const whiteCards = selection.hand.filter(id => id[0] === 'w');
      if (selection.hand.length >= 4 && whiteCards.length && (missingBlack.length || !selection.hand.includes('w9'))) {
        return view('division', 'practiceMakeRoom', [focus('equation-hand', 'BLACK', whiteCards)], {}, 'next', 'tip');
      }
      if (missingBlack.length) {
        return view('division', 'practiceSelect', [focus('hand', 'BLACK', missingBlack.map(card => card.id))], { selected: selection.hand.length });
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
    if (wrongCenter.length) return view('undoTarget', index === 0 ? 'target' : index === 2 ? 'targetThree' : 'targetFive', [focus('equation-target', 'BLACK', wrongCenter)], { cards: wrongCenter });
    if (!sameIds(selection.hand, action.hand)) return view(index === 0 ? 'choose' : index === 2 ? 'four' : 'divisionHelp', !selection.hand.length && index === 0 ? 'goal' : !selection.hand.length && index === 2 ? 'fourDetail' : 'selected',
      [focus('hand', 'BLACK', action.hand.filter(id => !selection.hand.includes(id)))], { selected: selection.hand.length, total: action.hand.length });
    if (selection.operator !== action.op) return view(index === 0 ? 'operator' : index === 2 ? 'subtract' : 'divide', 'automatic', [focus('operator', 'BLACK', [], action.op)]);
    return view(index === 0 ? 'target' : index === 2 ? 'targetThree' : 'targetFive', 'automatic', [focus('center', 'BLACK', action.center.filter(id => !selection.center.includes(id)))]);
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
        'before-keep': [observe('keepConcept', 'keepConceptDetail', [focus('center', 'BLACK', action.keep)], 'rule', 'description')]
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
