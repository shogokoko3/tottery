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
export function TutorialSheet({ step, index, total, onNext }) {
  if (!step) return null;
  return (
    <div className="tutorial-sheet" role="status" aria-live="polite">
      <div className="tutorial-sheet-inner">
        <div className="tutorial-progress">
          {Array.from({ length: total }).map((_, i) => (
            <span className={i <= index ? "on" : ""} key={i} />
          ))}
        </div>
        <p className="tutorial-line">{step.text}</p>
        {step.hold ? null : step.need ? (
          <p className="tutorial-wait">
            <Hand size={15} /> 光っているところを操作してください
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
          {level >= MAX_LEVEL ? "最高レベルです" : `次のレベルまであと ${next}`}
        </small>
      </div>
      <p className="hint">
        {TUTORIALS.some((t) => level < t.level)
          ? "対局するとレベルが上がり、続きの話が開きます。勝つと2つぶん進みます。"
          : "続きの話は順次追加します。"}
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
        <ArrowLeft size={16} /> もどる
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
