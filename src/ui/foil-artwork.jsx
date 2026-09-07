import { useInsertionEffect, useLayoutEffect, useRef, useId } from "react";
import { attachFoilMaterial } from "../skins/foil-material.js";
import styles from "./foil-artwork.css";

// The app bundles CSS as text. Install this stylesheet once even when a full
// board mounts many copies; ordinary artwork preserves its existing img markup.
function ensureStyles() {
  if (document.getElementById("tottery-foil-artwork-styles")) return;
  const element = document.createElement("style");
  element.id = "tottery-foil-artwork-styles";
  element.textContent = styles;
  document.head.append(element);
}

export function FoilArtwork({
  skin,
  alt = "",
  className = "",
  loading,
  animated = true,
  src,
  style,
  ...imageProps
}) {
  const waveId = `foil-background-${useId().replace(/:/g, "")}`;
  const image = useRef(null);
  const canvas = useRef(null);
  const foil = !!skin?.foil;
  const source = src || skin?.image || skin?.card;
  const baseId = skin?.baseId || skin?.id?.replace(/:foil$/, "");
  const { objectFit, objectPosition, ...wrapperStyle } = style || {};

  useInsertionEffect(() => {
    if (foil) ensureStyles();
  }, [foil]);
  useLayoutEffect(() => {
    if (!foil || !animated || !canvas.current || !image.current) return;
    const player = attachFoilMaterial({
      canvas: canvas.current,
      image: image.current,
      skinId: baseId,
    });
    return () => player.destroy();
  }, [foil, animated, source, baseId]);

  const artwork = (
    <img
      {...imageProps}
      ref={image}
      src={source}
      alt={alt}
      loading={loading}
      style={{ objectFit, objectPosition }}
      draggable={false}
    />
  );
  if (!foil)
    return (
      <img
        {...imageProps}
        ref={image}
        src={source}
        alt={alt}
        className={className || undefined}
        style={style}
        loading={loading}
        draggable={false}
      />
    );
  return (
    <span
      className={`foil-artwork ${className}`}
      style={style ? wrapperStyle : undefined}
      data-foil={baseId}
    >
      {artwork}
      {animated && (
        <>
          <svg
            className="foil-wave-definition"
            aria-hidden="true"
            width="0"
            height="0"
          >
            <defs>
              <filter id={waveId} x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.012 0.026"
                  numOctaves="1"
                  seed="8"
                  result="wave"
                >
                  <animate
                    attributeName="baseFrequency"
                    values="0.012 0.026;0.019 0.038;0.012 0.026"
                    dur="6s"
                    repeatCount="indefinite"
                  />
                </feTurbulence>
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="wave"
                  scale="5"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>
          </svg>
          <span className="foil-existing-background" aria-hidden="true">
            <img
              src={source}
              alt=""
              loading={loading}
              draggable={false}
              style={{ objectFit, objectPosition, filter: `url(#${waveId})` }}
            />
          </span>
          <canvas
            ref={canvas}
            className="foil-artwork-light"
            aria-hidden="true"
          />
        </>
      )}
    </span>
  );
}
