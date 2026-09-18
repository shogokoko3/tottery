import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dockSheet } from "./tutorial-dock.js";
import {
  TUTORIALS,
  EXTRA_TUTORIALS,
  moveHintCandidates,
} from "../game/tutorial.js";
import { MOVE_TEXT, SUIT_SYMBOL } from "../game/constants.js";
import { squareName } from "../game/board.js";
import { MoveDiagram, KingMoveFigure } from "./guides.jsx";
import { getCollection } from "../skins/store.js";
import { foilRevealed } from "../skins/collection.js";
import {
  levelOf,
  loadProfile,
  MAX_LEVEL,
  skipTutorials,
  toNextLevel,
} from "../game/profile.js";
import { publishPlayer } from "../net/players.js";
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
/** 王にしたときの力を、一覧の1行に収まる長さで(同じ数字が1枚のとき) */
export const KING_ROW_TEXT = {
  2: "縦横に、同じ数字の枚数ぶん遠くへ(1枚なら3マス)",
  3: "斜めに、同じ数字の枚数ぶん遠くへ(1枚なら3マス)",
  4: "自分は2マスのまま。仲間の 4 を伸ばす",
  5: "自分は2マスのまま。仲間の 5 を伸ばす",
};

/**
 * 駒の動きの一覧(判定なし)。対局の初めに「この対局の駒はこう動く」を見せる。
 * kings を立てると、同じ数字を王にしたときの力を並べる
 */
export function MoveGuidePanel({ guide }) {
  const kings = !!guide.kings;
  return (
    <div
      className={`move-hint move-guide ${kings ? "move-guide-kings" : ""}`}
      role="group"
      aria-label={kings ? "王の力" : "駒の動き"}
    >
      <div className="move-hint-rows">
        {guide.ranks.map((rank) => (
          <div className={`move-hint-row ${kings ? "is-king" : ""}`} key={rank}>
            {kings ? (
              <KingMoveFigure rank={rank} />
            ) : (
              <MoveDiagram rank={rank} gridSize={5} />
            )}
            <span className="move-hint-label">
              <b>{kings ? `${rank} の王` : rank}</b>
              <small>
                {kings ? KING_ROW_TEXT[rank] || "" : MOVE_TEXT[rank]}
              </small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
          <div
            className={`move-hint-row ${c.ok ? "is-ok" : "is-no"}`}
            key={c.rank}
          >
            <MoveDiagram rank={c.rank} gridSize={5} />
            <span className="move-hint-label">
              <b>{c.rank}</b>
              <small>{MOVE_TEXT[c.rank]}</small>
            </span>
            <span className="move-hint-mark">{c.ok ? "○" : "✗"}</span>
          </div>
        ))}
        {/* 王の候補は全部並べる。「なぜその王に絞れるか」は、消える王が見えて初めて分かる */}
        {kings.map((c) => (
          <div
            className={`move-hint-row is-king ${c.ok ? "is-ok" : "is-no"}`}
            key={`k${c.rank}`}
          >
            <KingMoveFigure rank={c.rank} />
            <span className="move-hint-label">
              <b>{c.rank} の王</b>
              <small>{KING_ROW_TEXT[c.rank] || "王の力"}</small>
            </span>
            <span className="move-hint-mark">{c.ok ? "○" : "✗"}</span>
          </div>
        ))}
      </div>
      <p className="move-hint-verdict">
        {hint.verdict ||
          (kingHits.length
            ? `素の駒では届かない。王の力で届くのは ${kingHits
                .map((c) => `${c.rank} の王`)
                .join("・")} だけ。だから、あれが王です。`
            : "どの駒でも届きます。")}
      </p>
    </div>
  );
}

/** 札の外に出す先。色の変数を持つ画面の根。無ければ body */
const portalRoot = () =>
  document.querySelector(".tottery-root") || document.body;

/**
 * 「飛ばす」の確認。選ぶ→確認→確定の二段(操作の決まりと同じ)。
 * what は飛ばす対象の言い方(「この話」「残りの N 話」)、gain は入る経験値
 */
function SkipConfirm({ what, gain, level, onCancel, onConfirm }) {
  // 札(.tutorial-sheet)の中に置くと、札の pointer-events: none や z-index を引き継いで
  // 指が届かない・後ろに隠れることがある。札の外に出して、他のモーダルと同じ層に置く。
  // 出す先は body ではなく画面の根(.tottery-root)。色の変数(--gold-soft など)はそこで
  // 定義されていて、body 直下だと文字が黒・背景なしになる(2026-09-14 本人の指摘)
  const node = (
    <div className="modal-overlay tutorial-skip-confirm">
      <div className="modal-panel tutorial-offer">
        <h3>{what}を飛ばしますか？</h3>
        <p className="hint">
          終えたのと同じ扱いになります。経験値 {gain.toLocaleString()} が入り
          {level ? `、レベル ${level} に上がります` : "ます"}。
        </p>
        <p className="hint">
          飛ばした話はあとからいつでも遊べます(経験値は入りません)。
        </p>
        <div className="setup-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            やめる
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            飛ばす
          </button>
        </div>
      </div>
    </div>
  );
  return typeof document === "undefined"
    ? node
    : createPortal(node, portalRoot());
}

/**
 * 対局画面の上に置く「飛ばす」。チュートリアルの途中でいつでも押せる
 * (案内の札が出ていない待ちの場面や、サイコロ・撃破の札の間でも)。
 * 押す → 「この話」か「残りの全話」を選ぶ → 確認 → 確定、の三段。
 * onSkipThis() はこの話を飛ばす、onSkipAll(left) は残りの本編を全部飛ばす(left は未了の話)
 */
export function TutorialSkipMenu({ tutorial, onSkipThis, onSkipAll }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(null); // "this" | "all"
  if (!tutorial) return null;
  const profile = loadProfile();
  const left = TUTORIALS.filter((t) => !profile.cleared.includes(t.id));
  const leftXp = left.reduce((n, t) => n + t.xp, 0);
  const thisXp = profile.cleared.includes(tutorial.id) ? 0 : tutorial.xp || 0;
  const isMain = TUTORIALS.some((t) => t.id === tutorial.id);
  const chooser = (
    <div className="modal-overlay tutorial-skip-confirm">
      <div className="modal-panel tutorial-offer">
        <h3>チュートリアルを飛ばす</h3>
        <p className="hint">
          飛ばした話は終えたのと同じ扱いになり、あとからいつでも遊べます。
        </p>
        <div className="tutorial-skip-options">
          <button
            className="btn btn-primary btn-wide"
            onClick={() => {
              setOpen(false);
              setTarget("this");
            }}
          >
            この話を飛ばす
            {thisXp ? `（経験値 ${thisXp.toLocaleString()}）` : ""}
          </button>
          {isMain && left.length > 1 && (
            <button
              className="btn btn-ghost btn-wide"
              onClick={() => {
                setOpen(false);
                setTarget("all");
              }}
            >
              残りの {left.length} 話をすべて飛ばす（経験値{" "}
              {leftXp.toLocaleString()}）
            </button>
          )}
          <button
            className="btn btn-ghost btn-wide"
            onClick={() => setOpen(false)}
          >
            やめる
          </button>
        </div>
      </div>
    </div>
  );
  return (
    <>
      <button
        type="button"
        className="icon-btn plain tutorial-skip-top"
        onClick={() => setOpen(true)}
        aria-label="チュートリアルを飛ばす"
      >
        飛ばす
      </button>
      {open &&
        (typeof document === "undefined"
          ? chooser
          : createPortal(chooser, portalRoot()))}
      {target === "this" && (
        <SkipConfirm
          what="この話"
          gain={thisXp}
          level={levelAfterSkip(profile, thisXp)}
          onCancel={() => setTarget(null)}
          onConfirm={() => {
            setTarget(null);
            onSkipThis();
          }}
        />
      )}
      {target === "all" && (
        <SkipConfirm
          what={`残りの ${left.length} 話`}
          gain={leftXp}
          level={levelAfterSkip(profile, leftXp)}
          onCancel={() => setTarget(null)}
          onConfirm={() => {
            setTarget(null);
            onSkipAll(left);
          }}
        />
      )}
    </>
  );
}

/** 飛ばしたあとのレベル(上がらなければ null) */
function levelAfterSkip(profile, gain) {
  const before = levelOf(profile);
  const after = levelOf({ ...profile, xp: profile.xp + gain });
  return after > before ? after : null;
}

export function TutorialSheet({
  step,
  index,
  total,
  onNext,
  // 前の札をもう一度読む(読むだけの札のときだけ渡る。2026-09-18 本人の指示)
  onBack = null,
  front,
  low,
  nudge,
  // この話を飛ばす(確認のあと)。無ければ出さない
  onSkip = null,
  skipXp = 0,
  // 盤の上に重ねて出す(一覧のような読ませたい札)。盤の下は読まれにくい
  overlay = false,
}) {
  const [confirm, setConfirm] = useState(false);
  // 前面の札は盤を隠さない場所(右か下)に置く。盤の駒の動きを見ながら読めるように。
  // 置き場所は盤の位置から測るので、画面の大きさやスクロールが変わるたびに測り直す
  const [dock, setDock] = useState(null);
  // 下の帯の高さを根に伝える。重ねた画面(modal-overlay)はその分だけ上へ寄せる。
  // 同じ高さ(z-index 50)で帯が後に描かれるので、そうしないと帯が釦を覆って押せない
  // (2026-09-17 本人の報告: 予備札の「ここに置く」が押せない)
  const bandRef = useRef(null);
  useEffect(() => {
    const root = typeof document !== "undefined" ? document.documentElement : null;
    const band = bandRef.current;
    if (!root) return undefined;
    if (!band || front) {
      root.style.removeProperty("--tutorial-band");
      return undefined;
    }
    const set = () => {
      const h = Math.round(band.getBoundingClientRect().height);
      root.style.setProperty("--tutorial-band", `${h}px`);
    };
    set();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    if (ro) ro.observe(band);
    window.addEventListener("resize", set);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", set);
      root.style.removeProperty("--tutorial-band");
    };
  }, [front, step, dock]);
  useEffect(() => {
    if (!front || overlay || typeof document === "undefined") {
      setDock(null);
      return undefined;
    }
    let last = "";
    const place = () => {
      const board = document.querySelector(".board-frame");
      const d = board
        ? dockSheet(
            board.getBoundingClientRect(),
            window.innerWidth,
            window.innerHeight,
          )
        : null;
      const key = JSON.stringify(d);
      if (key !== last) {
        last = key;
        setDock(d);
      }
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [front, overlay, step]);
  if (!step) return null;
  return (
    <div
      className={`tutorial-sheet ${front ? "tutorial-sheet-front" : ""} ${
        front && low ? "tutorial-sheet-low" : ""
      } ${front && dock ? `tutorial-sheet-dock tutorial-sheet-dock-${dock.side}` : ""}`}
      role="status"
      aria-live="polite"
    >
      {confirm && (
        <SkipConfirm
          what="この話"
          gain={skipXp}
          level={levelAfterSkip(loadProfile(), skipXp)}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            onSkip();
          }}
        />
      )}
      <div
        className="tutorial-sheet-inner"
        ref={bandRef}
        style={front && dock ? dock.style : undefined}
      >
        <div className="tutorial-progress">
          {Array.from({ length: total }).map((_, i) => (
            <span className={i <= index ? "on" : ""} key={i} />
          ))}
        </div>
        <p className="tutorial-line">{step.text}</p>
        {step.moveGuide && <MoveGuidePanel guide={step.moveGuide} />}
        {step.moveHint && <MoveHintPanel hint={step.moveHint} />}
        {step.hold ? null : step.need ? (
          <p className={`tutorial-wait ${nudge ? "tutorial-nudge" : ""}`}>
            <Hand size={15} /> {nudge || "▼ の付いたところを操作してください"}
          </p>
        ) : (
          <div className="tutorial-steps">
            {onBack && (
              <button
                className="btn btn-ghost tutorial-back"
                onClick={onBack}
                aria-label="前の話に戻る"
              >
                <ArrowLeft size={16} /> 戻る
              </button>
            )}
            <button className="btn btn-primary tutorial-next" onClick={onNext}>
              {step.end ? "とじる" : "次へ"} <ArrowRight size={16} />
            </button>
          </div>
        )}
        {onSkip && !step.end && (
          <button
            type="button"
            className="tutorial-skip"
            onClick={() => setConfirm(true)}
          >
            この話を飛ばす
          </button>
        )}
      </div>
    </div>
  );
}

/** チュートリアルの一覧。レベルが足りない話には鍵がかかる */
export function TutorialSelect({ onStart, onBack }) {
  const [profile, setProfile] = useState(() => loadProfile());
  const level = levelOf(profile);
  const next = toNextLevel(profile);
  // まだ終えていない話(本編の12話)。飛ばすのはこれだけ。番外は含めない
  const left = TUTORIALS.filter((t) => !profile.cleared.includes(t.id));
  const leftXp = left.reduce((n, t) => n + t.xp, 0);
  const [confirmSkip, setConfirmSkip] = useState(false);
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
        {[
          ...TUTORIALS,
          ...EXTRA_TUTORIALS.filter((t) => !t.needsFoil || hasFoil),
        ].map((t) => {
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
      {/* ルールを知っている人は飛ばせる。終えたのと同じ扱い(経験値も同じだけ入る) */}
      {left.length > 0 && (
        <button
          className="btn btn-ghost tutorial-skip-all"
          onClick={() => setConfirmSkip(true)}
        >
          {left.length === TUTORIALS.length
            ? "チュートリアルを飛ばす"
            : `残りの ${left.length} 話を飛ばす`}
        </button>
      )}
      {confirmSkip && (
        <SkipConfirm
          what={
            left.length === TUTORIALS.length
              ? "全12話"
              : `残りの ${left.length} 話`
          }
          gain={leftXp}
          level={levelAfterSkip(profile, leftXp)}
          onCancel={() => setConfirmSkip(false)}
          onConfirm={() => {
            setConfirmSkip(false);
            const after = skipTutorials(left);
            setProfile(after);
            publishPlayer(after);
          }}
        />
      )}
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
