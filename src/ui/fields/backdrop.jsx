import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BackgroundObjects } from "./background-objects.jsx";
import { areaTheme } from "../../game/field-presentation.js";

const files = typeof __FIELD_FILES__ === "undefined" ? {} : __FIELD_FILES__;
export const fieldUrl = (theme) => `fields/${files[theme] || `${theme}.png`}`;

/**
 * 絵の縁(盤の内側の余白)の割合。以前は 12% で、9×9 の1マスがスマホで 27px ほどになり
 * 駒を触りにくかった(2026-09-11 本人の指摘)。小さな画面ほど縁を削ってマスを残す(5% でもまだ小さいとのことで 3% に)
 */
export function fieldInsetRatio(boardWidth) {
  return boardWidth < 480 ? 0.03 : 0.08;
}

export function FieldBackdrop({ theme, areas }) {
  const root = useRef(),
    previous = useRef(theme),
    [outgoing, setOutgoing] = useState(null);
  useLayoutEffect(() => {
    const board = root.current?.parentElement;
    if (!board) return;
    const fit = () => {
      const inset = `${board.clientWidth * fieldInsetRatio(board.clientWidth)}px`;
      board.style.setProperty("--field-inset", inset);
      board.parentElement.style.setProperty("--field-label-inset", inset);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(board);
    return () => {
      observer.disconnect();
      board.style.removeProperty("--field-inset");
      board.parentElement?.style.removeProperty("--field-label-inset");
    };
  }, [!!theme]);
  useLayoutEffect(() => {
    if (previous.current === theme) return;
    setOutgoing(previous.current);
    previous.current = theme;
    const timer = setTimeout(() => setOutgoing(null), 450);
    return () => clearTimeout(timer);
  }, [theme]);
  const preload = (areas || []).map(areaTheme).filter(Boolean).join(",");
  useEffect(() => {
    for (const name of new Set(preload.split(",").filter(Boolean))) {
      const image = new Image();
      image.src = fieldUrl(name);
    }
  }, [preload]);
  if (!theme) return null;
  return (
    <div
      ref={root}
      className="field-scenery"
      data-field-theme={theme}
      aria-hidden="true"
    >
      {outgoing && outgoing !== theme && (
        <div
          className="field-layer"
          style={{ backgroundImage: `url(${fieldUrl(outgoing)})` }}
        />
      )}
      <div
        key={theme}
        className="field-layer field-current"
        style={{ backgroundImage: `url(${fieldUrl(theme)})` }}
      />
      <BackgroundObjects src={fieldUrl(theme)} theme={theme} paused={false} />
    </div>
  );
}
