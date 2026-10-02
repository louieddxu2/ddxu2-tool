(function attachFlowGuide(global) {
  'use strict';

  // A guide observes application events. It never performs the application's work.
  function createGuideState(definition) {
    return { stepIndex: 0, status: definition.steps.length ? 'active' : 'completed', checkpoint: null, seenEventIds: [] };
  }

  function getView(state, definition, snapshot) {
    if (state.status !== 'active') return null;
    const step = definition.steps[state.stepIndex];
    if (state.checkpoint) return step.checkpoints[state.checkpoint.key][state.checkpoint.index];
    return step.view ? step.view(snapshot) : definition.view?.(state, snapshot) || null;
  }

  function advanceGuide(previous, definition, event, snapshot) {
    const state = { ...previous, checkpoint: previous.checkpoint ? { ...previous.checkpoint } : null, seenEventIds: [...previous.seenEventIds] };
    const effects = [];
    const result = () => ({ state, view: getView(state, definition, snapshot), effects });
    if (state.status !== 'active') return result();
    if (event.id && state.seenEventIds.includes(event.id)) return result();
    if (event.id) state.seenEventIds.push(event.id);

    const release = proceed => {
      if (state.checkpoint) effects.push({ type: 'release', key: state.checkpoint.key, proceed });
      state.checkpoint = null;
    };
    if (event.type === 'skip' || event.type === 'cancel') {
      release(event.type === 'skip');
      state.status = event.type === 'skip' ? 'skipped' : 'cancelled';
      return result();
    }

    const step = definition.steps[state.stepIndex];
    if (event.type === 'checkpoint' && !state.checkpoint) {
      if (step.checkpoints?.[event.key]?.length) {
        state.checkpoint = { key: event.key, index: 0 };
        effects.push({ type: 'hold', key: event.key });
      }
    } else if (event.type === 'continue' && state.checkpoint) {
      const explanations = step.checkpoints[state.checkpoint.key];
      if (state.checkpoint.index + 1 < explanations.length) state.checkpoint.index += 1;
      else release(true);
    } else if (event.type === 'back' && state.checkpoint) {
      state.checkpoint.index = Math.max(0, state.checkpoint.index - 1);
    } else if (!state.checkpoint && step.complete?.(event, snapshot)) {
      state.stepIndex += 1;
      if (state.stepIndex === definition.steps.length) state.status = 'completed';
    }
    return result();
  }

  global.FlowGuide = Object.freeze({ createGuideState, advanceGuide });
})(typeof window !== 'undefined' ? window : globalThis);
