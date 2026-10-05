import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function makeContext() {
  const context = { events: [] };
  context.self = context;
  context.window = context;
  vm.createContext(context);
  for (const path of ['../shared/flow-guide.js', '../shared/equation-witness.js', '../math-duel/rule-modes.js', '../math-duel/tutorial.js']) {
    vm.runInContext(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), context);
  }
  const page = fs.readFileSync(new URL('../math-duel/index.html', import.meta.url), 'utf8');
  for (const name of ['createInitialState', 'applyMoveState', 'endTurn']) {
    const source = page.match(new RegExp(`^([ ]+)function ${name}\\([^]*?^\\1}\\r?$`, 'm'))?.[0];
    assert.ok(source, `${name} must be available for a normal-game replay`);
    vm.runInContext(source, context);
  }
  vm.runInContext(`
    let game = createInitialState('AI_EASY', MathDuelRuleModes.RULE_MODE.CLASSIC, 'WHITE');
    let tutorialSession = null;
    const gameSession = { id: 'test', action: 0, activeAction: null };
    let aiRequestPending = false, workerAwaitingReply = false;
    function isRace2Mode() { return false; }
    function emitGuideEvent(event) { events.push(event); }
    function saveState() {}
    function render() {}
    function checkAITurn() {}
    function stopTutorial() {}
  `, context);
  return context;
}

const readGame = context => vm.runInContext('game', context);

test('replays five legal actions from the actual full opening through the actual victory rule', () => {
  const context = makeContext();
  const tutorial = context.MathDuelTutorial;
  const solve = context.MathDuelEquation.checkEquation;
  const game = readGame(context);
  assert.equal(game.blackHand.length, 9);
  assert.equal(game.whiteHand.length, 8);
  assert.equal(game.center[0].id, 'w9');
  assert.equal(game.turn, 'BLACK');
  assert.equal(game.aiSide, 'WHITE');
  const originalIds = [...game.blackHand, ...game.whiteHand, ...game.center].map(card => card.id).sort();
  const removed = [];
  const equations = [];
  let guide = context.FlowGuide.createGuideState(tutorial.definition);

  tutorial.actions.forEach((action, index) => {
    assert.equal(tutorial.isExpectedBoard(index, game), true, `opening of move ${index + 1}`);
    game.selections = { hand: [...action.hand].reverse(), center: [...action.center].reverse(), operator: action.op };
    assert.equal(tutorial.matchesTask(index, game), true, 'click order must not matter');
    const hand = (action.side === 'BLACK' ? game.blackHand : game.whiteHand).filter(card => action.hand.includes(card.id));
    const center = game.center.filter(card => action.center.includes(card.id));
    const equation = solve(hand, action.op, center);
    assert.equal(equation.success, true, `move ${index + 1} must be legal`);
    equations.push(equation.eq);
    if (action.side === 'WHITE') assert.equal(tutorial.createAiMove(index, game, solve).eq, equation.eq);
    context.hand = hand; context.center = center; context.op = action.op; context.equation = equation;
    vm.runInContext('applyMoveState(hand, center, op, equation)', context);
    if (game.center.length > 2) {
      game.discardSelections = [...action.keep].reverse();
      assert.equal(tutorial.matchesTask(index, game, 'keep'), true);
      removed.push(...game.center.filter(card => !action.keep.includes(card.id)));
      game.center = game.center.filter(card => action.keep.includes(card.id));
      game.discardSelections = [];
    }
    vm.runInContext('endTurn()', context);
    for (const event of context.events.splice(0)) guide = context.FlowGuide.advanceGuide(guide, tutorial.definition, event, { game }).state;
    const identities = [...game.blackHand, ...game.whiteHand, ...game.center, ...removed].map(card => card.id).sort();
    assert.deepEqual(identities, originalIds, 'all eighteen identities must be conserved, including removed cards');
    assert.equal(new Set(identities).size, 18);
    assert.equal(game.state, index === 4 ? 'GAMEOVER' : 'PLAYING');
    assert.equal(guide.stepIndex, index + 1);
  });
  assert.deepEqual(equations, ['1 + 8 = 9', '12 + 6 = 18', '57 - 36 = 21', '4 + 5 = 9', '96 ÷ 24 = 4']);
  assert.equal(game.winner, 'BLACK');
  assert.deepEqual(Array.from(game.blackHand, card => card.id).sort(), ['w1', 'w2', 'w4']);
  assert.equal(guide.status, 'completed');
});

test('distinguishes another legal equation from the fixed teaching task', () => {
  const context = makeContext();
  const game = readGame(context);
  game.selections = { hand: ['b1', 'b5'], center: ['w9'], operator: '+' };
  assert.equal(context.MathDuelEquation.checkEquation(game.blackHand.filter(card => game.selections.hand.includes(card.id)), '+', game.center).success, true);
  assert.equal(context.MathDuelTutorial.matchesTask(0, game), false);
  assert.equal(context.MathDuelTutorial.getGuidance(0, { game }).hint, 'undoHand');
  assert.equal(context.MathDuelTutorial.getGuidance(0, { game, rejected: true }).hint, 'taskOne');
});

test('does not repair an unexpected board or create an illegal teaching AI move', () => {
  const context = makeContext();
  const game = readGame(context);
  game.turn = 'WHITE';
  const before = JSON.stringify(game);
  assert.equal(context.MathDuelTutorial.createAiMove(1, game, context.MathDuelEquation.checkEquation), null);
  assert.equal(JSON.stringify(game), before);
  game.blackHand[0].val = 9;
  assert.equal(context.MathDuelTutorial.isExpectedBoard(0, game), false);
});

test('the final action is goal-only until help is requested, and keep guidance remains explicit', () => {
  const context = makeContext();
  const game = readGame(context);
  const tutorial = context.MathDuelTutorial;
  assert.equal(tutorial.getGuidance(4, { game }).hint, 'division');
  const firstDivisionCue = tutorial.getGuidance(4, { game });
  assert.equal(firstDivisionCue.detail, 'practiceStart');
  assert.equal(firstDivisionCue.focus[0].area, 'hand-area');
  assert.doesNotMatch(tutorial.text(firstDivisionCue.hint, 'zh'), /黑 [0-9]/, 'the opening challenge does not reveal the card solution');
  assert.doesNotMatch(tutorial.text(firstDivisionCue.detail, 'zh'), /黑 [0-9]/);
  assert.equal(tutorial.getGuidance(4, { game, help: true }).hint, 'divisionHelp');
  game.state = 'DISCARDING';
  assert.equal(tutorial.getGuidance(4, { game }).hint, 'keepPractice');
});

test('walks each learner move through hand, operator, result, and send without stale focus', () => {
  const { MathDuelTutorial: tutorial } = makeContext();
  for (const index of [0, 2, 4]) {
    const action = tutorial.actions[index];
    const game = { state: 'PLAYING', turn: 'BLACK', selections: { hand: [], center: [], operator: null } };
    const guidance = () => tutorial.getGuidance(index, { game, help: true });
    assert.equal(guidance().focus[0].area, 'hand');
    game.selections.hand = [action.hand[0]];
    assert.equal(guidance().values.selected, 1);
    assert.ok(!guidance().focus[0].cardIds.includes(action.hand[0]));
    game.selections.hand = [...action.hand].reverse();
    assert.equal(guidance().focus[0].area, 'operator');
    assert.equal(guidance().focus[0].operator, action.op);
    game.selections.operator = action.op;
    assert.equal(guidance().focus[0].area, 'center');
    game.selections.center = [...action.center].reverse();
    assert.equal(guidance().focus[0].area, 'send');
    game.selections.hand.pop();
    assert.equal(guidance().focus[0].area, 'hand', 'deselection must lead back to the missing card');
  }
});

test('points at live played cards for correction and counts retention separately', () => {
  const { MathDuelTutorial: tutorial } = makeContext();
  const game = { turn: 'BLACK', state: 'PLAYING', selections: { hand: ['b1', 'b5'], center: ['w9'], operator: '+' }, discardSelections: [] };
  const wrongHand = tutorial.getGuidance(0, { game });
  assert.equal(wrongHand.focus[0].area, 'equation-hand');
  assert.deepEqual(Array.from(wrongHand.focus[0].cardIds), ['b5']);
  assert.equal(tutorial.text(wrongHand.hint, 'zh', wrongHand.values), '再點出牌區的黑 5，取消選取。');
  game.selections = { hand: ['b3', 'b5', 'b6', 'b7'], center: ['w1', 'w6'], operator: '-' };
  assert.equal(tutorial.getGuidance(2, { game }).focus[0].area, 'equation-target');
  game.state = 'DISCARDING';
  game.discardSelections = ['b3'];
  const keepCue = tutorial.getGuidance(2, { game });
  assert.equal(keepCue.values.selected, 1);
  assert.deepEqual(Array.from(keepCue.focus[0].cardIds), ['b6']);
  assert.equal(tutorial.text(keepCue.hint, 'zh', keepCue.values), '請選黑 6留在場中央。');
  game.discardSelections = ['b3', 'b7'];
  const wrongKeep = tutorial.getGuidance(2, { game });
  assert.equal(wrongKeep.hint, 'undoKeep');
  assert.deepEqual(Array.from(wrongKeep.focus[0].cardIds), ['b7']);
  const keepLimit = tutorial.getGuidance(2, { game, notice: 'keep' });
  assert.equal(keepLimit.detail, 'keepLimit');
  assert.deepEqual(Array.from(keepLimit.focus[0].cardIds), ['b3', 'b7']);
});

test('separates AI observation cues from tap tasks without per-checkpoint button labels', () => {
  const { MathDuelTutorial: tutorial } = makeContext();
  const explanations = tutorial.definition.steps[1].checkpoints;
  assert.equal(explanations['before-exchange'][0].mode, 'observe');
  assert.equal(explanations['before-exchange'].length, 1, 'the first move result and AI setup share one pause');
  assert.equal(explanations['before-exchange'][0].hintKind, 'result');
  assert.equal(explanations['before-exchange'][0].detailKind, 'rule');
  assert.match(tutorial.text(explanations['before-exchange'][0].hint, 'zh'), /黑 1、黑 8 留在場上；白 9 回到你手牌/);
  assert.match(tutorial.text(explanations['before-exchange'][0].detail, 'zh'), /算式中的每個數最多兩位/);
  assert.match(tutorial.text(explanations['before-exchange'][0].detail, 'en'), /Max two digits per number/);
  assert.match(tutorial.text(explanations['before-keep'][0].hint, 'zh'), /12 \+ 6 = 18/);
  assert.equal(explanations['before-keep'][0].detailKind, 'rule');
  assert.equal(tutorial.label('rule', 'zh'), '規則');
  assert.equal(tutorial.label('description', 'zh'), '說明');
  assert.equal(tutorial.label('next', 'zh'), '操作');
  assert.equal(tutorial.label('example', 'en'), 'Example');
  for (const step of tutorial.definition.steps) {
    for (const views of Object.values(step.checkpoints)) {
      for (const view of views) assert.equal(Object.hasOwn(view, 'continueLabel'), false);
    }
  }
  const game = { turn: 'BLACK', state: 'PLAYING', selections: { hand: [], center: [], operator: null } };
  assert.equal(tutorial.getGuidance(0, { game }).mode, 'tap');
  game.state = 'ANIMATING';
  const resolving = tutorial.getGuidance(0, { game });
  assert.equal(resolving.focus.length, 0, 'the dimmer must get out of the way of card movement');
  assert.equal(resolving.hintKind, 'status');
  assert.equal(resolving.detail, 'exchange', 'the learner is the actor during their own move');
  const opponentResolving = tutorial.getGuidance(1, { game: { turn: 'WHITE', state: 'ANIMATING' } });
  assert.equal(opponentResolving.detail, 'opponentExchange');
  assert.equal(tutorial.text(opponentResolving.detail, 'zh'), 'AI 出牌留場；AI 收回結果牌。');
  assert.equal(tutorial.text(opponentResolving.detail, 'en'), 'AI cards stay; AI takes results.');
});

test('starts on a playable action and uses one two-sentence cue before each guided operation', () => {
  const { MathDuelTutorial: tutorial } = makeContext();
  const game = { state: 'PLAYING', turn: 'BLACK', selections: { hand: [], center: [], operator: null } };
  const firstAction = tutorial.getGuidance(0, { game });
  assert.equal(firstAction.mode, 'tap');
  assert.equal(firstAction.hint, 'choose');
  assert.equal(firstAction.detail, 'goal');
  assert.equal(firstAction.detailKind, 'rule');
  assert.equal(tutorial.definition.steps[0].checkpoints.opening, undefined, 'no read-only opening pages precede the first move');
  assert.match(tutorial.text(firstAction.hint, 'zh', firstAction.values), /請從手牌選黑 1、黑 8/);
  assert.match(tutorial.text(firstAction.detail, 'zh'), /算式結果須等於所選場牌組成的數字/);
  assert.match(tutorial.text(firstAction.detail, 'en'), /Result must match center value/);
  assertTwoLineDialogue(tutorial, firstAction, 'zh');
  const afterFirstAction = tutorial.definition.steps[1].checkpoints['before-exchange'];
  assert.equal(afterFirstAction.length, 1, 'only one guided pause precedes the AI exchange');
  assert.equal(tutorial.actions[1].side, 'WHITE', 'continuing that two-sentence cue performs the AI move');
  assertTwoLineDialogue(tutorial, afterFirstAction[0], 'zh');
  const afterAiExchange = tutorial.definition.steps[1].checkpoints['before-keep'];
  assert.equal(afterAiExchange.length, 1, 'the AI result is followed by one keep operation');
  assertTwoLineDialogue(tutorial, afterAiExchange[0], 'zh');
  for (const step of tutorial.definition.steps) {
    for (const [key, views] of Object.entries(step.checkpoints)) {
      assert.equal(views.length, 1, `${step.id}/${key} must lead to an operation without another read-only page`);
      assert.equal(views[0].mode, 'observe');
      assert.notEqual(views[0].hintKind, 'example');
      assert.notEqual(views[0].detailKind, 'example', 'number-specific guidance stays attached to an actual move');
    }
  }
  assert.equal(tutorial.actions.length, 5);
});

test('welcome settings are independent of replay and ignore the old one-move completion', () => {
  const { MathDuelTutorial: tutorial } = makeContext();
  const values = new Map([['mathDuelTutorial_v1', 'completed']]);
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(tutorial.shouldOffer(tutorial.readPreferences(storage)), true);
  tutorial.writePreferences(storage, { dontShow: true, completed: false });
  assert.equal(tutorial.shouldOffer(tutorial.readPreferences(storage)), false);
  tutorial.writePreferences(storage, { dontShow: false, completed: true });
  assert.equal(tutorial.shouldOffer(tutorial.readPreferences(storage)), false);
  assert.equal(tutorial.actions.length, 5, 'manual replay remains available regardless of preferences');
  values.set(tutorial.STORAGE_KEY, '{bad');
  assert.equal(tutorial.shouldOffer(tutorial.readPreferences(storage)), true);
  assert.equal(tutorial.shouldOffer(tutorial.readPreferences({ getItem() { throw new Error('blocked'); } })), true);
  assert.doesNotThrow(() => tutorial.writePreferences({ setItem() { throw new Error('blocked'); } }, {}));
});

function playAction(context, action, keep = action.keep) {
  const game = readGame(context);
  game.selections = { hand: [...action.hand], center: [...action.center], operator: action.op };
  const hand = game.blackHand.filter(card => action.hand.includes(card.id));
  const activeHand = action.side === 'BLACK' ? hand : game.whiteHand.filter(card => action.hand.includes(card.id));
  const center = game.center.filter(card => action.center.includes(card.id));
  const equation = context.MathDuelEquation.checkEquation(activeHand, action.op, center);
  assert.equal(equation.success, true);
  context.hand = activeHand; context.center = center; context.op = action.op; context.equation = equation;
  vm.runInContext('applyMoveState(hand, center, op, equation)', context);
  if (game.center.length > 2) {
    game.center = game.center.filter(card => keep.includes(card.id));
    game.discardSelections = [];
  }
  vm.runInContext('endTurn()', context);
}

function sentenceCount(text) {
  return (text.match(/[.!?。！？]/g) || []).length;
}

function assertTwoLineDialogue(tutorial, view, language) {
  const lines = [view.hint, view.detail].filter(Boolean).map(key => tutorial.text(key, language, view.values));
  assert.ok(lines.length <= 2);
  for (const line of lines) assert.ok(sentenceCount(line) <= 1, `${language} line exceeds one sentence: ${line}`);
  if (lines.some(line => /\d/.test(line))) {
    assert.ok(view.focus?.length, `numbered guidance must accompany a live action target: ${lines.join(' ')}`);
  }
}

test('keeps each storyboard beat to two sentences and guides the real five-move arithmetic', () => {
  const context = makeContext();
  const tutorial = context.MathDuelTutorial;
  const game = readGame(context);
  const views = tutorial.definition.steps.flatMap(step => Object.values(step.checkpoints).flat());

  for (let index = 0; index < tutorial.actions.length; index += 1) {
    const action = tutorial.actions[index];
    if (action.side === 'WHITE') {
      views.push(tutorial.getGuidance(index, { game }));
      game.state = 'ANIMATING';
      views.push(tutorial.getGuidance(index, { game }));
      game.state = 'PLAYING';
    } else {
      game.selections = { hand: [], center: [], operator: null };
      views.push(tutorial.getGuidance(index, { game }));
      game.selections.hand = [action.hand[0]];
      views.push(tutorial.getGuidance(index, { game }));
      game.selections.hand = [...action.hand];
      views.push(tutorial.getGuidance(index, { game }));
      game.selections.operator = action.op;
      views.push(tutorial.getGuidance(index, { game }));
      game.selections.center = [...action.center];
      views.push(tutorial.getGuidance(index, { game }));

      if (index === 2) assert.match(tutorial.text('fourDetail', 'zh'), /57 − 36 = 21/);
      if (index === 4) {
        const beforeWhite = { ...game, selections: { hand: ['b2', 'b4', 'b9'], center: [], operator: null } };
        const addWhite = tutorial.getGuidance(index, { game: beforeWhite });
        views.push(addWhite);
        assert.equal(addWhite.hint, 'practiceAddWhite');
        assert.deepEqual(Array.from(addWhite.focus[0].cardIds), ['w9']);
        assert.match(tutorial.text(addWhite.detail, 'zh'), /白 9 翻面為 6，和黑 9 組成 96/);
        assert.match(tutorial.text('flipDetail', 'zh'), /白 4 \+ 白 5 = 9/);
        assert.match(tutorial.text('practiceTargetDetail', 'zh'), /96 ÷ 24 = 4/);
      }
    }
    if (index < tutorial.actions.length - 1) playAction(context, action);
  }

  for (const language of ['zh', 'en']) {
    for (const view of views) assertTwoLineDialogue(tutorial, view, language);
  }

  const finalAction = tutorial.actions[4];
  const finalCards = finalAction.hand.map(id => game.blackHand.find(card => card.id === id));
  game.state = 'DISCARDING';
  game.center = finalCards;
  game.discardSelections = ['b2', 'b4'];
  const flexibleKeep = tutorial.getGuidance(4, { game });
  assert.equal(flexibleKeep.hint, 'keepReady', 'any two real center cards are valid in the final practice');
  for (const language of ['zh', 'en']) assertTwoLineDialogue(tutorial, flexibleKeep, language);
});

test('accepts another winning division and any two real retention cards in final practice', () => {
  for (const ids of [['b2', 'b4', 'b9'], ['b2', 'b4', 'b9', 'w9']]) {
    const context = makeContext();
    const tutorial = context.MathDuelTutorial;
    tutorial.actions.slice(0, 4).forEach(action => playAction(context, action));
    const game = readGame(context);
    game.selections = { hand: ids, center: ['w4'], operator: '/' };
    assert.equal(tutorial.matchesTask(4, game), true);
    assert.equal(tutorial.getGuidance(4, { game }).hint, 'ready');
    assert.equal(tutorial.getGuidance(4, { game, help: true }).hint, 'ready', 'help must not reject an alternate winning answer');
    const finalAction = { side: 'BLACK', hand: ids, center: ['w4'], op: '/', keep: ['b2', 'b4'] };
    const retainedGame = { ...game, center: ids.map(id => game.blackHand.find(card => card.id === id)), discardSelections: ['b2', 'b4'] };
    assert.equal(tutorial.matchesTask(4, retainedGame, 'keep'), true);
    assert.equal(tutorial.matchesTask(4, { ...retainedGame, discardSelections: ['b2', 'not-a-card'] }, 'keep'), false);
    playAction(context, finalAction);
    assert.equal(game.state, 'GAMEOVER');
    assert.equal(game.winner, 'BLACK');
    assert.ok(game.blackHand.every(card => card.color === 'w'));
    assert.equal(vm.runInContext('gameSession.action', context), 5);
  }
});

test('final practice still requires legal division and trading all remaining black cards', () => {
  const context = makeContext();
  const tutorial = context.MathDuelTutorial;
  tutorial.actions.slice(0, 4).forEach(action => playAction(context, action));
  const game = readGame(context);
  game.selections = { hand: ['b4', 'w1'], center: ['w4'], operator: '/' };
  assert.equal(context.MathDuelEquation.checkEquation(game.blackHand.filter(card => game.selections.hand.includes(card.id)), '/', game.center.filter(card => game.selections.center.includes(card.id))).success, true);
  assert.equal(tutorial.matchesTask(4, game), false, 'a legal equation that leaves black cards is not the lesson goal');
  const retry = tutorial.getGuidance(4, { game, rejected: true });
  assert.equal(retry.hint, 'division', 'retry should reinforce the goal, not reveal the reference answer');
  assert.equal(retry.detail, 'wrongFive');
  assert.doesNotMatch(tutorial.text(retry.detail, 'zh'), /黑 [0-9]/);
  assert.equal(retry.focus[0].area, 'hand-area');
  game.selections = { hand: ['b2', 'b4', 'b9', 'unknown'], center: ['w4'], operator: '/' };
  assert.equal(tutorial.matchesTask(4, game), false);
  game.selections = { hand: ['b2', 'b4', 'b9', 'b9'], center: ['w4'], operator: '/' };
  assert.equal(tutorial.matchesTask(4, game), false);
  game.selections = { hand: ['b2', 'b4', 'b9'], center: ['w4'], operator: '+' };
  assert.equal(tutorial.matchesTask(4, game), false);
});

test('explains selection limits and room for missing black cards without changing the game', () => {
  const context = makeContext();
  const tutorial = context.MathDuelTutorial;
  tutorial.actions.slice(0, 4).forEach(action => playAction(context, action));
  const game = readGame(context);
  game.selections = { hand: ['b2', 'w1', 'w2', 'w9'], center: ['w4'], operator: '/' };
  const before = JSON.stringify(game);
  assert.equal(tutorial.getGuidance(4, { game }).detail, 'practiceMakeRoom');
  assert.equal(tutorial.getGuidance(4, { game }).focus[0].area, 'equation-hand');
  const makeRoom = tutorial.getGuidance(4, { game });
  assert.deepEqual(Array.from(makeRoom.focus[0].cardIds), ['w1', 'w2', 'w9']);
  assert.equal(tutorial.text(makeRoom.detail, 'zh'), '點出牌區已選白牌，取消一張。');
  assert.equal(tutorial.getGuidance(4, { game, notice: 'hand' }).detail, 'handLimit');
  const correction = tutorial.getGuidance(4, { game, notice: 'hand' });
  assert.equal(correction.hint, 'undoHand');
  assert.equal(correction.focus[0].area, 'equation-hand');
  assert.deepEqual(Array.from(correction.focus[0].cardIds), ['w1', 'w2', 'w9']);
  assert.match(tutorial.text(correction.hint, 'zh', correction.values), /再點出牌區的白 1、白 2、白 9/);
  assert.equal(JSON.stringify(game), before);
});

test('keeps the highlighted card and instruction aligned after partial selections and limit errors', () => {
  const { MathDuelTutorial: tutorial } = makeContext();
  const game = readGame(makeContext());
  game.selections.hand = ['b1'];
  const handCue = tutorial.getGuidance(0, { game });
  assert.deepEqual(Array.from(handCue.focus[0].cardIds), ['b8']);
  assert.equal(tutorial.text(handCue.hint, 'zh', handCue.values), '請從手牌選黑 8。');

  game.selections = { hand: ['b1', 'b8'], center: [], operator: '+' };
  const resultCue = tutorial.getGuidance(0, { game });
  assert.deepEqual(Array.from(resultCue.focus[0].cardIds), ['w9']);
  assert.equal(tutorial.text(resultCue.hint, 'zh', resultCue.values), '選場牌白 9作為結果。');

  game.selections = { hand: ['b1', 'b8', 'b2', 'b3'], center: [], operator: null };
  const handLimit = tutorial.getGuidance(0, { game, notice: 'hand' });
  assert.equal(handLimit.hint, 'undoHand');
  assert.equal(handLimit.detail, 'handLimit');
  assert.equal(handLimit.focus[0].area, 'equation-hand');
  assert.deepEqual(Array.from(handLimit.focus[0].cardIds), ['b2', 'b3']);

  game.selections.center = ['w9'];
  const targetLimit = tutorial.getGuidance(0, { game, notice: 'target' });
  assert.equal(targetLimit.hint, 'undoTarget');
  assert.equal(targetLimit.detail, 'targetLimit');
  assert.equal(targetLimit.focus[0].area, 'equation-target');
  assert.deepEqual(Array.from(targetLimit.focus[0].cardIds), ['w9']);
});
