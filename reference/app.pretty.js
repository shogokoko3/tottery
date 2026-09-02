(() => {
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
  function Tg(e, t) {
    return t == null
      ? `${H[e].name}`
      : e === t
        ? `あなた(${H[e].name})`
        : `相手(${H[e].name})`;
  }
  function Vn(e, t) {
    return t == null ? H[e].name : e === t ? "あなた" : "相手";
  }
  var d0 = {
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
    v0 = {
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
  var Yo = "https://tottery-66e0f-default-rtdb.asia-southeast1.firebasedatabase.app";
  function Xo() {
    let e = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
      t = "";
    for (let l = 0; l < 4; l++) t += e[Math.floor(Math.random() * e.length)];
    return t;
  }
  function Bo(e) {
    return `${Yo}/rooms/${e}.json`;
  }
  function Ll(e) {
    return e && e.__timeout
      ? "通信が8秒以内に応答しませんでした(タイムアウト)。通信状況を確認し、もう一度お試しください。"
      : `通信に失敗しました: ${(e && (e.message || e.toString())) || "不明なエラー"}`;
  }
  function qt(e, t) {
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
  async function Yi(e) {
    try {
      let t = await qt(fetch(Bo(e)), 8e3);
      if (!t.ok) throw new Error(`HTTP ${t.status}`);
      return { ok: !0, data: await t.json(), error: null };
    } catch (t) {
      return { ok: !1, data: null, error: Ll(t) };
    }
  }
  async function Ia(e, t) {
    try {
      let l = await qt(
        fetch(Bo(e), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(t),
        }),
        8e3,
      );
      if (!l.ok) throw new Error(`HTTP ${l.status}`);
      return { ok: !0, error: null };
    } catch (l) {
      return { ok: !1, error: Ll(l) };
    }
  }
  async function e0(e) {
    try {
      await qt(fetch(Bo(e), { method: "DELETE" }), 8e3);
    } catch {}
  }
  function m0(e) {
    return `${Yo}/rooms/${e}/acts.json`;
  }
  async function t0(e, t) {
    try {
      let l = await qt(
        fetch(m0(e), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(t),
        }),
        8e3,
      );
      if (!l.ok) throw new Error(`HTTP ${l.status}`);
      return { ok: !0, error: null };
    } catch (l) {
      return { ok: !1, error: Ll(l) };
    }
  }
  async function Hg(e) {
    try {
      let t = await qt(fetch(m0(e)), 8e3);
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
        : { ok: !0, list: [], error: null };
    } catch (t) {
      return { ok: !1, list: [], error: Ll(t) };
    }
  }
  var Cg = 180 * 1e3;
  function Qi(e = "") {
    return `${Yo}/lobby${e}.json`;
  }
  function g0() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  async function Xg() {
    try {
      let e = await qt(fetch(Qi()), 8e3);
      if (!e.ok) throw new Error(`HTTP ${e.status}`);
      return { ok: !0, data: await e.json(), error: null };
    } catch (e) {
      return { ok: !1, data: null, error: Ll(e) };
    }
  }
  async function l0(e, t) {
    try {
      let l = await qt(
        fetch(Qi(e), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(t),
        }),
        8e3,
      );
      if (!l.ok) throw new Error(`HTTP ${l.status}`);
      return { ok: !0, error: null };
    } catch (l) {
      return { ok: !1, error: Ll(l) };
    }
  }
  async function n0(e) {
    try {
      let t = await qt(fetch(Qi(e)), 8e3);
      if (!t.ok) throw new Error(`HTTP ${t.status}`);
      return { ok: !0, data: await t.json(), error: null };
    } catch (t) {
      return { ok: !1, data: null, error: Ll(t) };
    }
  }
  async function a0(e) {
    try {
      await qt(fetch(Qi(e), { method: "DELETE" }), 8e3);
    } catch {}
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
  function Ug(e, t, l) {
    return e.owner === t || !e.alive || l
      ? e.history
      : e.history.map((n) =>
          n.includes("へ移動")
            ? n
            : "何らかの効果が発生した",
        );
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
  var kg = { spade: "S", heart: "H", diamond: "D", club: "C" };
  function Dg(e, t, l) {
    let n = e + kg[t];
    return (l && Z1[n]) || q1[n];
  }
  function De({ rank: e, suit: t, size: l = "md", isKing: n = !1 }) {
    let a =
      l === "xs"
        ? { w: 26, h: 35 }
        : l === "sm"
          ? { w: 38, h: 51 }
          : l === "lg"
            ? { w: 78, h: 104 }
            : { w: 50, h: 67 };
    return (0, c.jsx)("div", {
      className: `card-face ${n ? "card-captain" : ""}`,
      style: { width: a.w, height: a.h },
      children: (0, c.jsx)("img", { src: Dg(e, t, n), alt: `${e}${Fa[t]}`, draggable: "false" }),
    });
  }
  function Qo({ colorHex: e, size: t = "md" }) {
    let l =
      t === "xs"
        ? { w: 26, h: 35 }
        : t === "sm"
          ? { w: 38, h: 51 }
          : t === "lg"
            ? { w: 78, h: 104 }
            : { w: 50, h: 67 };
    return (0, c.jsx)("div", {
      className: "card-back",
      style: { width: l.w, height: l.h, "--pc": e },
      children: (0, c.jsx)("img", { src: j1, alt: "", draggable: "false" }),
    });
  }
  function y0({ piece: e, viewer: t, isSelected: l, isPickable: n, size: a = "md" }) {
    let u = H[e.owner],
      i = e.owner === t;
    return (0, c.jsxs)("div", {
      className: `piece-wrap ${l ? "piece-selected" : ""} ${n ? "piece-pickable" : ""}`,
      children: [
        i
          ? (0, c.jsx)(De, { rank: e.rank, suit: e.suit, size: a, isKing: e.isKing })
          : (0, c.jsx)(Qo, { colorHex: u.color, size: a }),
        e.isKing &&
          i &&
          (0, c.jsx)(pt, {
            size: a === "xs" ? 10 : a === "sm" ? 12 : 16,
            className: "king-badge",
            style: { color: u.color },
          }),
      ],
    });
  }
  function Mg({ forPlayer: e, kind: t, onReady: l }) {
    let n = H[e],
      a = H[1 - e],
      u = {
        dice: "サイコロフェーズ",
        mulligan: "引き直しフェーズ",
        setup: "布陣フェーズ",
        turn: "手番交代",
      };
    return (0, c.jsx)("div", {
      className: "interstitial",
      children: (0, c.jsxs)("div", {
        className: "interstitial-card",
        children: [
          (0, c.jsx)("div", { className: "interstitial-eyebrow", children: "PASS THE DEVICE" }),
          (0, c.jsxs)("h2", { style: { color: n.color }, children: [n.name, "の番です"] }),
          (0, c.jsxs)("p", {
            children: [
              u[t] || "",
              " — ",
              (0, c.jsx)("b", { style: { color: n.color }, children: n.name }),
              "の担当者に画面を渡してください。",
              (0, c.jsx)("br", {}),
              (0, c.jsx)("b", { style: { color: a.color }, children: a.name }),
              "には見えないようにしてください。",
            ],
          }),
          (0, c.jsxs)("button", {
            className: "btn btn-primary",
            onClick: l,
            children: [(0, c.jsx)(Ho, { size: 16 }), " 準備ができた"],
          }),
        ],
      }),
    });
  }
  function Yg({ reveal: e, onClose: t, viewer: l }) {
    let n = e.defeated || [],
      a = e.capturedBy === void 0 || l === void 0 || e.capturedBy === l;
    return (0, c.jsx)("div", {
      className: "modal-overlay",
      children: (0, c.jsxs)("div", {
        className: "modal-panel gameover-panel",
        children: [
          (0, c.jsx)("div", {
            className: "capture-eyebrow",
            style: a ? void 0 : { color: "#e08b7a" },
            children: a
              ? e.surround
                ? "包囲成功!"
                : "撃破!"
              : e.surround
                ? "包囲された!"
                : "駒を取られた!",
          }),
          (0, c.jsx)("h3", {
            style: { margin: "0 0 14px" },
            children: a
              ? e.surround
                ? n.length > 1
                  ? `包囲して${n.length}枚を取りました`
                  : "包囲して相手の駒を取りました"
                : n.length > 1
                  ? `${n.length}枚の駒を取りました`
                  : "相手の駒を取りました"
              : n.length > 1
                ? `あなたの駒が${n.length}枚取られました`
                : "あなたの駒が取られました",
          }),
          (0, c.jsx)("div", {
            className: "capture-cards",
            children: n.map((u, i) =>
              (0, c.jsx)(
                "div",
                { className: "capture-card", children: (0, c.jsx)(De, { rank: u.rank, suit: u.suit }) },
                i,
              ),
            ),
          }),
          (0, c.jsxs)("button", {
            className: "btn btn-primary",
            style: { marginTop: 18 },
            onClick: t,
            children: ["確認した ", (0, c.jsx)(Hi, { size: 16 })],
          }),
        ],
      }),
    });
  }
  function Bg({ state: e, size: t, dispatch: l }) {
    let n = e.pendingKingChoice,
      a = H[n.owner];
    if (!n.acknowledged)
      return (0, c.jsx)("div", {
        className: "interstitial",
        children: (0, c.jsxs)("div", {
          className: "interstitial-card",
          children: [
            (0, c.jsx)("div", { className: "interstitial-eyebrow", children: "PASS THE DEVICE" }),
            (0, c.jsxs)("h2", {
              style: { color: a.color },
              children: [a.name, "の王が倒れました"],
            }),
            (0, c.jsxs)("p", {
              children: [
                "残っている",
                n.rank,
                "の中から、新しい王を選びます。画面を渡してください。",
              ],
            }),
            (0, c.jsxs)("button", {
              className: "btn btn-primary",
              onClick: () => l({ type: "ACK_KING_CHOICE" }),
              children: [(0, c.jsx)(Ho, { size: 16 }), " 準備ができた"],
            }),
          ],
        }),
      });
    let u = n.owner === 1;
    return (0, c.jsxs)("div", {
      className: "setup-wrap",
      children: [
        (0, c.jsx)("h2", {
          style: { color: a.color },
          children: "新しい王を選んでください",
        }),
        (0, c.jsxs)("p", {
          className: "hint",
          children: [
            "光っている",
            n.rank,
            "のうち、どれを王にするか選びます。",
          ],
        }),
        (0, c.jsx)("div", {
          className: "board-outer",
          children: (0, c.jsx)("div", {
            className: "board-grid",
            style: { gridTemplateColumns: `repeat(${t},1fr)` },
            children: Array.from({ length: t }).map((i, f) =>
              Array.from({ length: t }).map((o, r) => {
                let d = u ? t - 1 - f : f,
                  m = u ? t - 1 - r : r,
                  s = e.board[d][m],
                  v = s && n.candidateIds.includes(s.id);
                return (0, c.jsx)(
                  "div",
                  {
                    className: `cell ${v ? "cell-heir" : ""}`,
                    onClick: () => {
                      v && l({ type: "CHOOSE_HEIR", id: s.id });
                    },
                    children:
                      s &&
                      (0, c.jsx)("div", {
                        className: v ? "" : "piece-dim",
                        children: (0, c.jsx)(y0, { piece: s, viewer: n.owner, size: t >= 9 ? "xs" : "md" }),
                      }),
                  },
                  `${d}-${m}`,
                );
              }),
            ),
          }),
        }),
      ],
    });
  }
  var c0 = {
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
  function ji({ value: e, rolling: t, color: l, big: n }) {
    let a = c0[e] || c0[1];
    return t && n
      ? (0, c.jsx)("div", {
          className: "die3d die-rolling",
          style: { "--die-accent": l || "var(--gold)" },
          children: (0, c.jsx)("img", { src: O1, alt: "", draggable: "false" }),
        })
      : (0, c.jsx)("div", {
          className: `die ${t ? "die-rolling" : ""}`,
          style: { "--die-accent": l || "var(--gold)" },
          children: (0, c.jsx)("div", {
            className: "die-grid",
            children: Array.from({ length: 9 }).map((u, i) => {
              let f = Math.floor(i / 3),
                o = i % 3,
                r = a.some(([d, m]) => d === f && m === o);
              return (0, c.jsx)(
                "span",
                { className: r ? "pip pip-on" : "pip", style: r ? { background: l } : void 0 },
                i,
              );
            }),
          }),
        });
  }
  function jg({ playerIdx: e, value: t, onRoll: l, onNext: n }) {
    let [a, u] = (0, C.useState)(!1),
      [i, f] = (0, C.useState)(1),
      o = H[e];
    ((0, C.useEffect)(() => {
      if (!a) return;
      let d = setInterval(() => f(1 + Math.floor(Math.random() * 6)), 70),
        m = setTimeout(() => {
          (u(!1), l());
        }, 900);
      return () => {
        (clearInterval(d), clearTimeout(m));
      };
    }, [a]),
      (0, C.useEffect)(() => {
        t !== null && !a && f(t);
      }, [t, a]));
    let r = t !== null && !a;
    return (0, c.jsxs)("div", {
      className: "center-stage",
      children: [
        (0, c.jsxs)("h2", {
          style: { color: o.color },
          children: ["あなた(", o.name, ")のサイコロ"],
        }),
        (0, c.jsx)("div", {
          className: "die-stage",
          children: (0, c.jsx)(ji, { value: i, rolling: a, color: o.color, big: !0 }),
        }),
        r
          ? (0, c.jsxs)(c.Fragment, {
              children: [
                (0, c.jsxs)("p", {
                  className: "die-result",
                  style: { color: o.color },
                  children: [t, " が出ました"],
                }),
                (0, c.jsxs)("button", {
                  className: "btn btn-primary",
                  onClick: n,
                  children: ["次へ ", (0, c.jsx)(Ci, { size: 16 })],
                }),
              ],
            })
          : (0, c.jsx)("button", {
              className: "btn btn-primary",
              disabled: a,
              onClick: () => u(!0),
              children: a
                ? "転がしています…"
                : "サイコロを振る",
            }),
      ],
    });
  }
  function Qg() {
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
  function h0({ rank: e, isKing: t = !1, gridSize: l = 7 }) {
    let n = Math.floor(l / 2),
      a = b0(l),
      u = { id: "me", rank: e, suit: "spade", owner: 0, isKing: t, row: n, col: n, alive: !0, history: [] };
    if (((a[n][n] = u), t && ["6", "7", "8", "9"].includes(e)))
      for (let o = 0; o < l; o++)
        for (let r = 0; r < l; r++)
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
    let i = e === "A" ? [] : jo(u, a, l, { [e]: 1 }),
      f = new Set(i.map((o) => `${o.row},${o.col}`));
    return (0, c.jsx)("div", {
      className: "move-diagram",
      style: { gridTemplateColumns: `repeat(${l},1fr)` },
      children: Array.from({ length: l }).map((o, r) =>
        Array.from({ length: l }).map((d, m) => {
          let s = r === n && m === n,
            v = f.has(`${r},${m}`);
          return (0, c.jsx)(
            "span",
            { className: `md-cell ${s ? "md-me" : ""} ${v ? "md-reach" : ""}` },
            `${r}-${m}`,
          );
        }),
      ),
    });
  }
  function P0({ rank: e, suit: t, isKing: l = !1, compact: n = !1 }) {
    return (0, c.jsxs)("div", {
      className: `card-guide ${n ? "card-guide-compact" : ""}`,
      children: [
        (0, c.jsxs)("div", {
          className: "cg-head",
          children: [
            t
              ? (0, c.jsx)(De, { rank: e, suit: t })
              : (0, c.jsx)("div", { className: "cg-rank", children: e }),
            (0, c.jsx)(h0, { rank: e, isKing: l }),
          ],
        }),
        (0, c.jsx)("p", { className: "cg-text", children: d0[e] }),
        l && (0, c.jsxs)("p", { className: "cg-king", children: ["王の効果: ", v0[e]] }),
      ],
    });
  }
  function w0({ cards: e, label: t, color: l }) {
    if (!e || e.length === 0) return null;
    let n = [...e].sort((a, u) => {
      let i = ht.indexOf(a.rank) - ht.indexOf(u.rank);
      return i !== 0 ? i : Ot.indexOf(a.suit) - Ot.indexOf(u.suit);
    });
    return (0, c.jsxs)("div", {
      className: "discard-panel",
      children: [
        (0, c.jsxs)("div", {
          className: "discard-label",
          style: { color: l },
          children: [t, "(", n.length, "枚)"],
        }),
        (0, c.jsx)("div", {
          className: "discard-row",
          children: n.map((a) =>
            (0, c.jsx)(
              "div",
              {
                className: "discard-card",
                children: (0, c.jsx)(De, { rank: a.rank, suit: a.suit, size: "sm" }),
              },
              a.id,
            ),
          ),
        }),
      ],
    });
  }
  function Og({ hand: e, selected: t, onToggle: l }) {
    let n = Qg(),
      a = n >= 480,
      u = n < 380 ? "sm" : "md",
      i = [...e].sort((o, r) => {
        let d = ht.indexOf(o.rank) - ht.indexOf(r.rank);
        return d !== 0 ? d : Ot.indexOf(o.suit) - Ot.indexOf(r.suit);
      }),
      f = ({ c: o }) =>
        (0, c.jsxs)("div", {
          className: `hand-card ${t.has(o.id) ? "hand-card-selected" : ""}`,
          onClick: () => l(o.id),
          children: [
            (0, c.jsx)(De, { rank: o.rank, suit: o.suit, size: u }),
            t.has(o.id) && (0, c.jsx)("span", { className: "discard-badge", children: "✕" }),
          ],
        });
    return a
      ? (0, c.jsxs)("div", {
          className: "hand-split",
          children: [
            (0, c.jsx)("div", {
              className: "hand-row",
              children: i.slice(0, 7).map((o) => (0, c.jsx)(f, { c: o }, o.id)),
            }),
            (0, c.jsx)("div", {
              className: "hand-row",
              children: i.slice(7, 13).map((o) => (0, c.jsx)(f, { c: o }, o.id)),
            }),
          ],
        })
      : (0, c.jsx)("div", { className: "hand-grid", children: i.map((o) => (0, c.jsx)(f, { c: o }, o.id)) });
  }
  function o0({ playerIdx: e, value: t }) {
    let l = H[e],
      [n, a] = (0, C.useState)(1),
      u = t != null;
    return (
      (0, C.useEffect)(() => {
        if (u) {
          a(t);
          return;
        }
        let i = setInterval(() => a(1 + Math.floor(Math.random() * 6)), 140);
        return () => clearInterval(i);
      }, [u, t]),
      (0, c.jsxs)("div", {
        className: "center-stage",
        children: [
          (0, c.jsxs)("h2", {
            style: { color: l.color },
            children: ["相手(", l.name, ")のサイコロ"],
          }),
          (0, c.jsx)("div", {
            className: "die-stage",
            children: (0, c.jsx)(ji, { value: n, rolling: !u, color: l.color, big: !0 }),
          }),
          u
            ? (0, c.jsxs)(c.Fragment, {
                children: [
                  (0, c.jsxs)("p", {
                    className: "die-result",
                    style: { color: l.color },
                    children: [t, " が出ました"],
                  }),
                  (0, c.jsx)("p", {
                    className: "hint",
                    children:
                      "相手が次に進むのを待っています…",
                  }),
                ],
              })
            : (0, c.jsx)("p", {
                className: "hint",
                children: "相手が振っています…",
              }),
        ],
      })
    );
  }
  function Mi({ text: e, hand: t, board: l, size: n, viewer: a, placement: u, player: i }) {
    let f = t
        ? [...t].sort((r, d) => {
            let m = ht.indexOf(r.rank) - ht.indexOf(d.rank);
            return m !== 0 ? m : Ot.indexOf(r.suit) - Ot.indexOf(d.suit);
          })
        : [],
      o = a === 1;
    return (0, c.jsxs)("div", {
      className: "setup-wrap",
      children: [
        (0, c.jsxs)("div", {
          className: "waiting-head",
          children: [
            (0, c.jsx)(qn, { size: 22, className: "dim-icon spin-icon" }),
            (0, c.jsx)("p", { className: "hint", style: { margin: 0 }, children: e }),
          ],
        }),
        l &&
          (0, c.jsx)("div", {
            className: "arrange-layout",
            children: (0, c.jsx)("div", {
              className: "mini-board",
              style: { gridTemplateColumns: `repeat(${n},1fr)` },
              children: Array.from({ length: n }).map((r, d) =>
                Array.from({ length: n }).map((m, s) => {
                  let v = o ? n - 1 - d : d,
                    p = o ? n - 1 - s : s,
                    w = l[v][p],
                    z = w && w.owner === a;
                  return (0, c.jsx)(
                    "div",
                    {
                      className: "mini-cell",
                      children:
                        w &&
                        (0, c.jsxs)("div", {
                          className: "mini-piece",
                          children: [
                            z
                              ? (0, c.jsx)(De, { rank: w.rank, suit: w.suit, size: "sm" })
                              : (0, c.jsx)(Qo, { colorHex: H[w.owner].color, size: "sm" }),
                            z && w.isKing && (0, c.jsx)(pt, { size: 12, className: "king-badge" }),
                          ],
                        }),
                    },
                    `${v}-${p}`,
                  );
                }),
              ),
            }),
          }),
        u &&
          i &&
          (0, c.jsx)("div", {
            className: "arrange-layout",
            children: (0, c.jsx)("div", {
              className: "mini-board",
              style: { gridTemplateColumns: `repeat(${n},1fr)` },
              children: Array.from({ length: n }).map((r, d) =>
                Array.from({ length: n }).map((m, s) => {
                  let v = o ? n - 1 - d : d,
                    p = o ? n - 1 - s : s,
                    w = Object.keys(u).find((g) => u[g].row === v && u[g].col === p),
                    z = w ? i.hand.find((g) => g.id === w) : null;
                  return (0, c.jsx)(
                    "div",
                    {
                      className: "mini-cell",
                      children:
                        z &&
                        (0, c.jsx)("div", {
                          className: "mini-piece",
                          children: (0, c.jsx)(De, { rank: z.rank, suit: z.suit, size: "sm" }),
                        }),
                    },
                    `${v}-${p}`,
                  );
                }),
              ),
            }),
          }),
        f.length > 0 &&
          (0, c.jsxs)(c.Fragment, {
            children: [
              (0, c.jsxs)("div", {
                className: "tray-label",
                style: { marginTop: 14 },
                children: ["あなたの手札(", f.length, "枚)"],
              }),
              (0, c.jsx)("div", {
                className: "hand-grid",
                children: f.map((r) =>
                  (0, c.jsx)(
                    "div",
                    {
                      className: "hand-card",
                      children: (0, c.jsx)(De, { rank: r.rank, suit: r.suit, size: "sm" }),
                    },
                    r.id,
                  ),
                ),
              }),
            ],
          }),
      ],
    });
  }
  function r0({ text: e }) {
    return (0, c.jsxs)("div", {
      className: "center-stage",
      children: [
        (0, c.jsx)(qn, { size: 28, className: "dim-icon spin-icon" }),
        (0, c.jsx)("p", { className: "hint", children: e }),
      ],
    });
  }
  function qg({ onClose: e }) {
    let [t, l] = (0, C.useState)(!1);
    return (0, c.jsx)("div", {
      className: "modal-overlay",
      onClick: e,
      children: (0, c.jsxs)("div", {
        className: "modal-panel",
        onClick: (n) => n.stopPropagation(),
        children: [
          (0, c.jsxs)("div", {
            className: "modal-head",
            children: [
              (0, c.jsx)("h3", { children: "カード早見表" }),
              (0, c.jsx)("button", {
                className: "icon-btn",
                onClick: e,
                children: (0, c.jsx)(Ja, { size: 18 }),
              }),
            ],
          }),
          (0, c.jsxs)("div", {
            className: "rule-toggle",
            children: [
              (0, c.jsx)("button", {
                className: `btn ${t ? "btn-ghost" : "btn-primary"}`,
                onClick: () => l(!1),
                children: "通常の動き",
              }),
              (0, c.jsx)("button", {
                className: `btn ${t ? "btn-primary" : "btn-ghost"}`,
                onClick: () => l(!0),
                children: "王にした時",
              }),
            ],
          }),
          (0, c.jsx)("p", {
            className: "hint",
            style: { marginBottom: 14 },
            children: t
              ? "王にした時に加わる効果です。図は同じ数字を1枚だけ採用した場合。"
              : "金色のマスが動ける先です。",
          }),
          (0, c.jsx)("div", {
            className: "rule-grid",
            children: ht.map((n) =>
              (0, c.jsxs)(
                "div",
                {
                  className: "rule-row",
                  children: [
                    (0, c.jsxs)("div", {
                      className: "rule-diagram",
                      children: [
                        (0, c.jsx)("div", { className: "rule-rank", children: n }),
                        (0, c.jsx)(h0, { rank: n, isKing: t }),
                      ],
                    }),
                    (0, c.jsx)("div", { className: "rule-desc", children: t ? v0[n] : d0[n] }),
                  ],
                },
                n,
              ),
            ),
          }),
        ],
      }),
    });
  }
  function Zg({ piece: e, viewer: t, onClose: l, revealAll: n }) {
    let a = H[e.owner],
      u = e.owner === t || !e.alive || n,
      i = Ug(e, t, n);
    return (0, c.jsx)("div", {
      className: "modal-overlay",
      onClick: l,
      children: (0, c.jsxs)("div", {
        className: "modal-panel",
        onClick: (f) => f.stopPropagation(),
        children: [
          (0, c.jsxs)("div", {
            className: "modal-head",
            children: [
              (0, c.jsxs)("h3", {
                style: { color: a.color },
                children: [u ? `${e.rank}${Fa[e.suit]}` : "???", " の行動ログ"],
              }),
              (0, c.jsx)("button", {
                className: "icon-btn",
                onClick: l,
                children: (0, c.jsx)(Ja, { size: 18 }),
              }),
            ],
          }),
          u && (0, c.jsx)(P0, { rank: e.rank, suit: e.suit, isKing: e.isKing, compact: !0 }),
          i.length === 0
            ? (0, c.jsx)("p", {
                className: "hint",
                children: "まだ行動していません。",
              })
            : (0, c.jsx)("ol", {
                className: "log-list",
                children: i.map((f, o) => (0, c.jsxs)("li", { children: [o + 1, ". ", f] }, o)),
              }),
        ],
      }),
    });
  }
  var Vg = new Set([
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
  function Gg(e, t) {
    switch (e.type) {
      case "CONFIRM_MULLIGAN":
        return { ...e, discardIds: [...(t.players[t.mulliganIdx]._mulliganSelected || [])] };
      case "SETUP_CONFIRM":
        return { ...e, placement: t.setupPlacement, kingId: t.setupPickKing };
      case "CONFIRM_SHUFFLE":
        return {
          ...e,
          aId: t.shuffleMode && t.shuffleMode.aId,
          pickIds: t.shuffleMode ? [...t.shuffleMode.picks] : [],
        };
      case "MOVE_PIECE":
        return { ...e, pieceId: t.selectedId };
      default:
        return e;
    }
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
  function _g({ onExit: e, network: t, boardSize: l, cpu: n }) {
    let [a, u] = (0, C.useState)(Eo),
      [i, f] = (0, C.useState)(!1),
      [o, r] = (0, C.useState)(!1),
      [d, m] = (0, C.useState)(!1),
      [s, v] = (0, C.useState)(null),
      p = t ? t.myPlayerIndex : null,
      w = (0, C.useRef)(g0()),
      z = (0, C.useRef)(0),
      g = (0, C.useRef)(new Set()),
      [A, b] = (0, C.useState)(0);
    function y(E) {
      u((U) => {
        if (t && Vg.has(E.type)) return ki(U, E);
        let be = t ? Wg(Gg(E, U), U) : E;
        if (t) {
          let at = `${w.current}-${++z.current}`,
            ne = { ...be, __id: at };
          return (
            g.current.add(at),
            queueMicrotask(() => {
              t0(t.code, ne).then(async (Me) => {
                if (Me.ok) v(null);
                else {
                  await new Promise((Zt) => setTimeout(Zt, 700));
                  let ze = await t0(t.code, ne);
                  v(ze.ok ? null : ze.error);
                }
              });
            }),
            ki(U, ne)
          );
        }
        return ki(U, be);
      });
    }
    (0, C.useEffect)(() => {
      a.phase === "intro" && ((t && p !== 0) || y({ type: "START_SETUP", size: l || 5 }));
    }, [a.phase, l]);
    let T = 1;
    ((0, C.useEffect)(() => {
      if (!n || t) return;
      let E = Fg(a, T);
      if (!E) return;
      let U = a.phase === "play" ? 700 : 380,
        be = setTimeout(() => {
          E.type === "__CPU_SHUFFLE"
            ? (y({ type: "SELECT_PIECE", id: E.aceId }),
              y({ type: "TOGGLE_SHUFFLE_PICK", id: E.pickIds[0] }),
              y({ type: "TOGGLE_SHUFFLE_PICK", id: E.pickIds[1] }),
              y({ type: "CONFIRM_SHUFFLE" }))
            : y(E);
        }, U);
      return () => clearTimeout(be);
    }, [a, n, t]),
      (0, C.useEffect)(() => {
        if (!t) return;
        let E = !1,
          U = setInterval(async () => {
            let be = await Hg(t.code);
            if (E) return;
            if (!be.ok) {
              v(be.error);
              return;
            }
            let at = be.list.filter((ne) => ne && ne.__id && !g.current.has(ne.__id));
            at.length !== 0 &&
              (at.forEach((ne) => g.current.add(ne.__id)),
              u((ne) => at.reduce((Me, ze) => ki(Me, ze), ne)),
              b(be.list.length));
          }, 700);
        return () => {
          ((E = !0), clearInterval(U));
        };
      }, [t]));
    let R = a.boardSize,
      P = t ? p : n ? 0 : a.currentTurn,
      x = t ? a.currentTurn === p : n ? a.currentTurn === 0 : !0,
      N = t
        ? `${p === 0 ? "host" : "guest"} acts:${g.current.size} d${a.diceIdx}[${(a.dice || []).map((E) => E ?? "-").join(",")}]`
        : null;
    if (d)
      return (0, c.jsx)(re, {
        showRules: i,
        setShowRules: f,
        netInfo: N,
        children: (0, c.jsx)(u9, {
          viewer: P,
          onCancel: () => m(!1),
          onResign: () => {
            (m(!1), y({ type: "RESIGN", player: P }));
          },
        }),
      });
    if (o)
      return (0, c.jsx)(re, {
        showRules: i,
        setShowRules: f,
        netInfo: N,
        children: (0, c.jsx)(i9, {
          network: t,
          onCancel: () => r(!1),
          onQuit: () => {
            (r(!1), e());
          },
        }),
      });
    if (a.phase === "intro")
      return (0, c.jsx)(re, {
        showRules: i,
        setShowRules: f,
        netInfo: N,
        onBack: () => r(!0),
        children: (0, c.jsx)(r0, {
          text:
            t && p !== 0
              ? "相手の準備を待っています…"
              : "対局の準備をしています…",
        }),
      });
    if (a.captureReveal && (!t || a.captureReveal.capturedBy === p))
      return (0, c.jsx)(re, {
        showRules: i,
        setShowRules: f,
        netInfo: N,
        onBack: () => r(!0),
        children: (0, c.jsx)(Yg, {
          reveal: a.captureReveal,
          viewer: P,
          onClose: () => y({ type: "DISMISS_CAPTURE" }),
        }),
      });
    if (a.pendingKingChoice)
      return t && a.pendingKingChoice.owner !== p
        ? (0, c.jsx)(re, {
            showRules: i,
            setShowRules: f,
            netInfo: N,
            onBack: () => r(!0),
            children: (0, c.jsx)(r0, {
              text: "相手が新しい王を選んでいます…",
            }),
          })
        : (0, c.jsx)(re, {
            showRules: i,
            setShowRules: f,
            netInfo: N,
            onBack: () => r(!0),
            children: (0, c.jsx)(Bg, { state: a, size: R, dispatch: y }),
          });
    if (a.interstitial && !t && !n)
      return (0, c.jsx)(re, {
        showRules: i,
        setShowRules: f,
        netInfo: N,
        onBack: () => r(!0),
        children: (0, c.jsx)(Mg, {
          forPlayer: a.interstitial.forPlayer,
          kind: a.interstitial.kind,
          onReady: () => y({ type: "DISMISS_INTERSTITIAL" }),
        }),
      });
    if (a.phase === "dice") {
      if (a.diceIdx === 3)
        return (0, c.jsx)(re, {
          showRules: i,
          setShowRules: f,
          netInfo: N,
          onBack: () => r(!0),
          children: (0, c.jsxs)("div", {
            className: "center-stage",
            children: [
              (0, c.jsx)("h2", { children: "同じ目でした" }),
              (0, c.jsx)("div", {
                className: "dice-result-row",
                children: [0, 1].map((U) =>
                  (0, c.jsxs)(
                    "div",
                    {
                      className: "dice-result-item",
                      children: [
                        (0, c.jsxs)("span", {
                          style: { color: H[U].color },
                          children: [Vn(U, P), "(", H[U].name, ")"],
                        }),
                        (0, c.jsx)(ji, { value: a.dice[U], color: H[U].color }),
                      ],
                    },
                    U,
                  ),
                ),
              }),
              (0, c.jsx)("p", {
                className: "hint",
                children:
                  "先手・後手が決まらないため、もう一度振り直します。",
              }),
              !t || p === 0
                ? (0, c.jsxs)("button", {
                    className: "btn btn-primary",
                    onClick: () => y({ type: "REROLL_DICE" }),
                    children: [(0, c.jsx)(Co, { size: 16 }), " 振り直す"],
                  })
                : (0, c.jsx)("p", {
                    className: "hint",
                    children:
                      "ホストが振り直しを開始します…",
                  }),
            ],
          }),
        });
      let E = a.diceIdx >= 2 ? null : a.diceIdx;
      return E !== null
        ? n && E !== 0
          ? (0, c.jsx)(re, {
              showRules: i,
              setShowRules: f,
              netInfo: N,
              onBack: () => r(!0),
              children: (0, c.jsx)(o0, { playerIdx: E, value: a.dice[E] }),
            })
          : t && E !== p
            ? (0, c.jsx)(re, {
                showRules: i,
                setShowRules: f,
                netInfo: N,
                onBack: () => r(!0),
                children: (0, c.jsx)(o0, { playerIdx: E, value: a.dice[E] }),
              })
            : (0, c.jsx)(re, {
                showRules: i,
                setShowRules: f,
                netInfo: N,
                onBack: () => r(!0),
                children: (0, c.jsx)(jg, {
                  playerIdx: E,
                  value: a.dice[E],
                  onRoll: () => y({ type: "ROLL_DICE_SINGLE", playerIdx: E }),
                  onNext: () => y({ type: "NEXT_DICE_STEP" }),
                }),
              })
        : (0, c.jsx)(re, {
            showRules: i,
            setShowRules: f,
            netInfo: N,
            onBack: () => r(!0),
            children: (0, c.jsxs)("div", {
              className: "center-stage",
              children: [
                (0, c.jsx)("h2", { children: "結果発表" }),
                (0, c.jsx)("div", {
                  className: "dice-result-row",
                  children: [0, 1].map((U) =>
                    (0, c.jsxs)(
                      "div",
                      {
                        className: `dice-result-item ${a.firstPlayer === U ? "dice-winner" : ""}`,
                        children: [
                          (0, c.jsxs)("span", {
                            style: { color: H[U].color },
                            children: [Vn(U, P), "(", H[U].name, ")"],
                          }),
                          (0, c.jsx)(ji, { value: a.dice[U], color: H[U].color }),
                        ],
                      },
                      U,
                    ),
                  ),
                }),
                (0, c.jsxs)("p", {
                  style: { color: H[a.firstPlayer].color, fontWeight: 700 },
                  children: [
                    a.firstPlayer === P ? "あなた" : "相手",
                    "(",
                    H[a.firstPlayer].name,
                    ")が先手です",
                  ],
                }),
                !t || p === 0
                  ? (0, c.jsxs)("button", {
                      className: "btn btn-primary",
                      onClick: () => y({ type: "GOTO_MULLIGAN" }),
                      children: ["手札を確認する ", (0, c.jsx)(Ci, { size: 16 })],
                    })
                  : (0, c.jsx)("p", {
                      className: "hint",
                      children: "ホストが次に進めます…",
                    }),
              ],
            }),
          });
    }
    if (a.phase === "mulligan") {
      if (n && a.mulliganIdx !== 0)
        return (0, c.jsx)(re, {
          showRules: i,
          setShowRules: f,
          netInfo: N,
          onBack: () => r(!0),
          children: (0, c.jsx)(Mi, {
            text: "CPUがカードを選んでいます…",
            hand: a.players[0].hand,
            viewer: 0,
            size: R,
          }),
        });
      if (t && a.mulliganIdx !== p)
        return (0, c.jsx)(re, {
          showRules: i,
          setShowRules: f,
          netInfo: N,
          onBack: () => r(!0),
          children: (0, c.jsx)(Mi, {
            text: "相手が交換するカードを選んでいます…",
            hand: a.players[p].hand,
            viewer: p,
            size: R,
          }),
        });
      let E = a.mulliganIdx,
        U = a.players[E],
        be = new Set(U._mulliganSelected || []);
      return (0, c.jsx)(re, {
        showRules: i,
        setShowRules: f,
        netInfo: N,
        onBack: () => r(!0),
        children: (0, c.jsxs)("div", {
          className: "setup-wrap",
          children: [
            (0, c.jsxs)("h2", {
              style: { color: H[E].color },
              children: [
                Tg(E, P),
                ": 交換するカードを選んでね",
              ],
            }),
            (0, c.jsx)("p", {
              className: "hint",
              children:
                "捨てたい札をタップ(もう一度タップで取り消し)。同じ枚数を予備札から引き直します。捨て札は公開情報になります。",
            }),
            (0, c.jsx)(Og, {
              hand: U.hand,
              selected: be,
              onToggle: (at) => y({ type: "TOGGLE_MULLIGAN_CARD", cardId: at }),
            }),
            (0, c.jsx)(w0, {
              cards: a.players[1 - E].discard,
              label: `${Vn(1 - E, P)}(${H[1 - E].name})が捨てたカード`,
              color: H[1 - E].color,
            }),
            (0, c.jsxs)("button", {
              className: "btn btn-primary",
              onClick: () => y({ type: "CONFIRM_MULLIGAN" }),
              children: [
                be.size,
                "枚 引き直して確定 ",
                (0, c.jsx)(Hi, { size: 16 }),
              ],
            }),
          ],
        }),
      });
    }
    if (a.phase === "setup") {
      if (n && a.setupIdx !== 0)
        return (0, c.jsx)(re, {
          showRules: i,
          setShowRules: f,
          netInfo: N,
          onBack: () => r(!0),
          children: (0, c.jsx)(Mi, {
            text: "CPUが布陣を決めています…",
            hand: a.players[0].hand,
            board: a.board && a.board.length ? a.board : null,
            viewer: 0,
            size: R,
          }),
        });
      if (t && a.setupIdx !== p)
        return (0, c.jsx)(re, {
          showRules: i,
          setShowRules: f,
          netInfo: N,
          onBack: () => r(!0),
          children: (0, c.jsx)(Mi, {
            text: "相手が布陣を決めています…",
            hand: a.players[p].hand,
            board: a.board && a.board.length ? a.board : null,
            viewer: p,
            size: R,
          }),
        });
      let E = a.setupIdx,
        U = a.players[E];
      return (0, c.jsx)(re, {
        showRules: i,
        setShowRules: f,
        netInfo: N,
        onBack: () => r(!0),
        children:
          a.setupStep === "place"
            ? (0, c.jsx)(e9, { state: a, player: U, pIdx: E, size: R, dispatch: y })
            : (0, c.jsx)(t9, { state: a, player: U, pIdx: E, size: R, dispatch: y }),
      });
    }
    let M = x && a.selectedId ? a.pieces[a.selectedId] : null,
      ct = M ? jo(M, a.board, R, a.players[P].armyRankCounts) : [],
      Jl = P === 1,
      Pl = x && a.shuffleMode;
    return (0, c.jsx)(re, {
      showRules: i,
      setShowRules: f,
      netInfo: N,
      onBack: () => r(!0),
      children: (0, c.jsxs)("div", {
        className: "play-wrap",
        children: [
          (0, c.jsx)(n9, { state: a, viewer: P }),
          s &&
            (0, c.jsx)("p", {
              className: "hint",
              style: { textAlign: "center", color: "#e2896f" },
              children: s,
            }),
          t &&
            !x &&
            (0, c.jsx)("p", {
              className: "hint",
              style: { textAlign: "center" },
              children: "相手の手番です",
            }),
          n &&
            !x &&
            (0, c.jsxs)("p", {
              className: "hint",
              style: { textAlign: "center" },
              children: [
                (0, c.jsx)(qn, { size: 14, className: "spin-icon" }),
                " CPUが考えています…",
              ],
            }),
          (0, c.jsx)("div", {
            className: "board-outer",
            children: (0, c.jsxs)("div", {
              className: "board-frame",
              style: { "--n": R },
              children: [
                (0, c.jsx)("div", {
                  className: "rank-labels",
                  children: Array.from({ length: R }).map((E, U) => {
                    let be = Jl ? R - 1 - U : U;
                    return (0, c.jsx)("span", { children: R - be }, U);
                  }),
                }),
                (0, c.jsx)("div", {
                  className: "board-grid",
                  style: { gridTemplateColumns: `repeat(${R},1fr)` },
                  children: Array.from({ length: R }).map((E, U) =>
                    Array.from({ length: R }).map((be, at) => {
                      let ne = Jl ? R - 1 - U : U,
                        Me = Jl ? R - 1 - at : at,
                        ze = a.board[ne][Me],
                        Zt = ct.find((wl) => wl.row === ne && wl.col === Me),
                        Zo = z0(ne, Me, R),
                        Vt = a.lastMove,
                        Vo = Vt && Vt.from.row === ne && Vt.from.col === Me,
                        Go = Vt && Vt.to.row === ne && Vt.to.col === Me,
                        Oi = a.lastSwap,
                        Lo = Oi && Oi.cells.some((wl) => wl.row === ne && wl.col === Me),
                        S0 = Vo ? "cell-from" : Go ? "cell-to" : Lo ? "cell-swap" : "";
                      return (0, c.jsx)(
                        "div",
                        {
                          style:
                            Vt && (Vo || Go)
                              ? { "--lm": H[Vt.owner].color }
                              : Lo
                                ? { "--lm": H[Oi.owner].color }
                                : void 0,
                          className: `cell ${Zt ? (Zt.capture ? "cell-capture" : "cell-move") : ""} ${Zo !== null ? `zone-${Zo}` : ""} ${S0}`,
                          onClick: () => {
                            Pl ||
                              ze ||
                              y(
                                Zt
                                  ? { type: "MOVE_PIECE", row: ne, col: Me, captures: Zt.captures }
                                  : { type: "CANCEL_SELECTION" },
                              );
                          },
                          children:
                            ze &&
                            (0, c.jsx)("div", {
                              onClick: (wl) => {
                                if ((wl.stopPropagation(), Pl)) {
                                  y({ type: "TOGGLE_SHUFFLE_PICK", id: ze.id });
                                  return;
                                }
                                if (Zt && x) {
                                  y({ type: "MOVE_PIECE", row: ne, col: Me, captures: Zt.captures });
                                  return;
                                }
                                if (ze.owner === P && x) {
                                  y({ type: "SELECT_PIECE", id: ze.id });
                                  return;
                                }
                                y({ type: "VIEW_LOG", id: ze.id });
                              },
                              children: (0, c.jsx)(y0, {
                                piece: ze,
                                viewer: P,
                                size: R >= 9 ? "xs" : "md",
                                isSelected:
                                  (!!M && a.selectedId === ze.id) ||
                                  (Pl &&
                                    (a.shuffleMode.aId === ze.id || a.shuffleMode.picks.includes(ze.id))),
                                isPickable: !!Pl && ze.id !== a.shuffleMode.aId,
                              }),
                            }),
                        },
                        `${ne}-${Me}`,
                      );
                    }),
                  ),
                }),
                (0, c.jsx)("div", {
                  className: "file-labels",
                  children: Array.from({ length: R }).map((E, U) => {
                    let be = Jl ? R - 1 - U : U;
                    return (0, c.jsx)("span", { children: String.fromCharCode(97 + be) }, U);
                  }),
                }),
              ],
            }),
          }),
          Pl &&
            (0, c.jsxs)("div", {
              className: "action-bar",
              children: [
                (0, c.jsxs)("span", {
                  children: [
                    "入れ替える駒を2つ選択(",
                    a.shuffleMode.picks.length,
                    "/2)",
                    (0, c.jsx)("br", {}),
                    "味方だけを選ぶと、囲んだ相手を取れます",
                  ],
                }),
                (0, c.jsxs)("button", {
                  className: "btn btn-primary",
                  disabled: a.shuffleMode.picks.length !== 2,
                  onClick: () => y({ type: "CONFIRM_SHUFFLE" }),
                  children: ["シャッフル実行 ", (0, c.jsx)(J1, { size: 14 })],
                }),
                (0, c.jsx)("button", {
                  className: "btn btn-ghost",
                  onClick: () => y({ type: "CANCEL_SELECTION" }),
                  children: "やめる",
                }),
              ],
            }),
          !Pl &&
            x &&
            a.selectedId &&
            (0, c.jsx)("div", {
              className: "action-bar",
              children: (0, c.jsx)("button", {
                className: "btn btn-ghost",
                onClick: () => y({ type: "VIEW_LOG", id: a.selectedId }),
                children: "この駒の行動ログを見る",
              }),
            }),
          !Pl &&
            x &&
            a.extraMoveFor &&
            (() => {
              let E = a.pieces[a.extraMoveFor],
                U = E && E.rank === "A";
              return (0, c.jsxs)("div", {
                className: "action-bar",
                children: [
                  (0, c.jsx)("span", {
                    children: U
                      ? "王(A)はもう一度入れ替えられます"
                      : "王(10)はもう一度動けます",
                  }),
                  (0, c.jsx)("button", {
                    className: "btn btn-ghost",
                    onClick: () => y({ type: "SKIP_EXTRA_ACTION" }),
                    children: "使わず手番を終える",
                  }),
                ],
              });
            })(),
          a.kPlacement && a.kPlacement.owner === P && (0, c.jsx)(l9, { state: a, dispatch: y, size: R }),
          (0, c.jsx)(a9, { players: a.players, dispatch: y, viewer: P }),
          (0, c.jsx)("div", {
            className: "resign-row",
            children: (0, c.jsxs)("button", {
              className: "btn btn-ghost btn-resign",
              onClick: () => m(!0),
              children: [(0, c.jsx)(Xi, { size: 16 }), " 降参する"],
            }),
          }),
          a.logViewerId &&
            a.pieces[a.logViewerId] &&
            (0, c.jsx)(Zg, {
              piece: a.pieces[a.logViewerId],
              viewer: P,
              revealAll: a.phase === "gameover",
              onClose: () => y({ type: "CLOSE_LOG" }),
            }),
          a.phase === "gameover" &&
            (0, c.jsx)($g, { state: a, network: t, myIdx: p, size: R, viewer: P, dispatch: y, onExit: e }),
        ],
      }),
    });
  }
  function $g({ state: e, network: t, myIdx: l, size: n, viewer: a, dispatch: u, onExit: i }) {
    let [f, o] = (0, C.useState)(!1),
      r = H[e.winner];
    if (f) {
      let d = a === 1,
        m = e.log.filter(
          (s) =>
            s.includes("撃破") ||
            s.includes("王が倒された") ||
            s.includes("道連れ") ||
            s.includes("新しい王") ||
            s.includes("入れ替えた") ||
            s.includes("投入") ||
            s.includes("降参"),
        );
      return (0, c.jsx)("div", {
        className: "modal-overlay",
        children: (0, c.jsxs)("div", {
          className: "modal-panel review-panel",
          children: [
            (0, c.jsxs)("div", {
              className: "modal-head",
              children: [
                (0, c.jsx)("h3", {
                  style: { color: r.color },
                  children: t
                    ? e.winner === l
                      ? "あなたの勝ち!"
                      : "あなたの負け…"
                    : `${r.name}の勝利!`,
                }),
                (0, c.jsx)("button", {
                  className: "icon-btn",
                  onClick: () => o(!1),
                  children: (0, c.jsx)(Ja, { size: 18 }),
                }),
              ],
            }),
            e.resignedBy !== null &&
              e.resignedBy !== void 0 &&
              (0, c.jsxs)("p", {
                className: "hint",
                style: { color: "var(--gold-soft)" },
                children: [
                  H[e.resignedBy].name,
                  "の降参により決着しました。",
                ],
              }),
            (0, c.jsx)("p", {
              className: "hint",
              children:
                "最終盤面(すべての駒を公開)。駒をタップすると、その駒の動きを追えます。",
            }),
            (0, c.jsx)("div", {
              className: "board-outer",
              children: (0, c.jsx)("div", {
                className: "board-grid",
                style: { gridTemplateColumns: `repeat(${n},1fr)` },
                children: Array.from({ length: n }).map((s, v) =>
                  Array.from({ length: n }).map((p, w) => {
                    let z = d ? n - 1 - v : v,
                      g = d ? n - 1 - w : w,
                      A = e.board[z][g],
                      b = z0(z, g, n);
                    return (0, c.jsx)(
                      "div",
                      {
                        className: `cell ${b !== null ? `zone-${b}` : ""}`,
                        onClick: () => {
                          A && u({ type: "VIEW_LOG", id: A.id });
                        },
                        children:
                          A &&
                          (0, c.jsxs)("div", {
                            className: "piece-wrap",
                            children: [
                              (0, c.jsx)(De, {
                                rank: A.rank,
                                suit: A.suit,
                                size: n >= 9 ? "xs" : "md",
                                isKing: A.isKing,
                              }),
                              A.isKing &&
                                (0, c.jsx)(pt, {
                                  size: n >= 9 ? 10 : 16,
                                  className: "king-badge",
                                  style: { color: H[A.owner].color },
                                }),
                            ],
                          }),
                      },
                      `${z}-${g}`,
                    );
                  }),
                ),
              }),
            }),
            (0, c.jsx)("div", {
              className: "review-lost",
              children: e.players.map((s, v) =>
                (0, c.jsxs)(
                  "div",
                  {
                    className: "captured-col",
                    children: [
                      (0, c.jsxs)("div", {
                        className: "captured-label",
                        style: { color: H[v].color },
                        children: [Vn(v, a), "(", H[v].name, ")が失った駒"],
                      }),
                      (0, c.jsxs)("div", {
                        className: "captured-cards",
                        children: [
                          s.capturedOwn
                            .filter((p) => !p.alive)
                            .map((p) =>
                              (0, c.jsx)(
                                "div",
                                {
                                  className: "captured-card",
                                  onClick: () => u({ type: "VIEW_LOG", id: p.id }),
                                  children: (0, c.jsx)(De, { rank: p.rank, suit: p.suit, size: "sm" }),
                                },
                                p.id,
                              ),
                            ),
                          s.capturedOwn.filter((p) => !p.alive).length === 0 &&
                            (0, c.jsx)("span", { className: "hint", children: "なし" }),
                        ],
                      }),
                    ],
                  },
                  v,
                ),
              ),
            }),
            (0, c.jsxs)("div", {
              className: "review-log",
              children: [
                (0, c.jsx)("div", { className: "tray-label", children: "対局の記録" }),
                (0, c.jsx)("ol", {
                  className: "log-list",
                  children: m.length
                    ? m.map((s, v) => (0, c.jsx)("li", { children: s }, v))
                    : (0, c.jsx)("li", {
                        children:
                          "特筆すべき出来事はありませんでした",
                      }),
                }),
              ],
            }),
            (0, c.jsx)("div", {
              className: "setup-actions",
              children: (0, c.jsx)("button", {
                className: "btn btn-ghost",
                onClick: () => o(!1),
                children: "閉じる",
              }),
            }),
          ],
        }),
      });
    }
    return (0, c.jsx)("div", {
      className: "modal-overlay",
      children: (0, c.jsxs)("div", {
        className: "modal-panel gameover-panel",
        children: [
          (0, c.jsx)(pt, { size: 34, style: { color: "var(--gold)" } }),
          (0, c.jsx)("h2", {
            style: { color: r.color },
            children: t
              ? e.winner === l
                ? "あなたの勝ち!"
                : "あなたの負け…"
              : `${r.name}の勝利!`,
          }),
          e.resignedBy !== null &&
            e.resignedBy !== void 0 &&
            (0, c.jsxs)("p", {
              className: "hint",
              style: { marginTop: -6 },
              children: [H[e.resignedBy].name, "が降参しました"],
            }),
          (0, c.jsx)("div", {
            className: "king-card win-card",
            children: (0, c.jsx)("img", { src: B1, alt: "" }),
          }),
          (0, c.jsx)("div", {
            className: "setup-actions",
            style: { marginTop: 16 },
            children: (0, c.jsxs)("button", {
              className: "btn btn-primary",
              onClick: () => o(!0),
              children: [(0, c.jsx)(Ri, { size: 16 }), " 対局を振り返る"],
            }),
          }),
          (0, c.jsxs)("div", {
            className: "setup-actions",
            style: { marginTop: 10 },
            children: [
              !t || l === 0
                ? (0, c.jsxs)("button", {
                    className: "btn btn-ghost",
                    onClick: () => u({ type: "NEW_GAME" }),
                    children: [(0, c.jsx)(Co, { size: 16 }), " もう一度遊ぶ"],
                  })
                : (0, c.jsx)("p", {
                    className: "hint",
                    children:
                      "ホストがもう一度遊ぶか選んでいます…",
                  }),
              i &&
                (0, c.jsx)("button", {
                  className: "btn btn-ghost",
                  onClick: i,
                  children: "タイトルに戻る",
                }),
            ],
          }),
        ],
      }),
    });
  }
  function Do(e, t) {
    return e.hand.find((l) => l.id === t);
  }
  function z0(e, t, l) {
    let n = hl(l, 0),
      a = hl(l, 1);
    return e >= n[0] && e <= n[1] ? 0 : e >= a[0] && e <= a[1] ? 1 : null;
  }
  function e9({ state: e, player: t, pIdx: l, size: n, dispatch: a }) {
    let [u, i] = (0, C.useState)(null),
      f = Gn(n),
      [o, r] = hl(n, l),
      d = e.setupPlacement,
      m = new Set(Object.keys(d)),
      s = m.size,
      v = t.hand
        .filter((z) => !m.has(z.id))
        .sort((z, g) => {
          let A = ht.indexOf(z.rank) - ht.indexOf(g.rank);
          return A !== 0 ? A : Ot.indexOf(z.suit) - Ot.indexOf(g.suit);
        }),
      p = l === 1;
    function w(z, g, A, b) {
      A && (u ? (a({ type: "SETUP_PLACE_CARD", cardId: u, row: z, col: g }), i(null)) : b && i(b));
    }
    return (0, c.jsxs)("div", {
      className: "setup-wrap",
      children: [
        (0, c.jsxs)("h2", {
          style: { color: H[l].color },
          children: [H[l].name, ": カードを盤面に配置してね"],
        }),
        (0, c.jsxs)("p", {
          className: "hint",
          children: [
            "手札(または盤上の駒)をタップして選び、自陣のマスをタップして置いてください。ちょうど",
            f,
            "枚を配置します(",
            s,
            "/",
            f,
            ")。",
          ],
        }),
        (0, c.jsx)("div", {
          className: "arrange-layout",
          children: (0, c.jsx)("div", {
            className: "mini-board",
            style: { gridTemplateColumns: `repeat(${n},1fr)` },
            children: Array.from({ length: n }).map((z, g) =>
              Array.from({ length: n }).map((A, b) => {
                let y = p ? n - 1 - g : g,
                  T = p ? n - 1 - b : b,
                  R = y >= o && y <= r,
                  P = Object.keys(d).find((N) => d[N].row === y && d[N].col === T),
                  x = P ? Do(t, P) : null;
                return (0, c.jsx)(
                  "div",
                  {
                    className: `mini-cell ${R ? "mini-cell-zone" : ""} ${u && R ? "mini-cell-open" : ""}`,
                    onClick: () => w(y, T, R, P),
                    children:
                      x &&
                      (0, c.jsx)("div", {
                        className: `mini-piece ${u === P ? "piece-selected" : ""}`,
                        children: (0, c.jsx)(De, { rank: x.rank, suit: x.suit, size: "sm" }),
                      }),
                  },
                  `${y}-${T}`,
                );
              }),
            ),
          }),
        }),
        u &&
          m.has(u) &&
          (0, c.jsx)("button", {
            className: "btn btn-ghost",
            style: { marginBottom: 12 },
            onClick: () => {
              (a({ type: "SETUP_UNPLACE_CARD", cardId: u }), i(null));
            },
            children: "この駒を手札に戻す",
          }),
        (0, c.jsxs)("div", {
          className: "tray",
          children: [
            (0, c.jsxs)("div", { className: "tray-label", children: ["手札(", v.length, "枚)"] }),
            (0, c.jsxs)("div", {
              className: "tray-row",
              children: [
                v.length === 0 &&
                  (0, c.jsx)("span", {
                    className: "hint",
                    children: "手札を全て配置しました",
                  }),
                v.map((z) =>
                  (0, c.jsx)(
                    "div",
                    {
                      className: `hand-card ${u === z.id ? "hand-card-selected" : ""}`,
                      onClick: () => i(u === z.id ? null : z.id),
                      children: (0, c.jsx)(De, { rank: z.rank, suit: z.suit }),
                    },
                    z.id,
                  ),
                ),
              ],
            }),
          ],
        }),
        (0, c.jsxs)("div", {
          className: "setup-actions",
          children: [
            (0, c.jsxs)("button", {
              className: "btn btn-ghost",
              onClick: () => a({ type: "SETUP_AUTO_ARRANGE" }),
              children: [(0, c.jsx)(_1, { size: 16 }), " 自動配置"],
            }),
            (0, c.jsxs)("button", {
              className: "btn btn-primary",
              disabled: s !== f,
              onClick: () => a({ type: "SETUP_GOTO_KING_STEP" }),
              children: [(0, c.jsx)(pt, { size: 16 }), " 王を選ぶ"],
            }),
          ],
        }),
      ],
    });
  }
  function t9({ state: e, player: t, pIdx: l, size: n, dispatch: a }) {
    let u = e.setupPlacement,
      [i, f] = hl(n, l),
      o = Object.keys(u).some((d) => Do(t, d).rank === "K"),
      r = l === 1;
    return (0, c.jsxs)("div", {
      className: "setup-wrap",
      children: [
        (0, c.jsxs)("h2", {
          style: { color: H[l].color },
          children: [
            H[l].name,
            ": どのカードを王にするか決めてね",
          ],
        }),
        (0, c.jsx)("p", {
          className: "hint",
          children: o
            ? "Kを配置しているので、Kが王になります。"
            : "配置したカードの中から王にする1枚をタップしてください。",
        }),
        (0, c.jsx)("div", {
          className: "arrange-layout",
          children: (0, c.jsx)("div", {
            className: "mini-board",
            style: { gridTemplateColumns: `repeat(${n},1fr)` },
            children: Array.from({ length: n }).map((d, m) =>
              Array.from({ length: n }).map((s, v) => {
                let p = r ? n - 1 - m : m,
                  w = r ? n - 1 - v : v,
                  z = p >= i && p <= f,
                  g = Object.keys(u).find((y) => u[y].row === p && u[y].col === w),
                  A = g ? Do(t, g) : null,
                  b = A && (!o || A.rank === "K");
                return (0, c.jsx)(
                  "div",
                  {
                    className: `mini-cell ${z ? "mini-cell-zone" : ""}`,
                    onClick: () => {
                      b && a({ type: "SETUP_PICK_KING", cardId: g });
                    },
                    children:
                      A &&
                      (0, c.jsxs)("div", {
                        className: `mini-piece ${e.setupPickKing === g ? "piece-selected" : ""} ${b ? "" : "mini-piece-disabled"}`,
                        children: [
                          (0, c.jsx)(De, {
                            rank: A.rank,
                            suit: A.suit,
                            size: "sm",
                            isKing: e.setupPickKing === g,
                          }),
                          e.setupPickKing === g && (0, c.jsx)(pt, { size: 12, className: "king-badge" }),
                        ],
                      }),
                  },
                  `${p}-${w}`,
                );
              }),
            ),
          }),
        }),
        (0, c.jsxs)("div", {
          className: "setup-actions",
          children: [
            (0, c.jsxs)("button", {
              className: "btn btn-ghost",
              onClick: () => a({ type: "SETUP_BACK_TO_PLACE" }),
              children: [(0, c.jsx)(Zn, { size: 16 }), " 配置に戻る"],
            }),
            (0, c.jsxs)("button", {
              className: "btn btn-primary",
              disabled: !e.setupPickKing,
              onClick: () => a({ type: "SETUP_CONFIRM" }),
              children: [(0, c.jsx)(pt, { size: 16 }), " 布陣を確定"],
            }),
          ],
        }),
      ],
    });
  }
  function l9({ state: e, dispatch: t, size: l }) {
    let n = e.kPlacement.owner,
      [a, u] = hl(l, n),
      i = n === 1;
    return (0, c.jsx)("div", {
      className: "modal-overlay",
      children: (0, c.jsxs)("div", {
        className: "modal-panel",
        children: [
          (0, c.jsx)("h3", { children: "予備札を配置" }),
          (0, c.jsx)("p", {
            className: "hint",
            children:
              "Kの効果で引いた1枚。自陣の空きマスに配置できます。",
          }),
          (0, c.jsx)(P0, { rank: e.kPlacement.card.rank, suit: e.kPlacement.card.suit }),
          (0, c.jsx)("div", {
            className: "mini-board",
            style: { gridTemplateColumns: `repeat(${l},1fr)` },
            children: Array.from({ length: l }).map((f, o) =>
              Array.from({ length: l }).map((r, d) => {
                let m = i ? l - 1 - o : o,
                  s = i ? l - 1 - d : d,
                  v = m >= a && m <= u,
                  p = e.board[m][s];
                return (0, c.jsx)(
                  "div",
                  {
                    className: `mini-cell ${v && !p ? "mini-cell-zone mini-cell-open" : ""}`,
                    onClick: () => {
                      v && !p && t({ type: "PLACE_RESERVE_CARD", row: m, col: s });
                    },
                    children:
                      p &&
                      (0, c.jsx)("div", {
                        className: "mini-piece",
                        children: (0, c.jsx)(Qo, { colorHex: H[p.owner].color, size: "sm" }),
                      }),
                  },
                  `${m}-${s}`,
                );
              }),
            ),
          }),
          (0, c.jsx)("button", {
            className: "btn btn-ghost",
            onClick: () => t({ type: "SKIP_RESERVE_PLACEMENT" }),
            children: "今回は見送る",
          }),
        ],
      }),
    });
  }
  function n9({ state: e, viewer: t }) {
    let l = H[e.currentTurn],
      n = e.currentTurn === t;
    return (0, c.jsxs)("div", {
      className: "turn-bar",
      children: [
        (0, c.jsx)("span", { className: "turn-dot", style: { background: l.color } }),
        (0, c.jsx)("span", {
          style: { color: l.color, fontWeight: 700 },
          children: n
            ? `あなた(${l.name})の番です`
            : `相手(${l.name})の番です`,
        }),
        (0, c.jsx)("span", { className: "turn-log", children: e.log[e.log.length - 1] }),
      ],
    });
  }
  function a9({ players: e, dispatch: t, viewer: l }) {
    let [n, a] = (0, C.useState)(!1),
      u = e.some((i) => i.discard && i.discard.length > 0);
    return (0, c.jsxs)(c.Fragment, {
      children: [
        (0, c.jsx)("div", {
          className: "captured-row",
          children: e.map((i, f) =>
            (0, c.jsxs)(
              "div",
              {
                className: "captured-col",
                children: [
                  (0, c.jsxs)("div", {
                    className: "captured-label",
                    style: { color: H[f].color },
                    children: [Vn(f, l), "(", H[f].name, ")が失った駒"],
                  }),
                  (0, c.jsx)("div", {
                    className: "captured-cards",
                    children: i.capturedOwn
                      .filter((o) => !o.alive)
                      .map((o) =>
                        (0, c.jsx)(
                          "div",
                          {
                            className: "captured-card",
                            onClick: () => t({ type: "VIEW_LOG", id: o.id }),
                            children: (0, c.jsx)(De, { rank: o.rank, suit: o.suit, size: "sm" }),
                          },
                          o.id,
                        ),
                      ),
                  }),
                ],
              },
              f,
            ),
          ),
        }),
        u &&
          (0, c.jsxs)("div", {
            className: "discard-toggle-wrap",
            children: [
              (0, c.jsx)("button", {
                className: "btn btn-ghost",
                onClick: () => a((i) => !i),
                children: n
                  ? "引き直しの捨て札を隠す"
                  : "引き直しの捨て札を見る",
              }),
              n &&
                (0, c.jsx)("div", {
                  className: "discard-both",
                  children: e.map((i, f) =>
                    (0, c.jsx)(
                      w0,
                      {
                        cards: i.discard,
                        label: `${Vn(f, l)}(${H[f].name})が捨てたカード`,
                        color: H[f].color,
                      },
                      f,
                    ),
                  ),
                }),
            ],
          }),
      ],
    });
  }
  function u9({ onCancel: e, onResign: t, viewer: l }) {
    let n = H[l];
    return (0, c.jsx)("div", {
      className: "modal-overlay",
      onClick: e,
      children: (0, c.jsxs)("div", {
        className: "modal-panel gameover-panel",
        onClick: (a) => a.stopPropagation(),
        children: [
          (0, c.jsx)(Xi, { size: 30, style: { color: "var(--gold)" } }),
          (0, c.jsx)("h3", {
            style: { margin: "8px 0 10px" },
            children: "降参しますか?",
          }),
          (0, c.jsxs)("p", {
            className: "hint",
            children: [
              (0, c.jsxs)("b", { style: { color: n.color }, children: ["あなた(", n.name, ")"] }),
              "の負けとして、この対局が終わります。",
            ],
          }),
          (0, c.jsxs)("div", {
            className: "setup-actions",
            style: { marginTop: 16, flexDirection: "column" },
            children: [
              (0, c.jsx)("button", {
                className: "btn btn-primary",
                onClick: e,
                children: "対局を続ける",
              }),
              (0, c.jsxs)("button", {
                className: "btn btn-ghost",
                onClick: t,
                children: [(0, c.jsx)(Xi, { size: 16 }), " 降参する"],
              }),
            ],
          }),
        ],
      }),
    });
  }
  function i9({ onCancel: e, onQuit: t, network: l }) {
    return (0, c.jsx)("div", {
      className: "modal-overlay",
      onClick: e,
      children: (0, c.jsxs)("div", {
        className: "modal-panel gameover-panel",
        onClick: (n) => n.stopPropagation(),
        children: [
          (0, c.jsx)("h3", {
            style: { margin: "0 0 10px" },
            children: "対局をやめますか?",
          }),
          (0, c.jsxs)("p", {
            className: "hint",
            children: [
              "今の対局は最初からやり直しになります。",
              l &&
                (0, c.jsxs)(c.Fragment, {
                  children: [
                    (0, c.jsx)("br", {}),
                    "オンライン対戦の場合、相手の画面はそのまま残ります。",
                  ],
                }),
            ],
          }),
          (0, c.jsxs)("div", {
            className: "setup-actions",
            style: { marginTop: 16, flexDirection: "column" },
            children: [
              (0, c.jsx)("button", {
                className: "btn btn-primary",
                onClick: e,
                children: "対局を続ける",
              }),
              (0, c.jsxs)("button", {
                className: "btn btn-ghost",
                onClick: t,
                children: [
                  (0, c.jsx)(Zn, { size: 16 }),
                  " やめてタイトルに戻る",
                ],
              }),
            ],
          }),
        ],
      }),
    });
  }
  function f9({ onClose: e }) {
    return (0, c.jsx)("div", {
      className: "modal-overlay",
      onClick: e,
      children: (0, c.jsxs)("div", {
        className: "modal-panel",
        onClick: (t) => t.stopPropagation(),
        children: [
          (0, c.jsxs)("div", {
            className: "modal-head",
            children: [
              (0, c.jsx)("h3", { children: "設定" }),
              (0, c.jsx)("button", {
                className: "icon-btn",
                onClick: e,
                children: (0, c.jsx)(Ja, { size: 18 }),
              }),
            ],
          }),
          (0, c.jsxs)("div", {
            className: "settings-list",
            children: [
              (0, c.jsxs)("div", {
                className: "settings-row",
                children: [
                  (0, c.jsx)("span", { children: "ゲームの版" }),
                  (0, c.jsx)("b", { children: s0 }),
                ],
              }),
              (0, c.jsxs)("div", {
                className: "settings-row",
                children: [
                  (0, c.jsx)("span", { children: "ルールの確認" }),
                  (0, c.jsx)("b", {
                    children: "右上の「i」から見られます",
                  }),
                ],
              }),
              (0, c.jsxs)("div", {
                className: "settings-row",
                children: [
                  (0, c.jsx)("span", { children: "通信" }),
                  (0, c.jsx)("b", {
                    children: "オンライン対戦に対応",
                  }),
                ],
              }),
            ],
          }),
          (0, c.jsx)("p", {
            className: "hint",
            style: { marginTop: 14 },
            children:
              "音量や表示の調整は今後追加する予定です。",
          }),
          (0, c.jsx)("button", {
            className: "btn btn-primary",
            style: { marginTop: 10 },
            onClick: e,
            children: "閉じる",
          }),
        ],
      }),
    });
  }
  function re({ children: e, showRules: t, setShowRules: l, netInfo: n, onBack: a, title: u }) {
    let [i, f] = (0, C.useState)(!1);
    return (0, c.jsxs)("div", {
      className: "tottery-root",
      children: [
        (0, c.jsx)("style", { children: v9 }),
        (0, c.jsxs)("header", {
          className: "top-bar",
          children: [
            (0, c.jsx)("div", {
              className: "top-left",
              children: a
                ? (0, c.jsx)("button", {
                    className: "icon-btn plain",
                    onClick: a,
                    "aria-label": "戻る",
                    children: (0, c.jsx)(Zn, { size: 20 }),
                  })
                : (0, c.jsx)(pt, { size: 20, style: { color: "var(--gold)" } }),
            }),
            (0, c.jsx)("span", { className: "brand", children: u || "トッタリー" }),
            (0, c.jsxs)("div", {
              className: "top-right",
              children: [
                (0, c.jsx)("button", {
                  className: "icon-btn",
                  onClick: () => l(!0),
                  "aria-label": "カード早見表",
                  children: (0, c.jsx)(Ri, { size: 18 }),
                }),
                (0, c.jsx)("button", {
                  className: "icon-btn",
                  onClick: () => f(!0),
                  "aria-label": "設定",
                  children: (0, c.jsx)(K1, { size: 18 }),
                }),
              ],
            }),
          ],
        }),
        i && (0, c.jsx)(f9, { onClose: () => f(!1) }),
        (0, c.jsx)("main", { className: "stage", children: e }),
        t && (0, c.jsx)(qg, { onClose: () => l(!1) }),
        (0, c.jsxs)("div", {
          className: "build-tag",
          children: [
            n && (0, c.jsxs)("span", { className: "net-tag", children: [n, " \xB7 "] }),
            "build: ",
            s0,
          ],
        }),
      ],
    });
  }
  function c9({ onStart: e }) {
    return (0, c.jsxs)("div", {
      className: "intro title-hero",
      children: [
        (0, c.jsx)("img", { className: "title-bg", src: Q1, alt: "", draggable: "false" }),
        (0, c.jsxs)("button", {
          className: "btn btn-primary btn-large intro-start",
          onClick: e,
          children: ["ゲームスタート ", (0, c.jsx)(Ci, { size: 18 })],
        }),
      ],
    });
  }
  function o9({ onOnline: e, onFriend: t, onCpu: l }) {
    return (0, c.jsxs)("div", {
      className: "center-stage",
      children: [
        (0, c.jsx)("h2", { children: "対戦相手を選ぶ" }),
        (0, c.jsxs)("div", {
          className: "nav-stack",
          children: [
            (0, c.jsxs)("button", {
              className: "btn btn-primary btn-choice",
              onClick: e,
              children: [
                (0, c.jsx)(I1, { size: 30 }),
                (0, c.jsxs)("span", {
                  className: "choice-label",
                  children: [
                    "オンラインでマッチする",
                    (0, c.jsx)("small", {
                      children: "世界中のプレイヤーと対戦",
                    }),
                  ],
                }),
              ],
            }),
            (0, c.jsxs)("button", {
              className: "btn btn-friend btn-choice",
              onClick: t,
              children: [
                (0, c.jsx)(Ka, { size: 30 }),
                (0, c.jsxs)("span", {
                  className: "choice-label",
                  children: [
                    "フレンドとマッチする",
                    (0, c.jsx)("small", { children: "友達とルーム対戦" }),
                  ],
                }),
              ],
            }),
            (0, c.jsxs)("button", {
              className: "btn btn-teal btn-choice",
              onClick: l,
              children: [
                (0, c.jsx)(pt, { size: 30 }),
                (0, c.jsxs)("span", {
                  className: "choice-label",
                  children: [
                    "CPUと対戦する",
                    (0, c.jsx)("small", {
                      children: "ひとりで練習・腕試し",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }
  function r9({ onBack: e, onRoomReady: t }) {
    let [l, n] = (0, C.useState)("searching"),
      [a, u] = (0, C.useState)(""),
      i = (0, C.useRef)(g0()),
      f = (0, C.useRef)(null),
      o = (0, C.useRef)(!1);
    return (
      (0, C.useEffect)(() => {
        if (l !== "waiting") return;
        let r = setInterval(async () => {
          let d = f.current;
          if (!d) return;
          let m = await n0(`/${d}/guest`);
          if (!o.current && m.ok && m.data) {
            clearInterval(r);
            let s = f.current;
            (a0(`/${d}`), t({ code: s, myPlayerIndex: 0 }));
          }
        }, 1500);
        return () => clearInterval(r);
      }, [l]),
      (0, C.useEffect)(
        () => () => {
          ((o.current = !0), f.current && a0(`/${f.current}`));
        },
        [],
      ),
      (0, C.useEffect)(() => {
        (async () => {
          let r = i.current,
            d = await Xg();
          if (o.current) return;
          if (!d.ok) {
            (u(d.error), n("error"));
            return;
          }
          let m = Date.now(),
            s = Object.entries(d.data || {})
              .filter(([z, g]) => g && !g.guest && g.host !== r && m - (g.createdAt || 0) < Cg)
              .sort((z, g) => (g[1].createdAt || 0) - (z[1].createdAt || 0));
          for (let [z] of s) {
            let g = await l0(`/${z}/guest`, r);
            if (o.current) return;
            if (!g.ok) continue;
            let A = await n0(`/${z}/guest`);
            if (o.current) return;
            if (A.ok && A.data === r) {
              let b = await Yi(z);
              if (o.current) return;
              if (!b.ok) {
                (u(b.error), n("error"));
                return;
              }
              if ((await Ia(z, { ...(b.data || {}), guestPresent: !0 }), o.current)) return;
              t({ code: z, myPlayerIndex: 1 });
              return;
            }
          }
          let v = Xo() + Xo(),
            p = await Ia(v, { guestPresent: !1, gameState: null });
          if (o.current) return;
          if (!p.ok) {
            (u(p.error), n("error"));
            return;
          }
          let w = await l0(`/${v}`, { host: r, guest: null, createdAt: Date.now() });
          if (!o.current) {
            if (!w.ok) {
              (u(w.error), n("error"));
              return;
            }
            ((f.current = v), n("waiting"));
          }
        })();
      }, []),
      l === "error"
        ? (0, c.jsxs)("div", {
            className: "center-stage",
            children: [
              (0, c.jsx)("h2", {
                children: "マッチングできませんでした",
              }),
              (0, c.jsx)("p", { className: "hint", style: { color: "#e2896f" }, children: a }),
              (0, c.jsx)("button", {
                className: "btn btn-ghost",
                onClick: e,
                children: "マッチング画面に戻る",
              }),
            ],
          })
        : (0, c.jsxs)("div", {
            className: "center-stage",
            children: [
              (0, c.jsx)(qn, { size: 32, className: "dim-icon spin-icon" }),
              (0, c.jsx)("h2", {
                children:
                  l === "searching"
                    ? "対戦相手を探しています…"
                    : "対戦相手を待っています…",
              }),
              (0, c.jsx)("p", {
                className: "hint",
                children:
                  l === "searching"
                    ? "待機中のプレイヤーがいないか確認しています。"
                    : "あなたは待機中です。誰かが参加すると自動的に始まります。",
              }),
              (0, c.jsx)("button", {
                className: "btn btn-ghost",
                style: { marginTop: 18 },
                onClick: e,
                children: "やめる",
              }),
            ],
          })
    );
  }
  function s9({ onStart: e, onBack: t, backLabel: l, note: n }) {
    let [a, u] = (0, C.useState)(5);
    return (0, c.jsxs)("div", {
      className: "setup-wrap",
      children: [
        (0, c.jsx)("h2", { children: "ルール設定" }),
        (0, c.jsxs)("div", {
          className: "rule-section",
          children: [
            (0, c.jsx)("div", { className: "rule-section-label", children: "ルール" }),
            (0, c.jsxs)("div", {
              className: "nav-stack",
              children: [
                (0, c.jsxs)("button", {
                  className: "btn btn-primary btn-choice",
                  disabled: !0,
                  children: [
                    (0, c.jsx)(Hi, { size: 18 }),
                    (0, c.jsxs)("span", {
                      className: "choice-label",
                      children: [
                        "クラシック",
                        (0, c.jsx)("small", {
                          children: "基本ルールで対戦します",
                        }),
                      ],
                    }),
                  ],
                }),
                (0, c.jsx)("button", {
                  className: "btn btn-ghost",
                  disabled: !0,
                  title: "開発中",
                  children: "詳細設定(開発中)",
                }),
              ],
            }),
          ],
        }),
        (0, c.jsxs)("div", {
          className: "rule-section",
          children: [
            (0, c.jsx)("div", {
              className: "rule-section-label",
              children: "盤面のサイズ",
            }),
            (0, c.jsx)("div", {
              className: "size-choices",
              children: [5, 9].map((i) =>
                (0, c.jsxs)(
                  "button",
                  {
                    className: `board-choice ${a === i ? "active" : ""}`,
                    onClick: () => u(i),
                    children: [
                      (0, c.jsx)("div", {
                        className: "board-choice-grid",
                        style: { gridTemplateColumns: `repeat(${i},1fr)` },
                        children: Array.from({ length: i * i }).map((f, o) => (0, c.jsx)("span", {}, o)),
                      }),
                      (0, c.jsxs)("span", { children: [i, "\xD7", i] }),
                      (0, c.jsx)("small", {
                        children:
                          i === 5
                            ? "5枚で戦う短期戦"
                            : "9枚で戦う本格戦",
                      }),
                    ],
                  },
                  i,
                ),
              ),
            }),
          ],
        }),
        n && (0, c.jsx)("p", { className: "hint", children: n }),
        (0, c.jsxs)("div", {
          className: "setup-actions",
          children: [
            (0, c.jsxs)("button", {
              className: "btn btn-ghost",
              onClick: t,
              children: [(0, c.jsx)(Zn, { size: 18 }), " ", l],
            }),
            (0, c.jsxs)("button", {
              className: "btn btn-primary",
              onClick: () => e(a),
              children: [(0, c.jsx)($1, { size: 16 }), " ゲームを始める"],
            }),
          ],
        }),
      ],
    });
  }
  function d9({ onOfflineLocal: e, onRoomReady: t, onBackToMatching: l, onBeforeRoom: n, autoCreate: a }) {
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
            N = await Ia(x, { test: !0 });
          if (P) return;
          if (!N.ok) {
            (z("fail"), A(N.error));
            return;
          }
          let M = await Yi(x);
          if (!P) {
            if (!M.ok) {
              (z("fail"), A(M.error));
              return;
            }
            (e0(x), z("ok"));
          }
        })(),
        () => {
          P = !0;
        }
      );
    }, []);
    let b = (0, C.useRef)(!1);
    ((0, C.useEffect)(() => {
      !a || b.current || w !== "ok" || ((b.current = !0), y());
    }, [a, w]),
      (0, C.useEffect)(() => {
        if (u !== "waitingHost") return;
        let P = !1,
          x = setInterval(async () => {
            let N = await Yi(f);
            if (!P) {
              if (!N.ok) {
                s(N.error);
                return;
              }
              N.data && N.data.guestPresent && (clearInterval(x), t({ code: f, myPlayerIndex: 0 }));
            }
          }, 1200);
        return () => {
          ((P = !0), clearInterval(x));
        };
      }, [u, f]));
    async function y() {
      (p(!0), s(""));
      let P = Xo(),
        x = await Ia(P, { guestPresent: !1, gameState: null });
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
      let x = await Yi(P);
      if (!x.ok) {
        (p(!1), s(x.error));
        return;
      }
      if (!x.data) {
        (p(!1),
          s(
            "そのコードのルームは見つかりませんでした",
          ));
        return;
      }
      if (x.data.guestPresent) {
        (p(!1),
          s(
            "このルームは既に対戦相手が参加済みです",
          ));
        return;
      }
      let N = await Ia(P, { ...x.data, guestPresent: !0 });
      if ((p(!1), !N.ok)) {
        s(N.error);
        return;
      }
      t({ code: P, myPlayerIndex: 1 });
    }
    function R() {
      (f && e0(f), o(""), s(""), i(null));
    }
    return u === "waitingHost"
      ? (0, c.jsxs)("div", {
          className: "center-stage",
          children: [
            (0, c.jsx)(Ka, { size: 28, className: "dim-icon" }),
            (0, c.jsx)("h2", { children: "ルームを作成しました" }),
            (0, c.jsx)("div", { className: "room-code", children: f }),
            (0, c.jsx)("p", {
              className: "hint",
              children:
                "この4桁のコードを相手に伝えてください。相手が参加すると自動的に始まります。",
            }),
            (0, c.jsx)(qn, { size: 22, className: "dim-icon spin-icon" }),
            m && (0, c.jsx)("p", { className: "hint", style: { color: "#e2896f" }, children: m }),
            (0, c.jsxs)("div", {
              className: "nav-stack",
              style: { marginTop: 20 },
              children: [
                (0, c.jsx)("button", {
                  className: "btn btn-ghost",
                  onClick: R,
                  children: "ルームを取り消す",
                }),
                (0, c.jsx)("button", {
                  className: "btn btn-ghost",
                  onClick: () => {
                    (R(), l());
                  },
                  children: "マッチング画面に戻る",
                }),
              ],
            }),
          ],
        })
      : (0, c.jsxs)("div", {
          className: "setup-wrap friend-wrap",
          children: [
            (0, c.jsxs)("div", {
              className: "friend-head",
              children: [
                (0, c.jsx)(Ka, { size: 44, style: { color: "var(--gold)" } }),
                (0, c.jsx)("h2", {
                  style: { margin: "10px 0 8px" },
                  children: "フレンド対戦",
                }),
                (0, c.jsxs)("p", {
                  className: "hint",
                  style: { margin: 0 },
                  children: [
                    "ルームを作成して合言葉を共有するか、",
                    (0, c.jsx)("br", {}),
                    "合言葉を入力して参加できます。",
                  ],
                }),
              ],
            }),
            (0, c.jsxs)("div", {
              className: `conn-badge conn-${w}`,
              children: [
                (0, c.jsx)("span", { className: "conn-dot" }),
                "接続状態:",
                w === "ok"
                  ? "オンライン"
                  : w === "checking"
                    ? "確認中…"
                    : "利用できません",
              ],
            }),
            w === "fail" && (0, c.jsx)("p", { className: "hint", style: { color: "#e08b7a" }, children: g }),
            (0, c.jsxs)("button", {
              className: "btn btn-primary btn-wide",
              disabled: v || w !== "ok",
              onClick: n,
              children: [(0, c.jsx)(F1, { size: 22 }), " ルームを作る"],
            }),
            (0, c.jsxs)("div", {
              className: "code-row",
              children: [
                (0, c.jsxs)("div", {
                  className: "code-boxes",
                  onClick: () => {
                    let P = document.getElementById("code-input");
                    P && P.focus();
                  },
                  children: [
                    [0, 1, 2, 3].map((P) =>
                      (0, c.jsx)(
                        "div",
                        {
                          className: `code-box ${r.length === P ? "code-box-active" : ""}`,
                          children:
                            r[P] || (0, c.jsx)("span", { className: "code-placeholder", children: "—" }),
                        },
                        P,
                      ),
                    ),
                    (0, c.jsx)("input", {
                      id: "code-input",
                      className: "code-hidden",
                      value: r,
                      maxLength: 4,
                      onChange: (P) => d(P.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")),
                      inputMode: "text",
                      autoComplete: "off",
                    }),
                  ],
                }),
                (0, c.jsxs)("button", {
                  className: "btn btn-ghost code-join",
                  disabled: v || w !== "ok",
                  onClick: T,
                  children: [
                    (0, c.jsx)(W1, { size: 18 }),
                    " ",
                    v ? "参加中…" : "参加する",
                  ],
                }),
              ],
            }),
            (0, c.jsxs)("p", {
              className: "code-note",
              children: [
                (0, c.jsx)(Ri, { size: 14 }),
                " 4文字の合言葉を入力してください。",
              ],
            }),
            m && (0, c.jsx)("p", { className: "hint", style: { color: "#e08b7a" }, children: m }),
            (0, c.jsxs)("button", {
              className: "btn btn-teal btn-wide",
              onClick: e,
              children: [
                (0, c.jsx)(Ka, { size: 20 }),
                " オフラインで対戦(2人)",
              ],
            }),
            (0, c.jsxs)("button", {
              className: "btn btn-ghost btn-wide",
              style: { marginTop: 12 },
              onClick: l,
              children: [
                (0, c.jsx)(Zn, { size: 18 }),
                " メインメニューへ戻る",
              ],
            }),
          ],
        });
  }
  function Oo() {
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
    if (e === "game") return (0, c.jsx)(_g, { network: a, boardSize: i, cpu: d, onExit: s });
    let g = o === "online" || o === "room" ? "matching" : "room";
    return (0, c.jsx)(re, {
      showRules: l,
      setShowRules: n,
      children: {
        home: (0, c.jsx)(c9, { onStart: () => t("matching") }),
        matching: (0, c.jsx)(o9, {
          onOnline: () => {
            (u(null), m(!1), r("online"), t("rules"));
          },
          onFriend: () => {
            (u(null), m(!1), t("room"));
          },
          onCpu: () => {
            (u(null), m(!0), r("game"), t("rules"));
          },
        }),
        online: (0, c.jsx)(r9, { onBack: () => t("matching"), onRoomReady: v }),
        room: (0, c.jsx)(d9, {
          autoCreate: p,
          onOfflineLocal: () => {
            (w(!1), u(null), m(!1), r("game"), t("rules"));
          },
          onBeforeRoom: () => {
            (r("room"), t("rules"));
          },
          onRoomReady: v,
          onBackToMatching: () => {
            (w(!1), t("matching"));
          },
        }),
        rules: (0, c.jsx)(s9, {
          onStart: z,
          onBack: () => t(g),
          backLabel: "戻る",
          note:
            o === "online"
              ? "この設定で対戦相手を探します。相手が先に待っていた場合は、相手の設定が使われます。"
              : o === "room"
                ? "この設定でルームを作ります。"
                : null,
        }),
      }[e],
    });
  }
  var v9 = `
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
  N0.default
    .createRoot(document.getElementById("root"))
    .render((0, qo.jsx)(x0.default.StrictMode, { children: (0, qo.jsx)(Oo, {}) }));
})();
