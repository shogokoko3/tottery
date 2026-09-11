/**
 * 布陣ボーナスの「両者の確認」(ルール版13)の検査。
 *
 *   通信の対局(START_SETUP が通信に載った手 = __id か席の名乗りがある)で布陣ボーナスが出たら、両者が
 *   ACK_SETUP_EFFECTS を出すまで指し手・時間切れを受け付けない。
 *   ボーナスが無い対局、版12以前、手元の対局(CPU・同じ端末)では何も変わらない。
 */
import assert from "node:assert/strict";
import { reducer, autoPickKing, setupWaiting } from "../src/game/reducer.js";
import { buildDeck, territoryRows, totalSlots, getLegalMoves, kingRankOf } from "../src/game/board.js";
import { GAME_RULE_VERSION, hasBonusAckRules } from "../src/game/rule-version.js";
import { acceptAct, NET_ACTIONS } from "../src/net/sync.js";

assert.equal(GAME_RULE_VERSION, 13);
assert.equal(hasBonusAckRules(13), true);
assert.equal(hasBonusAckRules(12), false);
assert.ok(NET_ACTIONS.has("ACK_SETUP_EFFECTS"), "確認の合図は通信で送る");

function stack(hand0, hand1) {
  const full = buildDeck(null);
  const take = (spec) =>
    spec.map(([rank, suit]) => {
      const i = full.findIndex((c) => c.rank === rank && c.suit === suit);
      if (i < 0) throw new Error(`${rank}${suit} が無い`);
      return full.splice(i, 1)[0];
    });
  const h0 = take(hand0), h1 = take(hand1);
  while (h0.length < 5) h0.push(full.shift());
  while (h1.length < 5) h1.push(full.shift());
  return { deck: [...h0, ...h1, ...full], handSize: 5 };
}
const STRAIGHT = [["2", "spade"], ["3", "heart"], ["4", "diamond"], ["5", "club"], ["6", "spade"]];
const PLAIN = [["2", "heart"], ["4", "club"], ["7", "spade"], ["9", "diamond"], ["K", "heart"]];
const PLAIN_B = [["3", "spade"], ["6", "heart"], ["8", "diamond"], ["10", "club"], ["Q", "spade"]];

function toSetup(s) {
  for (let guard = 0; s.phase !== "setup" && guard < 60; guard++) {
    if (s.interstitial) { s = reducer(s, { type: "DISMISS_INTERSTITIAL" }); continue; }
    if (s.phase === "dice")
      s = reducer(s, s.dice[s.diceIdx] === null
        ? { type: "ROLL_DICE_SINGLE", value: s.diceIdx === 0 ? 6 : 1 }
        : s.diceIdx === 2 ? { type: "GOTO_MULLIGAN" } : s.diceIdx === 3 ? { type: "REROLL_DICE" } : { type: "NEXT_DICE_STEP" });
    else if (s.phase === "mulligan") s = reducer(s, { type: "CONFIRM_MULLIGAN", discardIds: [] });
    else break;
  }
  return s;
}
/** 布陣まで進めて両者が確定する。online なら START_SETUP に __id を付ける(通信に載せた手) */
function start({ hands, online, ruleVersion }) {
  const st = stack(...hands);
  let s = toSetup(reducer({ phase: "intro" }, {
    type: "START_SETUP", size: 5, setupMode: "simultaneous", deck: st.deck, handSize: st.handSize, ruleVersion,
    ...(online ? { __id: "host-1" } : {}),
  }));
  assert.equal(s.phase, "setup");
  for (const i of [0, 1]) {
    const [lo] = territoryRows(5, i);
    const placement = {};
    s.players[i].hand.slice(0, totalSlots(5)).forEach((c, n) => { placement[c.id] = { row: lo + Math.floor(n / 5), col: n % 5 }; });
    s = reducer(s, { type: "SETUP_CONFIRM", player: i, placement, kingId: autoPickKing(s, i, placement) });
  }
  assert.equal(s.phase, "play");
  return s;
}
function someMove(s) {
  const me = s.currentTurn;
  for (const p of Object.values(s.pieces)) {
    if (!p.alive || p.owner !== me || p.rank === "A") continue;
    const ms = getLegalMoves(p, s.board, s.boardSize, s.players[me].armyRankCounts, kingRankOf(s, me));
    if (ms.length) return { type: "MOVE_PIECE", player: me, pieceId: p.id, row: ms[0].row, col: ms[0].col, elapsedMs: 0 };
  }
  throw new Error("動ける駒が無い");
}

// 1. 通信・版13・ストレートあり: 両者の確認がそろうまで指せない
{
  let s = start({ hands: [STRAIGHT, PLAIN], online: true, ruleVersion: 13 });
  assert.ok(s.setupEffects, "ボーナスの知らせが出る");
  assert.ok(s.online, "通信の対局と分かる");
  assert.deepEqual(s.setupAck, [false, false]);
  assert.equal(setupWaiting(s), true);
  const mv = someMove(s);
  assert.equal(reducer(s, mv), s, "確認前の指し手は通らない");
  assert.equal(reducer(s, { type: "CLOCK_TIMEOUT", player: s.currentTurn }), s, "確認前の時間切れは通らない");
  assert.equal(reducer(s, { type: "SELECT_PIECE", id: mv.pieceId }), s, "確認前は駒も選べない");
  // 知らせを閉じる(手元だけ)のは自由。確認はまだ
  const closed = reducer(s, { type: "DISMISS_SETUP_EFFECTS" });
  assert.equal(closed.setupEffects, null);
  assert.equal(setupWaiting(closed), true);
  assert.equal(reducer(closed, mv), closed, "閉じただけでは指せない");
  const one = reducer(closed, { type: "ACK_SETUP_EFFECTS", player: 0 });
  assert.deepEqual(one.setupAck, [true, false]);
  assert.equal(reducer(one, mv), one, "片方の確認では指せない");
  assert.equal(reducer(one, { type: "ACK_SETUP_EFFECTS", player: 0 }), one, "同じ側の二度目は何もしない");
  assert.equal(reducer(one, { type: "ACK_SETUP_EFFECTS", player: 2 }), one, "席でないものは無視");
  const both = reducer(one, { type: "ACK_SETUP_EFFECTS", player: 1 });
  assert.deepEqual(both.setupAck, [true, true]);
  assert.equal(setupWaiting(both), false);
  assert.ok(both.log.at(-1).includes("両者が布陣ボーナスを確認した"));
  const moved = reducer(both, mv);
  assert.notEqual(moved, both, "そろえば指せる");
  assert.equal(moved.currentTurn, 1 - both.currentTurn);
  // 手番が変わっても、確認の記録はそのまま(再確認は要らない)
  assert.deepEqual(moved.setupAck, [true, true]);
}
// 2. 通信・版13・ボーナス無し: 待たない
{
  const s = start({ hands: [PLAIN, PLAIN_B], online: true, ruleVersion: 13 });
  assert.equal(s.setupEffects, null);
  assert.equal(s.setupAck, null);
  assert.notEqual(reducer(s, someMove(s)), s);
}
// 3. 通信・版12・ストレートあり: 旧版はそのまま(相手が古い端末でも困らない)
{
  const s = start({ hands: [STRAIGHT, PLAIN], online: true, ruleVersion: 12 });
  assert.ok(s.setupEffects);
  assert.equal(s.setupAck, null);
  assert.notEqual(reducer(s, someMove(s)), s);
  assert.equal(reducer(s, { type: "ACK_SETUP_EFFECTS", player: 0 }), s, "版12では合図は何もしない");
}
// 4. 手元の対局(CPU・同じ端末)・版13・ストレートあり: reducer は待たない(画面側が CPU を待たせる)
{
  const s = start({ hands: [STRAIGHT, PLAIN], online: false, ruleVersion: 13 });
  assert.ok(s.setupEffects);
  assert.equal(s.online, false);
  assert.equal(s.setupAck, null);
  assert.notEqual(reducer(s, someMove(s)), s);
}
// 5. 二人の端末: ホスト(席0)とゲスト(席1)が同じ盤になる。届いた合図の席は送り主から決まる
{
  const host = start({ hands: [STRAIGHT, PLAIN], online: true, ruleVersion: 13 });
  let guest = host;
  const HOST = "uid-host", GUEST = "uid-guest";
  // ホストが自分の確認を出す → ゲストへ届く
  const ackH = { type: "ACK_SETUP_EFFECTS", player: 0, by: HOST, __id: "h-1" };
  let h = reducer(host, ackH);
  const gotH = acceptAct({ ...ackH, player: 9 /* 何を名乗っても */ }, GUEST, 1, HOST);
  assert.equal(gotH.player, 0, "ゲスト側では送り主(ホスト)の席になる");
  guest = reducer(guest, gotH);
  assert.deepEqual(guest.setupAck, [true, false]);
  assert.equal(setupWaiting(guest), true);
  // ゲストが確認を出す → ホストへ届く
  const ackG = { type: "ACK_SETUP_EFFECTS", player: 1, by: GUEST, __id: "g-1" };
  guest = reducer(guest, ackG);
  const gotG = acceptAct({ ...ackG, player: 0 }, HOST, 0, GUEST);
  assert.equal(gotG.player, 1);
  h = reducer(h, gotG);
  assert.deepEqual(h.setupAck, [true, true]);
  assert.deepEqual(guest.setupAck, [true, true]);
  assert.equal(setupWaiting(h), false);
}
console.log("布陣ボーナスの両者確認(版13): 待つ・そろえば指せる・旧版と手元は従来どおり・二人の端末で一致 OK");
