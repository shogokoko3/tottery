import { useEffect, useRef, useState } from "react";
import { honorRoot, formationLayout } from "../game/formation-honors.js";
import { areaTheme } from "../game/field-presentation.js";
import { SUIT_SYMBOL } from "../game/constants.js";
import { byId } from "../skins/catalog.js";
import { cardArtSrc } from "./cards.jsx";
import { fieldUrl } from "./fields/backdrop.jsx";
import { loadAudioSettings } from "../audio/settings.js";

/** Snapshot only the local army when the formation is awarded. */
export function formationScene(state, viewer, skins) {
  const layout = formationLayout(state, viewer);
  const theme = areaTheme(state.areas?.[viewer]);
  const absolute = (path) => new URL(path, document.baseURI).href;
  return {
    theme,
    field: absolute(fieldUrl(theme)),
    width: layout.width,
    cells: layout.cells.map((p) => {
      const selected = byId(skins?.[viewer]?.[p.rank]);
      const skin = selected?.rank === p.rank ? selected : null;
      return {
        row: p.row,
        col: p.col,
        rank: p.rank,
        king: p.king,
        suit: SUIT_SYMBOL[p.suit],
        image: absolute(skin?.image || cardArtSrc(p.rank, p.suit, p.king)),
        printed: !skin,
      };
    }),
  };
}

export function FormationHonor({ award, onClose }) {
  const frame = useRef(null),
    close = useRef(onClose);
  close.current = onClose;
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  const [config] = useState(() => {
    const settings = loadAudioSettings();
    return {
      ...award.scene,
      fresh: award.fresh,
      volume: settings.muted ? 0 : settings.se,
    };
  });
  useEffect(() => {
    const previous = document.activeElement;
    let finishTimer;
    const watchdog = setTimeout(() => close.current(), 30000);
    const timer = setTimeout(() => {
      setFailed(true);
      finishTimer = setTimeout(() => close.current(), 1800);
    }, 15000);
    const receive = (e) => {
      if (
        e.source !== frame.current?.contentWindow ||
        e.origin !== location.origin
      )
        return;
      if (e.data?.type === "tottery-honor-ready")
        frame.current.contentWindow.postMessage(
          { type: "tottery-honor-start", config },
          location.origin,
        );
      if (e.data?.type === "tottery-honor-loaded") {
        clearTimeout(timer);
        setLoaded(true);
      }
      if (e.data?.type === "tottery-honor-complete") {
        clearTimeout(finishTimer);
        finishTimer = setTimeout(() => close.current(), 1800);
      }
      if (e.data?.type === "tottery-honor-error") {
        clearTimeout(timer);
        setFailed(true);
      }
      if (e.data?.type === "tottery-honor-close") close.current();
    };
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
    };
    window.addEventListener("message", receive);
    window.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      clearTimeout(finishTimer);
      clearTimeout(watchdog);
      window.removeEventListener("message", receive);
      window.removeEventListener("keydown", key);
      previous?.focus?.();
    };
  }, [config]);
  return (
    <div
      className="formation-honor-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="布陣の称号と紋章アイコン"
    >
      <div className="formation-honor-frame">
        {!loaded && (
          <div className="formation-honor-loading" role="status">
            {failed
              ? "称号と紋章アイコンを獲得しました。設定から選べます。"
              : "布陣の称号"}
          </div>
        )}
        <iframe
          ref={frame}
          title="布陣の称号獲得演出"
          src={`${honorRoot}/index.html`}
          allow="autoplay"
          style={{ opacity: loaded ? 1 : 0 }}
          onError={() => setFailed(true)}
        />
        <button className="formation-honor-close" onClick={onClose} autoFocus>
          対局へ <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
