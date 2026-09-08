import { useEffect, useState } from "react";
import {
  profileSyncPending,
  retryProfileSync,
  watchProfileSync,
} from "../net/profile-sync.js";

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
      <span>成績を保存できていません。通信が戻ると再送します。</span>
      <button onClick={() => retryProfileSync()}>再送</button>
    </aside>
  );
}
