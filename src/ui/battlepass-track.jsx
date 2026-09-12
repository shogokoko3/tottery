/**
 * 対局中に、自分が取った駒をバトルパスへ流し込む。
 *
 * 盤が変わるたびに前後を見比べる。同じ盤面を二度数えないよう、
 * reducer の seq を目印にする。チュートリアルでは進めない。
 * バトルパスを買っていない人は進めない(購入で解放)。新しくクリアしたマスは
 * その周・そのマスで冪等なチケット1枚を財布へ送る(周72枚まではサーバーが数える)。
 */
import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { applyCaptures, capturedIn, untickedCells, markTicketed } from "../game/battlepass.js";
import { getPass, updatePass } from "../game/battlepass-store.js";
import { getCollection } from "../skins/store.js";
import { WALLET_SERVER, earnPassTicket } from "../net/wallet.js";
import { BATTLEPASS_ENTITLEMENT } from "../iap/catalog.js";

/**
 * バトルパスを持っているか。battlepass-access.js の useBattlePassUnlocked と同じ判定。
 * 店の無い環境(Web)は今まで通り解放。1周目を受け取り済み(claimed)なら以後も解放
 */
function passOwned() {
  return (
    !WALLET_SERVER ||
    !Capacitor.isNativePlatform() ||
    getPass().claimed === true ||
    (getCollection().entitlements || []).includes(BATTLEPASS_ENTITLEMENT)
  );
}

/** 新しくクリアしたマスのチケットを財布へ送り、印を付ける */
function awardTickets(state) {
  const ids = untickedCells(state);
  if (!ids.length) return;
  for (const cellId of ids)
    earnPassTicket(`bp:pass:${state.cycle}:${cellId}`).catch(() => {});
  updatePass((s) => markTicketed(s, ids));
}

export function useBattlePass(state, viewer, disabled, online = false) {
  const before = useRef(state);
  const seen = useRef(-1);
  useEffect(() => {
    const prev = before.current;
    before.current = state;
    if (disabled || !state || viewer == null) return;
    if (state.seq === seen.current) return;
    const taken = capturedIn(prev, state, viewer);
    if (!taken) return;
    seen.current = state.seq;
    // 買っていない人は進めない(購入で解放)
    if (!passOwned()) return;
    const next = updatePass((s) => applyCaptures(s, taken, { online }));
    awardTickets(next);
  }, [state, viewer, disabled, online]);
}
