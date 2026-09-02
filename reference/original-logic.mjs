// JSXランタイム参照のスタブ（ロジック比較には不要）
const rt = () => ({}), Zl = () => ({});

// 自動抽出: ki, Eo, Fg, Wg の依存クロージャ (30 宣言)
  var c = rt(Zl(), 1),
    s0 = "v47 (CPU対戦を追加)",
    ht = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"],
    Ot = ["spade", "heart", "diamond", "club"],
    Fa = { spade: "♠", heart: "♥", diamond: "♦", club: "♣" };
  var Vl = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ],
    Gl = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ],
    Sg = [
      [1, 2],
      [2, 1],
      [-1, 2],
      [-2, 1],
      [1, -2],
      [2, -1],
      [-1, -2],
      [-2, -1],
    ],
    H = [
      { name: "赤", color: "#c1543a", soft: "#e2896f" },
      { name: "青", color: "#3e8e90", soft: "#7ec4c6" },
    ];
  function A0() {
    let e = [],
      t = 0;
    for (let l of Ot) for (let n of ht) e.push({ id: `c${t++}`, rank: n, suit: l });
    return e;
  }
  function yl(e) {
    let t = [...e];
    for (let l = t.length - 1; l > 0; l--) {
      let n = Math.floor(Math.random() * (l + 1));
      [t[l], t[n]] = [t[n], t[l]];
    }
    return t;
  }
  function Mo(e, t, l) {
    return e >= 0 && e < l && t >= 0 && t < l;
  }
  function Gn(e) {
    return e === 5 ? 5 : 9;
  }
  function hl(e, t) {
    let l = e === 5 ? 2 : 3;
    return t === 0 ? [e - l, e - 1] : [0, l - 1];
  }
  function Ei(e, t, l) {
    return (t.col - e.col) * (l.row - e.row) - (l.col - e.col) * (t.row - e.row);
  }
  function Rg(e, t, l, n) {
    if (Ei(t, l, n) === 0) return !1;
    let u = Ei(e, t, l),
      i = Ei(e, l, n),
      f = Ei(e, n, t),
      o = u < 0 || i < 0 || f < 0,
      r = u > 0 || i > 0 || f > 0;
    return !(o && r);
  }
  function Ui(e, t, l, n, a, u) {
    let i = [];
    for (let [f, o] of t) {
      let r = 0,
        d = e.row,
        m = e.col,
        s = [];
      for (; r++, (d += f), (m += o), !!Mo(d, m, n);) {
        let v = l[d][m],
          p = a === "even" ? r % 2 === 0 : r % 2 === 1;
        if (u) {
          p &&
            v &&
            v.owner !== e.owner &&
            (s.push({ row: d, col: m }), i.push({ row: d, col: m, capture: !0, captures: [...s] }));
          continue;
        }
        p &&
          (v
            ? v.owner !== e.owner && i.push({ row: d, col: m, capture: !0 })
            : i.push({ row: d, col: m, capture: !1 }));
      }
    }
    return i;
  }
  function yt(e, t, l, n, a, u, i) {
    let f = [];
    for (let [o, r] of t) {
      let d = 0,
        m = e.row,
        s = e.col;
      for (; d++, (m += o), (s += r), !!Mo(m, s, n);) {
        let v = l[m][s],
          p = d >= a && d <= u && (!i || (i === "even" ? d % 2 === 0 : d % 2 === 1));
        if (v) {
          v.owner !== e.owner && p && f.push({ row: m, col: s, capture: !0 });
          break;
        } else if ((p && f.push({ row: m, col: s, capture: !1 }), d >= u)) break;
      }
    }
    return f;
  }
  function u0(e, t, l) {
    let n = [];
    for (let [a, u] of Sg) {
      let i = e.row + a,
        f = e.col + u;
      if (!Mo(i, f, l)) continue;
      let o = t[i][f];
      o
        ? o.owner !== e.owner && n.push({ row: i, col: f, capture: !0 })
        : n.push({ row: i, col: f, capture: !1 });
    }
    return n;
  }
  function jo(e, t, l, n) {
    let a = e.isKing ? n[e.rank] || 1 : 0;
    switch (e.rank) {
      case "A":
        return [];
      case "2":
        return yt(e, Vl, t, l, 1, 1 + a, null);
      case "3":
        return yt(e, Gl, t, l, 1, 1 + a, null);
      case "4":
        return yt(e, Vl, t, l, 1, 2 + a, null);
      case "5":
        return yt(e, Gl, t, l, 1, 2 + a, null);
      case "6":
        return Ui(e, Vl, t, l, "even", e.isKing);
      case "7":
        return Ui(e, Gl, t, l, "even", e.isKing);
      case "8":
        return Ui(e, Vl, t, l, "odd", e.isKing);
      case "9":
        return Ui(e, Gl, t, l, "odd", e.isKing);
      case "10":
        return u0(e, t, l);
      case "J": {
        let u = yt(e, Vl, t, l, 1, l, null);
        return (e.isKing && (u = u.concat(yt(e, Gl, t, l, 1, 1, null))), u);
      }
      case "Q": {
        let u = yt(e, Gl, t, l, 1, l, null);
        return (e.isKing && (u = u.concat(yt(e, Vl, t, l, 1, 1, null))), u);
      }
      case "K":
        return yt(e, Vl, t, l, 1, l, null)
          .concat(yt(e, Gl, t, l, 1, l, null))
          .concat(u0(e, t, l));
      default:
        return [];
    }
  }
  function i0(e, t) {
    return e === "K" ? (t === "K" ? 1 : 0) : e === "J" || e === "Q" ? (t === "K" ? 1 : 2) : 4;
  }
  function Eg(e, t) {
    let l = {};
    return (
      Object.keys(e).forEach((n) => {
        let a = t.find((u) => u.id === n);
        a && (l[a.rank] = (l[a.rank] || 0) + 1);
      }),
      l
    );
  }
  function f0(e, t, l) {
    return `${String.fromCharCode(97 + t)}${l - e}`;
  }
  function Bi(e) {
    return { idx: e, hand: [], discard: [], capturedOwn: [], armyRankCounts: {}, kingId: null, ready: !1 };
  }
  function Eo() {
    return {
      phase: "intro",
      boardSize: 5,
      players: [Bi(0), Bi(1)],
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
      extraUsed: !1,
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
  function b0(e) {
    return Array.from({ length: e }, () => Array.from({ length: e }, () => null));
  }
  function ki(e, t) {
    switch (t.type) {
      case "START_SETUP": {
        let l = t.size,
          n = t.deck || yl(A0()),
          a = n.slice(0, 13),
          u = n.slice(13, 26),
          i = n.slice(26),
          f = [Bi(0), Bi(1)];
        return (
          (f[0].hand = a),
          (f[1].hand = u),
          {
            ...Eo(),
            boardSize: l,
            players: f,
            reserve: i,
            phase: "dice",
            interstitial: { forPlayer: 0, kind: "dice" },
          }
        );
      }
      case "ROLL_DICE_SINGLE": {
        if (e.dice[e.diceIdx] !== null) return e;
        let l = t.value || 1 + Math.floor(Math.random() * 6),
          n = [...e.dice];
        return ((n[e.diceIdx] = l), { ...e, dice: n });
      }
      case "NEXT_DICE_STEP": {
        if (e.diceIdx === 0 && e.dice[0] !== null)
          return { ...e, diceIdx: 1, interstitial: { forPlayer: 1, kind: "dice" } };
        if (e.dice[0] !== null && e.dice[1] !== null) {
          if (e.dice[0] === e.dice[1])
            return {
              ...e,
              diceIdx: 3,
              log: [
                ...e.log,
                `サイコロが同じ目(${e.dice[0]})だったので振り直します`,
              ],
            };
          let l = e.dice[0] > e.dice[1] ? 0 : 1;
          return {
            ...e,
            diceIdx: 2,
            firstPlayer: l,
            currentTurn: l,
            log: [
              ...e.log,
              `サイコロ: ${H[0].name}=${e.dice[0]} / ${H[1].name}=${e.dice[1]} → ${H[l].name}が先手`,
            ],
          };
        }
        return e;
      }
      case "REROLL_DICE":
        return { ...e, dice: [null, null], diceIdx: 0, interstitial: { forPlayer: 0, kind: "dice" } };
      case "GOTO_MULLIGAN":
        return {
          ...e,
          phase: "mulligan",
          mulliganIdx: e.firstPlayer,
          interstitial: { forPlayer: e.firstPlayer, kind: "mulligan" },
        };
      case "TOGGLE_MULLIGAN_CARD": {
        let l = e.mulliganIdx,
          n = e.players.map((a, u) => {
            if (u !== l) return a;
            let i = new Set(a._mulliganSelected || []);
            return (
              i.has(t.cardId) ? i.delete(t.cardId) : i.add(t.cardId),
              { ...a, _mulliganSelected: [...i] }
            );
          });
        return { ...e, players: n };
      }
      case "CONFIRM_MULLIGAN": {
        let l = e.mulliganIdx,
          n = [...e.players],
          a = { ...n[l] },
          u = new Set(t.discardIds || a._mulliganSelected || []),
          i = a.hand.filter((p) => !u.has(p.id)),
          f = a.hand.filter((p) => u.has(p.id)).map((p) => ({ ...p, owner: l })),
          o = f.length,
          r = t.reserveOrder
            ? t.reserveOrder.map((p) => e.reserve.find((w) => w.id === p)).filter(Boolean)
            : yl(e.reserve),
          d = r.slice(0, o),
          m = r.slice(o);
        ((a.hand = [...i, ...d]), (a.discard = [...a.discard, ...f]), delete a._mulliganSelected, (n[l] = a));
        let s = [...e.log, `${H[l].name}が${o}枚を引き直した`],
          v = l === e.firstPlayer ? 1 - e.firstPlayer : null;
        return l === e.firstPlayer
          ? {
              ...e,
              players: n,
              reserve: m,
              mulliganIdx: 1 - e.firstPlayer,
              log: s,
              interstitial: { forPlayer: 1 - e.firstPlayer, kind: "mulligan" },
            }
          : {
              ...e,
              players: n,
              reserve: m,
              phase: "setup",
              setupIdx: e.firstPlayer,
              setupStep: "place",
              setupPickKing: null,
              setupPlacement: {},
              log: s,
              interstitial: { forPlayer: e.firstPlayer, kind: "setup" },
            };
      }
      case "SETUP_PLACE_CARD": {
        let l = e.setupIdx,
          n = e.players[l],
          a = Gn(e.boardSize),
          u = n.hand.find((d) => d.id === t.cardId);
        if (!u) return e;
        let i = { ...e.setupPlacement };
        if (!!!i[t.cardId]) {
          if (Object.keys(i).length >= a) return e;
          let d = Eg(i, n.hand);
          if (u.rank === "K") {
            if ((d.K || 0) >= 1 || (d.J || 0) > 1 || (d.Q || 0) > 1) return e;
          } else {
            let m = (d.K || 0) > 0,
              s = i0(u.rank, m ? "K" : null);
            if ((d[u.rank] || 0) >= s) return e;
          }
        }
        let o = Object.keys(i).find((d) => i[d].row === t.row && i[d].col === t.col),
          r = i[t.cardId];
        if (o && o !== t.cardId)
          if (r) i[o] = r;
          else return e;
        return ((i[t.cardId] = { row: t.row, col: t.col }), { ...e, setupPlacement: i });
      }
      case "SETUP_UNPLACE_CARD": {
        let l = { ...e.setupPlacement };
        return (delete l[t.cardId], { ...e, setupPlacement: l });
      }
      case "SETUP_AUTO_ARRANGE": {
        let l = e.setupIdx,
          n = e.players[l],
          a = Gn(e.boardSize),
          [u, i] = hl(e.boardSize, l),
          f = [];
        for (let v = u; v <= i; v++) for (let p = 0; p < e.boardSize; p++) f.push({ row: v, col: p });
        let o = t.cellOrder ? t.cellOrder.map((v) => f[v]).filter(Boolean) : yl(f),
          r = t.handOrder
            ? t.handOrder.map((v) => n.hand.find((p) => p.id === v)).filter(Boolean)
            : yl(n.hand),
          d = [],
          m = {};
        for (let v of r) {
          if (d.length >= a) break;
          if (v.rank === "K") {
            if ((m.K || 0) >= 1 || (m.J || 0) > 1 || (m.Q || 0) > 1) continue;
          } else {
            let p = (m.K || 0) > 0,
              w = i0(v.rank, p ? "K" : null);
            if ((m[v.rank] || 0) >= w) continue;
          }
          (d.push(v), (m[v.rank] = (m[v.rank] || 0) + 1));
        }
        let s = {};
        return (
          d.forEach((v, p) => {
            s[v.id] = o[p];
          }),
          { ...e, setupPlacement: s }
        );
      }
      case "SETUP_GOTO_KING_STEP":
        return Object.keys(e.setupPlacement).length !== Gn(e.boardSize)
          ? e
          : { ...e, setupStep: "king", setupPickKing: null };
      case "SETUP_BACK_TO_PLACE":
        return { ...e, setupStep: "place", setupPickKing: null };
      case "SETUP_PICK_KING": {
        let l = e.players[e.setupIdx],
          n = e.setupPlacement,
          a = l.hand.find((i) => i.id === t.cardId);
        return !a ||
          !n[t.cardId] ||
          (Object.keys(n).some((i) => l.hand.find((f) => f.id === i).rank === "K") && a.rank !== "K")
          ? e
          : { ...e, setupPickKing: t.cardId };
      }
      case "SETUP_CONFIRM": {
        if (!(t.kingId || e.setupPickKing)) return e;
        let l = e.setupIdx,
          n = [...e.players],
          a = { ...n[l] },
          u = t.placement || e.setupPlacement,
          i = t.kingId || e.setupPickKing,
          f = Object.keys(u),
          o = {},
          r = e.board.length ? e.board.map((s) => [...s]) : b0(e.boardSize),
          d = { ...e.pieces };
        (f.forEach((s) => {
          let v = a.hand.find((z) => z.id === s);
          o[v.rank] = (o[v.rank] || 0) + 1;
          let p = u[s],
            w = {
              id: v.id,
              rank: v.rank,
              suit: v.suit,
              owner: l,
              isKing: s === i,
              row: p.row,
              col: p.col,
              alive: !0,
              history: [],
              everRevived: !1,
            };
          ((d[w.id] = w), (r[p.row][p.col] = w));
        }),
          (a.hand = a.hand.filter((s) => !f.includes(s.id))),
          (a.armyRankCounts = o),
          (a.kingId = i),
          (n[l] = a));
        let m = [...e.log, `${H[l].name}が布陣を完了`];
        if (l === e.firstPlayer) {
          let s = 1 - e.firstPlayer;
          return {
            ...e,
            players: n,
            board: r,
            pieces: d,
            setupIdx: s,
            setupStep: "place",
            setupPickKing: null,
            setupPlacement: {},
            log: m,
            interstitial: { forPlayer: s, kind: "setup" },
          };
        }
        return {
          ...e,
          players: n,
          board: r,
          pieces: d,
          phase: "play",
          currentTurn: e.firstPlayer,
          log: [...m, `--- 対局開始:${H[e.firstPlayer].name}の番 ---`],
          interstitial: { forPlayer: e.firstPlayer, kind: "turn" },
        };
      }
      case "DISMISS_INTERSTITIAL":
        return { ...e, interstitial: null };
      case "SELECT_PIECE": {
        if (e.winner) return e;
        let l = e.pieces[t.id];
        return !l || !l.alive || l.owner !== e.currentTurn || (e.extraMoveFor && l.id !== e.extraMoveFor)
          ? e
          : l.rank === "A"
            ? { ...e, selectedId: null, shuffleMode: { aId: l.id, picks: [] } }
            : { ...e, selectedId: t.id, shuffleMode: null };
      }
      case "CANCEL_SELECTION":
        return { ...e, selectedId: null, shuffleMode: null };
      case "TOGGLE_SHUFFLE_PICK": {
        if (!e.shuffleMode) return e;
        let l = e.pieces[t.id];
        if (!l || !l.alive || l.id === e.shuffleMode.aId) return e;
        let n = [...e.shuffleMode.picks];
        return (
          n.includes(t.id) ? (n = n.filter((a) => a !== t.id)) : n.length < 2 && (n = [...n, t.id]),
          { ...e, shuffleMode: { ...e.shuffleMode, picks: n } }
        );
      }
      case "CONFIRM_SHUFFLE": {
        let l = t.aId || (e.shuffleMode && e.shuffleMode.aId),
          n = t.pickIds || (e.shuffleMode && e.shuffleMode.picks) || [];
        if (!l || n.length !== 2) return e;
        let a = [l, ...n],
          u = a.map((s) => ({ row: e.pieces[s].row, col: e.pieces[s].col })),
          i = t.order ? t.order.map((s) => u[s]) : yl(u),
          f = e.board.map((s) => [...s]),
          o = { ...e.pieces };
        (a.forEach((s) => {
          f[o[s].row][o[s].col] = null;
        }),
          a.forEach((s, v) => {
            let p = i[v];
            ((o[s] = {
              ...o[s],
              row: p.row,
              col: p.col,
              history: [
                ...o[s].history,
                "周囲の駒と位置を入れ替えた",
              ],
            }),
              (f[p.row][p.col] = o[s]));
          }));
        let r = [
            ...e.log,
            `${H[e.currentTurn].name}が3つの駒の位置を入れ替えた`,
          ],
          d = {
            ...e,
            board: f,
            pieces: o,
            shuffleMode: null,
            log: r,
            lastMove: null,
            lastSwap: { cells: u, owner: e.currentTurn },
          };
        if (a.every((s) => o[s].owner === e.currentTurn)) {
          let [s, v, p] = a.map((g) => ({ row: o[g].row, col: o[g].col })),
            w = Object.values(o).filter(
              (g) => g.alive && g.owner !== e.currentTurn && Rg({ row: g.row, col: g.col }, s, v, p),
            ),
            z = [];
          for (let g of w) {
            let A = d.pieces[g.id];
            if (
              !(!A || !A.alive) &&
              (z.push({ rank: A.rank, suit: A.suit, owner: A.owner }),
              (d.log = [
                ...d.log,
                `${H[e.currentTurn].name}が包囲で${H[A.owner].name}の${A.rank}${Fa[A.suit]}を撃破!`,
              ]),
              (d = Uo(d, g.id, { by: null, viaCounter: !0 })),
              d.winner !== null && d.winner !== void 0)
            )
              return Di({ ...d, captureReveal: { defeated: z, capturedBy: e.currentTurn, surround: !0 } }, l);
          }
          z.length && (d.captureReveal = { defeated: z, capturedBy: e.currentTurn, surround: !0 });
        }
        return Di(d, l);
      }
      case "MOVE_PIECE": {
        if (e.winner) return e;
        let l = e.pieces[t.pieceId || e.selectedId];
        if (!l || !l.alive) return e;
        let n = e.board.map((d) => [...d]),
          a = { ...e, board: n, pieces: { ...e.pieces }, selectedId: null, lastReveal: null },
          u =
            t.captures && t.captures.length
              ? t.captures
              : n[t.row][t.col]
                ? [{ row: t.row, col: t.col }]
                : [],
          i = [];
        for (let d of u) {
          let m = a.board[d.row][d.col];
          if (
            !(!m || m.owner === l.owner) &&
            (i.push({ rank: m.rank, suit: m.suit, owner: m.owner }),
            (a.log = [
              ...a.log,
              `${H[e.currentTurn].name}が${H[m.owner].name}の${m.rank}${Fa[m.suit]}を撃破!`,
            ]),
            (a = Uo(a, m.id, { by: l.id, viaCounter: !1 })),
            a.winner !== null && a.winner !== void 0)
          )
            return Di({ ...a, captureReveal: { defeated: i, capturedBy: e.currentTurn } }, l.id);
        }
        i.length && (a.captureReveal = { defeated: i, capturedBy: e.currentTurn });
        let f = a.pieces[l.id],
          o = a.board.map((d) => [...d]),
          r = { ...a.pieces };
        if (f && f.alive) {
          o[l.row][l.col] = null;
          let d = {
            ...f,
            row: t.row,
            col: t.col,
            history: [
              ...f.history,
              `${f0(l.row, l.col, e.boardSize)} → ${f0(t.row, t.col, e.boardSize)} へ移動`,
            ],
          };
          ((r[l.id] = d), (o[t.row][t.col] = d));
        }
        return (
          (a = {
            ...a,
            board: o,
            pieces: r,
            lastSwap: null,
            lastMove: {
              from: { row: l.row, col: l.col },
              to: { row: t.row, col: t.col },
              owner: e.currentTurn,
              captured: i.length > 0,
            },
          }),
          Di(a, l.id)
        );
      }
      case "DISMISS_CAPTURE":
        return { ...e, captureReveal: null };
      case "ACK_KING_CHOICE":
        return e.pendingKingChoice
          ? { ...e, pendingKingChoice: { ...e.pendingKingChoice, acknowledged: !0 } }
          : e;
      case "CHOOSE_HEIR": {
        let l = e.pendingKingChoice;
        if (!l || !l.candidateIds.includes(t.id)) return e;
        let n = e.pieces[t.id];
        if (!n || !n.alive) return e;
        let a = { ...e.pieces },
          u = e.board.map((o) => [...o]),
          i = { ...n, isKing: !0, history: [...n.history, "王位を継承"] };
        ((a[n.id] = i), (u[n.row][n.col] = i));
        let f = e.players.map((o, r) => (r === l.owner ? { ...o, kingId: n.id } : o));
        return {
          ...e,
          pieces: a,
          board: u,
          players: f,
          pendingKingChoice: null,
          log: [...e.log, `${H[l.owner].name}に新しい王が立った!`],
        };
      }
      case "PLACE_RESERVE_CARD": {
        if (!e.kPlacement) return e;
        let { owner: l, card: n } = e.kPlacement,
          a = e.board.map((r) => [...r]),
          u = { ...e.pieces },
          i = {
            id: n.id,
            rank: n.rank,
            suit: n.suit,
            owner: l,
            isKing: !1,
            row: t.row,
            col: t.col,
            alive: !0,
            history: ["予備札から出撃"],
            everRevived: !1,
          };
        ((u[i.id] = i), (a[t.row][t.col] = i));
        let f = e.players.map((r, d) =>
            d === l
              ? {
                  ...r,
                  armyRankCounts: { ...r.armyRankCounts, [n.rank]: (r.armyRankCounts[n.rank] || 0) + 1 },
                }
              : r,
          ),
          o = [...e.log, `${H[l].name}が予備札から1枚を投入`];
        return { ...e, board: a, pieces: u, players: f, kPlacement: null, log: o };
      }
      case "SKIP_RESERVE_PLACEMENT":
        return { ...e, kPlacement: null };
      case "SKIP_EXTRA_ACTION":
        return p0(e);
      case "VIEW_LOG":
        return { ...e, logViewerId: t.id };
      case "CLOSE_LOG":
        return { ...e, logViewerId: null };
      case "RESIGN": {
        let l = t.player;
        return l == null
          ? e
          : {
              ...e,
              phase: "gameover",
              winner: 1 - l,
              resignedBy: l,
              selectedId: null,
              shuffleMode: null,
              extraMoveFor: null,
              log: [
                ...e.log,
                `${H[l].name}が降参した…${H[1 - l].name}の勝利!`,
              ],
            };
      }
      case "NEW_GAME":
        return Eo();
      default:
        return e;
    }
  }
  function Uo(e, t, l) {
    let n = e.pieces[t];
    if (!n || !n.alive) return e;
    let a = e.board.map((s) => [...s]),
      u = { ...e.pieces },
      i = e.players.map((s) => ({ ...s, capturedOwn: [...s.capturedOwn] })),
      f = [...e.log],
      o = e.winner;
    a[n.row][n.col] = null;
    let r = { ...n, alive: !1 };
    ((u[t] = r), i[n.owner].capturedOwn.push(r));
    let d = e.pendingKingChoice || null;
    if ((n.rank === "2" || n.rank === "3") && n.isKing) {
      let s = Object.values(u).filter(
        (v) => v.alive && v.owner === n.owner && v.rank === n.rank && v.id !== t,
      );
      if (s.length === 1) {
        let v = { ...s[0], isKing: !0, history: [...s[0].history, "王位を継承"] };
        ((u[v.id] = v),
          (a[v.row][v.col] = v),
          (i[n.owner].kingId = v.id),
          f.push(`${H[n.owner].name}に新しい王が立った!`));
      } else
        s.length > 1 &&
          ((i[n.owner].kingId = null),
          (d = { owner: n.owner, rank: n.rank, candidateIds: s.map((v) => v.id), acknowledged: !1 }),
          f.push(`${H[n.owner].name}は新しい王を選びます`));
    }
    n.isKing &&
      i[n.owner].kingId === t &&
      !d &&
      ((o = 1 - n.owner),
      f.push(
        `${H[n.owner].name}の王が倒された…${H[o].name}の勝利!`,
      ));
    let m = { ...e, board: a, pieces: u, players: i, log: f, winner: o, pendingKingChoice: d };
    if ((n.rank === "4" || n.rank === "5") && !n.isKing && !l.viaCounter && l.by) {
      let s = m.players[n.owner].kingId,
        v = s ? m.pieces[s] : null;
      if (v && v.rank === n.rank) {
        let p = m.pieces[l.by];
        p &&
          p.alive &&
          (f.push(
            `${H[n.owner].name}の${n.rank}${Fa[n.suit]}が道連れにした!`,
          ),
          (m = Uo({ ...m, log: f }, l.by, { by: null, viaCounter: !0 })));
      }
    }
    if (n.rank === "J" || n.rank === "Q") {
      let s = m.players[n.owner],
        v = s.kingId ? m.pieces[s.kingId] : null;
      if (v && v.rank === "K" && v.alive && m.reserve.length > 0) {
        let p = [...m.reserve],
          w = p.pop();
        ((m = { ...m, reserve: p, kPlacement: { owner: n.owner, card: w } }),
          (m.log = [
            ...m.log,
            `${H[n.owner].name}は予備札を1枚引いた(配置できます)`,
          ]));
      }
    }
    return m;
  }
  function Di(e, t) {
    if (e.winner !== null && e.winner !== void 0) return { ...e, phase: "gameover" };
    let l = t ? e.pieces[t] : null,
      n = l && l.alive && l.isKing && l.rank === "10",
      a = l && l.alive && l.isKing && l.rank === "A";
    return (n || a) && !e.extraUsed
      ? { ...e, extraMoveFor: l.id, extraUsed: !0, selectedId: null, shuffleMode: null }
      : p0(e);
  }
  function p0(e) {
    let t = 1 - e.currentTurn;
    return {
      ...e,
      currentTurn: t,
      selectedId: null,
      shuffleMode: null,
      extraMoveFor: null,
      extraUsed: !1,
      interstitial: { forPlayer: t, kind: "turn" },
    };
  }
  var ko = { A: 5, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 4, 9: 4, 10: 5, J: 6, Q: 6, K: 7 };
  function Lg(e) {
    let t = e.players[e.setupIdx],
      l = Object.keys(e.setupPlacement)
        .map((u) => t.hand.find((i) => i.id === u))
        .filter(Boolean);
    if (l.some((u) => u.rank === "K")) return l.find((u) => u.rank === "K").id;
    let a = (u) =>
      u.rank === "A"
        ? 0
        : (ko[u.rank] || 1) +
          (["2", "3"].includes(u.rank) ? l.filter((i) => i.rank === u.rank).length * 2 : 0);
    return l.slice().sort((u, i) => a(i) - a(u))[0].id;
  }
  function Jg(e) {
    let t = e.players[e.mulliganIdx],
      l = Gn(e.boardSize),
      n = {},
      a = [],
      u = [],
      i = t.hand.slice().sort((f, o) => (ko[o.rank] || 0) - (ko[f.rank] || 0));
    for (let f of i) {
      let o = f.rank === "K" ? 1 : f.rank === "J" || f.rank === "Q" ? 2 : 4,
        r = n[f.rank] || 0;
      a.length < l + 2 && r < o ? (a.push(f), (n[f.rank] = r + 1)) : u.push(f);
    }
    return u.slice(0, 4).map((f) => f.id);
  }
  function Kg(e, t) {
    let l = e.boardSize,
      n = Object.values(e.pieces).filter((d) => d.alive && d.owner === t),
      a = e.players[t].kingId ? e.pieces[e.players[t].kingId] : null,
      u = 1 - t,
      [i, f] = hl(l, u),
      o = t === 0 ? i : f,
      r = [];
    for (let d of n) {
      if (d.rank === "A" || (e.extraMoveFor && d.id !== e.extraMoveFor)) continue;
      let m = jo(d, e.board, l, e.players[t].armyRankCounts);
      for (let s of m) {
        let v = Math.random() * 0.8,
          p = e.board[s.row][s.col];
        p && p.owner !== t && ((v += 12), s.captures && (v += (s.captures.length - 1) * 10));
        let w = Math.abs(d.row - o),
          z = Math.abs(s.row - o);
        (z < w && (v += 1.2),
          d.isKing && ((v -= 2), z < w && (v -= 1.5)),
          r.push({ score: v, pieceId: d.id, row: s.row, col: s.col, captures: s.captures }));
      }
    }
    return r.length ? (r.sort((d, m) => m.score - d.score), r[0]) : null;
  }
  function Ig(e, t) {
    let l = Object.values(e.pieces).find(
      (i) => i.alive && i.owner === t && i.rank === "A" && (!e.extraMoveFor || e.extraMoveFor === i.id),
    );
    if (!l) return null;
    let n = Object.values(e.pieces).filter((i) => i.alive && i.owner === t && i.id !== l.id);
    if (n.length < 2) return null;
    let a = Object.values(e.pieces).filter((i) => i.alive && i.owner !== t);
    if (!a.length) return null;
    let u = [];
    for (let i = 0; i < n.length; i++)
      for (let f = i + 1; f < n.length; f++) {
        let o = n[i],
          r = n[f],
          d = a.filter(
            (m) =>
              Math.abs(m.row - o.row) + Math.abs(m.col - o.col) <= 3 &&
              Math.abs(m.row - r.row) + Math.abs(m.col - r.col) <= 3,
          ).length;
        u.push({ score: d + Math.random() * 0.5, ids: [o.id, r.id] });
      }
    return (
      u.sort((i, f) => f.score - i.score),
      { aceId: l.id, pickIds: u[0].ids, promising: u[0].score >= 1 }
    );
  }
  function Fg(e, t) {
    if (e.phase === "gameover" || e.captureReveal) return null;
    if (e.pendingKingChoice) {
      let l = e.pendingKingChoice;
      return l.owner !== t
        ? null
        : l.acknowledged
          ? { type: "CHOOSE_HEIR", id: l.candidateIds[0] }
          : { type: "ACK_KING_CHOICE" };
    }
    if (e.phase === "dice")
      return e.diceIdx !== t
        ? null
        : e.dice[t] === null
          ? { type: "ROLL_DICE_SINGLE" }
          : { type: "NEXT_DICE_STEP" };
    if (e.phase === "mulligan")
      return e.mulliganIdx !== t ? null : { type: "CONFIRM_MULLIGAN", discardIds: Jg(e) };
    if (e.phase === "setup")
      return e.setupIdx !== t
        ? null
        : e.setupStep === "place"
          ? Object.keys(e.setupPlacement).length < Gn(e.boardSize)
            ? { type: "SETUP_AUTO_ARRANGE" }
            : { type: "SETUP_GOTO_KING_STEP" }
          : e.setupPickKing
            ? { type: "SETUP_CONFIRM" }
            : { type: "SETUP_PICK_KING", cardId: Lg(e) };
    if (e.phase === "play") {
      if (e.currentTurn !== t) return null;
      if (e.kPlacement) {
        if (e.kPlacement.owner !== t) return null;
        let [a, u] = hl(e.boardSize, t);
        for (let i = a; i <= u; i++)
          for (let f = 0; f < e.boardSize; f++)
            if (!e.board[i][f]) return { type: "PLACE_RESERVE_CARD", row: i, col: f };
        return { type: "SKIP_RESERVE_PLACEMENT" };
      }
      let l = Kg(e, t),
        n = Ig(e, t);
      return n && n.promising && (!l || l.score < 12)
        ? { type: "__CPU_SHUFFLE", ...n }
        : l
          ? { type: "MOVE_PIECE", pieceId: l.pieceId, row: l.row, col: l.col, captures: l.captures }
          : n
            ? { type: "__CPU_SHUFFLE", ...n }
            : { type: "SKIP_EXTRA_ACTION" };
    }
    return null;
  }
  function Wg(e, t) {
    switch (e.type) {
      case "START_SETUP":
        return { ...e, deck: yl(A0()).map((l) => ({ ...l })) };
      case "ROLL_DICE_SINGLE":
        return { ...e, value: 1 + Math.floor(Math.random() * 6) };
      case "CONFIRM_MULLIGAN":
        return { ...e, reserveOrder: yl(t.reserve).map((l) => l.id) };
      case "CONFIRM_SHUFFLE":
        return { ...e, order: yl([0, 1, 2]) };
      default:
        return e;
    }
  }

export { A0, Bi, Di, Eg, Ei, Eo, Fa, Fg, Gl, Gn, H, Ig, Jg, Kg, Lg, Mo, Ot, Rg, Sg, Ui, Uo, Vl, Wg, b0, c, f0, hl, ht, i0, jo, ki, ko, p0, s0, u0, yl, yt };
