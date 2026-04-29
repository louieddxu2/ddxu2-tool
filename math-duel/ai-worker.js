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
  let targetVals = [];
  const targetPerms = getPermutations(targetCards);
  for (let p of targetPerms) targetVals = targetVals.concat(getValues(p));

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
// AI 的目標是讓自己的手牌全變成「對手的顏色」
function evaluateState(state, aiColor) {
  const oppColor = aiColor === 'w' ? 'b' : 'w';

  // AI 側 (在 Worker 內部固定為 whiteHand)
  const aiHandOppCount = state.whiteHand.filter(c => c.color === oppColor).length;
  const aiHandOwnCount = state.whiteHand.filter(c => c.color === aiColor).length;
  
  // 玩家側 (在 Worker 內部固定為 blackHand)
  const oppHandAiCount = state.blackHand.filter(c => c.color === aiColor).length;
  const oppHandOwnCount = state.blackHand.filter(c => c.color === oppColor).length;

  // 檢查勝負條件
  if (state.whiteHand.length > 0 && aiHandOwnCount === 0) return 999999; // AI 贏了
  if (state.blackHand.length > 0 && oppHandOwnCount === 0) return -999999; // 玩家贏了

  let score = 0;
  // AI 自己的利益 (目標顏色的牌越多越好，起始顏色的牌越少越好)
  score += (aiHandOppCount * 30) - (aiHandOwnCount * 40);
  
  // 打擊對手利益 (減少對方手中屬於 AI 顏色的牌)
  score -= (oppHandAiCount * 30);
  
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
        const result = checkEquation(hCombo, op, cCombo);
        if (result.success) {
          let tempCenter = centerCards.filter(c => !cCombo.includes(c)).concat(hCombo);
          if (tempCenter.length > 2) {
            let keepCombos = getCombinations(tempCenter, 2);
            for (let keep of keepCombos) {
              moves.push({ hand: hCombo, center: cCombo, op: op, discard: keep, eq: result.eq, cardsA: result.cardsA, cardsB: result.cardsB });
            }
          } else {
            moves.push({ hand: hCombo, center: cCombo, op: op, discard: [], eq: result.eq, cardsA: result.cardsA, cardsB: result.cardsB });
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

// --- Minimax 演算法大腦 (升級 Beam Search 剪枝) ---
function minimax(state, depth, alpha, beta, isMaximizing, aiColor) {
  const evalScore = evaluateState(state, aiColor);
  if (depth === 0 || Math.abs(evalScore) > 900000) return evalScore; 

  const activeHand = isMaximizing ? state.whiteHand : state.blackHand;
  let moves = generateValidMoves(activeHand, state.centerCards);

  if (moves.length === 0) return isMaximizing ? -999999 : 999999;

  if (depth > 1) {
    moves.forEach(m => {
      let childState = applyMove(state, m, isMaximizing);
      m.heuristic = evaluateState(childState, aiColor);
    });
    if (isMaximizing) moves.sort((a, b) => b.heuristic - a.heuristic);
    else moves.sort((a, b) => a.heuristic - b.heuristic);
    moves = moves.slice(0, 4); 
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let move of moves) {
      let childState = applyMove(state, move, true);
      let ev = minimax(childState, depth - 1, alpha, beta, false, aiColor);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let move of moves) {
      let childState = applyMove(state, move, false);
      let ev = minimax(childState, depth - 1, alpha, beta, true, aiColor);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

self.onmessage = function(e) {
  const { difficulty, aiHand, opponentHand, centerCards } = e.data;
  if (!aiHand || aiHand.length === 0) return self.postMessage(null);

  // 取得 AI 目前的顏色與對手顏色
  const aiColor = aiHand[0].color;
  
  // 在 Worker 內部，whiteHand 統一代表「發起計算的 AI」，blackHand 代表「對手」
  const whiteHand = aiHand;
  const blackHand = opponentHand;
  const isHard = difficulty === 'hard';
  const depth = isHard ? 3 : 1; 
  const initialState = { whiteHand, blackHand, centerCards };
  const moves = generateValidMoves(whiteHand, centerCards);

  let bestMove = null;
  let bestScore = -Infinity;

  if (moves.length === 0) return self.postMessage(null);

  for (let move of moves) {
    let childState = applyMove(initialState, move, true);
    
    // 秒殺判定：如果這次行動能讓 AI 手上的起始色牌清零
    const ownColorCardsCount = childState.whiteHand.filter(c => c.color === aiColor).length;
    if (childState.whiteHand.length > 0 && ownColorCardsCount === 0) {
      bestMove = move;
      break;
    }

    let score = minimax(childState, depth - 1, -Infinity, Infinity, false, aiColor);
    score += Math.random() * 0.1; 

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
      discard: bestMove.discard.length > 0 ? bestMove.discard.map(c => c.id) : [],
      eq: bestMove.eq,
      cardsA: bestMove.cardsA,
      cardsB: bestMove.cardsB
    });
  } else {
    self.postMessage(null); 
  }
};
