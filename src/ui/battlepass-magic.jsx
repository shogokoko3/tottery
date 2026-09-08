import { useEffect, useRef, useState } from "react";
import { audioSettings, connectFilmSound, duckMusic } from "../audio/index.js";
import { createBattlePassPainter } from "./battlepass-magic-painter.js";
import styles from "./battlepass-magic.css";

const DURATION = 8700;
const REDUCED_DURATION = 1400;

// The approved sine chimes are rendered into a short in-memory WAV. The media
// element then uses the existing SE bus, including its iOS volume and mute path.
function chimeUrl(reduced) {
  const sampleRate = 24000;
  const seconds = reduced ? 2.5 : 8.7;
  const samples = new Float32Array(Math.ceil(sampleRate * seconds));
  const tone = (at, frequency, duration = 0.25, volume = 0.05) => {
    const first = Math.round(at * sampleRate);
    const length = Math.ceil(duration * sampleRate);
    for (let i = 0; i < length && first + i < samples.length; i++) {
      const t = i / sampleRate;
      const envelope =
        t < 0.012
          ? (volume * t) / 0.012
          : volume *
            Math.pow(0.0001 / volume, (t - 0.012) / (duration - 0.012));
      samples[first + i] += Math.sin(t * frequency * Math.PI * 2) * envelope;
    }
  };
  tone(0, 440, 0.15, 0.05);
  tone(0.37, 880, 0.5, 0.045);
  if (!reduced) {
    tone(1.35, 196, 1.3, 0.045);
    tone(1.35, 293.66, 1.4, 0.025);
    [659.25, 783.99, 987.77, 1318.51].forEach((f, i) =>
      tone(2.25 + i * 0.095, f, 0.8, 0.036),
    );
    [880, 1046.5, 1318.5].forEach((f, i) =>
      tone(3.38 + i * 0.13, f, 0.45, 0.022),
    );
    [523.25, 659.25, 783.99, 987.77, 1046.5].forEach((f, i) =>
      tone(4.65 + i * 0.28, f, 0.5, 0.035),
    );
  }
  const finale = reduced ? 1.02 : 6.91;
  [261.63, 329.63, 392, 523.25].forEach((f) => tone(finale, f, 1.4, 0.032));
  [1046.5, 1318.5, 1567.98].forEach((f, i) =>
    tone(finale + i * 0.12, f, 1, 0.025),
  );
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (at, value) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(at + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) =>
    view.setInt16(
      44 + i * 2,
      Math.round(Math.max(-1, Math.min(1, sample)) * 32767),
      true,
    ),
  );
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function phaseAt(time, reduced) {
  if (reduced)
    return time < 450
      ? "25枚、すべて開放"
      : time < 1000
        ? "ひとつの絵へ"
        : "イラスト完成";
  return time < 1500
    ? "25枚、すべて開放"
    : time < 2300
      ? "魔法が目を覚ます"
      : time < 4200
        ? "欠片に、魔法を。"
        : time < 6500
          ? "ひとつの絵へ"
          : "イラスト完成";
}

export function BattlePassMagic({ imageSrc, order, onComplete }) {
  const canvasRef = useRef(null);
  const completeRef = useRef(onComplete);
  const notified = useRef(false);
  const skipRef = useRef(null);
  const [phase, setPhase] = useState("魔法の準備中");
  completeRef.current = onComplete;
  const orderKey = Array.isArray(order) ? order.join(",") : "";

  useEffect(() => {
    const canvas = canvasRef.current;
    let cancelled = false,
      ended = false,
      frame = 0,
      loadingTimer,
      watchdog;
    let started = null,
      width = 360,
      height = 480,
      phaseNow = "";
    let painter, observer, sound, soundUrl, disconnect, releaseMusic;
    const image = new Image();
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = reducedQuery.matches;
    const duration = reduced ? REDUCED_DURATION : DURATION;
    const ctx = canvas.getContext("2d");
    const updatePhase = (value) => {
      if (phaseNow !== value && !cancelled) {
        phaseNow = value;
        setPhase(value);
      }
    };
    const stopSound = () => {
      sound?.pause();
      disconnect?.();
      disconnect = null;
      releaseMusic?.();
      releaseMusic = null;
      if (soundUrl) URL.revokeObjectURL(soundUrl);
      soundUrl = null;
    };
    const draw = (time, complete = false) => {
      painter?.({ width, height, time, complete, reduced });
    };
    const finish = () => {
      if (cancelled || ended) return;
      ended = true;
      cancelAnimationFrame(frame);
      clearTimeout(loadingTimer);
      clearTimeout(watchdog);
      stopSound();
      try {
        draw(duration, true);
      } catch {
        /* The parent still shows the completed picture. */
      }
      updatePhase("イラスト完成");
      if (!notified.current) {
        notified.current = true;
        completeRef.current?.();
      }
    };
    skipRef.current = finish;
    const tick = (now) => {
      if (cancelled || ended) return;
      const time = Math.min(duration, now - started);
      try {
        if (sound) {
          const settings = audioSettings();
          sound.muted = settings.muted || settings.se <= 0;
        }
        draw(time);
        updatePhase(phaseAt(time, reduced));
      } catch {
        finish();
        return;
      }
      if (time >= duration) finish();
      else frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width || 360;
      height = rect.height || (width * 4) / 3;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (painter) {
        try {
          draw(
            ended
              ? duration
              : started == null
                ? 0
                : performance.now() - started,
            ended,
          );
        } catch {
          finish();
        }
      }
    };
    const start = () => {
      if (cancelled || ended || started != null) return;
      clearTimeout(loadingTimer);
      if (!ctx || !image.naturalWidth || document.hidden) {
        finish();
        return;
      }
      try {
        const mapping = orderKey.split(",").map(Number);
        painter = createBattlePassPainter(ctx, image, mapping);
        resize();
        if (ended || cancelled) return;
        if (typeof ResizeObserver === "function") {
          observer = new ResizeObserver(resize);
          observer.observe(canvas);
        }
      } catch {
        finish();
        return;
      }
      try {
        const settings = audioSettings();
        if (!settings.muted && settings.se > 0) {
          soundUrl = chimeUrl(reduced);
          sound = new Audio(soundUrl);
          sound.preload = "auto";
          sound.setAttribute("playsinline", "");
          disconnect = connectFilmSound(sound);
          sound.play().catch(() => {});
          releaseMusic = duckMusic(duration);
        }
      } catch {
        /* Audio failure never holds the picture or reward. */
      }
      started = performance.now();
      updatePhase("25枚、すべて開放");
      watchdog = setTimeout(finish, duration + 1000);
      frame = requestAnimationFrame(tick);
    };
    const onHidden = () => {
      if (document.hidden) finish();
    };
    const onReduced = () => {
      if (reducedQuery.matches) finish();
    };
    document.addEventListener("visibilitychange", onHidden);
    reducedQuery.addEventListener("change", onReduced);
    window.addEventListener("resize", resize);
    loadingTimer = setTimeout(finish, 4000);
    image.onload = start;
    image.onerror = finish;
    image.src = imageSrc;
    if (image.complete)
      queueMicrotask(() => (image.naturalWidth ? start() : finish()));
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(loadingTimer);
      clearTimeout(watchdog);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onHidden);
      reducedQuery.removeEventListener("change", onReduced);
      window.removeEventListener("resize", resize);
      image.onload = null;
      image.onerror = null;
      stopSound();
      if (skipRef.current === finish) skipRef.current = null;
    };
  }, [imageSrc, orderKey]);

  return (
    <section className="battlepass-magic" aria-label="イラスト完成の魔法">
      <style>{styles}</style>
      <div className="battlepass-magic-stage">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="25枚の欠片がシルクハットの魔法で並び替わり、イラストが完成します。"
        />
      </div>
      <div className="battlepass-magic-status">
        <span role="status" aria-live="polite">
          {phase}
        </span>
        <button type="button" onClick={() => skipRef.current?.()}>
          演出をスキップ
        </button>
      </div>
    </section>
  );
}
