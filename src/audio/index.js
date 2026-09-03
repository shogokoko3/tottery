/**
 * 画面から音を使うための口。
 *
 * 画面側が知っているのは「いまどの場面か」だけでよい。
 * どの曲を鳴らすかは tracks.js が決め、どう鳴らすかは player.js が持つ。
 */

import { useEffect, useRef } from "react";
import {
  TUTORIAL_VOLUME,
  isEndgame,
  trackForScene,
} from "./tracks.js";
import { playTrack, setVolumeScale } from "./player.js";

export {
  armAudioUnlock,
  audioSettings,
  duckMusic,
  setBgmVolume,
  setMuted,
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
  if (phase === "intro" || phase === "dice" || phase === "mulligan") late.current = false;
  if (phase === "play" && !late.current && isEndgame(state, clocks)) late.current = true;

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
