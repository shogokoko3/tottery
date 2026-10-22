/**
 * 対局中に、自分が取った駒をバトルパスへ流し込む。
 *
 * 盤が変わるたびに前後を見比べる。同じ盤面を二度数えないよう、
 * reducer の seq を目印にする。チュートリアルでは進めない。
 * バトルパスを買っていない人は進めない(購入で解放)。新しくクリアしたマスは
 * その周・そのマスで冪等なチケット1枚を財布へ送る(周72枚まではサーバーが数える)。
 * 進めるのは「進めるパス」(battlepass-store.js の active)だけ(2026-10-15 本人の指示。併用はしない)。
 */
import { useEffect, useRef } from "react";
import { applyCaptures, capturedIn, untickedCells, markTicketed } from "../game/battlepass.js";
import { getActivePassId, setActivePassId, updatePass } from "../game/battlepass-store.js";
import { earnPassTicket } from "../net/wallet.js";
import { passTicketId } from "../game/content-seasons.js";
import { passUnlockedFor, progressablePassSeason } from "./battlepass-access.js";

/** 新しくクリアしたマスのチケットを財布へ送り、印を付ける */
function awardTickets(state, seasonId) {
  const ids = untickedCells(state);
  if (!ids.length) return;
  for (const cellId of ids)
    earnPassTicket(passTicketId(seasonId, state.cycle, cellId)).catch(() => {});
  updatePass((s) => markTicketed(s, ids), seasonId);
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
    // 進めるパスを1つ選ぶ。買っていない人は進めない(購入で解放)。
    // 選んだパスを持っていなければ、持っているパスのいちばん新しいものへ(ショップで買って盤を開かずに対局したとき)
    const seasonId = progressablePassSeason(getActivePassId());
    if (!passUnlockedFor(seasonId)) return;
    if (seasonId !== getActivePassId()) setActivePassId(seasonId);
    const next = updatePass((s) => applyCaptures(s, taken, { online }), seasonId);
    awardTickets(next, seasonId);
  }, [state, viewer, disabled, online]);
}
