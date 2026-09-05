/**
 * 運営からのお知らせ(コードの上では letters)。
 *
 * サーバーの手紙を読み、受け取っていないものを未読として出す。
 * 添付は受け取ったときにだけ配り、受け取った印は端末に控える(二重取りを防ぐ)。
 */
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Close } from "../icons.jsx";
import { loadProfile, markLetterTaken } from "../game/profile.js";
import { giftLabel, giftsLabel, giveGifts } from "../game/gifts.js";
import { isFor, readLetters } from "../net/letters.js";

/** その日の0時 */
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * 日付の表し方。
 * 「2026/9/5」より「きょう」のほうが、届いたばかりだと一目で分かる。
 * 1週間より前は日付に戻す(そこまで来ると相対表示のほうが分かりにくい)。
 */
const when = (ms) => {
  if (!ms) return "";
  const d = new Date(ms);
  const days = Math.round((midnight(new Date()) - midnight(d)) / 86400000);
  if (days <= 0) return "きょう";
  if (days === 1) return "きのう";
  if (days < 7) return `${days}日前`;
  return d.toLocaleDateString("ja-JP");
};

export function LettersScreen({ onBack }) {
  const [profile, setProfile] = useState(() => loadProfile());
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let gone = false;
    // 自分の uid で読む。個人宛ての置き場が uid ごとに分かれているため
    readLetters(loadProfile().id).then((r) => {
      if (gone) return;
      const me = loadProfile();
      setList(r.list.filter((l) => isFor(l, me.id)));
    });
    return () => {
      gone = true;
    };
  }, []);

  const taken = (l) => profile.letters.includes(l.id);
  const unread = (list || []).filter((l) => !taken(l));

  async function take(letter) {
    if (busy || taken(letter)) return;
    setBusy(true);
    setMessage("");
    try {
      await giveGifts(letter.gifts);
      // 配り終えてから控える。途中で失敗しても二重取りにならない
      setProfile(markLetterTaken(letter.id));
      setMessage(
        letter.gifts.length
          ? `${giftsLabel(letter.gifts)}を受け取りました。`
          : "確認しました。",
      );
    } catch (e) {
      setMessage((e && e.message) || "受け取れませんでした。");
    } finally {
      setBusy(false);
    }
  }

  async function takeAll() {
    if (busy || !unread.length) return;
    setBusy(true);
    setMessage("");
    let got = 0;
    let last = profile;
    try {
      for (const l of unread) {
        await giveGifts(l.gifts);
        last = markLetterTaken(l.id);
        got += 1;
      }
      setMessage(`${got}通ぶんを受け取りました。`);
    } catch (e) {
      setMessage(
        got
          ? `${got}通を受け取ったところで止まりました`
          : (e && e.message) || "受け取れませんでした。",
      );
    } finally {
      setProfile(last);
      setBusy(false);
    }
  }

  const shown = (list || []).find((x) => x.id === open);

  return (
    <div className="setup-wrap notice-wrap">
      <h2>運営からのお知らせ</h2>
      <p className="mission-message" role="status">
        {message}
      </p>

      {unread.length > 0 && (
        <button
          className="btn btn-primary btn-wide notice-all"
          disabled={busy}
          onClick={takeAll}
        >
          <Check size={16} /> {unread.length}通をまとめて受け取る
        </button>
      )}

      <div className="notice-list">
        {list === null && <p className="hint">読み込んでいます…</p>}
        {list && list.length === 0 && (
          <p className="hint">いま届いているお知らせはありません。</p>
        )}
        {(list || []).map((l) => (
          <button
            className={`notice ${taken(l) ? "is-read" : "is-new"}`}
            key={l.id}
            onClick={() => setOpen(l.id)}
          >
            <span className="notice-head">
              <span className="notice-mark" aria-hidden="true">
                {taken(l) ? <Check size={12} /> : <i />}
              </span>
              <b>{l.subject}</b>
              <span className="notice-when">{when(l.at)}</span>
            </span>
            {/* 本文の頭を1行だけ見せる。件名だけだと中身が想像できない */}
            {l.body && <span className="notice-peek">{l.body}</span>}
            {l.gifts.length > 0 && (
              <span className="notice-chips">
                {l.gifts.map((g, i) => (
                  <span className="notice-chip" key={i}>
                    {giftLabel(g)}
                  </span>
                ))}
              </span>
            )}
          </button>
        ))}
      </div>

      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> ホームに戻る
      </button>

      {shown && (
        <div
          className="notice-sheet"
          role="dialog"
          aria-label={shown.subject}
          onClick={() => setOpen(null)}
        >
          <div className="notice-panel" onClick={(e) => e.stopPropagation()}>
            <div className="notice-panel-head">
              <b>{shown.subject}</b>
              <button
                className="icon-btn notice-close"
                aria-label="閉じる"
                onClick={() => setOpen(null)}
              >
                <Close size={18} />
              </button>
            </div>
            <div className="notice-panel-scroll">
              <p className="notice-date">{when(shown.at)}</p>
              <p className="notice-body">{shown.body}</p>
              {shown.gifts.length > 0 && (
                <div className="notice-gifts">
                  <span className="notice-gifts-label">添付</span>
                  <ul>
                    {shown.gifts.map((g, i) => (
                      <li key={i}>{giftLabel(g)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="notice-actions">
              {taken(shown) ? (
                <button className="btn btn-ghost btn-wide" disabled>
                  <Check size={16} /> 受け取り済み
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-wide"
                  disabled={busy}
                  onClick={() => take(shown).then(() => setOpen(null))}
                >
                  <Check size={16} />{" "}
                  {shown.gifts.length ? "受け取る" : "確認した"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 未読の数。ホームの入り口に印を出すために使う */
export function useUnreadLetters() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let gone = false;
    readLetters(loadProfile().id).then((r) => {
      if (gone) return;
      const me = loadProfile();
      setN(
        r.list.filter((l) => isFor(l, me.id) && !me.letters.includes(l.id))
          .length,
      );
    });
    return () => {
      gone = true;
    };
  }, []);
  return n;
}
