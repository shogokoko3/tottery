/**
 * シーズン2(不思議の国のアリス)の能力を CPU が使うための判断。
 * 仕様は「シーズン2_不思議の国のアリス_仕様まとめ.md」。ルールの処理は alice-rules.js が持つ。
 *
 * 公開情報と、自分が見抜いた情報だけで決める(伏せた相手の数字・王かどうかは読まない)。
 * 相手のチェシャ猫の幻は aliceView で相手側の見え方にそろえてから考える。
 */
import {
  hasAliceRules,
  aliceKing,
  aliceSkin,
  aliceField,
  aliceBoard,
  emptyCells,
  reverseCandidates,
  reverseLimit,
} from "./alice-rules.js";
import { getLegalMoves, kingRankOf, territoryRows, pointInTriangle } from "./board.js";
import { isFrozen, isKnownTo } from "./areas.js";
import { knownThreats } from "./cpu-tactics.js";

export const ALICE_VALUE = {
  A: 5, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 4, 9: 4, 10: 5, J: 6, Q: 6, K: 7, tea: 4,
};
const INVERSE = { 2: "K", 3: "Q", 4: "J", 5: "10", 6: "9", 7: "8", 8: "7", 9: "6", 10: "5", J: "4", Q: "3", K: "2" };
const UNKNOWN_VALUE = 4;
const KING_VALUE = 30;

/**
 * 調整値。検証(tools/alice-arena.mjs の PROFILE)が globalThis.TOTTERY_ALICE_CPU で差し替える。
 * 画面では未定義なので既定のまま。読むのは使う瞬間(import の順に依らない)
 */
// 既定は 2026-10-16 の検証(tools/alice-arena.mjs、reports/alice-tactics/検証レポート.md)で決めた値。
// 検証前の挙動は PROFILE=legacy(tools/alice-arena-profiles.json)で再現できる
export const KNOB_DEFAULTS = {
  // 王を選ぶときの、アリスのスキンの数字ごとの加点。固定の王で測った勝率の順(2・8 > 3・4・9 > 10)。
  // K は宮殿と同じ +4 が付くぶんを打ち消す(ハートの王はクロッケーの運に頼る割に勝率が低い)
  kingBonus: { 2: 14, 3: 12, 4: 12, 8: 14, 9: 12, 10: 7, K: -4 },
  kinBonus: { 2: 3, 3: 3 }, // 2・3 の王は同じ数字が1枚増えるごとに帰還が1回増え、射程も2マス伸びる
  avoidCaucusKing: 0,   // 布陣で、コーカス・レースで回るマスに王を置いたときの減点(効果は未確認)
  soldiersNearKing: 2,  // ハートの王の布陣で、王の5×5にいるトランプ兵1体ごとの加点(クロッケーの弾)
  encircleGuard: 1,     // 相手の A の包囲(3駒の三角形の内側)に王を置かない強さ(1 で減点 30)
  encirclePieceGuard: 0, // 王以外の駒も三角形の内側を避ける強さ。付けると攻めが鈍って逆に負けた
  reviveCourage: 1,     // 帰還の残る 2・3 の王が、危ないマスへも踏み込む度合い(0〜1)
  croquetHint: 1,       // 相手がクロッケーで飛ばした元の位置(王の5×5)から、相手の王の居場所を読む強さ
  croquetBackBias: 2,   // クロッケーの狙いで、相手の後列の伏せ駒1体ごとの加点
  teaMax: 5,            // ティーカップを手番を使って出す上限(増やすと手番を失って大きく負けた)
  // 引き直しの釣り(2026-10-16 本人の指示で CPU の「構成に入らない札だけ(最大4枚)」の癖を外して測った)。
  // 構成に入る札のうち値打ち 4 以下(2〜9。王・王と同じ数字・A は残す)を弱い順に 4 枚まで捨てて引き直す。
  // 2 の王 77→82%、3 の王 70→84%、8 の王 77→78%、シリーズ全体 68.5→72.5%。8 枚だと 2 は 85% だが 8 とシリーズ全体は下がる
  mulliganFish: 4,      // 構成に入る札のうち弱いものも捨てて釣りに行く枚数(0 で構成に入らない札だけ)
  reversalLowBonus: 0,  // アリスの A を装備し A を採用する編成で、逆転で化ける 2〜5 の札 1 枚ごとの加点(2→K, 3→Q, 4→J, 5→10)
  mulliganFishValue: 4, // 釣りで捨てる札の値打ちの上限(CARD_VALUE。3 なら 2〜5、4 なら 6〜9 まで)
  teaCap: 12,           // これ以上の手があるときは召喚しない(取れる手=12)
};
export const knob = (key) =>
  globalThis.TOTTERY_ALICE_CPU && key in globalThis.TOTTERY_ALICE_CPU ? globalThis.TOTTERY_ALICE_CPU[key] : KNOB_DEFAULTS[key];

const turnOf = (s) => s.turnNo || 0;
const alivePieces = (s, owner = null) =>
  Object.values(s.pieces).filter((p) => p.alive && (owner == null || p.owner === owner));
const usedThisTurn = (s, player, key) => s.aliceUsed?.[player]?.[key] === turnOf(s);
const cheb = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
const act = (player, kind, extra = {}) => ({ type: "ALICE_ACTION", kind, player, ...extra });

/** その駒の見込みの強さ。相手の伏せ札は数字を読まずに平均で見る */
function worth(s, viewer, p) {
  if (!p) return 0;
  if (p.owner === viewer) return p.isKing ? KING_VALUE : ALICE_VALUE[p.rank] ?? UNKNOWN_VALUE;
  if (!isKnownTo(s, viewer, p)) return UNKNOWN_VALUE;
  return p.isKing ? KING_VALUE : ALICE_VALUE[p.rank] ?? UNKNOWN_VALUE;
}

/**
 * CPU から見た盤。相手のチェシャ猫が騙した駒は、見せかけの位置にいるものとして扱う。
 * 盤だけでなく駒の座標もそろえる(王の見当や距離の計算が実体の位置を読まないように)。
 */
export function aliceView(s, player) {
  if (!hasAliceRules(s)) return s;
  const board = aliceBoard(s, player);
  if (board === s.board) return s;
  const pieces = { ...s.pieces };
  for (const p of alivePieces(s, 1 - player)) {
    if (!p.illusion || p.illusion.until <= turnOf(s)) continue;
    // 煙を取られた幻は、もう盤に無いものとして扱う(実体の位置は知らない)
    pieces[p.id] = p.illusion.dispelled
      ? { ...p, row: -1, col: -1 }
      : { ...p, row: p.illusion.row, col: p.illusion.col };
  }
  return { ...s, board, pieces };
}

/** CPU の判断用に、アリスのAを通常の入れ替えの候補から外した盤(入れ替えは使えないため) */
export function withoutAliceAceShuffle(s, player) {
  if (!hasAliceRules(s) || !aliceSkin(s, player, "A")) return s;
  const pieces = { ...s.pieces };
  let changed = false;
  for (const p of alivePieces(s, player))
    if (p.rank === "A" && !p.movementRank) {
      pieces[p.id] = { ...p, frozenUntil: turnOf(s) + 99 };
      changed = true;
    }
  if (!changed) return s;
  return { ...s, pieces, board: s.board.map((r) => r.map((p) => (p && pieces[p.id] ? pieces[p.id] : p))) };
}

/** 相手の次の手で取られそうな自分の駒。正体の分からない相手は、となりのマスだけを脅威にする */
export function threatenedOwn(s, player, board = s.board) {
  const size = s.boardSize;
  const foe = 1 - player;
  const hit = new Set();
  for (const e of alivePieces(s, foe)) {
    if (e.row < 0) continue;
    if (isKnownTo(s, player, e) && (e.rank !== "A" || e.movementRank)) {
      const moves = getLegalMoves(e, board, size, s.players[foe].armyRankCounts, kingRankOf(s, foe));
      for (const m of moves) {
        const t = board[m.row]?.[m.col];
        if (t && t.owner === player) hit.add(t.id);
        for (const c of m.captures || []) {
          const x = board[c.row]?.[c.col];
          if (x && x.owner === player) hit.add(x.id);
        }
      }
    } else {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const t = board[e.row + dr]?.[e.col + dc];
          if (t && t.owner === player) hit.add(t.id);
        }
    }
  }
  return hit;
}

/** 自分の駒が取れる相手の駒の見込みの合計(盤を回したときの比較に使う) */
function attackScore(s, player, board) {
  const size = s.boardSize;
  let score = 0;
  for (const p of alivePieces(s, player)) {
    const at = findOn(board, p.id);
    if (!at || (p.rank === "A" && !p.movementRank) || isFrozen(s, p)) continue;
    const moved = { ...p, row: at.row, col: at.col };
    let best = 0;
    for (const m of getLegalMoves(moved, board, size, s.players[player].armyRankCounts, kingRankOf(s, player))) {
      const t = board[m.row][m.col];
      if (t && t.owner !== player && !t.barrier) best = Math.max(best, worth(s, player, t));
    }
    score += best;
  }
  return score;
}
function findOn(board, id) {
  for (let r = 0; r < board.length; r++)
    for (let c = 0; c < board.length; c++) if (board[r][c]?.id === id) return { row: r, col: c };
  return null;
}
function riskScore(s, player, board) {
  const pieces = {};
  for (let r = 0; r < board.length; r++)
    for (let c = 0; c < board.length; c++) if (board[r][c]) pieces[board[r][c].id] = { ...board[r][c], row: r, col: c };
  const moved = { ...s, pieces: { ...s.pieces, ...pieces }, board };
  let score = 0;
  for (const id of threatenedOwn(moved, player, board)) score += worth(s, player, s.pieces[id]);
  return score;
}

/* ---------------------------- 決着待ちの選択 ---------------------------- */

/** 相手の駒から遠い、自陣の空きマス */
function safestCell(s, player, cells) {
  const foes = alivePieces(s, 1 - player);
  let best = null;
  for (const c of cells) {
    const d = foes.length ? Math.min(...foes.map((f) => cheb(f, c))) : 9;
    const score = d + Math.random() * 0.3;
    if (!best || score > best.score) best = { ...c, score };
  }
  return best && { row: best.row, col: best.col };
}

/** 仲間にした駒は、自陣の最前列の真ん中寄りに置く */
function recruitCell(s, player) {
  const size = s.boardSize;
  // 置けるのは自陣の空きマスだけ(Kの予備札と同じ決まり)。空きがなければ見送る
  const cells = emptyCells(s, player);
  if (!cells.length) return null;
  const [lo, hi] = territoryRows(size, player);
  const front = player === 0 ? lo : hi;
  const mid = Math.floor(size / 2);
  cells.sort((a, b) => Math.abs(a.row - front) - Math.abs(b.row - front) || Math.abs(a.col - mid) - Math.abs(b.col - mid));
  return cells[0];
}

/** 仲間にするか・王を戻す場所。どちらも手番に関係なく、待っている側が選ぶ */
export function alicePendingAction(s, player) {
  if (s.aliceRecruit?.length) {
    if (s.aliceRecruit[0].owner !== player) return null;
    const at = recruitCell(s, player);
    return at ? act(player, "recruit", at) : act(player, "decline");
  }
  if (s.aliceRevive) {
    if (s.aliceRevive.owner !== player) return null;
    const at = safestCell(s, player, emptyCells(s, player));
    return at ? act(player, "revive", at) : null;
  }
  return null;
}

/* ---------------------------- 手番を使わない能力 ---------------------------- */

/** アリスの数字の逆転で、選んだ駒が自分にとってどれだけ得か */
function reverseGain(s, player, p) {
  if (p.tea || !INVERSE[p.rank]) return 0;
  const before = ALICE_VALUE[p.rank], after = ALICE_VALUE[INVERSE[p.rank]];
  if (p.owner === player) return after - before;
  if (!isKnownTo(s, player, p)) return 0;
  return before - after;
}

function aliceReverse(s, player) {
  for (const ace of alivePieces(s, player)) {
    if (ace.rank !== "A" || ace.movementRank || isFrozen(s, ace) || !aliceSkin(s, player, "A")) continue;
    if (usedThisTurn(s, player, `reverse-${ace.id}`)) continue;
    const limit = reverseLimit(s, ace);
    if (!limit) continue;
    const scored = reverseCandidates(s, ace)
      .map((p) => ({ id: p.id, gain: reverseGain(s, player, p) + Math.random() * 0.2 }))
      .sort((a, b) => b.gain - a.gain);
    const picks = scored.slice(0, limit);
    const total = picks.reduce((t, p) => t + p.gain, 0);
    // 王でないアリスは位置が公開されるので、はっきり得なときだけ使う
    if (total >= (ace.isKing ? 0.5 : 2)) return act(player, "reverse", { aId: ace.id, pickIds: picks.map((p) => p.id) });
  }
  return null;
}

function aliceRevolution(s, player) {
  if (!s.areasEnabled || usedThisTurn(s, player, "revolution")) return null;
  const ace = alivePieces(s, player).find(
    (p) => p.rank === "A" && aliceSkin(s, player, "A") && s.areaLoadouts?.[player]?.A?.endsWith(":foil") && !isFrozen(s, p),
  );
  if (!ace) return null;
  const pool = alivePieces(s).filter(
    (p) => !p.tea && !(p.reverseUntil > turnOf(s)) && (p.owner === player || !p.barrier) &&
      (p.owner === player ? !p.isKing && p.rank !== "A" : !p.isKing),
  );
  if (!pool.length) return null;
  // 抽選なので、平均して得になるときだけ回す
  const mean = pool.reduce((t, p) => t + reverseGain(s, player, p), 0) / pool.length;
  return mean > 0 ? act(player, "revolution") : null;
}

function kingPower(s, player, best) {
  const k = aliceKing(s, player);
  if (!k || isFrozen(s, k)) return null;
  const rank = k.rank;
  const charges = s.aliceCharges?.[k.id] || 0;
  if (rank === "4") {
    if (charges >= 3 || usedThisTurn(s, player, "king") || k.barrier) return null;
    const threatened = threatenedOwn(s, player);
    const atRisk = [...threatened].reduce((t, id) => t + worth(s, player, s.pieces[id]), 0);
    // 王が狙われているとき、または大きく取られそうなときにだけ張る(3回しかない)
    return threatened.has(k.id) || atRisk >= 10 ? act(player, "king") : null;
  }
  if (rank === "5") {
    const fakes = alivePieces(s, player).filter((p) => p.falseKing).length;
    if (charges >= 3 || fakes >= 3) return null;
    // 前に出ている駒ほど狙われる。そこに偽の王を置いて、取りに来た駒を止める
    const [lo, hi] = territoryRows(s.boardSize, 1 - player);
    const goal = player === 0 ? hi : lo;
    const pick = alivePieces(s, player)
      .filter((p) => !p.isKing && !p.falseKing && !p.tea)
      .sort((a, b) => Math.abs(a.row - goal) - Math.abs(b.row - goal))[0];
    return pick ? act(player, "king", { pickIds: [pick.id] }) : null;
  }
  if (usedThisTurn(s, player, "king")) return null;
  if (rank === "6") {
    const clock = s.clocks?.[1 - player];
    return Array.isArray(s.clocks) && clock > 10000 ? act(player, "king") : null;
  }
  if (rank === "7") {
    const left = alivePieces(s, 1 - player).filter((p) => !p.tea && !p.ownerHidden && !p.barrier);
    return left.length ? act(player, "king") : null;
  }
  return null;
}

/** ティーカップの召喚(手番を使う)。取れる手が無いときに、数が少なければ出す */
export function teaSummon(s, player, best) {
  const k = aliceKing(s, player);
  if (!k || !["8", "9"].includes(k.rank) || isFrozen(s, k) || usedThisTurn(s, player, "king")) return null;
  if (best && best.score >= knob("teaCap")) return null;
  if (!emptyCells(s, player).length) return null;
  const cups = alivePieces(s, player).filter((p) => p.tea).length;
  if (cups >= knob("teaMax")) return null;
  if (threatenedOwn(s, player).has(k.id)) return null;
  return act(player, "king");
}

/* ---------------------------- 盤面効果 ---------------------------- */

const CAUCUS = (() => {
  const out = [];
  for (let d = 1; d <= 4; d++) {
    out.push([4 - d, 4], [4 + d, 4], [4, 4 - d], [4, 4 + d]);
    if (d >= 3) {
      const v = d - 1;
      out.push([4 - v, 4 - v], [4 - v, 4 + v], [4 + v, 4 - v], [4 + v, 4 + v]);
    }
  }
  return out;
})();

function caucus(s, player) {
  if (s.boardSize !== 9) return null;
  const board = s.board.map((r) => [...r]);
  for (const [r, c] of CAUCUS) board[8 - r][8 - c] = s.board[r][c];
  const before = attackScore(s, player, s.board) - riskScore(s, player, s.board);
  const after = attackScore(s, player, board) - riskScore(s, player, board);
  return after - before >= 3 ? act(player, "field") : null;
}

function quadrille(s, player) {
  const k = aliceKing(s, player);
  const mine = alivePieces(s, player).filter((p) => !p.isKing && !p.tea && p.rank !== "A" && INVERSE[p.rank]);
  if (!k || !mine.length) return null;
  // 動きの弱い自分の駒(2・3)の動きを、王に近い相手の強そうな駒に写す
  const source = mine.sort((a, b) => ALICE_VALUE[a.rank] - ALICE_VALUE[b.rank])[0];
  if (ALICE_VALUE[source.rank] > 3) return null;
  const targets = alivePieces(s, 1 - player)
    .filter((p) => !p.barrier && p.row >= 0)
    .map((p) => ({ p, score: worth(s, player, p) * (p.isKing ? 0.1 : 1) + Math.max(0, 5 - cheb(p, k)) * 2 + Math.random() * 0.2 }))
    .sort((a, b) => b.score - a.score);
  if (!targets.length || targets[0].score < 8) return null;
  return act(player, "field", { pickIds: [source.id, targets[0].p.id] });
}

function teaParty(s, player) {
  return alivePieces(s).length < 18 && emptyCells(s, player).length ? act(player, "field") : null;
}

function illusion(s, player) {
  const k = aliceKing(s, player);
  if (!k) return null;
  const foe = 1 - player;
  const knownKing = k.revealed || s.known?.[foe]?.[k.id];
  const threatened = threatenedOwn(s, player);
  if (!knownKing && !threatened.has(k.id)) return null;
  // 王を、相手から遠い伏せた仲間と入れ替えて、居場所を分からなくする
  const foes = alivePieces(s, foe).filter((p) => p.row >= 0);
  const far = (p) => (foes.length ? Math.min(...foes.map((f) => cheb(f, p))) : 9);
  const partner = alivePieces(s, player)
    .filter((p) => !p.isKing && !p.tea)
    .sort((a, b) => far(b) - far(a))[0];
  return partner && far(partner) > far(k) ? act(player, "field", { pickIds: [k.id, partner.id] }) : null;
}

function croquet(s, player) {
  const k = aliceKing(s, player);
  if (!k) return null;
  const size = s.boardSize;
  const soldiers = alivePieces(s, player).filter((p) => p.soldier && cheb(p, k) <= 2 && !isFrozen(s, p));
  if (!soldiers.length) return null;
  const soldier = soldiers.sort((a, b) => ALICE_VALUE[a.rank] - ALICE_VALUE[b.rank])[0];
  // 王は後列にいがち。伏せた駒が相手の後列にあれば、その分だけ狙いに重みを付ける(相手の伏せ札は読まない)
  const backBias = knob("croquetBackBias");
  const [flo, fhi] = territoryRows(size, 1 - player);
  const backRow = 1 - player === 0 ? flo : fhi;
  let best = null;
  for (const e of alivePieces(s, 1 - player)) {
    if (e.row < 0) continue;
    for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const row = e.row + dr, col = e.col + dc;
      if (row < 0 || col < 0 || row >= size || col >= size) continue;
      const cells = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]
        .map(([r, c]) => ({ row: row + r, col: col + c }))
        .filter((c) => c.row >= 0 && c.col >= 0 && c.row < size && c.col < size);
      let ev = 0;
      for (const c of cells) {
        const t = s.board[c.row][c.col];
        if (!t || t.id === soldier.id) continue;
        if (t.owner === player) ev -= worth(s, player, t) + ALICE_VALUE[soldier.rank];
        else if (!t.barrier) ev += worth(s, player, t) - ALICE_VALUE[soldier.rank] + (backBias && !isKnownTo(s, player, t) && t.row === backRow ? backBias : 0);
      }
      ev /= cells.length;
      if (!best || ev > best.ev) best = { ev, row, col };
    }
  }
  return best && best.ev > 0.5 ? act(player, "field", { pickIds: [soldier.id], row: best.row, col: best.col }) : null;
}

function fieldEffect(s, player) {
  if (usedThisTurn(s, player, "field")) return null;
  switch (aliceField(s, player)) {
    case "alice-caucus": return caucus(s, player);
    case "alice-quadrille": return quadrille(s, player);
    case "alice-tea": return teaParty(s, player);
    case "alice-illusion": return illusion(s, player);
    case "alice-croquet": return croquet(s, player);
    default: return null; // 迷いの森は自動で働く
  }
}

/* ---------------------------- 相手に合わせた指し方(informedPlay が足す) ---------------------------- */

/** 相手の A が生きていて包囲(入れ替え)を使えそうか。A は伏せているので、A でないと分かった駒以外は候補 */
function foeAceMayStrike(s, player) {
  const foe = 1 - player;
  // アリスのスキンの A は入れ替えの代わりに数字の逆転を使うので、包囲は無い
  if (hasAliceRules(s) && aliceSkin(s, foe, "A")) return false;
  let hidden = 0;
  for (const p of alivePieces(s, foe)) {
    if (p.row < 0) continue;
    if (isKnownTo(s, player, p)) { if (p.rank === "A" && !p.movementRank && !isFrozen(s, p)) return true; }
    else hidden++;
  }
  return hidden > 0;
}
/** そのマスが、相手の駒3つが作る三角形の内側にあるか(いくつの三角形に入るか) */
function trianglesAround(cell, foes) {
  let n = 0;
  for (let i = 0; i < foes.length; i++)
    for (let j = i + 1; j < foes.length; j++)
      for (let k = j + 1; k < foes.length; k++)
        if (pointInTriangle(cell, foes[i], foes[j], foes[k])) n++;
  return n;
}
/**
 * 相手の盤面効果・技を見て、手の点数を足し引きする。公開情報だけを使う。
 * - 包囲の回避: 相手の A の入れ替えで囲まれる三角形の内側に王を置かない(どのシリーズの相手にも)
 * - 帰還の攻めっ気: 帰還の残る 2・3 の王は、危ないマスへも踏み込む
 * - クロッケーの読み: 相手が飛ばした元の位置(王の5×5の中)から、相手の王の候補を絞る
 */
export function aliceAdaptScore(s, player, p, move, capturedIds = new Set()) {
  let score = 0;
  const foe = 1 - player;
  const foes = alivePieces(s, foe).filter((e) => e.row >= 0 && !capturedIds.has(e.id));
  const king = alivePieces(s, player).find((q) => q.isKing);
  const guard = knob("encircleGuard"), pieceGuard = knob("encirclePieceGuard");
  if ((guard || pieceGuard) && king && foes.length >= 3 && foeAceMayStrike(s, player)) {
    if (guard) {
      const kingAt = p.isKing ? { row: move.row, col: move.col } : king;
      const n = trianglesAround(kingAt, foes);
      if (n) score -= guard * (30 + Math.min(4, n - 1) * 5);
    }
    if (pieceGuard && !p.isKing && p.rank !== "A") {
      const m = trianglesAround({ row: move.row, col: move.col }, foes);
      if (m) score -= pieceGuard * (ALICE_VALUE[p.rank] || UNKNOWN_VALUE) * 0.8;
    }
  }
  if (!hasAliceRules(s)) return score;
  const courage = knob("reviveCourage");
  if (courage && p.isKing && ["2", "3"].includes(p.rank) && aliceSkin(s, player, p.rank)) {
    const total = s.players[player].armyRankCounts?.[p.rank] || 1;
    const left = total - (s.aliceRevives?.[p.id] || 0);
    if (left > 0 && emptyCells(s, player).length) {
      // 王を動かす減点(-2)を戻し、危ないマスの減点(-65)の一部を戻す。帰還が多く残るほど強気
      const f = courage * Math.min(1, left / 2);
      score += 2 * f;
      const board = s.board.map((r) => r.slice());
      board[p.row][p.col] = null;
      board[move.row][move.col] = { ...p, row: move.row, col: move.col };
      if (knownThreats(s, player, board, capturedIds).has(`${move.row}/${move.col}`)) score += 45 * f;
    }
  }
  const hint = knob("croquetHint");
  const last = s.lastAlicePower;
  if (hint && last && last.owner === foe && last.kind === "field" && ["J", "Q", "K"].includes(last.rank) && last.presentation?.from && last.at >= turnOf(s) - 1) {
    const from = last.presentation.from;
    const candidates = foes.filter((e) => !isKnownTo(s, player, e) && cheb(e, from) <= 2);
    if (candidates.length) {
      const w = hint / candidates.length;
      for (const c of candidates) {
        if (capturedIds.has(c.id)) score += 60 * w;
        else score += 2 * w * (cheb(p, c) - cheb({ row: move.row, col: move.col }, c));
      }
    }
  }
  return score;
}

/**
 * 手番の初めに使う、手番を消費しない能力。使うものが無ければ null。
 * 呼ぶ側は、これを返したあとにもう一度 CPU に聞く(1つずつ順に使う)。
 */
export function aliceFreeAction(s, player) {
  if (!hasAliceRules(s) || s.phase !== "play" || s.currentTurn !== player) return null;
  if (s.extraMoveFor || s.aliceCommitted || s.selectedId || s.shuffleMode) return null;
  return aliceRevolution(s, player) || aliceReverse(s, player) || kingPower(s, player) || fieldEffect(s, player);
}

/**
 * 決まった移動を、アリスの決まりに合わせて仕上げる。
 * - 自分で正体の見えない駒は、先に「動かす」と確定する
 * - チェシャ猫の王なら、同じ駒の別の行き先(空きマス)を騙す位置にする
 */
export function finishAliceMove(s, player, move) {
  if (!move || move.type !== "MOVE_PIECE" || !hasAliceRules(s)) return move;
  const piece = s.pieces[move.pieceId];
  if (piece?.ownerHidden && !s.aliceCommitted) return act(player, "unmask", { pickIds: [piece.id] });
  const k = aliceKing(s, player);
  if (k?.rank !== "10" || !piece) return move;
  const board = aliceBoard(s, player);
  const options = getLegalMoves(piece, board, s.boardSize, s.players[player].armyRankCounts, kingRankOf(s, player))
    .filter((m) => !board[m.row][m.col] && !s.board[m.row][m.col] && !(m.row === move.row && m.col === move.col));
  if (!options.length) return move;
  // 本当の行き先から一番離れた空きマスを見せる
  options.sort((a, b) => cheb(b, move) - cheb(a, move) + (Math.random() - 0.5) * 0.5);
  return { ...move, fakeRow: options[0].row, fakeCol: options[0].col };
}

/* ---------------------------- 編成・布陣(手札だけで決める。相手は読まない) ---------------------------- */

/** 王を選ぶときの、アリスのスキンの王の値打ち(cpu-strategy.js の chooseArmyPlan が足す) */
export function aliceKingBonus(s, player, rank) {
  if (!hasAliceRules(s) || !aliceSkin(s, player, rank)) return 0;
  return knob("kingBonus")[rank] || 0;
}
/** 引き直しの釣りの枚数。アリスのスキンの王のときだけ(最初のシリーズの CPU は従来どおり構成に入らない札だけ) */
export function aliceMulliganFish(s, player, kingRank) {
  if (!hasAliceRules(s) || !aliceSkin(s, player, kingRank)) return 0;
  return knob("mulliganFish") || 0;
}
/**
 * アリスの A(数字の逆転)を装備しているとき、2〜5 の札は逆転で K・Q・J・10 に化けるので採用の値打ちが上がる。
 * 王のシリーズは問わない(レジェンドの K にアリスの A を混ぜる、など)。A が編成に入っていないときは 0
 */
export function aliceReversalBonus(s, player, rank, hasAce) {
  if (!hasAce || !hasAliceRules(s) || !aliceSkin(s, player, "A")) return 0;
  const bonus = knob("reversalLowBonus");
  return bonus && ["2", "3", "4", "5"].includes(rank) ? bonus : 0;
}
/** 王と同じ数字をもう1枚採用する値打ち(2・3 の帰還は採用枚数分、など) */
export function aliceKinBonus(s, player, kingRank) {
  if (!hasAliceRules(s) || !aliceSkin(s, player, kingRank)) return 0;
  return knob("kinBonus")[kingRank] || 0;
}
/** コーカス・レースで回るマス(9×9)。王をここに置くと相手の回転で運ばれる */
const CAUCUS_CELLS = new Set(CAUCUS.map(([r, c]) => `${r}/${c}`));
export const isCaucusCell = (row, col) => CAUCUS_CELLS.has(`${row}/${col}`);
/**
 * 布陣の加点(cpu-strategy.js の arrangeArmy が formationMetrics に足す)。
 * 相手の装備や布陣は読まない。自分の王のスキンと、盤の形だけで決める
 */
export function aliceFormationBonus(s, player, plan, placement) {
  if (!hasAliceRules(s) || s.boardSize !== 9) return 0;
  const king = placement[plan.kingId];
  if (!king) return 0;
  let score = 0;
  const avoid = knob("avoidCaucusKing");
  if (avoid && isCaucusCell(king.row, king.col)) score -= avoid;
  const near = knob("soldiersNearKing");
  if (near && ["J", "Q", "K"].includes(plan.kingRank) && aliceSkin(s, player, plan.kingRank)) {
    for (const c of plan.cards) {
      if (c.id === plan.kingId || ["A", "J", "Q", "K"].includes(c.rank)) continue;
      const at = placement[c.id];
      if (at && Math.max(Math.abs(at.row - king.row), Math.abs(at.col - king.col)) <= 2) score += near;
    }
  }
  return score;
}

/** ハートの王の編成ではAを採用できない。Aを外して、残りの手札で埋める */
export function aliceSetupFix(s, player, kingId, placement) {
  if (!hasAliceRules(s)) return placement;
  const hand = s.players[player].hand;
  const king = hand.find((c) => c.id === kingId);
  if (!king || !["J", "Q", "K"].includes(king.rank) || !aliceSkin(s, player, king.rank)) return placement;
  if (s.kingPowers === false) return placement;
  const out = { ...placement };
  const used = new Set(Object.keys(out));
  const counts = {};
  for (const id of used) {
    const r = hand.find((c) => c.id === id)?.rank;
    counts[r] = (counts[r] || 0) + 1;
  }
  // 採用の上限(J・Q は2枚、王がKなら1枚。Kは王のときだけ)
  const room = (rank) =>
    rank === "K" ? false : ["J", "Q"].includes(rank) ? (counts[rank] || 0) < (king.rank === "K" ? 1 : 2) : (counts[rank] || 0) < 4;
  for (const id of Object.keys(out)) {
    if (hand.find((c) => c.id === id)?.rank !== "A") continue;
    const at = out[id];
    delete out[id];
    counts.A--;
    const spare = hand
      .filter((c) => !used.has(c.id) && c.rank !== "A" && room(c.rank))
      .sort((a, b) => (ALICE_VALUE[b.rank] || 0) - (ALICE_VALUE[a.rank] || 0))[0];
    if (spare) {
      out[spare.id] = at;
      used.add(spare.id);
      counts[spare.rank] = (counts[spare.rank] || 0) + 1;
    }
  }
  return out;
}

/** 王に選べる札か(reducer の SETUP_PICK_KING と同じ線) */
export function aliceKingPickOk(s, player, card, placement) {
  const hand = s.players[player].hand;
  const ranks = Object.keys(placement).map((id) => hand.find((c) => c.id === id)?.rank);
  if (card.rank === "A") return false;
  if (ranks.includes("K") && card.rank !== "K") return false;
  if (hasAliceRules(s) && s.kingPowers !== false && aliceSkin(s, player, card.rank) && ["J", "Q", "K"].includes(card.rank) && ranks.includes("A"))
    return false;
  return true;
}

/**
 * 自動で並べた布陣に、王に選べる札が無いとき(ハートの王のKとAが両方入ったとき)の作り直し。
 * まずKを王にしてAを外す。それで埋まらなければ、KとAを外して別の札で埋め、残りから王を選ぶ。
 */
export function aliceRepairSetup(s, player, placement, slots, score = (c) => ALICE_VALUE[c.rank] || 0) {
  const hand = s.players[player].hand;
  const k = Object.keys(placement).map((id) => hand.find((c) => c.id === id)).find((c) => c?.rank === "K");
  if (k) {
    const fixed = aliceSetupFix(s, player, k.id, placement);
    if (Object.keys(fixed).length >= slots) return { placement: fixed, kingId: k.id };
  }
  const out = { ...placement };
  const freed = [];
  for (const id of Object.keys(out)) {
    const r = hand.find((c) => c.id === id)?.rank;
    if (r === "K" || r === "A") { freed.push(out[id]); delete out[id]; }
  }
  const counts = {};
  for (const id of Object.keys(out)) {
    const r = hand.find((c) => c.id === id).rank;
    counts[r] = (counts[r] || 0) + 1;
  }
  const spares = hand
    .filter((c) => !out[c.id] && !["K", "A"].includes(c.rank))
    .sort((a, b) => score(b) - score(a));
  for (const at of freed) {
    const c = spares.find((x) => !out[x.id] && (counts[x.rank] || 0) < (["J", "Q"].includes(x.rank) ? 2 : 4));
    if (!c) continue;
    out[c.id] = at;
    counts[c.rank] = (counts[c.rank] || 0) + 1;
  }
  const kings = Object.keys(out)
    .map((id) => hand.find((c) => c.id === id))
    .filter((c) => aliceKingPickOk(s, player, c, out))
    .sort((a, b) => score(b) - score(a));
  return kings.length && Object.keys(out).length >= slots ? { placement: out, kingId: kings[0].id } : null;
}
