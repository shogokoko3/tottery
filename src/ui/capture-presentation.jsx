import { useLayoutEffect, useRef } from "react";
import { captureDisplayState } from "../game/capture-presentation.js";

export function useCapturePresentation(state) {
  const previous = useRef(state);
  const held = useRef(null);
  const fresh =
    state.captureReveal &&
    state.captureReveal !== previous.current.captureReveal;
  // 最初の描画から伏せる。effect後まで新公開のマークを一瞬も出さない。
  const before = fresh ? previous.current : held.current;
  useLayoutEffect(() => {
    if (fresh) held.current = before;
    if (!state.captureReveal) held.current = null;
    previous.current = state;
  }, [state]);
  return captureDisplayState(state, before);
}
