/**
 * 画面から音を使うための口。
 *
 * 画面側が知っているのは「いまどの場面か」だけでよい。
 * どの曲を鳴らすかは tracks.js が決め、どう鳴らすかは player.js が持つ。
 */

import { useEffect, useRef } from "react";
import { TUTORIAL_VOLUME, isEndgame, trackForScene } from "./tracks.js";
import { CAPTURE_DUCK_MS, warnLevel } from "./sounds.js";
import { duckMusic, playSound, playTrack, setVolumeScale } from "./player.js";

export { MUSIC_CREDIT, SE_CREDIT } from "./tracks.js";

export {
  armAudioUnlock,
  audioSettings,
  connectFilmSound,
  duckMusic,
  playSound,
  setBgmVolume,
  setMuted,
  setSeVolume,
  stopMusic,
  unlockAudio,
} from "./player.js";

/**
 * 対局の外の画面。
 *
 * 対局中(screen === "game")は何もしない。曲は useGameBgm のほうが決めるので、
 * ここから触ると布陣の曲を上書きしてしまう。
 */
export function useScreenBgm(screen) {
  const id = screen === "game" ? null : trackForScene({ screen });
  (0, useEffect)(() => {
    if (!id) return;
    setVolumeScale(1);
    playTrack(id);
  }, [id]);
}

/**
 * 対局中。
 *
 * self は「勝敗を自分のこととして聞く側」。オンラインなら自分の番号、
 * CPU戦なら 0。1台の端末で交互に指す対戦は、どちらも自分なので null を渡す
 * (この場合は誰かが勝ったということで、いつも勝利のジングルを鳴らす)。
 */
export function useGameBgm({ state, clocks, self, tutorial }) {
  const phase = state ? state.phase : null;

  // 終盤に入ったら戻らない。持ち時間は手番ごとに10秒足されるので、
  // その場で判定すると境目で曲が行ったり来たりする
  const late = (0, useRef)(false);
  if (phase === "intro" || phase === "dice" || phase === "mulligan")
    late.current = false;
  if (phase === "play" && !late.current && isEndgame(state, clocks))
    late.current = true;

  const finished = phase === "gameover";
  const result = !finished
    ? null
    : self == null || state.winner === self
      ? "win"
      : "lose";

  const id = trackForScene({
    screen: "game",
    phase,
    endgame: late.current,
    result,
  });
  const scale = tutorial ? TUTORIAL_VOLUME : 1;

  (0, useEffect)(() => {
    setVolumeScale(scale);
  }, [scale]);

  (0, useEffect)(() => {
    playTrack(id);
  }, [id]);
}

/**
 * 対局中の効果音。
 *
 * 画面のあちこちに音を鳴らす行を撒くのではなく、盤面の変わりかたから拾う。
 * こうすると、自分が指したときも、CPUや相手が指したときも同じように鳴る。
 *
 * self は自分の番号(1台の端末で交互に指すときは null)。
 * warnMs は自分に関わる残り時間。無ければ null を渡す。
 *
 * **音でも伏せた情報を漏らさない。** 置く音は自分が置いたときだけ鳴らす。
 * 同時配置のときに相手の置いた瞬間まで聞こえると、
 * 相手がどこで手を止めているかが伝わってしまう。
 * 駒が倒れたことは盤を見れば分かるので、そちらは両方で鳴らす。
 */
export function useGameSounds({ state, self, warnMs, captureHandled = false }) {
  const side = self == null ? (state ? state.setupIdx : 0) : self;
  const placed = state
    ? Object.keys((state.setupPlacements && state.setupPlacements[side]) || {})
        .length
    : 0;
  const moves = state && state.lastMove ? state.lastMove.seq || 0 : 0;
  const dead = state
    ? Object.values(state.pieces).filter((p) => !p.alive).length
    : 0;

  const seen = (0, useRef)(null);
  (0, useEffect)(() => {
    const before = seen.current;
    seen.current = { placed, moves, dead };
    // 対局に入った最初の描画では鳴らさない
    if (!before) return;
    if (dead > before.dead) {
      if (captureHandled) return;
      // 効果音とぶつからないよう、BGM を一瞬下げる
      duckMusic(CAPTURE_DUCK_MS);
      playSound("capture");
      return;
    }
    if (placed > before.placed || moves > before.moves) playSound("place");
  }, [placed, moves, dead, captureHandled]);

  const level = warnLevel(warnMs);
  const warned = (0, useRef)(0);
  (0, useEffect)(() => {
    if (level > warned.current) playSound("tick");
    warned.current = level;
  }, [level]);
}
