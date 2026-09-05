import { useInsertionEffect, useLayoutEffect, useRef, useState } from "react";
import { baseSkinId, byId } from "../skins/catalog.js";
import {
  FOIL_ACQUISITION_MS,
  FOIL_IMAGE_TIMEOUT_MS,
  foilAcquisitionFrame,
  scheduleFoilAcquisition,
} from "../skins/foil-acquisition.js";
import { FoilArtwork } from "./foil-artwork.jsx";
import styles from "./foil-acquisition.css";

function ensureStyles() {
  if (document.getElementById("tottery-foil-acquisition-styles")) return;
  const element = document.createElement("style");
  element.id = "tottery-foil-acquisition-styles";
  element.textContent = styles;
  document.head.append(element);
}

function Acquisition({
  skin,
  play = true,
  reduce = false,
  onComplete,
  className = "",
  alt,
}) {
  const base = byId(skin?.baseId || baseSkinId(skin?.id)) || skin;
  const foil = !!skin?.foil;
  const baseSource = base?.card || base?.image;
  const foilSource = skin?.card || skin?.image;
  const immediate = !foil || !play || reduce;
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const notified = useRef(false);
  const [view, setView] = useState(() => ({
    ...foilAcquisitionFrame(0, { play: !immediate, ready: false }),
    fallback: false,
  }));

  useInsertionEffect(() => {
    if (foil) ensureStyles();
  }, [foil]);
  useLayoutEffect(() => {
    if (notified.current) return;
    if (immediate) {
      setView((current) => ({
        ...current,
        ...foilAcquisitionFrame(0, { play: false }),
      }));
      return;
    }
    let active = true;
    let settled = false;
    let foilReady = false;
    let cancelTimeline;
    const loaders = [];
    function finish(reason, fallback = false) {
      if (!active || settled) return;
      settled = true;
      clearTimeout(loadTimeout);
      cancelTimeline?.();
      setView({
        phase: "complete",
        progress: 1,
        complete: true,
        reason,
        fallback,
      });
    }
    function load(source) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        loaders.push(image);
        image.decoding = "async";
        image.onload = () => {
          const decoded =
            typeof image.decode === "function"
              ? image.decode()
              : Promise.resolve();
          decoded.then(() => {
            if (image.naturalWidth) resolve();
            else reject(new Error("Empty artwork"));
          }, reject);
        };
        image.onerror = () => reject(new Error("Artwork unavailable"));
        image.src = source;
      });
    }
    setView({ ...foilAcquisitionFrame(0, { ready: false }), fallback: false });
    const loadTimeout = setTimeout(
      () => finish("image-timeout", !foilReady),
      FOIL_IMAGE_TIMEOUT_MS,
    );
    Promise.allSettled([
      load(baseSource),
      load(foilSource).then(() => {
        foilReady = true;
      }),
    ]).then((results) => {
      if (!active || settled) return;
      if (results.some((result) => result.status !== "fulfilled")) {
        finish("image-error", !foilReady);
        return;
      }
      clearTimeout(loadTimeout);
      cancelTimeline = scheduleFoilAcquisition({
        onFrame: (frame) => {
          if (active && !settled) setView({ ...frame, fallback: false });
        },
        onComplete: (frame) => finish(frame.reason),
      });
    });
    return () => {
      active = false;
      clearTimeout(loadTimeout);
      cancelTimeline?.();
      for (const image of loaders) {
        image.onload = null;
        image.onerror = null;
      }
    };
  }, [foil, baseSource, foilSource, immediate]);

  // Notify after the finished artwork is committed, including skip/error paths.
  useLayoutEffect(() => {
    if (!view.complete || notified.current) return;
    notified.current = true;
    complete.current?.({ reason: view.reason });
  }, [view.complete, view.reason]);

  const finished = immediate || view.complete;
  if (!foil || finished) {
    const shown = view.fallback ? base : skin;
    return (
      <FoilArtwork
        skin={shown}
        src={view.fallback ? baseSource : foilSource}
        alt={alt || shown?.name || ""}
        className={className}
        animated={foil && play && !reduce && !view.fallback}
        onError={() => {
          if (!view.fallback)
            setView((current) => ({ ...current, fallback: true }));
        }}
      />
    );
  }
  const running = view.phase !== "waiting";
  return (
    <span
      className={`foil-acquisition ${running ? "is-running" : ""} ${className}`}
      data-phase={view.phase}
      style={{ "--foil-acquisition-duration": `${FOIL_ACQUISITION_MS}ms` }}
      role="img"
      aria-label={base?.name || "カード"}
    >
      <img
        className="foil-acquisition-base"
        src={baseSource}
        alt=""
        draggable={false}
      />
      {running && (
        <>
          <img
            className="foil-acquisition-coating"
            src={foilSource}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <span className="foil-acquisition-rim" aria-hidden="true" />
          <span className="foil-acquisition-edge-light" aria-hidden="true" />
          <span className="foil-acquisition-sparks" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="foil-acquisition-sweep" aria-hidden="true" />
          <span className="foil-acquisition-burst" aria-hidden="true" />
          <span className="foil-acquisition-glint" aria-hidden="true" />
        </>
      )}
    </span>
  );
}

// A different character starts a fresh acquisition even if its parent reuses this slot.
export function FoilAcquisition(props) {
  return <Acquisition key={props.skin?.id || "normal"} {...props} />;
}
