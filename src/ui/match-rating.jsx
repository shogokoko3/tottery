import { useEffect, useState } from "react";
import { readMatchRatings } from "../net/match-rating.js";

export function useMatchRatings(network, round, enabled) {
  const key = enabled ? `${network.code}:${network.createdAt}:${round}` : null;
  const [state, setState] = useState({ key: null, ratings: null, error: "" });
  useEffect(() => {
    if (!enabled) return;
    let gone = false,
      timer;
    const read = async () => {
      try {
        const ratings = await readMatchRatings(network, round);
        if (!gone) setState({ key, ratings, error: "" });
      } catch {
        if (!gone) {
          setState({
            key,
            ratings: null,
            error: "レートを確認できませんでした。再接続しています…",
          });
          timer = setTimeout(read, 3000);
        }
      }
    };
    read();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [key, enabled, network?.foeUid, network?.myPlayerIndex]);
  return {
    ready: !enabled || (state.key === key && !!state.ratings),
    ratings: state.key === key ? state.ratings : null,
    error: state.key === key ? state.error : "",
  };
}
