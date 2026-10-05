/** ログイン報酬の資格・枚数・受取済み判定は、サーバーの記録を使う。 */
import { useEffect, useRef, useState } from "react";
import { Check, Ticket } from "../icons.jsx";
import { getLoginBonus, claimLoginBonus } from "../net/wallet.js";
import { cycleOf, cycleRows, dayOf } from "../game/login-bonus.js";

export function LoginBonus() {
  const [offer, setOffer] = useState(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const working = useRef(false);
  const mounted = useRef(true);

  async function load() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await getLoginBonus();
      if (!data.uid || !data.login) throw new Error("ログイン報酬を読み込めませんでした。");
      if (!mounted.current) return;
      setOffer(data);
      setDone(false);
      setVisible(!data.login.received);
    } catch {
      if (mounted.current) {
        setVisible(true);
        setError("ログイン報酬を確認できませんでした。通信を確認して、もう一度お試しください。");
      }
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, []);

  async function take() {
    if (working.current || !offer || done) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await claimLoginBonus(offer.login.day, offer.uid);
      if (mounted.current) { setOffer(data); setDone(true); }
    } catch {
      if (mounted.current) setError("受け取りを確認できませんでした。次に確認するときに再送します。今すぐもう一度試すこともできます。");
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (!visible) return null;
  const bonus = offer?.login;
  return (
    <div className="modal-overlay bonus-overlay">
      <div className="modal-panel bonus-panel" role="dialog" aria-modal="true" aria-label="ログインボーナス">
        <h3 className="bonus-title">ログインボーナス</h3>
        {bonus && <>
          <p className="bonus-sub">{cycleOf(bonus.taken)}周目の{dayOf(bonus.taken)}日目</p>
          <div className="bonus-week">
            {cycleRows(bonus.taken).map(r => (
              <div key={r.day} className={`bonus-cell ${r.today ? "is-today" : ""} ${r.taken || (r.today && done) ? "is-taken" : ""}`}>
                {r.taken || (r.today && done) ? <Check size={13} className="bonus-check" /> : <small>{r.day}日目</small>}
                <b><Ticket size={14} />{r.amount}</b>
              </div>
            ))}
          </div>
          <p className="bonus-gain" aria-live="polite">
            {done ? <>ガチャチケットを <b>{bonus.amount}枚</b> 受け取りました</> : <>今日のぶんは ガチャチケット <b>{bonus.amount}枚</b></>}
          </p>
        </>}
        <p className="bonus-sub">毎日0時（日本時間）に更新</p>
        {error && <p className="bonus-sub" role="alert">{error}</p>}
        {!done && <button className="btn btn-primary btn-wide" disabled={busy} onClick={bonus ? take : load}>
          <Ticket size={16} /> {busy ? "確認中…" : bonus ? "受け取る" : "もう一度確認する"}
        </button>}
        {(done || error) && <button className="btn btn-ghost btn-wide" disabled={busy} onClick={() => setVisible(false)}>
          {done ? "ホームへ" : "あとで確認する"}
        </button>}
      </div>
    </div>
  );
}
