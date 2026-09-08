import { initialState, reducer } from "../game/reducer.js";
import { buildDeck } from "../game/board.js";
import { NET_ACTIONS, HOST_ONLY_ACTIONS } from "../net/sync.js";

// クライアントの勝率・得点は受け取らない。参加者限定の部屋から手順を読み、
// 公開ゲームと同じルールで再生する。手の送り主は Firebase の認証済み by。
export function verifyMatch(room, request, uid) {
  const { host, guest } = room?.seats || {};
  if (!host || !guest || host === guest || ![host, guest].includes(uid))
    throw new Error("この対局の参加者ではありません。");
  if (
    room.createdAt !== request.createdAt ||
    Number(room.round || 0) !== request.round
  )
    throw new Error("対局の記録が切り替わっています。");
  const acts = Object.keys(room.acts || {})
    .sort()
    .map((k) => room.acts[k]);
  if (!acts.length || acts.length > 4000)
    throw new Error("対局の記録を確認できません。");
  let state = initialState(),
    played = false;
  const seen = new Set();
  for (const act of acts) {
    if (state.phase === "gameover") break;
    if (!act || !NET_ACTIONS.has(act.type) || !act.__id || seen.has(act.__id))
      continue;
    seen.add(act.__id);
    const player = [host, guest].indexOf(act.by);
    if (
      player < 0 ||
      (HOST_ONLY_ACTIONS.has(act.type) && player !== 0) ||
      act.type === "NEW_GAME"
    )
      continue;
    if (act.type === "START_SETUP") {
      const expected = buildDeck()
        .map((c) => `${c.rank}:${c.suit}`)
        .sort();
      const actual = Array.isArray(act.deck)
        ? act.deck.map((c) => `${c.rank}:${c.suit}`).sort()
        : [];
      if (
        act.size !== 9 ||
        act.scripted ||
        act.pool ||
        (act.handSize && act.handSize !== 13) ||
        JSON.stringify(expected) !== JSON.stringify(actual)
      )
        throw new Error("通常の9×9オンライン対戦が対象です。");
    }
    state = reducer(
      { ...state, captureReveal: null, interstitial: null, setupEffects: null },
      { ...act, player: act.type === "CLOCK_TIMEOUT" ? act.player : player },
    );
    if (
      state.phase === "play" ||
      (state.phase === "gameover" && state.setupDone?.every(Boolean))
    )
      played = true;
  }
  if (
    !played ||
    state.boardSize !== 9 ||
    state.phase !== "gameover" ||
    ![0, 1, null].includes(state.winner)
  )
    throw new Error("対局の終了を確認中です。");
  if (state.winner !== request.winner)
    throw new Error("対局結果の確認が必要です。");
  return {
    id: `${request.code}:${request.createdAt}:${request.round}`,
    host,
    guest,
    winner: state.winner,
    names: [room.hostName, room.guestName].map((n) =>
      typeof n === "string" ? n.slice(0, 10) : "名無し",
    ),
    icons: [room.hostIcon, room.guestIcon].map((i) =>
      typeof i === "string" ? i.slice(0, 40) : null,
    ),
  };
}
