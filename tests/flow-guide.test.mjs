import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = {};
context.self = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../shared/flow-guide.js', import.meta.url), 'utf8'), context);
const { createGuideState, advanceGuide } = context.FlowGuide;
const definition = {
  steps: [
    { view: snapshot => ({ ready: snapshot.ready }), checkpoints: { review: [{ hint: 'first' }, { hint: 'second' }] }, complete: event => event.type === 'committed' },
    { view: () => ({ hint: 'next' }), complete: event => event.type === 'finished' }
  ]
};

test('observes snapshots without changing application or previous guide state', () => {
  const state = createGuideState(definition);
  Object.freeze(state.seenEventIds);
  Object.freeze(state);
  const snapshot = Object.freeze({ ready: true, nested: Object.freeze({ value: 2 }) });
  const result = advanceGuide(state, definition, { id: 'view', type: 'selection.changed' }, snapshot);
  assert.equal(result.view.ready, true);
  assert.equal(result.effects.length, 0);
  assert.equal(state.seenEventIds.length, 0);
  assert.equal(snapshot.nested.value, 2);
});

test('holds a checkpoint through all explanations, then releases only once', () => {
  let { state, effects } = advanceGuide(createGuideState(definition), definition, { id: 'hold', type: 'checkpoint', key: 'review' }, {});
  assert.equal(effects[0].type, 'hold');
  const ignored = advanceGuide(state, definition, { id: 'early', type: 'committed' }, {});
  assert.equal(ignored.state.stepIndex, 0);
  const first = advanceGuide(state, definition, { id: 'continue-1', type: 'continue' }, {});
  assert.equal(first.view.hint, 'second');
  assert.equal(first.effects.length, 0);
  const last = advanceGuide(first.state, definition, { id: 'continue-2', type: 'continue' }, {});
  assert.equal(last.state.checkpoint, null);
  assert.equal(last.effects[0].type, 'release');
  assert.equal(last.effects[0].proceed, true);
  assert.equal(advanceGuide(last.state, definition, { id: 'continue-3', type: 'continue' }, {}).effects.length, 0);
});

test('deduplicates completed actions and finishes only after the last step', () => {
  const event = { id: 'action-1', type: 'committed' };
  const first = advanceGuide(createGuideState(definition), definition, event, {});
  assert.equal(first.state.stepIndex, 1);
  assert.equal(advanceGuide(first.state, definition, event, {}).state.stepIndex, 1);
  const last = advanceGuide(first.state, definition, { id: 'action-2', type: 'finished' }, {});
  assert.equal(last.state.status, 'completed');
  assert.equal(last.view, null);
});

test('revisits only the current explanation without releasing or undoing application work', () => {
  const snapshot = Object.freeze({ ready: true });
  const held = advanceGuide(createGuideState(definition), definition, { type: 'checkpoint', key: 'review' }, snapshot);
  const second = advanceGuide(held.state, definition, { type: 'continue' }, snapshot);
  const back = advanceGuide(second.state, definition, { type: 'back' }, snapshot);
  assert.equal(back.view.hint, 'first');
  assert.equal(back.state.stepIndex, 0);
  assert.equal(back.effects.length, 0);
  assert.equal(second.state.checkpoint.index, 1, 'the previous guide state must not be mutated');
  const boundary = advanceGuide(back.state, definition, { type: 'back' }, snapshot);
  assert.equal(boundary.state.checkpoint.index, 0);
  const last = advanceGuide(advanceGuide(back.state, definition, { type: 'continue' }, snapshot).state, definition, { type: 'continue' }, snapshot);
  assert.equal(last.effects[0].type, 'release');
  const afterRelease = advanceGuide(last.state, definition, { type: 'back' }, snapshot);
  assert.equal(afterRelease.state.checkpoint, null, 'back must never cross an already committed checkpoint');
  assert.equal(afterRelease.effects.length, 0);
});

for (const [type, proceed] of [['skip', true], ['cancel', false]]) {
  test(`${type} releases a held operation with proceed=${proceed} and rejects later events`, () => {
    const held = advanceGuide(createGuideState(definition), definition, { type: 'checkpoint', key: 'review' }, {});
    const ended = advanceGuide(held.state, definition, { id: 'end', type }, {});
    assert.equal(ended.effects[0].proceed, proceed);
    assert.equal(ended.view, null);
    assert.equal(advanceGuide(ended.state, definition, { type: 'continue' }, {}).effects.length, 0);
  });
}
