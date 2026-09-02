import { isStraight, isFlush, revealCount, pickRevealed } from "./bonus.js";
import { PLAYER_META, SUIT_SYMBOL } from "./constants.js";
import {
  buildDeck,
  shuffle,
  emptyBoard,
  totalSlots,
  territoryRows,
  squareName,
  pointInTriangle,
  maxAdopt,
  placedRankCounts,
  makePlayer,
} from "./board.js";

/** 対局の記録に残す出来事かどうか */
export function isNotableLog(line) {
  return (
    line.includes("撃破") ||
    line.includes("回目に移動") ||
    line.includes("王が倒された") ||
    line.includes("道連れ") ||
    line.includes("新しい王") ||
    line.includes("入れ替えた") ||
    line.includes("投入") ||
    line.includes("降参")
  );
}

/** 対局の持ち時間 */
export const CLOCK_INITIAL_MS = 5 * 60 * 1000;
/** 自分の手番が始まるたびに加算される時間 */
export const CLOCK_INCREMENT_MS = 10 * 1000;
/**
 * 駒を並べるのに使える時間。9×9 は置く枚数が多いので長くとる。
 * 王を選ぶ時間は別に数える。
 */
export function setupLimitMs(size) {
  return size >= 9 ? 90 * 1000 : 60 * 1000;
}
/** 王を選ぶのに使える時間 */
export const KING_LIMIT_MS = 15 * 1000;

export function initialState() {
  return {
    phase: "intro",
    boardSize: 5,
    players: [makePlayer(0), makePlayer(1)],
    reserve: [],
    firstPlayer: 0,
    dice: [null, null],
    diceIdx: 0,
    mulliganIdx: 0,
    /** 使っているカードプール(チュートリアル用。null なら全部) */
    pool: null,
    /** 同時配置か、1台の端末で順番に置くか */
    setupMode: "sequential",
    /** 順番に置くときの、いま置いている側 */
    setupIdx: 0,
    /** プレイヤーごとの布陣の進み具合 */
    setupSteps: ["place", "place"],
    setupPickKings: [null, null],
    setupPlacements: [{}, {}],
    setupDone: [false, false],
    /** 持ち時間(ミリ秒)。対局開始時に5分ずつ */
    clocks: [CLOCK_INITIAL_MS, CLOCK_INITIAL_MS],
    timeoutBy: null,
    /** 直前に駒が倒れたマス。演出のためだけに持つ */
    lastDefeat: null,
    /** 記録に残す出来事ごとの、その時点の盤面 */
    replay: [],
    /** 布陣ボーナス(ストレート・フラッシュ)の結果。知らせ終えたら消す */
    setupEffects: null,
    /** 台本どおりに進める場面(チュートリアル)かどうか */
    scripted: false,
    board: [],
    pieces: {},
    currentTurn: 0,
    lastMove: null,
    lastSwap: null,
    resignedBy: null,
    extraMoveFor: null,
    extraUsed: false,
    selectedId: null,
    shuffleMode: null,
    kPlacement: null,
    interstitial: null,
    captureReveal: null,
    pendingKingChoice: null,
    logViewerId: null,
    log: [],
    lastReveal: null,
    winner: null,
    seq: 0,
  };
}

/* =========================================================================
   駒の除去。ここに王位継承・道連れ・K の予備札投入がぶら下がっている
   ========================================================================= */

export function removePiece(state, pieceId, opts) {
  const dead = state.pieces[pieceId];
  if (!dead || !dead.alive) return state;

  const board = state.board.map((r) => [...r]);
  const pieces = { ...state.pieces };
  const players = state.players.map((p) => ({
    ...p,
    capturedOwn: [...p.capturedOwn],
  }));
  const log = [...state.log];
  let winner = state.winner;

  board[dead.row][dead.col] = null;
  const corpse = { ...dead, alive: false };
  pieces[pieceId] = corpse;
  players[dead.owner].capturedOwn.push(corpse);

  let pendingKingChoice = state.pendingKingChoice || null;

  // 王の2・3が倒れたら、軍内の同ランクが王位を継ぐ
  if ((dead.rank === "2" || dead.rank === "3") && dead.isKing) {
    const heirs = Object.values(pieces).filter(
      (p) =>
        p.alive &&
        p.owner === dead.owner &&
        p.rank === dead.rank &&
        p.id !== pieceId,
    );
    if (heirs.length === 1) {
      const heir = {
        ...heirs[0],
        isKing: true,
        history: [...heirs[0].history, "王位を継承"],
      };
      pieces[heir.id] = heir;
      board[heir.row][heir.col] = heir;
      players[dead.owner].kingId = heir.id;
      log.push(`${PLAYER_META[dead.owner].name}に新しい王が立った!`);
    } else if (heirs.length > 1) {
      players[dead.owner].kingId = null;
      pendingKingChoice = {
        owner: dead.owner,
        rank: dead.rank,
        candidateIds: heirs.map((h) => h.id),
        acknowledged: false,
      };
      log.push(`${PLAYER_META[dead.owner].name}は新しい王を選びます`);
    }
  }

  // 継承者がいないまま王が倒れたら決着
  if (
    dead.isKing &&
    players[dead.owner].kingId === pieceId &&
    !pendingKingChoice
  ) {
    winner = 1 - dead.owner;
    log.push(
      `${PLAYER_META[dead.owner].name}の王が倒された…${PLAYER_META[winner].name}の勝利!`,
    );
  }

  let next = {
    ...state,
    board,
    pieces,
    players,
    log,
    winner,
    pendingKingChoice,
    // 演出用。倒れたマスを積み、reducer の後始末で lastDefeat にまとめる
    _defeats: [
      ...(state._defeats || []),
      {
        row: dead.row,
        col: dead.col,
        owner: dead.owner,
        rank: dead.rank,
        suit: dead.suit,
        wasKing: !!dead.isKing,
      },
    ],
  };

  // 王が4か5のとき、同ランクの手駒が倒されると倒した相手を道連れにする
  if (
    (dead.rank === "4" || dead.rank === "5") &&
    !dead.isKing &&
    !opts.viaCounter &&
    opts.by
  ) {
    const kingId = next.players[dead.owner].kingId;
    const king = kingId ? next.pieces[kingId] : null;
    if (king && king.rank === dead.rank) {
      const killer = next.pieces[opts.by];
      if (killer && killer.alive) {
        log.push(
          `${PLAYER_META[dead.owner].name}の${dead.rank}${SUIT_SYMBOL[dead.suit]}が道連れにした!`,
        );
        next = removePiece({ ...next, log }, opts.by, {
          by: null,
          viaCounter: true,
        });
      }
    }
  }

  // 王がKのとき、自分のJかQが倒されると予備札を1枚引ける
  if (dead.rank === "J" || dead.rank === "Q") {
    const owner = next.players[dead.owner];
    const king = owner.kingId ? next.pieces[owner.kingId] : null;
    if (king && king.rank === "K" && king.alive && next.reserve.length > 0) {
      const reserve = [...next.reserve];
      const card = reserve.pop();
      next = { ...next, reserve, kPlacement: { owner: dead.owner, card } };
      next.log = [
        ...next.log,
        `${PLAYER_META[dead.owner].name}は予備札を1枚引いた(配置できます)`,
      ];
    }
  }

  return next;
}

/** 1手ぶんの行動を終える。王の10とAだけは1ターンに2回動ける */
export function endAction(state, pieceId) {
  if (state.winner !== null && state.winner !== undefined)
    return { ...state, phase: "gameover" };
  const piece = pieceId ? state.pieces[pieceId] : null;
  const extraMove = piece && piece.alive && piece.isKing && piece.rank === "10";
  const extraSwap = piece && piece.alive && piece.isKing && piece.rank === "A";
  if ((extraMove || extraSwap) && !state.extraUsed) {
    return {
      ...state,
      extraMoveFor: piece.id,
      extraUsed: true,
      selectedId: null,
      shuffleMode: null,
    };
  }
  return endTurn(state);
}

export function endTurn(state) {
  const next = 1 - state.currentTurn;
  return {
    ...state,
    currentTurn: next,
    selectedId: null,
    shuffleMode: null,
    extraMoveFor: null,
    extraUsed: false,
    interstitial: { forPlayer: next, kind: "turn" },
  };
}

/* =========================================================================
   布陣まわりの小道具
   ========================================================================= */

/** 配列の1要素だけ差し替えた新しい配列 */
function replaceAt(arr, idx, value) {
  const next = [...arr];
  next[idx] = value;
  return next;
}

/**
 * その布陣アクションが誰のものか。名乗りが場に合わなければ null を返す。
 * 同時配置ならアクションが名乗った側、順番に置くならいま番の側だけ。
 */
function setupActor(state, action) {
  if (!state.setupPlacements) return null;
  const named =
    action.player === 0 || action.player === 1 ? action.player : null;
  if (state.setupMode === "simultaneous")
    return named === null ? state.setupIdx : named;
  if (named !== null && named !== state.setupIdx) return null;
  return state.setupIdx;
}

function withSetupPlacement(state, idx, placement) {
  return {
    ...state,
    setupPlacements: replaceAt(state.setupPlacements, idx, placement),
  };
}

/**
 * 自陣を自動で埋める。keep を渡すと置いてある駒はそのままにして残りだけ埋める。
 * cellOrder / handOrder は乱数を外から与えるためのもの(通信時の再現用)。
 */
export function autoArrange(state, idx, cellOrder, handOrder, keep) {
  const me = state.players[idx];
  const slots = totalSlots(state.boardSize);
  const [lo, hi] = territoryRows(state.boardSize, idx);

  const cells = [];
  for (let r = lo; r <= hi; r++)
    for (let c = 0; c < state.boardSize; c++) cells.push({ row: r, col: c });

  const ordered = cellOrder
    ? cellOrder.map((i) => cells[i]).filter(Boolean)
    : shuffle(cells);
  const hand = handOrder
    ? handOrder.map((id) => me.hand.find((c) => c.id === id)).filter(Boolean)
    : shuffle(me.hand);

  const placement = keep ? { ...keep } : {};
  const counts = placedRankCounts(placement, me.hand);
  const takenIds = new Set(Object.keys(placement));
  const takenCells = new Set(
    Object.values(placement).map((at) => `${at.row}-${at.col}`),
  );
  const free = ordered.filter((at) => !takenCells.has(`${at.row}-${at.col}`));

  let cursor = 0;
  for (const card of hand) {
    if (Object.keys(placement).length >= slots) break;
    if (takenIds.has(card.id)) continue;
    if (card.rank === "K") {
      if ((counts.K || 0) >= 1 || (counts.J || 0) > 1 || (counts.Q || 0) > 1)
        continue;
    } else {
      const hasK = (counts.K || 0) > 0;
      const limit = maxAdopt(card.rank, hasK ? "K" : null);
      if ((counts[card.rank] || 0) >= limit) continue;
    }
    const at = free[cursor++];
    if (!at) break;
    placement[card.id] = at;
    counts[card.rank] = (counts[card.rank] || 0) + 1;
  }
  return placement;
}

/**
 * 布陣が時間切れになったときに使う王。
 * Kを採用しているならK、いなければ一番強いランク。
 */
export function autoPickKing(state, idx, placement) {
  const me = state.players[idx];
  const ids = Object.keys(placement);
  const cards = ids
    .map((id) => me.hand.find((c) => c.id === id))
    .filter(Boolean);
  if (cards.length === 0) return null;
  const k = cards.find((c) => c.rank === "K");
  if (k) return k.id;
  const order = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];
  return cards.reduce((best, c) =>
    order.indexOf(c.rank) > order.indexOf(best.rank) ? c : best,
  ).id;
}

/**
 * 両者の布陣がそろったので対局を始める。
 * ここで布陣ボーナス(ストレート・フラッシュ)を確かめて効果を出す。
 */
function startPlay(base, log) {
  if (base.scripted)
    return {
      ...base,
      phase: "play",
      currentTurn: base.firstPlayer,
      clocks: replaceAt(
        base.clocks,
        base.firstPlayer,
        base.clocks[base.firstPlayer] + CLOCK_INCREMENT_MS,
      ),
      log: [
        ...log,
        `--- 対局開始:${PLAYER_META[base.firstPlayer].name}の番 ---`,
      ],
      interstitial: { forPlayer: base.firstPlayer, kind: "turn" },
    };

  const army = (i) =>
    Object.values(base.pieces).filter((p) => p.owner === i && p.alive);
  const straights = [0, 1].map((i) => isStraight(army(i)));
  const flushes = [0, 1].map((i) => isFlush(army(i)));

  // ストレートは先手と後手を入れ替える。両者そろえば元に戻る
  let first = base.firstPlayer;
  if (straights[0] !== straights[1]) first = 1 - first;

  let pieces = base.pieces;
  let board = base.board;
  const revealed = [];
  let nextLog = [...log];

  for (const i of [0, 1])
    if (straights[i]) nextLog.push(`${PLAYER_META[i].name}の布陣はストレート!`);
  if (straights[0] !== straights[1])
    nextLog.push("布陣ボーナス: 先手と後手が入れ替わった");
  else if (straights[0]) nextLog.push("両者ストレートのため、先手はそのまま");

  // フラッシュは相手の駒を公開させる。王は選ばれない
  const seed = Object.keys(base.pieces).sort().join(",");
  for (const i of [0, 1]) {
    if (!flushes[i]) continue;
    const foes = army(1 - i)
      .filter((p) => !p.isKing)
      .map((p) => p.id);
    const count = revealCount(base.boardSize);
    const picked = pickRevealed(foes, count, `${seed}|${i}`);
    if (!picked.length) continue;
    pieces = { ...pieces };
    board = board.map((r) => [...r]);
    for (const id of picked) {
      const shown = { ...pieces[id], revealed: true };
      pieces[id] = shown;
      board[shown.row][shown.col] = shown;
      revealed.push({
        id,
        owner: shown.owner,
        rank: shown.rank,
        suit: shown.suit,
        by: i,
      });
    }
    nextLog.push(
      `${PLAYER_META[i].name}の布陣はフラッシュ! ${PLAYER_META[1 - i].name}の駒が${picked.length}枚公開された`,
    );
  }

  const effects =
    straights.some(Boolean) || flushes.some(Boolean)
      ? {
          straights,
          flushes,
          revealed,
          swapped: straights[0] !== straights[1],
          first,
        }
      : null;

  return {
    ...base,
    pieces,
    board,
    phase: "play",
    currentTurn: first,
    firstPlayer: first,
    clocks: replaceAt(
      base.clocks,
      first,
      base.clocks[first] + CLOCK_INCREMENT_MS,
    ),
    log: [...nextLog, `--- 対局開始:${PLAYER_META[first].name}の番 ---`],
    setupEffects: effects,
    interstitial: { forPlayer: first, kind: "turn" },
  };
}

/* =========================================================================
   reducer
   ========================================================================= */

export function reducer(state, action) {
  const next = coreReducer(state, action);
  return afterAction(state, next, action);
}

/**
 * 全アクション共通の後始末。
 * 持ち時間の増減と、演出のための「倒れたマス」の取りまとめをここでやる。
 */
function afterAction(prev, next, action) {
  let out = next;

  // 記録に残る出来事があったら、その時点の盤面を控えておく。
  // あとから「この時どうなっていたか」を見られるようにするため
  // 対局を組み立てる前は log が無いこともある
  const hadLogs = prev.log ? prev.log.length : 0;
  if (out.log && out.log.length > hadLogs && out.board && out.board.length) {
    const added = out.log.slice(hadLogs).filter(isNotableLog);
    if (added.length) {
      const snapshot = out.board.map((row) =>
        row.map((piece) =>
          piece
            ? {
                rank: piece.rank,
                suit: piece.suit,
                owner: piece.owner,
                isKing: !!piece.isKing,
              }
            : null,
        ),
      );
      // 動いた駒の出発点と着地点、そしてこの手で倒れたマス。
      // 記録の行を選んだときに、盤の上で色を付けて示すために持っておく
      const movedNow =
        out.lastMove &&
        (!prev.lastMove || prev.lastMove.seq !== out.lastMove.seq)
          ? out.lastMove
          : null;
      // 道連れで動いた駒がその場で倒れると、着地点には誰も立たない。
      // その時は着地点のしるしを出さない。倒れたマスの×が代わりに語る
      const landed =
        movedNow && out.board[movedNow.to.row][movedNow.to.col]
          ? movedNow.to
          : null;
      const mark = {
        from: movedNow ? movedNow.from : null,
        to: landed,
        taken: (out._defeats || []).map((d) => ({
          row: d.row,
          col: d.col,
          owner: d.owner,
        })),
      };
      out = {
        ...out,
        replay: [
          ...(out.replay || []),
          ...added.map((line) => ({ line, board: snapshot, mark })),
        ],
      };
    }
  }

  if (out._defeats || out._defeatVia) {
    const cells = out._defeats || [];
    out = { ...out };
    delete out._defeats;
    delete out._defeatVia;
    if (cells.length)
      out.lastDefeat = {
        cells,
        by: prev.currentTurn,
        via: next._defeatVia || "capture",
        seq: (prev.lastDefeat ? prev.lastDefeat.seq : 0) + 1,
      };
  }

  // 手番が移ったら、使った分を引いて、始まる側に加算する
  if (
    prev.phase === "play" &&
    out.phase === "play" &&
    out.clocks &&
    out.currentTurn !== prev.currentTurn
  ) {
    const spent = Math.max(0, action.elapsedMs || 0);
    const mover = prev.currentTurn;
    const clocks = [...out.clocks];
    clocks[mover] = Math.max(0, clocks[mover] - spent);
    // 考えた時間が持ち時間を超えたら、その場で負け。
    // 画面側の秒読みに頼らず、ここで決着させておく
    if (clocks[mover] <= 0) {
      out = {
        ...out,
        clocks,
        phase: "gameover",
        winner: 1 - mover,
        timeoutBy: mover,
        interstitial: null,
        log: [
          ...out.log,
          `${PLAYER_META[mover].name}の持ち時間が尽きた…${PLAYER_META[1 - mover].name}の勝利!`,
        ],
      };
    } else {
      clocks[out.currentTurn] = clocks[out.currentTurn] + CLOCK_INCREMENT_MS;
      out = { ...out, clocks };
    }
  }

  return out;
}

function coreReducer(state, action) {
  switch (action.type) {
    case "START_SETUP": {
      const size = action.size;
      const deck = action.deck || shuffle(buildDeck(action.pool));
      // 小さいカードプールでは手札も減らす。予備札が尽きると引き直せなくなる
      const handSize =
        action.handSize ||
        Math.max(totalSlots(size), Math.min(13, Math.floor(deck.length / 3)));
      const hand0 = deck.slice(0, handSize);
      const hand1 = deck.slice(handSize, handSize * 2);
      const reserve = deck.slice(handSize * 2);
      const players = [makePlayer(0), makePlayer(1)];
      players[0].hand = hand0;
      players[1].hand = hand1;
      return {
        ...initialState(),
        boardSize: size,
        players,
        reserve,
        setupMode:
          action.setupMode === "simultaneous" ? "simultaneous" : "sequential",
        pool: action.pool || null,
        // 台本どおりに進めるチュートリアルでは布陣ボーナスを出さない。
        // 先手が入れ替わったり駒が公開されたりすると、案内と噛み合わなくなる
        scripted: !!action.scripted,
        phase: "dice",
        interstitial: { forPlayer: 0, kind: "dice" },
      };
    }

    case "ROLL_DICE_SINGLE": {
      if (state.dice[state.diceIdx] !== null) return state;
      const value = action.value || 1 + Math.floor(Math.random() * 6);
      const dice = [...state.dice];
      dice[state.diceIdx] = value;
      return { ...state, dice };
    }

    case "NEXT_DICE_STEP": {
      if (state.diceIdx === 0 && state.dice[0] !== null) {
        return {
          ...state,
          diceIdx: 1,
          interstitial: { forPlayer: 1, kind: "dice" },
        };
      }
      if (state.dice[0] !== null && state.dice[1] !== null) {
        if (state.dice[0] === state.dice[1]) {
          return {
            ...state,
            diceIdx: 3,
            log: [
              ...state.log,
              `サイコロが同じ目(${state.dice[0]})だったので振り直します`,
            ],
          };
        }
        const first = state.dice[0] > state.dice[1] ? 0 : 1;
        return {
          ...state,
          diceIdx: 2,
          firstPlayer: first,
          currentTurn: first,
          log: [
            ...state.log,
            `サイコロ: ${PLAYER_META[0].name}=${state.dice[0]} / ${PLAYER_META[1].name}=${state.dice[1]} → ${PLAYER_META[first].name}が先手`,
          ],
        };
      }
      return state;
    }

    case "REROLL_DICE":
      return {
        ...state,
        dice: [null, null],
        diceIdx: 0,
        interstitial: { forPlayer: 0, kind: "dice" },
      };

    case "GOTO_MULLIGAN":
      return {
        ...state,
        phase: "mulligan",
        mulliganIdx: state.firstPlayer,
        interstitial: { forPlayer: state.firstPlayer, kind: "mulligan" },
      };

    case "TOGGLE_MULLIGAN_CARD": {
      const idx = state.mulliganIdx;
      const players = state.players.map((p, i) => {
        if (i !== idx) return p;
        const picked = new Set(p._mulliganSelected || []);
        if (picked.has(action.cardId)) picked.delete(action.cardId);
        else if (picked.size < state.reserve.length) picked.add(action.cardId);
        return { ...p, _mulliganSelected: [...picked] };
      });
      return { ...state, players };
    }

    case "CONFIRM_MULLIGAN": {
      const idx = state.mulliganIdx;
      const players = [...state.players];
      const me = { ...players[idx] };
      const discardIds = new Set(
        action.discardIds || me._mulliganSelected || [],
      );
      const kept = me.hand.filter((c) => !discardIds.has(c.id));
      const discarded = me.hand
        .filter((c) => discardIds.has(c.id))
        .map((c) => ({ ...c, owner: idx }));
      const count = discarded.length;
      const pool = action.reserveOrder
        ? action.reserveOrder
            .map((id) => state.reserve.find((c) => c.id === id))
            .filter(Boolean)
        : shuffle(state.reserve);
      const drawn = pool.slice(0, count);
      const rest = pool.slice(count);

      me.hand = [...kept, ...drawn];
      me.discard = [...me.discard, ...discarded];
      delete me._mulliganSelected;
      players[idx] = me;

      const log = [
        ...state.log,
        `${PLAYER_META[idx].name}が${count}枚を引き直した`,
      ];

      if (idx === state.firstPlayer) {
        return {
          ...state,
          players,
          reserve: rest,
          mulliganIdx: 1 - state.firstPlayer,
          log,
          interstitial: { forPlayer: 1 - state.firstPlayer, kind: "mulligan" },
        };
      }
      return {
        ...state,
        players,
        reserve: rest,
        phase: "setup",
        setupIdx: state.firstPlayer,
        setupSteps: ["place", "place"],
        setupPickKings: [null, null],
        setupPlacements: [{}, {}],
        setupDone: [false, false],
        log,
        interstitial:
          state.setupMode === "simultaneous"
            ? null
            : { forPlayer: state.firstPlayer, kind: "setup" },
      };
    }

    case "SETUP_PLACE_CARD": {
      const idx = setupActor(state, action);
      if (idx === null || state.setupDone[idx]) return state;
      const me = state.players[idx];
      const slots = totalSlots(state.boardSize);
      const card = me.hand.find((c) => c.id === action.cardId);
      if (!card) return state;
      const [lo, hi] = territoryRows(state.boardSize, idx);
      if (action.row < lo || action.row > hi) return state;

      const placement = { ...state.setupPlacements[idx] };
      if (!placement[action.cardId]) {
        if (Object.keys(placement).length >= slots) return state;
        const counts = placedRankCounts(placement, me.hand);
        if (card.rank === "K") {
          if (
            (counts.K || 0) >= 1 ||
            (counts.J || 0) > 1 ||
            (counts.Q || 0) > 1
          )
            return state;
        } else {
          const hasK = (counts.K || 0) > 0;
          const limit = maxAdopt(card.rank, hasK ? "K" : null);
          if ((counts[card.rank] || 0) >= limit) return state;
        }
      }

      // 置き先が埋まっていたら入れ替える。移動元が無いなら置けない
      const occupant = Object.keys(placement).find(
        (id) =>
          placement[id].row === action.row && placement[id].col === action.col,
      );
      const mine = placement[action.cardId];
      if (occupant && occupant !== action.cardId) {
        if (mine) placement[occupant] = mine;
        else return state;
      }
      placement[action.cardId] = { row: action.row, col: action.col };
      return withSetupPlacement(state, idx, placement);
    }

    case "SETUP_UNPLACE_CARD": {
      const idx = setupActor(state, action);
      if (idx === null || state.setupDone[idx]) return state;
      const placement = { ...state.setupPlacements[idx] };
      delete placement[action.cardId];
      return withSetupPlacement(state, idx, placement);
    }

    case "SETUP_AUTO_ARRANGE": {
      const idx = setupActor(state, action);
      if (idx === null || state.setupDone[idx]) return state;
      const placement = autoArrange(
        state,
        idx,
        action.cellOrder,
        action.handOrder,
        action.keep ? state.setupPlacements[idx] : null,
      );
      return withSetupPlacement(state, idx, placement);
    }

    case "SETUP_GOTO_KING_STEP": {
      const idx = setupActor(state, action);
      if (idx === null) return state;
      if (
        Object.keys(state.setupPlacements[idx]).length !==
        totalSlots(state.boardSize)
      )
        return state;
      return {
        ...state,
        setupSteps: replaceAt(state.setupSteps, idx, "king"),
        setupPickKings: replaceAt(state.setupPickKings, idx, null),
      };
    }

    case "SETUP_BACK_TO_PLACE": {
      const idx = setupActor(state, action);
      if (idx === null) return state;
      return {
        ...state,
        setupSteps: replaceAt(state.setupSteps, idx, "place"),
        setupPickKings: replaceAt(state.setupPickKings, idx, null),
      };
    }

    case "SETUP_PICK_KING": {
      const idx = setupActor(state, action);
      if (idx === null) return state;
      const me = state.players[idx];
      const placement = state.setupPlacements[idx];
      const card = me.hand.find((c) => c.id === action.cardId);
      if (!card || !placement[action.cardId]) return state;
      // Kを布陣に入れているなら、王はそのKでなければならない
      const hasK = Object.keys(placement).some(
        (id) => me.hand.find((c) => c.id === id).rank === "K",
      );
      if (hasK && card.rank !== "K") return state;
      return {
        ...state,
        setupPickKings: replaceAt(state.setupPickKings, idx, action.cardId),
      };
    }

    case "SETUP_CONFIRM": {
      const idx = setupActor(state, action);
      if (idx === null || state.setupDone[idx]) return state;
      const placement = action.placement || state.setupPlacements[idx];
      const kingId = action.kingId || state.setupPickKings[idx];
      if (!kingId || !placement[kingId]) return state;
      const ids = Object.keys(placement);
      if (ids.length !== totalSlots(state.boardSize)) return state;

      const players = [...state.players];
      const me = { ...players[idx] };
      // 自分の手札にない札が混じった布陣は受け付けない
      if (ids.some((id) => !me.hand.some((c) => c.id === id))) return state;
      const rankCounts = {};
      const board = state.board.length
        ? state.board.map((r) => [...r])
        : emptyBoard(state.boardSize);
      const pieces = { ...state.pieces };

      ids.forEach((id) => {
        const card = me.hand.find((c) => c.id === id);
        rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
        const at = placement[id];
        const piece = {
          id: card.id,
          rank: card.rank,
          suit: card.suit,
          owner: idx,
          isKing: id === kingId,
          row: at.row,
          col: at.col,
          alive: true,
          history: [],
          everRevived: false,
        };
        pieces[piece.id] = piece;
        board[at.row][at.col] = piece;
      });

      me.hand = me.hand.filter((c) => !ids.includes(c.id));
      me.armyRankCounts = rankCounts;
      me.kingId = kingId;
      me.ready = true;
      players[idx] = me;

      const setupDone = replaceAt(state.setupDone, idx, true);
      const log = [...state.log, `${PLAYER_META[idx].name}が布陣を完了`];
      const base = {
        ...state,
        players,
        board,
        pieces,
        setupDone,
        setupPlacements: replaceAt(state.setupPlacements, idx, placement),
        setupPickKings: replaceAt(state.setupPickKings, idx, kingId),
        setupSteps: replaceAt(state.setupSteps, idx, "done"),
        log,
      };

      // 相手がまだなら待つ。順番に置くモードでは端末を渡す
      if (!setupDone[1 - idx]) {
        const other = 1 - idx;
        if (state.setupMode === "simultaneous") return base;
        return {
          ...base,
          setupIdx: other,
          interstitial: { forPlayer: other, kind: "setup" },
        };
      }

      return startPlay(base, log);
    }

    case "DISMISS_SETUP_EFFECTS":
      return { ...state, setupEffects: null };

    case "CLOCK_TIMEOUT": {
      const loser = action.player;
      if (state.winner !== null && state.winner !== undefined) return state;
      if (state.phase !== "play") return state;
      return {
        ...state,
        phase: "gameover",
        winner: 1 - loser,
        timeoutBy: loser,
        clocks: replaceAt(state.clocks, loser, 0),
        log: [
          ...state.log,
          `${PLAYER_META[loser].name}の持ち時間が尽きた…${PLAYER_META[1 - loser].name}の勝利!`,
        ],
      };
    }

    case "DISMISS_INTERSTITIAL":
      return { ...state, interstitial: null };

    case "SELECT_PIECE": {
      if (state.winner) return state;
      const piece = state.pieces[action.id];
      if (!piece || !piece.alive || piece.owner !== state.currentTurn)
        return state;
      if (state.extraMoveFor && piece.id !== state.extraMoveFor) return state;
      if (piece.rank === "A") {
        return {
          ...state,
          selectedId: null,
          shuffleMode: { aId: piece.id, picks: [] },
        };
      }
      return { ...state, selectedId: action.id, shuffleMode: null };
    }

    case "CANCEL_SELECTION":
      return { ...state, selectedId: null, shuffleMode: null };

    case "TOGGLE_SHUFFLE_PICK": {
      if (!state.shuffleMode) return state;
      const piece = state.pieces[action.id];
      if (!piece || !piece.alive || piece.id === state.shuffleMode.aId)
        return state;
      let picks = [...state.shuffleMode.picks];
      if (picks.includes(action.id))
        picks = picks.filter((id) => id !== action.id);
      else if (picks.length < 2) picks = [...picks, action.id];
      return { ...state, shuffleMode: { ...state.shuffleMode, picks } };
    }

    case "CONFIRM_SHUFFLE": {
      const aId = action.aId || (state.shuffleMode && state.shuffleMode.aId);
      const picks =
        action.pickIds || (state.shuffleMode && state.shuffleMode.picks) || [];
      if (!aId || picks.length !== 2) return state;

      const ids = [aId, ...picks];
      const cells = ids.map((id) => ({
        row: state.pieces[id].row,
        col: state.pieces[id].col,
      }));
      const shuffled = action.order
        ? action.order.map((i) => cells[i])
        : shuffle(cells);
      const board = state.board.map((r) => [...r]);
      const pieces = { ...state.pieces };

      ids.forEach((id) => {
        board[pieces[id].row][pieces[id].col] = null;
      });
      // 王のAは1ターンに2回入れ替えられる。2回目だと分かるように残す
      const secondSwap = state.extraMoveFor === aId;
      ids.forEach((id, i) => {
        const at = shuffled[i];
        pieces[id] = {
          ...pieces[id],
          row: at.row,
          col: at.col,
          history: [
            ...pieces[id].history,
            `周囲の駒と位置を入れ替えた${secondSwap && id === aId ? "(2回目)" : ""}`,
          ],
        };
        board[at.row][at.col] = pieces[id];
      });

      const log = [
        ...state.log,
        `${PLAYER_META[state.currentTurn].name}が3つの駒の位置を入れ替えた${secondSwap ? "(2回目)" : ""}`,
      ];
      let next = {
        ...state,
        board,
        pieces,
        shuffleMode: null,
        log,
        lastMove: null,
        lastSwap: { cells, owner: state.currentTurn },
      };

      // 3つとも味方なら、三角形の内側にいる相手を包囲で取る
      if (ids.every((id) => pieces[id].owner === state.currentTurn)) {
        next = { ...next, _defeatVia: "surround" };
        const [a, b, c] = ids.map((id) => ({
          row: pieces[id].row,
          col: pieces[id].col,
        }));
        const trapped = Object.values(pieces)
          .filter(
            (p) =>
              p.alive &&
              p.owner !== state.currentTurn &&
              pointInTriangle({ row: p.row, col: p.col }, a, b, c),
          )
          // 王は最後に倒す。取ってはじめて正体が分かる見せ方に合わせる
          .sort((x, y) => (x.isKing ? 1 : 0) - (y.isKing ? 1 : 0));
        const defeated = [];
        for (const victim of trapped) {
          const piece = next.pieces[victim.id];
          if (!piece || !piece.alive) continue;
          defeated.push({
            rank: piece.rank,
            suit: piece.suit,
            owner: piece.owner,
            // 取ってはじめて、それが王だったと分かる
            isKing: !!piece.isKing,
          });
          next.log = [
            ...next.log,
            `${PLAYER_META[state.currentTurn].name}が包囲で${PLAYER_META[piece.owner].name}の${piece.rank}${SUIT_SYMBOL[piece.suit]}を撃破!`,
          ];
          next = removePiece(next, victim.id, { by: null, viaCounter: true });
          // 王を取った時点で止めない。囲んだ駒は全部倒してから決着する
        }
        if (defeated.length) {
          next.captureReveal = {
            defeated,
            capturedBy: state.currentTurn,
            surround: true,
          };
        }
      }
      return endAction(next, aId);
    }

    case "MOVE_PIECE": {
      if (state.winner) return state;
      const mover = state.pieces[action.pieceId || state.selectedId];
      if (!mover || !mover.alive) return state;
      // 王の10は1ターンに2回動ける。どちらの手かを記録に添える
      const secondAction = state.extraMoveFor === mover.id;
      const twiceKing = mover.isKing && mover.rank === "10";
      const nth = secondAction ? "2回目" : "1回目";

      const board = state.board.map((r) => [...r]);
      let next = {
        ...state,
        board,
        pieces: { ...state.pieces },
        selectedId: null,
        lastReveal: null,
      };

      const targets =
        action.captures && action.captures.length
          ? action.captures
          : board[action.row][action.col]
            ? [{ row: action.row, col: action.col }]
            : [];
      const defeated = [];

      for (const at of targets) {
        const victim = next.board[at.row][at.col];
        if (!victim || victim.owner === mover.owner) continue;
        defeated.push({
          rank: victim.rank,
          suit: victim.suit,
          owner: victim.owner,
          isKing: !!victim.isKing,
        });
        next.log = [
          ...next.log,
          `${PLAYER_META[state.currentTurn].name}が${PLAYER_META[victim.owner].name}の${victim.rank}${SUIT_SYMBOL[victim.suit]}を撃破!${twiceKing ? `(${nth})` : ""}`,
        ];
        next = removePiece(next, victim.id, {
          by: mover.id,
          viaCounter: false,
        });
        // 王を取った時点で止めない。まとめ取りは全部取ってから決着する
      }
      if (defeated.length) {
        // 盤の演出は手前から順に。札をめくる順だけ、王を最後に回す
        const cards = [
          ...defeated.filter((c) => !c.isKing),
          ...defeated.filter((c) => c.isKing),
        ];
        next.captureReveal = { defeated: cards, capturedBy: state.currentTurn };
      }

      const moved = next.pieces[mover.id];
      const nextBoard = next.board.map((r) => [...r]);
      const nextPieces = { ...next.pieces };
      if (moved && moved.alive) {
        nextBoard[mover.row][mover.col] = null;
        const updated = {
          ...moved,
          row: action.row,
          col: action.col,
          history: [
            ...moved.history,
            `${squareName(mover.row, mover.col, state.boardSize)} → ${squareName(action.row, action.col, state.boardSize)} へ移動${secondAction ? "(2回目)" : ""}`,
          ],
        };
        nextPieces[mover.id] = updated;
        nextBoard[action.row][action.col] = updated;
      }

      // 1ターンに2回動ける王が取らずに動いただけだと、対局の記録に
      // 何も残らず、盤の駒が動いた理由が読み取れなくなる。
      // 普通の駒の移動は記録に残さないが、この場合だけは残す
      const moveLog =
        twiceKing && defeated.length === 0 && moved && moved.alive
          ? [
              ...next.log,
              `${PLAYER_META[state.currentTurn].name}が${nth}に移動 (${squareName(mover.row, mover.col, state.boardSize)} → ${squareName(action.row, action.col, state.boardSize)})`,
            ]
          : next.log;

      next = {
        ...next,
        board: nextBoard,
        pieces: nextPieces,
        log: moveLog,
        lastSwap: null,
        lastMove: {
          from: { row: mover.row, col: mover.col },
          to: { row: action.row, col: action.col },
          owner: state.currentTurn,
          captured: defeated.length > 0,
          // 演出をやり直させるための通し番号
          seq: (state.lastMove ? state.lastMove.seq || 0 : 0) + 1,
        },
      };
      return endAction(next, mover.id);
    }

    case "DISMISS_CAPTURE":
      return { ...state, captureReveal: null };

    case "ACK_KING_CHOICE":
      if (!state.pendingKingChoice) return state;
      return {
        ...state,
        pendingKingChoice: { ...state.pendingKingChoice, acknowledged: true },
      };

    case "CHOOSE_HEIR": {
      const pending = state.pendingKingChoice;
      if (!pending || !pending.candidateIds.includes(action.id)) return state;
      const heir = state.pieces[action.id];
      if (!heir || !heir.alive) return state;

      const pieces = { ...state.pieces };
      const board = state.board.map((r) => [...r]);
      const crowned = {
        ...heir,
        isKing: true,
        history: [...heir.history, "王位を継承"],
      };
      pieces[heir.id] = crowned;
      board[heir.row][heir.col] = crowned;
      const players = state.players.map((p, i) =>
        i === pending.owner ? { ...p, kingId: heir.id } : p,
      );

      return {
        ...state,
        pieces,
        board,
        players,
        pendingKingChoice: null,
        log: [
          ...state.log,
          `${PLAYER_META[pending.owner].name}に新しい王が立った!`,
        ],
      };
    }

    case "PLACE_RESERVE_CARD": {
      if (!state.kPlacement) return state;
      const { owner, card } = state.kPlacement;
      const board = state.board.map((r) => [...r]);
      const pieces = { ...state.pieces };
      const piece = {
        id: card.id,
        rank: card.rank,
        suit: card.suit,
        owner,
        isKing: false,
        row: action.row,
        col: action.col,
        alive: true,
        history: ["予備札から出撃"],
        everRevived: false,
      };
      pieces[piece.id] = piece;
      board[action.row][action.col] = piece;

      const players = state.players.map((p, i) =>
        i === owner
          ? {
              ...p,
              armyRankCounts: {
                ...p.armyRankCounts,
                [card.rank]: (p.armyRankCounts[card.rank] || 0) + 1,
              },
            }
          : p,
      );
      return {
        ...state,
        board,
        pieces,
        players,
        kPlacement: null,
        log: [...state.log, `${PLAYER_META[owner].name}が予備札から1枚を投入`],
      };
    }

    case "SKIP_RESERVE_PLACEMENT":
      return { ...state, kPlacement: null };

    case "SKIP_EXTRA_ACTION":
      return endTurn(state);

    case "VIEW_LOG":
      return { ...state, logViewerId: action.id };

    case "CLOSE_LOG":
      return { ...state, logViewerId: null };

    case "RESIGN": {
      const who = action.player;
      if (who == null) return state;
      return {
        ...state,
        phase: "gameover",
        winner: 1 - who,
        resignedBy: who,
        selectedId: null,
        shuffleMode: null,
        extraMoveFor: null,
        log: [
          ...state.log,
          `${PLAYER_META[who].name}が降参した…${PLAYER_META[1 - who].name}の勝利!`,
        ],
      };
    }

    case "NEW_GAME":
      return initialState();

    default:
      return state;
  }
}
