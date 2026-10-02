(function attachGuideSpotlight(global) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  let serial = 0;

  // A passive presenter: it measures live elements, never clones or moves them.
  function create({ document: doc = global.document } = {}) {
    const win = doc.defaultView;
    const maskId = `guide-spotlight-mask-${++serial}`;
    const make = (tag, attributes = {}) => {
      const element = doc.createElementNS(SVG_NS, tag);
      Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
      return element;
    };
    const root = doc.createElement('div');
    root.className = 'guide-spotlight';
    root.setAttribute('aria-hidden', 'true');
    root.hidden = true;
    const svg = make('svg');
    const definitions = make('defs');
    const mask = make('mask', { id: maskId, x: 0, y: 0, maskUnits: 'userSpaceOnUse', 'mask-type': 'luminance' });
    const background = make('rect', { fill: 'white' });
    const holes = make('g', { fill: 'black' });
    const shade = make('rect', { class: 'guide-spotlight-shade', mask: `url(#${maskId})` });
    const rings = make('g', { class: 'guide-spotlight-rings' });
    const pointer = make('g', { class: 'guide-spotlight-pointer' });
    mask.append(background, holes);
    definitions.append(mask);
    svg.append(definitions, shade, rings, pointer);
    root.append(svg);
    doc.body.append(root);

    let frame = null;
    let destroyed = false;
    let current = null;
    const bounds = element => {
      if (!element?.isConnected || !element.getClientRects().length) return null;
      const style = win.getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') return null;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 ? rect : null;
    };
    const box = (rect, padding, width, height) => {
      const x = Math.max(1, rect.left - padding);
      const y = Math.max(1, rect.top - padding);
      return { x, y, width: Math.max(0, Math.min(width - 1, rect.right + padding) - x), height: Math.max(0, Math.min(height - 1, rect.bottom + padding) - y), rx: 9 };
    };
    const intersects = (a, b) => a.x < b.right && a.x + a.size > b.left && a.y < b.bottom && a.y + a.size > b.top;

    function measure() {
      frame = null;
      if (!current || destroyed) return;
      const width = doc.documentElement.clientWidth;
      const height = win.innerHeight;
      const targetEntries = [...new Set(current.targets || [])]
        .map(element => ({ element, rect: bounds(element) })).filter(entry => entry.rect);
      const targets = targetEntries.map(entry => entry.rect);
      const hint = bounds(current.hint);
      const action = bounds(current.action);
      const context = (current.context || []).map(bounds).filter(Boolean);
      if (!targets.length || !hint) { root.hidden = true; return; }
      root.hidden = false;
      root.dataset.mode = current.mode || 'tap';
      root.dataset.targetCount = String(targets.length);
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      for (const element of [mask, background, shade]) {
        element.setAttribute('width', width);
        element.setAttribute('height', height);
      }
      const cardTarget = element => element.matches?.('[data-card-id]') === true;
      const holeBoxes = [
        { rect: hint, padding: 5 },
        ...targetEntries.map(({ element, rect }) => ({ rect, padding: cardTarget(element) ? 1 : 5 })),
        ...context.map(rect => ({ rect, padding: 5 })),
        ...(action ? [{ rect: action, padding: 5 }] : [])
      ];
      holes.replaceChildren(...holeBoxes.map(({ rect, padding }) => make('rect', box(rect, padding, width, height))));
      rings.replaceChildren(...targetEntries.map(({ element, rect }) => {
        const isCard = cardTarget(element);
        return make('rect', {
          ...box(rect, isCard ? 0 : 4, width, height),
          class: `guide-spotlight-ring${isCard ? ' guide-spotlight-card-ring' : ''}`
        });
      }));
      if (action) rings.append(make('rect', { ...box(action, 4, width, height), class: 'guide-spotlight-action-ring' }));

      pointer.replaceChildren();
      const avoid = (current.avoid || []).map(bounds).filter(Boolean);
      function appendPointer(target, mode, kind) {
        const size = 24;
        const cx = target.left + target.width / 2;
        const cy = target.top + target.height / 2;
        const candidates = [
          { x: cx - size / 2, y: target.top - size - 7, rotate: 180 },
          { x: cx - size / 2, y: target.bottom + 7, rotate: 0 },
          { x: target.left - size - 7, y: cy - size / 2, rotate: 90 },
          { x: target.right + 7, y: cy - size / 2, rotate: -90 }
        ];
        const obstacles = [hint, ...targets.filter(rect => rect !== target), ...context, ...avoid, ...(action && action !== target ? [action] : [])];
        // A side cue stays in the control row, so it cannot look like a tap on the hand below.
        const ordered = kind === 'action' ? [candidates[2], candidates[3], candidates[0], candidates[1]] : candidates;
        const placement = ordered.find(item => item.x >= 4 && item.y >= 4 && item.x + size <= width - 4 && item.y + size <= height - 4 && !obstacles.some(rect => intersects({ ...item, size: size + 4, x: item.x - 2, y: item.y - 2 }, rect)));
        if (!placement) return;
        const group = make('g', { 'data-cue': kind, transform: `translate(${placement.x} ${placement.y}) rotate(${placement.rotate} 12 12)` });
        group.append(make('rect', { x: -2, y: -2, width: 28, height: 28, rx: 14, class: 'guide-pointer-disc' }));
        const cue = make('g', { class: 'guide-pointer-cue', 'data-mode': mode });
        cue.append(mode === 'observe'
          ? make('path', { d: 'M12 3v17M6 9l6-6 6 6', class: 'guide-observe-arrow' })
          : make('path', { d: 'M9 12V4a2 2 0 0 1 4 0v6l2-1 2 2 2 1v5c0 3-2 5-5 5h-3c-2 0-3-1-4-3l-3-5a2 2 0 0 1 3-2l2 2', class: 'guide-tap-hand' }));
        group.append(cue);
        pointer.append(group);
      }
      // Keep the observation arrow on the lesson subject; point a hand at the real next action.
      appendPointer(targets[0], current.mode || 'tap', 'focus');
      if (action) appendPointer(action, 'tap', 'action');
    }

    function schedule() {
      if (current && frame === null && !destroyed) frame = win.requestAnimationFrame(measure);
    }
    const observer = win.ResizeObserver ? new win.ResizeObserver(schedule) : null;
    win.addEventListener('resize', schedule);
    win.addEventListener('scroll', schedule, true);
    win.visualViewport?.addEventListener('resize', schedule);
    win.visualViewport?.addEventListener('scroll', schedule);

    function clear() {
      current = null;
      if (frame !== null) win.cancelAnimationFrame(frame);
      frame = null;
      observer?.disconnect();
      root.hidden = true;
      holes.replaceChildren();
      rings.replaceChildren();
      pointer.replaceChildren();
    }

    return Object.freeze({
      update(options) {
        if (destroyed) return;
        current = options;
        observer?.disconnect();
        [...new Set([options.hint, options.action, ...(options.targets || []), ...(options.context || [])])].filter(Boolean).forEach(element => observer?.observe(element));
        schedule();
      },
      clear,
      destroy() {
        clear();
        destroyed = true;
        root.remove();
        win.removeEventListener('resize', schedule);
        win.removeEventListener('scroll', schedule, true);
        win.visualViewport?.removeEventListener('resize', schedule);
        win.visualViewport?.removeEventListener('scroll', schedule);
      }
    });
  }

  global.GuideSpotlight = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
