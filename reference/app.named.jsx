(() => {
  var c = rt(Zl(), 1),
    VERSION = "v47 (CPU対戦を追加)",
    RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"],
    SUITS = ["spade", "heart", "diamond", "club"],
    SUIT_SYMBOL = {
      spade: "♠",
      heart: "♥",
      diamond: "♦",
      club: "♣",
    };
  var ORTH = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ],
    DIAG = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ],
    KNIGHT_OFFSETS = [
      [1, 2],
      [2, 1],
      [-1, 2],
      [-2, 1],
      [1, -2],
      [2, -1],
      [-1, -2],
      [-2, -1],
    ],
    PLAYER_META = [
      {
        name: "赤",
        color: "#c1543a",
        soft: "#e2896f",
      },
      {
        name: "青",
        color: "#3e8e90",
        soft: "#7ec4c6",
      },
    ];
  function playerLabel(e, t) {
    return t == null
      ? `${PLAYER_META[e].name}`
      : e === t
        ? `あなた(${PLAYER_META[e].name})`
        : `相手(${PLAYER_META[e].name})`;
  }
  function shortPlayerLabel(e, t) {
    return t == null ? PLAYER_META[e].name : e === t ? "あなた" : "相手";
  }
  var MOVE_TEXT = {
      A: "手番を使って、自分と好きな駒2つ(敵味方どちらでも)の位置をランダムに入れ替える。選んだ2つがどちらも味方なら、入れ替え後の3点が作る三角形の内側にいる相手の駒を取る。",
      2: "縦横1マス。",
      3: "斜め1マス。",
      4: "縦横に2マスまで。",
      5: "斜めに2マスまで。",
      6: "縦横に偶数マス。途中の駒は敵味方を問わず飛び越えられる。",
      7: "斜めに偶数マス。途中の駒は敵味方を問わず飛び越えられる。",
      8: "縦横に奇数マス。途中の駒は敵味方を問わず飛び越えられる。",
      9: "斜めに奇数マス。途中の駒は敵味方を問わず飛び越えられる。",
      10: "桂馬。",
      J: "縦横に何マスでも。2枚まで採用可(王がKなら1枚)。",
      Q: "斜めに何マスでも。2枚まで採用可(王がKなら1枚)。",
      K: "縦横斜めに何マスでも+桂馬。王にする時のみ1枚採用できる。",
    },
    KING_TEXT = {
      A: "この駒だけ1ターンに2回入れ替えを使える(1回で終えてもよい)。移動はできない。",
      2: "移動距離が「軍内の2の枚数」分伸びる。王の2が倒されると軍内の2が王位を継ぐ(複数なら選択)。",
      3: "移動距離が「軍内の3の枚数」分伸びる。王の3が倒されると軍内の3が王位を継ぐ(複数なら選択)。",
      4: "移動距離が「軍内の4の枚数」分伸びる。王以外の4が倒されると、倒した相手を道連れにする。",
      5: "移動距離が「軍内の5の枚数」分伸びる。王以外の5が倒されると、倒した相手を道連れにする。",
      6: "同じ線上に並ぶ相手を、着地できるマスの分だけまとめて取れる。",
      7: "同じ線上に並ぶ相手を、着地できるマスの分だけまとめて取れる。",
      8: "同じ線上に並ぶ相手を、着地できるマスの分だけまとめて取れる。",
      9: "同じ線上に並ぶ相手を、着地できるマスの分だけまとめて取れる。",
      10: "この駒だけ1ターンに2回動ける(1回で終えてもよい)。",
      J: "斜め1マスも動ける。",
      Q: "縦横1マスも動ける。",
      K: "自分のJかQが倒されると、予備札から1枚を盤上に出せる。",
    };
  function buildDeck() {
    let e = [],
      t = 0;
    for (let l of SUITS)
      for (let n of RANKS)
        e.push({
          id: `c${t++}`,
          rank: n,
          suit: l,
        });
    return e;
  }
  function shuffle(e) {
    let t = [...e];
    for (let l = t.length - 1; l > 0; l--) {
      let n = Math.floor(Math.random() * (l + 1));
      [t[l], t[n]] = [t[n], t[l]];
    }
    return t;
  }
  function inBounds(e, t, l) {
    return e >= 0 && e < l && t >= 0 && t < l;
  }
  function totalSlots(e) {
    return e === 5 ? 5 : 9;
  }
  function territoryRows(e, t) {
    let l = e === 5 ? 2 : 3;
    return t === 0 ? [e - l, e - 1] : [0, l - 1];
  }
  function cross(e, t, l) {
    return (t.col - e.col) * (l.row - e.row) - (l.col - e.col) * (t.row - e.row);
  }
  function pointInTriangle(e, t, l, n) {
    if (cross(t, l, n) === 0) return !1;
    let u = cross(e, t, l),
      i = cross(e, l, n),
      f = cross(e, n, t),
      o = u < 0 || i < 0 || f < 0,
      r = u > 0 || i > 0 || f > 0;
    return !(o && r);
  }
  var DB_URL = "https://tottery-66e0f-default-rtdb.asia-southeast1.firebasedatabase.app";
  function generateRoomCode() {
    let e = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
      t = "";
    for (let l = 0; l < 4; l++) t += e[Math.floor(Math.random() * e.length)];
    return t;
  }
  function roomUrl(e) {
    return `${DB_URL}/rooms/${e}.json`;
  }
  function netErrorText(e) {
    return e && e.__timeout
      ? "通信が8秒以内に応答しませんでした(タイムアウト)。通信状況を確認し、もう一度お試しください。"
      : `通信に失敗しました: ${(e && (e.message || e.toString())) || "不明なエラー"}`;
  }
  function withTimeout(e, t) {
    return Promise.race([
      e,
      new Promise((l, n) =>
        setTimeout(() => {
          let a = new Error("timeout");
          ((a.__timeout = !0), n(a));
        }, t),
      ),
    ]);
  }
  async function readRoom(e) {
    try {
      let t = await withTimeout(fetch(roomUrl(e)), 8e3);
      if (!t.ok) throw new Error(`HTTP ${t.status}`);
      return {
        ok: !0,
        data: await t.json(),
        error: null,
      };
    } catch (t) {
      return {
        ok: !1,
        data: null,
        error: netErrorText(t),
      };
    }
  }
  async function writeRoom(e, t) {
    try {
      let l = await withTimeout(
        fetch(roomUrl(e), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(t),
        }),
        8e3,
      );
      if (!l.ok) throw new Error(`HTTP ${l.status}`);
      return {
        ok: !0,
        error: null,
      };
    } catch (l) {
      return {
        ok: !1,
        error: netErrorText(l),
      };
    }
  }
  async function deleteRoom(e) {
    try {
      await withTimeout(
        fetch(roomUrl(e), {
          method: "DELETE",
        }),
        8e3,
      );
    } catch {}
  }
  function actsUrl(e) {
    return `${DB_URL}/rooms/${e}/acts.json`;
  }
  async function pushAct(e, t) {
    try {
      let l = await withTimeout(
        fetch(actsUrl(e), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(t),
        }),
        8e3,
      );
      if (!l.ok) throw new Error(`HTTP ${l.status}`);
      return {
        ok: !0,
        error: null,
      };
    } catch (l) {
      return {
        ok: !1,
        error: netErrorText(l),
      };
    }
  }
  async function readActs(e) {
    try {
      let t = await withTimeout(fetch(actsUrl(e)), 8e3);
      if (!t.ok) throw new Error(`HTTP ${t.status}`);
      let l = await t.json();
      return l
        ? {
            ok: !0,
            list: Object.keys(l)
              .sort()
              .map((a) => l[a]),
            error: null,
          }
        : {
            ok: !0,
            list: [],
            error: null,
          };
    } catch (t) {
      return {
        ok: !1,
        list: [],
        error: netErrorText(t),
      };
    }
  }
  var LOBBY_TTL = 180 * 1e3;
  function lobbyUrl(e = "") {
    return `${DB_URL}/lobby${e}.json`;
  }
  function makeClientId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  async function readLobby() {
    try {
      let e = await withTimeout(fetch(lobbyUrl()), 8e3);
      if (!e.ok) throw new Error(`HTTP ${e.status}`);
      return {
        ok: !0,
        data: await e.json(),
        error: null,
      };
    } catch (e) {
      return {
        ok: !1,
        data: null,
        error: netErrorText(e),
      };
    }
  }
  async function writeLobby(e, t) {
    try {
      let l = await withTimeout(
        fetch(lobbyUrl(e), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(t),
        }),
        8e3,
      );
      if (!l.ok) throw new Error(`HTTP ${l.status}`);
      return {
        ok: !0,
        error: null,
      };
    } catch (l) {
      return {
        ok: !1,
        error: netErrorText(l),
      };
    }
  }
  async function readLobbyPath(e) {
    try {
      let t = await withTimeout(fetch(lobbyUrl(e)), 8e3);
      if (!t.ok) throw new Error(`HTTP ${t.status}`);
      return {
        ok: !0,
        data: await t.json(),
        error: null,
      };
    } catch (t) {
      return {
        ok: !1,
        data: null,
        error: netErrorText(t),
      };
    }
  }
  async function deleteLobbyPath(e) {
    try {
      await withTimeout(
        fetch(lobbyUrl(e), {
          method: "DELETE",
        }),
        8e3,
      );
    } catch {}
  }
  function jumpMoves(e, t, l, n, a, u) {
    let i = [];
    for (let [f, o] of t) {
      let r = 0,
        d = e.row,
        m = e.col,
        s = [];
      for (; r++, (d += f), (m += o), !!inBounds(d, m, n);) {
        let v = l[d][m],
          p = a === "even" ? r % 2 === 0 : r % 2 === 1;
        if (u) {
          p &&
            v &&
            v.owner !== e.owner &&
            (s.push({
              row: d,
              col: m,
            }),
            i.push({
              row: d,
              col: m,
              capture: !0,
              captures: [...s],
            }));
          continue;
        }
        p &&
          (v
            ? v.owner !== e.owner &&
              i.push({
                row: d,
                col: m,
                capture: !0,
              })
            : i.push({
                row: d,
                col: m,
                capture: !1,
              }));
      }
    }
    return i;
  }
  function slideMoves(e, t, l, n, a, u, i) {
    let f = [];
    for (let [o, r] of t) {
      let d = 0,
        m = e.row,
        s = e.col;
      for (; d++, (m += o), (s += r), !!inBounds(m, s, n);) {
        let v = l[m][s],
          p = d >= a && d <= u && (!i || (i === "even" ? d % 2 === 0 : d % 2 === 1));
        if (v) {
          v.owner !== e.owner &&
            p &&
            f.push({
              row: m,
              col: s,
              capture: !0,
            });
          break;
        } else if (
          (p &&
            f.push({
              row: m,
              col: s,
              capture: !1,
            }),
          d >= u)
        )
          break;
      }
    }
    return f;
  }
  function knightMoves(e, t, l) {
    let n = [];
    for (let [a, u] of KNIGHT_OFFSETS) {
      let i = e.row + a,
        f = e.col + u;
      if (!inBounds(i, f, l)) continue;
      let o = t[i][f];
      o
        ? o.owner !== e.owner &&
          n.push({
            row: i,
            col: f,
            capture: !0,
          })
        : n.push({
            row: i,
            col: f,
            capture: !1,
          });
    }
    return n;
  }
  function getLegalMoves(e, t, l, n) {
    let a = e.isKing ? n[e.rank] || 1 : 0;
    switch (e.rank) {
      case "A":
        return [];
      case "2":
        return slideMoves(e, ORTH, t, l, 1, 1 + a, null);
      case "3":
        return slideMoves(e, DIAG, t, l, 1, 1 + a, null);
      case "4":
        return slideMoves(e, ORTH, t, l, 1, 2 + a, null);
      case "5":
        return slideMoves(e, DIAG, t, l, 1, 2 + a, null);
      case "6":
        return jumpMoves(e, ORTH, t, l, "even", e.isKing);
      case "7":
        return jumpMoves(e, DIAG, t, l, "even", e.isKing);
      case "8":
        return jumpMoves(e, ORTH, t, l, "odd", e.isKing);
      case "9":
        return jumpMoves(e, DIAG, t, l, "odd", e.isKing);
      case "10":
        return knightMoves(e, t, l);
      case "J": {
        let u = slideMoves(e, ORTH, t, l, 1, l, null);
        return (e.isKing && (u = u.concat(slideMoves(e, DIAG, t, l, 1, 1, null))), u);
      }
      case "Q": {
        let u = slideMoves(e, DIAG, t, l, 1, l, null);
        return (e.isKing && (u = u.concat(slideMoves(e, ORTH, t, l, 1, 1, null))), u);
      }
      case "K":
        return slideMoves(e, ORTH, t, l, 1, l, null)
          .concat(slideMoves(e, DIAG, t, l, 1, l, null))
          .concat(knightMoves(e, t, l));
      default:
        return [];
    }
  }
  function maxAdopt(e, t) {
    return e === "K" ? (t === "K" ? 1 : 0) : e === "J" || e === "Q" ? (t === "K" ? 1 : 2) : 4;
  }
  function placedRankCounts(e, t) {
    let l = {};
    return (
      Object.keys(e).forEach((n) => {
        let a = t.find((u) => u.id === n);
        a && (l[a.rank] = (l[a.rank] || 0) + 1);
      }),
      l
    );
  }
  function squareName(e, t, l) {
    return `${String.fromCharCode(97 + t)}${l - e}`;
  }
  function sanitizeHistory(e, t, l) {
    return e.owner === t || !e.alive || l
      ? e.history
      : e.history.map((n) => (n.includes("へ移動") ? n : "何らかの効果が発生した"));
  }
  function makePlayer(e) {
    return {
      idx: e,
      hand: [],
      discard: [],
      capturedOwn: [],
      armyRankCounts: {},
      kingId: null,
      ready: !1,
    };
  }
  function initialState() {
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
  function emptyBoard(e) {
    return Array.from(
      {
        length: e,
      },
      () =>
        Array.from(
          {
            length: e,
          },
          () => null,
        ),
    );
  }
  function reducer(e, t) {
    switch (t.type) {
      case "START_SETUP": {
        let l = t.size,
          n = t.deck || shuffle(buildDeck()),
          a = n.slice(0, 13),
          u = n.slice(13, 26),
          i = n.slice(26),
          f = [makePlayer(0), makePlayer(1)];
        return (
          (f[0].hand = a),
          (f[1].hand = u),
          {
            ...initialState(),
            boardSize: l,
            players: f,
            reserve: i,
            phase: "dice",
            interstitial: {
              forPlayer: 0,
              kind: "dice",
            },
          }
        );
      }
      case "ROLL_DICE_SINGLE": {
        if (e.dice[e.diceIdx] !== null) return e;
        let l = t.value || 1 + Math.floor(Math.random() * 6),
          n = [...e.dice];
        return (
          (n[e.diceIdx] = l),
          {
            ...e,
            dice: n,
          }
        );
      }
      case "NEXT_DICE_STEP": {
        if (e.diceIdx === 0 && e.dice[0] !== null)
          return {
            ...e,
            diceIdx: 1,
            interstitial: {
              forPlayer: 1,
              kind: "dice",
            },
          };
        if (e.dice[0] !== null && e.dice[1] !== null) {
          if (e.dice[0] === e.dice[1])
            return {
              ...e,
              diceIdx: 3,
              log: [...e.log, `サイコロが同じ目(${e.dice[0]})だったので振り直します`],
            };
          let l = e.dice[0] > e.dice[1] ? 0 : 1;
          return {
            ...e,
            diceIdx: 2,
            firstPlayer: l,
            currentTurn: l,
            log: [
              ...e.log,
              `サイコロ: ${PLAYER_META[0].name}=${e.dice[0]} / ${PLAYER_META[1].name}=${e.dice[1]} → ${PLAYER_META[l].name}が先手`,
            ],
          };
        }
        return e;
      }
      case "REROLL_DICE":
        return {
          ...e,
          dice: [null, null],
          diceIdx: 0,
          interstitial: {
            forPlayer: 0,
            kind: "dice",
          },
        };
      case "GOTO_MULLIGAN":
        return {
          ...e,
          phase: "mulligan",
          mulliganIdx: e.firstPlayer,
          interstitial: {
            forPlayer: e.firstPlayer,
            kind: "mulligan",
          },
        };
      case "TOGGLE_MULLIGAN_CARD": {
        let l = e.mulliganIdx,
          n = e.players.map((a, u) => {
            if (u !== l) return a;
            let i = new Set(a._mulliganSelected || []);
            return (
              i.has(t.cardId) ? i.delete(t.cardId) : i.add(t.cardId),
              {
                ...a,
                _mulliganSelected: [...i],
              }
            );
          });
        return {
          ...e,
          players: n,
        };
      }
      case "CONFIRM_MULLIGAN": {
        let l = e.mulliganIdx,
          n = [...e.players],
          a = {
            ...n[l],
          },
          u = new Set(t.discardIds || a._mulliganSelected || []),
          i = a.hand.filter((p) => !u.has(p.id)),
          f = a.hand
            .filter((p) => u.has(p.id))
            .map((p) => ({
              ...p,
              owner: l,
            })),
          o = f.length,
          r = t.reserveOrder
            ? t.reserveOrder.map((p) => e.reserve.find((w) => w.id === p)).filter(Boolean)
            : shuffle(e.reserve),
          d = r.slice(0, o),
          m = r.slice(o);
        ((a.hand = [...i, ...d]), (a.discard = [...a.discard, ...f]), delete a._mulliganSelected, (n[l] = a));
        let s = [...e.log, `${PLAYER_META[l].name}が${o}枚を引き直した`],
          v = l === e.firstPlayer ? 1 - e.firstPlayer : null;
        return l === e.firstPlayer
          ? {
              ...e,
              players: n,
              reserve: m,
              mulliganIdx: 1 - e.firstPlayer,
              log: s,
              interstitial: {
                forPlayer: 1 - e.firstPlayer,
                kind: "mulligan",
              },
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
              interstitial: {
                forPlayer: e.firstPlayer,
                kind: "setup",
              },
            };
      }
      case "SETUP_PLACE_CARD": {
        let l = e.setupIdx,
          n = e.players[l],
          a = totalSlots(e.boardSize),
          u = n.hand.find((d) => d.id === t.cardId);
        if (!u) return e;
        let i = {
          ...e.setupPlacement,
        };
        if (!!!i[t.cardId]) {
          if (Object.keys(i).length >= a) return e;
          let d = placedRankCounts(i, n.hand);
          if (u.rank === "K") {
            if ((d.K || 0) >= 1 || (d.J || 0) > 1 || (d.Q || 0) > 1) return e;
          } else {
            let m = (d.K || 0) > 0,
              s = maxAdopt(u.rank, m ? "K" : null);
            if ((d[u.rank] || 0) >= s) return e;
          }
        }
        let o = Object.keys(i).find((d) => i[d].row === t.row && i[d].col === t.col),
          r = i[t.cardId];
        if (o && o !== t.cardId)
          if (r) i[o] = r;
          else return e;
        return (
          (i[t.cardId] = {
            row: t.row,
            col: t.col,
          }),
          {
            ...e,
            setupPlacement: i,
          }
        );
      }
      case "SETUP_UNPLACE_CARD": {
        let l = {
          ...e.setupPlacement,
        };
        return (
          delete l[t.cardId],
          {
            ...e,
            setupPlacement: l,
          }
        );
      }
      case "SETUP_AUTO_ARRANGE": {
        let l = e.setupIdx,
          n = e.players[l],
          a = totalSlots(e.boardSize),
          [u, i] = territoryRows(e.boardSize, l),
          f = [];
        for (let v = u; v <= i; v++)
          for (let p = 0; p < e.boardSize; p++)
            f.push({
              row: v,
              col: p,
            });
        let o = t.cellOrder ? t.cellOrder.map((v) => f[v]).filter(Boolean) : shuffle(f),
          r = t.handOrder
            ? t.handOrder.map((v) => n.hand.find((p) => p.id === v)).filter(Boolean)
            : shuffle(n.hand),
          d = [],
          m = {};
        for (let v of r) {
          if (d.length >= a) break;
          if (v.rank === "K") {
            if ((m.K || 0) >= 1 || (m.J || 0) > 1 || (m.Q || 0) > 1) continue;
          } else {
            let p = (m.K || 0) > 0,
              w = maxAdopt(v.rank, p ? "K" : null);
            if ((m[v.rank] || 0) >= w) continue;
          }
          (d.push(v), (m[v.rank] = (m[v.rank] || 0) + 1));
        }
        let s = {};
        return (
          d.forEach((v, p) => {
            s[v.id] = o[p];
          }),
          {
            ...e,
            setupPlacement: s,
          }
        );
      }
      case "SETUP_GOTO_KING_STEP":
        return Object.keys(e.setupPlacement).length !== totalSlots(e.boardSize)
          ? e
          : {
              ...e,
              setupStep: "king",
              setupPickKing: null,
            };
      case "SETUP_BACK_TO_PLACE":
        return {
          ...e,
          setupStep: "place",
          setupPickKing: null,
        };
      case "SETUP_PICK_KING": {
        let l = e.players[e.setupIdx],
          n = e.setupPlacement,
          a = l.hand.find((i) => i.id === t.cardId);
        return !a ||
          !n[t.cardId] ||
          (Object.keys(n).some((i) => l.hand.find((f) => f.id === i).rank === "K") && a.rank !== "K")
          ? e
          : {
              ...e,
              setupPickKing: t.cardId,
            };
      }
      case "SETUP_CONFIRM": {
        if (!(t.kingId || e.setupPickKing)) return e;
        let l = e.setupIdx,
          n = [...e.players],
          a = {
            ...n[l],
          },
          u = t.placement || e.setupPlacement,
          i = t.kingId || e.setupPickKing,
          f = Object.keys(u),
          o = {},
          r = e.board.length ? e.board.map((s) => [...s]) : emptyBoard(e.boardSize),
          d = {
            ...e.pieces,
          };
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
        let m = [...e.log, `${PLAYER_META[l].name}が布陣を完了`];
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
            interstitial: {
              forPlayer: s,
              kind: "setup",
            },
          };
        }
        return {
          ...e,
          players: n,
          board: r,
          pieces: d,
          phase: "play",
          currentTurn: e.firstPlayer,
          log: [...m, `--- 対局開始:${PLAYER_META[e.firstPlayer].name}の番 ---`],
          interstitial: {
            forPlayer: e.firstPlayer,
            kind: "turn",
          },
        };
      }
      case "DISMISS_INTERSTITIAL":
        return {
          ...e,
          interstitial: null,
        };
      case "SELECT_PIECE": {
        if (e.winner) return e;
        let l = e.pieces[t.id];
        return !l || !l.alive || l.owner !== e.currentTurn || (e.extraMoveFor && l.id !== e.extraMoveFor)
          ? e
          : l.rank === "A"
            ? {
                ...e,
                selectedId: null,
                shuffleMode: {
                  aId: l.id,
                  picks: [],
                },
              }
            : {
                ...e,
                selectedId: t.id,
                shuffleMode: null,
              };
      }
      case "CANCEL_SELECTION":
        return {
          ...e,
          selectedId: null,
          shuffleMode: null,
        };
      case "TOGGLE_SHUFFLE_PICK": {
        if (!e.shuffleMode) return e;
        let l = e.pieces[t.id];
        if (!l || !l.alive || l.id === e.shuffleMode.aId) return e;
        let n = [...e.shuffleMode.picks];
        return (
          n.includes(t.id) ? (n = n.filter((a) => a !== t.id)) : n.length < 2 && (n = [...n, t.id]),
          {
            ...e,
            shuffleMode: {
              ...e.shuffleMode,
              picks: n,
            },
          }
        );
      }
      case "CONFIRM_SHUFFLE": {
        let l = t.aId || (e.shuffleMode && e.shuffleMode.aId),
          n = t.pickIds || (e.shuffleMode && e.shuffleMode.picks) || [];
        if (!l || n.length !== 2) return e;
        let a = [l, ...n],
          u = a.map((s) => ({
            row: e.pieces[s].row,
            col: e.pieces[s].col,
          })),
          i = t.order ? t.order.map((s) => u[s]) : shuffle(u),
          f = e.board.map((s) => [...s]),
          o = {
            ...e.pieces,
          };
        (a.forEach((s) => {
          f[o[s].row][o[s].col] = null;
        }),
          a.forEach((s, v) => {
            let p = i[v];
            ((o[s] = {
              ...o[s],
              row: p.row,
              col: p.col,
              history: [...o[s].history, "周囲の駒と位置を入れ替えた"],
            }),
              (f[p.row][p.col] = o[s]));
          }));
        let r = [...e.log, `${PLAYER_META[e.currentTurn].name}が3つの駒の位置を入れ替えた`],
          d = {
            ...e,
            board: f,
            pieces: o,
            shuffleMode: null,
            log: r,
            lastMove: null,
            lastSwap: {
              cells: u,
              owner: e.currentTurn,
            },
          };
        if (a.every((s) => o[s].owner === e.currentTurn)) {
          let [s, v, p] = a.map((g) => ({
              row: o[g].row,
              col: o[g].col,
            })),
            w = Object.values(o).filter(
              (g) =>
                g.alive &&
                g.owner !== e.currentTurn &&
                pointInTriangle(
                  {
                    row: g.row,
                    col: g.col,
                  },
                  s,
                  v,
                  p,
                ),
            ),
            z = [];
          for (let g of w) {
            let A = d.pieces[g.id];
            if (
              !(!A || !A.alive) &&
              (z.push({
                rank: A.rank,
                suit: A.suit,
                owner: A.owner,
              }),
              (d.log = [
                ...d.log,
                `${PLAYER_META[e.currentTurn].name}が包囲で${PLAYER_META[A.owner].name}の${A.rank}${SUIT_SYMBOL[A.suit]}を撃破!`,
              ]),
              (d = removePiece(d, g.id, {
                by: null,
                viaCounter: !0,
              })),
              d.winner !== null && d.winner !== void 0)
            )
              return endAction(
                {
                  ...d,
                  captureReveal: {
                    defeated: z,
                    capturedBy: e.currentTurn,
                    surround: !0,
                  },
                },
                l,
              );
          }
          z.length &&
            (d.captureReveal = {
              defeated: z,
              capturedBy: e.currentTurn,
              surround: !0,
            });
        }
        return endAction(d, l);
      }
      case "MOVE_PIECE": {
        if (e.winner) return e;
        let l = e.pieces[t.pieceId || e.selectedId];
        if (!l || !l.alive) return e;
        let n = e.board.map((d) => [...d]),
          a = {
            ...e,
            board: n,
            pieces: {
              ...e.pieces,
            },
            selectedId: null,
            lastReveal: null,
          },
          u =
            t.captures && t.captures.length
              ? t.captures
              : n[t.row][t.col]
                ? [
                    {
                      row: t.row,
                      col: t.col,
                    },
                  ]
                : [],
          i = [];
        for (let d of u) {
          let m = a.board[d.row][d.col];
          if (
            !(!m || m.owner === l.owner) &&
            (i.push({
              rank: m.rank,
              suit: m.suit,
              owner: m.owner,
            }),
            (a.log = [
              ...a.log,
              `${PLAYER_META[e.currentTurn].name}が${PLAYER_META[m.owner].name}の${m.rank}${SUIT_SYMBOL[m.suit]}を撃破!`,
            ]),
            (a = removePiece(a, m.id, {
              by: l.id,
              viaCounter: !1,
            })),
            a.winner !== null && a.winner !== void 0)
          )
            return endAction(
              {
                ...a,
                captureReveal: {
                  defeated: i,
                  capturedBy: e.currentTurn,
                },
              },
              l.id,
            );
        }
        i.length &&
          (a.captureReveal = {
            defeated: i,
            capturedBy: e.currentTurn,
          });
        let f = a.pieces[l.id],
          o = a.board.map((d) => [...d]),
          r = {
            ...a.pieces,
          };
        if (f && f.alive) {
          o[l.row][l.col] = null;
          let d = {
            ...f,
            row: t.row,
            col: t.col,
            history: [
              ...f.history,
              `${squareName(l.row, l.col, e.boardSize)} → ${squareName(t.row, t.col, e.boardSize)} へ移動`,
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
              from: {
                row: l.row,
                col: l.col,
              },
              to: {
                row: t.row,
                col: t.col,
              },
              owner: e.currentTurn,
              captured: i.length > 0,
            },
          }),
          endAction(a, l.id)
        );
      }
      case "DISMISS_CAPTURE":
        return {
          ...e,
          captureReveal: null,
        };
      case "ACK_KING_CHOICE":
        return e.pendingKingChoice
          ? {
              ...e,
              pendingKingChoice: {
                ...e.pendingKingChoice,
                acknowledged: !0,
              },
            }
          : e;
      case "CHOOSE_HEIR": {
        let l = e.pendingKingChoice;
        if (!l || !l.candidateIds.includes(t.id)) return e;
        let n = e.pieces[t.id];
        if (!n || !n.alive) return e;
        let a = {
            ...e.pieces,
          },
          u = e.board.map((o) => [...o]),
          i = {
            ...n,
            isKing: !0,
            history: [...n.history, "王位を継承"],
          };
        ((a[n.id] = i), (u[n.row][n.col] = i));
        let f = e.players.map((o, r) =>
          r === l.owner
            ? {
                ...o,
                kingId: n.id,
              }
            : o,
        );
        return {
          ...e,
          pieces: a,
          board: u,
          players: f,
          pendingKingChoice: null,
          log: [...e.log, `${PLAYER_META[l.owner].name}に新しい王が立った!`],
        };
      }
      case "PLACE_RESERVE_CARD": {
        if (!e.kPlacement) return e;
        let { owner, card } = e.kPlacement,
          a = e.board.map((r) => [...r]),
          u = {
            ...e.pieces,
          },
          i = {
            id: card.id,
            rank: card.rank,
            suit: card.suit,
            owner,
            isKing: !1,
            row: t.row,
            col: t.col,
            alive: !0,
            history: ["予備札から出撃"],
            everRevived: !1,
          };
        ((u[i.id] = i), (a[t.row][t.col] = i));
        let f = e.players.map((r, d) =>
            d === owner
              ? {
                  ...r,
                  armyRankCounts: {
                    ...r.armyRankCounts,
                    [card.rank]: (r.armyRankCounts[card.rank] || 0) + 1,
                  },
                }
              : r,
          ),
          o = [...e.log, `${PLAYER_META[owner].name}が予備札から1枚を投入`];
        return {
          ...e,
          board: a,
          pieces: u,
          players: f,
          kPlacement: null,
          log: o,
        };
      }
      case "SKIP_RESERVE_PLACEMENT":
        return {
          ...e,
          kPlacement: null,
        };
      case "SKIP_EXTRA_ACTION":
        return endTurn(e);
      case "VIEW_LOG":
        return {
          ...e,
          logViewerId: t.id,
        };
      case "CLOSE_LOG":
        return {
          ...e,
          logViewerId: null,
        };
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
              log: [...e.log, `${PLAYER_META[l].name}が降参した…${PLAYER_META[1 - l].name}の勝利!`],
            };
      }
      case "NEW_GAME":
        return initialState();
      default:
        return e;
    }
  }
  function removePiece(e, t, l) {
    let n = e.pieces[t];
    if (!n || !n.alive) return e;
    let a = e.board.map((s) => [...s]),
      u = {
        ...e.pieces,
      },
      i = e.players.map((s) => ({
        ...s,
        capturedOwn: [...s.capturedOwn],
      })),
      f = [...e.log],
      o = e.winner;
    a[n.row][n.col] = null;
    let r = {
      ...n,
      alive: !1,
    };
    ((u[t] = r), i[n.owner].capturedOwn.push(r));
    let d = e.pendingKingChoice || null;
    if ((n.rank === "2" || n.rank === "3") && n.isKing) {
      let s = Object.values(u).filter(
        (v) => v.alive && v.owner === n.owner && v.rank === n.rank && v.id !== t,
      );
      if (s.length === 1) {
        let v = {
          ...s[0],
          isKing: !0,
          history: [...s[0].history, "王位を継承"],
        };
        ((u[v.id] = v),
          (a[v.row][v.col] = v),
          (i[n.owner].kingId = v.id),
          f.push(`${PLAYER_META[n.owner].name}に新しい王が立った!`));
      } else
        s.length > 1 &&
          ((i[n.owner].kingId = null),
          (d = {
            owner: n.owner,
            rank: n.rank,
            candidateIds: s.map((v) => v.id),
            acknowledged: !1,
          }),
          f.push(`${PLAYER_META[n.owner].name}は新しい王を選びます`));
    }
    n.isKing &&
      i[n.owner].kingId === t &&
      !d &&
      ((o = 1 - n.owner), f.push(`${PLAYER_META[n.owner].name}の王が倒された…${PLAYER_META[o].name}の勝利!`));
    let m = {
      ...e,
      board: a,
      pieces: u,
      players: i,
      log: f,
      winner: o,
      pendingKingChoice: d,
    };
    if ((n.rank === "4" || n.rank === "5") && !n.isKing && !l.viaCounter && l.by) {
      let s = m.players[n.owner].kingId,
        v = s ? m.pieces[s] : null;
      if (v && v.rank === n.rank) {
        let p = m.pieces[l.by];
        p &&
          p.alive &&
          (f.push(`${PLAYER_META[n.owner].name}の${n.rank}${SUIT_SYMBOL[n.suit]}が道連れにした!`),
          (m = removePiece(
            {
              ...m,
              log: f,
            },
            l.by,
            {
              by: null,
              viaCounter: !0,
            },
          )));
      }
    }
    if (n.rank === "J" || n.rank === "Q") {
      let s = m.players[n.owner],
        v = s.kingId ? m.pieces[s.kingId] : null;
      if (v && v.rank === "K" && v.alive && m.reserve.length > 0) {
        let p = [...m.reserve],
          w = p.pop();
        ((m = {
          ...m,
          reserve: p,
          kPlacement: {
            owner: n.owner,
            card: w,
          },
        }),
          (m.log = [...m.log, `${PLAYER_META[n.owner].name}は予備札を1枚引いた(配置できます)`]));
      }
    }
    return m;
  }
  function endAction(e, t) {
    if (e.winner !== null && e.winner !== void 0)
      return {
        ...e,
        phase: "gameover",
      };
    let l = t ? e.pieces[t] : null,
      n = l && l.alive && l.isKing && l.rank === "10",
      a = l && l.alive && l.isKing && l.rank === "A";
    return (n || a) && !e.extraUsed
      ? {
          ...e,
          extraMoveFor: l.id,
          extraUsed: !0,
          selectedId: null,
          shuffleMode: null,
        }
      : endTurn(e);
  }
  function endTurn(e) {
    let t = 1 - e.currentTurn;
    return {
      ...e,
      currentTurn: t,
      selectedId: null,
      shuffleMode: null,
      extraMoveFor: null,
      extraUsed: !1,
      interstitial: {
        forPlayer: t,
        kind: "turn",
      },
    };
  }
  var SUIT_CODE = {
    spade: "S",
    heart: "H",
    diamond: "D",
    club: "C",
  };
  function cardArtSrc(e, t, l) {
    let n = e + SUIT_CODE[t];
    return (l && CAPTAIN_CARD_ART[n]) || NORMAL_CARD_ART[n];
  }
  function CardFace({ rank, suit, size = "md", isKing = !1 }) {
    let a =
      size === "xs"
        ? {
            w: 26,
            h: 35,
          }
        : size === "sm"
          ? {
              w: 38,
              h: 51,
            }
          : size === "lg"
            ? {
                w: 78,
                h: 104,
              }
            : {
                w: 50,
                h: 67,
              };
    return (
      <div
        className={`card-face ${isKing ? "card-captain" : ""}`}
        style={{
          width: a.w,
          height: a.h,
        }}
      >
        <img src={cardArtSrc(rank, suit, isKing)} alt={`${rank}${SUIT_SYMBOL[suit]}`} draggable="false" />
      </div>
    );
  }
  function CardBack({ colorHex, size = "md" }) {
    let l =
      size === "xs"
        ? {
            w: 26,
            h: 35,
          }
        : size === "sm"
          ? {
              w: 38,
              h: 51,
            }
          : size === "lg"
            ? {
                w: 78,
                h: 104,
              }
            : {
                w: 50,
                h: 67,
              };
    return (
      <div
        className="card-back"
        style={{
          width: l.w,
          height: l.h,
          "--pc": colorHex,
        }}
      >
        <img src={cardBackImg} alt="" draggable="false" />
      </div>
    );
  }
  function Piece({ piece, viewer, isSelected, isPickable, size = "md" }) {
    let u = PLAYER_META[piece.owner],
      i = piece.owner === viewer;
    return (
      <div
        className={`piece-wrap ${isSelected ? "piece-selected" : ""} ${isPickable ? "piece-pickable" : ""}`}
      >
        {i ? (
          <CardFace rank={piece.rank} suit={piece.suit} size={size} isKing={piece.isKing} />
        ) : (
          <CardBack colorHex={u.color} size={size} />
        )}
        {piece.isKing && i && (
          <Crown
            size={size === "xs" ? 10 : size === "sm" ? 12 : 16}
            className="king-badge"
            style={{
              color: u.color,
            }}
          />
        )}
      </div>
    );
  }
  function Interstitial({ forPlayer, kind, onReady }) {
    let n = PLAYER_META[forPlayer],
      a = PLAYER_META[1 - forPlayer],
      u = {
        dice: "サイコロフェーズ",
        mulligan: "引き直しフェーズ",
        setup: "布陣フェーズ",
        turn: "手番交代",
      };
    return (
      <div className="interstitial">
        <div className="interstitial-card">
          <div className="interstitial-eyebrow">PASS THE DEVICE</div>
          <h2
            style={{
              color: n.color,
            }}
          >
            {n.name}の番です
          </h2>
          <p>
            {u[kind] || ""} —{" "}
            <b
              style={{
                color: n.color,
              }}
            >
              {n.name}
            </b>
            の担当者に画面を渡してください。
            <br />
            <b
              style={{
                color: a.color,
              }}
            >
              {a.name}
            </b>
            には見えないようにしてください。
          </p>
          <button className="btn btn-primary" onClick={onReady}>
            <Sparkle size={16} /> 準備ができた
          </button>
        </div>
      </div>
    );
  }
  function CaptureRevealModal({ reveal, onClose, viewer }) {
    let n = reveal.defeated || [],
      a = reveal.capturedBy === void 0 || viewer === void 0 || reveal.capturedBy === viewer;
    return (
      <div className="modal-overlay">
        <div className="modal-panel gameover-panel">
          <div
            className="capture-eyebrow"
            style={
              a
                ? void 0
                : {
                    color: "#e08b7a",
                  }
            }
          >
            {a
              ? reveal.surround
                ? "包囲成功!"
                : "撃破!"
              : reveal.surround
                ? "包囲された!"
                : "駒を取られた!"}
          </div>
          <h3
            style={{
              margin: "0 0 14px",
            }}
          >
            {a
              ? reveal.surround
                ? n.length > 1
                  ? `包囲して${n.length}枚を取りました`
                  : "包囲して相手の駒を取りました"
                : n.length > 1
                  ? `${n.length}枚の駒を取りました`
                  : "相手の駒を取りました"
              : n.length > 1
                ? `あなたの駒が${n.length}枚取られました`
                : "あなたの駒が取られました"}
          </h3>
          <div className="capture-cards">
            {n.map((u, i) => (
              <div className="capture-card" key={i}>
                <CardFace rank={u.rank} suit={u.suit} />
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{
              marginTop: 18,
            }}
            onClick={onClose}
          >
            確認した <Check size={16} />
          </button>
        </div>
      </div>
    );
  }
  function KingChoiceInterstitial({ state, size, dispatch }) {
    let n = state.pendingKingChoice,
      a = PLAYER_META[n.owner];
    if (!n.acknowledged)
      return (
        <div className="interstitial">
          <div className="interstitial-card">
            <div className="interstitial-eyebrow">PASS THE DEVICE</div>
            <h2
              style={{
                color: a.color,
              }}
            >
              {a.name}の王が倒れました
            </h2>
            <p>残っている{n.rank}の中から、新しい王を選びます。画面を渡してください。</p>
            <button
              className="btn btn-primary"
              onClick={() =>
                dispatch({
                  type: "ACK_KING_CHOICE",
                })
              }
            >
              <Sparkle size={16} /> 準備ができた
            </button>
          </div>
        </div>
      );
    let u = n.owner === 1;
    return (
      <div className="setup-wrap">
        <h2
          style={{
            color: a.color,
          }}
        >
          新しい王を選んでください
        </h2>
        <p className="hint">光っている{n.rank}のうち、どれを王にするか選びます。</p>
        <div className="board-outer">
          <div
            className="board-grid"
            style={{
              gridTemplateColumns: `repeat(${size},1fr)`,
            }}
          >
            {Array.from({
              length: size,
            }).map((i, f) =>
              Array.from({
                length: size,
              }).map((o, r) => {
                let d = u ? size - 1 - f : f,
                  m = u ? size - 1 - r : r,
                  s = state.board[d][m],
                  v = s && n.candidateIds.includes(s.id);
                return (
                  <div
                    className={`cell ${v ? "cell-heir" : ""}`}
                    onClick={() => {
                      v &&
                        dispatch({
                          type: "CHOOSE_HEIR",
                          id: s.id,
                        });
                    }}
                    key={`${d}-${m}`}
                  >
                    {s && (
                      <div className={v ? "" : "piece-dim"}>
                        <Piece piece={s} viewer={n.owner} size={size >= 9 ? "xs" : "md"} />
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      </div>
    );
  }
  var DIE_PIPS = {
    1: [[1, 1]],
    2: [
      [0, 0],
      [2, 2],
    ],
    3: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    4: [
      [0, 0],
      [0, 2],
      [2, 0],
      [2, 2],
    ],
    5: [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    6: [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
  };
  function Die({ value, rolling, color, big }) {
    let a = DIE_PIPS[value] || DIE_PIPS[1];
    return rolling && big ? (
      <div
        className="die3d die-rolling"
        style={{
          "--die-accent": color || "var(--gold)",
        }}
      >
        <img src={dieImg} alt="" draggable="false" />
      </div>
    ) : (
      <div
        className={`die ${rolling ? "die-rolling" : ""}`}
        style={{
          "--die-accent": color || "var(--gold)",
        }}
      >
        <div className="die-grid">
          {Array.from({
            length: 9,
          }).map((u, i) => {
            let f = Math.floor(i / 3),
              o = i % 3,
              r = a.some(([d, m]) => d === f && m === o);
            return (
              <span
                className={r ? "pip pip-on" : "pip"}
                style={
                  r
                    ? {
                        background: color,
                      }
                    : void 0
                }
                key={i}
              />
            );
          })}
        </div>
      </div>
    );
  }
  function DiceStep({ playerIdx, value, onRoll, onNext }) {
    let [a, u] = (0, C.useState)(!1),
      [i, f] = (0, C.useState)(1),
      o = PLAYER_META[playerIdx];
    ((0, C.useEffect)(() => {
      if (!a) return;
      let d = setInterval(() => f(1 + Math.floor(Math.random() * 6)), 70),
        m = setTimeout(() => {
          (u(!1), onRoll());
        }, 900);
      return () => {
        (clearInterval(d), clearTimeout(m));
      };
    }, [a]),
      (0, C.useEffect)(() => {
        value !== null && !a && f(value);
      }, [value, a]));
    let r = value !== null && !a;
    return (
      <div className="center-stage">
        <h2
          style={{
            color: o.color,
          }}
        >
          あなた({o.name})のサイコロ
        </h2>
        <div className="die-stage">
          <Die value={i} rolling={a} color={o.color} big={!0} />
        </div>
        {r ? (
          <>
            <p
              className="die-result"
              style={{
                color: o.color,
              }}
            >
              {value} が出ました
            </p>
            <button className="btn btn-primary" onClick={onNext}>
              次へ <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <button className="btn btn-primary" disabled={a} onClick={() => u(!0)}>
            {a ? "転がしています…" : "サイコロを振る"}
          </button>
        )}
      </div>
    );
  }
  function useWindowWidth() {
    let [e, t] = (0, C.useState)(() => (typeof window < "u" ? window.innerWidth : 400));
    return (
      (0, C.useEffect)(() => {
        let l = () => t(window.innerWidth);
        return (
          window.addEventListener("resize", l),
          window.addEventListener("orientationchange", l),
          () => {
            (window.removeEventListener("resize", l), window.removeEventListener("orientationchange", l));
          }
        );
      }, []),
      e
    );
  }
  function MoveDiagram({ rank, isKing = !1, gridSize = 7 }) {
    let n = Math.floor(gridSize / 2),
      a = emptyBoard(gridSize),
      u = {
        id: "me",
        rank,
        suit: "spade",
        owner: 0,
        isKing,
        row: n,
        col: n,
        alive: !0,
        history: [],
      };
    if (((a[n][n] = u), isKing && ["6", "7", "8", "9"].includes(rank)))
      for (let o = 0; o < gridSize; o++)
        for (let r = 0; r < gridSize; r++)
          (o === n && r === n) ||
            (a[o][r] = {
              id: `e${o}-${r}`,
              rank: "2",
              suit: "heart",
              owner: 1,
              isKing: !1,
              row: o,
              col: r,
              alive: !0,
              history: [],
            });
    let i =
        rank === "A"
          ? []
          : getLegalMoves(u, a, gridSize, {
              [rank]: 1,
            }),
      f = new Set(i.map((o) => `${o.row},${o.col}`));
    return (
      <div
        className="move-diagram"
        style={{
          gridTemplateColumns: `repeat(${gridSize},1fr)`,
        }}
      >
        {Array.from({
          length: gridSize,
        }).map((o, r) =>
          Array.from({
            length: gridSize,
          }).map((d, m) => {
            let s = r === n && m === n,
              v = f.has(`${r},${m}`);
            return (
              <span className={`md-cell ${s ? "md-me" : ""} ${v ? "md-reach" : ""}`} key={`${r}-${m}`} />
            );
          }),
        )}
      </div>
    );
  }
  function CardGuide({ rank, suit, isKing = !1, compact = !1 }) {
    return (
      <div className={`card-guide ${compact ? "card-guide-compact" : ""}`}>
        <div className="cg-head">
          {suit ? <CardFace rank={rank} suit={suit} /> : <div className="cg-rank">{rank}</div>}
          <MoveDiagram rank={rank} isKing={isKing} />
        </div>
        <p className="cg-text">{MOVE_TEXT[rank]}</p>
        {isKing && <p className="cg-king">王の効果: {KING_TEXT[rank]}</p>}
      </div>
    );
  }
  function DiscardPanel({ cards, label, color }) {
    if (!cards || cards.length === 0) return null;
    let n = [...cards].sort((a, u) => {
      let i = RANKS.indexOf(a.rank) - RANKS.indexOf(u.rank);
      return i !== 0 ? i : SUITS.indexOf(a.suit) - SUITS.indexOf(u.suit);
    });
    return (
      <div className="discard-panel">
        <div
          className="discard-label"
          style={{
            color,
          }}
        >
          {label}({n.length}枚)
        </div>
        <div className="discard-row">
          {n.map((a) => (
            <div className="discard-card" key={a.id}>
              <CardFace rank={a.rank} suit={a.suit} size="sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  function MulliganHand({ hand, selected, onToggle }) {
    let n = useWindowWidth(),
      a = n >= 480,
      u = n < 380 ? "sm" : "md",
      i = [...hand].sort((o, r) => {
        let d = RANKS.indexOf(o.rank) - RANKS.indexOf(r.rank);
        return d !== 0 ? d : SUITS.indexOf(o.suit) - SUITS.indexOf(r.suit);
      }),
      f = ({ c: o }) => (
        <div
          className={`hand-card ${selected.has(o.id) ? "hand-card-selected" : ""}`}
          onClick={() => onToggle(o.id)}
        >
          <CardFace rank={o.rank} suit={o.suit} size={u} />
          {selected.has(o.id) && <span className="discard-badge">✕</span>}
        </div>
      );
    return a ? (
      <div className="hand-split">
        <div className="hand-row">
          {i.slice(0, 7).map((o) => (
            <f c={o} key={o.id} />
          ))}
        </div>
        <div className="hand-row">
          {i.slice(7, 13).map((o) => (
            <f c={o} key={o.id} />
          ))}
        </div>
      </div>
    ) : (
      <div className="hand-grid">
        {i.map((o) => (
          <f c={o} key={o.id} />
        ))}
      </div>
    );
  }
  function DiceStage({ playerIdx, value }) {
    let l = PLAYER_META[playerIdx],
      [n, a] = (0, C.useState)(1),
      u = value != null;
    return (
      (0, C.useEffect)(() => {
        if (u) {
          a(value);
          return;
        }
        let i = setInterval(() => a(1 + Math.floor(Math.random() * 6)), 140);
        return () => clearInterval(i);
      }, [u, value]),
      (
        <div className="center-stage">
          <h2
            style={{
              color: l.color,
            }}
          >
            相手({l.name})のサイコロ
          </h2>
          <div className="die-stage">
            <Die value={n} rolling={!u} color={l.color} big={!0} />
          </div>
          {u ? (
            <>
              <p
                className="die-result"
                style={{
                  color: l.color,
                }}
              >
                {value} が出ました
              </p>
              <p className="hint">相手が次に進むのを待っています…</p>
            </>
          ) : (
            <p className="hint">相手が振っています…</p>
          )}
        </div>
      )
    );
  }
  function WaitingWithBoard({ text, hand, board, size, viewer, placement, player }) {
    let f = hand
        ? [...hand].sort((r, d) => {
            let m = RANKS.indexOf(r.rank) - RANKS.indexOf(d.rank);
            return m !== 0 ? m : SUITS.indexOf(r.suit) - SUITS.indexOf(d.suit);
          })
        : [],
      o = viewer === 1;
    return (
      <div className="setup-wrap">
        <div className="waiting-head">
          <Dice size={22} className="dim-icon spin-icon" />
          <p
            className="hint"
            style={{
              margin: 0,
            }}
          >
            {text}
          </p>
        </div>
        {board && (
          <div className="arrange-layout">
            <div
              className="mini-board"
              style={{
                gridTemplateColumns: `repeat(${size},1fr)`,
              }}
            >
              {Array.from({
                length: size,
              }).map((r, d) =>
                Array.from({
                  length: size,
                }).map((m, s) => {
                  let v = o ? size - 1 - d : d,
                    p = o ? size - 1 - s : s,
                    w = board[v][p],
                    z = w && w.owner === viewer;
                  return (
                    <div className="mini-cell" key={`${v}-${p}`}>
                      {w && (
                        <div className="mini-piece">
                          {z ? (
                            <CardFace rank={w.rank} suit={w.suit} size="sm" />
                          ) : (
                            <CardBack colorHex={PLAYER_META[w.owner].color} size="sm" />
                          )}
                          {z && w.isKing && <Crown size={12} className="king-badge" />}
                        </div>
                      )}
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        )}
        {placement && player && (
          <div className="arrange-layout">
            <div
              className="mini-board"
              style={{
                gridTemplateColumns: `repeat(${size},1fr)`,
              }}
            >
              {Array.from({
                length: size,
              }).map((r, d) =>
                Array.from({
                  length: size,
                }).map((m, s) => {
                  let v = o ? size - 1 - d : d,
                    p = o ? size - 1 - s : s,
                    w = Object.keys(placement).find((g) => placement[g].row === v && placement[g].col === p),
                    z = w ? player.hand.find((g) => g.id === w) : null;
                  return (
                    <div className="mini-cell" key={`${v}-${p}`}>
                      {z && (
                        <div className="mini-piece">
                          <CardFace rank={z.rank} suit={z.suit} size="sm" />
                        </div>
                      )}
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        )}
        {f.length > 0 && (
          <>
            <div
              className="tray-label"
              style={{
                marginTop: 14,
              }}
            >
              あなたの手札({f.length}枚)
            </div>
            <div className="hand-grid">
              {f.map((r) => (
                <div className="hand-card" key={r.id}>
                  <CardFace rank={r.rank} suit={r.suit} size="sm" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }
  function WaitingScreen({ text }) {
    return (
      <div className="center-stage">
        <Dice size={28} className="dim-icon spin-icon" />
        <p className="hint">{text}</p>
      </div>
    );
  }
  function RulesPanel({ onClose }) {
    let [t, l] = (0, C.useState)(!1);
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-panel" onClick={(n) => n.stopPropagation()}>
          <div className="modal-head">
            <h3>カード早見表</h3>
            <button className="icon-btn" onClick={onClose}>
              <Close size={18} />
            </button>
          </div>
          <div className="rule-toggle">
            <button className={`btn ${t ? "btn-ghost" : "btn-primary"}`} onClick={() => l(!1)}>
              通常の動き
            </button>
            <button className={`btn ${t ? "btn-primary" : "btn-ghost"}`} onClick={() => l(!0)}>
              王にした時
            </button>
          </div>
          <p
            className="hint"
            style={{
              marginBottom: 14,
            }}
          >
            {t
              ? "王にした時に加わる効果です。図は同じ数字を1枚だけ採用した場合。"
              : "金色のマスが動ける先です。"}
          </p>
          <div className="rule-grid">
            {RANKS.map((n) => (
              <div className="rule-row" key={n}>
                <div className="rule-diagram">
                  <div className="rule-rank">{n}</div>
                  <MoveDiagram rank={n} isKing={t} />
                </div>
                <div className="rule-desc">{t ? KING_TEXT[n] : MOVE_TEXT[n]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  function LogViewer({ piece, viewer, onClose, revealAll }) {
    let a = PLAYER_META[piece.owner],
      u = piece.owner === viewer || !piece.alive || revealAll,
      i = sanitizeHistory(piece, viewer, revealAll);
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-panel" onClick={(f) => f.stopPropagation()}>
          <div className="modal-head">
            <h3
              style={{
                color: a.color,
              }}
            >
              {u ? `${piece.rank}${SUIT_SYMBOL[piece.suit]}` : "???"} の行動ログ
            </h3>
            <button className="icon-btn" onClick={onClose}>
              <Close size={18} />
            </button>
          </div>
          {u && <CardGuide rank={piece.rank} suit={piece.suit} isKing={piece.isKing} compact={!0} />}
          {i.length === 0 ? (
            <p className="hint">まだ行動していません。</p>
          ) : (
            <ol className="log-list">
              {i.map((f, o) => (
                <li key={o}>
                  {o + 1}. {f}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    );
  }
  var LOCAL_ONLY_ACTIONS = new Set([
    "VIEW_LOG",
    "CLOSE_LOG",
    "SELECT_PIECE",
    "CANCEL_SELECTION",
    "TOGGLE_SHUFFLE_PICK",
    "TOGGLE_MULLIGAN_CARD",
    "SETUP_PLACE_CARD",
    "SETUP_UNPLACE_CARD",
    "SETUP_AUTO_ARRANGE",
    "SETUP_GOTO_KING_STEP",
    "SETUP_BACK_TO_PLACE",
    "SETUP_PICK_KING",
    "ACK_KING_CHOICE",
    "DISMISS_CAPTURE",
    "DISMISS_INTERSTITIAL",
  ]);
  function withLocalContext(e, t) {
    switch (e.type) {
      case "CONFIRM_MULLIGAN":
        return {
          ...e,
          discardIds: [...(t.players[t.mulliganIdx]._mulliganSelected || [])],
        };
      case "SETUP_CONFIRM":
        return {
          ...e,
          placement: t.setupPlacement,
          kingId: t.setupPickKing,
        };
      case "CONFIRM_SHUFFLE":
        return {
          ...e,
          aId: t.shuffleMode && t.shuffleMode.aId,
          pickIds: t.shuffleMode ? [...t.shuffleMode.picks] : [],
        };
      case "MOVE_PIECE":
        return {
          ...e,
          pieceId: t.selectedId,
        };
      default:
        return e;
    }
  }
  var RANK_VALUE = {
    A: 5,
    2: 2,
    3: 2,
    4: 3,
    5: 3,
    6: 4,
    7: 4,
    8: 4,
    9: 4,
    10: 5,
    J: 6,
    Q: 6,
    K: 7,
  };
  function pickKing(e) {
    let t = e.players[e.setupIdx],
      l = Object.keys(e.setupPlacement)
        .map((u) => t.hand.find((i) => i.id === u))
        .filter(Boolean);
    if (l.some((u) => u.rank === "K")) return l.find((u) => u.rank === "K").id;
    let a = (u) =>
      u.rank === "A"
        ? 0
        : (RANK_VALUE[u.rank] || 1) +
          (["2", "3"].includes(u.rank) ? l.filter((i) => i.rank === u.rank).length * 2 : 0);
    return l.slice().sort((u, i) => a(i) - a(u))[0].id;
  }
  function pickMulliganDiscards(e) {
    let t = e.players[e.mulliganIdx],
      l = totalSlots(e.boardSize),
      n = {},
      a = [],
      u = [],
      i = t.hand.slice().sort((f, o) => (RANK_VALUE[o.rank] || 0) - (RANK_VALUE[f.rank] || 0));
    for (let f of i) {
      let o = f.rank === "K" ? 1 : f.rank === "J" || f.rank === "Q" ? 2 : 4,
        r = n[f.rank] || 0;
      a.length < l + 2 && r < o ? (a.push(f), (n[f.rank] = r + 1)) : u.push(f);
    }
    return u.slice(0, 4).map((f) => f.id);
  }
  function bestMove(e, t) {
    let l = e.boardSize,
      n = Object.values(e.pieces).filter((d) => d.alive && d.owner === t),
      a = e.players[t].kingId ? e.pieces[e.players[t].kingId] : null,
      u = 1 - t,
      [i, f] = territoryRows(l, u),
      o = t === 0 ? i : f,
      r = [];
    for (let d of n) {
      if (d.rank === "A" || (e.extraMoveFor && d.id !== e.extraMoveFor)) continue;
      let m = getLegalMoves(d, e.board, l, e.players[t].armyRankCounts);
      for (let s of m) {
        let v = Math.random() * 0.8,
          p = e.board[s.row][s.col];
        p && p.owner !== t && ((v += 12), s.captures && (v += (s.captures.length - 1) * 10));
        let w = Math.abs(d.row - o),
          z = Math.abs(s.row - o);
        (z < w && (v += 1.2),
          d.isKing && ((v -= 2), z < w && (v -= 1.5)),
          r.push({
            score: v,
            pieceId: d.id,
            row: s.row,
            col: s.col,
            captures: s.captures,
          }));
      }
    }
    return r.length ? (r.sort((d, m) => m.score - d.score), r[0]) : null;
  }
  function bestShuffle(e, t) {
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
        u.push({
          score: d + Math.random() * 0.5,
          ids: [o.id, r.id],
        });
      }
    return (
      u.sort((i, f) => f.score - i.score),
      {
        aceId: l.id,
        pickIds: u[0].ids,
        promising: u[0].score >= 1,
      }
    );
  }
  function cpuAction(e, t) {
    if (e.phase === "gameover" || e.captureReveal) return null;
    if (e.pendingKingChoice) {
      let l = e.pendingKingChoice;
      return l.owner !== t
        ? null
        : l.acknowledged
          ? {
              type: "CHOOSE_HEIR",
              id: l.candidateIds[0],
            }
          : {
              type: "ACK_KING_CHOICE",
            };
    }
    if (e.phase === "dice")
      return e.diceIdx !== t
        ? null
        : e.dice[t] === null
          ? {
              type: "ROLL_DICE_SINGLE",
            }
          : {
              type: "NEXT_DICE_STEP",
            };
    if (e.phase === "mulligan")
      return e.mulliganIdx !== t
        ? null
        : {
            type: "CONFIRM_MULLIGAN",
            discardIds: pickMulliganDiscards(e),
          };
    if (e.phase === "setup")
      return e.setupIdx !== t
        ? null
        : e.setupStep === "place"
          ? Object.keys(e.setupPlacement).length < totalSlots(e.boardSize)
            ? {
                type: "SETUP_AUTO_ARRANGE",
              }
            : {
                type: "SETUP_GOTO_KING_STEP",
              }
          : e.setupPickKing
            ? {
                type: "SETUP_CONFIRM",
              }
            : {
                type: "SETUP_PICK_KING",
                cardId: pickKing(e),
              };
    if (e.phase === "play") {
      if (e.currentTurn !== t) return null;
      if (e.kPlacement) {
        if (e.kPlacement.owner !== t) return null;
        let [a, u] = territoryRows(e.boardSize, t);
        for (let i = a; i <= u; i++)
          for (let f = 0; f < e.boardSize; f++)
            if (!e.board[i][f])
              return {
                type: "PLACE_RESERVE_CARD",
                row: i,
                col: f,
              };
        return {
          type: "SKIP_RESERVE_PLACEMENT",
        };
      }
      let l = bestMove(e, t),
        n = bestShuffle(e, t);
      return n && n.promising && (!l || l.score < 12)
        ? {
            type: "__CPU_SHUFFLE",
            ...n,
          }
        : l
          ? {
              type: "MOVE_PIECE",
              pieceId: l.pieceId,
              row: l.row,
              col: l.col,
              captures: l.captures,
            }
          : n
            ? {
                type: "__CPU_SHUFFLE",
                ...n,
              }
            : {
                type: "SKIP_EXTRA_ACTION",
              };
    }
    return null;
  }
  function enrichAction(e, t) {
    switch (e.type) {
      case "START_SETUP":
        return {
          ...e,
          deck: shuffle(buildDeck()).map((l) => ({
            ...l,
          })),
        };
      case "ROLL_DICE_SINGLE":
        return {
          ...e,
          value: 1 + Math.floor(Math.random() * 6),
        };
      case "CONFIRM_MULLIGAN":
        return {
          ...e,
          reserveOrder: shuffle(t.reserve).map((l) => l.id),
        };
      case "CONFIRM_SHUFFLE":
        return {
          ...e,
          order: shuffle([0, 1, 2]),
        };
      default:
        return e;
    }
  }
  function GameCore({ onExit, network, boardSize, cpu }) {
    let [a, u] = (0, C.useState)(initialState),
      [i, f] = (0, C.useState)(!1),
      [o, r] = (0, C.useState)(!1),
      [d, m] = (0, C.useState)(!1),
      [s, v] = (0, C.useState)(null),
      p = network ? network.myPlayerIndex : null,
      w = (0, C.useRef)(makeClientId()),
      z = (0, C.useRef)(0),
      g = (0, C.useRef)(new Set()),
      [A, b] = (0, C.useState)(0);
    function y(E) {
      u((U) => {
        if (network && LOCAL_ONLY_ACTIONS.has(E.type)) return reducer(U, E);
        let be = network ? enrichAction(withLocalContext(E, U), U) : E;
        if (network) {
          let at = `${w.current}-${++z.current}`,
            ne = {
              ...be,
              __id: at,
            };
          return (
            g.current.add(at),
            queueMicrotask(() => {
              pushAct(network.code, ne).then(async (Me) => {
                if (Me.ok) v(null);
                else {
                  await new Promise((Zt) => setTimeout(Zt, 700));
                  let ze = await pushAct(network.code, ne);
                  v(ze.ok ? null : ze.error);
                }
              });
            }),
            reducer(U, ne)
          );
        }
        return reducer(U, be);
      });
    }
    (0, C.useEffect)(() => {
      a.phase === "intro" &&
        ((network && p !== 0) ||
          y({
            type: "START_SETUP",
            size: boardSize || 5,
          }));
    }, [a.phase, boardSize]);
    let T = 1;
    ((0, C.useEffect)(() => {
      if (!cpu || network) return;
      let E = cpuAction(a, T);
      if (!E) return;
      let U = a.phase === "play" ? 700 : 380,
        be = setTimeout(() => {
          E.type === "__CPU_SHUFFLE"
            ? (y({
                type: "SELECT_PIECE",
                id: E.aceId,
              }),
              y({
                type: "TOGGLE_SHUFFLE_PICK",
                id: E.pickIds[0],
              }),
              y({
                type: "TOGGLE_SHUFFLE_PICK",
                id: E.pickIds[1],
              }),
              y({
                type: "CONFIRM_SHUFFLE",
              }))
            : y(E);
        }, U);
      return () => clearTimeout(be);
    }, [a, cpu, network]),
      (0, C.useEffect)(() => {
        if (!network) return;
        let E = !1,
          U = setInterval(async () => {
            let be = await readActs(network.code);
            if (E) return;
            if (!be.ok) {
              v(be.error);
              return;
            }
            let at = be.list.filter((ne) => ne && ne.__id && !g.current.has(ne.__id));
            at.length !== 0 &&
              (at.forEach((ne) => g.current.add(ne.__id)),
              u((ne) => at.reduce((Me, ze) => reducer(Me, ze), ne)),
              b(be.list.length));
          }, 700);
        return () => {
          ((E = !0), clearInterval(U));
        };
      }, [network]));
    let R = a.boardSize,
      P = network ? p : cpu ? 0 : a.currentTurn,
      x = network ? a.currentTurn === p : cpu ? a.currentTurn === 0 : !0,
      N = network
        ? `${p === 0 ? "host" : "guest"} acts:${g.current.size} d${a.diceIdx}[${(a.dice || []).map((E) => E ?? "-").join(",")}]`
        : null;
    if (d)
      return (
        <GameShell showRules={i} setShowRules={f} netInfo={N}>
          <ResignConfirm
            viewer={P}
            onCancel={() => m(!1)}
            onResign={() => {
              (m(!1),
                y({
                  type: "RESIGN",
                  player: P,
                }));
            }}
          />
        </GameShell>
      );
    if (o)
      return (
        <GameShell showRules={i} setShowRules={f} netInfo={N}>
          <QuitConfirm
            network={network}
            onCancel={() => r(!1)}
            onQuit={() => {
              (r(!1), onExit());
            }}
          />
        </GameShell>
      );
    if (a.phase === "intro")
      return (
        <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
          <WaitingScreen
            text={network && p !== 0 ? "相手の準備を待っています…" : "対局の準備をしています…"}
          />
        </GameShell>
      );
    if (a.captureReveal && (!network || a.captureReveal.capturedBy === p))
      return (
        <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
          <CaptureRevealModal
            reveal={a.captureReveal}
            viewer={P}
            onClose={() =>
              y({
                type: "DISMISS_CAPTURE",
              })
            }
          />
        </GameShell>
      );
    if (a.pendingKingChoice)
      return network && a.pendingKingChoice.owner !== p ? (
        <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
          <WaitingScreen text="相手が新しい王を選んでいます…" />
        </GameShell>
      ) : (
        <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
          <KingChoiceInterstitial state={a} size={R} dispatch={y} />
        </GameShell>
      );
    if (a.interstitial && !network && !cpu)
      return (
        <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
          <Interstitial
            forPlayer={a.interstitial.forPlayer}
            kind={a.interstitial.kind}
            onReady={() =>
              y({
                type: "DISMISS_INTERSTITIAL",
              })
            }
          />
        </GameShell>
      );
    if (a.phase === "dice") {
      if (a.diceIdx === 3)
        return (
          <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
            <div className="center-stage">
              <h2>同じ目でした</h2>
              <div className="dice-result-row">
                {[0, 1].map((U) => (
                  <div className="dice-result-item" key={U}>
                    <span
                      style={{
                        color: PLAYER_META[U].color,
                      }}
                    >
                      {shortPlayerLabel(U, P)}({PLAYER_META[U].name})
                    </span>
                    <Die value={a.dice[U]} color={PLAYER_META[U].color} />
                  </div>
                ))}
              </div>
              <p className="hint">先手・後手が決まらないため、もう一度振り直します。</p>
              {!network || p === 0 ? (
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    y({
                      type: "REROLL_DICE",
                    })
                  }
                >
                  <RotateCcw size={16} /> 振り直す
                </button>
              ) : (
                <p className="hint">ホストが振り直しを開始します…</p>
              )}
            </div>
          </GameShell>
        );
      let E = a.diceIdx >= 2 ? null : a.diceIdx;
      return E !== null ? (
        cpu && E !== 0 ? (
          <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
            <DiceStage playerIdx={E} value={a.dice[E]} />
          </GameShell>
        ) : network && E !== p ? (
          <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
            <DiceStage playerIdx={E} value={a.dice[E]} />
          </GameShell>
        ) : (
          <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
            <DiceStep
              playerIdx={E}
              value={a.dice[E]}
              onRoll={() =>
                y({
                  type: "ROLL_DICE_SINGLE",
                  playerIdx: E,
                })
              }
              onNext={() =>
                y({
                  type: "NEXT_DICE_STEP",
                })
              }
            />
          </GameShell>
        )
      ) : (
        <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
          <div className="center-stage">
            <h2>結果発表</h2>
            <div className="dice-result-row">
              {[0, 1].map((U) => (
                <div className={`dice-result-item ${a.firstPlayer === U ? "dice-winner" : ""}`} key={U}>
                  <span
                    style={{
                      color: PLAYER_META[U].color,
                    }}
                  >
                    {shortPlayerLabel(U, P)}({PLAYER_META[U].name})
                  </span>
                  <Die value={a.dice[U]} color={PLAYER_META[U].color} />
                </div>
              ))}
            </div>
            <p
              style={{
                color: PLAYER_META[a.firstPlayer].color,
                fontWeight: 700,
              }}
            >
              {a.firstPlayer === P ? "あなた" : "相手"}({PLAYER_META[a.firstPlayer].name})が先手です
            </p>
            {!network || p === 0 ? (
              <button
                className="btn btn-primary"
                onClick={() =>
                  y({
                    type: "GOTO_MULLIGAN",
                  })
                }
              >
                手札を確認する <ArrowRight size={16} />
              </button>
            ) : (
              <p className="hint">ホストが次に進めます…</p>
            )}
          </div>
        </GameShell>
      );
    }
    if (a.phase === "mulligan") {
      if (cpu && a.mulliganIdx !== 0)
        return (
          <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
            <WaitingWithBoard
              text="CPUがカードを選んでいます…"
              hand={a.players[0].hand}
              viewer={0}
              size={R}
            />
          </GameShell>
        );
      if (network && a.mulliganIdx !== p)
        return (
          <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
            <WaitingWithBoard
              text="相手が交換するカードを選んでいます…"
              hand={a.players[p].hand}
              viewer={p}
              size={R}
            />
          </GameShell>
        );
      let E = a.mulliganIdx,
        U = a.players[E],
        be = new Set(U._mulliganSelected || []);
      return (
        <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
          <div className="setup-wrap">
            <h2
              style={{
                color: PLAYER_META[E].color,
              }}
            >
              {playerLabel(E, P)}: 交換するカードを選んでね
            </h2>
            <p className="hint">
              捨てたい札をタップ(もう一度タップで取り消し)。同じ枚数を予備札から引き直します。捨て札は公開情報になります。
            </p>
            <MulliganHand
              hand={U.hand}
              selected={be}
              onToggle={(at) =>
                y({
                  type: "TOGGLE_MULLIGAN_CARD",
                  cardId: at,
                })
              }
            />
            <DiscardPanel
              cards={a.players[1 - E].discard}
              label={`${shortPlayerLabel(1 - E, P)}(${PLAYER_META[1 - E].name})が捨てたカード`}
              color={PLAYER_META[1 - E].color}
            />
            <button
              className="btn btn-primary"
              onClick={() =>
                y({
                  type: "CONFIRM_MULLIGAN",
                })
              }
            >
              {be.size}枚 引き直して確定 <Check size={16} />
            </button>
          </div>
        </GameShell>
      );
    }
    if (a.phase === "setup") {
      if (cpu && a.setupIdx !== 0)
        return (
          <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
            <WaitingWithBoard
              text="CPUが布陣を決めています…"
              hand={a.players[0].hand}
              board={a.board && a.board.length ? a.board : null}
              viewer={0}
              size={R}
            />
          </GameShell>
        );
      if (network && a.setupIdx !== p)
        return (
          <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
            <WaitingWithBoard
              text="相手が布陣を決めています…"
              hand={a.players[p].hand}
              board={a.board && a.board.length ? a.board : null}
              viewer={p}
              size={R}
            />
          </GameShell>
        );
      let E = a.setupIdx,
        U = a.players[E];
      return (
        <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
          {a.setupStep === "place" ? (
            <PlaceStep state={a} player={U} pIdx={E} size={R} dispatch={y} />
          ) : (
            <KingStep state={a} player={U} pIdx={E} size={R} dispatch={y} />
          )}
        </GameShell>
      );
    }
    let M = x && a.selectedId ? a.pieces[a.selectedId] : null,
      ct = M ? getLegalMoves(M, a.board, R, a.players[P].armyRankCounts) : [],
      Jl = P === 1,
      Pl = x && a.shuffleMode;
    return (
      <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
        <div className="play-wrap">
          <TurnBar state={a} viewer={P} />
          {s && (
            <p
              className="hint"
              style={{
                textAlign: "center",
                color: "#e2896f",
              }}
            >
              {s}
            </p>
          )}
          {network && !x && (
            <p
              className="hint"
              style={{
                textAlign: "center",
              }}
            >
              相手の手番です
            </p>
          )}
          {cpu && !x && (
            <p
              className="hint"
              style={{
                textAlign: "center",
              }}
            >
              <Dice size={14} className="spin-icon" /> CPUが考えています…
            </p>
          )}
          <div className="board-outer">
            <div
              className="board-frame"
              style={{
                "--n": R,
              }}
            >
              <div className="rank-labels">
                {Array.from({
                  length: R,
                }).map((E, U) => {
                  let be = Jl ? R - 1 - U : U;
                  return <span key={U}>{R - be}</span>;
                })}
              </div>
              <div
                className="board-grid"
                style={{
                  gridTemplateColumns: `repeat(${R},1fr)`,
                }}
              >
                {Array.from({
                  length: R,
                }).map((E, U) =>
                  Array.from({
                    length: R,
                  }).map((be, at) => {
                    let ne = Jl ? R - 1 - U : U,
                      Me = Jl ? R - 1 - at : at,
                      ze = a.board[ne][Me],
                      Zt = ct.find((wl) => wl.row === ne && wl.col === Me),
                      Zo = territoryOwnerOf(ne, Me, R),
                      Vt = a.lastMove,
                      Vo = Vt && Vt.from.row === ne && Vt.from.col === Me,
                      Go = Vt && Vt.to.row === ne && Vt.to.col === Me,
                      Oi = a.lastSwap,
                      Lo = Oi && Oi.cells.some((wl) => wl.row === ne && wl.col === Me),
                      S0 = Vo ? "cell-from" : Go ? "cell-to" : Lo ? "cell-swap" : "";
                    return (
                      <div
                        style={
                          Vt && (Vo || Go)
                            ? {
                                "--lm": PLAYER_META[Vt.owner].color,
                              }
                            : Lo
                              ? {
                                  "--lm": PLAYER_META[Oi.owner].color,
                                }
                              : void 0
                        }
                        className={`cell ${Zt ? (Zt.capture ? "cell-capture" : "cell-move") : ""} ${Zo !== null ? `zone-${Zo}` : ""} ${S0}`}
                        onClick={() => {
                          Pl ||
                            ze ||
                            y(
                              Zt
                                ? {
                                    type: "MOVE_PIECE",
                                    row: ne,
                                    col: Me,
                                    captures: Zt.captures,
                                  }
                                : {
                                    type: "CANCEL_SELECTION",
                                  },
                            );
                        }}
                        key={`${ne}-${Me}`}
                      >
                        {ze && (
                          <div
                            onClick={(wl) => {
                              if ((wl.stopPropagation(), Pl)) {
                                y({
                                  type: "TOGGLE_SHUFFLE_PICK",
                                  id: ze.id,
                                });
                                return;
                              }
                              if (Zt && x) {
                                y({
                                  type: "MOVE_PIECE",
                                  row: ne,
                                  col: Me,
                                  captures: Zt.captures,
                                });
                                return;
                              }
                              if (ze.owner === P && x) {
                                y({
                                  type: "SELECT_PIECE",
                                  id: ze.id,
                                });
                                return;
                              }
                              y({
                                type: "VIEW_LOG",
                                id: ze.id,
                              });
                            }}
                          >
                            <Piece
                              piece={ze}
                              viewer={P}
                              size={R >= 9 ? "xs" : "md"}
                              isSelected={
                                (!!M && a.selectedId === ze.id) ||
                                (Pl && (a.shuffleMode.aId === ze.id || a.shuffleMode.picks.includes(ze.id)))
                              }
                              isPickable={!!Pl && ze.id !== a.shuffleMode.aId}
                            />
                          </div>
                        )}
                      </div>
                    );
                  }),
                )}
              </div>
              <div className="file-labels">
                {Array.from({
                  length: R,
                }).map((E, U) => {
                  let be = Jl ? R - 1 - U : U;
                  return <span key={U}>{String.fromCharCode(97 + be)}</span>;
                })}
              </div>
            </div>
          </div>
          {Pl && (
            <div className="action-bar">
              <span>
                入れ替える駒を2つ選択({a.shuffleMode.picks.length}/2)
                <br />
                味方だけを選ぶと、囲んだ相手を取れます
              </span>
              <button
                className="btn btn-primary"
                disabled={a.shuffleMode.picks.length !== 2}
                onClick={() =>
                  y({
                    type: "CONFIRM_SHUFFLE",
                  })
                }
              >
                シャッフル実行 <Shuffle size={14} />
              </button>
              <button
                className="btn btn-ghost"
                onClick={() =>
                  y({
                    type: "CANCEL_SELECTION",
                  })
                }
              >
                やめる
              </button>
            </div>
          )}
          {!Pl && x && a.selectedId && (
            <div className="action-bar">
              <button
                className="btn btn-ghost"
                onClick={() =>
                  y({
                    type: "VIEW_LOG",
                    id: a.selectedId,
                  })
                }
              >
                この駒の行動ログを見る
              </button>
            </div>
          )}
          {!Pl &&
            x &&
            a.extraMoveFor &&
            (() => {
              let E = a.pieces[a.extraMoveFor],
                U = E && E.rank === "A";
              return (
                <div className="action-bar">
                  <span>{U ? "王(A)はもう一度入れ替えられます" : "王(10)はもう一度動けます"}</span>
                  <button
                    className="btn btn-ghost"
                    onClick={() =>
                      y({
                        type: "SKIP_EXTRA_ACTION",
                      })
                    }
                  >
                    使わず手番を終える
                  </button>
                </div>
              );
            })()}
          {a.kPlacement && a.kPlacement.owner === P && <ReservePlacer state={a} dispatch={y} size={R} />}
          <CapturedRow players={a.players} dispatch={y} viewer={P} />
          <div className="resign-row">
            <button className="btn btn-ghost btn-resign" onClick={() => m(!0)}>
              <Flag size={16} /> 降参する
            </button>
          </div>
          {a.logViewerId && a.pieces[a.logViewerId] && (
            <LogViewer
              piece={a.pieces[a.logViewerId]}
              viewer={P}
              revealAll={a.phase === "gameover"}
              onClose={() =>
                y({
                  type: "CLOSE_LOG",
                })
              }
            />
          )}
          {a.phase === "gameover" && (
            <GameView
              state={a}
              network={network}
              myIdx={p}
              size={R}
              viewer={P}
              dispatch={y}
              onExit={onExit}
            />
          )}
        </div>
      </GameShell>
    );
  }
  function GameView({ state, network, myIdx, size, viewer, dispatch, onExit }) {
    let [f, o] = (0, C.useState)(!1),
      r = PLAYER_META[state.winner];
    if (f) {
      let d = viewer === 1,
        m = state.log.filter(
          (s) =>
            s.includes("撃破") ||
            s.includes("王が倒された") ||
            s.includes("道連れ") ||
            s.includes("新しい王") ||
            s.includes("入れ替えた") ||
            s.includes("投入") ||
            s.includes("降参"),
        );
      return (
        <div className="modal-overlay">
          <div className="modal-panel review-panel">
            <div className="modal-head">
              <h3
                style={{
                  color: r.color,
                }}
              >
                {network ? (state.winner === myIdx ? "あなたの勝ち!" : "あなたの負け…") : `${r.name}の勝利!`}
              </h3>
              <button className="icon-btn" onClick={() => o(!1)}>
                <Close size={18} />
              </button>
            </div>
            {state.resignedBy !== null && state.resignedBy !== void 0 && (
              <p
                className="hint"
                style={{
                  color: "var(--gold-soft)",
                }}
              >
                {PLAYER_META[state.resignedBy].name}の降参により決着しました。
              </p>
            )}
            <p className="hint">最終盤面(すべての駒を公開)。駒をタップすると、その駒の動きを追えます。</p>
            <div className="board-outer">
              <div
                className="board-grid"
                style={{
                  gridTemplateColumns: `repeat(${size},1fr)`,
                }}
              >
                {Array.from({
                  length: size,
                }).map((s, v) =>
                  Array.from({
                    length: size,
                  }).map((p, w) => {
                    let z = d ? size - 1 - v : v,
                      g = d ? size - 1 - w : w,
                      A = state.board[z][g],
                      b = territoryOwnerOf(z, g, size);
                    return (
                      <div
                        className={`cell ${b !== null ? `zone-${b}` : ""}`}
                        onClick={() => {
                          A &&
                            dispatch({
                              type: "VIEW_LOG",
                              id: A.id,
                            });
                        }}
                        key={`${z}-${g}`}
                      >
                        {A && (
                          <div className="piece-wrap">
                            <CardFace
                              rank={A.rank}
                              suit={A.suit}
                              size={size >= 9 ? "xs" : "md"}
                              isKing={A.isKing}
                            />
                            {A.isKing && (
                              <Crown
                                size={size >= 9 ? 10 : 16}
                                className="king-badge"
                                style={{
                                  color: PLAYER_META[A.owner].color,
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }),
                )}
              </div>
            </div>
            <div className="review-lost">
              {state.players.map((s, v) => (
                <div className="captured-col" key={v}>
                  <div
                    className="captured-label"
                    style={{
                      color: PLAYER_META[v].color,
                    }}
                  >
                    {shortPlayerLabel(v, viewer)}({PLAYER_META[v].name})が失った駒
                  </div>
                  <div className="captured-cards">
                    {s.capturedOwn
                      .filter((p) => !p.alive)
                      .map((p) => (
                        <div
                          className="captured-card"
                          onClick={() =>
                            dispatch({
                              type: "VIEW_LOG",
                              id: p.id,
                            })
                          }
                          key={p.id}
                        >
                          <CardFace rank={p.rank} suit={p.suit} size="sm" />
                        </div>
                      ))}
                    {s.capturedOwn.filter((p) => !p.alive).length === 0 && <span className="hint">なし</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="review-log">
              <div className="tray-label">対局の記録</div>
              <ol className="log-list">
                {m.length ? (
                  m.map((s, v) => <li key={v}>{s}</li>)
                ) : (
                  <li>特筆すべき出来事はありませんでした</li>
                )}
              </ol>
            </div>
            <div className="setup-actions">
              <button className="btn btn-ghost" onClick={() => o(!1)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="modal-overlay">
        <div className="modal-panel gameover-panel">
          <Crown
            size={34}
            style={{
              color: "var(--gold)",
            }}
          />
          <h2
            style={{
              color: r.color,
            }}
          >
            {network ? (state.winner === myIdx ? "あなたの勝ち!" : "あなたの負け…") : `${r.name}の勝利!`}
          </h2>
          {state.resignedBy !== null && state.resignedBy !== void 0 && (
            <p
              className="hint"
              style={{
                marginTop: -6,
              }}
            >
              {PLAYER_META[state.resignedBy].name}が降参しました
            </p>
          )}
          <div className="king-card win-card">
            <img src={winKingCardImg} alt="" />
          </div>
          <div
            className="setup-actions"
            style={{
              marginTop: 16,
            }}
          >
            <button className="btn btn-primary" onClick={() => o(!0)}>
              <Info size={16} /> 対局を振り返る
            </button>
          </div>
          <div
            className="setup-actions"
            style={{
              marginTop: 10,
            }}
          >
            {!network || myIdx === 0 ? (
              <button
                className="btn btn-ghost"
                onClick={() =>
                  dispatch({
                    type: "NEW_GAME",
                  })
                }
              >
                <RotateCcw size={16} /> もう一度遊ぶ
              </button>
            ) : (
              <p className="hint">ホストがもう一度遊ぶか選んでいます…</p>
            )}
            {onExit && (
              <button className="btn btn-ghost" onClick={onExit}>
                タイトルに戻る
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  function findHandCard(e, t) {
    return e.hand.find((l) => l.id === t);
  }
  function territoryOwnerOf(e, t, l) {
    let n = territoryRows(l, 0),
      a = territoryRows(l, 1);
    return e >= n[0] && e <= n[1] ? 0 : e >= a[0] && e <= a[1] ? 1 : null;
  }
  function PlaceStep({ state, player, pIdx, size, dispatch }) {
    let [u, i] = (0, C.useState)(null),
      f = totalSlots(size),
      [o, r] = territoryRows(size, pIdx),
      d = state.setupPlacement,
      m = new Set(Object.keys(d)),
      s = m.size,
      v = player.hand
        .filter((z) => !m.has(z.id))
        .sort((z, g) => {
          let A = RANKS.indexOf(z.rank) - RANKS.indexOf(g.rank);
          return A !== 0 ? A : SUITS.indexOf(z.suit) - SUITS.indexOf(g.suit);
        }),
      p = pIdx === 1;
    function w(z, g, A, b) {
      A &&
        (u
          ? (dispatch({
              type: "SETUP_PLACE_CARD",
              cardId: u,
              row: z,
              col: g,
            }),
            i(null))
          : b && i(b));
    }
    return (
      <div className="setup-wrap">
        <h2
          style={{
            color: PLAYER_META[pIdx].color,
          }}
        >
          {PLAYER_META[pIdx].name}: カードを盤面に配置してね
        </h2>
        <p className="hint">
          手札(または盤上の駒)をタップして選び、自陣のマスをタップして置いてください。ちょうど{f}
          枚を配置します({s}/{f})。
        </p>
        <div className="arrange-layout">
          <div
            className="mini-board"
            style={{
              gridTemplateColumns: `repeat(${size},1fr)`,
            }}
          >
            {Array.from({
              length: size,
            }).map((z, g) =>
              Array.from({
                length: size,
              }).map((A, b) => {
                let y = p ? size - 1 - g : g,
                  T = p ? size - 1 - b : b,
                  R = y >= o && y <= r,
                  P = Object.keys(d).find((N) => d[N].row === y && d[N].col === T),
                  x = P ? findHandCard(player, P) : null;
                return (
                  <div
                    className={`mini-cell ${R ? "mini-cell-zone" : ""} ${u && R ? "mini-cell-open" : ""}`}
                    onClick={() => w(y, T, R, P)}
                    key={`${y}-${T}`}
                  >
                    {x && (
                      <div className={`mini-piece ${u === P ? "piece-selected" : ""}`}>
                        <CardFace rank={x.rank} suit={x.suit} size="sm" />
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>
        {u && m.has(u) && (
          <button
            className="btn btn-ghost"
            style={{
              marginBottom: 12,
            }}
            onClick={() => {
              (dispatch({
                type: "SETUP_UNPLACE_CARD",
                cardId: u,
              }),
                i(null));
            }}
          >
            この駒を手札に戻す
          </button>
        )}
        <div className="tray">
          <div className="tray-label">手札({v.length}枚)</div>
          <div className="tray-row">
            {v.length === 0 && <span className="hint">手札を全て配置しました</span>}
            {v.map((z) => (
              <div
                className={`hand-card ${u === z.id ? "hand-card-selected" : ""}`}
                onClick={() => i(u === z.id ? null : z.id)}
                key={z.id}
              >
                <CardFace rank={z.rank} suit={z.suit} />
              </div>
            ))}
          </div>
        </div>
        <div className="setup-actions">
          <button
            className="btn btn-ghost"
            onClick={() =>
              dispatch({
                type: "SETUP_AUTO_ARRANGE",
              })
            }
          >
            <Grid size={16} /> 自動配置
          </button>
          <button
            className="btn btn-primary"
            disabled={s !== f}
            onClick={() =>
              dispatch({
                type: "SETUP_GOTO_KING_STEP",
              })
            }
          >
            <Crown size={16} /> 王を選ぶ
          </button>
        </div>
      </div>
    );
  }
  function KingStep({ state, player, pIdx, size, dispatch }) {
    let u = state.setupPlacement,
      [i, f] = territoryRows(size, pIdx),
      o = Object.keys(u).some((d) => findHandCard(player, d).rank === "K"),
      r = pIdx === 1;
    return (
      <div className="setup-wrap">
        <h2
          style={{
            color: PLAYER_META[pIdx].color,
          }}
        >
          {PLAYER_META[pIdx].name}: どのカードを王にするか決めてね
        </h2>
        <p className="hint">
          {o
            ? "Kを配置しているので、Kが王になります。"
            : "配置したカードの中から王にする1枚をタップしてください。"}
        </p>
        <div className="arrange-layout">
          <div
            className="mini-board"
            style={{
              gridTemplateColumns: `repeat(${size},1fr)`,
            }}
          >
            {Array.from({
              length: size,
            }).map((d, m) =>
              Array.from({
                length: size,
              }).map((s, v) => {
                let p = r ? size - 1 - m : m,
                  w = r ? size - 1 - v : v,
                  z = p >= i && p <= f,
                  g = Object.keys(u).find((y) => u[y].row === p && u[y].col === w),
                  A = g ? findHandCard(player, g) : null,
                  b = A && (!o || A.rank === "K");
                return (
                  <div
                    className={`mini-cell ${z ? "mini-cell-zone" : ""}`}
                    onClick={() => {
                      b &&
                        dispatch({
                          type: "SETUP_PICK_KING",
                          cardId: g,
                        });
                    }}
                    key={`${p}-${w}`}
                  >
                    {A && (
                      <div
                        className={`mini-piece ${state.setupPickKing === g ? "piece-selected" : ""} ${b ? "" : "mini-piece-disabled"}`}
                      >
                        <CardFace rank={A.rank} suit={A.suit} size="sm" isKing={state.setupPickKing === g} />
                        {state.setupPickKing === g && <Crown size={12} className="king-badge" />}
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>
        <div className="setup-actions">
          <button
            className="btn btn-ghost"
            onClick={() =>
              dispatch({
                type: "SETUP_BACK_TO_PLACE",
              })
            }
          >
            <ArrowLeft size={16} /> 配置に戻る
          </button>
          <button
            className="btn btn-primary"
            disabled={!state.setupPickKing}
            onClick={() =>
              dispatch({
                type: "SETUP_CONFIRM",
              })
            }
          >
            <Crown size={16} /> 布陣を確定
          </button>
        </div>
      </div>
    );
  }
  function ReservePlacer({ state, dispatch, size }) {
    let n = state.kPlacement.owner,
      [a, u] = territoryRows(size, n),
      i = n === 1;
    return (
      <div className="modal-overlay">
        <div className="modal-panel">
          <h3>予備札を配置</h3>
          <p className="hint">Kの効果で引いた1枚。自陣の空きマスに配置できます。</p>
          <CardGuide rank={state.kPlacement.card.rank} suit={state.kPlacement.card.suit} />
          <div
            className="mini-board"
            style={{
              gridTemplateColumns: `repeat(${size},1fr)`,
            }}
          >
            {Array.from({
              length: size,
            }).map((f, o) =>
              Array.from({
                length: size,
              }).map((r, d) => {
                let m = i ? size - 1 - o : o,
                  s = i ? size - 1 - d : d,
                  v = m >= a && m <= u,
                  p = state.board[m][s];
                return (
                  <div
                    className={`mini-cell ${v && !p ? "mini-cell-zone mini-cell-open" : ""}`}
                    onClick={() => {
                      v &&
                        !p &&
                        dispatch({
                          type: "PLACE_RESERVE_CARD",
                          row: m,
                          col: s,
                        });
                    }}
                    key={`${m}-${s}`}
                  >
                    {p && (
                      <div className="mini-piece">
                        <CardBack colorHex={PLAYER_META[p.owner].color} size="sm" />
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
          <button
            className="btn btn-ghost"
            onClick={() =>
              dispatch({
                type: "SKIP_RESERVE_PLACEMENT",
              })
            }
          >
            今回は見送る
          </button>
        </div>
      </div>
    );
  }
  function TurnBar({ state, viewer }) {
    let l = PLAYER_META[state.currentTurn],
      n = state.currentTurn === viewer;
    return (
      <div className="turn-bar">
        <span
          className="turn-dot"
          style={{
            background: l.color,
          }}
        />
        <span
          style={{
            color: l.color,
            fontWeight: 700,
          }}
        >
          {n ? `あなた(${l.name})の番です` : `相手(${l.name})の番です`}
        </span>
        <span className="turn-log">{state.log[state.log.length - 1]}</span>
      </div>
    );
  }
  function CapturedRow({ players, dispatch, viewer }) {
    let [n, a] = (0, C.useState)(!1),
      u = players.some((i) => i.discard && i.discard.length > 0);
    return (
      <>
        <div className="captured-row">
          {players.map((i, f) => (
            <div className="captured-col" key={f}>
              <div
                className="captured-label"
                style={{
                  color: PLAYER_META[f].color,
                }}
              >
                {shortPlayerLabel(f, viewer)}({PLAYER_META[f].name})が失った駒
              </div>
              <div className="captured-cards">
                {i.capturedOwn
                  .filter((o) => !o.alive)
                  .map((o) => (
                    <div
                      className="captured-card"
                      onClick={() =>
                        dispatch({
                          type: "VIEW_LOG",
                          id: o.id,
                        })
                      }
                      key={o.id}
                    >
                      <CardFace rank={o.rank} suit={o.suit} size="sm" />
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
        {u && (
          <div className="discard-toggle-wrap">
            <button className="btn btn-ghost" onClick={() => a((i) => !i)}>
              {n ? "引き直しの捨て札を隠す" : "引き直しの捨て札を見る"}
            </button>
            {n && (
              <div className="discard-both">
                {players.map((i, f) => (
                  <DiscardPanel
                    cards={i.discard}
                    label={`${shortPlayerLabel(f, viewer)}(${PLAYER_META[f].name})が捨てたカード`}
                    color={PLAYER_META[f].color}
                    key={f}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </>
    );
  }
  function ResignConfirm({ onCancel, onResign, viewer }) {
    let n = PLAYER_META[viewer];
    return (
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal-panel gameover-panel" onClick={(a) => a.stopPropagation()}>
          <Flag
            size={30}
            style={{
              color: "var(--gold)",
            }}
          />
          <h3
            style={{
              margin: "8px 0 10px",
            }}
          >
            降参しますか?
          </h3>
          <p className="hint">
            <b
              style={{
                color: n.color,
              }}
            >
              あなた({n.name})
            </b>
            の負けとして、この対局が終わります。
          </p>
          <div
            className="setup-actions"
            style={{
              marginTop: 16,
              flexDirection: "column",
            }}
          >
            <button className="btn btn-primary" onClick={onCancel}>
              対局を続ける
            </button>
            <button className="btn btn-ghost" onClick={onResign}>
              <Flag size={16} /> 降参する
            </button>
          </div>
        </div>
      </div>
    );
  }
  function QuitConfirm({ onCancel, onQuit, network }) {
    return (
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal-panel gameover-panel" onClick={(n) => n.stopPropagation()}>
          <h3
            style={{
              margin: "0 0 10px",
            }}
          >
            対局をやめますか?
          </h3>
          <p className="hint">
            今の対局は最初からやり直しになります。
            {network && (
              <>
                <br />
                オンライン対戦の場合、相手の画面はそのまま残ります。
              </>
            )}
          </p>
          <div
            className="setup-actions"
            style={{
              marginTop: 16,
              flexDirection: "column",
            }}
          >
            <button className="btn btn-primary" onClick={onCancel}>
              対局を続ける
            </button>
            <button className="btn btn-ghost" onClick={onQuit}>
              <ArrowLeft size={16} /> やめてタイトルに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }
  function SettingsModal({ onClose }) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-panel" onClick={(t) => t.stopPropagation()}>
          <div className="modal-head">
            <h3>設定</h3>
            <button className="icon-btn" onClick={onClose}>
              <Close size={18} />
            </button>
          </div>
          <div className="settings-list">
            <div className="settings-row">
              <span>ゲームの版</span>
              <b>{VERSION}</b>
            </div>
            <div className="settings-row">
              <span>ルールの確認</span>
              <b>右上の「i」から見られます</b>
            </div>
            <div className="settings-row">
              <span>通信</span>
              <b>オンライン対戦に対応</b>
            </div>
          </div>
          <p
            className="hint"
            style={{
              marginTop: 14,
            }}
          >
            音量や表示の調整は今後追加する予定です。
          </p>
          <button
            className="btn btn-primary"
            style={{
              marginTop: 10,
            }}
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }
  function GameShell({ children, showRules, setShowRules, netInfo, onBack, title }) {
    let [i, f] = (0, C.useState)(!1);
    return (
      <div className="tottery-root">
        <style>{STYLES}</style>
        <header className="top-bar">
          <div className="top-left">
            {onBack ? (
              <button className="icon-btn plain" onClick={onBack} aria-label="戻る">
                <ArrowLeft size={20} />
              </button>
            ) : (
              <Crown
                size={20}
                style={{
                  color: "var(--gold)",
                }}
              />
            )}
          </div>
          <span className="brand">{title || "トッタリー"}</span>
          <div className="top-right">
            <button className="icon-btn" onClick={() => setShowRules(!0)} aria-label="カード早見表">
              <Info size={18} />
            </button>
            <button className="icon-btn" onClick={() => f(!0)} aria-label="設定">
              <Settings size={18} />
            </button>
          </div>
        </header>
        {i && <SettingsModal onClose={() => f(!1)} />}
        <main className="stage">{children}</main>
        {showRules && <RulesPanel onClose={() => setShowRules(!1)} />}
        <div className="build-tag">
          {netInfo && <span className="net-tag">{netInfo} · </span>}build: {VERSION}
        </div>
      </div>
    );
  }
  function HomeScreen({ onStart }) {
    return (
      <div className="intro title-hero">
        <img className="title-bg" src={titleBgImg} alt="" draggable="false" />
        <button className="btn btn-primary btn-large intro-start" onClick={onStart}>
          ゲームスタート <ArrowRight size={18} />
        </button>
      </div>
    );
  }
  function MatchingScreen({ onOnline, onFriend, onCpu }) {
    return (
      <div className="center-stage">
        <h2>対戦相手を選ぶ</h2>
        <div className="nav-stack">
          <button className="btn btn-primary btn-choice" onClick={onOnline}>
            <Globe size={30} />
            <span className="choice-label">
              オンラインでマッチする<small>世界中のプレイヤーと対戦</small>
            </span>
          </button>
          <button className="btn btn-friend btn-choice" onClick={onFriend}>
            <Users size={30} />
            <span className="choice-label">
              フレンドとマッチする<small>友達とルーム対戦</small>
            </span>
          </button>
          <button className="btn btn-teal btn-choice" onClick={onCpu}>
            <Crown size={30} />
            <span className="choice-label">
              CPUと対戦する<small>ひとりで練習・腕試し</small>
            </span>
          </button>
        </div>
      </div>
    );
  }
  function RandomMatchScreen({ onBack, onRoomReady }) {
    let [l, n] = (0, C.useState)("searching"),
      [a, u] = (0, C.useState)(""),
      i = (0, C.useRef)(makeClientId()),
      f = (0, C.useRef)(null),
      o = (0, C.useRef)(!1);
    return (
      (0, C.useEffect)(() => {
        if (l !== "waiting") return;
        let r = setInterval(async () => {
          let d = f.current;
          if (!d) return;
          let m = await readLobbyPath(`/${d}/guest`);
          if (!o.current && m.ok && m.data) {
            clearInterval(r);
            let s = f.current;
            (deleteLobbyPath(`/${d}`),
              onRoomReady({
                code: s,
                myPlayerIndex: 0,
              }));
          }
        }, 1500);
        return () => clearInterval(r);
      }, [l]),
      (0, C.useEffect)(
        () => () => {
          ((o.current = !0), f.current && deleteLobbyPath(`/${f.current}`));
        },
        [],
      ),
      (0, C.useEffect)(() => {
        (async () => {
          let r = i.current,
            d = await readLobby();
          if (o.current) return;
          if (!d.ok) {
            (u(d.error), n("error"));
            return;
          }
          let m = Date.now(),
            s = Object.entries(d.data || {})
              .filter(([z, g]) => g && !g.guest && g.host !== r && m - (g.createdAt || 0) < LOBBY_TTL)
              .sort((z, g) => (g[1].createdAt || 0) - (z[1].createdAt || 0));
          for (let [z] of s) {
            let g = await writeLobby(`/${z}/guest`, r);
            if (o.current) return;
            if (!g.ok) continue;
            let A = await readLobbyPath(`/${z}/guest`);
            if (o.current) return;
            if (A.ok && A.data === r) {
              let b = await readRoom(z);
              if (o.current) return;
              if (!b.ok) {
                (u(b.error), n("error"));
                return;
              }
              if (
                (await writeRoom(z, {
                  ...(b.data || {}),
                  guestPresent: !0,
                }),
                o.current)
              )
                return;
              onRoomReady({
                code: z,
                myPlayerIndex: 1,
              });
              return;
            }
          }
          let v = generateRoomCode() + generateRoomCode(),
            p = await writeRoom(v, {
              guestPresent: !1,
              gameState: null,
            });
          if (o.current) return;
          if (!p.ok) {
            (u(p.error), n("error"));
            return;
          }
          let w = await writeLobby(`/${v}`, {
            host: r,
            guest: null,
            createdAt: Date.now(),
          });
          if (!o.current) {
            if (!w.ok) {
              (u(w.error), n("error"));
              return;
            }
            ((f.current = v), n("waiting"));
          }
        })();
      }, []),
      l === "error" ? (
        <div className="center-stage">
          <h2>マッチングできませんでした</h2>
          <p
            className="hint"
            style={{
              color: "#e2896f",
            }}
          >
            {a}
          </p>
          <button className="btn btn-ghost" onClick={onBack}>
            マッチング画面に戻る
          </button>
        </div>
      ) : (
        <div className="center-stage">
          <Dice size={32} className="dim-icon spin-icon" />
          <h2>{l === "searching" ? "対戦相手を探しています…" : "対戦相手を待っています…"}</h2>
          <p className="hint">
            {l === "searching"
              ? "待機中のプレイヤーがいないか確認しています。"
              : "あなたは待機中です。誰かが参加すると自動的に始まります。"}
          </p>
          <button
            className="btn btn-ghost"
            style={{
              marginTop: 18,
            }}
            onClick={onBack}
          >
            やめる
          </button>
        </div>
      )
    );
  }
  function RulesSelectScreen({ onStart, onBack, backLabel, note }) {
    let [a, u] = (0, C.useState)(5);
    return (
      <div className="setup-wrap">
        <h2>ルール設定</h2>
        <div className="rule-section">
          <div className="rule-section-label">ルール</div>
          <div className="nav-stack">
            <button className="btn btn-primary btn-choice" disabled={!0}>
              <Check size={18} />
              <span className="choice-label">
                クラシック<small>基本ルールで対戦します</small>
              </span>
            </button>
            <button className="btn btn-ghost" disabled={!0} title="開発中">
              詳細設定(開発中)
            </button>
          </div>
        </div>
        <div className="rule-section">
          <div className="rule-section-label">盤面のサイズ</div>
          <div className="size-choices">
            {[5, 9].map((i) => (
              <button className={`board-choice ${a === i ? "active" : ""}`} onClick={() => u(i)} key={i}>
                <div
                  className="board-choice-grid"
                  style={{
                    gridTemplateColumns: `repeat(${i},1fr)`,
                  }}
                >
                  {Array.from({
                    length: i * i,
                  }).map((f, o) => (
                    <span key={o} />
                  ))}
                </div>
                <span>
                  {i}×{i}
                </span>
                <small>{i === 5 ? "5枚で戦う短期戦" : "9枚で戦う本格戦"}</small>
              </button>
            ))}
          </div>
        </div>
        {note && <p className="hint">{note}</p>}
        <div className="setup-actions">
          <button className="btn btn-ghost" onClick={onBack}>
            <ArrowLeft size={18} /> {backLabel}
          </button>
          <button className="btn btn-primary" onClick={() => onStart(a)}>
            <Play size={16} /> ゲームを始める
          </button>
        </div>
      </div>
    );
  }
  function RoomScreen({ onOfflineLocal, onRoomReady, onBackToMatching, onBeforeRoom, autoCreate }) {
    let [u, i] = (0, C.useState)(null),
      [f, o] = (0, C.useState)(""),
      [r, d] = (0, C.useState)(""),
      [m, s] = (0, C.useState)(""),
      [v, p] = (0, C.useState)(!1),
      [w, z] = (0, C.useState)("checking"),
      [g, A] = (0, C.useState)("");
    (0, C.useEffect)(() => {
      let P = !1;
      return (
        (async () => {
          let x = `diag${Date.now()}`,
            N = await writeRoom(x, {
              test: !0,
            });
          if (P) return;
          if (!N.ok) {
            (z("fail"), A(N.error));
            return;
          }
          let M = await readRoom(x);
          if (!P) {
            if (!M.ok) {
              (z("fail"), A(M.error));
              return;
            }
            (deleteRoom(x), z("ok"));
          }
        })(),
        () => {
          P = !0;
        }
      );
    }, []);
    let b = (0, C.useRef)(!1);
    ((0, C.useEffect)(() => {
      !autoCreate || b.current || w !== "ok" || ((b.current = !0), y());
    }, [autoCreate, w]),
      (0, C.useEffect)(() => {
        if (u !== "waitingHost") return;
        let P = !1,
          x = setInterval(async () => {
            let N = await readRoom(f);
            if (!P) {
              if (!N.ok) {
                s(N.error);
                return;
              }
              N.data &&
                N.data.guestPresent &&
                (clearInterval(x),
                onRoomReady({
                  code: f,
                  myPlayerIndex: 0,
                }));
            }
          }, 1200);
        return () => {
          ((P = !0), clearInterval(x));
        };
      }, [u, f]));
    async function y() {
      (p(!0), s(""));
      let P = generateRoomCode(),
        x = await writeRoom(P, {
          guestPresent: !1,
          gameState: null,
        });
      if ((p(!1), !x.ok)) {
        s(x.error);
        return;
      }
      (o(P), i("waitingHost"));
    }
    async function T() {
      let P = r.trim().toUpperCase();
      if (P.length < 4) {
        s("4桁のコードを入力してください");
        return;
      }
      (p(!0), s(""));
      let x = await readRoom(P);
      if (!x.ok) {
        (p(!1), s(x.error));
        return;
      }
      if (!x.data) {
        (p(!1), s("そのコードのルームは見つかりませんでした"));
        return;
      }
      if (x.data.guestPresent) {
        (p(!1), s("このルームは既に対戦相手が参加済みです"));
        return;
      }
      let N = await writeRoom(P, {
        ...x.data,
        guestPresent: !0,
      });
      if ((p(!1), !N.ok)) {
        s(N.error);
        return;
      }
      onRoomReady({
        code: P,
        myPlayerIndex: 1,
      });
    }
    function R() {
      (f && deleteRoom(f), o(""), s(""), i(null));
    }
    return u === "waitingHost" ? (
      <div className="center-stage">
        <Users size={28} className="dim-icon" />
        <h2>ルームを作成しました</h2>
        <div className="room-code">{f}</div>
        <p className="hint">この4桁のコードを相手に伝えてください。相手が参加すると自動的に始まります。</p>
        <Dice size={22} className="dim-icon spin-icon" />
        {m && (
          <p
            className="hint"
            style={{
              color: "#e2896f",
            }}
          >
            {m}
          </p>
        )}
        <div
          className="nav-stack"
          style={{
            marginTop: 20,
          }}
        >
          <button className="btn btn-ghost" onClick={R}>
            ルームを取り消す
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              (R(), onBackToMatching());
            }}
          >
            マッチング画面に戻る
          </button>
        </div>
      </div>
    ) : (
      <div className="setup-wrap friend-wrap">
        <div className="friend-head">
          <Users
            size={44}
            style={{
              color: "var(--gold)",
            }}
          />
          <h2
            style={{
              margin: "10px 0 8px",
            }}
          >
            フレンド対戦
          </h2>
          <p
            className="hint"
            style={{
              margin: 0,
            }}
          >
            ルームを作成して合言葉を共有するか、
            <br />
            合言葉を入力して参加できます。
          </p>
        </div>
        <div className={`conn-badge conn-${w}`}>
          <span className="conn-dot" />
          接続状態:{w === "ok" ? "オンライン" : w === "checking" ? "確認中…" : "利用できません"}
        </div>
        {w === "fail" && (
          <p
            className="hint"
            style={{
              color: "#e08b7a",
            }}
          >
            {g}
          </p>
        )}
        <button className="btn btn-primary btn-wide" disabled={v || w !== "ok"} onClick={onBeforeRoom}>
          <DoorOut size={22} /> ルームを作る
        </button>
        <div className="code-row">
          <div
            className="code-boxes"
            onClick={() => {
              let P = document.getElementById("code-input");
              P && P.focus();
            }}
          >
            {[0, 1, 2, 3].map((P) => (
              <div className={`code-box ${r.length === P ? "code-box-active" : ""}`} key={P}>
                {r[P] || <span className="code-placeholder">—</span>}
              </div>
            ))}
            <input
              id="code-input"
              className="code-hidden"
              value={r}
              maxLength={4}
              onChange={(P) => d(P.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              inputMode="text"
              autoComplete="off"
            />
          </div>
          <button className="btn btn-ghost code-join" disabled={v || w !== "ok"} onClick={T}>
            <DoorIn size={18} /> {v ? "参加中…" : "参加する"}
          </button>
        </div>
        <p className="code-note">
          <Info size={14} /> 4文字の合言葉を入力してください。
        </p>
        {m && (
          <p
            className="hint"
            style={{
              color: "#e08b7a",
            }}
          >
            {m}
          </p>
        )}
        <button className="btn btn-teal btn-wide" onClick={onOfflineLocal}>
          <Users size={20} /> オフラインで対戦(2人)
        </button>
        <button
          className="btn btn-ghost btn-wide"
          style={{
            marginTop: 12,
          }}
          onClick={onBackToMatching}
        >
          <ArrowLeft size={18} /> メインメニューへ戻る
        </button>
      </div>
    );
  }
  function TotteryApp() {
    let [e, t] = (0, C.useState)("home"),
      [l, n] = (0, C.useState)(!1),
      [a, u] = (0, C.useState)(null),
      [i, f] = (0, C.useState)(5),
      [o, r] = (0, C.useState)("game"),
      [d, m] = (0, C.useState)(!1);
    function s() {
      (u(null), m(!1), t("home"));
    }
    function v(b) {
      (u(b), t("game"));
    }
    let [p, w] = (0, C.useState)(!1);
    function z(b) {
      (f(b), o === "room" && w(!0), t(o));
    }
    if (e === "game") return <GameCore network={a} boardSize={i} cpu={d} onExit={s} />;
    let g = o === "online" || o === "room" ? "matching" : "room";
    return (
      <GameShell showRules={l} setShowRules={n}>
        {
          {
            home: <HomeScreen onStart={() => t("matching")} />,
            matching: (
              <MatchingScreen
                onOnline={() => {
                  (u(null), m(!1), r("online"), t("rules"));
                }}
                onFriend={() => {
                  (u(null), m(!1), t("room"));
                }}
                onCpu={() => {
                  (u(null), m(!0), r("game"), t("rules"));
                }}
              />
            ),
            online: <RandomMatchScreen onBack={() => t("matching")} onRoomReady={v} />,
            room: (
              <RoomScreen
                autoCreate={p}
                onOfflineLocal={() => {
                  (w(!1), u(null), m(!1), r("game"), t("rules"));
                }}
                onBeforeRoom={() => {
                  (r("room"), t("rules"));
                }}
                onRoomReady={v}
                onBackToMatching={() => {
                  (w(!1), t("matching"));
                }}
              />
            ),
            rules: (
              <RulesSelectScreen
                onStart={z}
                onBack={() => t(g)}
                backLabel="戻る"
                note={
                  o === "online"
                    ? "この設定で対戦相手を探します。相手が先に待っていた場合は、相手の設定が使われます。"
                    : o === "room"
                      ? "この設定でルームを作ります。"
                      : null
                }
              />
            ),
          }[e]
        }
      </GameShell>
    );
  }
  var STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');

.tottery-root{
  /* 深い紺と金を基調にした、重厚な意匠 */
  --bg:#081120; --panel:#10203a; --panel-2:#16294a; --line:rgba(212,175,55,0.22);
  --gold:#d4af37; --gold-soft:#f0d98a; --gold-deep:#8a6d1f;
  --card-face:#f7f3e8; --card-ink:#1a1a1a; --card-red:#b0202f;
  --text:#f2ead9; --text-dim:#a9b4cc;
  --p0:#c0392b; --p1:#2a6f9e;
  --btn-face:#1b3050; --btn-face-hi:#24406a; --btn-edge:rgba(212,175,55,0.45);
  background:
    radial-gradient(120% 90% at 50% 0%, #16294a 0%, #0c1a30 55%, #071120 100%);
  color:var(--text); min-height:100%;
  font-family:'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', serif;
  overflow:hidden; position:relative; min-height:100vh;
}
.tottery-root *{ box-sizing:border-box; }
.title-font{ font-family:'Shippori Mincho', serif; font-weight:800; }

.top-bar{ display:flex; align-items:center; justify-content:space-between; padding:14px 18px;
  border-bottom:1px solid var(--line); background:linear-gradient(180deg, rgba(8,17,32,0.9), rgba(8,17,32,0.4)); }
.brand{ font-family:'Shippori Mincho',serif; font-weight:700; letter-spacing:0.18em;
  color:var(--gold-soft); font-size:17px;
  text-shadow:0 0 12px rgba(212,175,55,0.35); }
.brand::before, .brand::after{ content:'◆'; font-size:8px; color:var(--gold);
  vertical-align:middle; margin:0 10px; opacity:0.8; }
.icon-btn{ background:var(--btn-face); border:1px solid var(--btn-edge); color:var(--gold-soft);
  border-radius:8px; padding:6px; cursor:pointer; }
.icon-btn:hover{ color:var(--gold-soft); border-color:var(--gold); background:var(--btn-face-hi); }
.icon-btn:active{ transform:translateY(1px); }
.stage{ padding:20px; min-height:520px; display:flex; align-items:center; justify-content:center; flex-direction:column; }

/* 見出しは中央に飾り罫を添える */
h2{ font-family:'Shippori Mincho',serif; font-weight:700; letter-spacing:0.08em;
  color:var(--gold-soft); text-shadow:0 0 14px rgba(212,175,55,0.25); }
h3{ font-family:'Shippori Mincho',serif; font-weight:700; letter-spacing:0.06em; }
.setup-wrap h2, .center-stage h2{ position:relative; padding-bottom:14px; margin-bottom:10px; }
.setup-wrap h2::after, .center-stage h2::after{
  content:'❖'; position:absolute; bottom:0; left:50%; transform:translateX(-50%);
  font-size:10px; color:var(--gold); opacity:0.85; }

.intro{ text-align:center; max-width:420px; }
.intro-emblem{ font-family:'Shippori Mincho',serif; font-size:34px; color:var(--gold);
  border:2px solid var(--gold); border-radius:50%;
  width:84px; height:84px; display:flex; align-items:center; justify-content:center;
  margin:0 auto 20px; background:radial-gradient(circle,rgba(212,175,55,0.14),transparent 70%);
  box-shadow:0 0 26px rgba(212,175,55,0.3), inset 0 0 20px rgba(212,175,55,0.12); }
.king-card{ margin:6px auto 26px; width:min(52vw,210px); position:relative; }
.king-card img{ width:100%; display:block; border-radius:8px;
  box-shadow:0 0 34px rgba(212,175,55,0.45), 0 14px 30px rgba(0,0,0,0.6); }
.king-card::after{ content:''; position:absolute; left:50%; bottom:-16px;
  transform:translateX(-50%); width:70%; height:16px; border-radius:50%;
  background:radial-gradient(ellipse,rgba(212,175,55,0.35),transparent 70%); }
.intro-start{ width:min(72vw,300px); justify-content:center; }
.win-card{ width:min(40vw,140px); margin:10px auto 4px; }
.gameover-panel .setup-actions{ flex-direction:column; align-items:stretch; }
.intro h1{ font-size:42px; margin:0 0 10px; letter-spacing:0.16em; font-weight:800;
  color:var(--gold-soft); text-shadow:0 0 24px rgba(212,175,55,0.45), 0 2px 4px rgba(0,0,0,0.6); }
.subtitle{ color:var(--gold); margin-bottom:30px; font-size:15px; letter-spacing:0.14em; }
.intro-choice-label{ font-size:12px; letter-spacing:0.12em; color:var(--gold-soft); text-transform:uppercase; margin-bottom:10px; }
.intro-boards{ display:flex; gap:16px; justify-content:center; }
.board-choice{ background:linear-gradient(170deg,#152b49,#0d1c33); border:1px solid var(--line); border-radius:8px; padding:16px;
  display:flex; flex-direction:column; align-items:center; gap:10px; cursor:pointer; color:var(--text); }
.board-choice.active{ border-color:var(--gold); border-width:2px;
  box-shadow:0 0 18px rgba(212,175,55,0.25); }
.board-choice:hover{ border-color:var(--gold); }
.board-choice-grid{ display:grid; gap:2px; width:70px; height:70px; }
.board-choice-grid span{ background:var(--card-face); opacity:0.75; border-radius:0;
  box-shadow:inset 0 0 0 0.5px rgba(0,0,0,0.3); }

.center-stage{ text-align:center; }
.dim-icon{ color:var(--text-dim); margin-bottom:10px; }
.dice-row{ display:flex; gap:14px; justify-content:center; margin:18px 0; }
.dice-item{ border:1px solid; border-radius:10px; padding:10px 18px; display:flex; flex-direction:column; align-items:center; gap:4px; background:var(--panel); }
.dice-item strong{ font-size:26px; font-family:'Shippori Mincho',serif; }

.btn{ font-family:'Shippori Mincho',serif; font-weight:700; border-radius:6px;
  padding:12px 20px; cursor:pointer; letter-spacing:0.06em;
  display:inline-flex; align-items:center; gap:8px; border:1px solid transparent; font-size:15px;
  position:relative; }
.btn-primary{ background:linear-gradient(180deg,#f0d98a 0%,#d4af37 45%,#a8842a 100%);
  color:#2a1e05; border-color:#f0d98a;
  box-shadow:0 3px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.5); }
.btn-primary:hover{ filter:brightness(1.07); }
.btn-primary:active{ transform:translateY(3px); box-shadow:none; }
.btn-primary:disabled{ opacity:0.4; cursor:not-allowed; box-shadow:none; transform:none; }
.btn-ghost{ background:linear-gradient(180deg,var(--btn-face-hi),var(--btn-face));
  border:1px solid var(--btn-edge); color:var(--gold-soft);
  box-shadow:0 3px 0 rgba(0,0,0,0.35); }
.btn-ghost:hover{ border-color:var(--gold); background:var(--btn-face-hi); }
.btn-ghost:active{ transform:translateY(3px); box-shadow:none; }
.btn-ghost:disabled{ opacity:0.35; cursor:not-allowed; box-shadow:none; }
.btn-large{ padding:15px 30px; font-size:17px; }
/* 対戦相手の選択。2つを対等な選択肢として、色で役割を分ける */
.btn-friend{ background:linear-gradient(180deg,#2e6f8e,#1a4661); color:#e8f4fb;
  border-color:rgba(212,175,55,0.35); box-shadow:0 3px 0 rgba(0,0,0,0.35); }
.btn-friend:hover{ filter:brightness(1.08); }
.btn-friend:active{ transform:translateY(3px); box-shadow:none; }
.btn-choice{ padding:16px 20px; justify-content:flex-start; gap:14px; text-align:left; }
.choice-label{ display:flex; flex-direction:column; line-height:1.4; }
.choice-label small{ font-size:11px; font-weight:500; opacity:0.8; margin-top:3px;
  font-family:'Shippori Mincho',serif; }
.nav-stack{ display:flex; flex-direction:column; gap:14px; align-items:stretch;
  min-width:250px; margin-top:6px; }
.spin-icon{ animation: tottery-spin 1.1s linear infinite; }
@keyframes tottery-spin{ from{ transform:rotate(0deg); } to{ transform:rotate(360deg); } }
.room-code{ font-family:'Shippori Mincho',serif; font-size:44px; letter-spacing:0.2em;
  color:var(--gold-soft); border:2px solid var(--gold); border-radius:8px;
  padding:16px 30px; margin:16px 0; background:rgba(212,175,55,0.07);
  text-shadow:0 0 18px rgba(212,175,55,0.4); }
.room-join-row{ display:flex; gap:10px; }
.room-input{ flex:1; background:var(--card-face); border:1px solid var(--gold);
  border-radius:6px; color:#1a1a1a; padding:12px; font-size:20px;
  font-family:'Shippori Mincho',serif; letter-spacing:0.25em; text-align:center;
  text-transform:uppercase; min-width:0; font-weight:700; }
.room-input:focus{ outline:none; box-shadow:0 0 0 2px var(--gold-soft); }
.diag-line{ font-size:12px; margin-bottom:16px; }
.diag-checking{ color:var(--text-dim); }
.diag-ok{ color:#7fd4a8; }
.diag-fail{ color:#e08b7a; }

.interstitial{ display:flex; align-items:center; justify-content:center; width:100%; }
.interstitial-card{ text-align:center; background:linear-gradient(170deg,#132844,#0b1729);
  border:2px solid var(--gold); border-radius:10px; padding:36px 30px; position:relative;
  box-shadow:0 0 0 1px rgba(0,0,0,0.6), 0 10px 34px rgba(0,0,0,0.5); }
.interstitial-card::before{ content:''; position:absolute; inset:6px;
  border:1px solid rgba(212,175,55,0.35); border-radius:6px; pointer-events:none; }
.interstitial-eyebrow{ font-size:12px; letter-spacing:0.22em; color:var(--gold);
  margin-bottom:14px; border:1px solid var(--line); display:inline-block;
  padding:6px 16px; border-radius:4px; }
.interstitial-card h2{ font-family:'Shippori Mincho',serif; margin:0 0 14px; font-size:30px;
  letter-spacing:0.1em; }
.interstitial-card p{ color:var(--text-dim); font-size:13px; margin-bottom:20px; max-width:300px; }

.setup-wrap{ width:100%; max-width:620px; text-align:center; }
.setup-wrap h2{ font-family:'Shippori Mincho',serif; margin-bottom:6px; }
.hint{ color:var(--text-dim); font-size:13px; margin-bottom:16px; }
.hand-row{ display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:18px; }
.hand-split{ display:flex; flex-direction:column; gap:10px; margin-bottom:18px; }
.hand-split .hand-row{ margin-bottom:0; }
/* 狭い端末向け。カードを詰めて折り返し、はみ出さないようにする */
.hand-grid{ display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:6px;
  justify-items:center; margin-bottom:18px; }
@media (max-width:330px){ .hand-grid{ grid-template-columns:repeat(4, minmax(0,1fr)); } }
.hand-card{ cursor:pointer; border-radius:8px; padding:2px; border:2px solid transparent; transition:transform .1s; position:relative; }
.hand-card:hover{ transform:translateY(-3px); }
.hand-card-selected{ border-color:var(--gold); transform:translateY(3px); opacity:0.75; }
.discard-badge{ position:absolute; top:-6px; right:-6px; background:#d0483a; color:#fff; border-radius:50%;
  width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:11px; }
.card-face{ position:relative; border-radius:4px; overflow:hidden;
  box-shadow:0 2px 6px rgba(0,0,0,0.5); }
.card-face img{ width:100%; height:100%; object-fit:fill; display:block; }
/* 王(隊長)は縁を金色に光らせる */
.card-captain{ box-shadow:0 0 10px rgba(212,175,55,0.7); }
/* 絵柄は共通なので、赤スートだけ色味を重ねて区別する */
.card-tint{ position:absolute; inset:0; pointer-events:none;
  background:rgba(176,32,47,0.13); mix-blend-mode:multiply; }
.card-back{ position:relative; border-radius:4px; overflow:hidden;
  box-shadow:0 2px 6px rgba(0,0,0,0.5), inset 0 0 0 1px var(--pc); }
.card-back img{ width:100%; height:100%; object-fit:fill; display:block; }

.arrange-layout{ display:flex; justify-content:center; margin-bottom:14px; }
.mini-board{ display:grid; gap:0; width:min(78vw,320px); aspect-ratio:1; background:linear-gradient(160deg,#0d1c33,#091426); padding:5px; border-radius:8px;
  border:2px solid var(--gold); grid-auto-rows:minmax(0,1fr); }
.mini-cell{ background:transparent; position:relative; border:1px solid rgba(212,175,55,0.28); }
.mini-cell-zone{ background:rgba(45,105,165,0.5); cursor:pointer; }
.mini-cell-open{ background:rgba(80,200,140,0.18); }
.mini-piece{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
.mini-piece-disabled{ opacity:0.3; filter:grayscale(0.6); }
.tray{ margin-bottom:14px; }
.tray-label{ font-size:12px; color:var(--text-dim); margin-bottom:6px; }
.tray-row{ display:flex; gap:6px; justify-content:center; flex-wrap:wrap; }
.setup-actions{ display:flex; gap:10px; justify-content:center; }

.play-wrap{ width:100%; max-width:560px; }
.turn-bar{ display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:13px; }
.turn-dot{ width:9px; height:9px; border-radius:50%; }
.turn-log{ color:var(--text-dim); margin-left:auto; font-family:'IBM Plex Mono',monospace; font-size:11px; }
.board-outer{ display:flex; justify-content:center; }
/* 盤の左と下に座標の目盛りを置く。盤を反転しても正しい座標が並ぶ */
.board-frame{ display:grid; grid-template-columns:auto 1fr; grid-template-rows:1fr auto;
  gap:4px; width:min(94vw,500px); }
.rank-labels{ display:grid; grid-template-rows:repeat(var(--n),1fr); align-items:center;
  font-size:13px; color:var(--gold-soft); font-family:'Shippori Mincho',serif;
  padding:6px 5px; text-align:center; font-weight:600; }
.file-labels{ display:grid; grid-template-columns:repeat(var(--n),1fr); justify-items:center;
  grid-column:2; font-size:13px; color:var(--gold-soft); font-family:'Shippori Mincho',serif;
  padding:4px 6px 0; font-weight:600; }
.board-frame .board-grid{ width:100%; }
.board-grid{ display:grid; gap:0; width:min(90vw,480px); aspect-ratio:1;
  background:linear-gradient(160deg,#0d1c33,#091426);
  padding:5px; border-radius:8px;
  border:2px solid var(--gold); box-shadow:0 0 0 1px rgba(0,0,0,0.6), 0 6px 20px rgba(0,0,0,0.5);
  grid-auto-rows:minmax(0,1fr); }
/* セル内の駒はマス目に収める。はみ出して隣のマスに重なるのを防ぐ */
.cell > div{ display:flex; align-items:center; justify-content:center; width:100%; height:100%; }
/* マス目からはみ出さないよう、カードの表示サイズを内側に収める */
.cell .card-face, .cell .card-back{ max-width:86%; max-height:86%; }
.cell .card-face img, .cell .card-back img{ width:100%; height:100%; }
.cell{ background:transparent; display:flex; align-items:center; justify-content:center;
  cursor:pointer; position:relative; min-width:0; min-height:0;
  border:1px solid rgba(212,175,55,0.28); }
.cell.zone-0{ background:rgba(160,45,38,0.42); }
.cell.zone-1{ background:rgba(45,105,165,0.5); }
.cell-move::after{ content:''; position:absolute; width:26%; height:26%; border-radius:50%;
  background:var(--gold-soft); opacity:0.85; box-shadow:0 0 8px var(--gold); }
.cell-capture{ box-shadow:inset 0 0 0 3px #d0483a, 0 0 12px rgba(208,72,58,0.5); }
/* 直前の手。移動元は控えめに、移動先ははっきり示す */
.cell-from{ box-shadow:inset 0 0 0 2px var(--lm); opacity:0.95; }
.cell-from::after{ content:''; position:absolute; inset:22%; border-radius:50%;
  border:2px dashed var(--lm); opacity:0.55; }
.cell-to{ box-shadow:inset 0 0 0 3px var(--lm); }
.cell-to::before{ content:''; position:absolute; inset:0;
  background:var(--lm); opacity:0.16; pointer-events:none; }
/* 入れ替えが起きたマス。どの駒がどこへ移ったかは示さない */
.cell-swap{ box-shadow:inset 0 0 0 2px var(--lm); }
.cell-swap::after{ content:'⇄'; position:absolute; top:1px; right:2px;
  font-size:10px; color:var(--lm); opacity:0.85; }
.piece-wrap{ position:relative; }
.piece-selected{ outline:2px solid var(--gold-soft); border-radius:4px;
  box-shadow:0 0 14px rgba(212,175,55,0.6); }
.piece-pickable{ filter:drop-shadow(0 0 5px var(--gold-soft)); }
.king-badge{ position:absolute; top:-9px; left:50%; transform:translateX(-50%);
  background:radial-gradient(circle,#1a2b4a 60%,transparent 70%); border-radius:50%; }

.action-bar{ display:flex; align-items:center; gap:10px; justify-content:center; margin-top:12px; font-size:13px; color:var(--text-dim); flex-wrap:wrap; }
.captured-row{ display:flex; gap:16px; margin-top:16px; justify-content:center; flex-wrap:wrap; }
.captured-col{ text-align:center; }
.captured-label{ font-size:11px; margin-bottom:6px; }
.captured-cards{ display:flex; gap:4px; flex-wrap:wrap; max-width:220px; justify-content:center; }
.captured-card{ cursor:pointer; }
.discard-panel{ margin:14px 0; }
.discard-label{ font-size:12px; margin-bottom:6px; }
.discard-row{ display:flex; gap:5px; flex-wrap:wrap; justify-content:center; }
.discard-card{ opacity:0.85; }
.discard-toggle-wrap{ margin-top:14px; text-align:center; }
.resign-row{ margin-top:18px; text-align:center; }
.btn-resign{ font-size:13px; padding:9px 18px; opacity:0.8; }
.btn-resign:hover{ opacity:1; border-color:#e08b7a; color:#e8a08f; }
.discard-both{ display:flex; flex-direction:column; gap:4px; margin-top:6px; }
.log-list{ text-align:left; padding-left:20px; font-size:13px; color:var(--text-dim); line-height:1.8; margin:0; }
.log-list li{ margin-bottom:2px; }

.modal-overlay{ position:fixed; inset:0; background:rgba(8,10,22,0.72); display:flex; align-items:center; justify-content:center; z-index:50; padding:20px; }
.modal-panel{ background:linear-gradient(170deg,#132844,#0b1729); border:2px solid var(--gold); border-radius:10px; padding:24px; max-width:480px; width:100%; max-height:80vh; overflow:auto; text-align:center; }
.modal-head{ display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; text-align:left; }
.gameover-panel{ text-align:center; }
.review-panel{ max-width:520px; text-align:center; }
.review-panel .board-grid{ width:min(78vw,380px); }
.review-lost{ display:flex; gap:16px; justify-content:center; flex-wrap:wrap; margin-top:14px; }
.review-log{ margin-top:16px; text-align:left; max-height:190px; overflow:auto;
  border-top:1px solid var(--line); padding-top:10px; }
.waiting-head{ display:flex; align-items:center; gap:10px; justify-content:center; margin-bottom:16px; }
.rule-grid{ display:flex; flex-direction:column; gap:10px; text-align:left; }
.rule-row{ display:flex; gap:12px; border-bottom:1px solid var(--line); padding-bottom:10px; align-items:flex-start; }
.rule-rank{ font-family:'Shippori Mincho',serif; font-weight:700; color:var(--gold-soft); font-size:15px; text-align:center; }
.rule-diagram{ flex-shrink:0; width:76px; display:flex; flex-direction:column; align-items:center; gap:5px; }
.rule-toggle{ display:flex; gap:8px; justify-content:center; margin-bottom:12px; }
.rule-section{ margin-bottom:20px; }
.rule-section-label{ font-size:11px; letter-spacing:0.14em; color:var(--gold-soft);
  text-transform:uppercase; margin-bottom:9px; text-align:left; }
.size-choices{ display:flex; gap:12px; justify-content:center; }
.size-choices .board-choice{ flex:1; max-width:150px; }
.size-choices .board-choice small{ font-size:10px; color:var(--text-dim); }
.rule-toggle .btn{ padding:7px 14px; font-size:13px; }

/* --- 動きの図解 --- */
.move-diagram{ display:grid; gap:1px; width:70px; aspect-ratio:1; background:rgba(255,255,255,0.07);
  padding:1px; border-radius:4px; }
.md-cell{ background:rgba(12,15,30,0.85); border-radius:1px; }
.md-reach{ background:var(--gold); opacity:0.85; }
.md-me{ background:var(--text); box-shadow:0 0 0 1px var(--gold-soft); }
.card-guide{ margin:12px 0; padding:12px; border:1px solid var(--line); border-radius:10px;
  background:rgba(255,255,255,0.03); }
.card-guide-compact{ margin:8px 0 12px; padding:10px; }
.cg-head{ display:flex; gap:14px; align-items:center; justify-content:center; margin-bottom:10px; }
.cg-rank{ font-family:'Shippori Mincho',serif; font-weight:700; font-size:22px; color:var(--gold-soft); }
.cg-text{ font-size:12.5px; color:var(--text-dim); line-height:1.6; margin:0; text-align:left; }
.cg-king{ font-size:11px; color:var(--gold-soft); margin:6px 0 0; text-align:left; }
.rule-desc{ font-size:12.5px; color:var(--text-dim); line-height:1.5; }
.net-tag{ color:rgba(126,201,154,0.75); }
/* ヘッダーを3分割にして、戻る・題名・設定を配置する */
.top-left, .top-right{ display:flex; align-items:center; gap:8px; min-width:72px; }
.top-right{ justify-content:flex-end; }
.icon-btn.plain{ background:transparent; border-color:transparent; color:var(--gold); }
.icon-btn.plain:hover{ background:transparent; border-color:transparent; }
.settings-list{ text-align:left; }
.settings-row{ display:flex; justify-content:space-between; gap:12px; align-items:baseline;
  padding:10px 0; border-bottom:1px solid var(--line); font-size:13px; }
.settings-row span{ color:var(--text-dim); }
.settings-row b{ color:var(--gold-soft); font-weight:600; font-size:12px; text-align:right; }

/* フレンド対戦 */
.friend-wrap{ max-width:420px; }
.friend-head{ margin-bottom:18px; }
.conn-badge{ display:inline-flex; align-items:center; gap:9px; padding:9px 20px;
  border-radius:999px; font-size:13px; margin-bottom:20px;
  background:rgba(45,105,165,0.18); border:1px solid rgba(45,105,165,0.4); }
.conn-badge .conn-dot{ width:9px; height:9px; border-radius:50%; background:var(--text-dim); }
.conn-ok{ color:#6fd6ae; } .conn-ok .conn-dot{ background:#6fd6ae; box-shadow:0 0 8px #6fd6ae; }
.conn-checking{ color:var(--text-dim); }
.conn-fail{ color:#e08b7a; border-color:rgba(224,139,122,0.4); background:rgba(224,139,122,0.12); }
.conn-fail .conn-dot{ background:#e08b7a; }
.btn-wide{ width:100%; justify-content:center; font-size:17px; padding:16px; }
.btn-teal{ background:linear-gradient(180deg,#1c5b56,#123f3c); color:#a9ead9;
  border:1px solid rgba(111,214,174,0.4); box-shadow:0 3px 0 rgba(0,0,0,0.35); }
.btn-teal:hover{ filter:brightness(1.1); }
.btn-teal:active{ transform:translateY(3px); box-shadow:none; }
.code-row{ display:flex; gap:10px; align-items:stretch; margin:16px 0 8px; }
.code-boxes{ display:flex; gap:8px; flex:1; position:relative; cursor:text; }
.code-box{ flex:1; aspect-ratio:0.85; background:var(--card-face); border:1px solid var(--gold);
  border-radius:6px; display:flex; align-items:center; justify-content:center;
  font-size:26px; font-weight:700; color:#1a1a1a; font-family:'Shippori Mincho',serif; }
.code-box-active{ box-shadow:0 0 0 2px var(--gold-soft); }
.code-placeholder{ color:#b3ada0; font-size:20px; }
.code-hidden{ position:absolute; inset:0; opacity:0; border:0; padding:0;
  font-size:16px; cursor:text; }
.code-join{ white-space:nowrap; padding:12px 16px; }
.code-note{ display:flex; align-items:center; gap:7px; justify-content:center;
  font-size:12px; color:#6fd6ae; margin:0 0 20px; }

.build-tag{ position:absolute; bottom:4px; right:8px; font-size:9px; color:rgba(154,162,200,0.35); font-family:'IBM Plex Mono',monospace; pointer-events:none; }

/* --- サイコロ --- */
.die3d{ width:150px; height:150px; }
.die3d img{ width:100%; height:100%; object-fit:contain; display:block;
  filter:drop-shadow(0 12px 26px rgba(0,0,0,0.6)); }
.title-hero{ position:relative; width:100%; display:flex; flex-direction:column;
  align-items:center; justify-content:flex-end; }
.title-bg{ width:100%; max-width:430px; display:block; border-radius:10px; }
.title-hero .intro-start{ position:absolute; bottom:6%; left:50%;
  transform:translateX(-50%); width:min(66%,290px); }
.die-stage{ display:flex; justify-content:center; align-items:center; height:150px;
  margin:10px 0 6px; perspective:700px; }
.die{ width:96px; height:96px; border-radius:18px; padding:12px;
  background:linear-gradient(145deg,#fffdf7 0%,#f2ece0 45%,#ddd3bd 100%);
  box-shadow:0 10px 24px rgba(0,0,0,0.55),
    inset 0 -5px 10px rgba(0,0,0,0.16), inset 0 3px 5px rgba(255,255,255,0.95);
  border:1px solid rgba(0,0,0,0.18); }
.die-grid{ width:100%; height:100%; display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr); gap:3px; }
.pip{ border-radius:50%; }
.pip-on{ background:radial-gradient(circle at 35% 30%, #3a3228, #131009 70%);
  box-shadow:inset 0 1px 2px rgba(255,255,255,0.3), 0 1px 1px rgba(255,255,255,0.15); }
.die-rolling{ animation: die-tumble .5s linear infinite; }
@keyframes die-tumble{
  0%   { transform: rotateX(0deg) rotateY(0deg) translateY(0); }
  25%  { transform: rotateX(180deg) rotateY(90deg) translateY(-22px); }
  50%  { transform: rotateX(360deg) rotateY(180deg) translateY(0); }
  75%  { transform: rotateX(180deg) rotateY(270deg) translateY(-14px); }
  100% { transform: rotateX(0deg) rotateY(360deg) translateY(0); }
}
.die-result{ font-family:'Shippori Mincho',serif; font-size:22px; font-weight:700; margin:4px 0 18px;
  text-shadow:0 0 14px currentColor; }
.dice-result-row{ display:flex; gap:22px; justify-content:center; margin:16px 0 10px; }
.dice-result-item{ display:flex; flex-direction:column; align-items:center; gap:9px;
  font-size:12px; padding:12px 14px; border-radius:12px; border:1px solid transparent; }
.dice-winner{ border-color:var(--gold); background:rgba(201,162,39,0.10); }
.capture-eyebrow{ font-size:11px; letter-spacing:0.18em; color:#e0715c; margin-bottom:8px; font-weight:700; }
.capture-cards{ display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }
.capture-card{ animation: capture-pop .28s ease-out both; }
.capture-card:nth-child(2){ animation-delay:.08s; }
.capture-card:nth-child(3){ animation-delay:.16s; }
.capture-card:nth-child(4){ animation-delay:.24s; }
@keyframes capture-pop{ from{ transform:scale(.6); opacity:0; } to{ transform:scale(1); opacity:1; } }
.cell-heir{ box-shadow:inset 0 0 0 2px var(--gold-soft); cursor:pointer; }
.piece-dim{ opacity:0.35; }
`;
  var qo = rt(Zl(), 1);
  N0.default.createRoot(document.getElementById("root")).render(
    <x0.default.StrictMode>
      <TotteryApp />
    </x0.default.StrictMode>,
  );
})();
