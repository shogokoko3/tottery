import { useEffect, useInsertionEffect, useRef, useState } from "react";
import { FREEZE_TIMES } from "../skins/summon-freeze.js";
import { startFreezeSound } from "../skins/freeze-sound.js";
import styles from "./summon-freeze.css";

export function useSummonFreeze(enabled, intro, reduce) {
  const opened = useRef(false);
  const [phase, setPhase] = useState(enabled ? "arrive" : "off");
  useInsertionEffect(() => {
    if (document.getElementById("summon-freeze-styles")) return;
    const style = document.createElement("style");
    style.id = "summon-freeze-styles";
    style.textContent = styles;
    document.head.append(style);
  }, []);
  useEffect(() => {
    if (!enabled || intro || opened.current) return;
    if (reduce) {
      setPhase((p) => (p === "released" ? p : "invitation"));
      return;
    }
    const timers = Object.entries(FREEZE_TIMES).map(([name, at]) =>
      setTimeout(() => setPhase(name), at),
    );
    return () => timers.forEach(clearTimeout);
  }, [enabled, intro, reduce]);
  useEffect(() => {
    if (reduce || !["collapse", "released"].includes(phase)) return;
    return startFreezeSound(phase === "released" ? "release" : "collapse");
  }, [phase, reduce]);
  return [
    phase,
    () => {
      opened.current = true;
      setPhase("released");
    },
  ];
}
export function SummonFreeze({ phase, reduce, onOpen }) {
  const button = useRef(null);
  useEffect(() => {
    if (phase === "invitation") button.current?.focus({ preventScroll: true });
  }, [phase]);
  if (["off", "arrive", "stop"].includes(phase)) return null;
  return (
    <div
      className={`summon-freeze ${reduce ? "is-reduced" : ""}`}
      data-phase={phase}
    >
      <div className="freeze-cut" aria-hidden="true">
        <i />
      </div>
      {phase === "invitation" && (
        <div className="freeze-invitation">
          <div className="freeze-sigil" aria-hidden="true">
            <svg viewBox="0 0 160 160" fill="none">
              <circle cx="80" cy="80" r="68" />
              <circle cx="80" cy="80" r="56" strokeDasharray="1 8" />
              <path d="M80 4v24M80 132v24M4 80h24M132 80h24M80 29l17 34 34 17-34 17-17 34-17-34-34-17 34-17z" />
              <path d="M80 50l10 20 20 10-20 10-10 20-10-20-20-10 20-10z" />
            </svg>
            <b>✦</b>
          </div>
          <p className="freeze-kicker">運命が、動き出す。</p>
          <h2>
            すべての札に、
            <br />
            新たな輝きを。
          </h2>
          <p className="freeze-instruction">
            ボタンを押して、10枚を一斉に開こう。
          </p>
          <button ref={button} className="freeze-open" onClick={onOpen}>
            <span>全札を解放する</span>
            <small>10枚をオープン</small>
          </button>
        </div>
      )}
      {phase === "released" && (
        <div className="freeze-release" aria-hidden="true">
          <i />
          <b>運命解放</b>
        </div>
      )}
    </div>
  );
}
