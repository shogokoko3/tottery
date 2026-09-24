/**
 * フレンド(2026-09-23 本人の指示)。
 *
 * - フレンド ID(8文字)を見せ合って申請 → 承認。50人まで
 * - 1日1回、フレンド1人にガチャチケットを1枚贈る。届いたものは「受け取る」で財布へ
 * - フレンド対戦に招待する(合言葉を届ける)。届いた招待は「参加する」でその部屋へ
 * - 行を押すと、そのフレンドのプロフィールを開く
 *
 * 正はサーバー(src/server/friends.js)。この画面は開くたびに読み、押すたびに読み直す。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useCollection } from "../skins/store.js";
import { useMissionProfile } from "./mission-profile.js";
import { buildProfileCard, normalizeAccept, REQUEST_SOURCES } from "../game/profile-card.js";
import { saveProfileCard } from "../game/profile.js";
import {
  readFriends,
  requestFriend,
  acceptFriend,
  declineFriend,
  cancelFriendRequest,
  removeFriend,
  giftFriend,
  claimFriendGifts,
  publishProfileCard,
} from "../net/friends.js";
import { myUid } from "../net/auth.js";
import { isBlocked } from "../game/blocked.js";
import { PlayerIcon } from "./playericon.jsx";
import { TitleFrame } from "./title-frame.jsx";
import { ArrowLeft, Check, Close, Ticket, Users, DoorIn, Mail } from "../icons.jsx";

/** 「3分前」「2日前」。最後に開いた時刻の目安 */
export function agoText(at, now = Date.now()) {
  if (!at) return "";
  const d = Math.max(0, now - at);
  const m = Math.floor(d / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day}日前`;
  return `${Math.floor(day / 30)}か月前`;
}

/** フレンド ID を "ABCD-EFGH" の形に */
export const formatFriendCode = (code) =>
  code && code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code || "";

/**
 * 自分のプロフィールの写しをサーバーへ(フレンドが見る)。フレンド・プロフィールの画面を開いたときに送る。
 * 失敗しても画面は止めない(次に開いたときにまた送る)
 */
export function usePublishProfileCard(profile, collection) {
  const sent = useRef("");
  useEffect(() => {
    if (!profile || !profile.name || !myUid()) return;
    const card = buildProfileCard(profile, collection);
    const key = JSON.stringify(card);
    if (key === sent.current) return;
    sent.current = key;
    publishProfileCard(card).catch(() => {
      sent.current = "";
    });
  }, [profile, collection]);
}

/**
 * ホームの印。届いている申請・贈り物・招待の数。
 * 開いている間は 30 秒ごと、画面に戻ったときにも読み直す(申請が来たら気づけるように。2026-09-24 本人の指示)。
 * 数(合計)としても、内訳(requests / gifts / invites)としても読める
 */
export const FRIEND_ALERT_POLL_MS = 30000;
export function useFriendAlerts() {
  const [alerts, setAlerts] = useState({ total: 0, requests: 0, gifts: 0, invites: 0 });
  useEffect(() => {
    let gone = false;
    if (!myUid()) return undefined;
    const load = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      readFriends()
        .then((s) => {
          if (gone) return;
          const requests = s.requestsIn?.length || 0;
          const gifts = s.gifts?.length || 0;
          const invites = s.invites?.length || 0;
          setAlerts({ total: requests + gifts + invites, requests, gifts, invites });
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, FRIEND_ALERT_POLL_MS);
    const onShow = () => load();
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onShow);
    return () => {
      gone = true;
      clearInterval(timer);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onShow);
    };
  }, []);
  return alerts;
}

/** 名札。brief なら アイコン・称号・名前だけ(申請の行。2026-09-24 本人の指示でレートとレベルは出さない) */
function FriendTag({ f, onClick, brief = false }) {
  return (
    <button className="friend-tag" onClick={onClick} disabled={!onClick}>
      <PlayerIcon icon={f.icon} name={f.name} size="md" frame={f.frame} />
      <span className="friend-tag-body">
        {f.title ? <TitleFrame id={f.title} size="compact" /> : <span className="friend-tag-notitle">称号なし</span>}
        <b className="friend-tag-name">{f.name || "名無し"}</b>
        {!brief && (
          <small>
            {Number.isFinite(f.rating) ? `レート ${f.rating}` : ""}
            {f.level ? ` · Lv${f.level}` : ""}
            {f.seen ? ` · ${agoText(f.seen)}` : ""}
          </small>
        )}
      </span>
    </button>
  );
}

export function FriendsScreen({ onBack, onProfile, onInvite, onJoinInvite, initialNotice = "", embedded = false }) {
  const [profile] = useMissionProfile();
  const collection = useCollection();
  usePublishProfileCard(profile, collection);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initialNotice);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const s = await readFriends();
      setState(s);
      setError("");
    } catch (e) {
      setError(e.message || "フレンドを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    // 招待や申請はすぐ知りたいので、開いている間は 10 秒ごとに読み直す
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [refresh]);

  async function run(key, fn, done) {
    if (busy) return;
    setBusy(key);
    setError("");
    try {
      const r = await fn();
      if (done) setNotice(typeof done === "function" ? done(r) : done);
      await refresh();
    } catch (e) {
      setError(e.message || "うまくいきませんでした。");
    } finally {
      setBusy("");
    }
  }

  async function copyCode() {
    const text = formatFriendCode(state?.code);
    try {
      await navigator.clipboard.writeText(text);
      setNotice("フレンド ID をコピーしました");
    } catch {
      setNotice(`フレンド ID: ${text}`);
    }
  }

  const friends = (state?.friends || []).filter((f) => !isBlocked(f.uid));
  const requestsIn = (state?.requestsIn || []).filter((f) => !isBlocked(f.uid));
  const gifts = state?.gifts || [];
  const invites = (state?.invites || []).filter((i) => !isBlocked(i.fromUid));
  const gifted = !!state?.giftedTo;

  return (
    <div className="setup-wrap friends-screen">
      {!embedded && <h2>フレンド</h2>}
      {/* 数字の途中で折り返すと読めない(「1 / 日1回」)ので、文ごとに行を分け、数字は切らない */}
      <p className="hint friends-lead">
        <span>フレンド ID を伝え合って登録します。<span className="nowrap">{state?.max || 50}人まで。</span></span>
        <span>
          <span className="nowrap">1日1回</span>、フレンド1人に<span className="nowrap">ガチャチケットを贈れます。</span>
        </span>
      </p>

      <section className="friends-me" aria-label="自分のフレンド ID">
        <small>あなたのフレンド ID</small>
        <div className="friends-code-row">
          <code className="friends-code">{state?.code ? formatFriendCode(state.code) : "········"}</code>
          <button className="btn btn-ghost btn-small" onClick={copyCode} disabled={!state?.code}>
            コピー
          </button>
        </div>
        <form
          className="friends-add-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim()) return;
            run("request", () => requestFriend(code), (r) =>
              r.friend ? "フレンドになりました" : "申請を送りました。相手の承認を待ちます",
            ).then(() => setCode(""));
          }}
        >
          <input
            className="friends-add-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="相手のフレンド ID"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={9}
            aria-label="相手のフレンド ID"
          />
          <button className="btn btn-primary btn-small" type="submit" disabled={!code.trim() || !!busy}>
            申請
          </button>
        </form>
      </section>

      {notice && (
        <p className="hint friends-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="hint friends-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="hint">読み込んでいます…</p>}

      {gifts.length > 0 && (
        <section className="friends-box friends-box-gift" aria-label="届いた贈り物">
          <div className="friends-box-head">
            <Ticket size={16} />
            <b>ガチャチケットが届いています</b>
            <span>{gifts.length}枚</span>
          </div>
          <p className="friends-box-from">
            {gifts.map((g) => g.from?.name || "名無し").join("・")} から
          </p>
          <button
            className="btn btn-primary btn-wide"
            disabled={!!busy}
            onClick={() =>
              run("claim", claimFriendGifts, (list) => `チケットを${list.length}枚受け取りました`)
            }
          >
            <Check size={16} /> まとめて受け取る
          </button>
        </section>
      )}

      {invites.map((i) => (
        <section className="friends-box friends-box-invite" key={`${i.fromUid}:${i.code}`} aria-label="対戦の招待">
          <div className="friends-box-head">
            <DoorIn size={16} />
            <b>{i.from?.name || "名無し"} から対戦の招待</b>
            <span>{agoText(i.at)}</span>
          </div>
          <button className="btn btn-primary btn-wide" onClick={() => onJoinInvite && onJoinInvite(i.code, i.from)}>
            参加する
          </button>
        </section>
      ))}

      {requestsIn.length > 0 && (
        <section className="friends-list" aria-label="届いた申請">
          <p className="friends-list-head">
            <Mail size={13} /> 届いた申請 <b>{requestsIn.length}</b>
          </p>
          {requestsIn.map((f) => (
            <div className="friend-row" key={f.uid}>
              <FriendTag f={f} brief />
              <div className="friend-row-actions">
                <button
                  className="btn btn-primary btn-small"
                  disabled={!!busy}
                  onClick={() => run(`accept:${f.uid}`, () => acceptFriend(f.uid), `${f.name || "名無し"} とフレンドになりました`)}
                >
                  承認
                </button>
                <button
                  className="btn btn-ghost btn-small"
                  disabled={!!busy}
                  onClick={() => run(`decline:${f.uid}`, () => declineFriend(f.uid))}
                >
                  断る
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="friends-list" aria-label="フレンドの一覧">
        <p className="friends-list-head">
          <Users size={13} /> フレンド <b>{friends.length}</b>/{state?.max || 50}
        </p>
        {!loading && friends.length === 0 && (
          <p className="hint">まだフレンドがいません。上の ID を伝えるか、相手の ID を入れて申請してください。</p>
        )}
        {friends.map((f) => (
          <div className="friend-row" key={f.uid}>
            <FriendTag f={f} onClick={onProfile ? () => onProfile(f.uid) : null} />
            <div className="friend-row-actions">
              <button
                className={`btn btn-small ${gifted ? "btn-ghost" : "btn-primary"}`}
                disabled={!!busy || gifted}
                title={gifted ? "今日の贈り物はもう送りました" : "ガチャチケットを1枚贈る"}
                onClick={() => run(`gift:${f.uid}`, () => giftFriend(f.uid), `${f.name || "名無し"} にチケットを贈りました`)}
              >
                <Ticket size={14} /> {state?.giftedTo === f.uid ? "贈り済み" : "贈る"}
              </button>
              <button className="btn btn-ghost btn-small" onClick={() => onInvite && onInvite(f)} disabled={!onInvite}>
                <DoorIn size={14} /> 招待
              </button>
              {confirmRemove === f.uid ? (
                <span className="friend-remove-confirm">
                  <button
                    className="btn btn-ghost btn-small friend-remove-yes"
                    disabled={!!busy}
                    onClick={() => {
                      setConfirmRemove(null);
                      run(`remove:${f.uid}`, () => removeFriend(f.uid), `${f.name || "名無し"} をフレンドから外しました`);
                    }}
                  >
                    外す
                  </button>
                  <button className="icon-btn" aria-label="やめる" onClick={() => setConfirmRemove(null)}>
                    <Close size={14} />
                  </button>
                </span>
              ) : (
                <button className="icon-btn friend-more" aria-label="フレンドから外す" onClick={() => setConfirmRemove(f.uid)}>
                  ⋯
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* 申請の受付(入口ごとに切れる。2026-09-24 本人の指示)。切った入口からの申請は、相手には「いっぱい」と見える */}
      <section className="friends-list friends-accept" aria-label="申請の受付">
        <p className="friends-list-head">申請の受付</p>
        {REQUEST_SOURCES.map((src) => {
          const accept = normalizeAccept(profile?.card?.accept);
          const on = accept[src.id];
          return (
            <label className="friends-accept-row" key={src.id}>
              <span>
                <b>{src.label}</b>
                <small>{src.note}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-checked={on}
                checked={on}
                onChange={(e) => {
                  const next = saveProfileCard({ ...(profile?.card || {}), accept: { ...accept, [src.id]: e.target.checked } });
                  publishProfileCard(buildProfileCard(next, collection)).catch(() => {});
                }}
              />
            </label>
          );
        })}
        <p className="hint">切った入口からの申請は届きません。相手には「フレンドがいっぱい」と表示されます。</p>
      </section>

      {(state?.requestsOut || []).length > 0 && (
        <section className="friends-list" aria-label="送った申請">
          <p className="friends-list-head">送った申請 <b>{state.requestsOut.length}</b></p>
          {state.requestsOut.map((f) => (
            <div className="friend-row" key={f.uid}>
              <FriendTag f={f} brief />
              <div className="friend-row-actions">
                <button
                  className="btn btn-ghost btn-small"
                  disabled={!!busy}
                  onClick={() => run(`cancel:${f.uid}`, () => cancelFriendRequest(f.uid))}
                >
                  取り消す
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> ホームに戻る
      </button>
    </div>
  );
}
