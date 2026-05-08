function getPermutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const perm of getPermutations(remaining)) result.push([current].concat(perm));
  }
  return result;
}

function getValues(cards) {
  if (cards.length === 1) return (cards[0].val === 6 || cards[0].val === 9) ? [6, 9] : [cards[0].val];
  if (cards.length === 2) {
    const v1Opts = (cards[0].val === 6 || cards[0].val === 9) ? [6, 9] : [cards[0].val];
    const v2Opts = (cards[1].val === 6 || cards[1].val === 9) ? [6, 9] : [cards[1].val];
    const vals = [];
    for (const v1 of v1Opts) for (const v2 of v2Opts) vals.push(v1 * 10 + v2);
    return vals;
  }
  return [];
}

function getCombinations(arr, size) {
  if (size === 0) return [[]];
  if (arr.length === 0) return [];
  const first = arr[0];
  const rest = arr.slice(1);
  return getCombinations(rest, size - 1).map(c => [first, ...c]).concat(getCombinations(rest, size));
}

function checkEquation(handCards, op, targetCards) {
  let targetVals = [];
  const targetPerms = getPermutations(targetCards);
  for (const p of targetPerms) targetVals = targetVals.concat(getValues(p));

  const perms = getPermutations(handCards);
  for (const p of perms) {
    const splits = [];
    if (p.length === 2) splits.push({ A: [p[0]], B: [p[1]] });
    if (p.length === 3) {
      splits.push({ A: [p[0]], B: [p[1], p[2]] });
      splits.push({ A: [p[0], p[1]], B: [p[2]] });
    }
    if (p.length === 4) splits.push({ A: [p[0], p[1]], B: [p[2], p[3]] });

    for (const split of splits) {
      const valsA = getValues(split.A);
      const valsB = getValues(split.B);
      for (const a of valsA) {
        for (const b of valsB) {
          let res;
          if (op === '+') res = a + b;
          else if (op === '-') res = a - b;
          else if (op === '*') res = a * b;
          else if (op === '/') res = a / b;

          if (targetVals.includes(res)) {
            const opChar = op === '*' ? '×' : (op === '/' ? '÷' : op);
            return { success: true, eq: `${a} ${opChar} ${b} = ${res}`, cardsA: split.A, cardsB: split.B };
          }
        }
      }
    }
  }
  return { success: false };
}

function normalizeState(state) {
  return {
    whiteHand: [...state.whiteHand],
    blackHand: [...state.blackHand],
    centerCards: [...state.centerCards]
  };
}

function applyMove(state, move, isWhiteTurn) {
  const newState = {
    whiteHand: [...state.whiteHand],
    blackHand: [...state.blackHand],
    centerCards: move.discard.length > 0
      ? move.discard
      : state.centerCards.filter(c => !move.center.includes(c)).concat(move.hand)
  };

  if (isWhiteTurn) {
    newState.whiteHand = newState.whiteHand.filter(c => !move.hand.includes(c)).concat(move.center);
  } else {
    newState.blackHand = newState.blackHand.filter(c => !move.hand.includes(c)).concat(move.center);
  }
  return newState;
}

function gameResult(state, aiColor) {
  const oppColor = aiColor === 'w' ? 'b' : 'w';
  const aiOwn = state.whiteHand.filter(c => c.color === aiColor).length;
  const oppOwn = state.blackHand.filter(c => c.color === oppColor).length;

  if (state.whiteHand.length > 0 && aiOwn === 0) return 1;
  if (state.blackHand.length > 0 && oppOwn === 0) return -1;
  if (state.whiteHand.length < 2) return -1;
  if (state.blackHand.length < 2) return 1;
  return 0;
}

function evaluateState(state, aiColor) {
  const result = gameResult(state, aiColor);
  if (result === 1) return 10000000;
  if (result === -1) return -10000000;

  const oppColor = aiColor === 'w' ? 'b' : 'w';
  const aiOwn = state.whiteHand.filter(c => c.color === aiColor).length;
  const oppOwn = state.blackHand.filter(c => c.color === oppColor).length;

  let score = 0;
  score += (oppOwn - aiOwn) * 1200;
  // Cheap center pressure heuristic: higher center sum tends to reduce easy equations.
  const centerPressure = state.centerCards.reduce((sum, c) => sum + c.val, 0);
  score += centerPressure * 25;
  score += (state.blackHand.length - state.whiteHand.length) * 40;
  return score;
}

function generateValidMoves(activeHand, centerCards, keepCap = Infinity) {
  const ops = ['+', '-', '*', '/'];
  const moves = [];
  let handCombos = [];
  for (let i = 2; i <= 4; i++) handCombos = handCombos.concat(getCombinations(activeHand, i));
  let centerCombos = [];
  for (let i = 1; i <= 2; i++) centerCombos = centerCombos.concat(getCombinations(centerCards, i));

  for (const hCombo of handCombos) {
    for (const cCombo of centerCombos) {
      for (const op of ops) {
        const result = checkEquation(hCombo, op, cCombo);
        if (!result.success) continue;

        const tempCenter = centerCards.filter(c => !cCombo.includes(c)).concat(hCombo);
        if (tempCenter.length > 2) {
          let keepCombos = getCombinations(tempCenter, 2);
          keepCombos = keepCombos
            .map(keep => ({ keep, score: scoreKeepCombo(keep) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, keepCap)
            .map(x => x.keep);

          for (const keep of keepCombos) {
            moves.push({ hand: hCombo, center: cCombo, op, discard: keep, eq: result.eq, cardsA: result.cardsA, cardsB: result.cardsB });
          }
        } else {
          moves.push({ hand: hCombo, center: cCombo, op, discard: [], eq: result.eq, cardsA: result.cardsA, cardsB: result.cardsB });
        }
      }
    }
  }
  return moves;
}

function scoreKeepCombo(keep) {
  return keep[0].val + keep[1].val;
}

function hashState(state, isAiTurn) {
  const pack = cards => cards.map(c => `${c.id}:${c.color}:${c.val}`).sort().join('|');
  return `${isAiTurn ? 'A' : 'O'}#${pack(state.whiteHand)}#${pack(state.blackHand)}#${pack(state.centerCards)}`;
}

function moveOrderingScore(state, move, aiColor, isAiTurn) {
  const child = applyMove(state, move, isAiTurn);
  const immediate = gameResult(child, aiColor);
  if (immediate === 1) return 10_000_000;

  let score = 0;
  const childEval = evaluateState(child, aiColor);
  score += childEval * 0.02;
  score += (move.center.length * 60);
  score -= (move.hand.length * 20);
  return score;
}

function pickEasyMove(initialState, aiColor, moves) {
  let best = null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const child = applyMove(initialState, move, true);
    const score = evaluateState(child, aiColor) + Math.random() * 30;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best || moves[Math.floor(Math.random() * moves.length)];
}

function alphaBetaRoot(initialState, aiColor, baseMoves, deadlineMs) {
  const transTable = new Map();
  let bestMove = null;
  let completedDepth = 0;

  const orderedRootMoves = [...baseMoves].sort((a, b) =>
    moveOrderingScore(initialState, b, aiColor, true) - moveOrderingScore(initialState, a, aiColor, true)
  );

  for (let depth = 1; depth <= 6; depth++) {
    if (performance.now() >= deadlineMs) break;

    let localBest = null;
    let localBestScore = -Infinity;
    let alpha = -Infinity;
    let beta = Infinity;
    let finishedDepth = true;

    for (const move of orderedRootMoves) {
      if (performance.now() >= deadlineMs) {
        finishedDepth = false;
        break;
      }

      const child = applyMove(initialState, move, true);
      const score = alphaBeta(child, depth - 1, alpha, beta, false, aiColor, deadlineMs, transTable);
      if (score > localBestScore) {
        localBestScore = score;
        localBest = move;
      }
      if (score > alpha) alpha = score;
    }

    if (finishedDepth && localBest) {
      bestMove = localBest;
      completedDepth = depth;
      orderedRootMoves.sort((a, b) => {
        const sa = a === localBest ? 1 : 0;
        const sb = b === localBest ? 1 : 0;
        return sb - sa;
      });
    } else {
      break;
    }
  }

  return { bestMove: bestMove || orderedRootMoves[0] || null, completedDepth };
}

function alphaBeta(state, depth, alpha, beta, isAiTurn, aiColor, deadlineMs, transTable) {
  if (performance.now() >= deadlineMs) return evaluateState(state, aiColor);

  const result = gameResult(state, aiColor);
  if (result === 1) return 9_000_000 + depth;
  if (result === -1) return -9_000_000 - depth;
  if (depth === 0) return evaluateState(state, aiColor);

  const key = `${depth}:${hashState(state, isAiTurn)}`;
  if (transTable.has(key)) return transTable.get(key);

  const activeHand = isAiTurn ? state.whiteHand : state.blackHand;
  const moves = generateValidMoves(activeHand, state.centerCards, 8);

  if (moves.length === 0) {
    const noMoveScore = isAiTurn ? -8_000_000 : 8_000_000;
    transTable.set(key, noMoveScore);
    return noMoveScore;
  }

  moves.sort((a, b) => moveOrderingScore(state, b, aiColor, isAiTurn) - moveOrderingScore(state, a, aiColor, isAiTurn));

  let best;
  if (isAiTurn) {
    best = -Infinity;
    for (const move of moves) {
      const child = applyMove(state, move, true);
      const score = alphaBeta(child, depth - 1, alpha, beta, false, aiColor, deadlineMs, transTable);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (beta <= alpha) break;
      if (performance.now() >= deadlineMs) break;
    }
  } else {
    best = Infinity;
    for (const move of moves) {
      const child = applyMove(state, move, false);
      const score = alphaBeta(child, depth - 1, alpha, beta, true, aiColor, deadlineMs, transTable);
      if (score < best) best = score;
      if (score < beta) beta = score;
      if (beta <= alpha) break;
      if (performance.now() >= deadlineMs) break;
    }
  }

  transTable.set(key, best);
  return best;
}

self.onmessage = function(e) {
  const { difficulty, aiHand, opponentHand, centerCards } = e.data;
  if (!aiHand || aiHand.length === 0) return self.postMessage(null);

  const aiColor = aiHand[0].color;
  const whiteHand = aiHand;
  const blackHand = opponentHand;
  const isHard = difficulty === 'hard';
  const initialState = normalizeState({ whiteHand, blackHand, centerCards });

  const moves = generateValidMoves(initialState.whiteHand, initialState.centerCards, isHard ? 10 : 4);
  if (moves.length === 0) return self.postMessage(null);

  let bestMove;

  if (isHard) {
    const start = performance.now();
    const hardBudgetMs = 4300;
    const deadline = start + hardBudgetMs;

    for (const move of moves) {
      const child = applyMove(initialState, move, true);
      if (gameResult(child, aiColor) === 1) {
        bestMove = move;
        break;
      }
    }

    if (!bestMove) {
      const searchResult = alphaBetaRoot(initialState, aiColor, moves, deadline);
      bestMove = searchResult.bestMove;
    }
  } else {
    bestMove = pickEasyMove(initialState, aiColor, moves);
  }

  if (!bestMove) return self.postMessage(null);

  self.postMessage({
    hand: bestMove.hand.map(c => c.id),
    center: bestMove.center.map(c => c.id),
    op: bestMove.op,
    discard: bestMove.discard.length > 0 ? bestMove.discard.map(c => c.id) : [],
    eq: bestMove.eq,
    cardsA: bestMove.cardsA,
    cardsB: bestMove.cardsB
  });
};
