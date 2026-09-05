import { isStraight, isFlush, revealCount, pickRevealed } from "./bonus.js";
import { PLAYER_META, RANKS, SUITS, SUIT_SYMBOL } from "./constants.js";
import {
  buildDeck,
  getLegalMoves,
  inBounds,
  kingRankOf,
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

/**
 * その手を名乗ってよい席か。
 *
 * 通信で届いた手には、受け取り側が「送り主の席」を必ず書き込む
 * (src/net/sync.js の acceptAct)。名乗りが無いのは手元の操作なので通す。
 * 名乗りがあるのに、その場面で指してよい側でなければ捨てる。
 *
 * これが無いと、相手はこちらの手番を勝手に指せる。盤を進める手の多くは
 * 「誰が指したか」を手の中に持たず、受け取った側の state.currentTurn から
 * 決めているので、相手の番に1件送るだけで通ってしまう
 */
/**
 * その手を受け取ってよい場面。
 *
 * **両方向に効かせること。** 「対局中の手を対局中以外で止める」だけでは
 * 足りない。逆に、準備段階の手が対局中に通ると、相手はサイコロの手ひとつで
 * 手番を奪えるし、引き直しの場面まで盤を巻き戻せる
 */
const RECEIVABLE = {
  START_SETUP: ["intro"],
  ROLL_DICE_SINGLE: ["dice"],
  NEXT_DICE_STEP: ["dice"],
  REROLL_DICE: ["dice"],
  GOTO_MULLIGAN: ["dice"],
  CONFIRM_MULLIGAN: ["mulligan"],
  SETUP_CONFIRM: ["setup"],
  MOVE_PIECE: ["play"],
  CONFIRM_SHUFFLE: ["play"],
  SKIP_EXTRA_ACTION: ["play"],
  SKIP_RESERVE_PLACEMENT: ["play"],
  PLACE_RESERVE_CARD: ["play"],
  CHOOSE_HEIR: ["play"],
  RESIGN: ["setup", "play"],
  CLOCK_TIMEOUT: ["setup", "play"],
  NEW_GAME: ["gameover"],
};

/** その手を出してよい席。縛らないものは null */
function expectedActor(state, type) {
  switch (type) {
    case "MOVE_PIECE":
    case "CONFIRM_SHUFFLE":
    case "SKIP_EXTRA_ACTION":
      return state.currentTurn;
    case "PLACE_RESERVE_CARD":
    case "SKIP_RESERVE_PLACEMENT":
      return state.kPlacement ? state.kPlacement.owner : null;
    case "CHOOSE_HEIR":
      return state.pendingKingChoice ? state.pendingKingChoice.owner : null;
    case "CONFIRM_MULLIGAN":
      return state.mulliganIdx;
    case "ROLL_DICE_SINGLE":
      // 自分の目は自分で振る
      return state.diceIdx === 0 || state.diceIdx === 1 ? state.diceIdx : null;
    default:
      return null;
  }
}

/**
 * その手を、いまこの場面で、その席が出してよいか。
 *
 * 通信で届いた手には、受け取り側が「送り主の席」を必ず書き込む
 * (src/net/sync.js の acceptAct)。名乗りが無いのは手元の操作なので通す
 */
function actorAllowed(state, action) {
  const phases = RECEIVABLE[action.type];
  if (phases && !phases.includes(state.phase)) return false;
  const who = action.player;
  if (who !== 0 && who !== 1) return true;
  // 王が倒れて跡継ぎを選ぶ場面では、それを選ぶまで他の手を出せない。
  // 手元の画面は選ばせるが、通信で届く手には強制力が無い。放っておくと、
  // 王のいない軍ができて「撃破では二度と負けない」状態になる
  if (
    state.pendingKingChoice &&
    state.pendingKingChoice.owner === who &&
    action.type !== "CHOOSE_HEIR" &&
    action.type !== "RESIGN" &&
    action.type !== "CLOCK_TIMEOUT"
  )
    return false;
  const want = expectedActor(state, action.type);
  return want === null || want === undefined || who === want;
}

/**
 * その布陣を受け付けてよいか。
 *
 * 1枚ずつ置くとき(SETUP_PLACE_CARD)には自陣・重なり・採用上限の関門があるのに、
 * 確定の手はそれを丸ごと迂回していた。通信では確定の手だけが飛んでくるので、
 * ここで同じことを確かめないと、相手はこちらの最奥の行に布陣できるし、
 * 同じマスに駒を重ねて「盤に無いのに生きている駒」を作れる
 */
function placementOk(state, idx, placement, kingId) {
  if (!placement || typeof placement !== "object") return false;
  const ids = Object.keys(placement);
  if (ids.length !== totalSlots(state.boardSize)) return false;
  if (new Set(ids).size !== ids.length) return false;
  const hand = state.players[idx].hand;
  const king = hand.find((c) => c.id === kingId);
  if (!king || !placement[kingId]) return false;
  const size = state.boardSize;
  const [lo, hi] = territoryRows(size, idx);
  const seen = new Set();
  for (const id of ids) {
    if (!hand.some((c) => c.id === id)) return false;
    const at = placement[id];
    if (!at || !Number.isInteger(at.row) || !Number.isInteger(at.col))
      return false;
    if (!inBounds(at.row, at.col, size)) return false;
    if (at.row < lo || at.row > hi) return false;
    const key = `${at.row},${at.col}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  const counts = placedRankCounts(placement, hand);
  for (const rank of Object.keys(counts))
    if (counts[rank] > maxAdopt(rank, king.rank)) return false;
  return true;
}

/**
 * その MOVE_PIECE が、その駒で本当に指せる手か。
 *
 * 着地点も取る駒も送り主の言い値でしかない。データベースのルールは盤を
 * 知らないので止められない。受け取った側で合法手を引き直して照らす。
 * これが無いと、相手は盤の反対側から王を直接取れるし、captures に
 * 好きなだけマスを並べて1手で盤を掃討できる
 */
function movePermitted(state, mover, action) {
  // 形を確かめるより先に使うと、配列でない captures で例外が出る。
  // 受け取り側だけが手を落とすと、二人の盤が黙って食い違っていく
  if (action.captures !== undefined && !Array.isArray(action.captures))
    return false;
  const moves = getLegalMoves(
    mover,
    state.board,
    state.board.length,
    state.players[mover.owner].armyRankCounts,
    kingRankOf(state, mover.owner),
  );
  const mv = moves.find((m) => m.row === action.row && m.col === action.col);
  if (!mv) return false;
  const key = (c) => `${c.row},${c.col}`;
  const want = mv.captures ? mv.captures.map(key) : mv.capture ? [key(mv)] : [];
  const got = action.captures
    ? action.captures.map(key)
    : mv.capture
      ? [key(action)]
      : [];
  if (got.length !== want.length) return false;
  // 同じマスを2度書くと、集合としては合うのに枚数が足りる。
  // それを許すと「まとめ取りの途中の1枚だけ取らずに通り抜ける」手が通り、
  // 着地点にいた駒は撃破もされずに盤から消える(王でも決着しない)
  if (new Set(got).size !== got.length) return false;
  const set = new Set(want);
  return got.every((k) => set.has(k));
}

/** その手で本当に取れるマスの並び。届いた並びは使わない */
function capturesFor(state, mover, action) {
  const moves = getLegalMoves(
    mover,
    state.board,
    state.board.length,
    state.players[mover.owner].armyRankCounts,
    kingRankOf(state, mover.owner),
  );
  const mv = moves.find((m) => m.row === action.row && m.col === action.col);
  if (!mv) return [];
  if (mv.captures) return mv.captures.map((c) => ({ row: c.row, col: c.col }));
  return mv.capture ? [{ row: mv.row, col: mv.col }] : [];
}

/**
 * 通信で届いた手か。
 *
 * 届いた手には受け取り側が「送り主の席」を書き込む(acceptAct)ので、
 * 名乗りがあれば通信、無ければ手元の操作。
 */
function fromNetwork(action) {
  return action.player === 0 || action.player === 1;
}

/**
 * 乱数の結果は、送る側が手に焼き込む(src/game/actions.js の enrichAction)。
 * 欄が欠けた手を受け取ったときに、受け手が自分で振ってしまうと、
 * 二人の盤が別々に決まって黙って食い違っていく。
 * **欄が無いことを「乱数で埋めてよい合図」にしない。**
 */
/**
 * 山札として使える形か。
 *
 * 配列かどうかだけでは足りない。同じ id を並べた山札を送ると、二人の駒が
 * 同じ id を共有し、あとから布陣した側が相手の駒を台帳から追い出す。
 * 中身が壊れていれば、受け取った側の画面が落ちる
 */
function deckOk(deck) {
  if (!Array.isArray(deck) || deck.length < 2 || deck.length > 64) return false;
  const ids = new Set();
  for (const c of deck) {
    if (!c || typeof c !== "object") return false;
    if (typeof c.id !== "string" || !c.id || c.id.length > 16) return false;
    if (!RANKS.includes(c.rank) || !SUITS.includes(c.suit)) return false;
    if (ids.has(c.id)) return false;
    ids.add(c.id);
  }
  return true;
}

function seedsPresent(state, action) {
  if (!fromNetwork(action)) return true;
  switch (action.type) {
    case "START_SETUP":
      return deckOk(action.deck);
    case "ROLL_DICE_SINGLE":
      return (
        Number.isInteger(action.value) && action.value >= 1 && action.value <= 6
      );
    case "CONFIRM_MULLIGAN":
      return Array.isArray(action.reserveOrder);
    case "CONFIRM_SHUFFLE":
      return (
        Array.isArray(action.order) &&
        action.order.length === 3 &&
        new Set(action.order).size === 3 &&
        action.order.every((i) => i === 0 || i === 1 || i === 2)
      );
    default:
      return true;
  }
}

/**
 * その側に、指せる手がひとつでもあるか。
 *
 * 6〜9の王は「取れるときしか動けない」ので、周りに敵がおらず他の駒も
 * 塞がれていると合法手が0になる。手番を渡す手も無いと、持ち時間が
 * 尽きるまで何も押せない(CPU 側で起きると CPU が固まる)
 */
export function hasAnyMove(state, player) {
  return Object.values(state.pieces).some(
    (p) =>
      p.alive &&
      p.owner === player &&
      getLegalMoves(
        p,
        state.board,
        state.board.length,
        state.players[player].armyRankCounts,
        kingRankOf(state, player),
      ).length > 0,
  );
}

/** 盤の上のマスか。通信で届いた座標をそのまま添字に使わないための番人 */
function onBoard(board, row, col) {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    inBounds(row, col, board.length)
  );
}

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
    lastRevenge: null,
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

  // 王を討った駒は、その場で表になって名乗りを上げる。
  //
  // 王を取れば基本的に勝敗が決まるので、そこから先に隠しておく意味が薄い。
  // 2・3の王なら対局は続くが、そのぶんは討った側が正体を明かす代償として払う。
  // 隠したままにすると「討った駒の映像を出すと正体が漏れる」ことになり、
  // スキンを着けている人だけが損をする形になってしまう。
  //
  // 包囲で討ったときは名乗る駒が定まらないので、誰も表にしない。
  let lastReveal = null;
  if (dead.isKing && opts.by) {
    const killer = pieces[opts.by];
    if (killer && killer.alive && !killer.revealed) {
      const shown = {
        ...killer,
        revealed: true,
        history: [...killer.history, "王を討って名乗りを上げた"],
      };
      pieces[shown.id] = shown;
      if (board[shown.row][shown.col]?.id === shown.id)
        board[shown.row][shown.col] = shown;
      lastReveal = { id: shown.id, reason: "王を討った" };
      log.push(
        `${PLAYER_META[shown.owner].name}の${shown.rank}${SUIT_SYMBOL[shown.suit]}が名乗りを上げた!`,
      );
    }
  }

  let next = {
    ...state,
    board,
    pieces,
    players,
    log,
    winner,
    pendingKingChoice,
    // 名乗りを上げた駒。盤でめくる演出に使う。
    // 1手で複数取っても、王を討った1枚だけが入る
    ...(lastReveal ? { lastReveal } : {}),
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
        next = removePiece(
          {
            ...next,
            log,
            // 道連れが起きたこと。映像を出す側が盤を見比べずに済むよう、
            // 印だけ置く。次に起きるまで同じものが残るので、二重に流れない
            lastRevenge: {
              id: dead.id,
              owner: dead.owner,
              rank: dead.rank,
              suit: dead.suit,
            },
          },
          opts.by,
          { by: null, viaCounter: true },
        );
      }
    }
  }

  // 王がKのとき、自分のJかQが倒されると予備札を1枚引ける
  if (dead.rank === "J" || dead.rank === "Q") {
    const owner = next.players[dead.owner];
    const king = owner.kingId ? next.pieces[owner.kingId] : null;
    // まとめ取りで J と Q が同時に倒れると、2枚めくれることがある。
    // 置き場を1枚にしていた頃は、1枚目が上書きされて山にも手札にも
    // 戻らず黙って消えていた。列にして、どちらからでも置けるようにする
    if (king && king.rank === "K" && king.alive && next.reserve.length > 0) {
      const reserve = [...next.reserve];
      const card = reserve.pop();
      const held =
        next.kPlacement && next.kPlacement.owner === dead.owner
          ? next.kPlacement.cards
          : [];
      next = {
        ...next,
        reserve,
        kPlacement: { owner: dead.owner, cards: [...held, card] },
      };
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
  // 場面にも席にも合わない手は、盤に触れさせない
  if (!actorAllowed(state, action)) return state;
  // 乱数の結果を持たない手も受け取らない(盤が二人で食い違う)
  if (!seedsPresent(state, action)) return state;
  const next = settleKingChoice(coreReducer(state, action));
  return afterAction(state, next, action);
}

/**
 * 跡継ぎを選ぶ場面の後始末。
 *
 * 6〜9のまとめ取りやAの包囲では、王と跡継ぎの候補が同じ1手で全部倒れる
 * ことがある。そうなると候補がひとりも生きていないので選びようが無く、
 * その席は駒も動かせず手番も飛ばせない(選ぶまで他の手を出せない決まりの
 * ため)。決着もしないので、降参するまで盤が止まる。細工は要らない、
 * 素の対局で起きる
 */
function settleKingChoice(state) {
  const pk = state.pendingKingChoice;
  if (!pk) return state;
  const alive = pk.candidateIds.filter(
    (id) => state.pieces[id] && state.pieces[id].alive,
  );
  if (alive.length === pk.candidateIds.length) return state;
  if (alive.length > 1)
    return { ...state, pendingKingChoice: { ...pk, candidateIds: alive } };
  if (alive.length === 1) {
    // 残りが1枚なら選ぶまでもない
    const heir = { ...state.pieces[alive[0]], isKing: true };
    heir.history = [...heir.history, "王位を継承"];
    const pieces = { ...state.pieces, [heir.id]: heir };
    const board = state.board.map((r) => [...r]);
    board[heir.row][heir.col] = heir;
    const players = state.players.map((p, i) =>
      i === pk.owner ? { ...p, kingId: heir.id } : p,
    );
    return {
      ...state,
      pieces,
      board,
      players,
      pendingKingChoice: null,
      log: [...state.log, `${PLAYER_META[pk.owner].name}に新しい王が立った!`],
    };
  }
  // ひとりも残っていない。王を立てられない側の負け
  const winner = 1 - pk.owner;
  return {
    ...state,
    pendingKingChoice: null,
    phase: "gameover",
    winner,
    log: [
      ...state.log,
      `${PLAYER_META[pk.owner].name}は王を立てられない…${PLAYER_META[winner].name}の勝利!`,
    ],
  };
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
    // 考えた時間は送り主の言い値。数でないものが届くと時計が NaN になり、
    // そこから先の判定が全部おかしくなるので、必ず数に直す。
    //
    // なお、値そのものの正しさはここでは分からない。上限を持ち時間に
    // 揃えても、持ち時間ぶん申告されれば同じことなので意味がない。
    // 「考えた時間を受け取る側で測る」まで、ここは自己申告のまま
    const raw = Number(action.elapsedMs);
    // 名乗りがあるなら、番だった側の手でなければ時間は引かない。
    // これが無いと、相手が手番を横取りする手を送るだけで
    // **こちらの**持ち時間が削られ、0になった時点で負けになる
    const named = action.player === 0 || action.player === 1;
    const spent =
      Number.isFinite(raw) && (!named || action.player === prev.currentTurn)
        ? Math.max(0, raw)
        : 0;
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
      // 盤の大きさは 5 か 9 だけ。ここを言い値にすると、たとえば文字列の "5" で
      // 両者の自陣が重なる盤ができ、あとから布陣した側が相手の駒を上書きして
      // 「盤に無いのに生きている駒」を作れる。大きな数を送れば、相手の端末は
      // size×size のマスを確保しようとして落ちる
      const size = action.size === 9 ? 9 : action.size === 5 ? 5 : null;
      if (size === null) return state;
      if (action.deck !== undefined && !deckOk(action.deck)) return state;
      const deck = action.deck || shuffle(buildDeck(action.pool));
      // 小さいカードプールでは手札も減らす。予備札が尽きると引き直せなくなる
      const wanted = Number(action.handSize);
      const handSize =
        Number.isInteger(wanted) && wanted >= totalSlots(size) && wanted <= 26
          ? wanted
          : Math.max(
              totalSlots(size),
              Math.min(13, Math.floor(deck.length / 3)),
            );
      if (deck.length < handSize * 2) return state;
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
      // 振り直せるのは「目が同じだったとき」だけ。これが無いと、
      // 先手が決まったあとでも何度でも巻き戻せる(永久に始まらなくできる)
      if (
        state.dice[0] === null ||
        state.dice[1] === null ||
        state.dice[0] !== state.dice[1]
      )
        return state;
      return {
        ...state,
        dice: [null, null],
        diceIdx: 0,
        firstPlayer: 0,
        currentTurn: 0,
        interstitial: { forPlayer: 0, kind: "dice" },
      };

    case "GOTO_MULLIGAN":
      // 先手が決まってから進む。これが無いと、対局開始直後に1件送るだけで
      // サイコロを飛ばして先手を自分にできる
      if (state.diceIdx !== 2) return state;
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
      if (action.discardIds !== undefined && !Array.isArray(action.discardIds))
        return state;
      const discardIds = new Set(
        action.discardIds || me._mulliganSelected || [],
      );
      const kept = me.hand.filter((c) => !discardIds.has(c.id));
      const discarded = me.hand
        .filter((c) => discardIds.has(c.id))
        .map((c) => ({ ...c, owner: idx }));
      const count = discarded.length;
      // 予備札は両者で1つしかない。並べ替えでない列を渡されると、
      // 載らなかった札が黙って消える(空の列なら予備札が0枚になり、
      // 後から引き直す側が1枚も選べなくなる)
      const picked = Array.isArray(action.reserveOrder)
        ? action.reserveOrder
            .map((id) => state.reserve.find((c) => c.id === id))
            .filter(Boolean)
        : null;
      // いま残っている予備札を、ちょうど1回ずつ並べたものでなければ使わない。
      // (台本は最初の予備札ぜんぶの並びを渡してくるので、2人目のときは
      //  もう配られた札が混ざる。それは落として数を合わせる)
      const orderOk =
        picked &&
        picked.length === state.reserve.length &&
        new Set(picked.map((c) => c.id)).size === picked.length;
      if (!orderOk && fromNetwork(action)) return state;
      const pool = orderOk ? picked : shuffle(state.reserve);
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
      if (!kingId) return state;
      // 自陣か・重なっていないか・採用上限を守っているか・自分の手札か。
      // 1枚ずつ置くときと同じことを、確定の手にも課す
      if (!placementOk(state, idx, placement, kingId)) return state;
      const ids = Object.keys(placement);

      const players = [...state.players];
      const me = { ...players[idx] };
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
      if (loser !== 0 && loser !== 1) return state;
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
      if (!aId || !Array.isArray(picks) || picks.length !== 2) return state;

      const ids = [aId, ...picks];
      // 知らない駒idが混ざっていると、ここで落ちて画面が消える
      if (ids.some((id) => !state.pieces[id] || !state.pieces[id].alive))
        return state;
      // 手元では SELECT_PIECE が「Aで、自分の駒」を強いている。
      // 通信では確定の手だけが飛んでくるので、ここで同じことを課す。
      // これが無いと、Aを1枚も持たない相手が包囲取りを使えるし、
      // aId にこちらの王を指定して盤の反対側へ運べる
      {
        const ace = state.pieces[aId];
        const actor =
          action.player === 0 || action.player === 1
            ? action.player
            : state.currentTurn;
        if (ace.rank !== "A" || ace.owner !== actor) return state;
        if (state.extraMoveFor && state.extraMoveFor !== aId) return state;
      }
      // 同じ駒を並べると、3駒が同じマスに重なって「盤に無いのに生きている駒」ができる
      if (new Set(ids).size !== 3) return state;
      if (
        action.order &&
        (!Array.isArray(action.order) ||
          action.order.length !== 3 ||
          new Set(action.order).size !== 3 ||
          action.order.some((i) => i !== 0 && i !== 1 && i !== 2))
      )
        return state;
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
      // 手は通信でも届く。届いた手を信じない。
      // 番でない側の駒や、盤の外の座標をそのまま通すと、相手の盤で
      // 好きな駒を取れてしまうし、盤の外を読んで画面ごと落ちる
      if (mover.owner !== state.currentTurn) return state;
      // 王の10とAの「もう一度」の枠は、その駒のためのもの。
      // 手元では SELECT_PIECE が縛っているが、届いた手にも同じ縛りが要る
      if (state.extraMoveFor && state.extraMoveFor !== mover.id) return state;
      if (!onBoard(state.board, action.row, action.col)) return state;
      if (!movePermitted(state, mover, action)) return state;
      if (
        action.captures &&
        (!Array.isArray(action.captures) ||
          action.captures.some(
            (at) => !at || !onBoard(state.board, at.row, at.col),
          ))
      )
        return state;
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

      // 届いた並びではなく、こちらで引き直した並びを使う。
      // 照合を通っていても、並びそのものを盤の操作に使うと細工が効く
      const targets = capturesFor(state, mover, action);
      const defeated = [];

      for (const at of targets) {
        // 道連れで自分が倒れていたら、そこで止める。
        // 倒れた駒が取り続けると、決着したあとに撃破が積まれて記録が壊れる
        if (next.pieces[mover.id] && !next.pieces[mover.id].alive) break;
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
      const { owner, cards } = state.kPlacement;
      // どの札を置くか。指定が無ければ先頭の1枚
      const card = action.cardId
        ? cards.find((c) => c.id === action.cardId)
        : cards[0];
      if (!card) return state;
      // 盤の内側・自陣・空いているマス。どれも見ていないと、相手の駒の上に
      // 置いて、撃破もせずに盤から消せる(取るより強い手になる)
      if (!onBoard(state.board, action.row, action.col)) return state;
      {
        const [lo, hi] = territoryRows(state.boardSize, owner);
        if (action.row < lo || action.row > hi) return state;
        if (state.board[action.row][action.col]) return state;
      }
      const board = state.board.map((r) => [...r]);
      const pieces = { ...state.pieces };
      // 予備札から出る駒は表向き。どこからともなく1枚増えるので、
      // 伏せたままだと相手には「何が増えたのか」がまるで読めない。
      // Kの王の見返りは駒数そのものなので、正体は明かして出す
      const piece = {
        id: card.id,
        rank: card.rank,
        suit: card.suit,
        owner,
        isKing: false,
        row: action.row,
        col: action.col,
        alive: true,
        revealed: true,
        history: ["予備札から表向きに出撃"],
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
        // 残りがあれば置き場に残す
        kPlacement:
          cards.length > 1
            ? { owner, cards: cards.filter((c) => c.id !== card.id) }
            : null,
        // 盤でめくる演出に乗せる。表で出ることが目で分かるように
        lastReveal: { id: piece.id, reason: "予備札から出た" },
        log: [
          ...state.log,
          `${PLAYER_META[owner].name}が予備札から ${card.rank}${SUIT_SYMBOL[card.suit]} を投入(公開)`,
        ],
      };
    }

    case "SKIP_RESERVE_PLACEMENT":
      return { ...state, kPlacement: null };

    case "SKIP_EXTRA_ACTION":
      // 「王の2回目を使わずに終える」ためだけの手。これが無いと、
      // 1手も指さずに手番を押し返せる(将棋やチェスで言えば手番の放棄)。
      // ただし本当に指せる手がひとつも無いときは、渡せないと
      // 持ち時間が尽きるまで何もできなくなる
      if (!state.extraMoveFor && hasAnyMove(state, state.currentTurn))
        return state;
      return endTurn(state);

    case "VIEW_LOG":
      return { ...state, logViewerId: action.id };

    case "CLOSE_LOG":
      return { ...state, logViewerId: null };

    case "RESIGN": {
      const who = action.player;
      // 文字列の "0" などを通すと 1 - who や配列の添字が思わぬ形になる
      if (who !== 0 && who !== 1) return state;
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
