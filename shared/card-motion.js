(function attachCardMotion(global) {
  'use strict';

  /*
   * Generic card animation adapter.
   *
   * CardMotion.playExchange({
   *   moves: [{ id: 'card-1' }, { id: 'card-2' }],
   *   commit: () => renderNextGameState()
   * });
   *
   * The commit callback owns game state. This module only measures card
   * positions, renders temporary ghosts, animates the exchange, and applies
   * FLIP to cards that shift because a zone changed size.
   */

  const DEFAULTS = {
    duration: 420,
    stagger: 55,
    easing: 'cubic-bezier(0.22, 0.8, 0.28, 1)',
    layerId: 'card-motion-layer'
  };

  function isReducedMotion(doc) {
    return Boolean(doc.defaultView && doc.defaultView.matchMedia && doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function getCardId(element) {
    return element && element.dataset ? element.dataset.cardId : null;
  }

  function findCard(id, doc) {
    const wanted = String(id);
    return Array.from(doc.querySelectorAll('[data-card-id]')).find((element) => getCardId(element) === wanted) || null;
  }

  function getRect(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2
    };
  }

  function rectsByCard(doc) {
    const rects = new Map();
    doc.querySelectorAll('[data-card-id]').forEach((element) => {
      const id = getCardId(element);
      const rect = getRect(element);
      if (id && rect) rects.set(id, rect);
    });
    return rects;
  }

  function getDefaultExitPoint(rect, doc) {
    const viewportWidth = doc.documentElement.clientWidth || 320;
    return {
      left: Math.max(viewportWidth + 90, rect.right + 90),
      top: rect.top - 24
    };
  }

  function ensureLayer(doc, id) {
    let layer = doc.getElementById(id);
    if (layer) return layer;

    layer = doc.createElement('div');
    layer.id = id;
    layer.setAttribute('aria-hidden', 'true');
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      overflow: 'visible',
      pointerEvents: 'none',
      zIndex: '100'
    });
    doc.body.appendChild(layer);
    return layer;
  }

  function cloneForMotion(element, rect, layer) {
    const clone = element.cloneNode(true);
    clone.removeAttribute('onclick');
    clone.setAttribute('aria-hidden', 'true');
    clone.classList.remove('card-pop');
    Object.assign(clone.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: '0',
      zIndex: '2',
      pointerEvents: 'none',
      animation: 'none',
      transition: 'none',
      transformOrigin: 'center center',
      willChange: 'transform, opacity'
    });
    layer.appendChild(clone);
    return clone;
  }

  function nextFrame(doc) {
    return new Promise((resolve) => {
      const raf = doc.defaultView && doc.defaultView.requestAnimationFrame;
      if (raf) raf(() => raf(resolve));
      else setTimeout(resolve, 32);
    });
  }

  function animateGhost(doc, ghost, from, to, options, index) {
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const rotation = Math.max(-5, Math.min(5, dx / 80));
    const delay = index * options.stagger;

    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve();
      };

      const start = () => {
        ghost.style.transition = `transform ${options.duration}ms ${options.easing}, opacity ${Math.max(160, options.duration - 80)}ms ease-out`;
        ghost.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(0deg)`;
        ghost.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, options.duration + 100);
      };

      ghost.style.transform = `translate3d(0, 0, 0) rotate(${rotation}deg)`;
      if (delay) setTimeout(start, delay);
      else {
        const raf = doc.defaultView && doc.defaultView.requestAnimationFrame;
        if (raf) raf(start);
        else setTimeout(start, 16);
      }
    });
  }

  function animateExit(doc, ghost, from, to, options, index) {
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const delay = index * options.stagger;

    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve();
      };

      const start = () => {
        ghost.style.transition = `transform ${options.duration}ms ${options.easing}, opacity ${Math.max(160, options.duration - 80)}ms ease-in`;
        ghost.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(18deg) scale(0.7)`;
        ghost.style.opacity = '0';
        ghost.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, options.duration + 100);
      };

      if (delay) setTimeout(start, delay);
      else {
        const raf = doc.defaultView && doc.defaultView.requestAnimationFrame;
        if (raf) raf(start);
        else setTimeout(start, 16);
      }
    });
  }

  function applyLayoutFlip(beforeRects, afterRects, movedIds, doc, options) {
    const animated = [];
    afterRects.forEach((after, id) => {
      if (movedIds.has(id)) return;
      const before = beforeRects.get(id);
      const element = findCard(id, doc);
      if (!before || !element) return;

      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      const previous = {
        element,
        transform: element.style.transform,
        transition: element.style.transition
      };
      element.style.transition = 'none';
      element.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      animated.push(previous);
    });

    if (!animated.length) return Promise.resolve();

    return nextFrame(doc).then(() => new Promise((resolve) => {
      animated.forEach(({ element }) => {
        element.style.transition = `transform ${options.duration}ms ${options.easing}`;
        element.style.transform = '';
      });
      setTimeout(() => {
        animated.forEach(({ element, transform, transition }) => {
          element.style.transform = transform;
          element.style.transition = transition;
        });
        resolve();
      }, options.duration + 100);
    }));
  }

  async function playMoves({ moves = [], commit, find = findCard, getExitPoint, options: rawOptions = {}, onStart, onComplete, document: providedDocument } = {}) {
    const doc = providedDocument || global.document;
    if (!doc || typeof commit !== 'function') throw new Error('CardMotion.playMoves requires a document and commit callback.');

    const options = { ...DEFAULTS, ...rawOptions };
    const normalizedMoves = moves.map((move) => ({ ...move, id: String(move.id) }));
    const beforeRects = rectsByCard(doc);
    const sourceClones = new Map();
    const movedIds = new Set(normalizedMoves.map((move) => move.id));
    const reduced = isReducedMotion(doc);

    normalizedMoves.forEach((move) => {
      const element = find(move.id, doc);
      const rect = beforeRects.get(move.id) || getRect(element);
      if (element && rect) {
        sourceClones.set(move.id, { element, rect });
      }
    });

    if (typeof onStart === 'function') onStart();
    await commit();

    if (reduced || !sourceClones.size) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    await nextFrame(doc);
    const afterRects = rectsByCard(doc);
    const layer = ensureLayer(doc, options.layerId);
    const ghosts = [];

    normalizedMoves.forEach((move) => {
      const source = sourceClones.get(move.id);
      if (!source) return;

      const currentTarget = move.exit ? null : find(move.id, doc);
      const target = currentTarget ? getRect(currentTarget) : null;
      const exitPoint = move.exit && typeof getExitPoint === 'function'
        ? getExitPoint(source.rect, move, doc)
        : move.exit ? getDefaultExitPoint(source.rect, doc) : null;
      const destination = target || exitPoint;
      if (!destination) return;

      const ghost = cloneForMotion(source.element, source.rect, layer);
      ghosts.push({ ghost, source, target: currentTarget, move, destination });
      if (currentTarget) currentTarget.style.visibility = 'hidden';
    });

    const layoutPromise = applyLayoutFlip(beforeRects, afterRects, movedIds, doc, options);
    const motionPromise = Promise.all(ghosts.map(({ ghost, source, target, move, destination }, index) => {
      return move && move.exit
        ? animateExit(doc, ghost, source.rect, destination, options, index)
        : animateGhost(doc, ghost, source.rect, destination, options, index);
    }));

    await Promise.all([layoutPromise, motionPromise]);
    ghosts.forEach(({ ghost, target }) => {
      if (target) target.style.visibility = '';
      ghost.remove();
    });
    if (typeof onComplete === 'function') onComplete();
  }

  function playExchange(config = {}) {
    return playMoves(config);
  }

  function playRemoval({ ids = [], ...config } = {}) {
    return playMoves({
      ...config,
      moves: ids.map((id) => ({ id, exit: true }))
    });
  }

  global.CardMotion = Object.freeze({
    findCard,
    getRect,
    playMoves,
    playExchange,
    playRemoval,
    prefersReducedMotion: isReducedMotion
  });
})(window);
