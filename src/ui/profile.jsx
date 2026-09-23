/**
 * プロフィール(2026-09-23 本人の指示)。自分のものと、フレンドのもの。
 *
 * 見せるもの: 背景(着せ替え)・アイコンと額縁・名前・レベル・固定の称号(真ん中に大きく)・
 * 対局で見せる称号・持ち点と月間の順位・記録のアピール(3つまで)・戦績。
 * 自分のときは「プロフィールを編集」で背景・アピール・固定の称号を選ぶ(src/game/profile-card.js)。
 * フレンドのときは、チケットを贈る・対戦に招待する・フレンドから外す。
 */
import { useEffect, useState } from "react";
import { useCollection } from "../skins/store.js";
import { useMissionProfile } from "./mission-profile.js";
import { loadProfile, saveProfileCard } from "../game/profile.js";
import {
  PROFILE_BACKGROUNDS,
  SHOWCASE,
  SHOWCASE_MAX,
  STANDARD_BG,
  buildProfileCard,
  normalizeCard,
  showcaseText,
  unlockedBackgrounds,
} from "../game/profile-card.js";
import { availableTitles, findTitle, hasTitle } from "../game/titles.js";
import { foilRevealed } from "../skins/collection.js";
import { readFriendProfile, giftFriend, removeFriend, publishProfileCard } from "../net/friends.js";
import { myUid } from "../net/auth.js";
import { PlayerIcon } from "./playericon.jsx";
import { TitleFrame } from "./title-frame.jsx";
import { TitleChoice } from "./account.jsx";
import { agoText, usePublishProfileCard } from "./friends.jsx";
import { ArrowLeft, Check, Close, DoorIn, Settings, Ticket, Users, Lock } from "../icons.jsx";

const bgImage = (bg) => (bg && bg !== STANDARD_BG ? `skins/home-v1/${bg}-home-decor.webp` : null);

/** プロフィールの札。view = { card, rating, place, best, rated, seen } */
export function ProfileCard({ view, name, mine }) {
  const card = view.card || {};
  const img = bgImage(card.bg);
  const showcase = (card.showcase || []).map((id) => ({ id, ...showcaseText(id, { ...card, rating: view.rating, bestPlace: view.best }) }));
  const stats = card.stats || {};
  const winRate = stats.battles > 0 ? Math.round((stats.wins / stats.battles) * 100) : null;
  return (
    <div
      className={`profile-card${img ? " has-bg" : ""}`}
      data-bg={card.bg || STANDARD_BG}
      style={img ? { "--profile-bg": `url("${img}")` } : undefined}
    >
      <div className="profile-head">
        <PlayerIcon icon={card.icon} name={name} size="lg" frame={card.frame} />
        <div className="profile-id">
          <b className="profile-name">{name || "名無し"}</b>
          <span className="profile-sub">
            Lv {card.level || 0}
            {Number.isFinite(view.rating) ? ` · 持ち点 ${view.rating}` : ""}
            {view.place ? ` · 今月 ${view.place}位` : ""}
          </span>
          {card.title && findTitle(card.title) && (
            <TitleFrame id={card.title} size="compact" className="profile-title-compact" />
          )}
        </div>
      </div>
      {card.pinnedTitle && findTitle(card.pinnedTitle) && (
        <div className="profile-pinned">
          <small>{mine ? "固定の称号" : "誇りの称号"}</small>
          <TitleFrame id={card.pinnedTitle} size="showcase" />
        </div>
      )}
      {showcase.length > 0 && (
        <div className="profile-showcase" aria-label="記録のアピール">
          {showcase.map((s) => (
            <div className="profile-showcase-item" key={s.id}>
              <b>{s.text}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="stat-row profile-stats">
        <div className="stat">
          <b>{stats.battles || 0}</b>
          <span>対局</span>
        </div>
        <div className="stat">
          <b>{stats.wins || 0}</b>
          <span>勝ち</span>
        </div>
        <div className="stat">
          <b>{stats.draws || 0}</b>
          <span>引き分け</span>
        </div>
        <div className="stat">
          <b>{winRate === null ? "—" : `${winRate}%`}</b>
          <span>勝率</span>
        </div>
      </div>
      {!mine && view.seen ? <p className="profile-seen">最後に開いたのは {agoText(view.seen)}</p> : null}
    </div>
  );
}

/** 固定の称号を選ぶ(対局で見せる称号とは別) */
function PinnedTitlePicker({ profile, collection, picked, onPick, onClose }) {
  const [cur, setCur] = useState(picked || "");
  const visible = availableTitles(profile).filter((t) => {
    const owned = hasTitle(profile, t.id);
    if (t.secret && !owned) return false;
    if (t.foil && !owned && !foilRevealed(collection)) return false;
    if (t.family && t.tier > 3 && !owned) return false;
    return true;
  });
  const mine = visible.filter((t) => hasTitle(profile, t.id));
  const locked = visible.filter((t) => !hasTitle(profile, t.id));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel title-picker-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>固定の称号を選ぶ</h3>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            <Close size={18} />
          </button>
        </div>
        <div className="title-picker-scroll">
          <div className="title-pick-preview" aria-live="polite">
            <small>プロフィールの真ん中に据える称号</small>
            <b>{profile.name || "あなた"}</b>
            {cur ? <TitleFrame id={cur} size="showcase" animated={collection.motion !== "off"} /> : <span className="hint">なし</span>}
          </div>
          <div className="title-list">
            <button className={`title-choice ${!cur ? "title-choice-on" : ""}`} onClick={() => setCur("")}>
              <b>固定しない</b>
              <small>対局で見せる称号だけを出します</small>
            </button>
            <p className="title-group-head title-group-head-mine">
              <Check size={13} /> 使える称号 <b>{mine.length}</b>
            </p>
            {mine.map((t) => (
              <TitleChoice key={t.id} title={t} owned picked={cur === t.id} onPick={setCur} />
            ))}
            {locked.length > 0 && (
              <p className="title-group-head">
                <Lock size={13} /> まだ取れていない称号 <b>{locked.length}</b>
              </p>
            )}
            {locked.map((t) => (
              <TitleChoice key={t.id} title={t} owned={false} />
            ))}
          </div>
        </div>
        <div className="setup-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            やめる
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onPick(cur || null);
              onClose();
            }}
          >
            <Check size={16} /> 決定
          </button>
        </div>
      </div>
    </div>
  );
}

/** 背景・アピール・固定の称号を選ぶ */
export function ProfileEditModal({ onClose, onSaved }) {
  const profile = loadProfile();
  const collection = useCollection();
  const [card, setCard] = useState(() => normalizeCard(profile.card));
  const [pickTitle, setPickTitle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const unlocked = unlockedBackgrounds(collection);
  const preview = { card: buildProfileCard({ ...profile, card }, collection), rating: profile.rating, place: null, best: null };

  function toggleShowcase(id) {
    setCard((c) => {
      const has = c.showcase.includes(id);
      if (has) return { ...c, showcase: c.showcase.filter((x) => x !== id) };
      if (c.showcase.length >= SHOWCASE_MAX) return c;
      return { ...c, showcase: [...c.showcase, id] };
    });
  }

  async function submit() {
    setSaving(true);
    setError("");
    const next = saveProfileCard({ ...card, bg: unlocked.includes(card.bg) ? card.bg : STANDARD_BG });
    try {
      await publishProfileCard(buildProfileCard(next, collection));
    } catch (e) {
      // 端末には残っているので、次に開いたときにまた送る
      setError(e.message || "");
    }
    setSaving(false);
    onSaved && onSaved(next);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel profile-edit-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>プロフィールを編集</h3>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            <Close size={18} />
          </button>
        </div>
        <div className="profile-edit-scroll">
          <ProfileCard view={preview} name={profile.name} mine />

          <p className="profile-edit-head">背景</p>
          <div className="profile-bg-list">
            {PROFILE_BACKGROUNDS.map((b) => {
              const ok = unlocked.includes(b.id);
              const img = bgImage(b.id);
              return (
                <button
                  key={b.id}
                  className={`profile-bg-choice${card.bg === b.id ? " is-on" : ""}${ok ? "" : " is-locked"}`}
                  style={img ? { "--profile-bg": `url("${img}")` } : undefined}
                  disabled={!ok}
                  onClick={() => setCard((c) => ({ ...c, bg: b.id }))}
                  title={ok ? b.label : b.condition}
                >
                  <b>{b.label}</b>
                  {!ok && (
                    <small>
                      <Lock size={10} /> {b.condition}
                    </small>
                  )}
                </button>
              );
            })}
          </div>

          <p className="profile-edit-head">
            記録のアピール <small>{card.showcase.length}/{SHOWCASE_MAX}</small>
          </p>
          <div className="profile-showcase-list">
            {SHOWCASE.map((s) => {
              const on = card.showcase.includes(s.id);
              const full = !on && card.showcase.length >= SHOWCASE_MAX;
              return (
                <button
                  key={s.id}
                  className={`profile-showcase-choice${on ? " is-on" : ""}`}
                  disabled={full}
                  onClick={() => toggleShowcase(s.id)}
                >
                  {on && <Check size={12} />} {s.label}
                </button>
              );
            })}
          </div>

          <p className="profile-edit-head">固定の称号</p>
          <button className="title-tag profile-pinned-pick" onClick={() => setPickTitle(true)}>
            {card.pinnedTitle && hasTitle(profile, card.pinnedTitle) ? (
              <TitleFrame id={card.pinnedTitle} size="showcase" />
            ) : (
              <span className="hint">固定していません</span>
            )}
            <span className="title-tag-edit">固定の称号を選ぶ</span>
          </button>
          {error && (
            <p className="hint friends-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="setup-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            やめる
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            <Check size={16} /> 保存
          </button>
        </div>
        {pickTitle && (
          <PinnedTitlePicker
            profile={profile}
            collection={collection}
            picked={card.pinnedTitle}
            onPick={(id) => setCard((c) => ({ ...c, pinnedTitle: id }))}
            onClose={() => setPickTitle(false)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * プロフィールの画面。uid が自分(か無指定)なら編集できる。フレンドなら贈る・招待・外す。
 */
export function ProfileScreen({ uid = null, onBack, backLabel = "ホームに戻る", onFriends, onInvite, onRemoved, onSettings = null }) {
  const [profile] = useMissionProfile();
  const collection = useCollection();
  const me = myUid();
  const mine = !uid || uid === me;
  usePublishProfileCard(mine ? profile : null, collection);
  const [remote, setRemote] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let gone = false;
    const target = uid || me;
    if (!target) return undefined;
    readFriendProfile(target)
      .then((r) => !gone && setRemote(r))
      .catch((e) => !gone && setError(e.message || ""));
    return () => {
      gone = true;
    };
  }, [uid, me, version]);

  // 自分のは端末の記録から即座に組む(サーバーの返事は持ち点・順位だけ足す)
  const view = mine
    ? {
        card: buildProfileCard(profile, collection, { bestPlace: remote?.best }),
        rating: Number.isFinite(remote?.rating) ? remote.rating : profile.rating,
        place: remote?.place || null,
        best: remote?.best || null,
      }
    : remote
      ? { card: remote.card, rating: remote.rating, place: remote.place, best: remote.best, seen: remote.card?.seen }
      : null;
  const name = mine ? profile.name : remote?.card?.name || "";

  async function act(fn, done) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(done);
    } catch (e) {
      setError(e.message || "うまくいきませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setup-wrap profile-screen">
      <h2>{mine ? "プロフィール" : `${name || "フレンド"}のプロフィール`}</h2>
      {view ? (
        <ProfileCard view={view} name={name} mine={mine} />
      ) : error ? null : (
        <p className="hint">読み込んでいます…</p>
      )}
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
      {mine ? (
        <div className="nav-stack profile-actions">
          <button className="btn btn-primary" onClick={() => setEdit(true)}>
            プロフィールを編集
          </button>
          {onSettings && (
            <button className="btn btn-ghost" onClick={onSettings}>
              <Settings size={16} /> 名前・アイコン・称号を変える
            </button>
          )}
          {onFriends && (
            <button className="btn btn-ghost" onClick={onFriends}>
              <Users size={16} /> フレンド
            </button>
          )}
        </div>
      ) : (
        remote &&
        remote.friend && (
          <div className="nav-stack profile-actions">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => act(() => giftFriend(uid), "ガチャチケットを1枚贈りました")}
            >
              <Ticket size={16} /> チケットを贈る
            </button>
            {onInvite && (
              <button className="btn btn-ghost" onClick={() => onInvite({ uid, name })}>
                <DoorIn size={16} /> 対戦に招待する
              </button>
            )}
            {confirmRemove ? (
              <button
                className="btn btn-ghost friend-remove-yes"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await removeFriend(uid);
                    onRemoved && onRemoved();
                  }, "フレンドから外しました")
                }
              >
                本当に外す
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={() => setConfirmRemove(true)}>
                フレンドから外す
              </button>
            )}
          </div>
        )
      )}
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> {backLabel}
      </button>
      {edit && (
        <ProfileEditModal
          onClose={() => setEdit(false)}
          onSaved={() => setVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}
