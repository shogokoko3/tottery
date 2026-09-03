/**
 * 効果音。
 *
 * BGM と違って、押した瞬間に鳴らないと意味がない。
 * player.js が解錠のときにまとめて読み込んで、鳴らすときは
 * 読み終わったものを頭から鳴らすだけにしてある。
 *
 * 音源は assets/audio/se-*.m4a。tools/prepare-se.mjs が作る。
 * 出どころは効果音ラボ(https://soundeffect-lab.info/)で、
 * ゲームの操作音として内蔵するぶんにはクレジット表記も要らない。
 */
export const SOUNDS = {
  /** 布陣で自分の駒を盤に置いた */
  place: { file: "se-place.m4a", gain: 0.8 },
  /** 駒が倒れた。BGM を一瞬下げてから鳴らす */
  capture: { file: "se-capture.m4a", gain: 1 },
  /** 持ち時間が残りわずかになった */
  tick: { file: "se-tick.m4a", gain: 0.7 },
};

/**
 * 撃破のとき、BGM を下げておく時間(ミリ秒)。
 * 効果音とぶつかって、どちらも潰れるのを避ける。
 */
export const CAPTURE_DUCK_MS = 700;

/**
 * 残り時間を知らせる区切り(ミリ秒)。少ないほうから順に見る。
 *
 * **秒読みにはしない。** 1秒ごとに鳴らすと、この対局の
 * 「秒読みは無し」という決めごとと食い違う。ここを跨いだ瞬間に1回だけ鳴らす。
 */
export const TICK_AT_MS = [30000, 10000];

/**
 * 残り時間が、知らせる区切りをいくつ跨いだか。
 *
 * 増えたときだけ鳴らすので、時間が戻れば(次の対局・手番の加算)0に戻り、
 * また同じ区切りで鳴る。
 */
export function warnLevel(ms) {
  if (ms == null) return 0;
  let level = 0;
  for (const at of TICK_AT_MS) if (ms <= at) level++;
  return level;
}
