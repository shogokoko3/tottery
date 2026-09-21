import { findTitle } from "../game/titles.js";
import { titleDesign } from "./title-design.js";

// Small vector engravings stay crisp in the clock bar and in the large preview.
const CRESTS = {
  laurel:
    "M12 21C2 16 3 7 7 3M12 21C22 16 21 7 17 3M6 7l-3-2m3 7-4-2m6 7-4-1M18 7l3-2m-3 7 4-2m-6 7 4-1M12 6l1.5 4L18 12l-4.5 2L12 18l-1.5-4L6 12l4.5-2Z",
  sword: "M5 21 19 3l-1 8-5 4M3 14l7 6M4 19l2 2M5 3l14 18M14 18l7-5",
  shield: "M12 2 21 6l-2 10-7 6-7-6L3 6ZM12 6v11M8 10h8M7 5l5 2 5-2",
  crown: "M3 7l4 4 5-8 5 8 4-4-2 12H5ZM5 16h14M10 13l2-3 2 3-2 2Z",
  ice: "M12 1v22M2.5 6.5l19 11M2.5 17.5l19-11M8 3l4 4 4-4M8 21l4-4 4 4M3 10l5-1-1-5M21 14l-5 1 1 5M3 14l5 1-1 5M21 10l-5-1 1-5",
  wing: "M12 21v-9C9 4 4 9 2 2c-2 9 1 15 8 16M12 12c3-8 8-3 10-10 2 9-1 15-8 16M4 9l5 4M4 14l5 2M20 9l-5 4m5 1-5 2M9 3h6",
  grave: "M6 19V8a6 6 0 0 1 12 0v11M4 19h16v3H4ZM12 7v8M9 10h6M9 17h6",
  leaf: "M3 21 18 6M6 17C0 4 11 1 22 2c-1 12-5 20-16 15ZM8 15l-1-6m5 2 0-6m0 6 6 1",
  wave: "M2 17c5-1 3-10 10-12 5-2 10 2 8 7-4-3-7-1-6 2 1 3 5 4 8 3M2 21c4-3 6 3 10 0s6 3 10 0M8 15c0-4 3-7 6-6",
  cards: "m3 6 8-3 6 16-8 3Zm8-3 8-1 3 17-5 1M8 10l4 3-2 4-3-3ZM16 6l2 2",
  sun: "M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2M12 6l5 3v6l-5 3-5-3V9ZM12 9l3 3-3 3-3-3Z",
  moon: "M17 3A10 10 0 1 0 21 17 9 9 0 0 1 17 3ZM18 6l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z",
  bone: "M5 12V8a7 7 0 0 1 14 0v4l-3 3v6H8v-6ZM8 9h1m6 0h1m-4 3v2M8 17h8m-5 0v4m3-4v4",
  anchor:
    "M12 8v14M7 11h10M3 14v4l9 4 9-4v-4M1 16l2-3 3 3m12 0 3-3 2 3M15 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  bow: "M4 3c18-2 19 15 17 17M4 3l17 17M3 21 21 3M15 3h6v6M3 16l5 5",
  axe: "M4 22 19 3M11 4l9 8c4-7 1-11-4-11ZM3 9l9 8C4 22 0 17 3 9Z",
  dragon:
    "M4 22l7-8-6-1 4-8 7-3-1 5 6 4-6 3 2 5-7-1M9 5 3 2l1 7M16 9h1M10 18l-1 4",
  horn: "M7 10C0 8 1 1 2 1c2 5 6 2 8 7h4c2-5 6-2 8-7 1 0 2 7-5 9l2 6-7 6-7-6ZM8 13l2 2m6-2-2 2M10 18h4",
  star: "m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1ZM3 3v3M1.5 4.5h3M21 18v4m-2-2h4",
  portal:
    "M12 2 22 8v9l-10 5-10-5V8ZM12 6l6 4v5l-6 3-6-3v-5ZM12 2v4m10 11-4-2M2 17l4-2M12 10l2 2-2 2-2-2Z",
  book: "M12 6C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-6-2-10 2ZM12 6v15M5 8l4 1m-4 3 4 1m6-4 4-1m-4 5 4-1",
  gem: "M7 3h10l5 7-10 12L2 10ZM2 10h20M7 3l5 19 5-19M7 3l5 7 5-7",
};

function Ornament({ motif, level, flip = false }) {
  const organic = ["wing", "leaf", "laurel", "bow"].includes(motif);
  const sharp = ["ice", "horn", "dragon", "axe"].includes(motif);
  return (
    <svg
      className={`title-frame-ornament${flip ? " is-flipped" : ""}`}
      viewBox="0 0 44 64"
      fill="none"
      aria-hidden="true"
    >
      {level === 1 ? (
        <path className="title-frame-simple" d="M30 19h-5l-6 13 6 13h5" />
      ) : level === 2 ? (
        <path
          className="title-frame-relief"
          d="M32 12 19 20l-7 12 7 12 13 8M30 20l-8 12 8 12M22 27l4 5-4 5-4-5Z"
        />
      ) : motif === "grave" ? (
        <>
          <path
            className="title-frame-relief"
            d="M10 49V22a11 11 0 0 1 22 0v27ZM7 49h28v5H7ZM4 54h34v4H4Z"
          />
          <path
            className="title-frame-metal"
            d="M14 46V22a7 7 0 0 1 14 0v24M21 23v14M16 28h10M17 41h8"
          />
        </>
      ) : organic ? (
        <path
          className="title-frame-relief"
          d="M39 32C20 29 12 15 4 3c-2 17 7 32 26 35C15 42 12 49 10 58c12-4 22-10 29-26ZM8 13l24 20M10 24l21 10M18 49l13-12"
        />
      ) : sharp ? (
        <path
          className="title-frame-relief"
          d="m39 32-17-7-7-22-4 20-8-7 5 16-5 15 9-6 3 20 8-22ZM15 14l5 17-5 20M8 32h24"
        />
      ) : (
        <path
          className="title-frame-relief"
          d="M39 32 24 22 20 7l-9 9 4 9-10 7 10 7-4 9 9 9 4-15ZM20 15l2 13-10 4 10 4-2 13M29 27l-4 5 4 5"
        />
      )}
      {level >= 3 && (
        <path
          className="title-frame-filigree"
          d="M40 17C28 19 33 4 23 4M40 47c-12-2-7 13-17 13M28 8l-5-4 5-2M28 56l-5 4 5 2"
        />
      )}
      {level >= 5 && (
        <>
          <path
            className="title-frame-fan"
            d="M38 32 29 12 27 1 19 12 13 1 10 18 1 10 5 29 1 34 8 41 5 55 17 49 21 63 29 49 38 32ZM12 20l19 12-20 12M24 10l7 22-9 22"
          />
          <path
            className="title-frame-jewel"
            d="m25 23 7 9-7 9-7-9Zm9-18 3 5-3 5-3-5Zm0 44 3 5-3 5-3-5Z"
          />
          <path className="title-frame-gem-facet" d="m25 23 2 9-2 9-2-9Z" />
        </>
      )}
      {level >= 4 && (
        <path
          className="title-frame-metal"
          d="M39 8 35 3 31 8l4 5ZM39 56l-4-5-4 5 4 5ZM40 23l-5 9 5 9"
        />
      )}
      {level === 6 && (
        <path
          className="title-frame-radiance"
          d="M16 5 9 0l2 12M6 22 0 18l2 10M6 43 0 47l6-1M18 55l-5 9 9-5M31 17l7-3-3 8"
        />
      )}
    </svg>
  );
}

export function TitleFrame({
  id,
  size = "standard",
  animated = false,
  className = "",
}) {
  const title = findTitle(id);
  const design = titleDesign(id);
  if (!title || !design) return null;
  const { motif, palette, level, tier, gems, style } = design;
  // Keep the date and accolade readable even in the narrow online clock bar.
  const season = title.id.startsWith("season:") ? title.name.split(" ") : null;
  return (
    <span
      className={`title-frame title-frame--${size} ${className}`}
      style={style}
      data-title-id={title.id}
      data-motif={motif}
      data-palette={palette}
      data-level={level}
      data-tier={tier}
      data-animated={animated && level >= 3}
    >
      <span className="title-frame-surface" aria-hidden="true">
        <span className="title-frame-glint" />
      </span>
      <Ornament motif={motif} level={level} />
      <span className="title-frame-body">
        {level >= 4 && (
          <span className="title-frame-regalia" aria-hidden="true">
            <svg viewBox="0 0 120 24" fill="none" aria-hidden="true">
              <path
                className="title-frame-metal"
                d="M3 19h26l12-7h38l12 7h26M13 15h15l12-7h40l12 7h15M45 19l6-4h18l6 4"
              />
              {level >= 5 && (
                <path
                  className="title-frame-jewel"
                  d="m34 5 4 4-4 4-4-4Zm52 0 4 4-4 4-4-4ZM46 8 60 1l14 7-14 5Z"
                />
              )}
              {level === 6 && (
                <path
                  className="title-frame-crown"
                  d="m42 13-3-12 12 6 9-7 9 7 12-6-3 12ZM49 17h22M18 19l-7-9 15 5M102 19l7-9-15 5"
                />
              )}
            </svg>
          </span>
        )}
        <svg
          className="title-frame-crest"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d={CRESTS[motif]} />
        </svg>
        <span className="title-frame-name">
          {season ? (
            <>
              <span className="title-frame-date">{season[0]} </span>
              {season[1]}
            </>
          ) : (
            title.name
          )}
        </span>
        <span className="title-frame-gems" aria-hidden="true">
          {Array.from({ length: gems }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      </span>
      <Ornament motif={motif} level={level} flip />
    </span>
  );
}
