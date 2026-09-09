/**
 * 盤面エリアの見た目のプレビュー。対局中の盤の背景(fields/<theme>.png)を
 * そのまま小さく見せ、上に 9×9 の目を薄く重ねる。
 * 宮殿は装備するフォイルで天界(天使)か魔界(悪魔)かが分かれる。
 */
import { useEffect, useRef, useState } from "react";
import { areaTheme } from "../game/field-presentation.js";
import { AREA_INFO } from "../game/areas.js";
import { fieldUrl } from "./fields/backdrop.jsx";

/** 宮殿は天界と魔界の2種。それ以外は1種 */
export function themesOf(type, skinId) {
  if (type === "palace") {
    if (skinId) return [areaTheme({ type, skin: skinId })];
    return ["heaven", "hell"];
  }
  const theme = areaTheme({ type, skin: skinId || "x" });
  return theme ? [theme] : [];
}

const THEME_LABEL = {
  earth: "土",
  sea: "海",
  forest: "森",
  ice: "氷",
  sky: "空",
  heaven: "宮殿(天使)",
  hell: "宮殿(悪魔)",
};

/** 画面に入ってから絵を読む。盤の絵は1枚 3MB ほどあり、一覧で全部を先読みしない */
function useNearView(ref) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, near]);
  return near;
}

export function AreaPreview({ type, skinId, className = "" }) {
  const ref = useRef(null);
  const near = useNearView(ref);
  const themes = themesOf(type, skinId);
  if (!themes.length) return null;
  return (
    <div className={`area-preview-row ${className}`} ref={ref}>
      {themes.map((theme) => (
        <figure className="area-preview" key={theme}>
          <div
            className={`area-preview-board ${near ? "is-loaded" : ""}`}
            style={near ? { backgroundImage: `url(${fieldUrl(theme)})` } : undefined}
            role="img"
            aria-label={`${AREA_INFO[type].name}の盤の見た目`}
          >
            <div className="area-preview-grid" aria-hidden="true">
              {Array.from({ length: 81 }).map((_, i) => (
                <span
                  key={i}
                  className={
                    i < 27 ? "zone-foe" : i >= 54 ? "zone-mine" : ""
                  }
                />
              ))}
            </div>
          </div>
          {themes.length > 1 && (
            <figcaption>{THEME_LABEL[theme] || theme}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
