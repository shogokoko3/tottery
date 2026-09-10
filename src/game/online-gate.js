/**
 * ランダムマッチの入口の条件。
 *
 * 持ち点に数えるランダムマッチ(9×9・5×5)だけは、チュートリアルを第8話まで終えてから。
 * 第8話までで移動・取り合い・王・撃破が一通り終わる。第9〜12話(Aと布陣ボーナス)は知らなくても
 * 対局は成立するので条件にしない。CPU戦・フレンド対戦(合言葉)・詰めトッタリーは最初から遊べる。
 * (2026-09-11、本人の決め)
 */
import { TUTORIALS } from "./tutorial.js";
import { hasCleared } from "./profile.js";

/** ここまでの話を終えるとランダムマッチが開く */
export const ONLINE_GATE_EPISODES = 8;

/** { ok, need, remaining, next } — next は次に終えるべき話 */
export function onlineGate(profile) {
  const required = TUTORIALS.slice(0, ONLINE_GATE_EPISODES);
  const left = required.filter((t) => !hasCleared(t.id, profile));
  return {
    ok: left.length === 0,
    need: ONLINE_GATE_EPISODES,
    remaining: left.length,
    next: left[0] || null,
  };
}

/** 入口に添える一言 */
export function onlineGateLabel(gate) {
  if (gate.ok) return null;
  return `チュートリアル 第${gate.need}話まで（あと${gate.remaining}話）`;
}
