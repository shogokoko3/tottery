/**
 * 対局中に、自分が取った駒をバトルパスへ流し込む。
 *
 * 盤が変わるたびに前後を見比べる。同じ盤面を二度数えないよう、
 * reducer の seq を目印にする。チュートリアルでは進めない。
 */
import { useEffect, useRef } from "react";
import { applyCaptures, capturedIn } from "../game/battlepass.js";
import { updatePass } from "../game/battlepass-store.js";

export function useBattlePass(state, viewer, disabled) {
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
    updatePass((s) => applyCaptures(s, taken));
  }, [state, viewer, disabled]);
}
