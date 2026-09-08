import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cardBackImg } from "../assets.js";
import { audioSettings, duckMusic, playSound } from "../audio/index.js";
import { PLAYER_META, SUIT_SYMBOL } from "../game/constants.js";
import { createPlayer, duration, eventFromStates } from "../skins/ace-magic.js";
import { byId } from "../skins/catalog.js";
import { useCollection } from "../skins/store.js";
import { cardArtSrc } from "./cards.jsx";
import { SkinFilm } from "./skin-film.jsx";
import { useReducedMotion } from "./skin-modal.jsx";

const square = ({ row, col }) => `${row},${col}`;

// Only publicPiece snapshots reach this painter. Hidden cards cannot select a
// portrait, rank, suit or king marker, including while being absorbed.
function cardPainter(event, loadouts, board) {
  const images = new Map();
  const skinOf = (p) =>
    p.face === "front" ? byId(loadouts?.[p.owner]?.[p.rank]) : null;
  const sourceOf = (p) =>
    p.face === "back"
      ? cardBackImg
      : skinOf(p)?.boardCard ||
        skinOf(p)?.card ||
        cardArtSrc(p.rank, p.suit, p.isKing);
  for (const p of [
    ...event.beforeCards,
    ...event.afterCards,
    ...event.defeated,
  ]) {
    const source = sourceOf(p);
    if (!images.has(source)) {
      const img = new Image();
      img.src = source;
      images.set(source, img);
    }
  }
  return (ctx, p, x, y, opacity, scale, size) => {
    const style = getComputedStyle(board);
    const gridWidth =
      board.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    const width = ((size === 9 ? 26 : 50) * 100) / gridWidth;
    const height = width * (size === 9 ? 35 / 26 : 67 / 50);
    const img = images.get(sourceOf(p)),
      skin = skinOf(p);
    ctx.save();
    ctx.globalAlpha *= Math.max(0, opacity);
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, width * 0.09);
    ctx.fillStyle = "#212739";
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (img?.complete && img.naturalWidth)
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
    ctx.restore();
    ctx.strokeStyle =
      p.face === "front" && p.isKing ? "#f4cf78" : PLAYER_META[p.owner].color;
    ctx.lineWidth = width * 0.035;
    ctx.stroke();
    if (p.face === "front" && (skin || !img?.naturalWidth)) {
      ctx.fillStyle = "#f9f1d8";
      ctx.fillRect(-width / 2, -height / 2, width * 0.38, height * 0.39);
      ctx.fillStyle = ["heart", "diamond"].includes(p.suit)
        ? "#9c354a"
        : "#242035";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = `bold ${width * 0.25}px Georgia, serif`;
      ctx.fillText(p.rank, -width * 0.31, -height * 0.48);
      ctx.fillText(SUIT_SYMBOL[p.suit] || "", -width * 0.31, -height * 0.27);
    }
    if (p.face === "front" && p.isKing) {
      ctx.fillStyle = "#f4cf78";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${width * 0.3}px serif`;
      ctx.fillText("♛", width * 0.29, -height * 0.38);
    }
    ctx.restore();
  };
}

function BoardMagic({ entry, boardRef, control, onFinish, onPhase }) {
  const finish = useRef(onFinish);
  finish.current = onFinish;
  useLayoutEffect(() => {
    let cancelled = false,
      player;
    const done = () => {
      if (!cancelled) finish.current(entry.key);
    };
    try {
      const board = boardRef.current;
      player = createPlayer({
        board,
        flip: entry.viewer === 1,
        onPhase,
        drawCard: cardPainter(entry.event, entry.loadouts, board),
        playSound: (kind, { speed }) => {
          const stop = playSound(
            kind === "capture" ? "aceCapture" : "aceSwap",
            { rate: speed },
          );
          const release = duckMusic(duration(entry.event) / speed);
          return () => {
            stop?.();
            release?.();
          };
        },
      });
      control.current = player;
      player
        .play(entry.event, {
          speed: entry.short ? 2 : 1,
          muted: audioSettings().muted,
        })
        .then(done, done);
    } catch (error) {
      console.warn("マジカルシルクハットの描画を終了しました。", error);
      done();
    }
    return () => {
      cancelled = true;
      player?.dispose();
      if (control.current === player) control.current = null;
    };
  }, [entry.key, boardRef, control]);
  return null;
}

export function useAceMagic(state, loadouts, { disabled, viewer, boardRef }) {
  const collection = useCollection(),
    reduce = useReducedMotion();
  const before = useRef(state),
    sequence = useRef(0),
    handled = useRef(null),
    control = useRef(null);
  const [active, setActive] = useState(null);
  const [phase, setPhase] = useState("");
  const enabled = !disabled && !reduce && collection.motion !== "off";
  const viewingPlayer = viewer ?? before.current.currentTurn;
  const event = enabled
    ? eventFromStates(before.current, state, {
        loadouts,
        viewer: viewingPlayer,
      })
    : null;
  const pending = event
    ? {
        key: sequence.current + 1,
        event,
        before: before.current,
        viewer: viewingPlayer,
        loadouts,
        short: collection.motion === "short",
        stage: collection.motion === "full" ? "film" : "board",
        defeatSeq: event.defeated.length ? state.lastDefeat?.seq : null,
      }
    : null;
  // pending also gates the first render: results, handoff and hidden ranks must
  // not flash before the layout effect starts the animation.
  useLayoutEffect(() => {
    before.current = state;
    if (!enabled) {
      setActive(null);
      return;
    }
    if (pending) {
      setPhase("");
      sequence.current = pending.key;
      if (pending.defeatSeq != null) handled.current = pending.defeatSeq;
      setActive(pending);
    }
  }, [state, enabled]);
  const entry = enabled ? active || pending : null;
  const finish = (key) =>
    setActive((current) => (current?.key === key ? null : current));
  // A background tab resumes at the committed board, without holding the turn.
  useEffect(() => {
    if (!entry) return;
    const onHidden = () => {
      if (document.hidden) finish(entry.key);
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [entry?.key]);
  const skin = byId("genie-magician");
  return {
    enabled,
    busy: !!entry,
    displayState: entry?.before || state,
    viewer: entry?.viewer,
    captureHandled:
      state.lastDefeat?.seq != null &&
      (entry?.defeatSeq === state.lastDefeat.seq ||
        handled.current === state.lastDefeat.seq),
    mask: new Set(
      entry ? [...entry.event.cells, ...entry.event.defeated].map(square) : [],
    ),
    overlay:
      active && enabled && active.stage === "film" ? (
        <SkinFilm
          key={active.key}
          skin={{
            ...skin,
            video:
              skin.videos[active.event.defeated.length ? "capture" : "swap"],
          }}
          onClose={() =>
            setActive((current) =>
              current?.key === active.key
                ? { ...current, stage: "board" }
                : current,
            )
          }
        />
      ) : null,
    boardEffect:
      active && enabled && active.stage === "board" ? (
        <BoardMagic
          entry={active}
          boardRef={boardRef}
          control={control}
          onFinish={finish}
          onPhase={setPhase}
        />
      ) : null,
    controls:
      entry?.stage === "board" ? (
        <div className="ace-magic-status" role="status">
          <span>
            マジカルシルクハット
            {entry.event.defeated.length
              ? ` · ${entry.event.defeated.length}体を包囲`
              : " · 入れ替え"}
            <small className="ace-magic-phase">{phase}</small>
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => {
              control.current?.skip();
              finish(entry.key);
            }}
          >
            演出をスキップ
          </button>
        </div>
      ) : null,
  };
}
