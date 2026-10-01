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
      choose: '點黑 1 和 8', goal: '把黑牌換成白牌就能獲勝',
      anyOrder: '順序不限；再點一次可取消', operator: '點 ＋，選擇加法',
      target: '點場牌 9，作為結果', automatic: '系統會自動組成算式',
      ready: '點「送出算式」', exchange: '打出的牌留下，收回結果牌',
      taskOne: '這步請用黑 1、8 和 ＋', taskOneDetail: '點場牌 9 作結果；再點可取消',
      waiting: '看 AI 示範下一步', resolving: '正在交換牌', history: '上一手會留在出牌區給對手看',
      three: '三張手牌能組成二位數與個位數', threeDetail: '白 1、2 組成 12，再加白 6',
      targetTwo: '兩張場牌能組成二位數結果', targetTwoDetail: '黑 1、8 在這手作為 18',
      aiKeep: '場牌超過兩張，這手留下白 1、2', aiKeepDetail: '其餘場牌移出；點「繼續」觀看',
      four: '選黑 3、5、6、7 和 −', fourDetail: '點白 1、2 作結果，自動排列',
      keepThree: '點黑 3 和 6，留在中央', keepDetail: '其餘場牌會移出遊戲',
      keepReady: '點「確認保留」', taskKeep: '請留下這步指定的兩張牌',
      flip: '場牌 6 也能當成 9', flipDetail: '4 加 5 得到 9，系統自動翻轉',
      division: '用除法把剩下的黑牌換掉', divisionHelp: '選黑 2、4、9 和白 9，點 ÷',
      divisionTarget: '點白 4 作結果；6 與 9 可互換',
      keepFive: '點黑 9 和白 9，留在中央',
      wrongFive: '這步請用指定的除法牌組',
      complete: '教學完成，你已換成全白手牌', completeDetail: '可從問號「再次教學」重玩'
    },
    en: {
      choose: 'Tap black 1 and 8.', goal: 'Trade your black cards for white to win.',
      anyOrder: 'Any order; tap again to undo.', operator: 'Tap + for addition.',
      target: 'Tap table 9 as the result.', automatic: 'The equation arranges itself.',
      ready: 'Tap Send Equation.', exchange: 'Play your cards; take the result cards.',
      taskOne: 'Use black 1, 8 and + for this move.', taskOneDetail: 'Target table 9; tap again to undo.',
      waiting: 'Watch the AI demonstrate.', resolving: 'Cards are changing places.', history: 'Your last move stays for your opponent.',
      three: 'Three cards: two digits plus one digit.', threeDetail: 'White 1, 2 form 12; add white 6.',
      targetTwo: 'Two table cards make a two-digit result.', targetTwoDetail: 'Black 1 and 8 are the target 18.',
      aiKeep: 'Keep white 1, 2; remove the extras.', aiKeepDetail: 'Tap Continue to watch.',
      four: 'Use black 3, 5, 6, 7 and −.', fourDetail: 'Target white 1, 2; we arrange it.',
      keepThree: 'Keep black 3 and 6 on the table.', keepDetail: 'Other table cards leave the game.',
      keepReady: 'Tap Confirm Keep.', taskKeep: 'Keep the two cards for this task.',
      flip: 'Table 6 can also count as 9.', flipDetail: '4 + 5 is 9; the card flips for you.',
      division: 'Trade your black cards using ÷.', divisionHelp: 'Use black 2, 4, 9 and white 9; tap ÷.',
      divisionTarget: 'Target white 4; 6 and 9 can swap.', keepFive: 'Keep black 9 and white 9.',
      wrongFive: 'Use the division cards for this task.',
      complete: 'Lesson complete: your hand is all white.', completeDetail: 'Replay from the question-mark button.'
    }
  };

  const sameIds = (actual, expected) => actual.length === expected.length && new Set(actual).size === actual.length && expected.every(id => actual.includes(id));
  const focus = (area, side, cardIds = [], operator = null) => ({ area, side, cardIds, operator });
  const view = (hint, detail, targets = []) => ({ hint, detail, focus: targets });

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
    if (phase === 'keep') return sameIds(game.discardSelections, action.keep);
    return game.selections.operator === action.op && sameIds(game.selections.hand, action.hand) && sameIds(game.selections.center, action.center);
  }

  function getGuidance(index, { game, help = false, rejected = false }) {
    const action = actions[index];
    if (game.state === 'ANIMATING') return view('resolving', 'exchange');
    if (action.side === 'WHITE') return view('waiting', 'history');
    if (game.state === 'DISCARDING') {
      const keepMatches = matchesTask(index, game, 'keep');
      return view(keepMatches ? 'keepReady' : index === 2 ? 'keepThree' : 'keepFive', rejected ? 'taskKeep' : 'keepDetail',
        keepMatches ? [focus('send', 'BLACK')] : [focus('center', 'BLACK', action.keep.filter(id => !game.discardSelections.includes(id)))]);
    }
    const selection = game.selections;
    const ready = matchesTask(index, game);
    if (index === 4 && !help && !rejected) return view('division', ready ? 'ready' : null, ready ? [focus('send', 'BLACK')] : []);
    if (ready) return view('ready', index === 0 ? 'exchange' : 'automatic', [focus('send', 'BLACK')]);
    if (index === 2) return view('four', 'fourDetail', [focus('hand', 'BLACK', action.hand.filter(id => !selection.hand.includes(id)))]);
    if (index === 4) return view(rejected ? 'wrongFive' : 'divisionHelp', 'divisionTarget', [focus('hand', 'BLACK', action.hand.filter(id => !selection.hand.includes(id))), focus('operator', 'BLACK', [], '/')]);
    const wrong = selection.hand.some(id => !action.hand.includes(id)) || selection.center.some(id => !action.center.includes(id)) || (selection.operator && selection.operator !== action.op);
    if (wrong || rejected) return view('taskOne', 'taskOneDetail');
    if (!sameIds(selection.hand, action.hand)) return view('choose', selection.hand.length || selection.center.length || selection.operator ? 'anyOrder' : 'goal', [focus('hand', 'BLACK', action.hand.filter(id => !selection.hand.includes(id)))]);
    if (!selection.operator) return view('operator', 'anyOrder', [focus('operator', 'BLACK', [], '+')]);
    return view('target', 'automatic', [focus('center', 'BLACK', action.center)]);
  }

  const definition = {
    id: 'math-duel-five-moves-v2',
    steps: actions.map((action, index) => ({
      id: `move-${index + 1}`,
      complete: event => event.type === 'turn.completed' && event.actor === action.side && event.action === index + 1,
      view: snapshot => getGuidance(index, snapshot),
      checkpoints: index === 1 ? {
        'before-exchange': [view('three', 'threeDetail', [focus('equation-hand', 'WHITE', action.hand)]), view('targetTwo', 'targetTwoDetail', [focus('equation-target', 'WHITE', action.center)])],
        'before-keep': [view('aiKeep', 'aiKeepDetail', [focus('center', 'WHITE', action.keep)])]
      } : index === 3 ? {
        'before-exchange': [view('flip', 'flipDetail', [focus('equation-target', 'WHITE', action.center)])]
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
    text: (key, language) => key ? (COPY[language] || COPY.zh)[key] || key : ''
  });
})(typeof window !== 'undefined' ? window : globalThis);
