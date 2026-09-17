import { initialState, reducer } from "../game/reducer.js";
import { buildDeck } from "../game/board.js";
import {
  NET_ACTIONS,
  HOST_ONLY_ACTIONS,
  roomRuleVersion,
  setupFromRoom,
} from "../net/sync.js";
import { sanitizeLoadout } from "../skins/catalog.js";

// クライアントの勝率・得点は受け取らない。参加者限定の部屋から手順を読み、
// 公開ゲームと同じルールで再生する。手の送り主は Firebase の認証済み by。
/**
 * 手順の指紋(2026-09-18)。実際に適用した手の __id をそろえて畳む。
 *
 * 部屋の round を書き換えるだけで id(code:createdAt:round)が変わるので、
 * **同じ手順の対局を何度でも記録して持ち点を作れた**。指紋が同じものは二度記録しない。
 * 正当な再戦は手順を消してから始まる(clearActs)ので、指紋は必ず変わる。
 */
function fingerprint(ids) {
  const text = [...ids].sort().join(",");
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619) >>> 0;
    b = ((b << 5) + b + c) >>> 0;
  }
  return `${a.toString(36)}${b.toString(36)}${text.length.toString(36)}`;
}

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
    // 装備と盤面エリアは、開始の合図の言い値でなく**部屋の申告**から決め直す(2026-09-18)。
    // 端末側も同じ決め直しをしている(src/net/sync.js の setupFromRoom)ので、
    // ここを合わせないとサーバーの再生だけが実際の対局とずれる
    const applied = setupFromRoom(
      act,
      [sanitizeLoadout(room.hostSkins), sanitizeLoadout(room.guestSkins)],
      { ranked: true, ruleVersion: roomRuleVersion(room), boardSize: 9 },
    );
    state = reducer(
      { ...state, captureReveal: null, interstitial: null, setupEffects: null },
      {
        ...applied,
        player: act.type === "CLOCK_TIMEOUT" ? act.player : player,
      },
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
    // 同じ手順は二度記録しない(round を書き換えても効かない)
    fingerprint: fingerprint(seen),
    host,
    guest,
    winner: state.winner,
    names: [room.hostName, room.guestName].map((n) =>
      typeof n === "string" ? n.slice(0, 10) : "名無し",
    ),
    icons: [room.hostIcon, room.guestIcon].map((i) =>
      typeof i === "string" ? i.slice(0, 40) : null,
    ),
    // その対局で実際に効いたフォイル(席ごと)。盤面エリアはフォイルの王で立つので、
    // あとで「持っていたはずの札か」を照らすための材料として残す(2026-09-18)。
    // この段階では**何も拒まない**。記録するだけ
    foils: [0, 1].map((seat) =>
      Object.values((state.areaLoadouts && state.areaLoadouts[seat]) || {})
        .filter((id) => typeof id === "string" && id.endsWith(":foil"))
        .sort(),
    ),
  };
}
