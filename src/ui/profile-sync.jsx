import { useEffect, useState } from "react";
import {
  profileSyncPending,
  retryProfileSync,
  watchProfileSync,
} from "../net/profile-sync.js";
import { Phrases } from "./phrases.jsx";

export function ProfileSyncNotice() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const stop = watchProfileSync();
    const update = (e) =>
      setFailed(e.detail === "failed" && profileSyncPending());
    window.addEventListener("tottery:profile-sync", update);
    return () => {
      stop();
      window.removeEventListener("tottery:profile-sync", update);
    };
  }, []);
  if (!failed) return null;
  return (
    <aside className="profile-sync-notice" role="status">
      {/* 句ごとに折り返す(375 幅で「再送/します。」と割れた。2026-10-06 見直し) */}
      <span>
        <Phrases text="成績を保存できていません。通信が戻ると再送します。" />
      </span>
      <button onClick={() => retryProfileSync()}>再送</button>
    </aside>
  );
}
