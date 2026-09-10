// 9×9 の戦術比較(手元の実験専用)。2026-09-10 の「最強の戦術」「氷はなぜ弱いか」「隅の要塞」「空の攻め方」「相性表」「エリアごとの指し方」の検証に使った道具。結果は reports/fortress-tactics/。
// 9×9 の戦術比較(手元の実験専用)。本番・ランキングには一切触れない。
// 使い方: node tactic-lab.mjs <mode> [SEEDS=n]
//   kings   … 左: 王を固定(2〜K)・フォイル無し / 右: CPU が手札から自由に選ぶ・フォイル無し
//   sky     … 左: 10 王 + 空フォイル、構成の変種 / 右: 自由・フォイル無し
//   kingsfoil … 左: 王固定 + その帯のフォイル / 右: 自由・フォイル無し
if (process.env.ICE_TARGETS || process.env.FREEZE_TURNS) globalThis.TOTTERY_AREA_TUNING = { ...(process.env.ICE_TARGETS ? { iceTargets: Number(process.env.ICE_TARGETS) } : {}), ...(process.env.FREEZE_TURNS ? { freezeTurns: Number(process.env.FREEZE_TURNS) } : {}) };
const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const { reducer } = await import(`${REPO}/src/game/reducer.js`);
const { enrichAction } = await import(`${REPO}/src/game/actions.js`);
const { buildDeck, shuffle, kingRankOf, maxAdopt, totalSlots } = await import(`${REPO}/src/game/board.js`);
const { chooseArmyPlan, strategicDiscards, arrangeArmy } = await import(`${REPO}/src/game/cpu-strategy.js`);
const { cpuInformedAction } = await import(`${REPO}/src/game/cpu-informed.js`);
const { automaticAreaAction } = await import(`${REPO}/src/game/area-presentation.js`);
const { GAME_RULE_VERSION } = await import(`${REPO}/src/game/rule-version.js`);
const { AREA_BY_RANK, isFrozen, isKnownTo, canUseArea, skyCandidates } = await import(`${REPO}/src/game/areas.js`);
const { getLegalMoves: legal, territoryRows } = await import(`${REPO}/src/game/board.js`);
const { knownThreats, unknownThreatMap, moveSafety } = await import(`${REPO}/src/game/cpu-tactics.js`);
const { opponentKingBelief } = await import(`${REPO}/src/game/king-belief.js`);
const { CARD_VALUE, formationMetrics } = await import(`${REPO}/src/game/cpu-strategy.js`);
import fs from "node:fs";

const mode = process.argv[2] || "kings";
const SEEDS = Number(process.env.SEEDS || 60);
const CAP = Number(process.env.TURN_CAP || 160);
const OUT = process.env.OUTPUT || `reports/fortress-tactics/${mode}-results.json`;

function rng(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
const ALL_RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K"];

/** 優先度関数で 9 枚を貪欲に選ぶ。priority(rank, countsSoFar, kingRank) → 点 */
function planByPriority(state, player, kingRank, priority) {
  const hand = state.players[player].hand, slots = totalSlots(state.boardSize);
  const king = hand.find((c) => c.rank === kingRank);
  if (!king) return null;
  const cards = [king], counts = { [kingRank]: 1 };
  while (cards.length < slots) {
    const opts = hand.filter((c) => !cards.includes(c) && (counts[c.rank] || 0) < maxAdopt(c.rank, kingRank));
    if (!opts.length) break;
    opts.sort((a, b) => priority(b.rank, counts, kingRank) - priority(a.rank, counts, kingRank));
    const c = opts[0];
    cards.push(c); counts[c.rank] = (counts[c.rank] || 0) + 1;
  }
  if (cards.length < slots) return null;
  const area = state.areasEnabled && typeof state.areaLoadouts?.[player]?.[kingRank] === "string" ? AREA_BY_RANK[kingRank] : null;
  return { cards, kingId: king.id, kingRank, counts, area };
}

// 変種の定義。planner(state, player) → plan、discards(state, player) → ids
function stockSide(kingRank) {
  return {
    plan: (s, p) => chooseArmyPlan(s, p, kingRank),
    discards: (s, p) => strategicDiscards(s, p, kingRank),
  };
}
function prioritySide(kingRank, priority, { mulliganAll = false, keepMin = -Infinity } = {}) {
  const plan = (s, p) => planByPriority(s, p, kingRank, priority);
  return {
    plan,
    discards: (s, p) => {
      const pl = plan(s, p);
      const hand = s.players[p].hand;
      if (!pl) return [];
      const keep = new Set(pl.cards.map((c) => c.id));
      let out = hand.filter((c) => !keep.has(c.id));
      if (mulliganAll) {
        // 王以外で、優先度が keepMin 未満の採用札も引き直す
        const weak = pl.cards.filter((c) => c.id !== pl.kingId && priority(c.rank, {}, kingRank) < keepMin);
        out = [...out, ...weak];
      }
      return out.slice(0, Math.min(out.length, mulliganAll ? s.reserve.length : 4)).map((c) => c.id);
    },
  };
}
const V = { A:5, 2:2, 3:2, 4:3, 5:3, 6:4, 7:4, 8:4, 9:4, 10:5, J:6, Q:6, K:7 };
const dup = (r, counts) => (counts[r] || 0) * 0.65;

const SKY_VARIANTS = {
  stock: () => stockSide("10"),
  // 変身の素材(2・3)と A を多め
  fodder: () => prioritySide("10", (r, c) => ({ 2: 6, 3: 6, A: c.A ? 0 : 6, 10: 7, J: 5, Q: 5, 9: 4, 8: 4, 7: 3, 6: 3, 5: 2, 4: 2 }[r] ?? 0) - dup(r, c)),
  // 10 を集めて J/Q で固める(2回行動の 10 を増やす)
  knights: () => prioritySide("10", (r, c) => ({ 10: 9, J: 7, Q: 7, 9: 5, 8: 5, 7: 4, 6: 4, A: c.A ? 0 : 5, 5: 3, 4: 3, 2: 2, 3: 2 }[r] ?? 0) - dup(r, c)),
  // 高価値志向(J/Q/10/9/8)
  heavy: () => prioritySide("10", (r, c) => V[r] - dup(r, c) + (r === "A" && c.A ? -4 : 0)),
  // knights + 引き直しを全面的に(弱い札は全部替える)
  knightsMull: () => prioritySide("10", (r, c) => ({ 10: 9, J: 7, Q: 7, 9: 5, 8: 5, 7: 4, 6: 4, A: c.A ? 0 : 5, 5: 3, 4: 3, 2: 2, 3: 2 }[r] ?? 0) - dup(r, c), { mulliganAll: true, keepMin: 4 }),
  fodderMull: () => prioritySide("10", (r, c) => ({ 2: 6, 3: 6, A: c.A ? 0 : 6, 10: 7, J: 5, Q: 5, 9: 4, 8: 4, 7: 3, 6: 3, 5: 2, 4: 2 }[r] ?? 0) - dup(r, c), { mulliganAll: true, keepMin: 4 }),
};

function setup(seed, sides) {
  Math.random = rng(seed);
  const deck = shuffle(buildDeck(null)), used = new Set();
  const pick = (r) => { const c = deck.find((c) => c.rank === r && !used.has(c.id)); if (!c) throw Error("hand"); used.add(c.id); return c; };
  const g0 = sides[0].hand ? sides[0].hand.map(pick) : null;
  const g1 = sides[1].hand ? sides[1].hand.map(pick) : null;
  const a = g0 ? null : sides[0].king ? pick(sides[0].king) : null;
  const b = g1 ? null : sides[1].king ? pick(sides[1].king) : null;
  const rest = deck.filter((c) => !used.has(c.id));
  const h0 = g0 ? [...g0, ...rest.slice(0, 13 - g0.length)] : a ? [a, ...rest.slice(0, 12)] : rest.slice(0, 13);
  const n0 = h0.length;
  const h1 = g1 ? [...g1, ...rest.slice(n0 - (g0 ? g0.length : a ? 1 : 0), n0 - (g0 ? g0.length : a ? 1 : 0) + 13 - g1.length)] : b ? [b, ...rest.slice(12, 24)] : rest.slice(13, 26);
  const tail = rest.filter((c) => !h0.includes(c) && !h1.includes(c));
  const loadouts = sides.map((sd) => sd.foil ? Object.fromEntries((sd.foil === "all" ? ALL_RANKS : [sd.king]).map((r) => [r, "fixture-skin:foil"])) : {});
  let s = reducer({ phase: "intro" }, { type: "START_SETUP", size: 9, setupMode: "simultaneous", deck: [...h0, ...h1, ...tail], areas: true, loadouts, ruleVersion: GAME_RULE_VERSION });
  for (let guard = 0; s.phase !== "play" && guard < 200; guard++) {
    if (s.interstitial) { s = reducer(s, { type: "DISMISS_INTERSTITIAL" }); continue; }
    if (s.phase === "dice") {
      const act = s.diceIdx <= 1 && s.dice[s.diceIdx] === null ? { type: "ROLL_DICE_SINGLE", value: s.diceIdx === 0 ? 6 : 1 }
        : s.diceIdx === 2 ? { type: "GOTO_MULLIGAN" } : s.diceIdx === 3 ? { type: "REROLL_DICE" } : { type: "NEXT_DICE_STEP" };
      s = reducer(s, act); continue;
    }
    if (s.phase === "mulligan") {
      const p = s.mulliganIdx;
      s = reducer(s, enrichAction({ type: "CONFIRM_MULLIGAN", discardIds: sides[p].discards(s, p) }, s));
      continue;
    }
    if (s.phase === "setup") {
      for (const p of [0, 1]) {
        if (s.setupDone[p]) continue;
        const plan = sides[p].plan(s, p);
        if (!plan) throw Error("hand");
        const placement = (sides[p].arrange || arrangeArmy)(s, p, plan);
        s = reducer(s, { type: "SETUP_CONFIRM", player: p, kingId: plan.kingId, placement });
        if (!s.setupDone[p]) throw Error("setup rejected");
      }
      continue;
    }
    throw Error("unexpected " + s.phase);
  }
  const effects = s.setupEffects;
  if (s.setupEffects) s = reducer(s, { type: "DISMISS_SETUP_EFFECTS" });
  if (s.interstitial) s = reducer(s, { type: "DISMISS_INTERSTITIAL" });
  if (s.phase !== "play") throw Error("no play");
  return { s, effects };
}

function play(base, first, seed, sides = null) {
  Math.random = rng(seed);
  let s = { ...structuredClone(base), firstPlayer: first, currentTurn: first, interstitial: null }, steps = 0, stopped = null;
  const iceUses = [0, 0], iceExt = [0, 0];
  let death = null;
  const step = (act) => { s = { ...reducer(s, act), replay: [] }; };
  while (s.phase !== "gameover" && steps++ < 2400) {
    if (s.captureReveal) { step({ type: "DISMISS_CAPTURE" }); continue; }
    if (s.interstitial) { step({ type: "DISMISS_INTERSTITIAL" }); continue; }
    if (s.setupEffects) { step({ type: "DISMISS_SETUP_EFFECTS" }); continue; }
    if (s.turnNo >= CAP) { stopped = "turn_cap"; break; }
    let act = automaticAreaAction(s) || (sides?.[s.currentTurn]?.act ? sides[s.currentTurn].act(s, s.currentTurn) : null) || cpuInformedAction(s, s.currentTurn);
    if (!act) { stopped = "no_action"; break; }
    if (act.type === "__CPU_SHUFFLE") {
      step({ type: "SELECT_PIECE", id: act.aceId });
      for (const id of act.pickIds) step({ type: "TOGGLE_SHUFFLE_PICK", id });
      act = { type: "CONFIRM_SHUFFLE", aId: act.aceId, pickIds: act.pickIds };
    }
    const prior = s;
    let enriched = enrichAction({ ...act, elapsedMs: 0 }, s);
    const cur = s.currentTurn;
    if (enriched.type === "USE_AREA" && s.areas[cur]?.type === "ice" && sides?.[cur]?.icePicks)
      enriched = { ...enriched, picks: sides[cur].icePicks(s, cur) };
    const next = reducer(s, enriched);
    if (next === prior) { stopped = "rejected:" + act.type; break; }
    if (next.winner != null && s.winner == null && next.winner !== cur && false) {}
    if (next.phase === "gameover" && next.winner === 1 && cur === 1 && !death) {
      const k = enriched.type === "MOVE_PIECE" ? s.pieces[enriched.pieceId] : null;
      const myKing = Object.values(s.pieces).find((p) => p.owner === 0 && p.isKing);
      death = { by: enriched.type === "MOVE_PIECE" ? `${k.rank}${k.isKing ? "王" : ""}` : enriched.type, turn: s.turnNo, kingAt: myKing ? `${myKing.row},${myKing.col}` : "?", killerKnown: k ? !!(k.revealed || s.known?.[0]?.[k.id]) : null, lost: Object.values(s.pieces).filter((p) => p.owner === 0 && !p.alive).length, took: Object.values(s.pieces).filter((p) => p.owner === 1 && !p.alive).length };
    }
    if (enriched.type === "USE_AREA" && next.lastArea?.type === "ice") { iceUses[cur]++; if (next.lastArea.extended) iceExt[cur]++; }
    s = { ...next, replay: [] };
  }
  if (s.phase !== "gameover" && !stopped) stopped = "action_cap";
  return { winner: s.phase === "gameover" ? s.winner : null, stop: stopped, reason: s.endReason || (s.adjudication ? "adjudication" : "king"), turns: s.turnNo, iceUses, iceExt, death };
}

function runPair(label, sides, seedBase) {
  const rows = [];
  for (let n = 0; n < SEEDS; n++) {
    let seed = seedBase + n * 7919, base;
    for (let attempt = 0; attempt < 200; attempt++) {
      try { base = setup(seed, sides); break; } catch (e) { if (!/hand|setup/.test(String(e.message))) throw e; seed += 15485863; }
    }
    if (!base) throw Error("setup failed " + label);
    const kings = [0, 1].map((i) => kingRankOf(base.s, i));
    const counts = [0, 1].map((i) => base.s.players[i].armyRankCounts);
    for (const first of [0, 1]) {
      // 実際の先手は setupEffects(ストレート)で入れ替わっているかもしれないが、
      // ここでは比較のため強制して両方を測る
      const r = play(base.s, first, seed + first * 104729, sides);
      rows.push({ label, seed, first, kings, counts, straight: base.effects?.straights || [false, false], flush: base.effects?.flushes || [false, false], ...r });
    }
  }
  return rows;
}

function summarize(rows) {
  const by = {};
  for (const r of rows) {
    const b = (by[r.label] ||= { games: 0, w: 0, l: 0, d: 0, und: 0, firstW: 0, firstG: 0, secondW: 0, secondG: 0, turns: [], kings1: {}, straight0: 0 });
    b.games++;
    if (r.winner === null) { b.und++; continue; }
    if (r.winner === 0) b.w++; else b.l++;
    if (r.first === 0) { b.firstG++; if (r.winner === 0) b.firstW++; } else { b.secondG++; if (r.winner === 0) b.secondW++; }
    b.turns.push(r.turns);
    b.kings1[r.kings[1]] = (b.kings1[r.kings[1]] || 0) + 1;
    if (r.straight[0]) b.straight0++;
    b.frozenEnd = (b.frozenEnd || 0) + (r.reason === "frozen" ? 1 : 0);
    b.iceUses = (b.iceUses || 0) + (r.iceUses?.[0] || 0);
    b.iceExt = (b.iceExt || 0) + (r.iceExt?.[0] || 0);
  }
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + "%" : "-");
  const lines = [];
  for (const [label, b] of Object.entries(by)) {
    const med = b.turns.sort((x, y) => x - y)[Math.floor(b.turns.length / 2)];
    const foes = Object.entries(b.kings1).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, n]) => `${k}:${n}`).join(" ");
    lines.push(`${label.padEnd(14)} 勝率 ${pct(b.w, b.w + b.l).padStart(6)}  勝-負-未 ${b.w}-${b.l}-${b.und}  先手 ${pct(b.firstW, b.firstG)} 後手 ${pct(b.secondW, b.secondG)}  中央値手番 ${med}  凍結負け ${b.frozenEnd}  氷 ${(b.iceUses / (b.w + b.l || 1)).toFixed(1)}回/局(延長 ${pct(b.iceExt, b.iceUses)})  相手王 ${foes}`);
  }
  return lines.join("\n");
}

/**
 * 守り型: 王を晒さない・自陣で受ける・凍結が積み上がるか敵が減ってから取りに行く。
 * 伏せ札の中身は読まない(公開/見抜いた駒と、位置だけ)。
 */
function turtleAct(opts = {}) {
  const { attackAfterFrozen = 3, unknownWeight = 0.8, worstCaseKing = false, shell = 0 } = opts;
  // 王の殻: 王の周り8升と桂馬8升のうち、自分の駒が居るか自分の駒が届く升の数
  const shellCount = (s, me, board, kingAt, pieces) => {
    const cells = [];
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) {
      const r = kingAt.row + dr, c = kingAt.col + dc;
      if (r >= 0 && r < s.boardSize && c >= 0 && c < s.boardSize) cells.push({ r, c });
    }
    let n = 0;
    const counts = s.players[me].armyRankCounts, kr = kingRankOf(s, me);
    for (const { r, c } of cells) {
      const at = board[r][c];
      if (at && at.owner === me) { n++; continue; }
      if (at && at.owner !== me) continue;
      board[r][c] = { id: "x", owner: 1 - me, row: r, col: c };
      if (pieces.some((q) => !q.isKing && !isFrozen(s, q) && q.rank !== "A" && legal(q, board, s.boardSize, counts, kr).some((mv) => mv.row === r && mv.col === c))) n++;
      board[r][c] = null;
    }
    return n / cells.length;
  };
  return (s, me) => {
    if (s.phase !== "play" || s.pendingKingChoice || s.kPlacement || s.extraMoveFor || s.winner != null) return null;
    const mine = Object.values(s.pieces).filter((p) => p.alive && p.owner === me && !isFrozen(s, p) && p.rank !== "A");
    if (!mine.length) return null;
    const enemies = Object.values(s.pieces).filter((p) => p.alive && p.owner !== me);
    const frozenN = enemies.filter((p) => isFrozen(s, p)).length;
    const aggressive = frozenN >= attackAfterFrozen || enemies.length <= 5;
    const unknown = unknownThreatMap(s, me);
    const threatsNow = knownThreats(s, me);
    const belief = opponentKingBelief(s, me);
    const cand = new Set(belief.candidates.map((c) => c.id));
    const king = s.pieces[s.players[me].kingId];
    const [lo, hi] = territoryRows(s.boardSize, me);
    const inHome = (r) => r >= lo && r <= hi;
    const kingThreatened = king && (threatsNow.has(`${king.row}/${king.col}`) || (unknown.get(`${king.row}/${king.col}`) || 0) > 0.35);
    const counts = s.players[me].armyRankCounts, kr = kingRankOf(s, me);
    // 取られても取り返せる駒の数(盤 board 上で、味方が仮の敵に届くか)
    const guardedCount = (board, pieces) => {
      let n = 0;
      for (const t of pieces) {
        board[t.row][t.col] = { id: "x", owner: 1 - me, row: t.row, col: t.col };
        if (pieces.some((q) => q.id !== t.id && !isFrozen(s, q) && q.rank !== "A" && legal(q, board, s.boardSize, counts, kr).some((mv) => mv.row === t.row && mv.col === t.col))) n++;
        board[t.row][t.col] = t;
      }
      return n;
    };
    const allMine = Object.values(s.pieces).filter((p) => p.alive && p.owner === me);
    const guardedNow = guardedCount(s.board.map((r) => r.slice()), allMine);
    let best = null;
    for (const p of mine) {
      for (const m of legal(p, s.board, s.boardSize, counts, kr)) {
        const ids = new Set((m.captures || []).map((c) => s.board[c.row]?.[c.col]?.id).filter(Boolean));
        const t = s.board[m.row][m.col]; if (t && t.owner !== me) ids.add(t.id);
        let score = 0;
        for (const id of ids) {
          const q = s.pieces[id];
          const known = isKnownTo(s, me, q);
          score += (known ? CARD_VALUE[q.rank] : 3.5) * 2;
          if (isFrozen(s, q)) score += 4;
          if (known && q.isKing) score += 1000;
          else if (cand.has(id)) score += 60 * belief.weight;
        }
        score += moveSafety(s, me, p, m, ids, { unknownWeight, unknownThreats: unknown });
        // 自陣の外へ出るのは、取るとき・攻勢に転じたときだけ
        const out = me === 0 ? Math.max(0, lo - m.row) : Math.max(0, m.row - hi);
        if (!ids.size && !aggressive) score -= out * 3 + (inHome(p.row) ? 0 : -1);
        if (!ids.size && aggressive) score -= out * 0.5;
        if (p.isKing) score += kingThreatened ? 6 : -10;
        // 王のそばを空けない
        if (!p.isKing && king && Math.max(Math.abs(p.row - king.row), Math.abs(p.col - king.col)) <= 1 && Math.max(Math.abs(m.row - king.row), Math.abs(m.col - king.col)) > 1) score -= 3;
        {
          const board = s.board.map((r) => r.slice());
          board[p.row][p.col] = null;
          for (const id of ids) { const q = s.pieces[id]; board[q.row][q.col] = null; }
          const moved = { ...p, row: m.row, col: m.col };
          board[m.row][m.col] = moved;
          const after = guardedCount(board, allMine.map((q) => (q.id === p.id ? moved : q)));
          score += (after - guardedNow) * 2.5;
          if (worstCaseKing && king) {
            const kAt = p.isKing ? moved : king;
            const danger = kingReachable(s, me, board, kAt, ids);
            if (danger) score -= 80;
            if (shell) score += shell * shellCount(s, me, board, kAt, allMine.map((q) => (q.id === p.id ? moved : q)));
          }
        }
        score += Math.random() * 0.5;
        if (!best || score > best.score) best = { score, type: "MOVE_PIECE", pieceId: p.id, row: m.row, col: m.col, captures: m.captures };
      }
    }
    if (!best) return null;
    const { score, ...action } = best;
    return action;
  };
}
/** 隅の要塞: 自陣の隅 3×3 を9体で埋め、王をいちばん奥に置く。残りは取り返しが最大になるよう並べ替える */
function fortressArrange(state, player, plan, col0 = 0) {
  const size = state.boardSize, [lo, hi] = territoryRows(size, player);
  const back = player === 0 ? hi : lo, dir = player === 0 ? -1 : 1;
  const cells = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push({ row: back + dir * i, col: col0 + j });
  const corner = cells[0];
  const others = plan.cards.filter((c) => c.id !== plan.kingId);
  const placement = { [plan.kingId]: corner };
  others.forEach((c, i) => (placement[c.id] = cells[i + 1]));
  const score = (pl) => formationMetrics(plan, pl, size, player).score;
  let best = placement, bestScore = score(best);
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (const a of others) for (const b of others) {
      if (a.id >= b.id) continue;
      const trial = { ...best, [a.id]: best[b.id], [b.id]: best[a.id] };
      const sc = score(trial);
      if (sc > bestScore + 1e-6) { best = trial; bestScore = sc; improved = true; }
    }
    if (!improved) break;
  }
  return best;
}
const ANY_RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K"];
/** 相手のどの駒かが「どのランクだとしても」王の升に届くか(最悪ケース) */
function kingReachable(s, me, board, kingAt, ignore = new Set()) {
  for (const e of Object.values(s.pieces)) {
    if (!e.alive || e.owner === me || ignore.has(e.id) || isFrozen(s, e)) continue;
    const at = board[e.row]?.[e.col]; if (!at || at.id !== e.id) continue;
    const ranks = isKnownTo(s, me, e) ? [e.rank] : ANY_RANKS;
    for (const rank of ranks) {
      const q = { ...e, rank, isKing: rank === e.rank ? e.isKing : true };
      if (legal(q, board, s.boardSize, {}, undefined).some((m) => (m.row === kingAt.row && m.col === kingAt.col) || (m.captures || []).some((c) => c.row === kingAt.row && c.col === kingAt.col))) return e;
    }
  }
  return null;
}
/** 指定の9枚(ランクの並び)をそのまま採用する側。手札に無ければ null */
function fixedSide(ranks, kingRank) {
  const plan = (s, p) => {
    const hand = [...s.players[p].hand], cards = [];
    for (const r of ranks) { const i = hand.findIndex((c) => c.rank === r); if (i < 0) return null; cards.push(hand.splice(i, 1)[0]); }
    const king = cards.find((c) => c.rank === kingRank);
    const counts = {}; for (const c of cards) counts[c.rank] = (counts[c.rank] || 0) + 1;
    const area = s.areasEnabled && typeof s.areaLoadouts?.[p]?.[kingRank] === "string" ? AREA_BY_RANK[kingRank] : null;
    return { cards, kingId: king.id, kingRank, counts, area };
  };
  return { plan, discards: () => [], hand: ranks, king: kingRank };
}
function fortAct(opts = {}) {
  const t = turtleAct({ worstCaseKing: true, shell: 12, ...opts });
  return (s, me) => {
    if (s.phase === "play" && !s.pendingKingChoice && !s.kPlacement && !s.extraMoveFor && s.winner == null) {
      const a = cpuInformedAction(s, me);
      if (a && a.type === "USE_AREA") return a;
    }
    return t(s, me);
  };
}
/**
 * 空の攻め方(本人の方針): 相手が守っていれば無闇に変身しない。取り返せる形を保って前進し、
 * 一気に取れるときだけ変身と2回行動で畳みかける。伏せ札の中身は読まない。
 */
function skyAct(opts = {}) {
  const {
    advance: advance0 = 1.2, unknownWeight = 0.8, shell = 8, burstMin: burstMin0 = 9, endgame = 4,
    adaptive = false,          // 空: 相手の出方(前に出ているか)で、一気に攻めるか、ゆっくり進むかを切り替える
    candidateBonus = 60,       // 王候補(正体不明の駒)を取る手の加点(信念の重み倍)
    unknownBonus = 0,          // 正体不明の駒を取る手そのものの加点(土・森の「匿名性を剥がす」狩り)
    kingExpendable = false,    // 土: 継承者が居るあいだは王の危険を軽く見る(王が前に出て狩る)
    ready = null,              // 森: (s, me, belief) => 攻めに転じてよいか。偽のあいだは自陣で待つ
    safeHunt = false,          // 王候補を取る手でも、取り返される升なら加点を3割に(交換で削られない)
  } = opts;
  const KN = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
  return (s, me) => {
    if (s.phase !== "play" || s.pendingKingChoice || s.kPlacement || s.winner != null) return null;
    const extra = s.extraMoveFor;
    const allMine = Object.values(s.pieces).filter((p) => p.alive && p.owner === me);
    const movers = extra ? allMine.filter((p) => p.id === extra) : allMine.filter((p) => !isFrozen(s, p) && p.rank !== "A");
    if (!movers.length) return extra ? { type: "SKIP_EXTRA_ACTION" } : null;
    const enemies = Object.values(s.pieces).filter((p) => p.alive && p.owner !== me);
    const unknown = unknownThreatMap(s, me);
    const threatsNow = knownThreats(s, me);
    const belief = opponentKingBelief(s, me);
    const cand = new Set(belief.candidates.map((c) => c.id));
    const king = s.pieces[s.players[me].kingId];
    const dir = me === 0 ? -1 : 1; // 前進の向き
    const counts = s.players[me].armyRankCounts, kr = kingRankOf(s, me);
    const kingThreatened = king && (threatsNow.has(`${king.row}/${king.col}`) || (unknown.get(`${king.row}/${king.col}`) || 0) > 0.35);
    // 相手の出方: 相手の駒のうち自陣(相手から見て)の外に出ている割合。高いほど攻めてきている
    const [flo, fhi] = territoryRows(s.boardSize, 1 - me);
    const foeOut = enemies.filter((e) => e.row < flo || e.row > fhi).length / Math.max(1, enemies.length);
    let advance = advance0, burstMin = burstMin0;
    if (adaptive) {
      if (foeOut >= 0.3) { advance = 0.4; burstMin = 6; }      // 攻めてきている: 受けて一気に返す
      else if (foeOut <= 0.1) { advance = 1.4; burstMin = 9; } // 籠もっている: ゆっくり進む
    }
    // 土: 継承者(王と同じ数字の生きた駒)が居れば王を晒す危険を軽く見る
    const heirs = king && ["2", "3"].includes(king.rank) ? allMine.filter((q) => q.rank === king.rank && !q.isKing).length : 0;
    const kingPenalty = kingExpendable && heirs > 0 ? 18 : 80;
    const waiting = ready ? !ready(s, me, belief, allMine, enemies) : false;
    const guardedCount = (board, pieces) => {
      let n = 0;
      for (const t of pieces) {
        board[t.row][t.col] = { id: "x", owner: 1 - me, row: t.row, col: t.col };
        if (pieces.some((q) => q.id !== t.id && !isFrozen(s, q) && q.rank !== "A" && legal(q, board, s.boardSize, counts, kr).some((mv) => mv.row === t.row && mv.col === t.col))) n++;
        board[t.row][t.col] = t;
      }
      return n;
    };
    const shellCount = (board, kingAt, pieces) => {
      let n = 0, total = 0;
      for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],...KN]) {
        const r = kingAt.row + dr, c = kingAt.col + dc;
        if (r < 0 || r >= s.boardSize || c < 0 || c >= s.boardSize) continue;
        total++;
        const at = board[r][c];
        if (at && at.owner === me) { n++; continue; }
        if (at) continue;
        board[r][c] = { id: "x", owner: 1 - me, row: r, col: c };
        if (pieces.some((q) => !q.isKing && !isFrozen(s, q) && q.rank !== "A" && legal(q, board, s.boardSize, counts, kr).some((mv) => mv.row === r && mv.col === c))) n++;
        board[r][c] = null;
      }
      return total ? n / total : 1;
    };
    const guardedNow = guardedCount(s.board.map((r) => r.slice()), allMine);
    const capValue = (ids) => {
      let v = 0;
      for (const id of ids) {
        const q = s.pieces[id];
        const known = isKnownTo(s, me, q);
        v += (known ? CARD_VALUE[q.rank] : 3.5) * 2;
        if (isFrozen(s, q)) v += 4;
        if (known && q.isKing) v += 1000;
        else if (cand.has(id)) v += candidateBonus * belief.weight;
        if (!known) v += unknownBonus;
      }
      return v;
    };
    const idsOf = (board, m) => {
      const ids = new Set((m.captures || []).map((c) => board[c.row]?.[c.col]?.id).filter(Boolean));
      const t = board[m.row][m.col]; if (t && t.owner !== me) ids.add(t.id);
      return ids;
    };
    // 手の評価。pieces は現在の駒(rank 差し替え済みでもよい)、board はその盤
    const evalMove = (p, m, board0, pieces, depth) => {
      const ids = idsOf(board0, m);
      let score = capValue(ids);
      const safe0 = moveSafety(s, me, p, m, ids, { unknownWeight, unknownThreats: unknown });
      if (safeHunt && safe0 < -3 && ids.size) score -= 0.7 * [...ids].reduce((v, id) => v + (cand.has(id) ? candidateBonus * belief.weight : 0) + (isKnownTo(s, me, s.pieces[id]) ? 0 : unknownBonus), 0);
      score += safe0;
      const board = board0.map((r) => r.slice());
      board[p.row][p.col] = null;
      for (const id of ids) { const q = s.pieces[id]; if (q) board[q.row][q.col] = null; }
      const moved = { ...p, row: m.row, col: m.col };
      board[m.row][m.col] = moved;
      const after = pieces.map((q) => (q.id === p.id ? moved : q));
      score += (guardedCount(board, after) - guardedNow) * 2.5;
      const kAt = p.isKing ? moved : king;
      if (king) {
        if (kingReachable(s, me, board, kAt, ids)) score -= kingPenalty;
        score += shell * shellCount(board, kAt, after);
      }
      // 前進: 取らない手でも、取り返せる形のまま前へ出るなら加点。孤立は減点。待つあいだは前に出ない
      const fwd = (m.row - p.row) * dir;
      const nearest = Math.min(...after.filter((q) => q.id !== p.id).map((q) => Math.max(Math.abs(q.row - m.row), Math.abs(q.col - m.col))));
      if (!ids.size) {
        const [hlo, hhi] = territoryRows(s.boardSize, me);
        const out = m.row < hlo || m.row > hhi;
        score += waiting ? (out ? -3 : 0) : advance * Math.max(-1, Math.min(2, fwd));
        if (nearest > 2) score -= 4;
        const front = after.filter((q) => q.id !== p.id).map((q) => q.row * dir).sort((a, b) => b - a)[Math.min(2, after.length - 2)];
        if (m.row * dir - front > 2) score -= 2 * (m.row * dir - front - 2);
      } else if (nearest > 2) score -= 2;
      if (p.isKing) score += kingThreatened ? 6 : kingExpendable && heirs > 0 ? 0 : -6;
      // 10 の2回行動: 続けて取れる手があれば、その分を足す(取って戻る「取り逃げ」)。
      // 2手をひとまとめに評価する版は、氷の要塞相手に交換が増えて負けが増えたので、この足し込み方に戻した
      if (depth === 0 && !extra && moved.rank === "10" && (moved.isKing || moved.skyTwice || s.players[me].skyTwice)) {
        let best2 = 0;
        for (const m2 of legal(moved, board, s.boardSize, counts, kr)) {
          const ids2 = idsOf(board, m2);
          let v = capValue(ids2);
          const b2 = board.map((r) => r.slice());
          b2[moved.row][moved.col] = null; for (const id of ids2) { const q = s.pieces[id]; if (q) b2[q.row][q.col] = null; }
          const moved2 = { ...moved, row: m2.row, col: m2.col }; b2[m2.row][m2.col] = moved2;
          const after2 = after.map((q) => (q.id === p.id ? moved2 : q));
          v += (guardedCount(b2, after2) - guardedNow) * 1.5;
          if (king && kingReachable(s, me, b2, p.isKing ? moved2 : king, ids2)) v -= kingPenalty;
          if (moveSafety(s, me, moved, m2, ids2, { unknownWeight, unknownThreats: unknown }) < -6) v -= 6;
          if (v > best2) best2 = v;
        }
        score += 0.9 * best2;
      }
      return score;
    };
    let best = null;
    for (const p of movers)
      for (const m of legal(p, s.board, s.boardSize, counts, kr)) {
        const sc = evalMove(p, m, s.board, allMine, 0) + Math.random() * 0.3;
        if (!best || sc > best.score) best = { score: sc, type: "MOVE_PIECE", pieceId: p.id, row: m.row, col: m.col, captures: m.captures };
      }
    if (extra) return best && best.score > -1 ? (({ score, ...a }) => a)(best) : { type: "SKIP_EXTRA_ACTION" };
    // 海・宮殿の任意発動は通常CPUの判断を借りる(空だけ下で自前に判断)
    const can = canUseArea(s, me);
    if (can.ok && (can.type === "sea" || can.type === "palace")) {
      const a = cpuInformedAction(s, me);
      if (a && a.type === "USE_AREA") return a;
    }
    // 変身: いま変身した駒が(2回行動で)一気に取れるときだけ。終盤(敵が少ない)は自由に
    if (can.ok && can.type === "sky") {
      let bestX = null;
      for (const id of skyCandidates(s, me)) {
        const x = s.pieces[id];
        if (isFrozen(s, x) || x.rank === "A") continue;
        const x10 = { ...x, rank: "10", skyTwice: true };
        const pieces = allMine.map((q) => (q.id === id ? x10 : q));
        const board = s.board.map((r) => r.slice()); board[x.row][x.col] = x10;
        let bestMove = -Infinity;
        for (const m of legal(x10, board, s.boardSize, counts, kr)) {
          const sc = evalMove(x10, m, board, pieces, 0);
          if (sc > bestMove) bestMove = sc;
        }
        const guardLoss = (guardedCount(board.map((r) => r.slice()), pieces) - guardedNow) * 2.5;
        const worth = bestMove + guardLoss - (best ? best.score : 0);
        const cheap = CARD_VALUE[x.rank] <= 3;
        if ((worth >= burstMin) || (enemies.length <= endgame && cheap && worth > 0))
          if (!bestX || worth > bestX.worth) bestX = { id, worth };
      }
      if (bestX) return { type: "USE_AREA", pieceId: bestX.id };
    }
    if (!best) return null;
    const { score, ...action } = best;
    return action;
  };
}
/** 土: 継承があるので王ごと前に出て、正体の分からない駒(王候補)を狩る */
function earthAct() { return skyAct({ advance: 1.4, kingExpendable: true, candidateBonus: 90, unknownBonus: 4, burstMin: 99 }); }
/** 森: 毎手番2体ずつ見抜けるので、候補が絞れる(王候補が3体以下か、4手番)まで自陣で粘り、そこから詰めに行く */
function forestAct(extra = {}) {
  return skyAct({ advance: 1.4, candidateBonus: 120, unknownBonus: 3, burstMin: 99,
    ready: (s, me, belief) => belief.candidates.length <= 3 || (s.turnNo || 0) >= 8, ...extra });
}
/** 空: 相手の出方で、一気に返すか、ゆっくり進むかを切り替える */
function skyAdaptiveAct() { return skyAct({ adaptive: true }); }
/** 氷: 徹底防御(隅の要塞と同じ手の選び方。攻めに転じるのは敵が凍りきってから) */
function iceAct() { return turtleAct({ worstCaseKing: true, shell: 12, attackAfterFrozen: 4 }); }
const HEAVY = (r, c) => ({ J: 8, Q: 8, 10: 6, A: c.A ? 0 : 6, 8: 5, 9: 5, 6: 4, 7: 4, 4: 3, 5: 3, 2: 2, 3: 2 }[r] ?? 0) - dup(r, c);
const WALL = (r, c) => ({ J: 7, Q: 7, A: c.A ? 0 : 6, 2: 5, 3: 5, 4: 5, 5: 5, 10: 4, 8: 3, 9: 3, 6: 3, 7: 3 }[r] ?? 0) - dup(r, c);
const free = () => ({ king: null, foil: false, plan: (s, p) => chooseArmyPlan(s, p, null), discards: (s, p) => strategicDiscards(s, p, null) });
let rows = [];
const t0 = Date.now();
if (mode === "kings" || mode === "kingsfoil") {
  const ranks = (process.env.RANKS || ALL_RANKS.join(",")).split(",");
  ranks.forEach((k, i) => {
    const left = { king: k, foil: mode === "kingsfoil" ? "king" : false, ...stockSide(k) };
    rows.push(...runPair(`${k}${mode === "kingsfoil" ? "+foil" : ""}`, [left, free()], 30260910 + i * 1000003));
    console.error(`${k} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  });
} else if (mode === "sky") {
  const names = (process.env.VARIANTS || Object.keys(SKY_VARIANTS).join(",")).split(",");
  names.forEach((name, i) => {
    const left = { king: "10", foil: "king", ...SKY_VARIANTS[name]() };
    rows.push(...runPair(`sky:${name}`, [left, free()], 40260910 + i * 1000003));
    console.error(`${name} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  });
} else if (mode === "lowking") {
  // 2〜5 の王: 同じ数字を集める構成 + 引き直しを全面的に
  const same = (k) => (r, c) => (r === k ? 10 : { A: c.A ? 0 : 6, 10: 5, J: 5, Q: 5, 9: 4, 8: 4, 7: 3.5, 6: 3.5, 5: 2.5, 4: 2.5, 2: 2, 3: 2 }[r] ?? 0) - dup(r, c) + (r === k ? 0.65 * (c[r] || 0) : 0);
  const names = (process.env.VARIANTS || "2,3,4,5").split(",");
  names.forEach((k, i) => {
    rows.push(...runPair(`${k}:same+mull`, [{ king: k, foil: false, ...prioritySide(k, same(k), { mulliganAll: true, keepMin: 4 }) }, free()], 60260910 + i * 1000003));
    rows.push(...runPair(`${k}:same`, [{ king: k, foil: false, ...prioritySide(k, same(k)) }, free()], 60260910 + i * 1000003));
    console.error(`${k} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  });
} else if (mode === "duel") {
  // フォイル同士の直接対決(どちらも stock の構成)
  const pairs = (process.env.PAIRS || "3/10,3/4,10/4,3/2,10/K,3/K").split(",").map((p) => p.split("/"));
  pairs.forEach(([a, b], i) => {
    rows.push(...runPair(`${a}+foil vs ${b}+foil`, [{ king: a, foil: "king", ...stockSide(a) }, { king: b, foil: "king", ...stockSide(b) }], 70260910 + i * 1000003));
    console.error(`${a}/${b} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  });
  const same = (k) => (r, c) => (r === k ? 10 : { A: c.A ? 0 : 6, 10: 5, J: 5, Q: 5, 9: 4, 8: 4, 7: 3.5, 6: 3.5, 5: 2.5, 4: 2.5, 2: 2, 3: 2 }[r] ?? 0) - dup(r, c) + (r === k ? 0.65 * (c[r] || 0) : 0);
  for (const k of ["3", "2"])
    rows.push(...runPair(`${k}+foil same+mull`, [{ king: k, foil: "king", ...prioritySide(k, same(k), { mulliganAll: true, keepMin: 4 }) }, free()], 80260910 + Number(k) * 1000003));
} else if (mode === "ice") {
  // 対象を選べたら: 凍っていない駒を優先し、自分の王に近い駒から
  const smart = (s, me) => {
    const king = s.pieces[s.players[me].kingId];
    const dist = (p) => Math.max(Math.abs(p.row - king.row), Math.abs(p.col - king.col));
    return Object.values(s.pieces).filter((p) => p.alive && p.owner !== me && !p.isKing)
      .sort((a, b) => (Number(a.frozenUntil > s.turnNo) - Number(b.frozenUntil > s.turnNo)) || dist(a) - dist(b)).map((p) => p.id);
  };
  const tag = process.env.TAG || "";
  ["8", "9"].forEach((k, i) => {
    rows.push(...runPair(`${k}+氷 random${tag}`, [{ king: k, foil: "king", ...stockSide(k) }, free()], 90260910 + i * 1000003));
    if (!tag) rows.push(...runPair(`${k}+氷 smart`, [{ king: k, foil: "king", ...stockSide(k), icePicks: smart }, free()], 90260910 + i * 1000003));
    console.error(`${k} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  });
} else if (mode === "icevs") {
  const foes = (process.env.FOES || "K,4,5,2,10,6").split(",");
  foes.forEach((f, i) => {
    rows.push(...runPair(`8+氷 vs ${f}`, [{ king: "8", foil: "king", ...stockSide("8") }, { king: f, foil: false, ...stockSide(f) }], 95260910 + i * 1000003));
    rows.push(...runPair(`8 vs ${f}`, [{ king: "8", foil: false, ...stockSide("8") }, { king: f, foil: false, ...stockSide(f) }], 95260910 + i * 1000003));
    console.error(`${f} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  });
} else if (mode === "turtle") {
  const which = (process.env.KINGS || "8,9").split(",");
  const foe = process.env.FOE ? (k) => ({ king: k, foil: false, ...stockSide(k) }) : () => free();
  const F = process.env.FOE || "free";
  which.forEach((k, i) => {
    const base = 90260910 + i * 1000003;
    rows.push(...runPair(`${k}+氷 stock vs ${F}`, [{ king: k, foil: "king", ...stockSide(k) }, foe(F)], base));
    rows.push(...runPair(`${k}+氷 turtle/heavy vs ${F}`, [{ king: k, foil: "king", ...prioritySide(k, HEAVY), act: turtleAct() }, foe(F)], base));
    rows.push(...runPair(`${k}+氷 turtle/wall vs ${F}`, [{ king: k, foil: "king", ...prioritySide(k, WALL), act: turtleAct() }, foe(F)], base));
    rows.push(...runPair(`${k} 無し turtle/heavy vs ${F}`, [{ king: k, foil: false, ...prioritySide(k, HEAVY), act: turtleAct() }, foe(F)], base));
    rows.push(...runPair(`${k}+氷 turtle/heavy(6) vs ${F}`, [{ king: k, foil: "king", ...prioritySide(k, HEAVY), act: turtleAct({ attackAfterFrozen: 6 }) }, foe(F)], base));
    console.error(`${k} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  });
} else if (mode === "fort") {
  const which = (process.env.KINGS || "8,9").split(",");
  const foeAct = process.env.FOE_POLICY === "aware" ? (s, p) => cpuInformedAction(s, p, { unknownWeight: Number(process.env.UNKNOWN_WEIGHT || 0.6) }) : undefined;
  const foeFoil = process.env.FOE_FOIL === "1" ? "king" : false;
  const foe = process.env.FOE ? () => ({ king: process.env.FOE, foil: foeFoil, ...stockSide(process.env.FOE), act: foeAct }) : () => ({ ...free(), act: foeAct });
  const F = (process.env.FOE || "free") + (foeFoil ? "+foil" : "") + (foeAct ? "/aware" : "");
  const BLOCK = (r, c) => ({ J: 8, Q: 8, 4: 7, 2: 6, 8: 6, A: c.A ? 0 : 3, 10: 5, 5: 5, 3: 5, 9: 4, 6: 4, 7: 4 }[r] ?? 0) - dup(r, c);
  const withFort = (side) => ({ ...side, arrange: fortressArrange });
  if (process.env.ONLY === "block") {
    // 要塞型を他の王・エリアにも当てはめる(空・土・宮殿・無し)
    which.forEach((k, i) => {
      const base = 90260910 + i * 1000003;
      rows.push(...runPair(`${k}+foil fort/block+worst vs ${F}`, [withFort({ king: k, foil: "king", ...prioritySide(k, BLOCK), act: turtleAct({ worstCaseKing: true }) }), foe(F)], base));
      rows.push(...runPair(`${k} 無し fort/block+worst vs ${F}`, [withFort({ king: k, foil: false, ...prioritySide(k, BLOCK), act: turtleAct({ worstCaseKing: true }) }), foe(F)], base));
      console.error(`${k} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    });
  } else if (process.env.ONLY === "attack") {
    which.forEach((k, i) => {
      const base = 90260910 + i * 1000003;
      for (const n of [0, 1, 2]) rows.push(...runPair(`${k}+氷 fort/block+worst attack${n} vs ${F}`, [withFort({ king: k, foil: "king", ...prioritySide(k, BLOCK), act: turtleAct({ worstCaseKing: true, attackAfterFrozen: n }) }), foe(F)], base));
      console.error(`${k} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    });
  } else if (process.env.ONLY === "comp") {
    const K = process.env.KING || "9";
    const comps = {
      A: [K, "J", "Q", "4", "4", "2", "2", "8", "3"],
      B: [K, "J", "J", "Q", "Q", "4", "2", "8", "8"],
      C: [K, "4", "4", "4", "2", "2", "2", "J", "Q"],
      D: [K, "8", "8", "8", "J", "Q", "4", "2", "3"],
      E: [K, K, K, "J", "Q", "4", "2", "8", "3"],
      G: [K, "10", "10", "J", "Q", "4", "2", "8", "3"],
      H: [K, "J", "Q", "4", "4", "2", "2", "5", "3"],
      I: [K, "J", "J", "Q", "Q", "4", "4", "2", "2"],
    };
    const names = (process.env.COMPS || Object.keys(comps).join(",")).split(",");
    names.forEach((n, i) => {
      const ranks = comps[n].map((r) => (r === K && n === "E" ? K : r));
      const side = withFort({ ...fixedSide(ranks, K), foil: "king", act: turtleAct({ worstCaseKing: true, shell: 12 }) });
      if (process.env.CENTER === "1") side.arrange = (st, p, plan) => fortressArrange(st, p, plan, 3);
      rows.push(...runPair(`${K}+氷 comp${n} [${ranks.join(",")}] vs ${F}`, [side, foe(F)], 93260910 + i * 1000003));
      console.error(`${n} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    });
  } else if (process.env.ONLY === "mirror") {
    const mk = (k) => withFort({ king: k, foil: "king", ...prioritySide(k, BLOCK), act: turtleAct({ worstCaseKing: true }) });
    rows.push(...runPair(`fort 9+氷 vs fort 8+氷`, [mk("9"), mk("8")], 90260910));
    rows.push(...runPair(`fort 9+氷 vs fort 10+空`, [mk("9"), mk("10")], 91260910));
    rows.push(...runPair(`fort 9+氷 vs fort K+宮殿`, [mk("9"), mk("K")], 92260910));
  } else if (process.env.ONLY === "shell") {
    which.forEach((k, i) => {
      const base = 90260910 + i * 1000003;
      rows.push(...runPair(`${k}+氷 fort/block+worst vs ${F}`, [withFort({ king: k, foil: "king", ...prioritySide(k, BLOCK), act: turtleAct({ worstCaseKing: true }) }), foe(F)], base));
      rows.push(...runPair(`${k}+氷 fort/block+worst+shell vs ${F}`, [withFort({ king: k, foil: "king", ...prioritySide(k, BLOCK), act: turtleAct({ worstCaseKing: true, shell: 12 }) }), foe(F)], base));
      rows.push(...runPair(`${k}+氷 fort/block+worst+shell6 vs ${F}`, [withFort({ king: k, foil: "king", ...prioritySide(k, BLOCK), act: turtleAct({ worstCaseKing: true, shell: 12, attackAfterFrozen: 6 }) }), foe(F)], base));
      console.error(`${k} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    });
  } else
  which.forEach((k, i) => {
    const base = 90260910 + i * 1000003;
    rows.push(...runPair(`${k}+氷 turtle/wall vs ${F}`, [{ king: k, foil: "king", ...prioritySide(k, WALL), act: turtleAct() }, foe(F)], base));
    rows.push(...runPair(`${k}+氷 wall+worst vs ${F}`, [{ king: k, foil: "king", ...prioritySide(k, WALL), act: turtleAct({ worstCaseKing: true }) }, foe(F)], base));
    rows.push(...runPair(`${k}+氷 fort/wall+worst vs ${F}`, [withFort({ king: k, foil: "king", ...prioritySide(k, WALL), act: turtleAct({ worstCaseKing: true }) }), foe(F)], base));
    rows.push(...runPair(`${k}+氷 fort/block+worst vs ${F}`, [withFort({ king: k, foil: "king", ...prioritySide(k, BLOCK), act: turtleAct({ worstCaseKing: true }) }), foe(F)], base));
    rows.push(...runPair(`${k} 無し fort/block+worst vs ${F}`, [withFort({ king: k, foil: false, ...prioritySide(k, BLOCK), act: turtleAct({ worstCaseKing: true }) }), foe(F)], base));
    console.error(`${k} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  });
} else if (mode === "fortmatrix") {
  // 全エリア総当たり(両者とも要塞型・フォイルあり)。VS_NONE=1 なら各エリア対「同じ王でフォイル無し」
  const groups = { earth: ["2", "3"], sea: ["4", "5"], forest: ["6", "7"], ice: ["8", "9"], sky: ["10"], palace: ["J", "Q", "K"] };
  const BLOCK = (r, c) => ({ J: 8, Q: 8, 4: 7, 2: 6, 8: 6, A: c.A ? 0 : 3, 10: 5, 5: 5, 3: 5, 9: 4, 6: 4, 7: 4 }[r] ?? 0) - dup(r, c);
  const mk = (k, foil) => ({ king: k, foil, ...prioritySide(k, BLOCK), act: fortAct(), arrange: fortressArrange });
  const types = Object.keys(groups);
  const pairs = process.env.VS_NONE === "1" ? types.map((t) => [t, "none"]) : process.env.VS_FREE === "1" ? types.map((t) => [t, "free"]) : types.flatMap((t, i) => types.slice(i + 1).map((u) => [t, u]));
  const only = process.env.ONLY_AREA;
  pairs.forEach(([a, b], i) => {
    if (only && a !== only && b !== only) return;
    const seedBase = 97260910 + i * 1000003;
    // 帯の中の王を配札ごとに交代
    const rowsHere = [];
    for (let n = 0; n < SEEDS; n++) {
      const ka = groups[a][n % groups[a].length];
      const kb = b === "none" ? ka : b === "free" ? null : groups[b][Math.floor(n / groups[a].length) % groups[b].length];
      const sides = [mk(ka, "king"), b === "free" ? free() : mk(kb, b === "none" ? false : "king")];
      let seed = seedBase + n * 7919, base;
      for (let attempt = 0; attempt < 200; attempt++) { try { base = setup(seed, sides); break; } catch (e) { if (!/hand|setup/.test(String(e.message))) throw e; seed += 15485863; } }
      const kings = [0, 1].map((i) => kingRankOf(base.s, i));
      for (const first of [0, 1]) rowsHere.push({ label: `${a} vs ${b}`, seed, first, kings, counts: [0, 1].map((i) => base.s.players[i].armyRankCounts), straight: [false, false], flush: [false, false], ...play(base.s, first, seed + first * 104729, sides) });
    }
    rows.push(...rowsHere);
    console.error(`${a}/${b} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  });
} else if (mode === "skylab") {
  // 空の駒選び・布陣の探索。FOE: free | fortice | fortpalace | sky(通常CPUの空) | fortsea
  const comps = {
    S1: ["10","10","10","J","Q","4","2","8","8"],
    S2: ["10","J","J","Q","Q","4","2","8","8"],
    S3: ["10","10","J","Q","2","2","3","4","8"],
    S4: ["10","J","Q","4","4","2","2","8","3"],
    S5: ["10","10","10","10","J","Q","4","2","8"],
    S6: ["10","10","J","J","Q","Q","4","2","8"],
  };
  const BLOCK = (r, c) => ({ J: 8, Q: 8, 4: 7, 2: 6, 8: 6, A: c.A ? 0 : 3, 10: 5, 5: 5, 3: 5, 9: 4, 6: 4, 7: 4 }[r] ?? 0) - dup(r, c);
  const F = process.env.FOE || "free";
  const foe = () => F === "free" ? free()
    : F === "sky" ? { king: "10", foil: "king", ...stockSide("10") }
    : F === "fortice" ? { ...fixedSide(["9","J","J","Q","Q","4","2","8","8"], "9"), foil: "king", act: fortAct(), arrange: fortressArrange }
    : F === "fortpalace" ? { king: "K", foil: "king", ...prioritySide("K", BLOCK), act: fortAct(), arrange: fortressArrange }
    : F === "fortsea" ? { king: "5", foil: "king", ...prioritySide("5", BLOCK), act: fortAct(), arrange: fortressArrange }
    : free();
  const forms = (process.env.FORMS || "corner,center,stock").split(",");
  const names = (process.env.COMPS || "S2").split(",");
  const styles = (process.env.STYLES || "sky").split(",");
  let i = 0;
  for (const n of names) for (const form of forms) for (const style of styles) {
    const side = { ...fixedSide(comps[n], "10"), foil: "king" };
    if (style === "sky") side.act = skyAct();
    else if (style === "skyfast") side.act = skyAct({ advance: 2, burstMin: 6 });
    else if (style === "skyslow") side.act = skyAct({ advance: 0.6, burstMin: 12 });
    if (form === "corner") side.arrange = fortressArrange;
    else if (form === "center") side.arrange = (st, p, plan) => fortressArrange(st, p, plan, 3);
    rows.push(...runPair(`${n} ${form} ${style} vs ${F}`, [side, foe()], 98260910 + i++ * 1000003));
    console.error(`${n}/${form}/${style} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
} else if (mode === "matrix2") {
  // 各エリアが自分に合った指し方を使う総当たり。STYLE_MAP="sky:advance,palace:fort,..."(既定は下)
  const groups = { earth: ["2", "3"], sea: ["4", "5"], forest: ["6", "7"], ice: ["8", "9"], sky: ["10"], palace: ["J", "Q", "K"] };
  const BLOCK = (r, c) => ({ J: 8, Q: 8, 4: 7, 2: 6, 8: 6, A: c.A ? 0 : 3, 10: 5, 5: 5, 3: 5, 9: 4, 6: 4, 7: 4 }[r] ?? 0) - dup(r, c);
  const SKYP = (r, c) => ({ 10: 9, J: 8, Q: 8, 4: 7, 2: 6, 8: 6, A: c.A ? 0 : 2, 5: 5, 3: 5, 9: 4, 6: 4, 7: 4 }[r] ?? 0) - dup(r, c);
  const defaults = { earth: "fort", sea: "fort", forest: "fort", ice: "fort", sky: "advance", palace: "fort" };
  const styleMap = { ...defaults };
  for (const kv of (process.env.STYLE_MAP || "").split(",").filter(Boolean)) { const [k, v] = kv.split(":"); styleMap[k] = v; }
  const mk = (type, k) => {
    const st = styleMap[type];
    const pri = type === "sky" ? SKYP : BLOCK;
    if (st === "advance") return { king: k, foil: "king", ...prioritySide(k, pri), act: skyAct() };
    if (st === "stock") return { king: k, foil: "king", ...stockSide(k) };
    return { king: k, foil: "king", ...prioritySide(k, pri), act: fortAct(), arrange: fortressArrange };
  };
  const types = Object.keys(groups);
  const pairs = types.flatMap((t, i) => types.slice(i + 1).map((u) => [t, u]));
  pairs.forEach(([a, b], i) => {
    const seedBase = 99260910 + i * 1000003;
    for (let n = 0; n < SEEDS; n++) {
      const ka = groups[a][n % groups[a].length];
      const kb = groups[b][Math.floor(n / groups[a].length) % groups[b].length];
      const sides = [mk(a, ka), mk(b, kb)];
      let seed = seedBase + n * 7919, base;
      for (let attempt = 0; attempt < 200; attempt++) { try { base = setup(seed, sides); break; } catch (e) { if (!/hand|setup/.test(String(e.message))) throw e; seed += 15485863; } }
      const kings = [0, 1].map((i) => kingRankOf(base.s, i));
      for (const first of [0, 1]) rows.push({ label: `${a} vs ${b}`, seed, first, kings, counts: [0, 1].map((i) => base.s.players[i].armyRankCounts), straight: [false, false], flush: [false, false], ...play(base.s, first, seed + first * 104729, sides) });
    }
    console.error(`${a}/${b} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  });
} else if (mode === "arealab") {
  // エリアごとの駒選び・布陣の探索。AREA=earth|forest|ice|sky、COMPS、FORMS、FOE(free|fortice|fortpalace|advsky|stocksky)
  const AREA = process.env.AREA || "earth";
  const comps = {
    earth: {
      E1: ["2","2","2","2","J","Q","10","8","4"], E2: ["2","2","2","J","J","Q","Q","4","8"], E3: ["3","3","3","3","J","Q","10","9","5"],
      E4: ["2","2","J","Q","10","10","4","8","8"], E5: ["3","3","3","J","J","Q","Q","5","9"], E6: ["2","2","2","2","J","J","Q","Q","10"],
    },
    forest: {
      F1: ["6","J","J","Q","Q","10","10","4","2"], F2: ["7","J","J","Q","Q","10","10","4","8"], F3: ["6","6","J","Q","10","10","10","8","4"],
      F4: ["7","7","J","J","Q","Q","10","4","2"], F5: ["6","J","J","Q","Q","4","2","8","8"], F6: ["7","J","J","Q","Q","4","2","8","8"],
    },
    ice: { I1: ["8","J","J","Q","Q","4","2","8","8"], I2: ["9","J","J","Q","Q","4","2","8","8"], I3: ["8","J","J","Q","Q","4","4","2","2"] },
    sky: { S6: ["10","10","J","J","Q","Q","4","2","8"], S2: ["10","J","J","Q","Q","4","2","8","8"], S1: ["10","10","10","J","Q","4","2","8","8"] },
  }[AREA];
  const forestStyle = () => process.env.FOREST_STYLE === "hunt"
    ? skyAct({ advance: 1.4, candidateBonus: 120, unknownBonus: 3, burstMin: 99 })          // 待たずに、正体不明の駒を狩りに行く
    : process.env.FOREST_STYLE === "fort" ? fortAct()                                         // 要塞で待つだけ
    : forestAct(process.env.SAFE_HUNT === "1" ? { safeHunt: true } : {});
  const actOf = { earth: earthAct, forest: forestStyle, ice: iceAct, sky: skyAdaptiveAct }[AREA];
  const BLOCK = (r, c) => ({ J: 8, Q: 8, 4: 7, 2: 6, 8: 6, A: c.A ? 0 : 3, 10: 5, 5: 5, 3: 5, 9: 4, 6: 4, 7: 4 }[r] ?? 0) - dup(r, c);
  const F = process.env.FOE || "free";
  const foe = () => F === "free" ? free()
    : F === "stocksky" ? { king: "10", foil: "king", ...stockSide("10") }
    // 相手の手札は固定せず、残りの札から優先度で組む(こちらの固定手札と札の枚数が競合しないように)
    : F === "advsky" ? { king: "10", foil: "king", ...prioritySide("10", (r, c) => ({ 10: 9, J: 8, Q: 8, 4: 7, 2: 6, 8: 6, A: c.A ? 0 : 2, 5: 5, 3: 5, 9: 4, 6: 4, 7: 4 }[r] ?? 0) - dup(r, c)), act: skyAct() }
    : F === "fortice" ? { king: "9", foil: "king", ...prioritySide("9", BLOCK), act: fortAct(), arrange: fortressArrange }
    : F === "fortpalace" ? { king: "K", foil: "king", ...prioritySide("K", BLOCK), act: fortAct(), arrange: fortressArrange }
    : free();
  const forms = (process.env.FORMS || "stock,center,corner").split(",");
  const names = (process.env.COMPS || Object.keys(comps).join(",")).split(",");
  let i = 0;
  for (const n of names) for (const form of forms) {
    const ranks = comps[n];
    const side = { ...fixedSide(ranks, ranks[0]), foil: "king", act: actOf() };
    if (form === "corner") side.arrange = fortressArrange;
    else if (form === "center") side.arrange = (st, p, plan) => fortressArrange(st, p, plan, 3);
    rows.push(...runPair(`${AREA} ${n} ${form} vs ${F}`, [side, foe()], 101260910 + i++ * 1000003));
    console.error(`${n}/${form} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
} else if (mode === "mirror") {
  // 先手の値打ち: 自由同士・フォイル無し
  rows.push(...runPair("free-vs-free", [free(), free()], 50260910));
}
fs.writeFileSync(OUT, JSON.stringify(rows));
console.log(summarize(rows));
console.log(`games ${rows.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
