/**
 * 効果音。
 *
 * BGM と違って、押した瞬間に鳴らないと意味がない。
 * player.js が解錠のときにまとめて読み込んで、鳴らすときは
 * 読み終わったものを頭から鳴らすだけにしてある。
 *
 * 音源は assets/audio/se-*.m4a。選定後に tools/soften-se.py で高音の響きを整理。
 * 通知音は柔らかな木・紙、レア公開と報酬は暖かな和音の広がり。
 * 旧版は reports/se-soft-20261020/originals に保持。
 */
export const SOUNDS = {
  tap: { file: "se-tap.m4a", gain: 0.32 },
  confirm: { file: "se-confirm.m4a", gain: 0.4 },
  back: { file: "se-back.m4a", gain: 0.32 },
  error: { file: "se-error.m4a", gain: 0.4 },
  page: { file: "se-page.m4a", gain: 0.35 },
  deal: { file: "se-deal.m4a", gain: 0.7 },
  shuffle: { file: "se-shuffle.m4a", gain: 0.7 },
  dice: { file: "se-dice.m4a", gain: 0.7 },
  place: { file: "se-place.m4a", gain: 0.6 },
  capture: { file: "se-capture.m4a", gain: 0.75 },
  king_select: { file: "se-king_select.m4a", gain: 0.7 },
  start: { file: "se-start.m4a", gain: 0.7 },
  tick: { file: "se-tick.m4a", gain: 0.7 },
  time10: { file: "se-time10.m4a", gain: 0.6 },
  reveal: { file: "se-reveal.m4a", gain: 0.7 },
  aceSwap: { file: "se-aceSwap.m4a", gain: 0.7 },
  aceCapture: { file: "se-aceCapture.m4a", gain: 0.7 },
  aceFoil: { file: "se-aceFoil.m4a", gain: 0.7 },
  earth: { file: "se-earth.m4a", gain: 0.7 },
  sea: { file: "se-sea.m4a", gain: 0.7 },
  forest: { file: "se-forest.m4a", gain: 0.7 },
  ice: { file: "se-ice.m4a", gain: 0.7 },
  thaw: { file: "se-thaw.m4a", gain: 0.7 },
  sky: { file: "se-sky.m4a", gain: 0.7 },
  palace: { file: "se-palace.m4a", gain: 0.7 },
  heaven: { file: "se-heaven.m4a", gain: 0.7 },
  hell: { file: "se-hell.m4a", gain: 0.7 },
  alice_reverse: { file: "se-alice_reverse.m4a", gain: 0.7 },
  alice_revolution: { file: "se-alice_revolution.m4a", gain: 0.7 },
  alice_caucus: { file: "se-alice_caucus.m4a", gain: 0.7 },
  alice_quadrille: { file: "se-alice_quadrille.m4a", gain: 0.7 },
  alice_maze: { file: "se-alice_maze.m4a", gain: 0.7 },
  alice_tea: { file: "se-alice_tea.m4a", gain: 0.7 },
  alice_illusion: { file: "se-alice_illusion.m4a", gain: 0.7 },
  alice_croquet: { file: "se-alice_croquet.m4a", gain: 0.7 },
  revive: { file: "se-revive.m4a", gain: 0.7 },
  recruit: { file: "se-recruit.m4a", gain: 0.7 },
  login: { file: "se-login.m4a", gain: 0.7 },
  mission: { file: "se-mission.m4a", gain: 0.7 },
  claim_all: { file: "se-claim_all.m4a", gain: 0.7 },
  levelup: { file: "se-levelup.m4a", gain: 0.7 },
  mastery: { file: "se-mastery.m4a", gain: 0.7 },
  title: { file: "se-title.m4a", gain: 0.7 },
  foil_acquire: { file: "se-foil_acquire.m4a", gain: 0.7 },
  foil_open: { file: "se-foil_open.m4a", gain: 0.7 },
  forge: { file: "se-forge.m4a", gain: 0.7 },
  dismantle: { file: "se-dismantle.m4a", gain: 0.7 },
  equip: { file: "se-equip.m4a", gain: 0.7 },
  purchase: { file: "se-purchase.m4a", gain: 0.7 },
  friend: { file: "se-friend.m4a", gain: 0.7 },
  summon_bed: { file: "se-summon_bed.m4a", gain: 0.7 },
  reveal_r: { file: "se-reveal_r.m4a", gain: 0.7 },
  reveal_sr: { file: "se-reveal_sr.m4a", gain: 0.7 },
  reveal_ssr: { file: "se-reveal_ssr.m4a", gain: 0.7 },
  summon_freeze: { file: "se-summon_freeze.m4a", gain: 0.7 },
  win: { file: "se-win.m4a", gain: 0.7 },
  lose: { file: "se-lose.m4a", gain: 0.7 },
  draw: { file: "se-draw.m4a", gain: 0.7 },
  puzzle_correct: { file: "se-puzzle_correct.m4a", gain: 0.7 },
  puzzle_retry: { file: "se-puzzle_retry.m4a", gain: 0.7 },
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

/** Important cues keep their soft timbre; gain is bounded by decoded peak. */
export const IMPORTANT_CUES = {
  confirm: { priority: 1, duckMs: 380 },
  capture: { priority: 2, duckMs: 700 },
  king_select: { priority: 1, duckMs: 500 },
  start: { priority: 1, duckMs: 600 },
  tick: { priority: 3, duckMs: 500 },
  time10: { priority: 3, duckMs: 700 },
  forge: { priority: 2, duckMs: 2400 },
  levelup: { priority: 1, duckMs: 650 },
  foil_acquire: { priority: 1, duckMs: 1750 },
  foil_open: { priority: 1, duckMs: 900 },
  reveal_r: { priority: 1, duckMs: 900 },
  reveal_sr: { priority: 1, duckMs: 1300 },
  reveal_ssr: { priority: 2, duckMs: 1750 },
  win: { priority: 4, duckMs: 900 },
  lose: { priority: 4, duckMs: 900 },
  draw: { priority: 4, duckMs: 900 },
  puzzle_correct: { priority: 2, duckMs: 600 },
};

// Measure short active windows rather than silence-heavy whole-file RMS.
// This changes amplitude only: no treble boost, oscillator, or resonance.
export function importantCueGain(buffer) {
  if (!buffer.getChannelData || !buffer.length) return 1;
  let peak = 0, strongest = 0;
  const window = Math.max(1, Math.round(buffer.sampleRate * 0.05));
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const samples = buffer.getChannelData(c);
    for (let i = 0; i < samples.length; i += window) {
      let energy = 0;
      const end = Math.min(samples.length, i + window);
      for (let j = i; j < end; j++) {
        peak = Math.max(peak, Math.abs(samples[j]));
        energy += samples[j] * samples[j];
      }
      strongest = Math.max(strongest, Math.sqrt(energy / (end - i)));
    }
  }
  return peak > 0 ? Math.min(12, 0.4 / peak, Math.max(1, 0.09 / Math.max(strongest, 1e-6))) : 1;
}
