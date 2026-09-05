import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { audioSettings, connectFilmSound, duckMusic } from "../audio/index.js";
import { useCollection } from "../skins/store.js";
import { filmsFor } from "../skins/events.js";
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
    const watchdog = setTimeout(finish, 8500);
    const playing = () => {
      if (started) return;
      started = true;
      clearTimeout(loadingTimer);
      const duration = short ? 2000 : 5000;
      playbackTimer = setTimeout(finish, duration);
      if (!el.muted) releaseMusic = duckMusic(duration);
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
    ? filmsFor(before.current, state, loadouts, viewer)
    : [];
  useLayoutEffect(() => {
    before.current = state;
    if (!enabled) {
      setQueue((q) => (q.length ? [] : q));
      return;
    }
    if (pending.length) {
      const entries = pending.map((skin) => ({ skin, key: ++seq.current }));
      setQueue((q) => [...q, ...entries]);
    }
  }, [state, enabled]);
  const active = enabled && !paused && queue[0];
  return {
    enabled,
    busy: enabled && (queue.length > 0 || pending.length > 0),
    overlay: active ? (
      <SkinFilm
        key={active.key}
        skin={active.skin}
        short={collection.motion === "short"}
        onClose={() => setQueue((q) => q.slice(1))}
      />
    ) : null,
  };
}
