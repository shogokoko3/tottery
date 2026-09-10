/**
 * エリア別の定石CPU。9×9 の「エリアごとのCPU戦」で、選んだエリアの定石
 * (札の組み方・布陣・指し方)で戦う相手。tools/fortress-lab.mjs で検証した
 * 指し方をそのまま製品に移したもの(2026-09-11)。
 *
 * 相手の伏せ札の数字・王かどうかは読まない(cpu-informed.js と同じ線)。
 * 相手の応手を読むときは、正体の分からない駒は「どの数字でもありうる」として
 * 全部の動きを数える(最悪ケース。tools/check-cpu-joseki.mjs が見張る)。
 *
 * 定石そのものは reports/fortress-tactics/定石集.html にまとめてある。
 */
import {
  buildDeck,
  getLegalMoves as legal,
  kingRankOf,
  maxAdopt,
  shuffle,
  territoryRows,
  totalSlots,
} from "./board.js";
import {
  AREA_BY_RANK,
  canUseArea,
  isFrozen,
  isKnownTo,
  palaceCandidates,
  palacePromotionRank,
  skyCandidates,
} from "./areas.js";
import { knownThreats, unknownThreatMap, moveSafety } from "./cpu-tactics.js";
import { opponentKingBelief } from "./king-belief.js";
import {
  CARD_VALUE,
  arrangeArmy,
  chooseArmyPlan,
  formationMetrics,
  strategicDiscards,
} from "./cpu-strategy.js";
import { cpuInformedAction } from "./cpu-informed.js";
import { reserveDeployment } from "./cpu-palace.js";
import { automaticAreaAction } from "./area-presentation.js";

const ALL_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
/** エリアごとの王の数字 */
export const JOSEKI_KINGS = Object.freeze({
  earth: ["2", "3"],
  sea: ["4", "5"],
  forest: ["6", "7"],
  ice: ["8", "9"],
  sky: ["10"],
  palace: ["J", "Q", "K"],
});
export const JOSEKI_AREAS = Object.freeze([
  "earth",
  "sea",
  "forest",
  "ice",
  "sky",
  "palace",
]);
/** 画面に出す短い名前と、その定石の一言 */
export const JOSEKI_INFO = Object.freeze({
  earth: {
    label: "土",
    style: "軌跡の追跡者",
    text: "王ごと前に出て、正体の分からない駒を狩りに来る",
  },
  sea: {
    label: "海",
    style: "荒波の航海士",
    text: "王は守り、王と同じ数字の仲間が道連れ覚悟で突っ込んでくる",
  },
  forest: {
    label: "森",
    style: "静寂な狩人",
    text: "隅に固まって見抜き、王が割れたら一気に詰めに来る",
  },
  ice: {
    label: "氷",
    style: "堅牢な要塞",
    text: "隅の要塞で徹底的に守り、凍らせてから取りに来る",
  },
  sky: {
    label: "空",
    style: "双翼の将",
    text: "こちらの出方を見て、一気に返すかゆっくり進むかを切り替える",
  },
  palace: {
    label: "宮殿",
    style: "覇道",
    text: "毎手番の昇格で仲間を育て、強い駒がそろったら進軍してくる",
  },
});

/* ---------------------------- 駒選び ---------------------------- */

const dup = (r, counts) => (counts[r] || 0) * 0.65;
/** 定石の9枚(王を先頭に)。手札に無い数字は planByPriority が埋める */
export const JOSEKI_HANDS = Object.freeze({
  earth: (k) => [k, k, k, k, "J", "J", "Q", "Q", "10"],
  sea: (k) => [k, k, k, k, "J", "J", "Q", "Q", "10"],
  forest: (k) => [k, "J", "J", "Q", "Q", "10", "10", "4", "2"],
  ice: (k) => [k, "J", "J", "Q", "Q", "4", "4", "2", "2"],
  sky: (k) => [k, "10", "J", "J", "Q", "Q", "4", "2", "8"],
  palace: (k) => [k, "J", "Q", "10", "10", "10", "9", "4", "2"],
});
/** 手札から9枚を選ぶ優先度(数字, これまでの枚数) → 点。定石に近い札から取る */
const PRIORITY = {
  earth: (k) => (r, c) =>
    (r === k
      ? 10
      : ({ J: 8, Q: 8, 10: 7, 4: 5, 8: 5, 2: 4, 3: 4, 5: 3, 9: 3, A: c.A ? 0 : 2, 6: 2, 7: 2 }[r] ?? 0)) -
    dup(r, c) +
    (r === k ? 0.65 * (c[r] || 0) : 0),
  forest: () => (r, c) =>
    ({ J: 8, Q: 8, 10: 8, 4: 6, 2: 6, 8: 5, 3: 4, 5: 4, 9: 3, A: c.A ? 0 : 2, 6: 2, 7: 2 }[r] ?? 0) - dup(r, c),
  ice: () => (r, c) =>
    ({ J: 8, Q: 8, 4: 7, 2: 7, 8: 5, 3: 4, 5: 4, 10: 4, 9: 3, A: c.A ? 0 : 2, 6: 2, 7: 2 }[r] ?? 0) - dup(r, c),
  sky: () => (r, c) =>
    ({ 10: 9, J: 8, Q: 8, 4: 7, 2: 6, 8: 6, A: c.A ? 0 : 2, 5: 5, 3: 5, 9: 4, 6: 4, 7: 4 }[r] ?? 0) - dup(r, c),
  sea: (k) => (r, c) =>
    (r === k
      ? 10
      : ({ J: 8, Q: 8, 10: 6, 8: 4, 2: 4, 3: 3, 9: 3, A: c.A ? 0 : 2, 6: 2, 7: 2 }[r] ?? 0)) -
    dup(r, c) +
    (r === k ? 0.65 * (c[r] || 0) : 0),
  palace: () => (r, c) =>
    ({ J: 8, Q: 8, 10: 9, 9: 7, 4: 5, 2: 5, 8: 4, 3: 3, 5: 3, A: 0, 6: 2, 7: 2 }[r] ?? 0) - dup(r, c),
};

/** 優先度で 9 枚を貪欲に選ぶ。王の数字が手札に無ければ null */
export function planByPriority(state, player, kingRank, priority) {
  const hand = state.players[player].hand,
    slots = totalSlots(state.boardSize);
  const king = hand.find((c) => c.rank === kingRank);
  if (!king) return null;
  const cards = [king],
    counts = { [kingRank]: 1 };
  while (cards.length < slots) {
    const opts = hand.filter(
      (c) =>
        !cards.includes(c) && (counts[c.rank] || 0) < maxAdopt(c.rank, kingRank),
    );
    if (!opts.length) break;
    opts.sort(
      (a, b) =>
        priority(b.rank, counts, kingRank) - priority(a.rank, counts, kingRank),
    );
    const c = opts[0];
    cards.push(c);
    counts[c.rank] = (counts[c.rank] || 0) + 1;
  }
  if (cards.length < slots) return null;
  const area =
    state.areasEnabled &&
    typeof state.areaLoadouts?.[player]?.[kingRank] === "string"
      ? AREA_BY_RANK[kingRank]
      : null;
  return { cards, kingId: king.id, kingRank, counts, area };
}
/** 優先度から、採用の計画と引き直す札(採用しない札から最大4枚)を作る側 */
export function prioritySide(kingRank, priority) {
  const plan = (s, p) => planByPriority(s, p, kingRank, priority);
  return {
    plan,
    discards: (s, p) => {
      const pl = plan(s, p);
      if (!pl) return [];
      const keep = new Set(pl.cards.map((c) => c.id));
      return s.players[p].hand
        .filter((c) => !keep.has(c.id))
        .slice(0, 4)
        .map((c) => c.id);
    },
  };
}

/* ---------------------------- 布陣 ---------------------------- */

/** 隅の要塞: 自陣の隅 3×3 を9体で埋め、王をいちばん奥に置く。残りは取り返しが最大になるよう並べ替える */
export function fortressArrange(state, player, plan, col0 = 0) {
  const size = state.boardSize,
    [lo, hi] = territoryRows(size, player);
  const back = player === 0 ? hi : lo,
    dir = player === 0 ? -1 : 1;
  const cells = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) cells.push({ row: back + dir * i, col: col0 + j });
  const corner = cells[0];
  const others = plan.cards.filter((c) => c.id !== plan.kingId);
  const placement = { [plan.kingId]: corner };
  others.forEach((c, i) => (placement[c.id] = cells[i + 1]));
  const score = (pl) => formationMetrics(plan, pl, size, player).score;
  let best = placement,
    bestScore = score(best);
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (const a of others)
      for (const b of others) {
        if (a.id >= b.id) continue;
        const trial = { ...best, [a.id]: best[b.id], [b.id]: best[a.id] };
        const sc = score(trial);
        if (sc > bestScore + 1e-6) {
          best = trial;
          bestScore = sc;
          improved = true;
        }
      }
    if (!improved) break;
  }
  return best;
}
/** 王の升を決めて、残りは取り返しが最大になるよう自陣の中で局所探索する */
export function arrangeKingAt(state, player, plan, kingCell) {
  const size = state.boardSize,
    [lo, hi] = territoryRows(size, player);
  const cells = [];
  for (let row = lo; row <= hi; row++)
    for (let col = 0; col < size; col++) cells.push({ row, col });
  const mid = Math.floor(size / 2);
  const ordered = cells
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.col - mid) * 2 +
        Math.abs(a.row - kingCell.row) -
        (Math.abs(b.col - mid) * 2 + Math.abs(b.row - kingCell.row)),
    );
  const placement = { [plan.kingId]: kingCell },
    used = new Set([`${kingCell.row}/${kingCell.col}`]);
  for (const card of plan.cards)
    if (card.id !== plan.kingId) {
      const c = ordered.find((c) => !used.has(`${c.row}/${c.col}`));
      placement[card.id] = c;
      used.add(`${c.row}/${c.col}`);
    }
  let best = placement,
    score = formationMetrics(plan, best, size, player).score;
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (const card of plan.cards) {
      if (card.id === plan.kingId) continue;
      for (const cell of cells) {
        if (cell.row === kingCell.row && cell.col === kingCell.col) continue;
        const from = best[card.id];
        if (from.row === cell.row && from.col === cell.col) continue;
        const other = plan.cards.find(
          (c) =>
            c.id !== plan.kingId &&
            best[c.id].row === cell.row &&
            best[c.id].col === cell.col,
        );
        const trial = { ...best, [card.id]: cell };
        if (other) trial[other.id] = from;
        const next = formationMetrics(plan, trial, size, player).score;
        if (next > score + 0.001) {
          best = trial;
          score = next;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
}
/** 土: 王を中列の中央に */
function arrangeMidKing(state, player, plan) {
  const [lo, hi] = territoryRows(state.boardSize, player);
  return arrangeKingAt(state, player, plan, {
    row: player === 0 ? lo + 1 : hi - 1,
    col: 4,
  });
}

/* ---------------------------- 読みの道具 ---------------------------- */

const BAND = JOSEKI_KINGS;
/**
 * 2手先の王の危険(6〜9の王の「線をまとめて取る」動きに限る): 相手のエリアから王の帯が分かるとき、
 * 正体不明の相手の駒が帯の王だとして1手動いた先から、次の手で自分の王を(まとめ取りで)取れるか
 */
function sweepThreatIn2(s, me, board, kingAt, ignore = new Set()) {
  const band = BAND[s.areas?.[1 - me]?.type];
  if (!band || !["6", "7", "8", "9"].includes(band[0])) return false;
  for (const e of Object.values(s.pieces)) {
    if (!e.alive || e.owner === me || ignore.has(e.id) || isFrozen(s, e)) continue;
    const at = board[e.row]?.[e.col];
    if (!at || at.id !== e.id) continue;
    if (isKnownTo(s, me, e) && !e.isKing) continue;
    const ranks = isKnownTo(s, me, e) ? [e.rank] : band;
    for (const rank of ranks) {
      const q = { ...e, rank, isKing: true };
      for (const m of legal(q, board, s.boardSize, {}, undefined)) {
        if (m.capture) continue;
        const b2 = board.map((r) => r.slice());
        b2[q.row][q.col] = null;
        const q2 = { ...q, row: m.row, col: m.col };
        b2[m.row][m.col] = q2;
        if (
          legal(q2, b2, s.boardSize, {}, undefined).some(
            (mv) =>
              (mv.row === kingAt.row && mv.col === kingAt.col) ||
              (mv.captures || []).some(
                (c) => c.row === kingAt.row && c.col === kingAt.col,
              ),
          )
        )
          return true;
      }
    }
  }
  return false;
}
/** 相手のどの駒かが「どのランクだとしても」王の升に届くか(最悪ケース) */
function kingReachable(s, me, board, kingAt, ignore = new Set()) {
  for (const e of Object.values(s.pieces)) {
    if (!e.alive || e.owner === me || ignore.has(e.id) || isFrozen(s, e)) continue;
    const at = board[e.row]?.[e.col];
    if (!at || at.id !== e.id) continue;
    // 正体の分からない駒は、どの数字の王でもありうるとして見る(伏せ札は読まない)
    const known = isKnownTo(s, me, e);
    const ranks = known ? [e.rank] : ALL_RANKS;
    for (const rank of ranks) {
      const q = { ...e, rank, isKing: known ? !!e.isKing : true };
      if (
        legal(q, board, s.boardSize, {}, undefined).some(
          (m) =>
            (m.row === kingAt.row && m.col === kingAt.col) ||
            (m.captures || []).some(
              (c) => c.row === kingAt.row && c.col === kingAt.col,
            ),
        )
      )
        return e;
    }
  }
  return null;
}
const hitsCell = (m, t) =>
  (m.row === t.row && m.col === t.col) ||
  (m.captures || []).some((c) => c.row === t.row && c.col === t.col);

/* ---------------------------- 守りの指し方 ---------------------------- */

const KN = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];
const RING = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const stop = (s) =>
  s.phase !== "play" ||
  s.pendingKingChoice ||
  s.kPlacement ||
  s.extraMoveFor ||
  s.winner != null;

/**
 * 要塞の指し方: 相手のどの駒がどの数字でも王に届く手は指さない。全駒を取り返せる形を保ち、
 * 王の周りを厚くする。自陣から出るのは取るとき・相手が凍りきったときだけ
 */
export function turtleAct(opts = {}) {
  const {
    attackAfterFrozen = 3,
    unknownWeight = 0.8,
    worstCaseKing = false,
    shell = 0,
    twoPly = false,
  } = opts;
  const shellCount = (s, me, board, kingAt, pieces) => {
    const cells = [];
    for (const [dr, dc] of [...RING, ...KN]) {
      const r = kingAt.row + dr,
        c = kingAt.col + dc;
      if (r >= 0 && r < s.boardSize && c >= 0 && c < s.boardSize)
        cells.push({ r, c });
    }
    let n = 0;
    const counts = s.players[me].armyRankCounts,
      kr = kingRankOf(s, me);
    for (const { r, c } of cells) {
      const at = board[r][c];
      if (at && at.owner === me) {
        n++;
        continue;
      }
      if (at && at.owner !== me) continue;
      board[r][c] = { id: "x", owner: 1 - me, row: r, col: c };
      if (
        pieces.some(
          (q) =>
            !q.isKing &&
            !isFrozen(s, q) &&
            q.rank !== "A" &&
            legal(q, board, s.boardSize, counts, kr).some(
              (mv) => mv.row === r && mv.col === c,
            ),
        )
      )
        n++;
      board[r][c] = null;
    }
    return n / cells.length;
  };
  return (s, me) => {
    if (stop(s)) return null;
    const mine = Object.values(s.pieces).filter(
      (p) => p.alive && p.owner === me && !isFrozen(s, p) && p.rank !== "A",
    );
    if (!mine.length) return null;
    const enemies = Object.values(s.pieces).filter(
      (p) => p.alive && p.owner !== me,
    );
    const frozenN = enemies.filter((p) => isFrozen(s, p)).length;
    const aggressive = frozenN >= attackAfterFrozen || enemies.length <= 5;
    const unknown = unknownThreatMap(s, me);
    const threatsNow = knownThreats(s, me);
    const belief = opponentKingBelief(s, me);
    const cand = new Set(belief.candidates.map((c) => c.id));
    const king = s.pieces[s.players[me].kingId];
    const [lo, hi] = territoryRows(s.boardSize, me);
    const inHome = (r) => r >= lo && r <= hi;
    const kingThreatened =
      king &&
      (threatsNow.has(`${king.row}/${king.col}`) ||
        (unknown.get(`${king.row}/${king.col}`) || 0) > 0.35);
    const counts = s.players[me].armyRankCounts,
      kr = kingRankOf(s, me);
    const guardedCount = (board, pieces) => {
      let n = 0;
      for (const t of pieces) {
        board[t.row][t.col] = { id: "x", owner: 1 - me, row: t.row, col: t.col };
        if (
          pieces.some(
            (q) =>
              q.id !== t.id &&
              !isFrozen(s, q) &&
              q.rank !== "A" &&
              legal(q, board, s.boardSize, counts, kr).some(
                (mv) => mv.row === t.row && mv.col === t.col,
              ),
          )
        )
          n++;
        board[t.row][t.col] = t;
      }
      return n;
    };
    const allMine = Object.values(s.pieces).filter(
      (p) => p.alive && p.owner === me,
    );
    const guardedNow = guardedCount(
      s.board.map((r) => r.slice()),
      allMine,
    );
    let best = null;
    for (const p of mine) {
      for (const m of legal(p, s.board, s.boardSize, counts, kr)) {
        const ids = new Set(
          (m.captures || [])
            .map((c) => s.board[c.row]?.[c.col]?.id)
            .filter(Boolean),
        );
        const t = s.board[m.row][m.col];
        if (t && t.owner !== me) ids.add(t.id);
        let score = 0;
        for (const id of ids) {
          const q = s.pieces[id];
          const known = isKnownTo(s, me, q);
          score += (known ? CARD_VALUE[q.rank] : 3.5) * 2;
          if (isFrozen(s, q)) score += 4;
          if (known && q.isKing) score += 1000;
          else if (cand.has(id)) score += 60 * belief.weight;
        }
        score += moveSafety(s, me, p, m, ids, {
          unknownWeight,
          unknownThreats: unknown,
        });
        const out =
          me === 0 ? Math.max(0, lo - m.row) : Math.max(0, m.row - hi);
        if (!ids.size && !aggressive)
          score -= out * 3 + (inHome(p.row) ? 0 : -1);
        if (!ids.size && aggressive) score -= out * 0.5;
        if (p.isKing) score += kingThreatened ? 6 : -10;
        if (
          !p.isKing &&
          king &&
          Math.max(Math.abs(p.row - king.row), Math.abs(p.col - king.col)) <= 1 &&
          Math.max(Math.abs(m.row - king.row), Math.abs(m.col - king.col)) > 1
        )
          score -= 3;
        {
          const board = s.board.map((r) => r.slice());
          board[p.row][p.col] = null;
          for (const id of ids) {
            const q = s.pieces[id];
            board[q.row][q.col] = null;
          }
          const moved = { ...p, row: m.row, col: m.col };
          board[m.row][m.col] = moved;
          const after = guardedCount(
            board,
            allMine.map((q) => (q.id === p.id ? moved : q)),
          );
          score += (after - guardedNow) * 2.5;
          if (worstCaseKing && king) {
            const kAt = p.isKing ? moved : king;
            const danger = kingReachable(s, me, board, kAt, ids);
            if (danger) score -= 80;
            if (shell)
              score +=
                shell *
                shellCount(
                  s,
                  me,
                  board,
                  kAt,
                  allMine.map((q) => (q.id === p.id ? moved : q)),
                );
            if (twoPly && !danger && sweepThreatIn2(s, me, board, kAt, ids))
              score -= 40;
          }
        }
        score += Math.random() * 0.5;
        if (!best || score > best.score)
          best = {
            score,
            type: "MOVE_PIECE",
            pieceId: p.id,
            row: m.row,
            col: m.col,
            captures: m.captures,
          };
      }
    }
    if (!best) return null;
    const { score, ...action } = best;
    return action;
  };
}

/* ---------------------------- 進軍の指し方 ---------------------------- */

/**
 * 進軍の指し方(空の攻め方が元): 取り返せる形を保って前へ出て、一気に取れるときだけ変身と2回行動。
 * 伏せ札の中身は読まない。土・森・海はこれの調整違い
 */
export function skyAct(opts = {}) {
  const {
    advance: advance0 = 1.2,
    unknownWeight = 0.8,
    shell = 8,
    burstMin: burstMin0 = 9,
    endgame = 4,
    adaptive = false, // 空: 相手の出方(前に出ているか)で、一気に攻めるか、ゆっくり進むかを切り替える
    candidateBonus = 60, // 王候補(正体不明の駒)を取る手の加点(信念の重み倍)
    unknownBonus = 0, // 正体不明の駒を取る手そのものの加点(土・森の「匿名性を剥がす」狩り)
    kingExpendable = false, // 土: 継承者が居るあいだは王の危険を軽く見る(王が前に出て狩る)
    ready = null, // 森: (s, me, belief) => 攻めに転じてよいか。偽のあいだは自陣で待つ
    kingPenaltyOverride = null, // 王を晒す手の減点(既定80)を差し替える
    twoPly = false, // 6〜9の王の「線のまとめ取り」を2手先まで見る
    kamikazeRank = null, // 海: 王と同じ数字の仲間。取られても道連れなので自分の危険を軽く見て突っ込む
    kamikazeAdvance = 2.0,
    seaMode = "cpu", // 海の発動: "cpu"(通常CPUの判断) / "always" / "never"
  } = opts;
  return (s, me) => {
    if (
      s.phase !== "play" ||
      s.pendingKingChoice ||
      s.kPlacement ||
      s.winner != null
    )
      return null;
    const extra = s.extraMoveFor;
    const allMine = Object.values(s.pieces).filter(
      (p) => p.alive && p.owner === me,
    );
    const movers = extra
      ? allMine.filter((p) => p.id === extra)
      : allMine.filter((p) => !isFrozen(s, p) && p.rank !== "A");
    if (!movers.length) return extra ? { type: "SKIP_EXTRA_ACTION" } : null;
    const enemies = Object.values(s.pieces).filter(
      (p) => p.alive && p.owner !== me,
    );
    const unknown = unknownThreatMap(s, me);
    const threatsNow = knownThreats(s, me);
    const belief = opponentKingBelief(s, me);
    const cand = new Set(belief.candidates.map((c) => c.id));
    const king = s.pieces[s.players[me].kingId];
    const dir = me === 0 ? -1 : 1;
    const counts = s.players[me].armyRankCounts,
      kr = kingRankOf(s, me);
    const kingThreatened =
      king &&
      (threatsNow.has(`${king.row}/${king.col}`) ||
        (unknown.get(`${king.row}/${king.col}`) || 0) > 0.35);
    const [flo, fhi] = territoryRows(s.boardSize, 1 - me);
    const foeOut =
      enemies.filter((e) => e.row < flo || e.row > fhi).length /
      Math.max(1, enemies.length);
    let advance = advance0,
      burstMin = burstMin0;
    if (adaptive) {
      if (foeOut >= 0.3) {
        advance = 0.4;
        burstMin = 6;
      } else if (foeOut <= 0.1) {
        advance = 1.4;
        burstMin = 9;
      }
    }
    const heirs =
      king && ["2", "3"].includes(king.rank)
        ? allMine.filter((q) => q.rank === king.rank && !q.isKing).length
        : 0;
    const kingPenalty =
      kingPenaltyOverride != null
        ? kingPenaltyOverride
        : kingExpendable && heirs > 0
          ? 18
          : 80;
    const waiting = ready ? !ready(s, me, belief, allMine, enemies) : false;
    const guardedCount = (board, pieces) => {
      let n = 0;
      for (const t of pieces) {
        board[t.row][t.col] = { id: "x", owner: 1 - me, row: t.row, col: t.col };
        if (
          pieces.some(
            (q) =>
              q.id !== t.id &&
              !isFrozen(s, q) &&
              q.rank !== "A" &&
              legal(q, board, s.boardSize, counts, kr).some(
                (mv) => mv.row === t.row && mv.col === t.col,
              ),
          )
        )
          n++;
        board[t.row][t.col] = t;
      }
      return n;
    };
    const shellCount = (board, kingAt, pieces) => {
      let n = 0,
        total = 0;
      for (const [dr, dc] of [...RING, ...KN]) {
        const r = kingAt.row + dr,
          c = kingAt.col + dc;
        if (r < 0 || r >= s.boardSize || c < 0 || c >= s.boardSize) continue;
        total++;
        const at = board[r][c];
        if (at && at.owner === me) {
          n++;
          continue;
        }
        if (at) continue;
        board[r][c] = { id: "x", owner: 1 - me, row: r, col: c };
        if (
          pieces.some(
            (q) =>
              !q.isKing &&
              !isFrozen(s, q) &&
              q.rank !== "A" &&
              legal(q, board, s.boardSize, counts, kr).some(
                (mv) => mv.row === r && mv.col === c,
              ),
          )
        )
          n++;
        board[r][c] = null;
      }
      return total ? n / total : 1;
    };
    const guardedNow = guardedCount(
      s.board.map((r) => r.slice()),
      allMine,
    );
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
      const ids = new Set(
        (m.captures || [])
          .map((c) => board[c.row]?.[c.col]?.id)
          .filter(Boolean),
      );
      const t = board[m.row][m.col];
      if (t && t.owner !== me) ids.add(t.id);
      return ids;
    };
    const evalMove = (p, m, board0, pieces, depth) => {
      const ids = idsOf(board0, m);
      let score = capValue(ids);
      const kamikaze = kamikazeRank && p.rank === kamikazeRank && !p.isKing;
      let safe0 = moveSafety(s, me, p, m, ids, {
        unknownWeight,
        unknownThreats: unknown,
      });
      if (kamikaze) {
        // 王への危険(大きな減点)はそのまま、自分が取られる分は道連れなので2割に
        const kingPart = safe0 <= -60 ? -65 : 0;
        safe0 = kingPart + (safe0 - kingPart) * 0.2;
        score += capValue(ids) * 0.5;
      }
      score += safe0;
      const board = board0.map((r) => r.slice());
      board[p.row][p.col] = null;
      for (const id of ids) {
        const q = s.pieces[id];
        if (q) board[q.row][q.col] = null;
      }
      const moved = { ...p, row: m.row, col: m.col };
      board[m.row][m.col] = moved;
      const after = pieces.map((q) => (q.id === p.id ? moved : q));
      score += (guardedCount(board, after) - guardedNow) * 2.5;
      const kAt = p.isKing ? moved : king;
      if (king) {
        const danger = kingReachable(s, me, board, kAt, ids);
        if (danger) score -= kingPenalty;
        score += shell * shellCount(board, kAt, after);
        if (twoPly && !danger && sweepThreatIn2(s, me, board, kAt, ids))
          score -= 40;
      }
      const fwd = (m.row - p.row) * dir;
      const nearest = Math.min(
        ...after
          .filter((q) => q.id !== p.id)
          .map((q) =>
            Math.max(Math.abs(q.row - m.row), Math.abs(q.col - m.col)),
          ),
      );
      if (!ids.size) {
        const [hlo, hhi] = territoryRows(s.boardSize, me);
        const out = m.row < hlo || m.row > hhi;
        const adv = kamikaze ? kamikazeAdvance : advance;
        score += waiting
          ? out
            ? -3
            : 0
          : adv * Math.max(-1, Math.min(2, fwd));
        if (nearest > 2 && !kamikaze) score -= 4;
        if (kamikaze) {
          const threats = legal(moved, board, s.boardSize, counts, kr).filter(
            (mv) => board[mv.row][mv.col]?.owner === 1 - me,
          ).length;
          score += Math.min(3, threats) * 2.5;
        }
        const front = after
          .filter((q) => q.id !== p.id)
          .map((q) => q.row * dir)
          .sort((a, b) => b - a)[Math.min(2, after.length - 2)];
        if (m.row * dir - front > 2) score -= 2 * (m.row * dir - front - 2);
      } else if (nearest > 2) score -= 2;
      if (p.isKing)
        score += kingThreatened ? 6 : kingExpendable && heirs > 0 ? 0 : -6;
      // 10 の2回行動: 続けて取れる手があれば、その分を足す
      if (
        depth === 0 &&
        !extra &&
        moved.rank === "10" &&
        (moved.isKing || moved.skyTwice || s.players[me].skyTwice)
      ) {
        let best2 = 0;
        for (const m2 of legal(moved, board, s.boardSize, counts, kr)) {
          const ids2 = idsOf(board, m2);
          let v = capValue(ids2);
          const b2 = board.map((r) => r.slice());
          b2[moved.row][moved.col] = null;
          for (const id of ids2) {
            const q = s.pieces[id];
            if (q) b2[q.row][q.col] = null;
          }
          const moved2 = { ...moved, row: m2.row, col: m2.col };
          b2[m2.row][m2.col] = moved2;
          const after2 = after.map((q) => (q.id === p.id ? moved2 : q));
          v += (guardedCount(b2, after2) - guardedNow) * 1.5;
          if (king && kingReachable(s, me, b2, p.isKing ? moved2 : king, ids2))
            v -= kingPenalty;
          if (
            moveSafety(s, me, moved, m2, ids2, {
              unknownWeight,
              unknownThreats: unknown,
            }) < -6
          )
            v -= 6;
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
        if (!best || sc > best.score)
          best = {
            score: sc,
            type: "MOVE_PIECE",
            pieceId: p.id,
            row: m.row,
            col: m.col,
            captures: m.captures,
          };
      }
    if (extra)
      return best && best.score > -1
        ? (({ score, ...a }) => a)(best)
        : { type: "SKIP_EXTRA_ACTION" };
    const can = canUseArea(s, me);
    if (can.ok && can.type === "sea" && seaMode === "always")
      return { type: "USE_AREA" };
    if (
      can.ok &&
      ((can.type === "sea" && seaMode === "cpu") || can.type === "palace")
    ) {
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
        const board = s.board.map((r) => r.slice());
        board[x.row][x.col] = x10;
        let bestMove = -Infinity;
        for (const m of legal(x10, board, s.boardSize, counts, kr)) {
          const sc = evalMove(x10, m, board, pieces, 0);
          if (sc > bestMove) bestMove = sc;
        }
        const guardLoss =
          (guardedCount(
            board.map((r) => r.slice()),
            pieces,
          ) -
            guardedNow) *
          2.5;
        const worth = bestMove + guardLoss - (best ? best.score : 0);
        const cheap = CARD_VALUE[x.rank] <= 3;
        if (
          worth >= burstMin ||
          (enemies.length <= endgame && cheap && worth > 0)
        )
          if (!bestX || worth > bestX.worth) bestX = { id, worth };
      }
      if (bestX) return { type: "USE_AREA", pieceId: bestX.id };
    }
    if (!best) return null;
    const { score, ...action } = best;
    return action;
  };
}

/* ---------------------------- 王の特定後の詰め ---------------------------- */

// 盤のコピー上で1手を進める(取り・移動のみ。昇格や氷は無視)
function applyMove(board, pieces, p, m) {
  const b = board.map((r) => r.slice()),
    ps = { ...pieces };
  const gone = [];
  for (const c of m.captures || []) {
    const t = b[c.row][c.col];
    if (t) {
      gone.push(t.id);
      ps[t.id] = { ...t, alive: false };
      b[c.row][c.col] = null;
    }
  }
  const t = b[m.row][m.col];
  if (t && t.id !== p.id) {
    gone.push(t.id);
    ps[t.id] = { ...t, alive: false };
  }
  b[p.row][p.col] = null;
  const moved = { ...p, row: m.row, col: m.col };
  ps[p.id] = moved;
  b[m.row][m.col] = moved;
  return { board: b, pieces: ps, gone };
}
/** 自分の駒の手(自分の正体は分かっている) */
function myMoves(s, board, pieces, me) {
  const out = [];
  const counts = s.players[me].armyRankCounts,
    kr = kingRankOf(s, me);
  for (const p of Object.values(pieces)) {
    if (!p.alive || p.owner !== me || p.rank === "A" || isFrozen(s, p)) continue;
    for (const m of legal(p, board, s.boardSize, counts, kr)) out.push({ p, m });
  }
  return out;
}
/**
 * 相手の応手。正体の分からない駒は「どの数字でもありうる」として全部の動きを数える
 * (伏せ札は読まない。同じ行き先・同じ取りは1つにまとめる)。targetId は王と分かっている駒
 */
function foeMoves(s, board, pieces, me, targetId) {
  const out = [];
  const seen = new Set();
  const foe = 1 - me;
  const counts = s.players[foe].armyRankCounts;
  for (const p of Object.values(pieces)) {
    if (!p.alive || p.owner !== foe || isFrozen(s, p)) continue;
    const known = isKnownTo(s, me, p);
    const ranks = known ? [p.rank] : ALL_RANKS;
    for (const rank of ranks) {
      const q = { ...p, rank, isKing: p.id === targetId };
      for (const m of legal(q, board, s.boardSize, counts, undefined)) {
        const key = `${p.id}:${m.row}/${m.col}:${(m.captures || [])
          .map((c) => `${c.row}/${c.col}`)
          .sort()
          .join(",")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ p: q, m });
      }
    }
  }
  return out;
}
const hits = (list, target) => list.filter(({ m }) => hitsCell(m, target));
/** 相手の応手が多すぎるときは必至の探索を諦める(端末で待たせない) */
const MATE_REPLY_CAP = 700;
/**
 * 王が特定できているとき: いま取れるなら取る。次に「相手がどう応じても次の手で王を取れる」手(必至)を探す。
 * 無ければ、王を狙う駒の数が増える手を返す(両狙いの準備)。相手の応手で自分の王が取られうる手は除く
 */
export function kingHunt(s, me, targetId) {
  const target = s.pieces[targetId];
  if (!target || !target.alive) return null;
  const mine = myMoves(s, s.board, s.pieces, me);
  const now = hits(mine, target);
  if (now.length) {
    const { p, m } = now[0];
    return {
      type: "MOVE_PIECE",
      pieceId: p.id,
      row: m.row,
      col: m.col,
      captures: m.captures,
      forced: "now",
    };
  }
  const myKing = s.pieces[s.players[me].kingId];
  let bestThreat = null;
  for (const { p, m } of mine) {
    const after = applyMove(s.board, s.pieces, p, m);
    if (after.gone.includes(targetId)) continue;
    const threats = hits(myMoves(s, after.board, after.pieces, me), target).length;
    if (!threats) continue;
    const foe = foeMoves(s, after.board, after.pieces, me, targetId);
    let forced = foe.length > 0 && foe.length <= MATE_REPLY_CAP,
      kingLost = false;
    for (const r of foe) {
      const b2 = applyMove(after.board, after.pieces, r.p, r.m);
      if (myKing && b2.gone.includes(myKing.id)) {
        kingLost = true;
        break;
      }
      if (!forced) continue;
      const t2 = b2.pieces[targetId];
      if (!t2 || !t2.alive) {
        forced = false;
        continue;
      }
      if (!hits(myMoves(s, b2.board, b2.pieces, me), t2).length) forced = false;
    }
    if (kingLost) continue;
    if (forced)
      return {
        type: "MOVE_PIECE",
        pieceId: p.id,
        row: m.row,
        col: m.col,
        captures: m.captures,
        forced: "mate",
      };
    const foeHitsMover = foe.some(({ m: fm }) => hitsCell(fm, m));
    const score =
      threats * 10 - (foeHitsMover ? 6 : 0) - (p.isKing ? 8 : 0) + Math.random();
    if (!bestThreat || score > bestThreat.score)
      bestThreat = {
        score,
        threats,
        action: {
          type: "MOVE_PIECE",
          pieceId: p.id,
          row: m.row,
          col: m.col,
          captures: m.captures,
          forced: "threat",
        },
      };
  }
  return bestThreat && bestThreat.threats >= 1 ? bestThreat.action : null;
}
/** 王が確定していれば詰めの探索を優先し、無ければ元の指し方に戻る */
export function withKingHunt(base, { minThreats = 2 } = {}) {
  return (s, me) => {
    if (!stop(s)) {
      const belief = opponentKingBelief(s, me);
      if (belief.certain) {
        const targetId = belief.candidates[0].id;
        const h = kingHunt(s, me, targetId);
        if (h && h.forced !== "threat") return h;
        if (h) {
          const after = applyMove(s.board, s.pieces, s.pieces[h.pieceId], h);
          const t = after.pieces[targetId];
          if (
            t &&
            hits(myMoves(s, after.board, after.pieces, me), t).length >=
              minThreats
          )
            return h;
        }
        // 接近: 動かした駒が「次の手で王を狙える升」に立てる手を、安全な範囲で選ぶ
        const target = s.pieces[targetId];
        const unknown = unknownThreatMap(s, me);
        let bestA = null;
        for (const { p, m } of myMoves(s, s.board, s.pieces, me)) {
          if (p.isKing) continue;
          const after = applyMove(s.board, s.pieces, p, m);
          const moved = after.pieces[p.id];
          const t = after.pieces[target.id];
          if (!t) continue;
          const nextHits = hits(
            myMoves(s, after.board, { [p.id]: moved }, me),
            t,
          ).length;
          if (!nextHits) continue;
          const ids = new Set(after.gone);
          const safe = moveSafety(s, me, p, m, ids, {
            unknownWeight: 0.8,
            unknownThreats: unknown,
          });
          if (safe < -8) continue;
          const sc = 10 + safe + Math.random();
          if (!bestA || sc > bestA.sc)
            bestA = {
              sc,
              action: {
                type: "MOVE_PIECE",
                pieceId: p.id,
                row: m.row,
                col: m.col,
                captures: m.captures,
                forced: "approach",
              },
            };
        }
        if (bestA) return bestA.action;
      }
    }
    return base(s, me);
  };
}

/* ---------------------------- エリアごとの指し方 ---------------------------- */

/** 土: 継承があるので王ごと前に出て、正体の分からない駒(王候補)を狩る */
export function earthAct() {
  return skyAct({
    advance: 1.4,
    kingExpendable: true,
    candidateBonus: 90,
    unknownBonus: 4,
    burstMin: 99,
  });
}
/** 森: 毎手番2体ずつ見抜けるので、王候補を狩りながら詰めに行く */
export function forestAct(extra = {}) {
  return skyAct({
    advance: 1.4,
    candidateBonus: 120,
    unknownBonus: 3,
    burstMin: 99,
    ...extra,
  });
}
/** 空: 相手の出方で、一気に返すか、ゆっくり進むかを切り替える */
export function skyAdaptiveAct() {
  return skyAct({ adaptive: true });
}
/** 海: 王は守り、同じ数字の仲間を特攻させる(道連れ)。海の発動はCPUの判断 */
export function seaAct(kingRank, extra = {}) {
  return skyAct({
    advance: 0.6,
    kamikazeRank: kingRank,
    kamikazeAdvance: 2.0,
    burstMin: 99,
    candidateBonus: 60,
    seaMode: "cpu",
    ...extra,
  });
}
/** 氷: 徹底防御(隅の要塞と同じ手の選び方。攻めに転じるのは敵が凍りきってから) */
export function iceAct() {
  return turtleAct({ worstCaseKing: true, shell: 12, attackAfterFrozen: 4 });
}
/**
 * 宮殿(K王): 毎手番の昇格で仲間を育て、倒れたJ・Qは予備札で補充する。
 * 育てるあいだは要塞の手の選び方で守り、強い駒がそろったら進軍型に切り替える
 */
export function palaceAct(opts = {}) {
  const {
    promote = "kfirst",
    strikeStrong = 3,
    strikeTurn = 12,
    doubleEarly = true,
    shell = 12,
    decoys = 0,
    kingActive = false,
    twoPly = false,
  } = opts;
  const guard = turtleAct({ worstCaseKing: true, shell, twoPly });
  const march = skyAct({
    advance: 1.2,
    burstMin: 99,
    candidateBonus: 90,
    unknownBonus: 2,
    twoPly,
    ...(kingActive ? { kingPenaltyOverride: 30 } : {}),
  });
  const V = {
    2: 2,
    3: 2,
    4: 3,
    5: 3,
    6: 3.5,
    7: 3.5,
    8: 4,
    9: 4.5,
    10: 5.5,
    J: 7,
    Q: 7.5,
    K: 9.5,
  };
  const base = (s, me) => {
    const strong = Object.values(s.pieces).filter(
      (p) => p.alive && p.owner === me && !p.isKing && ["Q", "K"].includes(p.rank),
    ).length;
    const attack = strong >= strikeStrong || (s.turnNo || 0) >= strikeTurn;
    return attack ? march(s, me) : guard(s, me);
  };
  return (s, me) => {
    if (!stop(s)) {
      const can = canUseArea(s, me);
      if (can.ok && can.type === "palace") {
        const threats = knownThreats(s, me);
        const unknown = unknownThreatMap(s, me);
        const belief = opponentKingBelief(s, me);
        const kingCand = new Set(belief.candidates.map((c) => c.id));
        let best = null;
        // 囮: 昇格すると公開されるので、消去法で王が割れないよう、安い駒を decoys 体だけ伏せたまま残す
        const hidden = Object.values(s.pieces).filter(
          (p) => p.alive && p.owner === me && !p.isKing && !p.revealed && !p.mark,
        );
        const decoyIds = new Set(
          hidden
            .sort((a, b) => V[a.rank] - V[b.rank] || a.id.localeCompare(b.id))
            .slice(0, decoys)
            .map((p) => p.id),
        );
        for (const id of palaceCandidates(s, me)) {
          const p = s.pieces[id];
          if (isFrozen(s, p)) continue;
          if (decoyIds.has(id)) continue;
          for (const steps of [1, 2]) {
            const next = palacePromotionRank(s, p, steps);
            if (!next) continue;
            let sc = V[next] - V[p.rank];
            const toJQ =
              ["J", "Q"].includes(next) && !["J", "Q"].includes(p.rank);
            if (toJQ) sc += 3;
            if (["J", "Q"].includes(p.rank) && next === "K")
              sc += promote === "kfirst" ? 2 : -6;
            const risk = threats.has(`${p.row}/${p.col}`)
              ? 1
              : unknown.get(`${p.row}/${p.col}`) || 0;
            if (risk > 0.4 && ["J", "Q"].includes(next)) sc += 4;
            if (risk > 0.4 && next === "K") sc -= 3;
            const reach = legal(
              { ...p, rank: next },
              s.board,
              s.boardSize,
              s.players[me].armyRankCounts,
              kingRankOf(s, me),
            );
            if (
              reach.some((m) => {
                const t = s.board[m.row][m.col];
                return t && kingCand.has(t.id);
              })
            )
              sc += belief.certain ? 30 : 6;
            if (steps === 2) {
              if (!doubleEarly || (s.turnNo || 0) > 6 || !["Q", "K"].includes(next))
                continue;
              sc += 2;
            }
            if (!best || sc > best.sc) best = { sc, id, steps };
          }
        }
        if (best && best.sc > 0)
          return { type: "USE_AREA", pieceId: best.id, promotionSteps: best.steps };
      }
    }
    return base(s, me);
  };
}

/* ---------------------------- 定石の側 ---------------------------- */

/**
 * エリアと王の数字から、定石の側を作る。
 *   plan(state, player)      … 採用する9枚と王
 *   discards(state, player)  … 引き直す札
 *   arrange(state, player, plan) … 布陣
 *   act(state, player)       … 対局中の手
 */
export function josekiSide(area, kingRank) {
  const pri = PRIORITY[area];
  if (!pri || !JOSEKI_KINGS[area].includes(kingRank)) return null;
  const side = prioritySide(kingRank, pri(kingRank));
  switch (area) {
    case "earth":
      return { ...side, act: withKingHunt(earthAct()), arrange: arrangeMidKing };
    case "forest":
      return { ...side, act: withKingHunt(forestAct()), arrange: fortressArrange };
    case "ice":
      return { ...side, act: withKingHunt(iceAct()), arrange: fortressArrange };
    case "sky":
      return { ...side, act: withKingHunt(skyAdaptiveAct()), arrange: arrangeArmy };
    case "sea":
      return { ...side, act: withKingHunt(seaAct(kingRank)), arrange: arrangeArmy };
    default:
      return {
        ...side,
        act: withKingHunt(palaceAct({ decoys: 3 })),
        arrange: arrangeArmy,
      };
  }
}

/** 手札から、そのエリアの王にする数字を決める(帯の中でいちばん多い数字。同数なら帯の順) */
export function josekiKingRank(state, player, area) {
  const hand = state.players?.[player]?.hand || [];
  let best = null;
  for (const r of JOSEKI_KINGS[area] || []) {
    const n = hand.filter((c) => c.rank === r).length;
    if (n > 0 && (!best || n > best.n)) best = { r, n };
  }
  return best ? best.r : null;
}

/**
 * 定石CPUの手。cpuInformedAction と同じ入口で、引き直し・布陣・対局中の手を定石に差し替える。
 * 定石の札が無いなど当てはまらないときは通常のCPUに戻る。wantKing は josekiDeck で積んだ王の数字
 */
export function josekiCpuAction(state, player, area, wantKing = null) {
  if (!JOSEKI_KINGS[area]) return cpuInformedAction(state, player);
  if (state.kPlacement && state.kPlacement.owner !== state.currentTurn)
    state = { ...state, kPlacement: null };
  if (
    !state.captureReveal &&
    state.kPlacement?.owner === player &&
    state.currentTurn === player
  ) {
    const act = reserveDeployment(state, player);
    if (act) {
      const { score, ...action } = act;
      return action;
    }
  }
  // 王の数字は、山札を積んだときに決めたもの(wantKing)。手札に無ければ帯の中で多い数字
  const kingRank =
    state.phase === "play" || state.phase === "gameover"
      ? kingRankOf(state, player)
      : wantKing &&
          JOSEKI_KINGS[area].includes(wantKing) &&
          (state.players?.[player]?.hand || []).some((c) => c.rank === wantKing)
        ? wantKing
        : josekiKingRank(state, player, area);
  const side = kingRank ? josekiSide(area, kingRank) : null;
  if (state.phase === "mulligan" && state.mulliganIdx === player)
    return {
      type: "CONFIRM_MULLIGAN",
      discardIds: side ? side.discards(state, player) : strategicDiscards(state, player),
    };
  if (
    state.phase === "setup" &&
    state.setupPlacements &&
    !state.setupDone[player] &&
    (state.setupMode === "simultaneous" || state.setupIdx === player)
  ) {
    const plan = (side && side.plan(state, player)) || chooseArmyPlan(state, player);
    if (plan)
      return {
        type: "SETUP_CONFIRM",
        player,
        kingId: plan.kingId,
        placement: (side && side.plan(state, player)
          ? side.arrange
          : arrangeArmy)(state, player, plan),
      };
  }
  if (
    state.phase !== "play" ||
    state.captureReveal ||
    state.pendingKingChoice ||
    state.kPlacement
  )
    return cpuInformedAction(state, player);
  if (state.currentTurn !== player) return null;
  const auto = automaticAreaAction(state);
  if (auto) return auto;
  const act = side && side.act(state, player);
  if (act) {
    const { forced, ...action } = act;
    return action;
  }
  return cpuInformedAction(state, player);
}

/**
 * 定石の札を CPU(後手の席 = player 1)に配る山札。先に定石の9枚を抜き、残りを切って
 * 人間の13枚 → CPU の残り4枚 → 予備札の順に並べる。START_SETUP の deck に渡す
 */
export function josekiDeck(area, kingRank, handSize = 13) {
  const hand = JOSEKI_HANDS[area];
  if (!hand || !JOSEKI_KINGS[area].includes(kingRank)) return null;
  const deck = shuffle(buildDeck(null));
  const used = new Set();
  const stacked = [];
  for (const r of hand(kingRank)) {
    const c = deck.find((c) => c.rank === r && !used.has(c.id));
    if (!c) continue;
    used.add(c.id);
    stacked.push(c);
  }
  const rest = deck.filter((c) => !used.has(c.id));
  const human = rest.slice(0, handSize);
  const cpuRest = rest.slice(handSize, handSize + handSize - stacked.length);
  const tail = rest.slice(handSize + handSize - stacked.length);
  return [...human, ...stacked, ...cpuRest, ...tail];
}
/** エリアの王の数字を1つ選ぶ(帯からランダム) */
export function pickJosekiKing(area, random = Math.random) {
  const kings = JOSEKI_KINGS[area];
  return kings ? kings[Math.floor(random() * kings.length)] : null;
}
