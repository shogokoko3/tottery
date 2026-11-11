import { playSound, useCue } from "../audio/index.js";
/**
 * フレンド(2026-09-23 本人の指示)。
 *
 * - フレンド ID(8文字)を見せ合って申請 → 承認。50人まで
 * - 1日にフレンド1人あたり1枚(最大50人ぶん)ガチャチケットを贈る。届いたものは「受け取る」で財布へ
 * - フレンド対戦に招待する(合言葉を届ける)。届いた招待は「参加する」でその部屋へ
 * - 行を押すと、そのフレンドのプロフィールを開く
 *
 * 正はサーバー(src/server/friends.js)。この画面は開くたびに読み、押すたびに読み直す。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useCollection } from "../skins/store.js";
import { useMissionProfile } from "./mission-profile.js";
import { buildProfileCard, normalizeAccept, normalizeSpectate, REQUEST_SOURCES, SPECTATE_MODES } from "../game/profile-card.js";
import { saveProfileCard } from "../game/profile.js";
import {
  readFriends,
  requestFriend,
  acceptFriend,
  declineFriend,
  cancelFriendRequest,
  removeFriend,
  giftFriend,
  giftAllFriends,
  claimFriendGifts,
  publishProfileCard,
} from "../net/friends.js";
import { myUid } from "../net/auth.js";
import { isBlocked } from "../game/blocked.js";
import { PlayerIcon } from "./playericon.jsx";
import { TitleFrame } from "./title-frame.jsx";
import { ArrowLeft, Check, Close, Ticket, Users, DoorIn, Mail } from "../icons.jsx";
import { L, Lx, isEnglish } from "../i18n/index.js";

/** 「3分前」「2日前」。最後に開いた時刻の目安 */
export function agoText(at, now = Date.now()) {
  if (!at) return "";
  const d = Math.max(0, now - at);
  const m = Math.floor(d / 60000);
  if (m < 1) return L("たった今");
  if (m < 60) return L("{n}分前", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return L("{n}時間前", { n: h });
  const day = Math.floor(h / 24);
  if (day < 30) return L("{n}日前", { n: day });
  return L("{n}か月前", { n: Math.floor(day / 30) });
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
 * 数(合計)としても、内訳(requests / gifts / invites)としても読める。
 * reload() で今すぐ読み直す(ホームの残高バーで贈り物を受け取った直後に印を消すため。2026-10-16)
 */
export const FRIEND_ALERT_POLL_MS = 30000;
export function useFriendAlerts() {
  const [alerts, setAlerts] = useState({ total: 0, requests: 0, gifts: 0, invites: 0 });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
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
  }, [tick]);
  return { ...alerts, reload };
}

/** 名札。brief なら アイコン・称号・名前だけ(申請の行。2026-09-24 本人の指示でレートとレベルは出さない) */
function FriendTag({ f, onClick, brief = false }) {
  return (
    <button className="friend-tag" onClick={onClick} disabled={!onClick}>
      <PlayerIcon icon={f.icon} name={f.name} size="md" frame={f.frame} />
      <span className="friend-tag-body">
        {f.title ? <TitleFrame id={f.title} size="compact" /> : <span className="friend-tag-notitle">{L("称号なし")}</span>}
        <b className="friend-tag-name">{f.name || L("名無し")}</b>
        {!brief && (
          <small className="friend-tag-meta">
            <span className={`friend-status ${f.online ? "is-online" : "is-offline"}`}>
              <i className="friend-status-dot" aria-hidden="true" />
              {f.online ? L("オンライン") : L("オフライン")}
            </span>
            {Number.isFinite(f.rating) ? L(" · レート {n}", { n: f.rating }) : ""}
            {f.level ? ` · Lv${f.level}` : ""}
          </small>
        )}
      </span>
    </button>
  );
}

export function FriendsScreen({ onBack, onProfile, onInvite, onJoinInvite, onSpectate, initialNotice = "", embedded = false }) {
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
      setError(e.message || L("フレンドを読み込めませんでした。"));
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
      if (key.startsWith("accept:")) playSound("friend");
      if (done) setNotice(typeof done === "function" ? done(r) : done);
      await refresh();
    } catch (e) {
      setError(e.message || L("うまくいきませんでした。"));
    } finally {
      setBusy("");
    }
  }

  async function copyCode() {
    const text = formatFriendCode(state?.code);
    try {
      await navigator.clipboard.writeText(text);
      setNotice(L("フレンド ID をコピーしました"));
    } catch {
      setNotice(L("フレンド ID: {code}", { code: text }));
    }
  }

  const friends = (state?.friends || []).filter((f) => !isBlocked(f.uid));
  const requestsIn = (state?.requestsIn || []).filter((f) => !isBlocked(f.uid));
  const gifts = state?.gifts || [];
  const invites = (state?.invites || []).filter((i) => !isBlocked(i.fromUid));
  // 今日すでに贈ったフレンド(1日にフレンド1人あたり1枚。最大50人ぶん)。
  // 旧サーバー(1人だけの scalar)からの応答でも壊れないようにする
  const giftedSet = new Set(
    Array.isArray(state?.giftedTo) ? state.giftedTo : state?.giftedTo ? [state.giftedTo] : [],
  );

  return (
    <div className="setup-wrap friends-screen">
      {!embedded && <h2>{L("フレンド")}</h2>}
      {/* 数字の途中で折り返すと読めない(「1 / 日1回」)ので、文ごとに行を分け、数字は切らない */}
      <p className="hint friends-lead">
        <span>{L("フレンド ID を伝え合って登録します。")}<span className="nowrap">{L("{n}人まで。", { n: state?.max || 50 })}</span></span>
        <span>
          <span className="nowrap">{L("1日1回")}</span>{L("、フレンド")}<span className="nowrap">{L("1人ずつ")}</span>{L("に")}<span className="nowrap">{L("ガチャチケットを贈れます。")}</span>
        </span>
      </p>

      <section className="friends-me" aria-label={L("自分のフレンド ID")}>
        <small>{L("あなたのフレンド ID")}</small>
        <div className="friends-code-row">
          <code className="friends-code">{state?.code ? formatFriendCode(state.code) : "········"}</code>
          <button className="btn btn-ghost btn-small" onClick={copyCode} disabled={!state?.code}>
            {L("コピー")}
          </button>
        </div>
        <form
          className="friends-add-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim()) return;
            run("request", () => requestFriend(code), (r) =>
              r.friend ? L("フレンドになりました") : L("申請を送りました。相手の承認を待ちます"),
            ).then(() => setCode(""));
          }}
        >
          <input
            className="friends-add-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={L("相手のフレンド ID")}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={9}
            aria-label={L("相手のフレンド ID")}
          />
          <button className="btn btn-primary btn-small" type="submit" disabled={!code.trim() || !!busy}>
            {L("申請")}
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
      {loading && <p className="hint">{L("読み込んでいます…")}</p>}

      {gifts.length > 0 && (
        <section className="friends-box friends-box-gift" aria-label={L("届いた贈り物")}>
          <div className="friends-box-head">
            <Ticket size={16} />
            <b>{L("ガチャチケットが届いています")}</b>
            <span>{L("{n}枚", { n: gifts.length })}</span>
          </div>
          <p className="friends-box-from">
            {L("{names} から", {
              // i18n-ignore 名前の区切り
              names: gifts.map((g) => g.from?.name || L("名無し")).join(isEnglish ? ", " : "・"),
            })}
          </p>
          <button
            className="btn btn-primary btn-wide"
            disabled={!!busy}
            onClick={() =>
              run("claim", claimFriendGifts, (list) => L("チケットを{n}枚受け取りました", { n: list.length }))
            }
          >
            <Check size={16} /> {L("まとめて受け取る")}
          </button>
        </section>
      )}

      {invites.map((i) => (
        <section className="friends-box friends-box-invite" key={`${i.fromUid}:${i.code}`} aria-label={L("対戦の招待")}>
          <div className="friends-box-head">
            <DoorIn size={16} />
            <b>{L("{name} から対戦の招待", { name: i.from?.name || L("名無し") })}</b>
            <span>{agoText(i.at)}</span>
          </div>
          <button className="btn btn-primary btn-wide" onClick={() => onJoinInvite && onJoinInvite(i.code, i.from)}>
            {L("参加する")}
          </button>
        </section>
      ))}

      {requestsIn.length > 0 && (
        <section className="friends-list" aria-label={L("届いた申請")}>
          <p className="friends-list-head">
            <Mail size={13} /> {L("届いた申請")} <b>{requestsIn.length}</b>
          </p>
          {requestsIn.map((f) => (
            <div className="friend-row" key={f.uid}>
              <FriendTag f={f} brief />
              <div className="friend-row-actions">
                <button
                  className="btn btn-primary btn-small"
                  disabled={!!busy}
                  onClick={() => run(`accept:${f.uid}`, () => acceptFriend(f.uid), L("{name} とフレンドになりました", { name: f.name || L("名無し") }))}
                >
                  {L("承認")}
                </button>
                <button
                  className="btn btn-ghost btn-small"
                  disabled={!!busy}
                  onClick={() => run(`decline:${f.uid}`, () => declineFriend(f.uid))}
                >
                  {L("断る")}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="friends-list" aria-label={L("フレンドの一覧")}>
        <div className="friends-list-head friends-list-head-row">
          <span>
            <Users size={13} /> {L("フレンド")} <b>{friends.length}</b>/{state?.max || 50}
          </span>
          {/* まだ今日贈っていないフレンド全員にまとめて贈る(2026-09-25 本人の指示) */}
          {(() => {
            const rest = friends.filter((f) => !giftedSet.has(f.uid)).length;
            if (rest === 0) return null;
            return (
              <button
                className="btn btn-small btn-primary friends-gift-all"
                disabled={!!busy}
                onClick={() =>
                  run(
                    "gift-all",
                    giftAllFriends,
                    (r) => (r?.sent?.length ? L("{n}人にチケットを贈りました", { n: r.sent.length }) : L("今日贈れる相手はもういません")),
                  )
                }
              >
                <Ticket size={14} /> {L("全員に贈る({n})", { n: rest })}
              </button>
            );
          })()}
        </div>
        {!loading && friends.length === 0 && (
          <p className="hint">{L("まだフレンドがいません。上の ID を伝えるか、相手の ID を入れて申請してください。")}</p>
        )}
        {friends.map((f) => {
          const gifted = giftedSet.has(f.uid);
          return (
          <div className="friend-row" key={f.uid}>
            <FriendTag f={f} onClick={onProfile ? () => onProfile(f.uid) : null} />
            <div className="friend-row-actions">
              {f.match && onSpectate && (
                <button
                  className="btn btn-primary btn-small friend-spectate"
                  onClick={() => onSpectate(f)}
                  title={L("このフレンドの対戦を観戦する")}
                >
                  <Users size={14} /> {L("観戦")}
                </button>
              )}
              <button
                className={`btn btn-small ${gifted ? "btn-ghost" : "btn-primary"}`}
                disabled={!!busy || gifted}
                title={gifted ? L("この人には今日もう贈りました") : L("ガチャチケットを1枚贈る")}
                onClick={() => run(`gift:${f.uid}`, () => giftFriend(f.uid), L("{name} にチケットを贈りました", { name: f.name || L("名無し") }))}
              >
                <Ticket size={14} /> {gifted ? L("贈り済み") : L("贈る")}
              </button>
              <button className="btn btn-ghost btn-small" onClick={() => onInvite && onInvite(f)} disabled={!onInvite}>
                <DoorIn size={14} /> {L("招待")}
              </button>
              {confirmRemove === f.uid ? (
                <span className="friend-remove-confirm">
                  <button
                    className="btn btn-ghost btn-small friend-remove-yes"
                    disabled={!!busy}
                    onClick={() => {
                      setConfirmRemove(null);
                      run(`remove:${f.uid}`, () => removeFriend(f.uid), L("{name} をフレンドから外しました", { name: f.name || L("名無し") }));
                    }}
                  >
                    {L("フレンドを外す")}
                  </button>
                  <button className="icon-btn" aria-label={L("やめる")} onClick={() => setConfirmRemove(null)}>
                    <Close size={14} />
                  </button>
                </span>
              ) : (
                <button className="icon-btn friend-more" aria-label={L("フレンドから外す")} onClick={() => setConfirmRemove(f.uid)}>
                  ⋯
                </button>
              )}
            </div>
          </div>
          );
        })}
      </section>

      {/* 申請の受付(入口ごとに切れる。2026-09-24 本人の指示)。切った入口からの申請は、相手には「いっぱい」と見える */}
      <section className="friends-list friends-accept" aria-label={L("申請の受付")}>
        <p className="friends-list-head">{L("申請の受付")}</p>
        {REQUEST_SOURCES.map((src) => {
          const accept = normalizeAccept(profile?.card?.accept);
          const on = accept[src.id];
          return (
            <label className="friends-accept-row" key={src.id}>
              <span>
                <b>{Lx(src.label)}</b>
                <small>{Lx(src.note)}</small>
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
        <p className="hint">{L("切った入口からの申請は届きません。相手には「フレンドがいっぱい」と表示されます。")}</p>
      </section>

      {/* 観戦の受付(2026-09-24 本人の指示)。対戦の種類ごとに、フレンドが観戦できるかを決める */}
      <section className="friends-list friends-accept" aria-label={L("観戦の受付")}>
        <p className="friends-list-head">{L("観戦の受付")}</p>
        {SPECTATE_MODES.map((mode) => {
          const spectate = normalizeSpectate(profile?.card?.spectate);
          const on = spectate[mode.id];
          return (
            <label className="friends-accept-row" key={mode.id}>
              <span>
                <b>{Lx(mode.label)}</b>
                <small>{Lx(mode.note)}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-checked={on}
                checked={on}
                onChange={(e) => {
                  saveProfileCard({ ...(profile?.card || {}), spectate: { ...spectate, [mode.id]: e.target.checked } });
                }}
              />
            </label>
          );
        })}
        <p className="hint">{L("対戦中の様子を、あなたのフレンドだけが見られます。ランキング対戦では、あなたの駒だけが観戦者に見えます。")}</p>
      </section>

      {(state?.requestsOut || []).length > 0 && (
        <section className="friends-list" aria-label={L("送った申請")}>
          <p className="friends-list-head">{L("送った申請")} <b>{state.requestsOut.length}</b></p>
          {state.requestsOut.map((f) => (
            <div className="friend-row" key={f.uid}>
              <FriendTag f={f} brief />
              <div className="friend-row-actions">
                <button
                  className="btn btn-ghost btn-small"
                  disabled={!!busy}
                  onClick={() => run(`cancel:${f.uid}`, () => cancelFriendRequest(f.uid))}
                >
                  {L("取り消す")}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> {L("ホームに戻る")}
      </button>
    </div>
  );
}
