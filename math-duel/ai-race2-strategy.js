(function attachRace2AiStrategy(global) {
  function countOwnColorCards(hand, ownColor) {
    let count = 0;
    for (const c of hand) if (c.color === ownColor) count++;
    return count;
  }

  function isColorMatchPoint(hand, ownColor) {
    if (!hand || hand.length === 0) return false;
    const targetColor = ownColor === 'w' ? 'b' : 'w';
    for (const c of hand) if (c.color !== targetColor) return false;
    return true;
  }

  function scoreSafetyLine(aiHandLen, oppHandLen) {
    const diff = aiHandLen - oppHandLen;
    if (diff >= -1) return 0;
    return -2500 - ((-1 - diff) * 1200);
  }

  function scoreRace2Move(ctx, move) {
    const {
      initialState,
      applyMove,
      aiColor,
      scores,
      winScore
    } = ctx;

    const child = applyMove(initialState, move, true);
    const aiSide = aiColor === 'w' ? 'WHITE' : 'BLACK';
    const oppSide = aiSide === 'WHITE' ? 'BLACK' : 'WHITE';
    const aiHandLen = child.whiteHand.length;
    const oppHandLen = child.blackHand.length;
    const oppColor = aiColor === 'w' ? 'b' : 'w';

    let score = 0;
    const cardsSpent = move.hand.length;
    const centerTaken = move.center.length;
    const netCardDelta = centerTaken - cardsSpent;

    // Prefer efficient exchanges in race-to-2.
    score += netCardDelta * 520;
    score += scoreSafetyLine(aiHandLen, oppHandLen);

    // Progress in color conversion remains useful.
    const aiOwnAfter = countOwnColorCards(child.whiteHand, aiColor);
    const oppOwnAfter = countOwnColorCards(child.blackHand, oppColor);
    score += (oppOwnAfter - aiOwnAfter) * 220;

    const aiGetsPoint = isColorMatchPoint(child.whiteHand, aiColor);
    const oppThreatReady = isColorMatchPoint(child.blackHand, oppColor);
    const aiOnMatchPoint = (scores[aiSide] || 0) >= (winScore - 1);
    const oppOnMatchPoint = (scores[oppSide] || 0) >= (winScore - 1);

    if (aiGetsPoint) {
      score += aiOnMatchPoint ? 2_000_000 : 35_000;
    }

    if (oppThreatReady) {
      score -= oppOnMatchPoint ? 1_200_000 : 20_000;
    }

    // When opponent is close to win, safety line becomes stricter.
    if (oppOnMatchPoint && aiHandLen < (oppHandLen - 1)) {
      score -= 80_000;
    }

    // Hard guardrail: avoid crossing safety line unless this move is effectively a win.
    if (aiHandLen < (oppHandLen - 1) && !aiGetsPoint) {
      score -= 250_000;
    }

    return score;
  }

  function pickMove(ctx) {
    const { moves } = ctx;
    if (!moves || moves.length === 0) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const move of moves) {
      const score = scoreRace2Move(ctx, move);
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best || moves[0];
  }

  global.Race2AiStrategy = { pickMove };
})(self);
