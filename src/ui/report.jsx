/**
 * 相手について何かする画面。通報と、見えなくすること。
 *
 * ガイドライン 1.2 が求める「通報する手段」と「ブロックする手段」を、
 * 相手の名前が出るところから1手で開けるようにまとめてある。
 * 呼び出し元: ランキングの行、対局中の顔ぶれ。
 */
import { useState } from "react";
import { loadProfile } from "../game/profile.js";
import { block } from "../game/blocked.js";
import { REASONS, sendReport } from "../net/reports.js";
import { requestFriendByUid } from "../net/friends.js";
import { Close, Users } from "../icons.jsx";
import { L, Lx } from "../i18n/index.js";

export function PlayerActionModal({ target, onClose, onChanged, friendSource = "rank" }) {
  // "menu" 何をするか / "reason" 理由を選ぶ / "sending" 送信中
  // "sent" 送れた / "error" 送れなかった / "blocked" 見えなくした
  const [step, setStep] = useState("menu");
  const [error, setError] = useState("");
  // フレンド申請(2026-09-24 本人の指示)。ランキングの人へは "rank"。結果の一言をここに出す
  const [friendMsg, setFriendMsg] = useState("");
  const [friendBusy, setFriendBusy] = useState(false);

  const name = (target && target.name) || L("この人");

  async function befriend() {
    if (friendBusy) return;
    setFriendBusy(true);
    setFriendMsg("");
    try {
      const r = await requestFriendByUid(target.id, friendSource);
      setFriendMsg(r.friend ? L("{name} とフレンドになりました", { name }) : L("フレンド申請を送りました"));
    } catch (e) {
      setFriendMsg(Lx(e.message) || L("送れませんでした"));
    } finally {
      setFriendBusy(false);
    }
  }

  async function send(reasonId) {
    setStep("sending");
    const res = await sendReport(target, reasonId, loadProfile());
    if (res.ok) {
      setStep("sent");
    } else {
      setError(res.error);
      setStep("error");
    }
  }

  function hide() {
    block(target.id, target.name);
    if (onChanged) onChanged();
    setStep("blocked");
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel report-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{L("{name} について", { name })}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={L("閉じる")}>
            <Close size={18} />
          </button>
        </div>

        {step === "menu" && (
          <div className="report-body">
            <button className="btn btn-ghost report-choice" disabled={friendBusy} onClick={befriend}>
              <b>
                <Users size={14} /> {L("フレンド申請を送る")}
              </b>
              <span>{friendMsg || L("相手が承認するとフレンドになります")}</span>
            </button>
            <button
              className="btn btn-ghost report-choice"
              onClick={() => setStep("reason")}
            >
              <b>{L("通報する")}</b>
              <span>{L("運営に知らせます。24時間以内に確認します")}</span>
            </button>
            <button className="btn btn-ghost report-choice" onClick={hide}>
              <b>{L("この人を見えなくする")}</b>
              <span>
                {L("ランキングと待ち合わせに出なくなります。相手には伝わりません")}
              </span>
            </button>
          </div>
        )}

        {step === "reason" && (
          <div className="report-body">
            <p className="hint">{L("どれにあてはまりますか。")}</p>
            {REASONS.map((r) => (
              <button
                key={r.id}
                className="btn btn-ghost report-choice"
                onClick={() => send(r.id)}
              >
                <b>{r.label}</b>
              </button>
            ))}
            <button
              className="btn btn-ghost report-back"
              onClick={() => setStep("menu")}
            >
              {L("戻る")}
            </button>
          </div>
        )}

        {step === "sending" && (
          <div className="report-body">
            <p className="hint">{L("送っています…")}</p>
          </div>
        )}

        {step === "sent" && (
          <div className="report-body">
            <p className="report-done">{L("通報を受け付けました。")}</p>
            <p className="hint">
              {L("運営が中身を確かめ、24時間以内に対応します。あわせてこの人を見えなくすることもできます。")}
            </p>
            <button className="btn btn-ghost report-choice" onClick={hide}>
              <b>{L("この人を見えなくする")}</b>
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              {L("閉じる")}
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="report-body">
            <p className="error-text">{Lx(error)}</p>
            <button
              className="btn btn-ghost report-choice"
              onClick={() => setStep("reason")}
            >
              <b>{L("もう一度送る")}</b>
            </button>
            <button className="btn btn-ghost report-choice" onClick={hide}>
              <b>{L("この人を見えなくする")}</b>
              <span>{L("通報が送れなくても、見えなくすることはできます")}</span>
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              {L("閉じる")}
            </button>
          </div>
        )}

        {step === "blocked" && (
          <div className="report-body">
            <p className="report-done">{L("{name} を見えなくしました。", { name })}</p>
            <p className="hint">{L("設定の「見えなくした人」から戻せます。")}</p>
            <button className="btn btn-primary" onClick={onClose}>
              {L("閉じる")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
