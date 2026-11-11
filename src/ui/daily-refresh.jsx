import { useRef, useState } from "react";
import { ensureAuth } from "../net/auth.js";
import { syncWallet } from "../net/wallet.js";
import { L } from "../i18n/index.js";

export function DailyRefresh({ onDone }) {
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const auth = await ensureAuth({ forceRefresh: true });
      if (!auth) throw new Error("Login unavailable");
      await syncWallet();
      onDone();
    } catch {
      setError(L("再ログインできませんでした。通信を確認して、もう一度お試しください。"));
      working.current = false;
      setBusy(false);
    }
  }
  return <div className="modal-overlay">
    <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="daily-refresh-title">
      <h2 id="daily-refresh-title">{L("日付が変わりました")}</h2>
      <p className="hint">{L("午前5:00を過ぎたため、データを更新します。")}<br />{L("タイトルに戻って再ログインしてください。")}</p>
      {error && <p className="hint" role="alert">{error}</p>}
      <button className="btn btn-primary btn-wide" disabled={busy} onClick={login}>
        {busy ? L("再ログイン中…") : L("再ログインしてタイトルへ")}
      </button>
    </div>
  </div>;
}
