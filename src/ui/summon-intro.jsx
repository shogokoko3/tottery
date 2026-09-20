import { useEffect, useMemo, useRef, useState } from "react";
import { cardBackImg } from "../assets.js";
import {
  summonPlan,
  SUMMON_TIMING,
  SUMMON_WORLDS,
  smooth,
} from "../skins/summon-plan.js";
import STYLES from "../skins/summon-intro.css";
import { prepareSummonSound, startSummonSound } from "../skins/summon-sound.js";

const LOADING_STYLES = `
.summon-loading {
  position: absolute; inset: 0; z-index: 3;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 24px; padding: 24px;
  background: radial-gradient(ellipse at 50% 44%, #162636, #050b13 70%);
  color: #e6d1a2; font: 500 14px/1.8 "Shippori Mincho", serif;
  letter-spacing: .12em; text-align: center;
  opacity: var(--loading-opacity, 1); pointer-events: none;
  visibility: var(--loading-visibility, visible);
}
.summon-loading-mark {
  width: 28px; height: 28px; transform: rotate(45deg);
  border: 1px solid #c6a86c; outline: 1px solid #c6a86c40; outline-offset: 7px;
  background: radial-gradient(#d7ba7840, transparent 72%);
  box-shadow: 0 0 28px #c6a86c25;
}
.summon-loading p { margin: 0; }
`;

/** Presentation only. The draw and debit have already been committed. */
export function SummonIntro({ results, targetRef, onFinish }) {
  const root = useRef(null),
    canvas = useRef(null),
    finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  // Wallet/storage synchronisation normalises results into a new array even
  // when the draw is unchanged. Keep the scene alive across those updates.
  const { world, gold, count } = summonPlan(results);
  const plan = useMemo(() => ({ world, gold, count }), [world, gold, count]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    root.current.style.removeProperty("--loading-opacity");
    root.current.style.removeProperty("--loading-visibility");
    let scene,
      raf,
      disposed = false,
      finished = false,
      start,
      deadline;
    let releaseSound = () => {};
    const finish = () => {
      if (!disposed && !finished) {
        finished = true;
        releaseSound();
        finishRef.current();
      }
    };
    const resize = () => {
      const rect = root.current?.getBoundingClientRect();
      if (rect && scene) scene.resize(rect.width, rect.height);
    };
    const visibility = () => {
      if (document.hidden) finish();
    };
    const lost = (e) => {
      e.preventDefault();
      finish();
    };
    const cancel = () => finish();
    // Loading/GPU failure must never hide already-owned cards or ask for another draw.
    deadline = setTimeout(finish, 15000);
    document.addEventListener("visibilitychange", visibility);
    canvas.current.addEventListener("webglcontextlost", lost);
    window.addEventListener("resize", resize);
    root.current.addEventListener("summon-finish", cancel);
    const element = root.current,
      cv = canvas.current;
    (async () => {
      try {
        const { createSummonScene } = await import("../skins/summon-scene.js");
        if (disposed || finished || document.hidden) return finish();
        scene = createSummonScene(cv, plan);
        resize();
        await scene.ready;
        // A card cannot land seamlessly until its actual back artwork is decoded.
        await Promise.allSettled(
          [...element.querySelectorAll("img")].map((img) => img.decode?.()),
        );
        if (disposed || finished) return;
        // Synthesising the first sound must not block the opening camera frames.
        prepareSummonSound();
        // Re-measure after loading (mobile viewport/font layout may have settled).
        // Keep the cover over the first GPU draw, then start at the first actual
        // playback frame rather than charging preparation time to the ascent.
        resize();
        scene.render(0);
        function frame(now) {
          if (disposed || finished) return;
          try {
            if (start === undefined) {
              start = now;
              setLoading(false);
              releaseSound = startSummonSound();
              clearTimeout(deadline);
              deadline = setTimeout(finish, SUMMON_TIMING.total + 600);
            }
            const ms = Math.max(0, Math.min(now - start, SUMMON_TIMING.total)),
              f = scene.render(ms),
              bounds = element.getBoundingClientRect();
            const targets =
              targetRef.current?.querySelectorAll(".reveal-card") || [];
            const cards = element.querySelectorAll(".summon-flight-card");
            element.dataset.stage = f.stage;
            element.style.setProperty(
              "--loading-opacity",
              String(1 - smooth(ms / 320)),
            );
            element.style.setProperty(
              "--loading-visibility",
              ms >= 320 ? "hidden" : "visible",
            );
            element.style.setProperty(
              "--scene-opacity",
              String(1 - smooth((ms - 7750) / 1250)),
            );
            element.style.setProperty(
              "--label-opacity",
              String(smooth(ms / 500) * (1 - smooth((ms - 3600) / 600))),
            );
            cards.forEach((card, i) => {
              const target = targets[i]?.getBoundingClientRect();
              if (!target) return;
              const delay = results.length === 1 ? 0 : i * 35;
              const p = smooth((ms - 7000 - delay) / (2000 - delay));
              const tx = target.left - bounds.left + target.width / 2,
                ty = target.top - bounds.top + target.height / 2;
              const wave = Math.sin(p * Math.PI),
                side = i % 2 ? 1 : -1;
              const x =
                f.origin.x + (tx - f.origin.x) * p + side * wave * (20 + i * 2);
              const y =
                f.origin.y + (ty - f.origin.y) * p - wave * (70 + (i % 3) * 18);
              const scale = 0.11 + p * 0.89,
                roll = side * (1 - p) * (30 + i * 3),
                yaw = (1 - p) * 220;
              card.style.width = `${target.width}px`;
              card.style.height = `${target.height}px`;
              card.style.opacity =
                ms >= 7000 + delay
                  ? String(Math.min(1, (ms - 7000 - delay) / 100))
                  : "0";
              card.style.transform = `translate3d(${x - target.width / 2}px,${y - target.height / 2}px,0) perspective(1000px) rotateY(${yaw}deg) rotateZ(${roll}deg) scale(${scale})`;
              card.style.filter = `drop-shadow(0 0 ${4 + wave * 12}px ${plan.gold ? "#f7d88b" : "#a7d6ec"})`;
            });
            if (f.done) finish();
            else raf = requestAnimationFrame(frame);
          } catch {
            finish();
          }
        }
        // Let the warm-up draw reach the compositor while still fully covered.
        raf = requestAnimationFrame(() => {
          if (!disposed && !finished) raf = requestAnimationFrame(frame);
        });
      } catch {
        finish();
      }
    })();
    return () => {
      disposed = true;
      clearTimeout(deadline);
      cancelAnimationFrame(raf);
      releaseSound();
      document.removeEventListener("visibilitychange", visibility);
      cv.removeEventListener("webglcontextlost", lost);
      window.removeEventListener("resize", resize);
      element.removeEventListener("summon-finish", cancel);
      scene?.dispose();
    };
  }, [plan, results.length, targetRef]);
  return (
    <div
      ref={root}
      className={`summon-intro ${plan.gold ? "is-gold" : "is-bronze"}`}
      aria-label={loading ? "召喚の門を準備中" : "召喚の門が開いています"}
      aria-busy={loading}
      role="group"
    >
      <style>{STYLES + LOADING_STYLES}</style>
      <canvas ref={canvas} className="summon-scene" aria-hidden="true" />
      <div className="summon-loading" aria-hidden="true">
        <span className="summon-loading-mark" />
        <p>召喚の門を準備中</p>
      </div>
      <div className="summon-cinema-shade" aria-hidden="true" />
      <div className="summon-world-name" aria-hidden="true">
        <span>運命の一枚を、この手に。</span>
        <strong>{SUMMON_WORLDS[plan.world].name}</strong>
        <i />
      </div>
      <div className="summon-flight" aria-hidden="true">
        {results.map((_, i) => (
          <img
            className="summon-flight-card"
            src={cardBackImg}
            key={i}
            alt=""
          />
        ))}
      </div>
      <button
        type="button"
        className="summon-intro-skip"
        /* 「スキップ」だけだと引き終わりまで飛ぶと読まれる。飛ばす対象(門)を名指しする
           (2026-09-18 本人の決め)。全部を省くのはガチャ画面の「召喚の演出を飛ばす」 */
        aria-label="門の演出をスキップして、カードをめくる画面へ"
        onClick={(event) => {
          event.stopPropagation();
          root.current?.dispatchEvent(new Event("summon-finish"));
        }}
      >
        門をスキップ <span aria-hidden="true">≫</span>
      </button>
    </div>
  );
}
