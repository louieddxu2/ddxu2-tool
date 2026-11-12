// Math Duel strong engine (CLASSIC rules). Bitboard states + lazily memoised equation table built from the
// game's own MathDuelEquation.checkEquation, so rules stay in one place.
// cards: index 0..8 = b1..b9, 9..17 = w1..w9
(function (root) {
  'use strict';
  const BLACKC = 0x1FF, WHITEC = 0x1FF << 9, MATE = 1000000;
  const POW3 = [1, 3, 9, 27, 81, 243, 729, 2187, 6561];
  const OPS = ['+', '-', '*', '/'];
  const popcnt = (x) => { x -= (x >> 1) & 0x55555555; x = (x & 0x33333333) + ((x >> 2) & 0x33333333); return (((x + (x >> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };
  const cardObj = (i) => ({ id: (i < 9 ? 'b' : 'w') + (i % 9 + 1), val: i % 9 + 1, color: i < 9 ? 'b' : 'w' });
  const CARDS = Array.from({ length: 18 }, (_, i) => cardObj(i));

  function create(checkEquation) {
    const tid = new Int16Array(19683).fill(-1); let tidCount = 0;
    const table = new Int8Array(19683 * 54); // 0 unknown, 1 valid, 2 invalid
    function maskCards(m) { const out = []; while (m) { const b = m & -m; out.push(CARDS[31 - Math.clz32(b)]); m ^= b; } return out; }
    function isValid(hk, tk, h, t) {
      let id = tid[tk]; if (id < 0) { id = tid[tk] = tidCount++; }
      const idx = hk * 54 + id; let v = table[idx];
      if (v === 0) { const hc = maskCards(h), tc = maskCards(t); v = 2; for (const op of OPS) if (checkEquation(hc, op, tc).success) { v = 1; break; } table[idx] = v; }
      return v === 1;
    }
    // per-ply move buffers
    const MAXPLY = 40, BUF = [];
    for (let i = 0; i < MAXPLY; i++) BUF.push({ h: new Int32Array(6000), t: new Int32Array(6000), k: new Int32Array(6000), s: new Int32Array(6000), o: new Int32Array(6000) });
    const idxH = new Int32Array(18), keyH = new Int32Array(18), idxC = new Int32Array(4), tM = new Int32Array(3), tK = new Int32Array(3);
    // enumerate (hand subset, target subset); cb collects. withKeeps: expand centre keep choices.
    function gen(H, C, own, buf, withKeeps) {
      let n = 0, nh = 0, nc = 0, nt = 0;
      for (let m = H; m;) { const b = m & -m; const i = 31 - Math.clz32(b); idxH[nh] = b; keyH[nh++] = POW3[i % 9]; m ^= b; }
      if (nh < 2) return 0;
      for (let m = C; m;) { const b = m & -m; idxC[nc++] = b; m ^= b; }
      for (let i = 0; i < nc; i++) { tM[nt] = idxC[i]; tK[nt++] = POW3[(31 - Math.clz32(idxC[i])) % 9]; }
      if (nc === 2) { tM[nt] = idxC[0] | idxC[1]; tK[nt++] = tK[0] + tK[1]; }
      const bh = buf.h, bt = buf.t, bk = buf.k;
      const emit = (h, hk) => {
        for (let ti = 0; ti < nt; ti++) {
          const t = tM[ti]; if (!isValid(hk, tK[ti], h, t)) continue;
          const tc = (C & ~t) | h;
          if (!withKeeps || popcnt(tc) <= 2) { bh[n] = h; bt[n] = t; bk[n++] = tc; continue; }
          if ((((H & ~h) | t) & own) === 0) { bh[n] = h; bt[n] = t; bk[n++] = tc & -tc | (tc ^ (tc & -tc)) & -(tc ^ (tc & -tc)); continue; } // winning move: keep choice irrelevant
          for (let a = tc; a;) { const x = a & -a; a ^= x; for (let b2 = a; b2;) { const y = b2 & -b2; b2 ^= y; bh[n] = h; bt[n] = t; bk[n++] = x | y; } }
        }
      };
      for (let a = 0; a < nh; a++) for (let b = a + 1; b < nh; b++) {
        const h2 = idxH[a] | idxH[b], k2 = keyH[a] + keyH[b]; emit(h2, k2);
        for (let c = b + 1; c < nh; c++) { const h3 = h2 | idxH[c], k3 = k2 + keyH[c]; emit(h3, k3);
          for (let d = c + 1; d < nh; d++) emit(h3 | idxH[d], k3 + keyH[d]); }
      }
      return n;
    }
    // TT
    const TTBITS = 20, TTSIZE = 1 << TTBITS, TTMASK = TTSIZE - 1;
    const ttA = new Int32Array(TTSIZE), ttB = new Int32Array(TTSIZE), ttC = new Int32Array(TTSIZE), ttScore = new Int32Array(TTSIZE), ttMeta = new Int32Array(TTSIZE), ttMh = new Int32Array(TTSIZE), ttMt = new Int32Array(TTSIZE), ttMk = new Int32Array(TTSIZE);
    let W_HAND = 100, W_COL = 30, W_MOB = 4, noiseSeed = 0, noiseAmp = 0;
    let nodes = 0, deadline = Infinity, timedOut = false;
    const TIMEOUT = {};

    function evaluate(B, W, C, turn, mobMe) { // from side-to-move's view
      const me = turn ? W : B, op = turn ? B : W, myC = turn ? WHITEC : BLACKC, opC = turn ? BLACKC : WHITEC;
      let s = W_HAND * (popcnt(me) - popcnt(op)) + W_COL * (popcnt(op & opC) - popcnt(me & myC));
      if (W_MOB) { const mobOp = gen(op, C, opC, BUF[MAXPLY - 1], false); s += W_MOB * (Math.min(mobMe, 60) - Math.min(mobOp, 60)); }
      if (noiseAmp) { let x = (B * 73856093) ^ (W * 19349663) ^ (C * 83492791) ^ noiseSeed; x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; s += ((x >>> 0) % (2 * noiseAmp + 1)) - noiseAmp; }
      return s;
    }
    function search(B, W, C, turn, depth, alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && Date.now() > deadline) { timedOut = true; throw TIMEOUT; }
      const H = turn ? W : B, own = turn ? WHITEC : BLACKC, buf = BUF[ply];
      if (depth <= 0) {
        const n0 = gen(H, C, own, buf, false);
        if (n0 === 0) return -(MATE - ply);
        for (let i = 0; i < n0; i++) if ((((H & ~buf.h[i]) | buf.t[i]) & own) === 0) return MATE - ply - 1;
        return evaluate(B, W, C, turn, n0);
      }
      const hash = (Math.imul(B, 73856093) ^ Math.imul(W, 19349663) ^ Math.imul(C, 83492791) ^ turn) & TTMASK;
      let ttH = 0, ttT = 0, ttK = 0; const alpha0 = alpha;
      if (ttA[hash] === (B | (turn << 18)) && ttB[hash] === W && ttC[hash] === C) {
        const meta = ttMeta[hash], d = meta >> 2, flag = meta & 3; let sc = ttScore[hash];
        if (sc > MATE - 1000) sc -= ply; else if (sc < -MATE + 1000) sc += ply;
        if (d >= depth) { if (flag === 0) return sc; if (flag === 1 && sc >= beta) return sc; if (flag === 2 && sc <= alpha) return sc; }
        ttH = ttMh[hash]; ttT = ttMt[hash]; ttK = ttMk[hash];
      }
      const n = gen(H, C, own, buf, true);
      if (n === 0) return -(MATE - ply);
      const bh = buf.h, bt = buf.t, bk = buf.k, bs = buf.s, bo = buf.o;
      const oppHand = turn ? B : W;
      for (let i = 0; i < n; i++) {
        const nH = (H & ~bh[i]) | bt[i];
        if ((nH & own) === 0) return MATE - ply - 1;
        let s = popcnt(nH) * 16 - popcnt(nH & own) * 4;
        if (bh[i] === ttH && bt[i] === ttT && bk[i] === ttK) s += 100000;
        bs[i] = s; bo[i] = i;
      }
      // sort indices by score desc (insertion on typed arrays is fine for a few hundred)
      const ord = Array.prototype.slice.call(bo.subarray(0, n)); ord.sort((x, y) => bs[y] - bs[x]);
      let best = -Infinity, bi = ord[0];
      for (let q = 0; q < n; q++) {
        const i = ord[q], nH = (H & ~bh[i]) | bt[i];
        const sc = turn ? -search(B, nH, bk[i], 0, depth - 1, -beta, -alpha, ply + 1) : -search(nH, W, bk[i], 1, depth - 1, -beta, -alpha, ply + 1);
        if (sc > best) { best = sc; bi = i; if (sc > alpha) { alpha = sc; if (alpha >= beta) break; } }
      }
      let st = best; if (st > MATE - 1000) st += ply; else if (st < -MATE + 1000) st -= ply;
      ttA[hash] = B | (turn << 18); ttB[hash] = W; ttC[hash] = C; ttScore[hash] = st;
      ttMeta[hash] = (depth << 2) | (best <= alpha0 ? 2 : best >= beta ? 1 : 0); ttMh[hash] = bh[bi]; ttMt[hash] = bt[bi]; ttMk[hash] = bk[bi];
      return best;
    }
    // Root: iterative deepening. opts: {timeMs, maxDepth, weights:[hand,col,mob], noiseSeed, noiseAmp}
    function choose(B, W, C, turn, opts) {
      opts = opts || {};
      if (opts.weights) { W_HAND = opts.weights[0]; W_COL = opts.weights[1]; W_MOB = opts.weights[2]; }
      noiseSeed = opts.noiseSeed | 0; noiseAmp = opts.noiseAmp | 0;
      ttA.fill(-1);
      const H = turn ? W : B, own = turn ? WHITEC : BLACKC, buf = BUF[0];
      const n = gen(H, C, own, buf, true); if (n === 0) return null;
      const rh = Array.from(buf.h.subarray(0, n)), rt = Array.from(buf.t.subarray(0, n)), rk = Array.from(buf.k.subarray(0, n));
      for (let i = 0; i < n; i++) if ((((H & ~rh[i]) | rt[i]) & own) === 0) return { h: rh[i], t: rt[i], keep: rk[i], score: MATE, depth: 0, nodes: 0 };
      let order = rh.map((_, i) => i).sort((x, y) => popcnt((H & ~rh[y]) | rt[y]) - popcnt((H & ~rh[x]) | rt[x]));
      let bestI = order[0], bestScore = 0, done = 0; nodes = 0; timedOut = false;
      deadline = opts.timeMs ? Date.now() + opts.timeMs : Infinity;
      const maxDepth = opts.maxDepth || 12;
      for (let depth = 1; depth <= maxDepth; depth++) {
        let alpha = -Infinity, curBest = -1, curScore = -Infinity; const scores = new Map();
        try {
          for (const i of order) {
            const nH = (H & ~rh[i]) | rt[i];
            const sc = turn ? -search(B, nH, rk[i], 0, depth - 1, -Infinity, -alpha, 1) : -search(nH, W, rk[i], 1, depth - 1, -Infinity, -alpha, 1);
            scores.set(i, sc);
            if (sc > curScore) { curScore = sc; curBest = i; if (sc > alpha) alpha = sc; }
          }
        } catch (e) { if (e !== TIMEOUT) throw e; }
        if (curBest >= 0) { bestI = curBest; bestScore = curScore; } // a cut-short iteration is still usable: it searched the previous best move first
        if (timedOut) break;
        done = depth;
        order = order.slice().sort((x, y) => (scores.get(y) - scores.get(x)));
        if (bestScore > MATE - 1000 || bestScore < -MATE + 1000) break; // forced result found
      }
      return { h: rh[bestI], t: rt[bestI], keep: rk[bestI], score: bestScore, depth: done, nodes };
    }
    function listMoves(B, W, C, turn) { const H = turn ? W : B, own = turn ? WHITEC : BLACKC, buf = BUF[0]; const n = gen(H, C, own, buf, true); const out = [];
      for (let i = 0; i < n; i++) { const nH = (H & ~buf.h[i]) | buf.t[i]; out.push({ h: buf.h[i], t: buf.t[i], keep: buf.k[i], newHand: nH, win: (nH & own) === 0 }); } return out; }
    function legalCount(B, W, C, turn) { return gen(turn ? W : B, C, turn ? WHITEC : BLACKC, BUF[0], false); }
    return { choose, listMoves, legalCount, maskCards, popcnt, BLACKC, WHITEC, MATE };
  }
  const api = { create, MATE, cardIndex: (c) => (c.color === 'b' ? 0 : 9) + c.val - 1 };
  root.MathDuelStrong = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
