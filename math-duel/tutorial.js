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
      objective: '黑方手牌全白就能贏',
      objectiveDetail: '這些黑牌就是你要換掉的',
      corePlay: '算式要算出與場牌一樣的數字，才能交換。',
      coreDetail: '出牌留在場上；算式用到的場牌回到手裡。',
      digitLimit: '算式中的每個數最多兩位數。',
      digitLimitExample: '1、2 組成 12，再加 6；共出 3 張手牌。',
      firstTrade: '白 9 換回手裡了！', firstTradeDetail: '黑 1、8 留在場上，接著換對手',
      choose: '先點黑 1 和 8', goal: '這回合先把場上的白 9 換回來',
      anyOrder: '順序不限；再點一次可取消', operator: '再點 ＋，我們來做加法',
      selected: '已選 {selected}/{total} 張；再點可取消',
      undoHand: '點出牌區的{cards}，取消選取',
      undoTarget: '點結果區的{cards}，取消選取',
      requiredOne: '這步需要黑 1、8', requiredThree: '這步需要黑 3、5、6、7',
      requiredFive: '這步需要黑 2、4、9 和白 9',
      subtract: '再點 −，我們來做減法', divide: '再點 ÷，這次用除法',
      targetThree: '接著點場牌白 1 和 2，當作結果',
      targetFive: '接著點場牌白 4，當作結果',
      undoKeep: '點 {cards}，取消保留', keepCount: '已保留 {selected}/2 張；其餘會移出',
      practiceSelect: '先選出牌；已選 {selected} 張',
      practiceOperator: '接著點 ÷，選擇除法', practiceTarget: '接著選場牌，作為算式結果',
      practiceNoEquation: '還湊不出除法，試著增減一張牌',
      practiceExtra: '白牌也能用；6、9 可以互換', practiceMakeRoom: '最多四張，點出牌區取消一張',
      handLimit: '最多四張；先取消一張再選', targetLimit: '結果最多兩張；再點可取消',
      keepLimit: '只留兩張；再點已選的牌可取消',
      target: '接著點場牌 9，當作結果', automatic: '不用排順序，我們會幫你湊算式',
      ready: '可以了，按「送出算式」', exchange: '你出的牌留下，結果牌拿回手裡',
      opponentExchange: '對手的牌留在場上；結果牌回手裡。',
      taskOne: '這步請用黑 1、8 和 ＋', taskOneDetail: '點場牌 9 作結果；再點可取消',
      waiting: '先看對手這回合怎麼換牌', resolving: '正在換牌，看看它們去了哪裡', history: '上一手留在原位，對手也看得懂',
      three: '白 1、2 排成 12，再加白 6', threeDetail: '這三張手牌分成 12 和 6。',
      targetTwo: '結果也能用兩張牌來湊', targetTwoDetail: '黑 1、8 組成 18；12 + 6 = 18。',
      aiKeep: '白 1、2 留下，白 6 就離場了', aiKeepDetail: '場上最多兩張，其他牌會移出',
      four: '點黑 3、5、6、7', fourDetail: '用減法，把白 1、2 換回來',
      keepConcept: '場上只留兩張，其他牌會離場', keepConceptDetail: '這次留黑 3、6，讓對手接著出牌',
      keepThree: '點黑 3 和 6，讓它們留在場上', keepDetail: '只留兩張，其他牌就離場了',
      keepReady: '選好了，按「確認保留」', taskKeep: '請留下這步指定的兩張牌',
      flip: '看這張：黑 6 也能當成 9', flipDetail: '不用另外翻牌，系統會幫你處理',
      division: '用除法把剩下的黑牌換掉', divisionHelp: '選黑 2、4、9 和白 9',
      divisionTarget: '點白 4 作結果；6 與 9 可互換',
      keepFive: '點黑 9 和白 9，留在中央',
      keepPractice: '選兩張你想留在場上的牌',
      wrongFive: '這步請用指定的除法牌組',
      complete: '手牌全變成白色，你贏了！', completeDetail: '接下來，試試自己玩一局'
    },
    en: {
      labels: { objective: 'Goal', rule: 'Rule', description: 'Description', example: 'Example', demonstration: 'Demo', result: 'Result', status: 'Status', next: 'Next', tip: 'Tip' },
      objective: 'Win with an all-white hand.',
      objectiveDetail: 'Trade away these black cards.',
      corePlay: 'Your equation must match the table number to trade.',
      coreDetail: 'Played cards stay; the matched table cards go to your hand.',
      digitLimit: 'Each number in the equation is at most 2 digits.',
      digitLimitExample: '1, 2 make 12; add 6, using 3 hand cards.',
      firstTrade: 'White 9 is now in your hand!', firstTradeDetail: 'Black 1, 8 stay; AI moves next.',
      choose: 'First, tap black 1 and 8.', goal: 'This turn, bring table white 9 into your hand.',
      anyOrder: 'Any order; tap again to undo.', operator: 'Tap + for addition.',
      selected: 'Selected {selected}/{total}; tap again to undo.',
      undoHand: 'Tap played {cards} to undo.', undoTarget: 'Tap result {cards} to undo.',
      requiredOne: 'This move needs black 1, 8.', requiredThree: 'This move needs black 3, 5, 6, 7.',
      requiredFive: 'Use black 2, 4, 9 and white 9.',
      subtract: 'Tap − for subtraction.', divide: 'Tap ÷ for division.',
      targetThree: 'Tap table white 1 and 2 as the result.', targetFive: 'Tap table white 4 as the result.',
      undoKeep: 'Tap {cards} to undo retention.', keepCount: 'Kept {selected}/2; the rest leave play.',
      practiceSelect: 'Choose cards first; {selected} selected.',
      practiceOperator: 'Next, tap ÷ for division.', practiceTarget: 'Next, choose the table result.',
      practiceNoEquation: 'No division yet. Try changing a card.',
      practiceExtra: 'White cards work too; 6 and 9 swap.', practiceMakeRoom: 'Four max; tap a played card to undo.',
      handLimit: 'Four max; undo a card to add another.', targetLimit: 'Two result cards max; tap to undo.',
      keepLimit: 'Keep two; tap a chosen card to undo.',
      target: 'Tap table 9 as the result.', automatic: 'The equation arranges itself.',
      ready: 'Tap Send Equation.', exchange: 'Play your cards; take the result cards.',
      opponentExchange: 'AI takes results; its cards stay.',
      taskOne: 'Use black 1, 8 and + for this move.', taskOneDetail: 'Target table 9; tap again to undo.',
      waiting: 'Watch the AI demonstrate.', resolving: 'Cards are changing places.', history: 'Your last move stays for your opponent.',
      three: 'White 1, 2 make 12; add 6.', threeDetail: '3 hand cards form 12 + 6.',
      targetTwo: 'The result can use two cards too.', targetTwoDetail: '12 + 6 = 18; black 1, 8.',
      aiKeep: 'Keep white 1, 2; remove white 6.', aiKeepDetail: 'Only two stay; the others leave.',
      four: 'Tap black 3, 5, 6, 7.', fourDetail: 'Use subtraction to take white 1, 2.',
      keepConcept: 'Only two stay; the other cards leave.', keepConceptDetail: 'Keep black 3, 6 for your opponent.',
      keepThree: 'Keep black 3 and 6 on the table.', keepDetail: 'Other table cards leave the game.',
      keepReady: 'Tap Confirm Keep.', taskKeep: 'Keep the two cards for this task.',
      flip: 'Look: black 6 can count as 9.', flipDetail: 'No need to flip it; we do that for you.',
      division: 'Trade your black cards using ÷.', divisionHelp: 'Use black 2, 4, 9 and white 9.',
      divisionTarget: 'Target white 4; 6 and 9 can swap.', keepFive: 'Keep black 9 and white 9.',
      keepPractice: 'Choose any two cards to stay.',
      wrongFive: 'Use the division cards for this task.',
      complete: 'All white. You won!', completeDetail: 'Now try a game on your own.'
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
      if (missingBlack.length) {
        const whiteCards = selection.hand.filter(id => id[0] === 'w');
        if (selection.hand.length === 4 && whiteCards.length) return view('division', 'practiceMakeRoom', [focus('equation-hand', 'BLACK', whiteCards)]);
        return view('division', 'practiceSelect', [focus('hand-area', 'BLACK')], { selected: selection.hand.length });
      }
      if (selection.operator !== action.op) return view('division', 'practiceOperator', [focus('operator', 'BLACK', [], '/')]);
      if (!selection.center.length) return view('division', 'practiceTarget', [focus('center-area', 'BLACK')]);
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
      checkpoints: index === 0 ? {
        opening: [observe('objective', 'objectiveDetail', [focus('hand-area', 'BLACK')], 'objective', 'description'),
          observe('corePlay', 'coreDetail', [focus('center', 'BLACK', ['w9'])], 'rule', 'description'),
          observe('digitLimit', 'digitLimitExample', [focus('hand', 'BLACK', ['b1', 'b2', 'b6'])], 'rule', 'example')]
      } : index === 1 ? {
        'after-player-exchange': [{ ...observe('firstTrade', 'firstTradeDetail', [focus('hand', 'BLACK', ['w9'])], 'result', 'description'),
          actionNumber: 1, context: [focus('center-area', 'BLACK')] }],
        'before-exchange': [observe('three', 'threeDetail', [focus('equation-hand', 'WHITE', action.hand)], 'demonstration', 'description'), observe('targetTwo', 'targetTwoDetail', [focus('equation-target', 'WHITE', action.center)], 'result', 'description')],
        'before-keep': [observe('aiKeep', 'aiKeepDetail', [focus('center', 'WHITE', action.keep)], 'result', 'description')]
      } : index === 2 ? {
        'before-keep': [observe('keepConcept', 'keepConceptDetail', [focus('center-area', 'BLACK')], 'rule', 'description')]
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
