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
import { Close } from "../icons.jsx";

export function PlayerActionModal({ target, onClose, onChanged }) {
  // "menu" 何をするか / "reason" 理由を選ぶ / "sending" 送信中
  // "sent" 送れた / "error" 送れなかった / "blocked" 見えなくした
  const [step, setStep] = useState("menu");
  const [error, setError] = useState("");

  const name = (target && target.name) || "この人";

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
          <h3>{name} について</h3>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            <Close size={18} />
          </button>
        </div>

        {step === "menu" && (
          <div className="report-body">
            <button
              className="btn btn-ghost report-choice"
              onClick={() => setStep("reason")}
            >
              <b>通報する</b>
              <span>運営に知らせます。24時間以内に確認します</span>
            </button>
            <button className="btn btn-ghost report-choice" onClick={hide}>
              <b>この人を見えなくする</b>
              <span>
                ランキングと待ち合わせに出なくなります。相手には伝わりません
              </span>
            </button>
          </div>
        )}

        {step === "reason" && (
          <div className="report-body">
            <p className="hint">どれにあてはまりますか。</p>
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
              戻る
            </button>
          </div>
        )}

        {step === "sending" && (
          <div className="report-body">
            <p className="hint">送っています…</p>
          </div>
        )}

        {step === "sent" && (
          <div className="report-body">
            <p className="report-done">通報を受け付けました。</p>
            <p className="hint">
              運営が中身を確かめ、24時間以内に対応します。あわせてこの人を
              見えなくすることもできます。
            </p>
            <button className="btn btn-ghost report-choice" onClick={hide}>
              <b>この人を見えなくする</b>
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              閉じる
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="report-body">
            <p className="error-text">{error}</p>
            <button
              className="btn btn-ghost report-choice"
              onClick={() => setStep("reason")}
            >
              <b>もう一度送る</b>
            </button>
            <button className="btn btn-ghost report-choice" onClick={hide}>
              <b>この人を見えなくする</b>
              <span>通報が送れなくても、見えなくすることはできます</span>
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              閉じる
            </button>
          </div>
        )}

        {step === "blocked" && (
          <div className="report-body">
            <p className="report-done">{name} を見えなくしました。</p>
            <p className="hint">設定の「見えなくした人」から戻せます。</p>
            <button className="btn btn-primary" onClick={onClose}>
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
