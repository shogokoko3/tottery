import {
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cardBackImg } from "../assets.js";
import { baseSkinId, byId } from "../skins/catalog.js";
import { scheduleFoilUnveiling } from "../skins/foil-unveiling.js";
import { createFoilUnveilingAssets } from "../skins/foil-unveiling-assets.js";
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
        <path className="foil-seal-gem" d="M45 40l9 14-9 14-9-14z" />
        {legend && (
          <g className="foil-seal-regalia">
            <path d="M13 31V14h15M62 14h15v17M13 89v17h15M62 106h15V89" />
            <path
              className="foil-seal-crown"
              d="M31 15l7 7 7-11 7 11 7-7-4 16H35zM35 34h20"
            />
            <circle cx="45" cy="54" r="33" strokeDasharray="1 5" />
            <path d="M18 76l5 9 8 4-3-8zM72 76l-5 9-8 4 3-8zM22 87l8 8 9 2-7-7zM68 87l-8 8-9 2 7-7z" />
          </g>
        )}
      </svg>
      {/* Rotate whole SVG layers, not their child groups: browsers can reuse
          their rasterized texture rather than repainting the seal each frame. */}
      <svg className="foil-seal-orbit" viewBox="0 0 90 120" fill="none">
        <circle cx="45" cy="54" r="28" strokeDasharray="34 5 2 5" />
        <path d="M45 21l3 5-3 5-3-5zM45 77l3 5-3 5-3-5zM12 54l5-3 5 3-5 3zM68 54l5-3 5 3-5 3z" />
      </svg>
      <svg className="foil-seal-orbit inner" viewBox="0 0 90 120" fill="none">
        <circle cx="45" cy="54" r="21" strokeDasharray="21 12" />
        <path d="M45 32l19 33H26z" />
      </svg>
      <span className="foil-seal-word">FOIL</span>
    </span>
  );
}

function UnveilingBurst({ active }) {
  return (
    <span className={`foil-unveiling-burst ${active ? "is-playing" : ""}`} aria-hidden="true">
      <span className="foil-unveiling-corona" />
      <span className="foil-unveiling-wave" />
      <span className="foil-unveiling-wave echo" />
      <span className="foil-unveiling-rays">
        {Array.from({ length: 20 }, (_, i) => (
          <i
            key={i}
            style={{
              "--angle": `${i * 18 + 9}deg`,
              "--length": `${100 + (i % 4) * 23}px`,
              "--delay": `${(i % 3) * 25}ms`,
            }}
          />
        ))}
      </span>
      <span className="foil-unveiling-fragments">
        {Array.from({ length: 18 }, (_, i) => {
          const angle = (i * Math.PI) / 9;
          return (
            <i
              key={i}
              style={{
                "--dx": `${Math.cos(angle) * (145 + (i % 4) * 20)}px`,
                "--dy": `${Math.sin(angle) * (210 + (i % 3) * 25)}px`,
                "--delay": `${(i % 5) * 30}ms`,
                "--twist": `${90 + i * 37}deg`,
              }}
            />
          );
        })}
      </span>
    </span>
  );
}

export function FoilUnveilingView({
  skin,
  route = "common",
  upgradedFromNormal = false,
  phase = "waiting",
  position = 1,
  total = 1,
  fallback = false,
  missing = false,
  focusRef,
  fromGrid = false,
  origin = null,
}) {
  useStyles();
  const visible = ["reveal", "settle", "complete"].includes(phase);
  const upgrading =
    skin.rarity === "SSR" && route === "surprise" && phase === "seal";
  const legend =
    skin.rarity === "SSR" &&
    (route === "legend" || ["seal", "hush"].includes(phase) || visible);
  const base = byId(baseSkinId(skin.id));
  const shown = fallback ? base : skin;
  const beforeUpgrade = upgradedFromNormal && !visible && !["seal", "hush"].includes(phase);
  return (
    <div
      ref={focusRef}
      tabIndex={-1}
      className={`foil-unveiling-stage ${fromGrid ? "from-grid" : ""} ${legend ? "is-legend" : ""} ${upgrading ? "is-upgrading" : ""}`}
      data-phase={phase}
      style={
        origin
          ? {
              "--source-x": `${origin.x}px`,
              "--source-y": `${origin.y}px`,
              "--source-scale": origin.scale,
            }
          : undefined
      }
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
        {visible ? `${skin.rarity} FOIL` : beforeUpgrade ? "SSR" : "FOIL"}
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
            ? upgradedFromNormal ? "さらなる奇跡。フォイルへ昇格。" : "輝きが、変わる。"
            : beforeUpgrade ? "この一枚に、さらなる奇跡を。" : phase === "waiting"
              ? "光が集まりはじめた。"
              : "この輝きは、誰のものか。"}
      </p>
      <div className="foil-unveiling-card">
        <UnveilingBurst active={visible || upgrading} />
        {/* Keep the seal painted until the arriving artwork has taken over.
            Removing it at reveal left a blank card while art/bloom were at 0. */}
        <span
          className={`foil-unveiling-cover ${visible && !missing ? "is-opening" : ""}`}
          aria-hidden="true"
        >
          {beforeUpgrade
            ? <FoilArtwork skin={base} src={base.card} alt="" animated={false} className="foil-unveiling-art" />
            : <FoilSeal legend={legend} />}
        </span>
        {!visible && fromGrid && (
          <span className="foil-unveiling-reverse" aria-hidden="true">
            {beforeUpgrade ? <img src={cardBackImg} alt="" draggable="false" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"inherit"}} /> : <FoilSeal legend={legend} />}
          </span>
        )}
        {upgrading && (
          <>
            <span className="foil-unveiling-upgrade" aria-hidden="true" />
            <strong className={`foil-unveiling-promotion-label ${upgradedFromNormal ? "is-foil-conversion" : ""}`}>{upgradedFromNormal ? "フォイル昇格" : "昇格"}</strong>
          </>
        )}
        {!missing && (
          <FoilArtwork
            skin={shown}
            src={shown.card}
            alt={visible ? skin.name : ""}
            aria-hidden={!visible || undefined}
            decoding="async"
            animated={false}
            className="foil-unveiling-art"
          />
        )}
        <span className="foil-unveiling-rim" aria-hidden="true" />
        <span className={`foil-unveiling-bloom ${visible ? "is-playing" : ""}`} aria-hidden="true" />
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
  upgradedFromNormal = false,
  position,
  total,
  reduce = false,
  sourceRef,
  sourceIndex,
  fromGrid = false,
  assets,
  onComplete,
}) {
  const [view, setView] = useState({
    phase: reduce ? "complete" : fromGrid ? "select" : "gather",
    fallback: false,
    missing: false,
  });
  const callback = useRef(onComplete),
    notified = useRef(false);
  const focusRef = useRef(null);
  const [origin, setOrigin] = useState(null);
  const originMeasured = useRef(false);
  useLayoutEffect(() => {
    if (!fromGrid || reduce || originMeasured.current) return;
    const source = sourceRef?.current?.querySelector(
      `[data-index="${sourceIndex}"]`,
    );
    const target = focusRef.current?.querySelector(".foil-unveiling-card");
    if (!source || !target) return;
    const a = source.getBoundingClientRect(),
      b = target.getBoundingClientRect();
    if (!a.width || !b.width) return;
    originMeasured.current = true;
    const x = a.left + a.width / 2 - b.left - b.width / 2;
    setOrigin({
      x,
      y: a.top + a.height / 2 - b.top - b.height / 2,
      scale: Math.min(a.width / b.width, a.height / b.height),
    });
  }, [fromGrid, reduce, sourceRef, sourceIndex]);
  useEffect(() => {
    focusRef.current?.focus({ preventScroll: true });
  }, []);
  callback.current = onComplete;
  useEffect(() => {
    let active = true;
    const loader = assets || createFoilUnveilingAssets();
    const prepared = loader.prepare(skin);
    // Start moving immediately. Image readiness is resolved during the build-up,
    // not by freezing the selected card before its animation. The load deadline
    // is shorter than even the shortest build-up to the identity reveal.
    prepared.promise.then(value => {
      if (active && !reduce) setView(view => ({ ...view, ...value }));
    });
    const cancelTimeline = scheduleFoilUnveiling({
      legend: skin.rarity === "SSR",
      reduce,
      fromGrid,
      onFrame: ({ phase }) =>
        active &&
        setView(view => ({
          ...view,
          phase,
          ...(prepared.value || {}),
        })),
    });
    return () => {
      active = false;
      cancelTimeline();
      if (!assets) loader.dispose();
    };
  }, [skin.id, skin.rarity, reduce, fromGrid, assets]);
  useEffect(() => {
    if (view.phase !== "complete" || notified.current) return;
    notified.current = true;
    callback.current?.();
  }, [view.phase]);
  return (
    <FoilUnveilingView
      skin={skin}
      route={route}
      upgradedFromNormal={upgradedFromNormal}
      position={position}
      total={total}
      focusRef={focusRef}
      fromGrid={fromGrid}
      origin={origin}
      {...view}
    />
  );
}
