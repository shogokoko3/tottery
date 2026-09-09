/**
 * 盤面エリア(試験ルール)。
 *
 * 王にした札のランクに**フォイルの**スキン(ガチャで引く加工版。id の末尾が
 * ":foil")を装備していると、そのランク帯の「エリア」が盤に立つ。通常のスキンでは
 * 立たない。全エリアが毎手番1回だけ効果を使える。9×9 だけ。5×5 には無い
 * (駒が5体しかなく、帯が分かると王の候補が絞れてしまうため)。
 *
 *   2・3  土   直前に動いた相手の駒の足跡を読み、50% で正体を見抜く。
 *              当たったか外れたかは相手にも分かる。正体は自分だけが知る
 *   4・5  海   盤上の全ての駒を中央へ引き寄せる
 *   6・7  森   相手の王以外の駒を2体見抜く(自分だけが知る)
 *   8・9  氷   相手の王以外の駒を1体(乱数で選ぶ)凍らせ、相手の3手番のあいだ動けなくする。
 *              凍った駒を A の入れ替えに使うと氷は解ける。凍った A 自身は入れ替えを使えない。
 *              凍らされて何も指せなければ負け
 *   10    空   自分の駒1体を10に変身させる(本物の10になり、公開される)。
 *              以後、自軍の10は全て1手番に2回動ける
 *   J〜K  宮殿 手番を使わず、自分の駒1体を1段昇格させる(K まで。上限なし)。
 *              昇格した駒は公開される
 *
 * 空と宮殿で現れた札は公開(revealed)になり、専用のしるし(piece.mark)が付く。
 * 土・海・森・氷は発動可能な自分の手番の初めに自動発動する。
 * 空・宮殿は任意発動で対象を選ぶ。全エリアとも手番を消費しない(旧版の宮殿を除く)。
 * 発動は相手にも見える。見抜いた正体だけは自分にしか見えない(state.known)。
 *
 * 乱数(土の50%、森・氷の対象の選び方)は src/game/actions.js の enrichAction で
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
    text: "盤上の全ての駒を中央方向へ最大1マスずつ引き寄せる。行き先が埋まっている駒はその場に留まる",
    usesTurn: false,
    needsPiece: false,
  },
  forest: {
    name: "森のエリア",
    text: "相手の王以外の駒をランダムで2体見抜く(自分だけが知る)",
    usesTurn: false,
    needsPiece: false,
  },
  ice: {
    name: "氷のエリア",
    text: "毎回の自分の手番開始時、相手の王以外をランダムで1体凍結。凍結中なら残り期間に3手番追加",
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
    text: "自分の駒1体を1段昇格させる(Kまで・公開)。昇格後も駒を動かせる",
    usesTurn: false,
    needsPiece: true,
  },
});

/**
 * 調整用の数字。効果の強さはここだけで変える(本人が後で差し替える前提)。
 * 変えたら `node tools/check-areas.mjs` と `node tools/area-lab.mjs` で確かめる。
 */
export const AREA_TUNING = Object.freeze({
  /** 旧ルール版の1局あたり回数 */
  usesPerGame: 1,
  /** 土: 見抜ける確率(0〜1)。enrichAction がこの確率で hit を焼き込む */
  earthOdds: 0.5,
  /** 森: 見抜く駒の数 */
  forestReveals: 2,
  /** 氷: 凍らせる駒の数 */
  iceTargets: 1,
  /** 氷: 相手が動けない手番の数 */
  freezeTurns: 3,
  /** 空: 変身させたあと、その軍の10全部が2回動けるようにするか */
  skyAllTens: true,
  /** 宮殿: これより上には昇格できない("K" なら上限なし) */
  palaceCap: "K",
});
/** 氷で動けなくなる相手の手番の数(互換用。AREA_TUNING.freezeTurns を見る) */
export const FREEZE_TURNS = AREA_TUNING.freezeTurns;
/** 森で見抜く駒の数(互換用) */
export const FOREST_REVEALS = AREA_TUNING.forestReveals;

export function areaForKing(rank) {
  return AREA_BY_RANK[rank] || null;
}

/**
 * エリアを立てられる装備か。ガチャのフォイル加工のスキンだけ。
 * 見分けは id の末尾(src/skins/catalog.js の FOIL_SUFFIX と同じ ":foil")。
 * catalog を読まないのは、ルール層が画面の台帳に依らないようにするため
 */
export const AREA_SKIN_SUFFIX = ":foil";
export function areaSkinOk(skinId) {
  return typeof skinId === "string" && skinId.endsWith(AREA_SKIN_SUFFIX);
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
  return !!(
    state.known &&
    state.known[viewer] &&
    state.known[viewer][piece.id]
  );
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
    // フォイル以外のスキンでは立たない
    return type && areaSkinOk(skin)
      ? { type, used: false, uses: 0, rank, skin }
      : null;
  });
  const log = [...(state.log || [])];
  for (const i of [0, 1])
    if (areas[i])
      log.push(
        `${PLAYER_META[i].name}の盤に${AREA_INFO[areas[i].type].name}が立った`,
      );
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

/** 氷: 相手の王以外。版4から凍結中も抽選に含める。 */
export function recurringIce(state) {
  return state.ruleVersion >= 4;
}

/** 版5は全種類、版4は氷だけ毎手番。開始済みの旧対局は元の回数を保つ。 */
export function recurringArea(state, type) {
  return state.ruleVersion >= 5 || (type === "ice" && recurringIce(state));
}

export function iceCandidates(state, player) {
  return alivePieces(state, 1 - player)
    .filter((p) => !p.isKing && (recurringIce(state) || !isFrozen(state, p)))
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

/** 1段上のランク。2→3 … 9→10→J→Q→K。A と、上限(AREA_TUNING.palaceCap)は上がらない */
export function promotedRank(rank) {
  const i = RANKS.indexOf(rank);
  if (i < 1 || i + 1 >= RANKS.length) return null;
  if (RANKS.indexOf(AREA_TUNING.palaceCap) <= i) return null;
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
  if (
    recurringArea(state, area.type)
      ? area.lastUsedTurn === (state.turnNo || 0)
      : (area.uses || 0) >= AREA_TUNING.usesPerGame
  )
    return {
      ok: false,
      why: recurringArea(state, area.type)
        ? "この手番では発動済みです"
        : "この局ではもう使いました",
    };
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
  const uses = (areas[player].uses || 0) + 1;
  areas[player] = {
    ...areas[player],
    uses,
    // used は画面と旧い検査の互換。usesPerGame に達したら真
    used: recurringArea(state, areas[player].type)
      ? false
      : uses >= AREA_TUNING.usesPerGame,
    lastUsedTurn: state.turnNo || 0,
  };
  return {
    ...state,
    areas,
    lastArea: {
      player,
      type: areas[player].type,
      seq: (state.lastArea ? state.lastArea.seq : 0) + 1,
      ...detail,
      usesTurn: areaUsesTurn(state, areas[player].type),
    },
  };
}

/**
 * エリアを使う。使えなければ state をそのまま返す。
 * action: { type: "USE_AREA", pieceId?, hit?(土), picks?(森) }
 * 旧版で手番を消費する宮殿は、呼び出し側(reducer)が endTurn する。
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
    case "sea": {
      const pulled = seaPull(state);
      const { _seaMoves, ...rest } = pulled;
      return markUsed(rest, player, { moves: _seaMoves });
    }
    case "forest": {
      const candidates = new Set(forestCandidates(state, player));
      const order = Array.isArray(action.picks) ? action.picks : [];
      const picks = [];
      for (const id of order)
        if (candidates.has(id) && !picks.includes(id)) picks.push(id);
      // 手に書かれていない候補は、並びを固定して後ろに足す(手が欠けていても両者で揃う)
      for (const id of [...candidates].sort())
        if (!picks.includes(id)) picks.push(id);
      const chosen = picks.slice(
        0,
        state.ruleVersion >= 6 ? AREA_TUNING.forestReveals : 1,
      );
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
      // 誰を凍らせるかは手に焼き込まれた並び(picks)の先頭から。無ければ固定の並び
      const candidates = iceCandidates(state, player);
      const order = Array.isArray(action.picks) ? action.picks : [];
      const chosen = [];
      for (const id of order)
        if (candidates.includes(id) && !chosen.includes(id)) chosen.push(id);
      for (const id of candidates) if (!chosen.includes(id)) chosen.push(id);
      const targets = chosen.slice(0, AREA_TUNING.iceTargets);
      if (!targets.length) return state;
      const untilFor = (id) =>
        Math.max(
          state.turnNo || 0,
          recurringIce(state) ? state.pieces[id].frozenUntil || 0 : 0,
        ) +
        AREA_TUNING.freezeTurns * 2;
      const extended = targets.some(
        (id) => recurringIce(state) && isFrozen(state, state.pieces[id]),
      );
      let next = state;
      for (const id of targets)
        next = withPiece(next, {
          ...next.pieces[id],
          frozenUntil: untilFor(id),
          history: [
            ...next.pieces[id].history,
            recurringIce(state) && isFrozen(state, next.pieces[id])
              ? `氷のエリアで凍結が${AREA_TUNING.freezeTurns}手番延長された`
              : "氷のエリアで凍りついた",
          ],
        });
      const squares = targets
        .map((id) =>
          squareName(
            state.pieces[id].row,
            state.pieces[id].col,
            state.boardSize,
          ),
        )
        .join("・");
      return markUsed(
        {
          ...next,
          log: [
            ...state.log,
            `${name}が氷のエリアで${squares}の${foeName}の駒${extended ? `の凍結を${AREA_TUNING.freezeTurns}手番延長した` : "を凍らせた"}`,
          ],
        },
        player,
        {
          pieceId: targets[0],
          pieceIds: targets,
          until: untilFor(targets[0]),
          extended,
        },
      );
    }
    case "sky": {
      const piece = state.pieces[action.pieceId];
      if (!piece || !skyCandidates(state, player).includes(piece.id))
        return state;
      // 本物の10になる。正体が変わるので公開し、専用のしるしを付ける
      const players = state.players.map((p, i) =>
        i === player
          ? {
              ...p,
              armyRankCounts: recount(p.armyRankCounts, piece.rank, "10"),
              // 以後、この軍の10は全て1手番に2回動ける(AREA_TUNING.skyAllTens)
              skyTwice: AREA_TUNING.skyAllTens,
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
          // 軍全体を2回にしない設定でも、変身した駒自身は2回動ける
          skyTwice: true,
          history: [
            ...piece.history,
            `空のエリアで${piece.rank}から10に変身した(公開)`,
          ],
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
          ? {
              ...p,
              armyRankCounts: recount(p.armyRankCounts, piece.rank, rank),
            }
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
          history: [
            ...piece.history,
            `宮殿で${piece.rank}から${rank}へ昇格した(公開)`,
          ],
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
 * 中央方向へ縦・横・斜めに最大1マス進める。進み先が埋まっていれば動かさない。
 * 取りは起きない。版7以前の対局には旧処理を適用する。
 */
export function seaPull(state) {
  if (!(state.ruleVersion >= 8)) return seaPullLegacy(state);
  const c = (state.boardSize - 1) / 2;
  const distance = (p) => Math.max(Math.abs(p.row - c), Math.abs(p.col - c));
  const order = Object.values(state.pieces)
    .filter((p) => p.alive)
    .sort(
      (a, b) =>
        distance(a) - distance(b) ||
        Number(b.owner === state.currentTurn) -
          Number(a.owner === state.currentTurn) ||
        a.row - b.row ||
        a.col - b.col,
    );
  const board = state.board.map((row) => [...row]),
    pieces = { ...state.pieces },
    moves = [];
  for (const p of order) {
    const row = p.row + Math.sign(c - p.row),
      col = p.col + Math.sign(c - p.col);
    if ((row === p.row && col === p.col) || board[row][col]) continue;
    const q = {
      ...p,
      row,
      col,
      history: [
        ...p.history,
        `${squareName(p.row, p.col, state.boardSize)} → ${squareName(row, col, state.boardSize)} へ移動(海の引き寄せ)`,
      ],
    };
    board[p.row][p.col] = null;
    board[row][col] = q;
    pieces[p.id] = q;
    moves.push({
      id: p.id,
      from: { row: p.row, col: p.col },
      to: { row, col },
    });
  }
  return {
    ...state,
    board,
    pieces,
    _seaMoves: moves,
    lastMove: null,
    selectedId: null,
    shuffleMode: null,
    log: [
      ...state.log,
      `${PLAYER_META[state.currentTurn].name}が海のエリアで駒を中央へ1マスずつ引き寄せた(${moves.length}体が動いた)`,
    ],
  };
}

// 開始済みの旧版対局は、中央へまとめて詰める元の処理を再生する。
function seaPullLegacy(state) {
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
  const moves = [];
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
    if (!same) {
      moved++;
      moves.push({
        id: p.id,
        from: { row: p.row, col: p.col },
        to: { row: at.r, col: at.col },
      });
    }
    pieces[p.id] = placed;
    board[at.r][at.col] = placed;
  }
  return {
    ...state,
    board,
    pieces,
    _seaMoves: moves,
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

/** 旧対局・リプレイでは従来の手番消費を保持する。 */
export function areaUsesTurn(state, type) {
  return type === "palace" && !(state.ruleVersion >= 7);
}
