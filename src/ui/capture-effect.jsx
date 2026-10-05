import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cardBackImg } from "../assets.js";
import {
  captureTiming,
  captureFrame,
  captureCues,
  capturedCells,
} from "../game/capture-sequence.js";
import { captureRate } from "../game/capture-fanfare.js";
import { vibrateCapture } from "../game/haptics.js";
import { createCaptureSound, duckMusic, playSound } from "../audio/player.js";
import { CardFace } from "./cards.jsx";
import { byId } from "../skins/catalog.js";
import { useSeats } from "./names.jsx";
import { SkinModal, useReducedMotion } from "./skin-modal.jsx";
import {
  paintCaptureBack,
  paintLostBack,
  paintRoyalLight,
} from "./capture-renderer.js";
import styles from "./capture-effect.css";
import { captureLayout, captureBackPose } from "./capture-layout.js";

const portraitImages = new Map();
const portraitSource = (skin) => skin?.boardCard || skin?.card;
const Face = memo((props) => {
  const seats = useSeats();
  const [skinId] = useState(() => {
    const skin = byId(seats.skins?.[props.owner]?.[props.rank]);
    const image = portraitImages.get(portraitSource(skin));
    return image?.complete && image.naturalWidth ? skin.id : false;
  });
  return <CardFace {...props} skinId={skinId} size="lg" animated={false} />;
});
const clamp = (n) => Math.max(0, Math.min(1, n));
const ease = (n) => {
  n = clamp(n);
  return n * n * (3 - 2 * n);
};
const mix = (a, b, n) => a + (b - a) * n;

function backTexture(image, moon) {
  const canvas = document.createElement("canvas");
  canvas.width = 150;
  canvas.height = 202;
  const c = canvas.getContext("2d");
  c.fillStyle = "#122033";
  c.fillRect(0, 0, 150, 202);
  if (!moon && image.complete && image.naturalWidth)
    c.drawImage(image, 0, 0, 150, 202);
  else {
    c.strokeStyle = "#b6a36b";
    c.lineWidth = 3;
    c.strokeRect(8, 8, 134, 186);
    c.strokeRect(15, 15, 120, 172);
    c.fillStyle = "#e7dba2";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "70px serif";
    c.fillText(moon ? "☾" : "✦", 75, 101);
  }
  return canvas;
}

/** The board stays mounted throughout. Hidden faces do not exist in the DOM
 * until the shared timeline reaches reveal; the canvas only receives backs. */
export function CaptureEffect({
  reveal,
  defeat,
  move,
  boardRef,
  boardSize,
  viewer,
  final,
  onClose,
}) {
  const reduced = useReducedMotion();
  const seats = useSeats();
  const cards = reveal.defeated || [];
  const q = useMemo(
    () => captureTiming(move, cards.length, reduced),
    [move, cards.length, reduced],
  );
  const points = useMemo(
    () => capturedCells(defeat?.cells, reveal.capturedBy),
    [defeat, reveal],
  );
  const [view, setView] = useState({
    shown: 0,
    collected: 0,
    index: -1,
    royal: false,
    done: false,
  });
  const canvas = useRef(null),
    floating = useRef(null),
    titleRef = useRef(null),
    footer = useRef(null),
    slots = useRef([]);
  const elapsed = useRef(0),
    finish = useRef(false);
  const mine =
    viewer == null || reveal.capturedBy == null || viewer === reveal.capturedBy;
  const doneRef = useRef(false);
  doneRef.current = view.done;

  // Start loading during the back-only charge. Never delay the strike or leave
  // a blank face if a skin cannot be fetched; normal art is bundled in the app.
  useLayoutEffect(() => {
    for (const card of cards) {
      const skin = byId(seats.skins?.[card.owner]?.[card.rank]);
      const src = portraitSource(skin);
      if (!src || portraitImages.has(src)) continue;
      const image = new Image();
      image.onerror = () => portraitImages.delete(src);
      portraitImages.set(src, image);
      image.src = src;
    }
  }, [cards, seats.skins]);

  useLayoutEffect(() => {
    const el = canvas.current,
      context = el?.getContext("2d");
    if (!context) {
      setView({
        shown: cards.length,
        collected: cards.length,
        index: cards.length - 1,
        royal: false,
        done: true,
      });
      return;
    }
    let raf,
      alive = true,
      last = null,
      lastView = "",
      previous = -1;
    let rect,
      bounds,
      layout,
      width,
      height,
      dpr,
      textures = [];
    const image = new Image();
    image.src = cardBackImg;
    const refreshTextures = () => {
      textures = [0, 1].map((owner) =>
        backTexture(image, seats.backs?.[owner] === "moon-crest"),
      );
    };
    refreshTextures();
    image.onload = refreshTextures;
    const measure = () => {
      width = el.clientWidth;
      height = el.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      bounds = el.getBoundingClientRect();
      rect = boardRef.current?.getBoundingClientRect();
      const header = document.querySelector(".top-bar");
      layout = captureLayout({
        width,
        height,
        headerBottom:
          (header?.getBoundingClientRect().bottom ?? 0) - bounds.top,
        footerTop:
          (footer.current?.getBoundingClientRect().top ?? bounds.bottom - 150) -
          bounds.top,
        titleHeight: titleRef.current?.getBoundingClientRect().height || 54,
      });
      if (titleRef.current) titleRef.current.style.top = `${layout.titleY}px`;
    };
    measure();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    observer?.observe(el);
    if (boardRef.current) observer?.observe(boardRef.current);
    if (footer.current) observer?.observe(footer.current);
    if (titleRef.current) observer?.observe(titleRef.current);
    const header = document.querySelector(".top-bar");
    if (header) observer?.observe(header);
    window.addEventListener("resize", measure);
    const audio = createCaptureSound();
    const unduck = duckMusic(q.reveal + cards.length * q.gap + 1400);
    const cues = captureCues(q, mine);
    let announced = 0,
      royalPlayed = false;

    const render = (now) => {
      if (!alive) return;
      if (last !== null && !document.hidden)
        elapsed.current += Math.min(64, now - last);
      last = now;
      if (finish.current)
        elapsed.current = q.reveal + cards.length * q.gap + 2200;
      const t = elapsed.current,
        frame = captureFrame(t, q, cards);
      const flipped = viewer === 1;
      const { focal, zoom } = layout;
      const positions = (
        points.length
          ? points
          : [
              {
                row: (boardSize - 1) / 2,
                col: (boardSize - 1) / 2,
                owner: 1 - (reveal.capturedBy || 0),
              },
            ]
      ).map((p) => ({
        x: rect
          ? rect.left -
            bounds.left +
            (((flipped ? boardSize - 1 - p.col : p.col) + 0.5) * rect.width) /
              boardSize
          : focal.x,
        y: rect
          ? rect.top -
            bounds.top +
            (((flipped ? boardSize - 1 - p.row : p.row) + 0.5) * rect.height) /
              boardSize
          : focal.y,
        owner: p.owner,
      }));
      const base = (boardSize >= 9 ? 26 : 38) / 75;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const shade = 0.4 * ease((t - q.lift) / Math.max(1, q.ready - q.lift));
      context.fillStyle = `rgba(3,8,16,${shade})`;
      context.fillRect(0, 0, width, height);
      if (t < q.melt + 950) {
        // まとめ取りも裏面を中央へ集め、重なり切ったら1枚の破砕として描く。
        // ひびは到着後の静止時間を経てから。取った位置では割らない。
        const backs = t >= q.ready ? positions.slice(0, 1) : positions;
        backs.forEach((p) => {
          const pose = captureBackPose(t, q, p, focal, base, zoom);
          context.save();
          context.translate(pose.x, pose.y);
          (mine ? paintCaptureBack : paintLostBack)(
            context,
            textures[p.owner] || textures[0],
            t,
            q,
            pose.scale,
          );
          context.restore();
        });
      }
      if (mine && frame.royal && !reduced) {
        context.save();
        context.translate(focal.x, focal.y);
        paintRoyalLight(context, t - frame.at - 220, zoom);
        context.restore();
      }
      // A face materializes where the broken back was. Only after the reading
      // pause does it arc into the captured-card row; the board never shakes.
      if (floating.current && frame.index >= 0) {
        const slot = slots.current[frame.index]?.getBoundingClientRect();
        const fly = reduced
          ? frame.done
            ? 1
            : 0
          : ease((t - frame.collect) / 280);
        const x = mix(
          focal.x,
          slot ? slot.left - bounds.left + slot.width / 2 : focal.x,
          fly,
        );
        const y =
          mix(
            focal.y,
            slot ? slot.top - bounds.top + slot.height / 2 : height - 100,
            fly,
          ) -
          Math.sin(fly * Math.PI) * (reduced ? 0 : 34);
        const scale = mix((109.5 * zoom) / 78, 40 / 78, fly);
        floating.current.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${scale})`;
        floating.current.style.opacity = frame.done
          ? "0"
          : String(ease((t - frame.at) / 140));
      }
      if (!finish.current && !document.hidden) {
        for (const [at, cue] of cues)
          if (previous < at && t >= at) {
            audio.play(cue);
            if (cue === "hit" || cue === "loss-hit")
              vibrateCapture({ mine, king: false, count: 1 });
          }
        if (
          mine &&
          frame.shown > announced &&
          frame.shown > 0 &&
          cards.length > 1
        ) {
          playSound("capture", {
            rate: captureRate({ index: frame.index, total: cards.length }),
          });
          if (frame.index > 0) audio.play("open");
        }
        if (frame.royal && !royalPlayed) {
          audio.play(mine ? "royal" : "loss-royal");
          vibrateCapture({ mine, king: true, count: 1 });
          royalPlayed = true;
        }
      }
      announced = frame.shown;
      previous = t;
      const key = `${frame.shown}:${frame.royal}:${frame.done}`;
      if (key !== lastView) {
        lastView = key;
        setView(frame);
      }
      if (!frame.done) raf = requestAnimationFrame(render);
      else unduck?.();
    };
    const hidden = () => {
      if (document.hidden) {
        finish.current = true;
        audio.stop();
        unduck?.();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    raf = requestAnimationFrame(render);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      image.onload = null;
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", hidden);
      audio.stop();
      unduck?.();
    };
  }, [q, points, boardSize, viewer, reveal, seats.backs, mine]);

  useLayoutEffect(() => {
    const slot = slots.current[view.index],
      row = slot?.parentElement;
    if (!slot || !row) return;
    if (slot.offsetLeft + slot.offsetWidth > row.scrollLeft + row.clientWidth)
      row.scrollLeft = slot.offsetLeft + slot.offsetWidth - row.clientWidth;
  }, [view.index]);

  useEffect(() => {
    if (view.done) footer.current?.querySelector("button")?.focus();
  }, [view.done]);
  const shown = cards.slice(0, view.shown);
  const royal = view.royal && shown.some((c) => c.isKing);
  const title = !mine
    ? royal
      ? "自分の王が取られた"
      : "自分の駒が取られた"
    : royal
      ? "王を討った"
      : view.shown
        ? "撃破"
        : "";
  return (
    <SkinModal
      label={mine ? "撃破したカードの公開" : "自分が失ったカードの確認"}
      className={`capture-scene ${mine ? "is-capture" : "is-loss"}`}
      onClose={() => {
        if (doneRef.current) onClose();
      }}
    >
      <style>{styles}</style>
      <canvas
        ref={canvas}
        className="capture-scene-canvas"
        aria-hidden="true"
      />
      <div
        ref={titleRef}
        className={`capture-scene-title ${royal ? "is-royal" : ""}`}
        role="status"
      >
        {title}
      </div>
      {view.index >= 0 && (
        <div
          ref={floating}
          className="capture-scene-face"
          aria-hidden="true"
          key={view.index}
        >
          <Face {...cards[view.index]} />
          {!mine && <span className="capture-loss-stamp">喪失</span>}
        </div>
      )}
      <div
        ref={footer}
        className={`capture-scene-footer ${view.done ? "is-done" : ""}`}
      >
        <p className="capture-scene-count">
          {!mine && "あなたの失った駒　"}
          {view.shown ? `${view.shown} / ${cards.length} 枚` : ""}
        </p>
        <div
          className="capture-scene-records"
          aria-label={mine ? "正体が判明したカード" : "あなたの失ったカード"}
        >
          {Array.from({ length: cards.length }, (_, index) => (
            <div
              ref={(el) => {
                slots.current[index] = el;
              }}
              className="capture-scene-record"
              key={index}
              aria-hidden={index >= view.collected}
            >
              {index < view.collected && <Face {...cards[index]} />}
            </div>
          ))}
        </div>
        <button
          className={`btn ${mine ? "btn-primary" : "btn-ghost"}`}
          disabled={!view.done}
          onClick={onClose}
        >
          {view.done
            ? final && royal
              ? mine
                ? "勝利を見る"
                : "結果を見る"
              : "確認した"
            : "正体を公開中…"}
        </button>
      </div>
    </SkinModal>
  );
}
