/**
 * お知らせとフレンドを1つの入口にまとめた画面(2026-09-24 本人の指示)。
 *
 * ホームの「お知らせ」から開く。上のタブで「お知らせ」(運営からの手紙)と「フレンド」を切り替える。
 * タブは画面 id(letters / friends)そのもので、ミッション・バトルパス(QuestsScreen)と同じ作り。
 * 印はそれぞれのタブに出す(未読の手紙・届いている申請/贈り物/招待)。
 */
import { LettersScreen, useUnreadLetters } from "./letters.jsx";
import { FriendsScreen, useFriendAlerts } from "./friends.jsx";

export const INBOX_TABS = [
  { id: "letters", label: "お知らせ" },
  { id: "friends", label: "フレンド" },
];

export function InboxScreen({ tab = "letters", onTab, onBack, onProfile, onInvite, onJoinInvite }) {
  const unread = useUnreadLetters();
  const alerts = useFriendAlerts();
  const current = INBOX_TABS.some((t) => t.id === tab) ? tab : "letters";
  const count = (id) => (id === "letters" ? unread : alerts);
  return (
    <div className={`quests-screen inbox-screen is-${current}`}>
      <div className="quests-switch" role="tablist" aria-label="お知らせとフレンド">
        {INBOX_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`inbox-tab-${t.id}`}
            aria-selected={current === t.id}
            tabIndex={current === t.id ? 0 : -1}
            onClick={() => current !== t.id && onTab && onTab(t.id)}
          >
            {t.label}
            {count(t.id) > 0 && (
              <span className="missions-tab-count" aria-label={`${count(t.id)}件`}>
                {count(t.id) > 99 ? "99+" : count(t.id)}
              </span>
            )}
          </button>
        ))}
      </div>
      {current === "friends" ? (
        <FriendsScreen embedded onBack={onBack} onProfile={onProfile} onInvite={onInvite} onJoinInvite={onJoinInvite} />
      ) : (
        <LettersScreen embedded onBack={onBack} />
      )}
    </div>
  );
}
