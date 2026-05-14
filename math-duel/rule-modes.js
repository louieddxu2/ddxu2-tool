(function attachRuleModes(global) {
  const RULE_MODE = {
    CLASSIC: 'CLASSIC',
    RACE2: 'RACE2'
  };

  function ensureRuleState(game) {
    if (!game.ruleMode) game.ruleMode = RULE_MODE.CLASSIC;
    if (game.ruleMode === RULE_MODE.RACE2) {
      if (!game.scores) game.scores = { BLACK: 0, WHITE: 0 };
      if (!game.winScore) game.winScore = 2;
    } else {
      delete game.scores;
      delete game.winScore;
    }
    return game;
  }

  function initRuleState(game, ruleMode) {
    game.ruleMode = ruleMode || RULE_MODE.CLASSIC;
    return ensureRuleState(game);
  }

  function isRace2(game) {
    return game.ruleMode === RULE_MODE.RACE2;
  }

  function getOpponent(turn) {
    return turn === 'BLACK' ? 'WHITE' : 'BLACK';
  }

  function scorePoint(game, player) {
    if (!isRace2(game)) return false;
    game.scores[player] += 1;
    if (game.scores[player] >= game.winScore) {
      game.winner = player;
      game.state = 'GAMEOVER';
      return true;
    }
    return false;
  }

  function applyPassPoint(game) {
    if (!isRace2(game) || game.state !== 'PLAYING') return false;
    return scorePoint(game, getOpponent(game.turn));
  }

  function applyColorMatchPoint(game, turnJustEnded) {
    if (!isRace2(game)) return false;
    const hand = turnJustEnded === 'BLACK' ? game.blackHand : game.whiteHand;
    const targetColor = turnJustEnded === 'BLACK' ? 'w' : 'b';
    if (hand.length > 0 && hand.every(c => c.color === targetColor)) {
      return scorePoint(game, turnJustEnded);
    }
    return false;
  }

  global.MathDuelRuleModes = {
    RULE_MODE,
    ensureRuleState,
    initRuleState,
    isRace2,
    applyPassPoint,
    applyColorMatchPoint
  };
})(window);
