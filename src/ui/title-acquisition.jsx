import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  dismissTitleNotice,
  getTitleNotices,
  holdTitleNotices,
  subscribeTitleNotices,
} from "../game/title-notices.js";
import { TitleFrame } from "./title-frame.jsx";
import { titleDesign } from "./title-design.js";
import frameStyles from "./title-frame.css";
import styles from "./title-acquisition.css";

export function useTitleNoticeHold(blocked) {
  useLayoutEffect(() => {
    if (blocked) return holdTitleNotices();
  }, [!!blocked]);
}

function Award({ notice, count }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), 5100);
    const finish = setTimeout(() => dismissTitleNotice(notice.id), 5500);
    return () => {
      clearTimeout(fade);
      clearTimeout(finish);
    };
  }, [notice.id]);
  return (
    <aside
      className={`title-award${leaving ? " is-leaving" : ""}`}
      style={titleDesign(notice.titleId).style}
      aria-label="新しい称号を獲得"
    >
      <span
        className="title-award-announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        称号「{notice.name}」を獲得しました。設定で装備できます。
      </span>
      <div className="title-award-glow" aria-hidden="true" />
      <div className="title-award-rays" aria-hidden="true" />
      <div className="title-award-panel">
        <div className="title-award-heading" aria-hidden="true">
          <span />
          称号獲得
          <span />
        </div>
        <div className="title-award-reveal" aria-hidden="true">
          <TitleFrame id={notice.titleId} size="showcase" />
          <i className="title-award-sheen" />
        </div>
        <p>設定で装備できます</p>
        {count > 1 && (
          <span className="title-award-count">あと{count - 1}件</span>
        )}
        <button
          type="button"
          className="title-award-close"
          aria-label={count > 1 ? "次の獲得称号へ" : "称号獲得の表示を閉じる"}
          onClick={() => dismissTitleNotice(notice.id)}
        >
          {count > 1 ? "›" : "×"}
        </button>
      </div>
      <div className="title-award-sparks" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} style={{ "--spark": i }} />
        ))}
      </div>
    </aside>
  );
}

export function TitleAcquisition() {
  const { notices, held } = useSyncExternalStore(
    subscribeTitleNotices,
    getTitleNotices,
    getTitleNotices,
  );
  const [visible, setVisible] = useState(
    () => typeof document !== "undefined" && !document.hidden,
  );
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  if (typeof document === "undefined") return null;
  // 保留・バックグラウンド化ではタイマーも止め、復帰後に読める時間を確保する。
  return createPortal(
    <>
      <style>{frameStyles + styles}</style>
      {!held && visible && notices[0] && (
        <Award key={notices[0].id} notice={notices[0]} count={notices.length} />
      )}
    </>,
    document.body,
  );
}
