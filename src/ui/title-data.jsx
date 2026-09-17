/**
 * タイトル(ゲームスタート)の下に置く「データ管理」と「データ引き継ぎ」
 * (2026-09-17、本人の指示)。
 *
 * 遊ぶ前にしか要らない操作をここに集めた。ホームの設定からも同じことができるが、
 * 引き継ぎは**新しい端末で名前を決める前**に使うものなので、タイトルから開けないと届かない。
 */
import { useEffect, useState } from "react";
import { Close, DoorIn, Settings } from "../icons.jsx";
import { loadProfile } from "../game/profile.js";
import { isVerified } from "../net/auth.js";
import { appleSignInAvailable, signInWithApple } from "../net/apple-signin.js";
import { backupNow, backupStatus, restoreFromServer } from "../net/backup.js";
import { DeleteMeModal } from "./overlays.jsx";
import {
  PRIVACY_URL,
  SUPPORT_EMAIL,
  hasPrivacyUrl,
  hasSupportContact,
  supportMailto,
} from "../game/support.js";
import { VERSION } from "../game/constants.js";

const when = (at) =>
  at ? new Date(at).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" }) : null;

/** プレイヤーID・問い合わせ先・記録の削除 */
function DataManageModal({ onClose }) {
  const [profile] = useState(() => loadProfile());
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (deleting)
    return (
      <DeleteMeModal
        onClose={() => setDeleting(false)}
        // 名前を決める画面から出し直す
        onDeleted={() => location.reload()}
      />
    );
  const id = profile.id || "(まだありません)";
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>データ管理</h3>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            <Close size={18} />
          </button>
        </div>
        <p className="settings-head">プレイヤーID</p>
        <div className="settings-list">
          <div className="settings-row">
            <code className="player-id">{id}</code>
            <button
              className="btn btn-ghost btn-small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(id);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "写しました" : "写す"}
            </button>
          </div>
        </div>
        <p className="settings-note">
          お問い合わせのときに教えてください。この番号から、あなたの記録を探せます。
        </p>

        <p className="settings-head">問い合わせ先</p>
        <div className="settings-list">
          <div className="settings-row">
            <span>お問い合わせ</span>
            {hasSupportContact() ? (
              <a className="settings-link" href={supportMailto(VERSION)} target="_blank" rel="noopener noreferrer">
                {SUPPORT_EMAIL}
              </a>
            ) : (
              <b className="settings-todo">未設定</b>
            )}
          </div>
          <div className="settings-row">
            <span>プライバシーポリシー</span>
            {hasPrivacyUrl() ? (
              <a className="settings-link" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                開く
              </a>
            ) : (
              <b className="settings-todo">未設定</b>
            )}
          </div>
          <div className="settings-row">
            <span>ゲームの版</span>
            <b>{VERSION}</b>
          </div>
        </div>

        <p className="settings-head">アカウント削除</p>
        <div className="settings-list">
          <div className="settings-row">
            <span>この端末の記録を消す</span>
            <button className="btn btn-ghost btn-small btn-danger" onClick={() => setDeleting(true)}>
              消す
            </button>
          </div>
        </div>
        <p className="settings-note">
          名前・戦績・持ち点と、公開ランキングのあなたの行を消します。元には戻せません。
        </p>
        <button className="btn btn-primary btn-wide" onClick={onClose}>
          とじる
        </button>
      </div>
    </div>
  );
}

/** 機種変更の引き継ぎ(Apple) */
function DataTransferModal({ onClose }) {
  const [verified, setVerified] = useState(() => isVerified());
  const [status, setStatus] = useState(null); // { has, at }
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canApple = appleSignInAvailable();
  useEffect(() => {
    let alive = true;
    if (!verified) return undefined;
    backupStatus()
      .then((s) => alive && setStatus(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [verified]);

  /** いまの端末の記録を、この口座に預ける(引き継ぎの設定) */
  const setUp = async () => {
    setError("");
    setMessage("");
    setBusy("setup");
    try {
      if (!isVerified()) {
        const r = await signInWithApple();
        if (!r) {
          setBusy("");
          return;
        }
      }
      setVerified(true);
      await backupNow();
      const s = await backupStatus();
      setStatus(s);
      setMessage("この端末の記録を預けました。新しい端末では、同じ Apple ID でサインインしてください。");
    } catch (e) {
      setError(e.message || "設定できませんでした。");
    }
    setBusy("");
  };

  /** 預けてある記録をこの端末に戻す */
  const takeOver = async () => {
    setError("");
    setMessage("");
    setBusy("restore");
    try {
      if (!isVerified()) {
        const r = await signInWithApple();
        if (!r) {
          setBusy("");
          return;
        }
      }
      setVerified(true);
      const r = await restoreFromServer();
      if (!r.restored) {
        setError(
          r.broken
            ? "預かっていた記録を読めませんでした。お問い合わせください。"
            : "この Apple ID には、まだ記録が預けられていません。",
        );
        setBusy("");
        return;
      }
      setMessage("引き継ぎました。画面を読み込み直します。");
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      setError(e.message || "引き継げませんでした。");
    }
    setBusy("");
  };

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-panel settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>データ引き継ぎ</h3>
          {!busy && (
            <button className="icon-btn" onClick={onClose} aria-label="閉じる">
              <Close size={18} />
            </button>
          )}
        </div>
        <p className="hint">
          Apple ID にこの記録を結びつけます。新しい端末で同じ Apple ID からサインインすると、
          名前・レベル・戦績・持ち点・持っているスキンとジェムを引き継げます。
        </p>
        <div className="settings-list">
          <div className="settings-row">
            <span>いまの状態</span>
            <b>{verified ? "Apple ID と結びつき済み" : "この端末だけ"}</b>
          </div>
          {verified && (
            <div className="settings-row">
              <span>最後に預けた日時</span>
              <b>{status ? when(status.at) || "まだ預けていません" : "確認しています…"}</b>
            </div>
          )}
        </div>
        {!canApple && (
          <p className="settings-note">
            引き継ぎの設定は、iPhone・iPad のアプリで行えます。
          </p>
        )}
        {error && (
          <p className="mission-message" role="status" aria-live="polite">
            {error}
          </p>
        )}
        {message && (
          <p className="mission-message" role="status" aria-live="polite">
            {message}
          </p>
        )}
        <div className="settings-list">
          <button
            className="btn btn-primary btn-wide"
            disabled={!canApple || !!busy}
            onClick={setUp}
          >
            {busy === "setup"
              ? "預けています…"
              : verified
                ? "いまの記録を預け直す"
                : "Apple ID で引き継ぎを設定する"}
          </button>
          <button
            className="btn btn-ghost btn-wide"
            disabled={!canApple || !!busy}
            onClick={takeOver}
          >
            {busy === "restore" ? "引き継いでいます…" : "別の端末から引き継ぐ"}
          </button>
        </div>
        <p className="settings-note">
          引き継ぐと、この端末にいまある記録は、預けてあった記録で置き換わります。
          ジェムとチケットの残高はサーバーの台帳が正なので、引き継いだあとにそろいます。
        </p>
        <button className="btn btn-ghost btn-wide" onClick={onClose} disabled={!!busy}>
          とじる
        </button>
      </div>
    </div>
  );
}

/** タイトルの下に並べる2つの入り口 */
export function TitleDataBar() {
  const [open, setOpen] = useState(null);
  return (
    <>
      <div className="title-data-bar">
        <button className="title-data-btn" onClick={() => setOpen("manage")}>
          <Settings size={20} />
          <span>データ管理</span>
        </button>
        <button className="title-data-btn" onClick={() => setOpen("transfer")}>
          <DoorIn size={20} />
          <span>データ引き継ぎ</span>
        </button>
      </div>
      {open === "manage" && <DataManageModal onClose={() => setOpen(null)} />}
      {open === "transfer" && <DataTransferModal onClose={() => setOpen(null)} />}
    </>
  );
}
