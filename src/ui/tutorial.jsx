import { useState } from "react";
import {
  TUTORIALS,
  EXTRA_TUTORIALS,
  moveHintCandidates,
} from "../game/tutorial.js";
import { MOVE_TEXT, SUIT_SYMBOL } from "../game/constants.js";
import { squareName } from "../game/board.js";
import { MoveDiagram } from "./guides.jsx";
import { getCollection } from "../skins/store.js";
import { foilRevealed } from "../skins/collection.js";
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
/**
 * 動きの一覧。相手の駒が from → to へ動いたとき、どの数字ならそう動けるかを図で並べる。
 * 素の駒で届かず、王でだけ届く数字があれば、それが「王が割れた」印
 */
export function MoveHintPanel({ hint }) {
  const { plain, kings } = moveHintCandidates(hint);
  const size = hint.size || 5;
  const path = `${squareName(hint.from.row, hint.from.col, size)} → ${squareName(hint.to.row, hint.to.col, size)}`;
  const kingHits = kings.filter((k) => k.ok);
  return (
    <div className="move-hint" role="group" aria-label="動きの一覧">
      <p className="move-hint-title">{path} に動ける駒は?</p>
      <div className="move-hint-rows">
        {plain.map((c) => (
          <div className={`move-hint-row ${c.ok ? "is-ok" : "is-no"}`} key={c.rank}>
            <MoveDiagram rank={c.rank} gridSize={5} />
            <span className="move-hint-label">
              <b>{c.rank}</b>
              <small>{MOVE_TEXT[c.rank]}</small>
            </span>
            <span className="move-hint-mark">{c.ok ? "○" : "✗"}</span>
          </div>
        ))}
        {kingHits.map((c) => (
          <div className="move-hint-row is-ok is-king" key={`k${c.rank}`}>
            <MoveDiagram rank={c.rank} isKing gridSize={7} />
            <span className="move-hint-label">
              <b>{c.rank} の王</b>
              <small>王は、同じ数字の枚数ぶん遠くへ動ける</small>
            </span>
            <span className="move-hint-mark">○</span>
          </div>
        ))}
      </div>
      <p className="move-hint-verdict">
        {kingHits.length
          ? `素の駒では届かない。届く理由は王の効果(同じ数字の枚数ぶん遠くへ動ける)だけ。届くのは ${kingHits
              .map((c) => `${c.rank} の王`)
              .join("・")}。だから、あれが王です。`
          : "どの駒でも届きます。"}
      </p>
    </div>
  );
}

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
        {step.moveHint && <MoveHintPanel hint={step.moveHint} />}
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
  // 番外の話は、フォイルのスキンを1枚でも持っていると開く(効果盤面が使える条件と同じ。
  // 入手の経路は見ず、いま持っているかだけで決める)
  const [hasFoil] = useState(() => {
    try {
      return foilRevealed(getCollection());
    } catch {
      return false;
    }
  });
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
        {[...TUTORIALS, ...EXTRA_TUTORIALS.filter((t) => !t.needsFoil || hasFoil)].map((t) => {
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
                    <Lock size={14} />{" "}
                    Lv.{t.level}
                  </>
                ) : (
                  <>カード {t.poolLabel}</>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <button className="btn btn-ghost btn-home" onClick={onBack}>
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
