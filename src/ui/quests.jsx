/**
 * ミッションとバトルパスを1つの入り口にまとめた画面(2026-09-22 本人の指示)。
 *
 * ホームの2列3段のうち、バトルパスがあった左下がこの画面の入り口。
 * 上の切り替えで「ミッション」と「バトルパス」を行き来する。中身はそれぞれの
 * 画面(MissionsScreen / BattlePassScreen)をそのまま使い、見出しだけを外す(embedded)。
 *
 * どちらを開いているかは画面の id("missions" / "battlepass")そのもので持つ。
 * ショップやガチャ画面からの「バトルパスへ」がそのまま効き、曲(SCREEN_TRACK)と
 * 戻り先(backFor)の表も変えずに済む。
 */
import { claimableCount } from "../game/missions.js";
import { useCollection } from "../skins/store.js";
import { BattlePassScreen } from "./battlepass.jsx";
import { MissionsScreen } from "./missions.jsx";
import { useMissionProfile } from "./mission-profile.js";

export const QUEST_TABS = [
  { id: "missions", label: "ミッション" },
  { id: "battlepass", label: "バトルパス" },
];

export function QuestsScreen({ tab = "missions", onTab, onBack, onSkins }) {
  const [profile] = useMissionProfile();
  const collection = useCollection();
  // 受け取れるミッションの数。バトルパスを開いているときも、切り替えに印を出す
  const ready = claimableCount(profile, collection);
  const current = QUEST_TABS.some((t) => t.id === tab) ? tab : "missions";
  return (
    <div className={`quests-screen is-${current === "missions" ? "missions" : "pass"}`}>
      <div
        className="quests-switch"
        role="tablist"
        aria-label="ミッションとバトルパス"
      >
        {QUEST_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`quests-tab-${t.id}`}
            aria-selected={current === t.id}
            tabIndex={current === t.id ? 0 : -1}
            onClick={() => current !== t.id && onTab && onTab(t.id)}
          >
            {t.label}
            {t.id === "missions" && ready > 0 && (
              <span className="missions-tab-count" aria-label={`受取可能${ready}件`}>
                {ready > 99 ? "99+" : ready}
              </span>
            )}
          </button>
        ))}
      </div>
      {current === "battlepass" ? (
        <BattlePassScreen embedded onBack={onBack} onSkins={onSkins} />
      ) : (
        <MissionsScreen embedded onBack={onBack} />
      )}
    </div>
  );
}
