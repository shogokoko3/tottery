/**
 * ランダムマッチの入口の条件。
 *
 * ストーリーのフェーズ1(6ステージ)をクリアしたら開く(2026-09-30 本人の指示)。
 * それまでは、チュートリアル第8話まで(2026-09-11 の決め)だった。チュートリアルはホームの導線から外したので、
 * ストーリーに結び直した。昇格(フェーズ2 以上)した人は、フェーズ1をクリア済みなので開いている。
 * CPU戦・フレンド対戦(合言葉・近くの端末)・詰めトッタリーは最初から遊べる。
 */
import { STORY_AXES, normalizeStory, phaseOf } from "./phase.js";

/** このフェーズのストーリーをクリアするとランダムマッチが開く */
export const ONLINE_GATE_PHASE = 1;

/** { ok, need, remaining, next } — next は次にクリアするとよい軸 id */
export function onlineGate(profile) {
  if (phaseOf(profile) > ONLINE_GATE_PHASE)
    return { ok: true, need: STORY_AXES.length, remaining: 0, next: null };
  const cleared = normalizeStory(profile?.story)[ONLINE_GATE_PHASE];
  const left = STORY_AXES.filter((a) => !cleared.includes(a));
  return {
    ok: left.length === 0,
    need: STORY_AXES.length,
    remaining: left.length,
    next: left[0] || null,
  };
}

/** 入口に添える一言 */
export function onlineGateLabel(gate) {
  if (gate.ok) return null;
  return `ストーリー フェーズ1のクリアで開きます（あと${gate.remaining}ステージ）`;
}
