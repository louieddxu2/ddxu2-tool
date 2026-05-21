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

  function cloneState(state) {
    return {
      whiteHand: [...state.whiteHand],
      blackHand: [...state.blackHand],
      centerCards: [...state.centerCards]
    };
  }

  function applyPassState(state) {
    return cloneState(state);
  }

  function scoreRace2Move(ctx, move) {
    const {
      initialState,
      applyMove,
      aiColor,
      scores,
      winScore,
      isPass
    } = ctx;

    const child = isPass ? applyPassState(initialState) : applyMove(initialState, move, true);
    const aiSide = aiColor === 'w' ? 'WHITE' : 'BLACK';
    const oppSide = aiSide === 'WHITE' ? 'BLACK' : 'WHITE';
    const aiHandLen = child.whiteHand.length;
    const oppHandLen = child.blackHand.length;
    const oppColor = aiColor === 'w' ? 'b' : 'w';

    let score = 0;
    const cardsSpent = isPass ? 0 : move.hand.length;
    const centerTaken = isPass ? 0 : move.center.length;
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

    if (isPass) {
      // Passing gives opponent +1 immediately; heavy penalty, and catastrophic at match point.
      score -= oppOnMatchPoint ? 2_500_000 : 320_000;
    } else if (aiGetsPoint) {
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

  function evaluateOpponentReply(ctx, afterState) {
    const {
      generateValidMoves,
      applyMove,
      aiColor,
      scores,
      winScore
    } = ctx;

    const oppMoves = generateValidMoves(afterState.blackHand, afterState.centerCards, 8);
    if (oppMoves.length === 0) return 0;

    let maxRiskForAi = -Infinity;
    for (const oppMove of oppMoves) {
      const oppChild = applyMove(afterState, oppMove, false);
      const aiOwn = countOwnColorCards(oppChild.whiteHand, aiColor);
      const oppColor = aiColor === 'w' ? 'b' : 'w';
      const oppOwn = countOwnColorCards(oppChild.blackHand, oppColor);
      let risk = (aiOwn - oppOwn) * 180;

      // Opponent can score at end of their turn.
      const oppScoresPoint = isColorMatchPoint(oppChild.blackHand, oppColor);
      const oppSide = aiColor === 'w' ? 'BLACK' : 'WHITE';
      const oppOnMatchPoint = (scores[oppSide] || 0) >= (winScore - 1);
      if (oppScoresPoint) risk += oppOnMatchPoint ? 1_800_000 : 120_000;

      if (risk > maxRiskForAi) maxRiskForAi = risk;
    }
    return maxRiskForAi === -Infinity ? 0 : maxRiskForAi;
  }

  function pickMove(ctx) {
    const { moves, initialState, applyMove, aiColor, generateValidMoves, deadlineMs } = ctx;
    if (!moves || moves.length === 0) return null;

    const candidates = moves.map(m => ({ move: m, isPass: false }));
    // Include PASS as a first-class tactical branch in race2.
    candidates.push({ move: null, isPass: true });

    // Pre-calculate fast scoreNow for sorting so that the most promising moves are evaluated first.
    const scoredCandidates = candidates.map(c => {
      const scoreNow = scoreRace2Move({ ...ctx, isPass: c.isPass }, c.move);
      return { ...c, scoreNow };
    }).sort((a, b) => b.scoreNow - a.scoreNow);

    let best = null;
    let bestScore = -Infinity;
    for (const c of scoredCandidates) {
      if (deadlineMs && performance.now() >= deadlineMs) {
        break;
      }
      const scoreNow = c.scoreNow;
      const afterState = c.isPass ? applyPassState(initialState) : applyMove(initialState, c.move, true);
      const replyPenalty = evaluateOpponentReply({ ...ctx, generateValidMoves }, afterState);
      const score = scoreNow - replyPenalty;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    // Returning null means "pass / no move" for existing caller contract.
    // If no candidate was evaluated due to early timeout, fallback to moves[0].
    if (!best) return moves[0] || null;
    return best.isPass ? null : best.move;
  }

  global.Race2AiStrategy = { pickMove };
})(self);
