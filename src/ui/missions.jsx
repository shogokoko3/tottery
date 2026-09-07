/**
 * 通常ミッションの画面。
 *
 * 条件を満たしたら自分で「受け取る」を押す。褒美は称号・アイコン・スキン・
 * ガチャチケットの4種で、配る先が2か所(アカウントとスキンの持ち物)に
 * 分かれているので、受け取りはここでまとめている。
 */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Crown } from "../icons.jsx";
import {
  grantMissionTitle,
  loadProfile,
  markMissionClaimed,
  touchDay,
} from "../game/profile.js";
import { KINDS, listMissions, statusOf } from "../game/missions.js";
import { chanceLabel, listSecrets } from "../game/secrets.js";
import { giftLabel, giveGift } from "../game/gifts.js";
import {
  getCollection,
  useCollection,
  updateCollection,
} from "../skins/store.js";
import { claimPeriodicMission } from "../game/periodic-missions.js";
import { useMissionProfile } from "./mission-profile.js";

/** 褒美の呼び名。手紙の添付と同じ形なので、共通のものを使う */
export const rewardLabel = giftLabel;
const TABS = [
  { id: "daily", label: "デイリー" },
  { id: "weekly", label: "ウィークリー" },
  { id: "normal", label: "ノーマル" },
  { id: "event", label: "イベント" },
];
// Existing lifetime missions belong to Normal.
const categoryOf = (mission) => mission.category || "normal";

export function MissionsScreen({ onBack }) {
  const collection = useCollection();
  const [profile, setProfile] = useMissionProfile();
  const [busy, setBusy] = useState(false);
  const claiming = useRef(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("daily");
  const scrollArea = useRef(null);
  const rows = listMissions(profile, collection);
  const visibleRows = rows.filter((m) => categoryOf(m) === category);
  const secrets = listSecrets(profile);
  const ready = visibleRows.filter((m) => m.done && !m.claimed);
  useEffect(() => {
    if (scrollArea.current) scrollArea.current.scrollTop = 0;
  }, [category]);

  /** 1件ぶんを配る。控えるのは配り終えてから(途中で失敗しても二重取りにならない) */
  async function give(mission) {
    if (mission.periodic) {
      await updateCollection((collection) =>
        claimPeriodicMission(collection, touchDay(), mission.id),
      );
      return loadProfile();
    }
    const current = loadProfile();
    const latest = statusOf(mission, current, getCollection());
    if (latest.claimed) return current;
    if (!latest.done)
      throw new Error("まだミッションの条件を満たしていません。");
    if (mission.reward.type === "title")
      return grantMissionTitle(mission.id, mission.reward.id);
    await giveGift(mission.reward);
    return markMissionClaimed(mission.id);
  }

  async function claim(mission) {
    if (claiming.current || mission.claimed || !mission.done) return;
    claiming.current = true;
    setBusy(true);
    setMessage("");
    try {
      setProfile(await give(mission));
      setMessage(`${rewardLabel(mission.reward)}を受け取りました。`);
    } catch (e) {
      setMessage((e && e.message) || "受け取れませんでした。");
    } finally {
      claiming.current = false;
      setBusy(false);
    }
  }

  /**
   * 受け取れるものをまとめて受け取る。
   * 1件ずつ順に配って控えるので、途中で失敗しても、そこまでは受け取れている。
   */
  async function claimAll() {
    if (claiming.current || !ready.length) return;
    claiming.current = true;
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
      claiming.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="setup-wrap missions-screen">
      <header className="missions-heading">
        <h2>ミッション</h2>
        <div className="level-badge">
          <Crown size={16} />
          <span>ガチャチケット {collection.tickets}枚</span>
          <small>条件を満たすと受け取れます</small>
        </div>
        {category === "daily" && (
          <p className="missions-reset">毎日 朝5:00更新（日本時間）</p>
        )}
        {category === "weekly" && (
          <p className="missions-reset">毎週月曜 朝5:00更新（日本時間）</p>
        )}
      </header>
      <div
        className="missions-tabs"
        role="tablist"
        aria-label="ミッションの種類"
      >
        {TABS.map((tab, index) => {
          const count = rows.filter(
            (m) => categoryOf(m) === tab.id && m.done && !m.claimed,
          ).length;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`mission-tab-${tab.id}`}
              aria-controls="missions-panel"
              aria-selected={category === tab.id}
              tabIndex={category === tab.id ? 0 : -1}
              onClick={() => setCategory(tab.id)}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % TABS.length
                    : event.key === "ArrowLeft"
                      ? (index + TABS.length - 1) % TABS.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? TABS.length - 1
                          : null;
                if (next === null) return;
                event.preventDefault();
                setCategory(TABS[next].id);
                event.currentTarget.parentElement
                  .querySelectorAll('[role="tab"]')
                  [next].focus();
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className="missions-tab-count"
                  aria-label={`受取可能${count}件`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        className="missions-scroll"
        id="missions-panel"
        role="tabpanel"
        aria-labelledby={`mission-tab-${category}`}
        tabIndex={0}
        ref={scrollArea}
      >
        {/* シークレットは条件を伏せておく。出くわして初めて名前が出る */}
        {category === "normal" && secrets.found.length > 0 && (
          <div className="mission-secrets">
            {secrets.found.map((sc) => (
              <div className="secret-row" key={sc.id}>
                <h4>{sc.name}</h4>
                <p className="hint">{sc.how}</p>
                <p className="secret-chance">{chanceLabel(sc.chance)}</p>
                {sc.like && <p className="hint">{sc.like}</p>}
              </div>
            ))}
          </div>
        )}
        {visibleRows.length === 0 && (
          <div className="missions-empty">ミッションはありません。</div>
        )}
        <div className="mission-list">
          {visibleRows.map((m) => (
            <div
              className={`mission ${m.claimed ? "is-claimed" : ""} ${
                m.done && !m.claimed ? "is-ready" : ""
              }`}
              key={m.id}
            >
              <div className="mission-head">
                <span className="mission-kind">
                  {m.kindLabel || KINDS[m.kind]?.label}
                </span>
                <b>{m.name}</b>
              </div>
              <div
                className={m.segments ? "mission-segments" : "mission-bar"}
                role="progressbar"
                aria-label={m.name}
                aria-valuemin={0}
                aria-valuemax={m.goal}
                aria-valuenow={m.now}
              >
                {m.segments ? (
                  Array.from({ length: m.goal }, (_, index) => (
                    <span
                      key={index}
                      className={index < m.now ? "is-filled" : ""}
                      aria-hidden="true"
                    />
                  ))
                ) : (
                  <span style={{ width: `${Math.round(m.ratio * 100)}%` }} />
                )}
              </div>
              <div className="mission-foot">
                <small>
                  {m.now}
                  {m.unit ?? KINDS[m.kind]?.unit} / {m.goal}
                  {m.unit ?? KINDS[m.kind]?.unit} · {rewardLabel(m.reward)}
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
      </div>
      <footer className="missions-footer">
        <p className="mission-message" role="status">
          {message}
        </p>
        <div className="missions-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            <ArrowLeft size={16} /> ホームに戻る
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !ready.length}
            onClick={claimAll}
          >
            <Check size={16} />{" "}
            {ready.length > 0 ? `一括受取（${ready.length}）` : "一括受取"}
          </button>
        </div>
      </footer>
    </div>
  );
}
