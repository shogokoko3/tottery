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
    setupIdx: 0,
    setupStep: "place",
    setupPickKing: null,
    setupPlacement: {},
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
   reducer
   ========================================================================= */

export function reducer(state, action) {
  switch (action.type) {
    case "START_SETUP": {
      const size = action.size;
      const deck = action.deck || shuffle(buildDeck());
      const hand0 = deck.slice(0, 13);
      const hand1 = deck.slice(13, 26);
      const reserve = deck.slice(26);
      const players = [makePlayer(0), makePlayer(1)];
      players[0].hand = hand0;
      players[1].hand = hand1;
      return {
        ...initialState(),
        boardSize: size,
        players,
        reserve,
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
        else picked.add(action.cardId);
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
        setupStep: "place",
        setupPickKing: null,
        setupPlacement: {},
        log,
        interstitial: { forPlayer: state.firstPlayer, kind: "setup" },
      };
    }

    case "SETUP_PLACE_CARD": {
      const idx = state.setupIdx;
      const me = state.players[idx];
      const slots = totalSlots(state.boardSize);
      const card = me.hand.find((c) => c.id === action.cardId);
      if (!card) return state;

      const placement = { ...state.setupPlacement };
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
      return { ...state, setupPlacement: placement };
    }

    case "SETUP_UNPLACE_CARD": {
      const placement = { ...state.setupPlacement };
      delete placement[action.cardId];
      return { ...state, setupPlacement: placement };
    }

    case "SETUP_AUTO_ARRANGE": {
      const idx = state.setupIdx;
      const me = state.players[idx];
      const slots = totalSlots(state.boardSize);
      const [lo, hi] = territoryRows(state.boardSize, idx);

      const cells = [];
      for (let r = lo; r <= hi; r++)
        for (let c = 0; c < state.boardSize; c++)
          cells.push({ row: r, col: c });

      const cellOrder = action.cellOrder
        ? action.cellOrder.map((i) => cells[i]).filter(Boolean)
        : shuffle(cells);
      const handOrder = action.handOrder
        ? action.handOrder
            .map((id) => me.hand.find((c) => c.id === id))
            .filter(Boolean)
        : shuffle(me.hand);

      const chosen = [];
      const counts = {};
      for (const card of handOrder) {
        if (chosen.length >= slots) break;
        if (card.rank === "K") {
          if (
            (counts.K || 0) >= 1 ||
            (counts.J || 0) > 1 ||
            (counts.Q || 0) > 1
          )
            continue;
        } else {
          const hasK = (counts.K || 0) > 0;
          const limit = maxAdopt(card.rank, hasK ? "K" : null);
          if ((counts[card.rank] || 0) >= limit) continue;
        }
        chosen.push(card);
        counts[card.rank] = (counts[card.rank] || 0) + 1;
      }

      const placement = {};
      chosen.forEach((card, i) => {
        placement[card.id] = cellOrder[i];
      });
      return { ...state, setupPlacement: placement };
    }

    case "SETUP_GOTO_KING_STEP":
      if (
        Object.keys(state.setupPlacement).length !== totalSlots(state.boardSize)
      )
        return state;
      return { ...state, setupStep: "king", setupPickKing: null };

    case "SETUP_BACK_TO_PLACE":
      return { ...state, setupStep: "place", setupPickKing: null };

    case "SETUP_PICK_KING": {
      const me = state.players[state.setupIdx];
      const placement = state.setupPlacement;
      const card = me.hand.find((c) => c.id === action.cardId);
      if (!card || !placement[action.cardId]) return state;
      // Kを布陣に入れているなら、王はそのKでなければならない
      const hasK = Object.keys(placement).some(
        (id) => me.hand.find((c) => c.id === id).rank === "K",
      );
      if (hasK && card.rank !== "K") return state;
      return { ...state, setupPickKing: action.cardId };
    }

    case "SETUP_CONFIRM": {
      if (!(action.kingId || state.setupPickKing)) return state;
      const idx = state.setupIdx;
      const players = [...state.players];
      const me = { ...players[idx] };
      const placement = action.placement || state.setupPlacement;
      const kingId = action.kingId || state.setupPickKing;
      const ids = Object.keys(placement);

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
      players[idx] = me;

      const log = [...state.log, `${PLAYER_META[idx].name}が布陣を完了`];

      if (idx === state.firstPlayer) {
        const next = 1 - state.firstPlayer;
        return {
          ...state,
          players,
          board,
          pieces,
          setupIdx: next,
          setupStep: "place",
          setupPickKing: null,
          setupPlacement: {},
          log,
          interstitial: { forPlayer: next, kind: "setup" },
        };
      }
      return {
        ...state,
        players,
        board,
        pieces,
        phase: "play",
        currentTurn: state.firstPlayer,
        log: [
          ...log,
          `--- 対局開始:${PLAYER_META[state.firstPlayer].name}の番 ---`,
        ],
        interstitial: { forPlayer: state.firstPlayer, kind: "turn" },
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
      ids.forEach((id, i) => {
        const at = shuffled[i];
        pieces[id] = {
          ...pieces[id],
          row: at.row,
          col: at.col,
          history: [...pieces[id].history, "周囲の駒と位置を入れ替えた"],
        };
        board[at.row][at.col] = pieces[id];
      });

      const log = [
        ...state.log,
        `${PLAYER_META[state.currentTurn].name}が3つの駒の位置を入れ替えた`,
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
        const [a, b, c] = ids.map((id) => ({
          row: pieces[id].row,
          col: pieces[id].col,
        }));
        const trapped = Object.values(pieces).filter(
          (p) =>
            p.alive &&
            p.owner !== state.currentTurn &&
            pointInTriangle({ row: p.row, col: p.col }, a, b, c),
        );
        const defeated = [];
        for (const victim of trapped) {
          const piece = next.pieces[victim.id];
          if (!piece || !piece.alive) continue;
          defeated.push({
            rank: piece.rank,
            suit: piece.suit,
            owner: piece.owner,
          });
          next.log = [
            ...next.log,
            `${PLAYER_META[state.currentTurn].name}が包囲で${PLAYER_META[piece.owner].name}の${piece.rank}${SUIT_SYMBOL[piece.suit]}を撃破!`,
          ];
          next = removePiece(next, victim.id, { by: null, viaCounter: true });
          if (next.winner !== null && next.winner !== undefined) {
            return endAction(
              {
                ...next,
                captureReveal: {
                  defeated,
                  capturedBy: state.currentTurn,
                  surround: true,
                },
              },
              aId,
            );
          }
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
        });
        next.log = [
          ...next.log,
          `${PLAYER_META[state.currentTurn].name}が${PLAYER_META[victim.owner].name}の${victim.rank}${SUIT_SYMBOL[victim.suit]}を撃破!`,
        ];
        next = removePiece(next, victim.id, {
          by: mover.id,
          viaCounter: false,
        });
        if (next.winner !== null && next.winner !== undefined) {
          return endAction(
            {
              ...next,
              captureReveal: { defeated, capturedBy: state.currentTurn },
            },
            mover.id,
          );
        }
      }
      if (defeated.length)
        next.captureReveal = { defeated, capturedBy: state.currentTurn };

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
            `${squareName(mover.row, mover.col, state.boardSize)} → ${squareName(action.row, action.col, state.boardSize)} へ移動`,
          ],
        };
        nextPieces[mover.id] = updated;
        nextBoard[action.row][action.col] = updated;
      }

      next = {
        ...next,
        board: nextBoard,
        pieces: nextPieces,
        lastSwap: null,
        lastMove: {
          from: { row: mover.row, col: mover.col },
          to: { row: action.row, col: action.col },
          owner: state.currentTurn,
          captured: defeated.length > 0,
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
