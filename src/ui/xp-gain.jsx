import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { progressOfXp } from "../game/level.js";
import {
  dismissXpNotice,
  getXpNotices,
  startXpNotice,
  subscribeXpNotices,
} from "../game/xp-notices.js";
import { useReducedMotion } from "./skin-modal.jsx";
import styles from "./xp-gain.css";

const clamp = (n) => Math.max(0, Math.min(1, n));
const ease = (n) => 1 - (1 - clamp(n)) ** 3;

function XpGain({ notice }) {
  const reduce = useReducedMotion();
  const from = progressOfXp(notice.beforeXp);
  const to = progressOfXp(notice.afterXp);
  const gained = notice.afterXp - notice.beforeXp;
  const levels = to.level - from.level;
  const [frame, setFrame] = useState({ progress: from, leveled: false });
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    startXpNotice(notice.id);
    let raf;
    const started = performance.now();
    function tick(now) {
      const elapsed = Math.max(0, now - started - 120);
      let progress,
        leveled = false;
      if (reduce) {
        progress = to;
        leveled = levels > 0;
      } else if (levels > 0 && elapsed < 560) {
        // 一度満杯にしてから、上がったレベルのゲージへ移る。
        const ratio = from.ratio + (1 - from.ratio) * ease(elapsed / 400);
        progress = { ...from, ratio, into: Math.round(from.need * ratio) };
        progress.left = from.need - progress.into;
      } else if (levels > 0) {
        const ratio = to.ratio * ease((elapsed - 560) / 460);
        progress = { ...to, ratio, into: Math.round(to.need * ratio) };
        if (to.done) progress = to;
        else progress.left = to.need - progress.into;
        leveled = true;
      } else {
        const xp = Math.round(notice.beforeXp + gained * ease(elapsed / 850));
        progress = progressOfXp(xp);
      }
      setFrame({ progress, leveled });
      if (!reduce && elapsed < 1020) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    const fade = setTimeout(() => setLeaving(true), 2150);
    const end = setTimeout(() => dismissXpNotice(notice.id), 2350);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fade);
      clearTimeout(end);
    };
  }, [notice.id, notice.afterXp, reduce]);

  const { progress, leveled } = frame;
  const label =
    notice.source === "tutorial"
      ? "チュートリアル報酬"
      : notice.source === "battle"
        ? "対戦報酬"
        : "経験値を獲得";
  return (
    <aside
      className={`xp-gain ${leaving ? "xp-gain-leaving" : ""} ${leveled ? "xp-gain-level-up" : ""}`}
      aria-label="経験値の獲得"
    >
      <span className="xp-gain-announcement" role="status" aria-live="polite">
        経験値を{gained.toLocaleString()}獲得。
        {levels > 0
          ? `レベル${from.level}から${to.level}にアップしました。`
          : `レベル${to.level}。`}
      </span>
      <div className="xp-gain-top">
        <span>{label}</span>
        <strong>+{gained.toLocaleString()} XP</strong>
      </div>
      <div className="xp-gain-level">
        <b>Lv.{progress.level}</b>
        <span>
          {leveled
            ? `LEVEL UP!${levels > 1 ? ` +${levels}` : ""}`
            : progress.done
              ? "MAX LEVEL"
              : "プレイヤーレベル"}
        </span>
      </div>
      <div
        className="xp-gain-track"
        role="progressbar"
        aria-label="プレイヤーレベルの経験値"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.ratio * 100)}
        aria-valuetext={
          progress.done
            ? "最高レベル"
            : `${progress.into} / ${progress.need} XP`
        }
      >
        <span style={{ width: `${progress.ratio * 100}%` }} />
      </div>
      <div className="xp-gain-detail">
        {progress.done ? (
          <span>累計 {progress.xp.toLocaleString()} XP</span>
        ) : (
          <>
            <span>
              {progress.into.toLocaleString()} /{" "}
              {progress.need.toLocaleString()} XP
            </span>
            <span>次まで {progress.left.toLocaleString()}</span>
          </>
        )}
      </div>
    </aside>
  );
}

/** 画面を切り替えても獲得表示を引き継ぎ、操作を遮らず短時間で知らせる。 */
export function XpGainToast() {
  const notices = useSyncExternalStore(
    subscribeXpNotices,
    getXpNotices,
    getXpNotices,
  );
  const head = notices[0];
  return createPortal(
    <>
      <style>{styles}</style>
      {head?.ready && <XpGain key={head.id} notice={head} />}
    </>,
    document.body,
  );
}
