/**
 * 盤面エリア(試験ルール)。
 *
 * 王にした札のランクにスキンを装備していると、そのランク帯の「エリア」が
 * 盤に立ち、1局に1回だけ効果を使える。9×9 だけ。5×5 には無い
 * (駒が5体しかなく、帯が分かると王の候補が絞れてしまうため)。
 *
 *   2・3  土   直前に動いた相手の駒の足跡を読み、50% で正体を見抜く。
 *              当たったか外れたかは相手にも分かる。正体は自分だけが知る
 *   4・5  海   盤上の全ての駒を中央へ引き寄せる
 *   6・7  森   相手の王以外の駒を1体見抜く(自分だけが知る)
 *   8・9  氷   相手の王以外の駒を1体(乱数で選ぶ)凍らせ、相手の3手番のあいだ動けなくする。
 *              凍った駒を A の入れ替えに使うと氷は解ける。凍った A 自身は入れ替えを使えない。
 *              凍らされて何も指せなければ負け
 *   10    空   自分の駒1体を10に変身させる(本物の10になり、公開される)。
 *              以後、自軍の10は全て1手番に2回動ける
 *   J〜K  宮殿 手番を使い、自分の駒1体を1段昇格させる(K まで。上限なし)。
 *              昇格した駒は公開される
 *
 * 空と宮殿で現れた札は公開(revealed)になり、専用のしるし(piece.mark)が付く。
 * 発動は自分の手番の初め(まだ何もしていないとき)。宮殿以外は手番を消費しない。
 * 発動は相手にも見える。見抜いた正体だけは自分にしか見えない(state.known)。
 *
 * 乱数(土の50%、森の3体の選び方)は src/game/actions.js の enrichAction で
 * 手に焼き込む。オンラインでは両者が同じ手を再生するので、ここは決定的に動く。
 *
 * まだ画面には出していない。START_SETUP に `areas: true` と両者の装備
 * (`loadouts: [{rank: skinId}, {rank: skinId}]`)を渡した対局だけで働く。
 * オンラインに出すときは GAME_RULE_VERSION を上げること(旧版の端末は
 * USE_AREA を知らないので盤がずれる)。
 */
import { RANKS, PLAYER_META } from "./constants.js";
import { getLegalMoves, kingRankOf, squareName } from "./board.js";

export const AREA_BY_RANK = Object.freeze({
  2: "earth",
  3: "earth",
  4: "sea",
  5: "sea",
  6: "forest",
  7: "forest",
  8: "ice",
  9: "ice",
  10: "sky",
  J: "palace",
  Q: "palace",
  K: "palace",
});

export const AREA_INFO = Object.freeze({
  earth: {
    name: "土のエリア",
    text: "直前に動いた相手の駒の足跡を読み、50%で正体を見抜く(正体は自分だけが知る)",
    usesTurn: false,
    needsPiece: false,
  },
  sea: {
    name: "海のエリア",
    text: "盤上の全ての駒を中央へ引き寄せる",
    usesTurn: false,
    needsPiece: false,
  },
  forest: {
    name: "森のエリア",
    text: "相手の王以外の駒を1体見抜く(自分だけが知る)",
    usesTurn: false,
    needsPiece: false,
  },
  ice: {
    name: "氷のエリア",
    text: "相手の王以外の駒を1体凍らせ、相手の3手番のあいだ動けなくする(誰かは運しだい)",
    usesTurn: false,
    needsPiece: false,
  },
  sky: {
    name: "空のエリア",
    text: "自分の駒1体を10に変身させる(公開)。以後、自軍の10は全て1手番に2回動ける",
    usesTurn: false,
    needsPiece: true,
  },
  palace: {
    name: "宮殿",
    text: "手番を使い、自分の駒1体を1段昇格させる(Kまで。昇格した駒は公開)",
    usesTurn: true,
    needsPiece: true,
  },
});

/** 氷で動けなくなる相手の手番の数 */
export const FREEZE_TURNS = 3;
/** 森で見抜く駒の数 */
export const FOREST_REVEALS = 1;

export function areaForKing(rank) {
  return AREA_BY_RANK[rank] || null;
}

/** 凍っているか。turnNo が frozenUntil に届くと解ける */
export function isFrozen(state, piece) {
  return (
    !!piece &&
    piece.frozenUntil != null &&
    (state.turnNo || 0) < piece.frozenUntil
  );
}

/** その駒の正体を viewer が知っているか(自分の駒・公開済み・見抜いた駒) */
export function isKnownTo(state, viewer, piece) {
  if (!piece) return false;
  if (piece.owner === viewer || piece.revealed) return true;
  return !!(state.known && state.known[viewer] && state.known[viewer][piece.id]);
}

/** START_SETUP に添えられた装備の形を確かめる。[{rank: skinId}, {…}] 以外は null */
export function sanitizeLoadouts(raw) {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const out = raw.map((one) => {
    const clean = {};
    if (!one || typeof one !== "object") return clean;
    for (const rank of RANKS) {
      const v = one[rank];
      if (typeof v === "string" && v.length > 0 && v.length <= 40)
        clean[rank] = v;
    }
    return clean;
  });
  return out;
}

/**
 * 対局開始時にエリアを決める。王のランクにスキンを装備していれば立つ。
 * 立たない側は null。
 */
export function initAreas(state) {
  const base = {
    ...state,
    areas: [null, null],
    known: [{}, {}],
    turnNo: 0,
    lastArea: null,
  };
  if (!state.areasEnabled || state.boardSize !== 9) return base;
  const loadouts = state.areaLoadouts;
  const areas = [0, 1].map((i) => {
    const rank = kingRankOf(state, i);
    const type = areaForKing(rank);
    const skin = loadouts && loadouts[i] ? loadouts[i][rank] : null;
    return type && skin ? { type, used: false, rank, skin } : null;
  });
  const log = [...(state.log || [])];
  for (const i of [0, 1])
    if (areas[i])
      log.push(`${PLAYER_META[i].name}の盤に${AREA_INFO[areas[i].type].name}が立った`);
  return { ...base, areas, log };
}

/* ---------------------------- 候補 ---------------------------- */

const alivePieces = (state, owner) =>
  Object.values(state.pieces).filter((p) => p.alive && p.owner === owner);

/** 土: 直前に動いた相手の駒。無ければ null */
export function earthTarget(state, player) {
  const lm = state.lastMove;
  if (!lm || lm.owner !== 1 - player || !lm.to) return null;
  const piece = state.board[lm.to.row] && state.board[lm.to.row][lm.to.col];
  if (!piece || !piece.alive || piece.owner !== 1 - player) return null;
  if (isKnownTo(state, player, piece)) return null;
  return piece;
}

/** 森: まだ正体を知らない、相手の王以外の駒(id の並びは固定) */
export function forestCandidates(state, player) {
  return alivePieces(state, 1 - player)
    .filter((p) => !p.isKing && !isKnownTo(state, player, p))
    .map((p) => p.id)
    .sort();
}

/** 氷: 凍らせられる相手の駒(王以外。すでに凍っている駒は除く)。どれかは乱数(picks) */
export function iceCandidates(state, player) {
  return alivePieces(state, 1 - player)
    .filter((p) => !p.isKing && !isFrozen(state, p))
    .map((p) => p.id)
    .sort();
}

/** 空: 変身させられる自分の駒(王と10は除く) */
export function skyCandidates(state, player) {
  return alivePieces(state, player)
    .filter((p) => !p.isKing && p.rank !== "10")
    .map((p) => p.id)
    .sort();
}

/** 宮殿: 昇格させられる自分の駒(王以外。K はもう上がらない) */
export function palaceCandidates(state, player) {
  return alivePieces(state, player)
    .filter((p) => !p.isKing && promotedRank(p.rank) !== null)
    .map((p) => p.id)
    .sort();
}

/** 1段上のランク。2→3 … 9→10→J→Q→K。A と K は上がらない */
export function promotedRank(rank) {
  const i = RANKS.indexOf(rank);
  if (i < 1 || i + 1 >= RANKS.length) return null;
  return RANKS[i + 1];
}

/** 採用枚数の表を、ランクが変わった駒に合わせて動かす */
function recount(counts, from, to) {
  const next = { ...counts };
  if (next[from] > 1) next[from] -= 1;
  else delete next[from];
  next[to] = (next[to] || 0) + 1;
  return next;
}

/**
 * いま発動できるか。できないときは理由を返す。
 * 手番の初め(まだ動いていない)にだけ使える。
 */
export function canUseArea(state, player) {
  if (state.phase !== "play" || state.winner != null)
    return { ok: false, why: "対局中ではありません" };
  const area = state.areas && state.areas[player];
  if (!area) return { ok: false, why: "エリアがありません" };
  if (area.used) return { ok: false, why: "この局ではもう使いました" };
  if (state.currentTurn !== player) return { ok: false, why: "相手の番です" };
  if (state.extraMoveFor || state.extraUsed || state.pendingKingChoice)
    return { ok: false, why: "手番の初めにだけ使えます" };
  switch (area.type) {
    case "earth":
      if (!earthTarget(state, player))
        return { ok: false, why: "読める足跡がありません" };
      break;
    case "forest":
      if (!forestCandidates(state, player).length)
        return { ok: false, why: "見抜ける駒がありません" };
      break;
    case "ice":
      if (!iceCandidates(state, player).length)
        return { ok: false, why: "凍らせられる駒がありません" };
      break;
    case "sky":
      if (!skyCandidates(state, player).length)
        return { ok: false, why: "変身させられる駒がありません" };
      break;
    case "palace":
      if (!palaceCandidates(state, player).length)
        return { ok: false, why: "昇格させられる駒がありません" };
      break;
    default:
      break;
  }
  return { ok: true, why: null, type: area.type };
}

/* ---------------------------- 発動 ---------------------------- */

function withPiece(state, piece) {
  const pieces = { ...state.pieces, [piece.id]: piece };
  const board = state.board.map((r) => [...r]);
  board[piece.row][piece.col] = piece;
  return { ...state, pieces, board };
}

function markUsed(state, player, detail) {
  const areas = [...state.areas];
  areas[player] = { ...areas[player], used: true };
  return {
    ...state,
    areas,
    lastArea: {
      player,
      type: areas[player].type,
      seq: (state.lastArea ? state.lastArea.seq : 0) + 1,
      ...detail,
    },
  };
}

/**
 * エリアを使う。使えなければ state をそのまま返す。
 * action: { type: "USE_AREA", pieceId?, hit?(土), picks?(森) }
 * 手番を消費する宮殿は、呼び出し側(reducer)が endTurn する。
 */
export function useArea(state, action) {
  const player = state.currentTurn;
  const can = canUseArea(state, player);
  if (!can.ok) return state;
  const name = PLAYER_META[player].name;
  const foeName = PLAYER_META[1 - player].name;
  switch (can.type) {
    case "earth": {
      const target = earthTarget(state, player);
      const hit = action.hit === true;
      let next = state;
      if (hit) {
        const known = state.known.map((k) => ({ ...k }));
        known[player][target.id] = true;
        next = { ...state, known };
      }
      // 当たったか外れたかは相手にも分かる。正体は自分だけ
      next = {
        ...next,
        log: [
          ...state.log,
          `${name}が土のエリアで足跡を読んだ…${hit ? "正体を見抜いた!" : "読み違えた"}`,
        ],
      };
      return markUsed(next, player, { hit, pieceId: target.id });
    }
    case "sea":
      return markUsed(seaPull(state), player, {});
    case "forest": {
      const candidates = new Set(forestCandidates(state, player));
      const order = Array.isArray(action.picks) ? action.picks : [];
      const picks = [];
      for (const id of order)
        if (candidates.has(id) && !picks.includes(id)) picks.push(id);
      // 手に書かれていない候補は、並びを固定して後ろに足す(手が欠けていても両者で揃う)
      for (const id of [...candidates].sort())
        if (!picks.includes(id)) picks.push(id);
      const chosen = picks.slice(0, FOREST_REVEALS);
      const known = state.known.map((k) => ({ ...k }));
      for (const id of chosen) known[player][id] = true;
      const next = {
        ...state,
        known,
        log: [
          ...state.log,
          `${name}が森のエリアで${foeName}の駒を${chosen.length}体見抜いた`,
        ],
      };
      return markUsed(next, player, { pieceIds: chosen });
    }
    case "ice": {
      // 誰を凍らせるかは手に焼き込まれた並び(picks)の先頭。無ければ固定の並び
      const candidates = iceCandidates(state, player);
      const order = Array.isArray(action.picks) ? action.picks : [];
      const chosen =
        order.find((id) => candidates.includes(id)) || candidates[0];
      const piece = state.pieces[chosen];
      if (!piece) return state;
      const until = (state.turnNo || 0) + FREEZE_TURNS * 2;
      const next = withPiece(state, {
        ...piece,
        frozenUntil: until,
        history: [...piece.history, "氷のエリアで凍りついた"],
      });
      return markUsed(
        {
          ...next,
          log: [
            ...state.log,
            `${name}が氷のエリアで${squareName(piece.row, piece.col, state.boardSize)}の${foeName}の駒を凍らせた`,
          ],
        },
        player,
        { pieceId: piece.id, until },
      );
    }
    case "sky": {
      const piece = state.pieces[action.pieceId];
      if (!piece || !skyCandidates(state, player).includes(piece.id)) return state;
      // 本物の10になる。正体が変わるので公開し、専用のしるしを付ける
      const players = state.players.map((p, i) =>
        i === player
          ? {
              ...p,
              armyRankCounts: recount(p.armyRankCounts, piece.rank, "10"),
              // 以後、この軍の10は全て1手番に2回動ける
              skyTwice: true,
            }
          : p,
      );
      const next = withPiece(
        { ...state, players },
        {
          ...piece,
          rank: "10",
          revealed: true,
          mark: "sky",
          history: [...piece.history, `空のエリアで${piece.rank}から10に変身した(公開)`],
        },
      );
      return markUsed(
        {
          ...next,
          lastReveal: { id: piece.id, reason: "空のエリアで変身した" },
          log: [
            ...state.log,
            `${name}が空のエリアで${squareName(piece.row, piece.col, state.boardSize)}の駒を10に変身させた(公開)。${name}の10は全て2回動ける`,
          ],
        },
        player,
        { pieceId: piece.id, from: piece.rank, to: "10" },
      );
    }
    case "palace": {
      const piece = state.pieces[action.pieceId];
      if (!piece || !palaceCandidates(state, player).includes(piece.id))
        return state;
      const rank = promotedRank(piece.rank);
      const players = state.players.map((p, i) =>
        i === player
          ? { ...p, armyRankCounts: recount(p.armyRankCounts, piece.rank, rank) }
          : p,
      );
      // 正体が変わるので公開し、専用のしるしを付ける
      const next = withPiece(
        { ...state, players },
        {
          ...piece,
          rank,
          revealed: true,
          mark: "palace",
          history: [...piece.history, `宮殿で${piece.rank}から${rank}へ昇格した(公開)`],
        },
      );
      return markUsed(
        {
          ...next,
          lastReveal: { id: piece.id, reason: "宮殿で昇格した" },
          log: [
            ...state.log,
            `${name}が宮殿で${squareName(piece.row, piece.col, state.boardSize)}の駒を${rank}に昇格させた(公開)`,
          ],
        },
        player,
        { pieceId: piece.id, from: piece.rank, to: rank },
      );
    }
    default:
      return state;
  }
}

/**
 * 海: 全ての駒を中央へ引き寄せる。
 * 中央に近い駒から順に(同じ距離なら手番側の駒、次に行・列の順)、
 * 「中央にいちばん近い空きマス」へ置く。同じ近さなら元の位置に近いマス。
 * 取りは起きない。自分のいたマスも空きなので、遠ざかることはない。
 */
export function seaPull(state) {
  const size = state.boardSize;
  const c = (size - 1) / 2;
  const cheb = (r, col) => Math.max(Math.abs(r - c), Math.abs(col - c));
  const me = state.currentTurn;
  const order = Object.values(state.pieces)
    .filter((p) => p.alive)
    .sort(
      (a, b) =>
        cheb(a.row, a.col) - cheb(b.row, b.col) ||
        (a.owner === me ? 0 : 1) - (b.owner === me ? 0 : 1) ||
        a.row - b.row ||
        a.col - b.col,
    );
  const board = state.board.map((row) => row.map(() => null));
  const pieces = { ...state.pieces };
  let moved = 0;
  for (const p of order) {
    let best = null;
    for (let r = 0; r < size; r++)
      for (let col = 0; col < size; col++) {
        if (board[r][col]) continue;
        const key = [
          cheb(r, col),
          Math.max(Math.abs(r - p.row), Math.abs(col - p.col)),
          r,
          col,
        ];
        if (!best || v_lt(key, best.key)) best = { r, col, key };
      }
    const at = best;
    const same = at.r === p.row && at.col === p.col;
    const placed = same
      ? p
      : {
          ...p,
          row: at.r,
          col: at.col,
          history: [
            ...p.history,
            `${squareName(p.row, p.col, size)} → ${squareName(at.r, at.col, size)} へ移動(海の引き寄せ)`,
          ],
        };
    if (!same) moved++;
    pieces[p.id] = placed;
    board[at.r][at.col] = placed;
  }
  return {
    ...state,
    board,
    pieces,
    lastMove: null,
    selectedId: null,
    shuffleMode: null,
    log: [
      ...state.log,
      `${PLAYER_META[me].name}が海のエリアで駒を中央へ引き寄せた(${moved}体が動いた)`,
    ],
  };
}

function v_lt(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

/* ---------------------------- 手番 ---------------------------- */

/** その側に、いま指せる手があるか(凍った駒は数えない) */
export function hasAction(state, player) {
  const living = Object.values(state.pieces).filter((p) => p.alive);
  return living.some((p) => {
    if (p.owner !== player || isFrozen(state, p)) return false;
    if (p.rank === "A") return living.length >= 3;
    return (
      getLegalMoves(
        p,
        state.board,
        state.boardSize,
        state.players[player].armyRankCounts,
        kingRankOf(state, player),
      ).length > 0
    );
  });
}

/**
 * 手番が回ってきた側が、凍った駒のせいで何も指せないなら、その側の負け。
 * (本人の決め: 凍らされて動かせる駒がなければ負け)。endTurn から呼ぶ。
 */
export function loseIfFrozen(state) {
  if (!state.areasEnabled || state.winner != null) return state;
  const player = state.currentTurn;
  const frozen = Object.values(state.pieces).some(
    (p) => p.alive && p.owner === player && isFrozen(state, p),
  );
  if (!frozen || hasAction(state, player)) return state;
  const winner = 1 - player;
  return {
    ...state,
    phase: "gameover",
    winner,
    interstitial: null,
    endReason: "frozen",
    log: [
      ...state.log,
      `${PLAYER_META[player].name}の駒は凍りついて動けない…${PLAYER_META[winner].name}の勝利!(氷のエリア)`,
    ],
  };
}

/** A の入れ替えに使われた駒の氷を解く(凍った A 自身は使えないので、ここには来ない) */
export function thaw(piece) {
  if (!piece || piece.frozenUntil == null) return piece;
  const { frozenUntil, ...rest } = piece;
  return { ...rest, history: [...rest.history, "入れ替えで氷が解けた"] };
}
