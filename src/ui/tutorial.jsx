import { useState } from "react";
import { TUTORIALS } from "../game/tutorial.js";
import {
  levelOf,
  loadProfile,
  MAX_LEVEL,
  toNextLevel,
} from "../game/profile.js";
import { ArrowLeft, ArrowRight, Check, Crown, Hand, Lock } from "../icons.jsx";

/**
 * 台本の1枚。盤を隠さないよう、下から出る帯にしてある。
 */
/**
 * 台本の1枚。
 *
 * front を渡すと、盤の手前に出して操作を止める。読んでから決める回で、
 * 説明を読み飛ばされたくないときに使う。
 * 幕は薄くしてある。捨て札など、説明が指しているものが後ろで見えなくなると
 * かえって分からなくなるため。
 */
export function TutorialSheet({
  step,
  index,
  total,
  onNext,
  front,
  low,
  nudge,
}) {
  if (!step) return null;
  return (
    <div
      className={`tutorial-sheet ${front ? "tutorial-sheet-front" : ""} ${
        front && low ? "tutorial-sheet-low" : ""
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="tutorial-sheet-inner">
        <div className="tutorial-progress">
          {Array.from({ length: total }).map((_, i) => (
            <span className={i <= index ? "on" : ""} key={i} />
          ))}
        </div>
        <p className="tutorial-line">{step.text}</p>
        {step.hold ? null : step.need ? (
          <p className={`tutorial-wait ${nudge ? "tutorial-nudge" : ""}`}>
            <Hand size={15} /> {nudge || "光っているところを操作してください"}
          </p>
        ) : (
          <button className="btn btn-primary tutorial-next" onClick={onNext}>
            {step.end ? "とじる" : "次へ"} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/** チュートリアルの一覧。レベルが足りない話には鍵がかかる */
export function TutorialSelect({ onStart, onBack }) {
  const [profile] = useState(() => loadProfile());
  const level = levelOf(profile);
  const next = toNextLevel(profile);
  return (
    <div className="setup-wrap">
      <h2>チュートリアル</h2>
      <div className="level-badge">
        <Crown size={16} />
        <span>レベル {level}</span>
        <small>
          {level >= MAX_LEVEL
            ? "最高レベルです"
            : `次のレベルまであと ${next.toLocaleString()}`}
        </small>
      </div>
      <p className="hint">
        {TUTORIALS.some((t) => level < t.level)
          ? "話を終えるか対局すると経験値が入り、続きの話が開きます。"
          : "全12話。ここまでで、52枚すべての動きと王の力がそろいます。"}
      </p>
      <div className="menu-list">
        {TUTORIALS.map((t) => {
          const locked = level < t.level;
          return (
            <button
              className={`menu-item ${locked ? "menu-item-locked" : ""}`}
              disabled={locked}
              onClick={() => onStart(t)}
              key={t.id}
            >
              <span className="menu-item-main">
                {t.title}
                <small>{t.subtitle}</small>
              </span>
              <span className="menu-item-side">
                {locked ? (
                  <>
                    <Lock size={14} /> Lv.{t.level}
                  </>
                ) : (
                  <>カード {t.poolLabel}</>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <button className="btn btn-ghost" onClick={onBack}>
        <ArrowLeft size={16} /> ホームに戻る
      </button>
    </div>
  );
}

/** 対局のあと、レベルが上がったことを知らせる */
export function LevelUpNote({ from, to }) {
  if (from === to) return null;
  return (
    <div className="level-up">
      <Check size={16} /> レベル {from} → {to}
    </div>
  );
}
