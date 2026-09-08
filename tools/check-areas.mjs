/**
 * 盤面エリア(src/game/areas.js)の検査。
 *
 *   - 旗を立てない対局には何も起きない(既存の対局と同じ)
 *   - 9×9 で、王のランクにスキンがあるときだけエリアが立つ。5×5 には立たない
 *   - 6種それぞれの効果・使えない場面・1局1回
 *   - 乱数は手に焼き込まれ、同じ手の列を再生すると同じ盤になる(オンラインの前提)
 *   - CPU 同士で回しても盤が壊れない(check-board と同じ不変条件)
 */
import {
  reducer,
  autoArrange,
  autoPickKing,
  initialState,
} from "../src/game/reducer.js";
import { enrichAction } from "../src/game/actions.js";
import { cpuAction } from "../src/game/cpu.js";
import {
  getLegalMoves,
  inBounds,
  kingRankOf,
  buildDeck,
} from "../src/game/board.js";
import {
  AREA_BY_RANK,
  canUseArea,
  isFrozen,
  isKnownTo,
  hasAction,
  promotedRank,
  FREEZE_TURNS,
} from "../src/game/areas.js";

let ok = 0;
const fails = [];
function is(name, got, want) {
  const g = JSON.stringify(got),
    w = JSON.stringify(want);
  if (g === w) ok++;
  else fails.push(`${name}  ${g} ≠ ${w}`);
}
const all = (skin) =>
  Object.fromEntries(Object.keys(AREA_BY_RANK).map((r) => [r, skin]));
const LOADOUTS = [all("skin-red"), all("skin-blue")];

/**
 * 望みの王で 9×9 の対局を「対局開始」まで進める。
 * 山札を組み替えて、両者の手札に望みのランクを確実に入れる。
 */
function startGame({ kings = ["2", "2"], size = 9, areas = true, loadouts = LOADOUTS, deckOrder } = {}) {
  let deck = buildDeck(null);
  {
    // 決まった種で混ぜる。素の並びだと先頭13枚が同じスートでフラッシュになる
    let r = 20260908;
    const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  if (deckOrder) deck = deckOrder(deck);
  else {
    // 先頭13枚が player0、次の13枚が player1。望みの王を各手札の先頭に置く
    const pick = (rank, used) => deck.find((c) => c.rank === rank && !used.has(c.id));
    const used = new Set();
    const a = pick(kings[0], used); used.add(a.id);
    const b = pick(kings[1], used); used.add(b.id);
    const rest = deck.filter((c) => !used.has(c.id));
    // 王以外は「王のランクと帯が同じ札」を避けて配る(候補が絞られないよう)
    deck = [a, ...rest.slice(0, 12), b, ...rest.slice(12)];
  }
  let s = reducer(
    { phase: "intro" },
    { type: "START_SETUP", size, setupMode: "simultaneous", deck, areas, loadouts, ruleVersion: 2 },
  );
  const step = (act) => (s = reducer(s, enrichAction(act, s)));
  let guard = 0;
  while (s.phase !== "play" && guard++ < 60) {
    if (s.interstitial) { step({ type: "DISMISS_INTERSTITIAL" }); continue; }
    if (s.phase === "dice") {
      step(
        s.dice[s.diceIdx] === null && s.diceIdx <= 1
          ? { type: "ROLL_DICE_SINGLE" }
          : s.diceIdx === 2 ? { type: "GOTO_MULLIGAN" }
          : s.diceIdx === 3 ? { type: "REROLL_DICE" }
          : { type: "NEXT_DICE_STEP" },
      );
      continue;
    }
    if (s.phase === "mulligan") { step({ type: "CONFIRM_MULLIGAN", discardIds: [] }); continue; }
    if (s.phase === "setup") {
      for (const idx of [0, 1]) {
        if (s.setupDone[idx]) continue;
        const placement = autoArrange(s, idx, null, null, null);
        const me = s.players[idx];
        let wanted = Object.keys(placement)
          .map((id) => me.hand.find((c) => c.id === id))
          .find((c) => c && c.rank === kings[idx]);
        if (!wanted) {
          // 自動配置が望みの札を置かなかったら、置かれた1枚と入れ替える
          const card = me.hand.find((c) => c.rank === kings[idx]);
          const swapOut = Object.keys(placement).find((id) => {
            const c = me.hand.find((x) => x.id === id);
            return c && c.rank !== "K";
          });
          if (card && swapOut) {
            placement[card.id] = placement[swapOut];
            delete placement[swapOut];
            wanted = card;
          }
        }
        step({
          type: "SETUP_CONFIRM",
          player: idx,
          placement,
          kingId: wanted ? wanted.id : autoPickKing(s, idx, placement),
        });
      }
      continue;
    }
    break;
  }
  if (s.setupEffects) s = reducer(s, { type: "DISMISS_SETUP_EFFECTS" });
  if (s.interstitial) s = reducer(s, { type: "DISMISS_INTERSTITIAL" });
  return s;
}
const dismiss = (s) => {
  let guard = 0;
  while (guard++ < 5 && (s.captureReveal || s.interstitial)) {
    if (s.captureReveal) s = reducer(s, { type: "DISMISS_CAPTURE" });
    if (s.interstitial) s = reducer(s, { type: "DISMISS_INTERSTITIAL" });
  }
  return s;
};
const mine = (s, p) => Object.values(s.pieces).filter((x) => x.alive && x.owner === p);
const anyMove = (s, p, filter = () => true) => {
  for (const piece of mine(s, p)) {
    if (piece.rank === "A" || !filter(piece)) continue;
    const moves = getLegalMoves(piece, s.board, s.boardSize, s.players[p].armyRankCounts, kingRankOf(s, p));
    // 取りは避ける(盤を単純に保つ)
    const quiet = moves.find((m) => !s.board[m.row][m.col]);
    if (quiet) return { type: "MOVE_PIECE", pieceId: piece.id, row: quiet.row, col: quiet.col };
  }
  return null;
};
/** いまの手番の側が静かに1手指し、手番を渡す */
function playQuiet(s) {
  const p = s.currentTurn;
  const act = anyMove(s, p, (piece) => !isFrozen(s, piece));
  if (!act) throw new Error(`${p} に指せる静かな手が無い`);
  let next = reducer(s, enrichAction({ ...act, elapsedMs: 100 }, s));
  if (next.extraMoveFor) next = reducer(next, { type: "SKIP_EXTRA_ACTION" });
  return dismiss(next);
}

console.log("旗が無ければ何も起きない");
{
  const s = startGame({ kings: ["2", "2"], areas: false });
  is("エリアは立たない", s.areas, [null, null]);
  is("USE_AREA は無視", reducer(s, { type: "USE_AREA", hit: true }) === s, true);
  const t = startGame({ kings: ["2", "2"], size: 5 });
  is("5×5 には立たない", t.areas, [null, null]);
  const u = startGame({ kings: ["2", "3"], loadouts: [{ 2: "x" }, {}] });
  is("王のランクにスキンが無い側は立たない", [u.areas[0] && u.areas[0].type, u.areas[1]], ["earth", null]);
  is("旗が無い対局の状態にも turnNo がある", typeof s.turnNo, "number");
}

console.log("土: 足跡を読む");
{
  let s = startGame({ kings: ["2", "8"] });
  is("2の王は土", s.areas[0].type, "earth");
  is("8の王は氷", s.areas[1].type, "ice");
  // 相手がまだ動いていなければ読めない
  if (s.currentTurn === 0) is("足跡が無いと使えない", canUseArea(s, 0).ok, false);
  else is("相手の番には使えない", canUseArea(s, 0).ok, false);
  // 土の側の番になるまで進める(相手が動いた直後)
  while (s.currentTurn !== 0 || !s.lastMove || s.lastMove.owner !== 1) s = playQuiet(s);
  is("相手の直前の駒は公開されていない(前提)", !!s.board[s.lastMove.to.row][s.lastMove.to.col].revealed, false);
  is("相手が動いたあとは使える", canUseArea(s, 0).ok, true);
  const target = s.board[s.lastMove.to.row][s.lastMove.to.col];
  const miss = reducer(s, { type: "USE_AREA", hit: false });
  is("外れ: 正体は分からない", isKnownTo(miss, 0, miss.pieces[target.id]), false);
  is("外れでも使い切る", miss.areas[0].used, true);
  is("手番は消費しない", miss.currentTurn, 0);
  const hit = reducer(s, { type: "USE_AREA", hit: true });
  is("当たり: 自分だけが知る", [isKnownTo(hit, 0, hit.pieces[target.id]), isKnownTo(hit, 1, hit.pieces[target.id]) === true && hit.pieces[target.id].owner === 1], [true, true]);
  is("公開(revealed)にはならない", !!hit.pieces[target.id].revealed, false);
  is("記録に残り、当たり外れは相手にも分かる", [hit.log.at(-1).includes("見抜いた"), miss.log.at(-1).includes("読み違えた")], [true, true]);
  is("2回目は使えない", reducer(hit, { type: "USE_AREA", hit: true }) === hit, true);
  is("通信で届く手に hit が無ければ捨てる", reducer(s, { type: "USE_AREA", player: 0 }) === s, true);
  is("enrichAction が hit を焼き込む", typeof enrichAction({ type: "USE_AREA" }, s).hit, "boolean");
}

console.log("海: 中央へ引き寄せる");
{
  let s = startGame({ kings: ["4", "5"] });
  is("4の王は海", s.areas[0].type, "sea");
  if (s.currentTurn !== 0) s = playQuiet(s);
  const c = 4;
  const cheb = (p) => Math.max(Math.abs(p.row - c), Math.abs(p.col - c));
  const before = Object.fromEntries(Object.values(s.pieces).map((p) => [p.id, cheb(p)]));
  const alive = Object.values(s.pieces).filter((p) => p.alive).length;
  const t = reducer(s, { type: "USE_AREA" });
  is("使えた", t.areas[0].used, true);
  is("駒は減らない", Object.values(t.pieces).filter((p) => p.alive).length, alive);
  let overlap = 0, farther = 0, mismatch = 0;
  const seen = new Set();
  for (const p of Object.values(t.pieces)) {
    if (!p.alive) continue;
    const key = `${p.row},${p.col}`;
    if (seen.has(key)) overlap++;
    seen.add(key);
    if (cheb(p) > before[p.id]) farther++;
    if (!t.board[p.row][p.col] || t.board[p.row][p.col].id !== p.id) mismatch++;
  }
  is("重ならない", overlap, 0);
  is("誰も遠ざからない", farther, 0);
  is("盤と駒が一致", mismatch, 0);
  const near = Object.values(t.pieces).filter((p) => p.alive && cheb(p) <= 2).length;
  is("中央 5×5 に 18体全部が入る", near, 18);
  is("手番は消費しない", t.currentTurn, 0);
  is("直前の手は消える(演出の誤発火を防ぐ)", t.lastMove, null);
}

console.log("森: 1体見抜く");
{
  let s = startGame({ kings: ["6", "7"] });
  if (s.currentTurn !== 0) s = playQuiet(s);
  is("6の王は森", s.areas[0] && s.areas[0].type, "forest");
  const act = enrichAction({ type: "USE_AREA" }, s);
  is("enrichAction が並びを焼き込む", Array.isArray(act.picks) && act.picks.length, 8);
  if (!act.picks) { console.log("  (森が立っていないので以降を飛ばす)", s.areas); process.exit(1); }
  const t = reducer(s, act);
  const known = Object.keys(t.known[0]);
  is("1体", known.length, 1);
  is("相手の駒で王ではない", known.every((id) => t.pieces[id].owner === 1 && !t.pieces[id].isKing), true);
  is("相手には何も分からない", Object.keys(t.known[1]).length, 0);
  is("手に書かれた先頭を選ぶ", known, [act.picks[0]]);
  is("公開(revealed)にはならない", !!t.pieces[known[0]].revealed, false);
  // 手に無い id や相手の王を書いても通らない
  const kingId = s.players[1].kingId;
  const bad = reducer(s, { type: "USE_AREA", picks: [kingId, "nope"] });
  is("王や知らない id は無視され、固定の並びで補う", Object.keys(bad.known[0]).length === 1 && !bad.known[0][kingId], true);
}

console.log("氷: 1体を選んで3手番動けなくする");
{
  let s = startGame({ kings: ["8", "9"] });
  if (s.currentTurn !== 0) s = playQuiet(s);
  const foeKing = s.players[1].kingId;
  is("相手の王は選べない", reducer(s, { type: "USE_AREA", pieceId: foeKing }) === s, true);
  const own = mine(s, 0).find((p) => !p.isKing);
  is("自分の駒は選べない", reducer(s, { type: "USE_AREA", pieceId: own.id }) === s, true);
  is("駒を選ばないと何も起きない", reducer(s, { type: "USE_AREA" }) === s, true);
  const target = mine(s, 1).find((p) => !p.isKing);
  const t = reducer(s, { type: "USE_AREA", pieceId: target.id });
  is("選んだ1体だけが凍る", mine(t, 1).filter((p) => isFrozen(t, p)).map((p) => p.id), [target.id]);
  is("相手の王は凍らない", isFrozen(t, t.pieces[foeKing]), false);
  is("自分の駒は凍らない", mine(t, 0).some((p) => isFrozen(t, p)), false);
  is("記録に残る", t.log.at(-1).includes("氷のエリア"), true);
  // 自分が1手指して相手の番に
  let u = playQuiet(t);
  is("相手の番", u.currentTurn, 1);
  const frozenPiece = u.pieces[target.id];
  const moves = getLegalMoves(frozenPiece, u.board, u.boardSize, u.players[1].armyRankCounts, kingRankOf(u, 1));
  if (moves.length) {
    const m = moves[0];
    is("凍った駒は動かせない", reducer(u, { type: "MOVE_PIECE", pieceId: frozenPiece.id, row: m.row, col: m.col }) === u, true);
    is("凍った駒は選べない", reducer(u, { type: "SELECT_PIECE", id: frozenPiece.id }) === u, true);
  }
  // 相手の手番を3回数える。王だけで指す
  let foeTurns = 0, guard = 0;
  while (foeTurns < FREEZE_TURNS && guard++ < 20) {
    if (u.currentTurn === 1) {
      is(`相手の${foeTurns + 1}手番目: まだ凍っている`, isFrozen(u, u.pieces[frozenPiece.id]), true);
      foeTurns++;
    }
    u = playQuiet(u);
  }
  while (u.currentTurn !== 1) u = playQuiet(u);
  is("4手番目には解けている", isFrozen(u, u.pieces[frozenPiece.id]), false);
}

console.log("氷: 王も動けなければ手番を飛ばす");
{
  let s = startGame({ kings: ["8", "2"] });
  if (s.currentTurn !== 0) s = playQuiet(s);
  const t = s;
  // 相手(1)の王2を、凍った味方4体で囲む盤を組む(検査のためだけの細工。
  // 実際の氷は1体しか凍らせないが、飛ばしの決まり自体はこれで確かめられる)
  const u = { ...t, pieces: { ...t.pieces }, board: t.board.map((r) => r.map(() => null)) };
  const foe = mine(t, 1);
  const king = foe.find((p) => p.isKing);
  const others = foe.filter((p) => !p.isKing);
  const until = (t.turnNo || 0) + FREEZE_TURNS * 2;
  const place = (p, row, col) => {
    const q = { ...p, row, col, frozenUntil: p.isKing ? undefined : until };
    u.pieces[p.id] = q;
    u.board[row][col] = q;
  };
  place(king, 4, 4);
  const around = [[3, 4], [5, 4], [4, 3], [4, 5]];
  others.forEach((p, i) => (i < 4 ? place(p, ...around[i]) : (u.pieces[p.id] = { ...p, alive: false })));
  for (const p of others.slice(4)) u.players = u.players.map((pl, i) => (i === 1 ? { ...pl, capturedOwn: [...pl.capturedOwn, p.id] } : pl));
  // 自分の駒は端に並べ直す
  mine(t, 0).forEach((p, i) => place(p, 0, i));
  is("囲まれた王2には手が無い(凍った駒は数えない)", hasAction(u, 1), false);
  is("凍っていなければ手はある", hasAction({ ...u, turnNo: 999 }, 1), true);
  const v = playQuiet(u);
  is("手番が飛ばされて自分に戻る", v.currentTurn, 0);
  is("記録に残る", v.log.some((l) => l.includes("手番を飛ばした")), true);
  is("手番の通し番号は2つ進む", v.turnNo, u.turnNo + 2);
}

console.log("空: 本物の10に変身(公開)、軍の10は全て2回動く");
{
  let s = startGame({ kings: ["J", "2"] });
  if (s.currentTurn !== 0) s = playQuiet(s);
  // 王が J でも、ここでは空を試すために areas を差し替える(検査の細工)
  s = { ...s, areas: [{ type: "sky", used: false, rank: "J", skin: "x" }, null] };
  const target = mine(s, 0).find((p) => !p.isKing && p.rank !== "10" && p.rank !== "A");
  const before = s.players[0].armyRankCounts;
  is("王は候補にならない", reducer(s, { type: "USE_AREA", pieceId: s.players[0].kingId }) === s, true);
  const t = reducer(s, { type: "USE_AREA", pieceId: target.id });
  const piece = t.pieces[target.id];
  is("本物の10になる", piece.rank, "10");
  is("公開され、専用のしるしが付く", [piece.revealed, piece.mark], [true, "sky"]);
  is("採用枚数の表も追いかける", [t.players[0].armyRankCounts[target.rank] || 0, t.players[0].armyRankCounts["10"] || 0], [(before[target.rank] || 0) - 1, (before["10"] || 0) + 1]);
  is("軍に「10は2回」の印が立つ", t.players[0].skyTwice, true);
  is("相手の軍には立たない", !!t.players[1].skyTwice, false);
  const moves = getLegalMoves(piece, t.board, 9, t.players[0].armyRankCounts, kingRankOf(t, 0));
  is("桂馬跳びになる", moves.every((m) => Math.abs(m.row - piece.row) + Math.abs(m.col - piece.col) === 3), true);
  is("手番は消費しない", t.currentTurn, 0);
  const quiet = moves.find((m) => !t.board[m.row][m.col]);
  let u = reducer(t, { type: "MOVE_PIECE", pieceId: piece.id, row: quiet.row, col: quiet.col });
  is("1回目のあと、同じ駒でもう1回", u.extraMoveFor, piece.id);
  is("他の駒は動かせない", reducer(u, anyMove(u, 0, (p) => p.id !== piece.id)) === u, true);
  const again = getLegalMoves(u.pieces[piece.id], u.board, 9, u.players[0].armyRankCounts, kingRankOf(u, 0)).find((m) => !u.board[m.row][m.col]);
  u = reducer(u, { type: "MOVE_PIECE", pieceId: piece.id, row: again.row, col: again.col });
  is("2回目のあと手番が渡る", u.currentTurn, 1);
  is("記録に2回目が残る", u.log.some((l) => l.includes("2回目に移動")), true);
  // 元からいる10も2回動ける
  const other10 = mine(t, 0).find((p) => p.rank === "10" && p.id !== piece.id && !p.isKing);
  if (other10) {
    const mv = getLegalMoves(other10, t.board, 9, t.players[0].armyRankCounts, kingRankOf(t, 0)).find((m) => !t.board[m.row][m.col]);
    if (mv) {
      const w = reducer(t, { type: "MOVE_PIECE", pieceId: other10.id, row: mv.row, col: mv.col });
      is("元からいる10も2回動ける", w.extraMoveFor, other10.id);
    }
  }
}

console.log("宮殿: 昇格は手番を使う");
{
  let s = startGame({ kings: ["K", "3"] });
  is("Kの王は宮殿", s.areas[0].type, "palace");
  if (s.currentTurn !== 0) s = playQuiet(s);
  is("promotedRank は K まで", ["2", "9", "10", "J", "Q", "K", "A"].map(promotedRank), ["3", "10", "J", "Q", "K", null, null]);
  const nine = mine(s, 0).find((p) => !p.isKing && promotedRank(p.rank));
  const before = s.players[0].armyRankCounts;
  const t = reducer(s, { type: "USE_AREA", pieceId: nine.id });
  const up = promotedRank(nine.rank);
  is("1段上がる", t.pieces[nine.id].rank, up);
  is("公開され、専用のしるしが付く", [t.pieces[nine.id].revealed, t.pieces[nine.id].mark], [true, "palace"]);
  is("採用枚数の表も追いかける", [t.players[0].armyRankCounts[nine.rank] || 0, t.players[0].armyRankCounts[up] || 0], [(before[nine.rank] || 0) - 1, (before[up] || 0) + 1]);
  is("手番が渡る", t.currentTurn, 1);
  is("最初の採用合計(合計判定)は変えない", t.initialArmyTotals, s.initialArmyTotals);
  const ten = mine(s, 0).find((p) => p.rank === "10" || p.rank === "J" || p.rank === "Q");
  if (ten) {
    const w = reducer(s, { type: "USE_AREA", pieceId: ten.id });
    is("10 以上も1段上がる(採用枚数の制限は見ない)", w.pieces[ten.id].rank, promotedRank(ten.rank));
  }
  const kk = mine(s, 0).find((p) => p.rank === "K" && !p.isKing);
  if (kk) is("K はもう上がらない", reducer(s, { type: "USE_AREA", pieceId: kk.id }) === s, true);
  is("王は昇格できない", reducer(s, { type: "USE_AREA", pieceId: s.players[0].kingId }) === s, true);
}

console.log("使えない場面");
{
  let s = startGame({ kings: ["4", "4"] });
  const p = s.currentTurn;
  is("相手の番には使えない", canUseArea(s, 1 - p).ok, false);
  is("通信で届いた相手の名乗りは捨てる", reducer(s, { type: "USE_AREA", player: 1 - p }) === s, true);
  is("対局中以外は使えない", canUseArea({ ...s, phase: "gameover" }, p).ok, false);
}

console.log("再生: 同じ手の列で同じ盤になる(オンラインの前提)");
{
  const seed = 7;
  let rnd = seed;
  const random = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
  const realRandom = Math.random;
  Math.random = random;
  const acts = [];
  let s = startGame({ kings: ["6", "8"] });
  let guard = 0;
  while (s.phase !== "gameover" && guard++ < 160) {
    s = dismiss(s);
    let act = cpuAction(s, s.currentTurn);
    if (!act) break;
    if (act.type === "__CPU_SHUFFLE") {
      s = reducer(s, { type: "SELECT_PIECE", id: act.aceId });
      s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[0] });
      s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[1] });
      act = { type: "CONFIRM_SHUFFLE", aId: act.aceId, pickIds: act.pickIds };
    }
    act = enrichAction({ ...act, elapsedMs: 100 }, s);
    acts.push(act);
    s = reducer(s, act);
  }
  Math.random = realRandom;
  is("エリアが使われた", s.areas.some((a) => a && a.used), true);
  // 同じ開始局面から、焼き込んだ手をそのまま再生
  Math.random = (() => { let r = seed; return () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648; })();
  let t = startGame({ kings: ["6", "8"] });
  Math.random = realRandom;
  for (const act of acts) {
    t = dismiss(t);
    t = reducer(t, act);
  }
  const strip = (x) => JSON.stringify({ board: x.board, pieces: x.pieces, areas: x.areas, known: x.known, turnNo: x.turnNo, winner: x.winner });
  is("盤・駒・エリア・既知・手番が一致", strip(t) === strip(s), true);
}

console.log("CPU 同士で回しても盤が壊れない");
{
  const GAMES = Number(process.env.GAMES || 40);
  let problems = 0, used = 0, frozenMoves = 0, promoted = 0;
  for (let g = 0; g < GAMES; g++) {
    const ranks = ["2", "4", "6", "8", "10", "K", "3", "5", "7", "9", "J", "Q"];
    let s = startGame({ kings: [ranks[g % ranks.length], ranks[(g * 5 + 1) % ranks.length]] });
    let guard = 0;
    while (s.phase !== "gameover" && guard++ < 400) {
      s = dismiss(s);
      if (s.clocks[s.currentTurn] <= 0) { s = reducer(s, { type: "CLOCK_TIMEOUT", player: s.currentTurn }); continue; }
      let act = cpuAction(s, s.currentTurn);
      if (!act) break;
      if (act.type === "__CPU_SHUFFLE") {
        s = reducer(s, { type: "SELECT_PIECE", id: act.aceId });
        s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[0] });
        s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[1] });
        act = { type: "CONFIRM_SHUFFLE", aId: act.aceId, pickIds: act.pickIds };
      }
      if (act.type === "USE_AREA") used++;
      if (act.type === "MOVE_PIECE" && isFrozen(s, s.pieces[act.pieceId])) frozenMoves++;
      const next = reducer(s, enrichAction({ ...act, elapsedMs: 1000 }, s));
      if (act.type === "USE_AREA" && next.lastArea && next.lastArea.type === "palace") promoted++;
      s = next;
      // 不変条件
      const seen = new Set();
      for (const p of Object.values(s.pieces)) {
        if (!p.alive) continue;
        if (!inBounds(p.row, p.col, 9) || !s.board[p.row][p.col] || s.board[p.row][p.col].id !== p.id) problems++;
        const key = `${p.row},${p.col}`;
        if (seen.has(key)) problems++;
        seen.add(key);
      }
      const alive = Object.values(s.pieces).filter((p) => p.alive).length;
      const lost = s.players.reduce((n, p) => n + p.capturedOwn.length, 0);
      if (alive + lost !== Object.keys(s.pieces).length) problems++;
    }
  }
  is("盤の不整合", problems, 0);
  is("CPU がエリアを使っている", used > 0, true);
  is("CPU は凍った駒を動かそうとしない", frozenMoves, 0);
  console.log(`  ${GAMES}局、エリア発動 ${used} 回、昇格 ${promoted} 回`);
}

for (const f of fails) console.log("  NG  " + f);
console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) process.exit(1);
