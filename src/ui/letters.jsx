/**
 * 運営からのお知らせ(コードの上では letters)。
 *
 * サーバーの手紙を読み、受け取っていないものを未読として出す。
 * 添付は受け取ったときにだけ配り、受け取った印は端末に控える(二重取りを防ぐ)。
 */
import { useEffect, useState } from "react";
import { ArrowLeft, Check } from "../icons.jsx";
import { loadProfile, markLetterTaken } from "../game/profile.js";
import { giftsLabel, giveGifts } from "../game/gifts.js";
import { isFor, readLetters } from "../net/letters.js";

/** 日付だけの表し方 */
const when = (ms) => (ms ? new Date(ms).toLocaleDateString("ja-JP") : "");

export function LettersScreen({ onBack }) {
  const [profile, setProfile] = useState(() => loadProfile());
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let gone = false;
    readLetters().then((r) => {
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

  return (
    <div className="setup-wrap">
      <h2>運営からのお知らせ</h2>
      <p className="mission-message" role="status">
        {message}
      </p>
      {unread.length > 0 && (
        <button
          className="btn btn-primary btn-wide"
          disabled={busy}
          onClick={takeAll}
        >
          <Check size={16} /> 未読 {unread.length}通の褒美をまとめて受け取る
        </button>
      )}
      <div className="letter-list">
        {list === null && <p className="hint">読み込んでいます…</p>}
        {list && list.length === 0 && (
          <p className="hint">いま届いているお知らせはありません。</p>
        )}
        {(list || []).map((l) => (
          <button
            className={`letter ${taken(l) ? "is-taken" : "is-new"}`}
            key={l.id}
            onClick={() => setOpen(l.id)}
          >
            <span className="letter-main">
              <b>{l.subject}</b>
              <small>
                {when(l.at)}
                {l.gifts.length ? ` · ${giftsLabel(l.gifts)}` : ""}
              </small>
            </span>
            <span className="letter-side">
              {taken(l) ? (
                <em>受け取り済み</em>
              ) : (
                <em className="letter-new">未読</em>
              )}
              <span aria-hidden="true">›</span>
            </span>
          </button>
        ))}
      </div>
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> ホームに戻る
      </button>

      {open && (
        <div className="admin-sheet" onClick={() => setOpen(null)}>
          <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const l = (list || []).find((x) => x.id === open);
              if (!l) return null;
              return (
                <>
                  <div className="admin-panel-head">
                    <b>{l.subject}</b>
                    <button
                      className="icon-btn"
                      aria-label="閉じる"
                      onClick={() => setOpen(null)}
                    >
                      ×
                    </button>
                  </div>
                  <p className="letter-date">{when(l.at)}</p>
                  <p className="letter-body">{l.body}</p>
                  {l.gifts.length > 0 && (
                    <div className="letter-gifts">
                      <span>添付</span>
                      <ul>
                        {l.gifts.map((g, i) => (
                          <li key={i}>{giftsLabel([g])}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="admin-panel-actions">
                    {taken(l) ? (
                      <button className="btn btn-ghost" disabled>
                        受け取り済み
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => take(l).then(() => setOpen(null))}
                      >
                        <Check size={16} />{" "}
                        {l.gifts.length ? "受け取る" : "確認した"}
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
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
    readLetters().then((r) => {
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
