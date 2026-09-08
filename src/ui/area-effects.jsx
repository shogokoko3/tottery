import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AREA_EFFECT_MS,
  AREA_GATHER_MS,
  areaEvent,
  areaEventText,
} from "../game/area-presentation.js";
import { duckMusic, playAreaSound } from "../audio/index.js";

export function useAreaEffects(state, viewer, blocked = false) {
  const previous = useRef(state);
  const [running, setRunning] = useState(null);
  const fresh = useMemo(() => {
    const before = previous.current;
    const event = areaEvent(before, state, viewer ?? before.currentTurn);
    return event
      ? { event, before, stage: "gather", viewer: viewer ?? before.currentTurn }
      : null;
  }, [state, viewer]);
  useLayoutEffect(() => {
    previous.current = state;
    if (fresh) setRunning(fresh);
    else if (!["play", "gameover"].includes(state.phase)) setRunning(null);
  }, [state, fresh]);
  useEffect(() => {
    if (!running || blocked) return;
    duckMusic(AREA_EFFECT_MS);
    const stop = playAreaSound(running.event.type, { hit: running.event.hit });
    const release = setTimeout(
      () => setRunning((r) => r && { ...r, stage: "release" }),
      AREA_GATHER_MS,
    );
    const finish = setTimeout(
      () => setRunning(null),
      running.event.type === "thaw" ? 1000 : AREA_EFFECT_MS,
    );
    return () => {
      clearTimeout(release);
      clearTimeout(finish);
      stop?.();
    };
  }, [running?.event.id, blocked]);
  const active = (previous.current !== state ? fresh : null) || running;
  const visible = blocked ? null : active;
  return {
    ...visible,
    busy: !!visible && visible.event.type !== "thaw",
    displayState:
      visible &&
      visible.stage === "gather" &&
      !["birth", "thaw"].includes(visible.event.type)
        ? visible.before
        : state,
  };
}

const SIGNS = {
  earth: "∴",
  sea: "≈",
  forest: "❧",
  ice: "❄",
  sky: "✧",
  palace: "♜",
  thaw: "❄",
  birth: "✦",
};
export function AreaEffectNotice({ effect, names }) {
  if (!effect.event) return null;
  const { event, stage } = effect;
  return (
    <div className={`area-effect-notice area-tone-${event.type}`} role="status">
      <b>
        {SIGNS[event.type]}{" "}
        {event.player != null ? `${names[event.player]}・` : ""}
        {event.title}
      </b>
      <span>{areaEventText(event, stage)}</span>
    </div>
  );
}

export function AreaEffects({ effect, flipped = false }) {
  if (!effect.event) return null;
  const { event, stage } = effect;
  const at = (p) => ({
    left: `${(((flipped ? 8 - p.col : p.col) + 0.5) / 9) * 100}%`,
    top: `${(((flipped ? 8 - p.row : p.row) + 0.5) / 9) * 100}%`,
  });
  return (
    <div
      className={`area-effects area-tone-${event.type} area-effect-${event.type} area-effect-${stage} ${event.type === "earth" && !event.hit ? "area-effect-miss" : ""}`}
      key={event.id}
      aria-hidden="true"
    >
      <div className="area-atmosphere" />
      {event.type === "birth" ? (
        event.areas.map(
          (type, i) =>
            type && (
              <div
                key={i}
                className={`area-arrival area-tone-${type} ${(flipped ? 1 - i : i) === 0 ? "area-arrival-bottom" : "area-arrival-top"}`}
              >
                <span>{SIGNS[type]}</span>
              </div>
            ),
        )
      ) : (
        <>
          <div className="area-wave area-wave-one" />
          <div className="area-wave area-wave-two" />
          {Array.from({ length: 16 }, (_, i) => (
            <i
              className="area-mote"
              key={i}
              style={{
                "--i": i,
                "--x": `${8 + ((i * 37) % 84)}%`,
                "--y": `${10 + ((i * 23) % 80)}%`,
                "--spin": `${i * 47}deg`,
              }}
            >
              {SIGNS[event.type]}
            </i>
          ))}
        </>
      )}
      {event.trail?.map((p, i) => (
        <span className="area-footprint" key={`foot-${i}`} style={at(p)}>
          ∴
        </span>
      ))}
      {event.targets.map((p, i) => (
        <span className="area-target" key={`target-${i}`} style={at(p)}>
          <i />
          <b>{SIGNS[event.type]}</b>
        </span>
      ))}
      {event.moves?.map((m, i) => (
        <span className="area-landing" key={`land-${i}`} style={at(m.to)} />
      ))}
    </div>
  );
}
