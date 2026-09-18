import { useEffect, useInsertionEffect, useRef, useState } from "react";
import { baseSkinId, byId } from "../skins/catalog.js";
import { scheduleFoilUnveiling } from "../skins/foil-unveiling.js";
import { FOIL_IMAGE_TIMEOUT_MS } from "../skins/foil-acquisition.js";
import { FoilArtwork } from "./foil-artwork.jsx";
import styles from "./foil-unveiling.css";

function useStyles() {
  useInsertionEffect(() => {
    if (document.getElementById("tottery-foil-unveiling-styles")) return;
    const style = document.createElement("style");
    style.id = "tottery-foil-unveiling-styles";
    style.textContent = styles;
    document.head.append(style);
  }, []);
}

// A neutral seal, identical for all characters: no silhouette, name or rank.
export function FoilSeal({ legend = false }) {
  useStyles();
  return (
    <span
      className={`foil-seal ${legend ? "is-legend" : ""}`}
      aria-hidden="true"
    >
      <span className="foil-seal-mist" />
      <svg viewBox="0 0 90 120" fill="none">
        <path
          className="foil-seal-frame"
          d="M8 30V9h20M62 9h20v21M8 90v21h20M62 111h20V90M39 9l6-4 6 4-6 4zM39 111l6-4 6 4-6 4z"
        />
        <g className="foil-seal-orbit">
          <circle cx="45" cy="54" r="28" strokeDasharray="34 5 2 5" />
          <path d="M45 21l3 5-3 5-3-5zM45 77l3 5-3 5-3-5zM12 54l5-3 5 3-5 3zM68 54l5-3 5 3-5 3z" />
        </g>
        <g className="foil-seal-orbit inner">
          <circle cx="45" cy="54" r="21" strokeDasharray="21 12" />
          <path d="M45 32l19 33H26z" />
        </g>
        <path className="foil-seal-gem" d="M45 40l9 14-9 14-9-14z" />
      </svg>
      <span className="foil-seal-word">FOIL</span>
    </span>
  );
}

export function FoilUnveilingView({
  skin,
  route = "common",
  phase = "waiting",
  position = 1,
  total = 1,
  fallback = false,
  missing = false,
  focusRef,
}) {
  useStyles();
  const visible = ["reveal", "settle", "complete"].includes(phase);
  const upgrading =
    skin.rarity === "SSR" && route === "surprise" && phase === "seal";
  const legend =
    skin.rarity === "SSR" &&
    (route === "legend" || phase === "seal" || visible);
  const base = byId(baseSkinId(skin.id));
  const shown = fallback ? base : skin;
  return (
    <div
      ref={focusRef}
      tabIndex={-1}
      className={`foil-unveiling-stage ${legend ? "is-legend" : ""} ${upgrading ? "is-upgrading" : ""}`}
      data-phase={phase}
      role="group"
      aria-label="フォイルカードの正体"
    >
      <div className="foil-unveiling-aura" aria-hidden="true" />
      <div className="foil-unveiling-motes" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i
            key={i}
            style={{
              "--n": i,
              "--x": `${12 + ((i * 29) % 76)}%`,
              "--y": `${18 + ((i * 19) % 64)}%`,
            }}
          />
        ))}
      </div>
      <p className="foil-unveiling-eyebrow">
        {visible ? `${skin.rarity} FOIL` : "FOIL"}
        {total > 1 && (
          <small>
            {position} / {total}
          </small>
        )}
      </p>
      <p className="foil-unveiling-status" role="status">
        {visible
          ? "輝きの、その正体は。"
          : upgrading
            ? "輝きが、変わる。"
            : phase === "waiting"
              ? "光が集まりはじめた。"
              : "この輝きは、誰のものか。"}
      </p>
      <div className="foil-unveiling-card">
        {!visible && <FoilSeal legend={legend} />}
        {upgrading && (
          <span className="foil-unveiling-upgrade" aria-hidden="true" />
        )}
        {visible && !missing && (
          <FoilArtwork
            skin={shown}
            src={shown.card}
            alt={skin.name}
            animated={false}
            className="foil-unveiling-art"
          />
        )}
        {visible && missing && <FoilSeal legend={skin.rarity === "SSR"} />}
        <span className="foil-unveiling-rim" aria-hidden="true" />
        {visible && (
          <span className="foil-unveiling-bloom" aria-hidden="true" />
        )}
      </div>
      <div className="foil-unveiling-name" aria-live="polite">
        {visible && (
          <>
            <small>{skin.rarity} · FOIL</small>
            <strong>{base.name}</strong>
          </>
        )}
      </div>
    </div>
  );
}

export function FoilUnveiling({
  skin,
  route = "common",
  position,
  total,
  reduce = false,
  onComplete,
}) {
  const [view, setView] = useState({
    phase: reduce ? "complete" : "waiting",
    fallback: false,
    missing: false,
  });
  const callback = useRef(onComplete),
    notified = useRef(false);
  const focusRef = useRef(null);
  useEffect(() => {
    focusRef.current?.focus({ preventScroll: true });
  }, []);
  callback.current = onComplete;
  useEffect(() => {
    let active = true,
      started = false,
      cancelTimeline;
    const base = byId(baseSkinId(skin.id));
    const ready = [reduce, reduce],
      loaders = [];
    function start() {
      if (!active || started) return;
      started = true;
      clearTimeout(timeout);
      cancelTimeline = scheduleFoilUnveiling({
        legend: skin.rarity === "SSR",
        reduce,
        onFrame: ({ phase }) =>
          active &&
          setView({
            phase,
            fallback: !ready[0],
            missing: !ready[0] && !ready[1],
          }),
      });
    }
    const timeout = setTimeout(start, FOIL_IMAGE_TIMEOUT_MS);
    if (reduce) start();
    else
      Promise.allSettled(
        [skin.card, base.card].map(
          (source, i) =>
            new Promise((resolve, reject) => {
              const image = new Image();
              loaders.push(image);
              image.onload = () =>
                Promise.resolve(image.decode?.()).then(() => {
                  if (!active) return;
                  ready[i] = image.naturalWidth > 0;
                  resolve();
                }, reject);
              image.onerror = reject;
              image.src = source;
            }),
        ),
      ).then(start);
    return () => {
      active = false;
      clearTimeout(timeout);
      cancelTimeline?.();
      loaders.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [skin, reduce]);
  useEffect(() => {
    if (view.phase !== "complete" || notified.current) return;
    notified.current = true;
    callback.current?.();
  }, [view.phase]);
  return (
    <FoilUnveilingView
      skin={skin}
      route={route}
      position={position}
      total={total}
      focusRef={focusRef}
      {...view}
    />
  );
}
