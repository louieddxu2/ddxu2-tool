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
  assert.equal(context.MathDuelTutorial.getGuidance(0, { game }).hint, 'taskOne');
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
  assert.equal(tutorial.getGuidance(4, { game }).detail, null);
  assert.equal(tutorial.getGuidance(4, { game, help: true }).hint, 'divisionHelp');
  game.state = 'DISCARDING';
  assert.equal(tutorial.getGuidance(4, { game }).hint, 'keepFive');
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
