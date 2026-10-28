import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { audioSettings, connectFilmSound, duckMusic } from "../audio/index.js";
import { useCollection } from "../skins/store.js";
import { filmPlanFor, filmQueueState } from "../skins/events.js";
import { SkinModal, useReducedMotion } from "./skin-modal.jsx";

export function SkinFilm({ skin, short = false, onClose }) {
  const video = useRef(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = video.current;
    let done = false,
      started = false,
      playbackTimer,
      releaseMusic;
    const finish = () => {
      if (!done) {
        done = true;
        close.current();
      }
    };
    // 読み込み失敗や通信切断でも、対局を止め続けない。
    const loadingTimer = setTimeout(finish, 2500);
    // 読み込み2.5秒 + アリスの9秒でも切れない長さ。ended でも閉じるので保険。
    const watchdog = setTimeout(finish, 15000);
    const playing = () => {
      if (started) return;
      started = true;
      clearTimeout(loadingTimer);
      // 動画は最後まで流す(2026-10-14 本人の指示。アリスは9秒、他の技は6秒)。
      // 長さが読めないときだけ従来の5秒。
      const length =
        Number.isFinite(el.duration) && el.duration > 0
          ? (el.duration * 1000) / el.playbackRate + 300
          : 5000;
      const duration = short ? 2000 : length;
      playbackTimer = setTimeout(finish, duration);
      if (!audioSettings().muted && audioSettings().se > 0) releaseMusic = duckMusic(duration);
    };
    el.playbackRate = short ? 2.5 : 1;
    el.muted = audioSettings().muted || audioSettings().se === 0;
    const disconnectSound = connectFilmSound(el);
    el.addEventListener("playing", playing);
    el.addEventListener("ended", finish);
    el.addEventListener("error", finish);
    el.play().catch(() => {
      if (done) return;
      el.muted = true;
      el.play().catch(finish);
    });
    return () => {
      done = true;
      clearTimeout(loadingTimer);
      clearTimeout(playbackTimer);
      clearTimeout(watchdog);
      el.removeEventListener("playing", playing);
      el.removeEventListener("ended", finish);
      el.removeEventListener("error", finish);
      el.pause();
      disconnectSound();
      releaseMusic?.();
    };
  }, [skin.video, short]);
  return (
    <SkinModal
      label={`${skin.name}の演出`}
      onClose={onClose}
      className="skin-film-overlay"
    >
      <video
        ref={video}
        src={skin.video}
        poster={skin.image}
        playsInline
        preload="auto"
        aria-label={`${skin.name}・${skin.move}の演出`}
      />
      <button className="skin-skip" onClick={onClose}>
        演出をスキップ →
      </button>
    </SkinModal>
  );
}

export function useBattleFilm(
  state,
  loadouts,
  disabled,
  viewer = null,
  paused = false,
) {
  const collection = useCollection(),
    reduce = useReducedMotion();
  const before = useRef(state),
    seq = useRef(0);
  const [queue, setQueue] = useState([]);
  const enabled = !disabled && collection.motion !== "off" && !reduce;
  // 1手で2本続くことがある(取った側の映像 → 王位継承の映像)
  const pending = enabled
    ? filmPlanFor(before.current, state, loadouts, viewer)
    : [];
  useLayoutEffect(() => {
    before.current = state;
    if (!enabled) {
      setQueue((q) => (q.length ? [] : q));
      return;
    }
    if (pending.length) {
      const entries = pending.map((entry) => ({
        ...entry,
        key: ++seq.current,
      }));
      setQueue((q) => [...q, ...entries]);
    }
  }, [state, enabled]);
  const presentation = {
    revealPending: !!state.captureReveal,
    paused,
  };
  const { active } = filmQueueState(queue, presentation);
  // pending は最初の描画も守る。公開待ちの先頭を後続の映像が追い越さない。
  const { busy } = filmQueueState(queue.length ? queue : pending, presentation);
  return {
    enabled,
    busy: enabled && busy,
    overlay:
      enabled && active ? (
        <SkinFilm
          key={active.key}
          skin={active.skin}
          onClose={() => setQueue((q) => q.slice(1))}
        />
      ) : null,
  };
}
