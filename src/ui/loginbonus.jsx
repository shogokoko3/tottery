import { playSound, useCue } from "../audio/index.js";
/** ログイン報酬の資格・枚数・受取済み判定は、サーバーの記録を使う。 */
import { useEffect, useRef, useState } from "react";
import { Check, Ticket } from "../icons.jsx";
import { getLoginBonus, claimLoginBonus } from "../net/wallet.js";
import { cycleOf, cycleRows, dayOf } from "../game/login-bonus.js";
import { watchLoginDay } from "../game/login-session.js";
import { L } from "../i18n/index.js";

export function LoginBonus() {
  const [offer, setOffer] = useState(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const working = useRef(false);
  const mounted = useRef(true);
  const watch = useRef(null);
  // 札を出しているあいだは問い合わせ直さない(受け取りの途中で中身が替わらないように)
  const shown = useRef(false);
  // 失敗を札で知らせるのは、開いたときと手で押したときだけ。0時の確認や復帰時の確認は黙って次に回す
  const loud = useRef(true);
  const show = (on) => { shown.current = on; setVisible(on); };

  /** ログイン処理。サーバー時刻を返す(次の0時を数えるのに使う) */
  async function load() {
    if (working.current) return null;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await getLoginBonus();
      if (!data.uid || !data.login) throw new Error(L("ログイン報酬を読み込めませんでした。"));
      if (!mounted.current) return;
      setOffer(data);
      setDone(false);
      show(!data.login.received);
      return data.now;
    } catch (e) {
      if (mounted.current && loud.current) {
        show(true);
        setError(L("ログイン報酬を確認できませんでした。通信を確認して、もう一度お試しください。"));
      }
      throw e;
    } finally {
      loud.current = false;
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  // 開いたとき・裏から戻ったとき・日本時間0時をまたいだときに、ログイン処理をし直す
  useEffect(() => {
    mounted.current = true;
    watch.current = watchLoginDay((force) => (force || !shown.current ? load() : null));
    return () => {
      mounted.current = false;
      watch.current?.stop();
    };
  }, []);
  function retry() {
    loud.current = true;
    return watch.current?.check(true);
  }
  function close() {
    show(false);
    // 札を出している間に0時を過ぎていたら、閉じたところで翌日のぶんを確かめる
    watch.current?.check();
  }

  async function take() {
    if (working.current || !offer || done) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await claimLoginBonus(offer.login.day, offer.uid);
      if (mounted.current) { setOffer(data); setDone(true); playSound("login"); }
    } catch {
      if (mounted.current) setError(L("受け取りを確認できませんでした。次に確認するときに再送します。今すぐもう一度試すこともできます。"));
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (!visible) return null;
  const bonus = offer?.login;
  // 文の途中に太字の枚数が入るので、英語の語順で切って組む
  const [gotPre, gotPost] = L("ガチャチケットを {b} 受け取りました").split("{b}");
  const [todayPre, todayPost] = L("今日のぶんは ガチャチケット {b}").split("{b}");
  return (
    <div className="modal-overlay bonus-overlay">
      <div className="modal-panel bonus-panel" role="dialog" aria-modal="true" aria-label={L("ログインボーナス")}>
        <h3 className="bonus-title">{L("ログインボーナス")}</h3>
        {bonus && <>
          <p className="bonus-sub">{L("{cycle}周目の{day}日目", { cycle: cycleOf(bonus.taken), day: dayOf(bonus.taken) })}</p>
          <div className="bonus-week">
            {cycleRows(bonus.taken).map(r => (
              <div key={r.day} className={`bonus-cell ${r.today ? "is-today" : ""} ${r.taken || (r.today && done) ? "is-taken" : ""}`}>
                {r.taken || (r.today && done) ? <Check size={13} className="bonus-check" /> : <small>{L("{n}日目", { n: r.day })}</small>}
                <b><Ticket size={14} />{r.amount}</b>
              </div>
            ))}
          </div>
          <p className="bonus-gain" aria-live="polite">
            {done ? <>{gotPre}<b>{L("{n}枚", { n: bonus.amount })}</b>{gotPost}</> : <>{todayPre}<b>{L("{n}枚", { n: bonus.amount })}</b>{todayPost}</>}
          </p>
        </>}
        <p className="bonus-sub">{L("毎日0時（日本時間）に更新")}</p>
        {error && <p className="bonus-sub" role="alert">{error}</p>}
        {!done && <button className="btn btn-primary btn-wide" disabled={busy} onClick={bonus ? take : retry}>
          <Ticket size={16} /> {busy ? L("確認中…") : bonus ? L("受け取る") : L("もう一度確認する")}
        </button>}
        {(done || error) && <button className="btn btn-ghost btn-wide" disabled={busy} onClick={close}>
          {done ? L("ホームへ") : L("あとで確認する")}
        </button>}
      </div>
    </div>
  );
}
