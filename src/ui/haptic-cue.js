import { useEffect } from "react";
import { playHaptic } from "../game/haptics.js";

// 音と同じ公開タイミングで1度だけ鳴らす。StrictModeの仮マウントでは鳴らさない。
export function useHapticCue(pattern, active, identity) {
  useEffect(() => {
    if (!active || !pattern) return;
    let cancel;
    const timer = setTimeout(() => { cancel = playHaptic(pattern); }, 0);
    return () => {
      clearTimeout(timer);
      cancel?.();
    };
  }, [pattern, !!active, identity]);
}
