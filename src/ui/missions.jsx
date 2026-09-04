/**
 * 通常ミッションの画面。
 *
 * 条件を満たしたら自分で「受け取る」を押す。褒美は称号・アイコン・スキン・
 * ガチャチケットの4種で、配る先が2か所(アカウントとスキンの持ち物)に
 * 分かれているので、受け取りはここでまとめている。
 */
import { useState } from "react";
import { ArrowLeft, Check, Crown } from "../icons.jsx";
import { loadProfile, markMissionClaimed } from "../game/profile.js";
import { KINDS, listMissions } from "../game/missions.js";
import { giftLabel, giveGift } from "../game/gifts.js";
import { useCollection } from "../skins/store.js";

/** 褒美の呼び名。手紙の添付と同じ形なので、共通のものを使う */
export const rewardLabel = giftLabel;

export function MissionsScreen({ onBack }) {
  const collection = useCollection();
  const [profile, setProfile] = useState(() => loadProfile());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const rows = listMissions(profile);
  const ready = rows.filter((m) => m.done && !m.claimed);

  /** 1件ぶんを配る。控えるのは配り終えてから(途中で失敗しても二重取りにならない) */
  async function give(mission) {
    await giveGift(mission.reward);
    return markMissionClaimed(mission.id);
  }

  async function claim(mission) {
    if (busy || mission.claimed || !mission.done) return;
    setBusy(true);
    setMessage("");
    try {
      setProfile(await give(mission));
      setMessage(`${rewardLabel(mission.reward)}を受け取りました。`);
    } catch (e) {
      setMessage((e && e.message) || "受け取れませんでした。");
    } finally {
      setBusy(false);
    }
  }

  /**
   * 受け取れるものをまとめて受け取る。
   * 1件ずつ順に配って控えるので、途中で失敗しても、そこまでは受け取れている。
   */
  async function claimAll() {
    if (busy || !ready.length) return;
    setBusy(true);
    setMessage("");
    let got = 0;
    let last = profile;
    try {
      for (const m of ready) {
        last = await give(m);
        got += 1;
      }
      setMessage(`${got}件の報酬を受け取りました。`);
    } catch (e) {
      setMessage(
        got
          ? `${got}件を受け取ったところで止まりました: ${(e && e.message) || ""}`
          : (e && e.message) || "受け取れませんでした。",
      );
    } finally {
      setProfile(last);
      setBusy(false);
    }
  }

  return (
    <div className="setup-wrap">
      <h2>ミッション</h2>
      <div className="level-badge">
        <Crown size={16} />
        <span>ガチャチケット {collection.tickets}枚</span>
        <small>条件を満たすと受け取れます</small>
      </div>
      <p className="mission-message" role="status">
        {message}
      </p>
      {ready.length > 0 && (
        <button
          className="btn btn-primary btn-wide"
          disabled={busy}
          onClick={claimAll}
        >
          <Check size={16} /> {ready.length}件をまとめて受け取る
        </button>
      )}
      <div className="mission-list">
        {rows.map((m) => (
          <div
            className={`mission ${m.claimed ? "is-claimed" : ""} ${
              m.done && !m.claimed ? "is-ready" : ""
            }`}
            key={m.id}
          >
            <div className="mission-head">
              <span className="mission-kind">{KINDS[m.kind].label}</span>
              <b>{m.name}</b>
            </div>
            <div className="mission-bar">
              <span style={{ width: `${Math.round(m.ratio * 100)}%` }} />
            </div>
            <div className="mission-foot">
              <small>
                {m.now}
                {KINDS[m.kind].unit} / {m.goal}
                {KINDS[m.kind].unit} · {rewardLabel(m.reward)}
              </small>
              {m.claimed ? (
                <span className="mission-done">受け取り済み</span>
              ) : (
                <button
                  className="btn btn-primary btn-small"
                  disabled={!m.done || busy}
                  onClick={() => claim(m)}
                >
                  <Check size={14} /> 受け取る
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="hint">条件は今後も増やします。</p>
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> ホームに戻る
      </button>
    </div>
  );
}
