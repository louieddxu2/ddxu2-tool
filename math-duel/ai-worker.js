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
function evaluateState(state, aiColor, isAiTurnEnd) {
  const oppColor = aiColor === 'w' ? 'b' : 'w';

  // AI 側 (在 Worker 內部固定為 whiteHand)
  const aiHand = state.whiteHand;
  const aiHandOwnCount = aiHand.filter(c => c.color === aiColor).length;
  
  // 玩家側 (在 Worker 內部固定為 blackHand)
  const oppHand = state.blackHand;
  const oppHandOwnCount = oppHand.filter(c => c.color === oppColor).length;

  // 檢查勝負條件
  const aiWins = aiHand.length > 0 && aiHandOwnCount === 0;
  const oppWins = oppHand.length > 0 && oppHandOwnCount === 0;

  if (aiWins) return 9999999;
  if (oppWins) return -9999999;

  // 必敗條件判斷 (手牌少於2張絕對無法發動攻擊)
  // 如果是 AI 剛下完，但 AI 沒贏且手牌少於 2 張 -> 輪回 AI 時一定死
  if (isAiTurnEnd && aiHand.length < 2) return -9000000;
  // 如果是對手剛下完，對手沒贏且手牌少於 2 張 -> 輪回對手時一定死
  if (!isAiTurnEnd && oppHand.length < 2) return 9000000;

  let score = 0;
  // AI 自己的利益 (強烈要求減少自己顏色的牌)
  score -= (aiHandOwnCount * 1000);
  
  // 打擊對手利益 (讓對手自己顏色的牌越多越好)
  score += (oppHandOwnCount * 800);
  
  const centerDiff = evaluateCenterDifficulty(state.centerCards);
  if (isAiTurnEnd) score += centerDiff * 2; // 留給對手的難題
  else score -= centerDiff * 2; // 對手留給我的難題

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
            // 隨機打亂 discard 的選擇，避免前段全都是同一算式
            keepCombos.sort(() => 0.5 - Math.random());
            // 限制同一算式最多加入 2 種 discarding 結果，精簡樹狀結構
            keepCombos = keepCombos.slice(0, 2);
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

// --- 蒙地卡羅樹搜尋 (MCTS) 相關函數 ---

// 快速隨機產生一個合法步 (用於模擬，避免生成全部步數導致卡頓)
function getRandomValidMove(activeHand, centerCards, maxAttempts = 20) {
  const ops = ['+', '-', '*', '/'];
  for (let i = 0; i < maxAttempts; i++) {
    // 隨機選 2-4 張手牌
    const hCount = Math.floor(Math.random() * 3) + 2; 
    if (hCount > activeHand.length) continue;
    
    let shuffledHand = [...activeHand].sort(() => 0.5 - Math.random());
    let hCombo = shuffledHand.slice(0, hCount);

    // 隨機選 1-2 張場中牌
    const cCount = Math.floor(Math.random() * 2) + 1;
    if (cCount > centerCards.length) continue;

    let shuffledCenter = [...centerCards].sort(() => 0.5 - Math.random());
    let cCombo = shuffledCenter.slice(0, cCount);

    const op = ops[Math.floor(Math.random() * ops.length)];

    const result = checkEquation(hCombo, op, cCombo);
    if (result.success) {
       let tempCenter = centerCards.filter(c => !cCombo.includes(c)).concat(hCombo);
       let discard = [];
       if (tempCenter.length > 2) {
         let shuffledTemp = [...tempCenter].sort(() => 0.5 - Math.random());
         discard = shuffledTemp.slice(0, 2);
       }
       return { hand: hCombo, center: cCombo, op: op, discard: discard, eq: result.eq, cardsA: result.cardsA, cardsB: result.cardsB };
    }
  }
  return null; // 嘗試多次找不到就算放棄
}

// 模擬單局遊戲到底
function simulatePlayout(state, isWhiteTurn, aiColor, maxDepth = 12) {
  let currentState = state;
  let currentTurn = isWhiteTurn; // true = AI turn, false = Player turn
  const oppColor = aiColor === 'w' ? 'b' : 'w';

  for (let d = 0; d < maxDepth; d++) {
    const aiHand = currentState.whiteHand;
    const oppHand = currentState.blackHand;
    
    const aiOwnCount = aiHand.filter(c => c.color === aiColor).length;
    const oppOwnCount = oppHand.filter(c => c.color === oppColor).length;

    // 檢查勝負條件
    if (aiHand.length > 0 && aiOwnCount === 0) return 1.0; // AI 獲勝
    if (oppHand.length > 0 && oppOwnCount === 0) return 0.0; // 玩家獲勝

    // 必敗檢查
    if (currentTurn && aiHand.length < 2) return 0.0; 
    if (!currentTurn && oppHand.length < 2) return 1.0; 

    const activeHand = currentTurn ? aiHand : oppHand;
    let randomMove = getRandomValidMove(activeHand, currentState.centerCards, 25);

    // 若隨機嘗試失敗，再退向全面生成
    if (!randomMove) {
      const allMoves = generateValidMoves(activeHand, currentState.centerCards);
      if (allMoves.length === 0) return currentTurn ? 0.0 : 1.0;
      randomMove = allMoves[Math.floor(Math.random() * allMoves.length)];
    }

    currentState = applyMove(currentState, randomMove, currentTurn);
    currentTurn = !currentTurn; 
  }

  // 若模擬達到最大深度未分勝負，則估算剩餘優勢 (自身原顏色越少越好)
  const finalAiOwn = currentState.whiteHand.filter(c => c.color === aiColor).length;
  const finalOppOwn = currentState.blackHand.filter(c => c.color === oppColor).length;
  
  if (finalAiOwn < finalOppOwn) return 0.8;
  if (finalAiOwn > finalOppOwn) return 0.2;
  return 0.5;
}

// 時間預算型蒙地卡羅搜尋
function timeBudgetedMCTS(initialState, validMoves, aiColor, timeBudgetMs = 1500) {
  const endTime = Date.now() + timeBudgetMs;
  let stats = validMoves.map(m => ({ move: m, wins: 0, plays: 0 }));

  // 秒殺首輪檢查
  for (let s of stats) {
    let childState = applyMove(initialState, s.move, true);
    const aiOwnCount = childState.whiteHand.filter(c => c.color === aiColor).length;
    if (childState.whiteHand.length > 0 && aiOwnCount === 0) {
      return s.move; 
    }
  }

  // 打亂順序，避免如果時間提早結束，始終只有前幾個被測到
  stats.sort(() => 0.5 - Math.random());

  let passes = 0;
  while (Date.now() < endTime) {
    for (let i = 0; i < stats.length; i++) {
        if (Date.now() >= endTime) break;
        let childState = applyMove(initialState, stats[i].move, true);
        let score = simulatePlayout(childState, false, aiColor);
        stats[i].wins += score;
        stats[i].plays++;
    }
    passes++;
  }

  let bestMove = null;
  let bestWinRate = -1;
  
  for (let s of stats) {
    if (s.plays === 0) continue;
    let winRate = s.wins / s.plays;
    winRate += Math.random() * 0.001; // 微量雜訊避免平局固化
    
    if (winRate > bestWinRate) {
      bestWinRate = winRate;
      bestMove = s.move;
    }
  }
  return bestMove || stats[0].move;
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

  if (moves.length === 0) return self.postMessage(null);

  if (isHard) {
    // 困難模式：使用 MCTS (時間預算 1.5 秒)
    bestMove = timeBudgetedMCTS(initialState, moves, aiColor, 1500);
  } else {
    // 普通模式：也用 MCTS，但時間極短、思考粗糙 (或純隨機)
    bestMove = timeBudgetedMCTS(initialState, moves, aiColor, 100); 
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
