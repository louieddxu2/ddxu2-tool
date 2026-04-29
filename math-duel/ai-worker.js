// --- 數學與邏輯核心工具 ---
function getPermutations(arr) {
  if (arr.length <= 1) return [arr];
  let result = [];
  for (let i = 0; i < arr.length; i++) {
    let current = arr[i];
    let remaining = arr.slice(0, i).concat(arr.slice(i + 1));
    for (let perm of getPermutations(remaining)) result.push([current].concat(perm));
  }
  return result;
}

function getValues(cards) {
  if (cards.length === 1) return (cards[0].val === 6 || cards[0].val === 9) ? [6, 9] : [cards[0].val];
  if (cards.length === 2) {
    let v1_opts = (cards[0].val === 6 || cards[0].val === 9) ? [6, 9] : [cards[0].val];
    let v2_opts = (cards[1].val === 6 || cards[1].val === 9) ? [6, 9] : [cards[1].val];
    let vals = [];
    for (let v1 of v1_opts) for (let v2 of v2_opts) vals.push(v1 * 10 + v2);
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
  let targets = [];
  const targetPerms = getPermutations(targetCards);
  for (let p of targetPerms) targets = targets.concat(getValues(p));

  const perms = getPermutations(handCards);
  for (let p of perms) {
    let splits = [];
    if (p.length === 2) splits.push({A: [p[0]], B: [p[1]]});
    if (p.length === 3) { splits.push({A: [p[0]], B: [p[1], p[2]]}); splits.push({A: [p[0], p[1]], B: [p[2]]}); }
    if (p.length === 4) { splits.push({A: [p[0], p[1]], B: [p[2], p[3]]}); }
    
    for (let split of splits) {
      let valsA = getValues(split.A);
      let valsB = getValues(split.B);
      for (let a of valsA) {
        for (let b of valsB) {
          if (op === '+' && targets.includes(a + b)) return true;
          if (op === '-' && targets.includes(a - b)) return true;
          if (op === '*' && targets.includes(a * b)) return true;
          if (op === '/' && targets.includes(a / b)) return true;
        }
      }
    }
  }
  return false;
}

function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  for (let i = 5; i * i <= num; i += 6) if (num % i === 0 || num % (i + 2) === 0) return false;
  return true;
}

function evaluateCenterDifficulty(cards) {
  let targets = [];
  const targetPerms = getPermutations(cards);
  for (let p of targetPerms) targets = targets.concat(getValues(p));
  
  let score = 0;
  for (let v of targets) {
    if (isPrime(v)) score += (v > 20) ? 50 : 30;
    else {
      let divisors = 0;
      for(let i=1; i<=Math.min(v, 20); i++) if(v % i === 0) divisors++;
      if (divisors > 4) score -= 20;
    }
  }
  return score / (targets.length || 1);
}

// --- 盤面狀態評估 ---
// AI 扮演白方，目標是手牌全變黑；黑方玩家目標是手牌全變白
function evaluateState(state) {
  const whiteHandBlacks = state.whiteHand.filter(c => c.color === 'b').length;
  const whiteHandWhites = state.whiteHand.filter(c => c.color === 'w').length;
  const blackHandWhites = state.blackHand.filter(c => c.color === 'w').length;
  const blackHandBlacks = state.blackHand.filter(c => c.color === 'b').length;

  // 檢查勝負條件
  if (state.whiteHand.length > 0 && whiteHandWhites === 0) return 999999; // AI 贏了
  if (state.blackHand.length > 0 && blackHandBlacks === 0) return -999999; // 玩家贏了

  let score = 0;
  // AI 自己的利益 (手牌黑多白少)
  score += (whiteHandBlacks * 30) - (whiteHandWhites * 40);
  
  // 打擊對手利益 (減少對方手牌的白牌)
  score -= (blackHandWhites * 30);
  
  score += evaluateCenterDifficulty(state.centerCards);
  return score;
}

// 產生所有合法步數
function generateValidMoves(activeHand, centerCards) {
  const ops = ['+', '-', '*', '/'];
  let moves = [];
  let handCombos = [];
  for(let i=2; i<=4; i++) handCombos = handCombos.concat(getCombinations(activeHand, i));
  let centerCombos = [];
  for(let i=1; i<=2; i++) centerCombos = centerCombos.concat(getCombinations(centerCards, i));

  for (let hCombo of handCombos) {
    for (let cCombo of centerCombos) {
      for (let op of ops) {
        if (checkEquation(hCombo, op, cCombo)) {
          let tempCenter = centerCards.filter(c => !cCombo.includes(c)).concat(hCombo);
          if (tempCenter.length > 2) {
            let keepCombos = getCombinations(tempCenter, 2);
            for (let keep of keepCombos) {
              moves.push({ hand: hCombo, center: cCombo, op: op, discard: keep });
            }
          } else {
            moves.push({ hand: hCombo, center: cCombo, op: op, discard: [] });
          }
        }
      }
    }
  }
  return moves;
}

// 模擬盤面推演
function applyMove(state, move, isWhiteTurn) {
  let newState = {
    whiteHand: [...state.whiteHand],
    blackHand: [...state.blackHand],
    centerCards: move.discard.length > 0 ? move.discard : state.centerCards.filter(c => !move.center.includes(c)).concat(move.hand)
  };

  if (isWhiteTurn) {
    newState.whiteHand = newState.whiteHand.filter(c => !move.hand.includes(c)).concat(move.center);
  } else {
    newState.blackHand = newState.blackHand.filter(c => !move.hand.includes(c)).concat(move.center);
  }
  return newState;
}

// --- Minimax 演算法大腦 ---
// --- Minimax 演算法大腦 (升級 Beam Search 剪枝) ---
function minimax(state, depth, alpha, beta, isMaximizing) {
  if (depth === 0) return evaluateState(state);
  const evalScore = evaluateState(state);
  if (Math.abs(evalScore) > 900000) return evalScore; 

  const activeHand = isMaximizing ? state.whiteHand : state.blackHand;
  let moves = generateValidMoves(activeHand, state.centerCards);

  // 如果無牌可出，對手獲勝
  if (moves.length === 0) return isMaximizing ? -999999 : 999999;

  // 🌟 核心進化：啟發式排序與剪枝 (Beam Search)
  // 當推演深度還很深時，不要每一步都算，先「憑直覺打分數」，只保留最強的 4 條路線！
  if (depth > 1) {
    moves.forEach(m => {
      let childState = applyMove(state, m, isMaximizing);
      m.heuristic = evaluateState(childState);
    });
    
    if (isMaximizing) {
      moves.sort((a, b) => b.heuristic - a.heuristic); // 對 AI 最好
    } else {
      moves.sort((a, b) => a.heuristic - b.heuristic); // 對玩家最好
    }
    // 🔪 殘酷剪枝：只保留前 4 名，把運算量從 27,000 暴降到不到 500！
    moves = moves.slice(0, 4); 
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let move of moves) {
      let childState = applyMove(state, move, true);
      let ev = minimax(childState, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break; // Alpha-Beta 剪枝
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let move of moves) {
      let childState = applyMove(state, move, false);
      let ev = minimax(childState, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break; // Alpha-Beta 剪枝
    }
    return minEval;
  }
}

self.onmessage = function(e) {
  const { difficulty, whiteHand, blackHand, centerCards } = e.data;
  const isHard = difficulty === 'hard';
  
  // 恢復深度 3！因為有了 Beam Search，現在它算得動了！
  const depth = isHard ? 3 : 1; 
  const initialState = { whiteHand, blackHand, centerCards };
  const moves = generateValidMoves(whiteHand, centerCards);

  let bestMove = null;
  let bestScore = -Infinity;

  for (let move of moves) {
    let childState = applyMove(initialState, move, true);
    
    // 秒殺判定
    const whiteHandWhites = childState.whiteHand.filter(c => c.color === 'w').length;
    if (childState.whiteHand.length > 0 && whiteHandWhites === 0) {
      bestMove = move;
      break;
    }

    let score = minimax(childState, depth - 1, -Infinity, Infinity, false);
    score += Math.random() * 0.1; // 隨機擾動

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  if (bestMove) {
    self.postMessage({
      hand: bestMove.hand.map(c => c.id),
      center: bestMove.center.map(c => c.id),
      op: bestMove.op,
      discard: bestMove.discard.length > 0 ? bestMove.discard.map(c => c.id) : []
    });
  } else {
    self.postMessage(null); 
  }
};
