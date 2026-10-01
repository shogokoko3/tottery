/**
 * ランダムマッチの入口の条件。
 *
 * ストーリーのフェーズ1(7ステージ)をクリアしたら開く(2026-09-30 本人の指示)。
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

/**
 * 名前が要る画面(2026-10-01 本人の指示)。名前を聞くのは、はじめの一局に勝ったあと(導入の中)。
 * それまでに人と関わる場所へ行こうとしたら、先に名前を聞く(screens.jsx の名前の壁)。
 *   ranking … ランキング(シーズンもこの中)  online … ランダムマッチ  room … 合言葉の部屋
 *   nearby … 近くの端末(相手の画面に名前が出る)  friends・spectate … フレンドと観戦
 * 台帳への公開とオンラインの印は、名前が無ければもともと送らない(profileRecord・pingOnline の named)
 */
export const NAME_SCREENS = Object.freeze(["ranking", "online", "room", "nearby", "friends", "spectate"]);

/** ルールを選ぶ画面の行き先(screens.jsx の o)のうち、人と対局するもの */
const NAME_MODES = Object.freeze(["online", "room", "nearby"]);

/** その画面へ行くのに名前が要るか。mode はルールを選ぶ画面の行き先 */
export function needsName(screen, mode = null) {
  if (NAME_SCREENS.includes(screen)) return true;
  return screen === "rules" && NAME_MODES.includes(mode);
}

/** 名前の壁で、いま聞くわけの一行 */
export function nameWallReason(screen) {
  if (screen === "ranking") return "ランキングを見る前に、名前を決めよう。";
  if (screen === "friends" || screen === "spectate") return "フレンドと遊ぶ前に、名前を決めよう。";
  return "人と対戦する前に、名前を決めよう。";
}
