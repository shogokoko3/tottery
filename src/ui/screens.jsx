import {
  HomeRealmDecoration,
  HomeRealmPortrait,
  HomeFrameCorners,
  findHomeTheme,
  homeThemeStyle,
} from "./home-customization.jsx";
import { homeThemeOf } from "../skins/home-themes.js";
import HOME_STYLES from "./home-customization.css";
import { useBattlePassUnlocked } from "./battlepass-access.js";
import { BattlePassSkinLock } from "./battlepass-skin-lock.jsx";
import { GemAmount } from "./gem.jsx";
import { seasonRequest, retrySeasonMatches } from "../net/season.js";
import { AppearanceSeats } from "./season.jsx";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useScreenBgm } from "../audio/index.js";
import { titleBgImg } from "../assets.js";
import { VERSION } from "../game/constants.js";
import {
  ArrowLeft,
  ArrowRight,
  Book,
  Check,
  Crown,
  Dice,
  DoorIn,
  DoorOut,
  Globe,
  Info,
  Lock,
  Nearby,
  Play,
  Settings,
  Users,
  Sparkle,
  Grid,
  Mail,
  Shop,
  Ticket,
  Cards,
} from "../icons.jsx";
import {
  LOBBY_TTL,
  createRoom,
  deleteLobbyPath,
  deleteRoom,
  generateRoomCode,
  joinRoom,
  leaveRoom,
  readLobby,
  readLobbyPath,
  readRoom,
  writeLobby,
  updateRoom,
} from "../net/firebase.js";
import {
  generateFriendCode,
  formatRoomCode,
  cleanRoomCode,
  parseRoomCode,
  roomLink,
  roomFromLocation,
  ROOM_CODE_LENGTH,
} from "../net/room-code.js";
import { nearby, nearbyAvailable } from "../net/nearby.js";
import { noteCollection } from "../net/wallet.js";
import { SEASON_API_ORIGIN } from "../net/season.js";
import {
  loadOnlineSize,
  saveOnlineSize,
  matchesOnlineSize,
  loadCustomRules,
  saveCustomRules,
} from "../net/match-settings.js";
import {
  DEFAULT_CUSTOM,
  AREA_SIDE_LABEL,
  CUSTOM_AREA_SIDES,
  armySizeFor,
  handSizeFor,
  customSummary,
  isDefaultCustom,
  normalizeCustom,
  toggleRank,
} from "../game/custom-rules.js";
import { RANKS, MASTERY_SKINS } from "../game/constants.js";
import { GameCore } from "./game.jsx";
import { RulesPanel } from "./guides.jsx";
import { SettingsModal } from "./overlays.jsx";
import { TutorialSelect } from "./tutorial.jsx";
import { TsumeScreen, useTsumeDay } from "./tsume.jsx";
import { tsumeReceipt } from "../game/tsume-daily.js";
import { nextTutorialAfter } from "../game/tutorial.js";
import { ProfileSyncNotice } from "./profile-sync.jsx";
import { XpGainToast } from "./xp-gain.jsx";
import { TitleAcquisition } from "./title-acquisition.jsx";
import { getXpNotices, subscribeXpNotices } from "../game/xp-notices.js";
import { GAME_RULE_VERSION } from "../game/rule-version.js";
import { foilRevealed } from "../skins/collection.js";
import { roomRuleVersion } from "../net/sync.js";
import { RankingScreen } from "./ranking.jsx";
import {
  hasName,
  isTestPlay,
  loadProfile,
  levelOf,
  levelProgress,
} from "../game/profile.js";
import {
  ALL_CARDS_LEVEL,
  BOARD9_LEVEL,
  boardOpen,
  cardUnlockText,
  handSizeForLevel,
  poolForLevel,
} from "../game/card-unlock.js";
import { NameEditModal, NameSetupScreen } from "./account.jsx";
import { titleOf } from "../game/titles.js";
import { TitleFrame } from "./title-frame.jsx";
import TITLE_STYLES from "./title-frame.css";
import { PlayerIcon } from "./playericon.jsx";
import { adoptUid, touchDay } from "../game/profile.js";
import { onlineGate, onlineGateLabel } from "../game/online-gate.js";
import { botPlan, makeBot, botSearchDelay, clearBotNow, BOT_WAIT_MS,
  botTitle,
} from "../game/bot-match.js";
import {
  homeTutorialNudge,
  markFirstTutorialOffered,
  shouldOfferFirstTutorial,
} from "../game/tutorial-nudge.js";
import { TUTORIALS } from "../game/tutorial.js";
import { isBlocked } from "../game/blocked.js";
import { dropOldRows, syncPlayer } from "../net/players.js";
import { ensureAuth, myUid } from "../net/auth.js";
import { SeatsProvider } from "./names.jsx";
import STYLES from "../styles.css";
import ROYAL_STYLES from "./royal-theme.css";
import SKIN_STYLES from "../skins/styles.css";
import AREA_STYLES from "./area-effects.css";
import SEASON_STYLES from "./season.css";
import TSUME_STYLES from "./tsume.css";
import { SkinsScreen } from "./skins.jsx";
import { useFriendAlerts } from "./friends.jsx";
import { InboxScreen } from "./inbox.jsx";
import { OpenSettings, useOpenSettings } from "./open-settings.js";
import { ProfileScreen } from "./profile.jsx";
import { inviteFriend } from "../net/friends.js";
import { useMissionProfile } from "./mission-profile.js";
import { QuestsScreen } from "./quests.jsx";
import { CardMasteryScreen } from "./card-mastery.jsx";
import { LettersScreen, useUnreadLetters } from "./letters.jsx";
import { LoginBonus } from "./loginbonus.jsx";
import { GemShop } from "./gem-shop.jsx";
import { ShopScreen } from "./shop.jsx";
import { TitleDataBar } from "./title-data.jsx";
import { backupIfDue } from "../net/backup.js";
import { shopAvailable } from "../net/iap.js";
import { claimableCount } from "../game/missions.js";
import { getCollection, useCollection } from "../skins/store.js";
import { baseSkinId, foilId, sanitizeLoadout } from "../skins/catalog.js";
import { createCpuLoadout, ensureCpuFoil } from "../skins/cpu-loadout.js";
import {
  JOSEKI_AREAS,
  JOSEKI_INFO,
  pickJosekiKing,
} from "../game/cpu-joseki.js";

const mySkins = () => sanitizeLoadout(getCollection().equipped);

/** いま端末に登録されている自分の名前。まだ決めていなければ null */
function myName() {
  return loadProfile().name || null;
}

/** いま選んでいるアイコン。相手にも渡す */
function myIcon() {
  return loadProfile().icon || null;
}

/** いま選んでいる称号。相手にも渡す */
function myTitle() {
  return titleOf(loadProfile()).id;
}

/** いまのレート。相手に渡して、対局後の増減を互いに計算する */
function myRating() {
  return loadProfile().rating;
}

/**
 * 設定を開く手。GameShell が持っている設定の札を、
 * その下に置かれた画面(ホームなど)からも開けるようにする。
 */
export { useOpenSettings };

export function GameShell({
  children,
  showRules,
  setShowRules,
  netInfo,
  onBack,
  onHome,
  title,
  sheet,
  // 下に貼り付く帯(チュートリアル)があるときだけ true。舞台の下に帯のぶんの余白を足す。
  // sheet は演出の断片で常に truthy なので、これで見分ける(帯が無いのに 264px 空いていた。2026-09-23)
  band = false,
  focusButton,
  // 右上に足す釦(チュートリアル中の「飛ばす」など)。無ければ何も出ない
  topExtra = null,
}) {
  let [i, f] = (0, useState)(!1);
  // 上の「トッタリー」を押すとタイトルへ。対局中は onBack と同じ扱いにして、
  // 「対局をやめますか?」の確認を通す(黙って抜けると対局が飛ぶ)
  let goHome = onHome || onBack;
  // 上の帯は画面に貼り付けて、どの画面でも(重ねた画面や案内の幕の上でも)見えるようにする。
  // その高さを根に伝え、本文・重ねた画面・案内の幕がその下から始まるようにする
  // (2026-09-18 本人の指示「戻る・トッタリー・ⓘ・設定 はどの画面でも見えるように」)
  const barRef = useRef(null);
  useEffect(() => {
    const root = typeof document !== "undefined" ? document.documentElement : null;
    const bar = barRef.current;
    if (!root || !bar) return undefined;
    const set = () =>
      root.style.setProperty("--top-bar-h", `${Math.round(bar.getBoundingClientRect().height)}px`);
    set();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    if (ro) ro.observe(bar);
    window.addEventListener("resize", set);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", set);
    };
  }, []);
  return (
    <div className={`tottery-root ${focusButton ? "focus-button" : ""}`}>
      <style>{STYLES + SKIN_STYLES + TSUME_STYLES + SEASON_STYLES + AREA_STYLES + ROYAL_STYLES + HOME_STYLES + TITLE_STYLES}</style>
      <header className="top-bar" ref={barRef}>
        {/* 左上の戻る釦は外した。各画面に「ホームに戻る」があり、真ん中の「トッタリー」も
            ホームへ戻るので重複していた(2026-09-21 本人の指示)。
            桁(top-left)は空のまま残す。消すと真ん中の題がずれる */}
        <div className="top-left" />
        {goHome ? (
          <button
            className="brand brand-link"
            onClick={goHome}
            aria-label="タイトルへ戻る"
          >
            {title || "トッタリー"}
          </button>
        ) : (
          <span className="brand">{title || "トッタリー"}</span>
        )}
        <div className="top-right">
          {topExtra}
          <button
            className="icon-btn"
            onClick={() => setShowRules(!0)}
            aria-label="カード早見表"
          >
            <Info size={18} />
          </button>
          <button className="icon-btn" onClick={() => f(!0)} aria-label="設定">
            <Settings size={18} />
          </button>
        </div>
      </header>
      {i && <SettingsModal onClose={() => f(!1)} />}
      {isTestPlay() && (
        <div className="test-badge">テストプレイ中 · 時間制限なし</div>
      )}
      <main className={`stage ${band ? "stage-with-sheet" : ""}`}>
        <OpenSettings.Provider value={() => f(!0)}>
          {children}
        </OpenSettings.Provider>
      </main>
      {sheet}
      {showRules && (
        <RulesPanel
          onClose={() => setShowRules(!1)}
          initialTab={typeof showRules === "string" ? showRules : "moves"}
        />
      )}
      <div className="build-tag">
        {netInfo && <span className="net-tag">{netInfo} · </span>}build:{" "}
        {VERSION}
      </div>
    </div>
  );
}
/**
 * タイトル。押すところは「ゲームスタート」だけにしてある。
 * スキンはこの次のホームから入る。ここに並べると、
 * 遊び始める前に寄り道の口が見えてしまう。
 */
export function HomeScreen({ onStart }) {
  return (
    <div className="intro title-hero">
      <div className="title-hero-visual">
        <img
          className="title-bg"
          src={titleBgImg}
          alt="トッタリー — 相手の王を討て"
          width={660}
          height={1173}
          draggable="false"
        />
        <button
          type="button"
          className="title-start-button"
          aria-label="ゲームスタート"
          onClick={onStart}
        />
      </div>
      {/* 遊ぶ前にしか要らない入り口。新しい端末では名前を決める前に使う(2026-09-17) */}
      <TitleDataBar />
    </div>
  );
}
/**
 * ホームの一番上に出る、自分の札。
 *
 * 「いまの自分」(名前・称号・レベル)をひと目で出す。残高はその下のバーへ。
 * 押すと設定が開く。名前やアイコンを変えるのはそこ。
 */
function HomeSelf({ profile, onProfile = null }) {
  const { season } = useCollection();
  const openSettings = useOpenSettings();
  const progress = levelProgress(profile);
  return (
    <button
      className="home-self"
      onClick={onProfile || openSettings || void 0}
      aria-label={onProfile ? "自分のプロフィールを開く" : "自分の設定を開く"}
    >
      <PlayerIcon
        icon={profile.icon}
        name={profile.name}
        size="md"
        frame={season.frame}
      />
      <span className="home-self-id">
        <b>{profile.name || "名無し"}</b>
      </span>
      <span className="home-self-right">
        <span className="home-lv">
          Lv <b>{progress.level}</b>
        </span>
        <ArrowRight size={14} className="home-self-more" />
      </span>
      {/* 称号は名前の脇ではなく一段を使う。額縁の作りが見えないと
          手に入れた甲斐が伝わらない(2026-09-22 本人の指示) */}
      <TitleFrame
        id={titleOf(profile).id}
        size="compact"
        className="home-self-title"
      />
      <span className="home-self-bar">
        <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
      </span>
    </button>
  );
}

/** ホームの四角い入り口。絵柄を上、名前を下に置く */
function HomeTile({ tone, icon, label, note, badge, onClick, frameTheme, locked = false }) {
  return (
    <button className={`home-tile home-tile-${tone}${locked ? " is-locked" : ""}`} onClick={onClick}>
      <HomeFrameCorners theme={frameTheme} small />
      <span className="home-tile-icon">{icon}</span>
      <b>{label}</b>
      <small>{note}</small>
      {badge > 0 && (
        <span className="menu-badge">{badge > 99 ? "99+" : badge}</span>
      )}
      {locked && (
        <span className="home-tile-lock" aria-hidden="true">
          <Lock size={14} />
        </span>
      )}
    </button>
  );
}

/**
 * ホーム。タイトルの「ゲームスタート」の次に出る。
 *
 * 片手で持った電話で見るところなので、並べ方に軽重をつけた。
 * 「対戦する」を大きく、残りの6つの入り口は2列でまとめる。
 * 風景込みのイラストを残し、背の低い電話でも操作を押し出さない。
 */
export function MenuScreen({
  onPlay,
  onTutorial,
  onTsume,
  onSkins,
  onBattlePass,
  onMissions,
  onCards,
  onShop,
  onLetters,
  // フレンドのタブを直接開く(届き物の知らせから)
  onFriends = null,
  onProfile = null,
  now = Date.now,
}) {
  const [profile] = useMissionProfile();
  // 受け取れるミッションの数と、未読のお知らせ。入り口に印を出す
  const unread = useUnreadLetters();
  // フレンドの申請・贈り物・招待(2026-09-23)。入り口に印を出す(30秒ごとに読み直す)
  const friendAlertsAll = useFriendAlerts();
  const friendAlerts = friendAlertsAll.total;
  const passUnlocked = useBattlePassUnlocked();
  const collection = useCollection();
  const themeId = homeThemeOf(collection);
  const theme = findHomeTheme(themeId);
  // スキンを1つでも持っていれば「カード」(熟練度)を解放。無ければロック(2026-09-24 本人の指示)
  const skinOwned = (collection && collection.owned) || {};
  const hasAnySkin = MASTERY_SKINS.some((id) => skinOwned[id] || skinOwned[foilId(id)]);
  // ジェムショップ(iOS だけ)。残高バーから直接開けるようにする
  const [shopOk, setShopOk] = useState(false);
  const [shop, setShop] = useState(false);
  const [shopMsg, setShopMsg] = useState("");
  useEffect(() => {
    let alive = true;
    shopAvailable().then((ok) => alive && setShopOk(ok));
    return () => {
      alive = false;
    };
  }, []);
  const ready = claimableCount(profile, collection);
  const today = useTsumeDay(now);
  const receipt = tsumeReceipt(collection, today.day);
  // チュートリアルの釦の一言。第8話まで終えるまでは次の話を添える
  const nudge = homeTutorialNudge(profile);
  const tsumeStatus = receipt?.cleared
    ? "cleared"
    : receipt?.joined
      ? "joined"
      : "new";
  return (
    <div className={`home-wrap${theme ? " has-home-theme" : ""}`} data-home-area={themeId} style={homeThemeStyle(theme)}>
      <HomeRealmDecoration theme={theme} />
      {/* その日のぶんがまだなら、ここに着いたときに札が出る */}
      <LoginBonus />

      {/* 上段は自分の札と「お知らせ」の2列(2026-09-24 本人の指示で元の並びに戻した)。
          お知らせの釦はフレンドと同じ入口(InboxScreen)。印は未読の手紙とフレンドの届き物の合計 */}
      <div className="home-account-row">
      <HomeSelf profile={profile} onProfile={onProfile} />
      <button
        className="home-news"
        onClick={onLetters}
        aria-label={`お知らせ・フレンド${unread + friendAlerts > 0 ? ` 届いているもの${unread + friendAlerts}件` : ""}`}
      >
        <Mail size={15} />
        <span>お知らせ・<br />フレンド</span>
        {unread + friendAlerts > 0 && (
          <span className="home-news-count">{unread + friendAlerts > 99 ? "99+" : unread + friendAlerts}</span>
        )}
      </button>
      </div>
      {/* 届いているものを一言で知らせる(2026-09-24 本人の指示)。運営のお知らせとフレンドは別の行にして見分けがつくように。
          押すとそれぞれのタブが開く */}
      {(unread > 0 || friendAlerts > 0) && (
        <div className="home-alerts" role="status">
          {unread > 0 && (
            <button className="home-alert home-alert-news" onClick={onLetters}>
              <Mail size={14} />
              <span>運営からのお知らせが {unread}件 届いています</span>
              <ArrowRight size={14} />
            </button>
          )}
          {friendAlerts > 0 && (
            <button className="home-alert home-alert-friend" onClick={onFriends || onLetters}>
              <Users size={14} />
              <span>
                {[
                  friendAlertsAll.requests ? `フレンド申請 ${friendAlertsAll.requests}件` : null,
                  friendAlertsAll.gifts ? `贈り物 ${friendAlertsAll.gifts}件` : null,
                  friendAlertsAll.invites ? `対戦の招待 ${friendAlertsAll.invites}件` : null,
                ]
                  .filter(Boolean)
                  .join("・")}
                が届いています
              </span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}
      {/* 残高。左にチケット、右にジェム(2026-09-22 本人の指示で入れ替え)。
          押せるのはジェムから「+」までで、押すとジェムの店が開く。「ジェムを買う」の文言は出さない。
          店は iOS のアプリだけなので、ほかでは理由を出す(ショップ画面と同じ文言) */}
      <div className="home-resource-bar" aria-label="いまの残高">
        <span className="home-resource-tickets">
          <Ticket size={16} /> {collection.tickets}枚
        </span>
        <button
          type="button"
          className="home-resource-gems"
          onClick={() =>
            shopOk
              ? setShop(true)
              : setShopMsg(
                  "ジェムは iPhone・iPad のアプリでのみ買えます。ほかの買い物はこのままお使いいただけます。",
                )
          }
          aria-label={`ジェム ${collection.gems || 0}。ジェムを買う`}
        >
          <GemAmount amount={collection.gems || 0} size={26} />
          {/* 「+」は文字ではなく線の絵にする。金の丸に文字の「+」だと、細い線で描いた
              チケットや矢印の中でそこだけ浮いて見えた(2026-09-22 本人の指摘) */}
          <span className="home-resource-plus" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10.4" strokeWidth="1.2" />
              <path d="M12 7.6v8.8M7.6 12h8.8" />
            </svg>
          </span>
        </button>
      </div>
      {shopMsg && <p className="mission-message" role="status" aria-live="polite">{shopMsg}</p>}

      <HomeRealmPortrait theme={theme} />
      <button className="home-hero" onClick={onPlay}>
        <HomeFrameCorners theme={theme} small />
        <span className="home-hero-icon">
          <Globe size={34} />
        </span>
        <span className="home-hero-label">
          <b>対戦する</b>
          <small>オンライン・フレンド・CPU</small>
        </span>
        <ArrowRight size={20} className="home-hero-arrow" />
      </button>

      {/* 2列3段。左上から チュートリアル・カード / 詰めトッタリー・ショップ /
          ミッション・バトルパス・ガチャ(本人の指示 2026-09-17、2026-09-22 に並べ替え)。
          ミッションとバトルパスは1つの画面(quests.jsx)にまとめ、バトルパスがあった左下へ。
          ミッションがあった右上は「カード」(札ごとの熟練度)。ランキングは「対戦する」の中 */}
      <div className="home-grid">
        <HomeTile
          frameTheme={theme}
          tone="tutorial"
          icon={<Book size={26} />}
          label={
            <>
              チュートリアル
              {nudge && nudge.kind === "start" && (
                <span className="home-wide-pill">おすすめ</span>
              )}
            </>
          }
          note={nudge ? nudge.text : "ルールと駒の効果"}
          onClick={onTutorial}
        />
        <HomeTile
          frameTheme={theme}
          tone="cards"
          icon={<Cards size={26} />}
          label="カード"
          note={hasAnySkin ? "スキンの熟練度" : "スキンを獲得すると解放"}
          locked={!hasAnySkin}
          onClick={onCards}
        />
        <HomeTile
          frameTheme={theme}
          tone="tsume"
          icon={<Crown size={26} />}
          label="詰めトッタリー"
          note={
            <span
              className={`home-tsume-status is-${tsumeStatus}`}
              role="status"
            >
              {receipt?.joined ? (
                <Check size={12} />
              ) : (
                <span className="home-tsume-dot" aria-hidden="true" />
              )}
              本日{" "}
              {receipt?.cleared
                ? "クリア済み"
                : receipt?.joined
                  ? "挑戦済み"
                  : "未挑戦"}
            </span>
          }
          onClick={onTsume}
        />
        <HomeTile
          frameTheme={theme}
          tone="shop"
          icon={<Shop size={26} />}
          label="ショップ"
          note="ジェム・チケット・フォイル"
          onClick={onShop}
        />
        <HomeTile
          frameTheme={theme}
          tone="quests"
          icon={<Check size={26} />}
          label={
            // 2つの名を1行に詰めると「バトル／パス」で折れる。「・」で2行に分ける
            <>
              ミッション・
              <br />
              バトルパス
            </>
          }
          note={
            ready > 0
              ? `受け取れる褒美 ${ready}件`
              : passUnlocked
                ? "褒美を受け取る・マスを埋める"
                : "褒美を受け取る"
          }
          badge={ready}
          onClick={onMissions}
        />
        <HomeTile
          frameTheme={theme}
          tone="skins"
          icon={<Sparkle size={26} />}
          label="ガチャ・スキン"
          note="英雄を召喚する"
          onClick={onSkins}
        />
      </div>
      {shop && (
        <GemShop
          gems={collection.gems || 0}
          gemsPaid={collection.gemsPaid || 0}
          gemsFree={collection.gemsFree || 0}
          onClose={() => setShop(false)}
          onMessage={setShopMsg}
        />
      )}
    </div>
  );
}

/**
 * 対戦の相手を選ぶ。ホームの「対戦する」から来る。
 * ランダムマッチだけは、チュートリアルを第8話まで終えるまで開かない(src/game/online-gate.js)。
 * 閉じている間は薄くして理由と残りの話数を添え、押すとチュートリアル一覧へ
 */
export function MatchingScreen({
  onOnline,
  onFriend,
  onCpu,
  onBack,
  onTutorial,
  // 今シーズンの順位。ホームから移した(2026-09-17、本人の指示)
  onRanking = null,
}) {
  const gate = onlineGate(loadProfile());
  return (
    <div className="center-stage">
      <h2>対戦相手を選ぶ</h2>
      <div className="nav-stack">
        <button
          className={`btn btn-primary btn-choice ${gate.ok ? "" : "btn-choice-locked"}`}
          aria-disabled={!gate.ok}
          onClick={gate.ok ? onOnline : onTutorial}
        >
          <Globe size={30} />
          <span className="choice-label">
            オンラインでマッチする
            <small>
              {gate.ok ? "世界中のプレイヤーと対戦" : onlineGateLabel(gate)}
            </small>
          </span>
        </button>
        <button className="btn btn-friend btn-choice" onClick={onFriend}>
          <Users size={30} />
          <span className="choice-label">
            フレンドとマッチする<small>友達とルーム対戦</small>
          </span>
        </button>
        <button className="btn btn-teal btn-choice" onClick={onCpu}>
          <Crown size={30} />
          <span className="choice-label">
            CPUと対戦する<small>ひとりで練習・腕試し</small>
          </span>
        </button>
      </div>
      {onRanking && (
        <button className="home-quiet" onClick={onRanking} aria-label="ランキングを見る">
          <Crown size={18} /> ランキングを見る
        </button>
      )}
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={18} /> ホームに戻る
      </button>
    </div>
  );
}

/**
 * 相手が部屋に書いた名乗りは、こちらでは何も保証できない。
 * 物や桁外れの数がそのまま画面に届くと、描くところで落ちて真っ白になる。
 * 受け取る側で必ず通す
 */
/** 部屋の席から、自分でないほうの uid を取り出す */
function foeOf(seats, me) {
  const ids = Object.values(seats || {}).filter((id) => id && id !== me);
  return ids.length === 1 ? ids[0] : null;
}

function safeName(v) {
  return typeof v === "string" && v ? v.slice(0, 10) : null;
}
function safeTag(v) {
  return typeof v === "string" && v ? v.slice(0, 40) : null;
}
function safeRating(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(4000, Math.round(n))) : null;
}

export function RandomMatchScreen({ onBack, onRoomReady, boardSize, onBotReady = null }) {
  const loadout = useRef(mySkins()).current;
  // Bot の扱い(src/game/bot-match.js)。開いた時点で決めて、この画面のあいだ変えない
  const planRef = useRef(onBotReady ? botPlan(myRating()) : "none");
  let [l, n] = (0, useState)("searching"),
    [a, u] = (0, useState)(""),
    f = (0, useRef)(null),
    // 掲示に名乗った合言葉。降りるときに下ろす
    claimed = (0, useRef)(null),
    o = (0, useRef)(!1);
  return (
    (0, useEffect)(() => {
      if (l !== "waiting") return;
      // 掲示に名乗りが立っただけでは始めない。
      // 名乗りは席を取らなくても書けるので、それを合図にすると、
      // 名乗るだけ名乗って来ない相手に永久に待たされる。
      // 席についた相手が部屋へ書く guestPresent を合図にする
      let claimedAt = null;
      let r = setInterval(async () => {
        let d = f.current;
        if (!d) return;
        let g = await readRoom(d);
        if (o.current || !g.ok) return;
        if (!g.data || !g.data.guestPresent) {
          // 名乗りだけ立って席が埋まらないまま経ったら、その名乗りを外す。
          // 外せるのは掲示の持ち主(=自分)だけ
          let m = await readLobbyPath(`/${d}/guest`);
          if (o.current) return;
          if (m.ok && m.data) {
            if (claimedAt === null) claimedAt = Date.now();
            else if (Date.now() - claimedAt > 15e3) {
              (deleteLobbyPath(`/${d}/guest`), (claimedAt = null));
            }
          } else claimedAt = null;
          return;
        }
        {
          // 見えなくした相手(ランキングの「⋯」)が席に着いたら、この掲示は畳む。
          // 相手には理由を伝えない
          if (isBlocked(g.data.seats && g.data.seats.guest)) {
            clearInterval(r);
            deleteLobbyPath(`/${d}`);
            u("相手が見つかりませんでした。もう一度お探しください。");
            n("error");
            return;
          }
          if (
            !matchesOnlineSize(g.data, boardSize) ||
            g.data.guestMatchSize !== boardSize
          ) {
            clearInterval(r);
            deleteLobbyPath(`/${d}`);
            u(
              "対戦相手のルール設定を確認できませんでした。もう一度お探しください。",
            );
            n("error");
            return;
          }
          clearInterval(r);
          let s = d;
          (deleteLobbyPath(`/${d}`),
            onRoomReady({
              random: !0,
              code: s,
              createdAt: g.data.createdAt,
              myPlayerIndex: 0,
              foeUid: foeOf(g.data.seats, myUid()),
              ruleVersion: roomRuleVersion(g.data),
              names: [myName(), safeName(g.data.guestName)],
              icons: [myIcon(), safeTag(g.data.guestIcon)],
              titles: [myTitle(), safeTag(g.data.guestTitle)],
              ratings: [myRating(), safeRating(g.data.guestRating)],
              // 自分の装備は手元のものを使う。部屋の欄は相手も書けるので、
              // そこから読み直すと、持っていないスキンを着せられる
              skins: [loadout, sanitizeLoadout(g.data?.guestSkins)],
            }));
        }
      }, 1500);
      return () => clearInterval(r);
    }, [l]),
    (0, useEffect)(
      () => () => {
        ((o.current = !0),
          f.current && deleteLobbyPath(`/${f.current}`),
          // 名乗ったまま抜けると、待っている人を固めてしまう
          claimed.current &&
            (deleteLobbyPath(`/${claimed.current}/guest`),
            leaveRoom(claimed.current)));
      },
      [],
    ),
    (0, useEffect)(() => {
      // レートが 1750 に届くまでの練習相手(Bot、src/game/bot-match.js)。
      //   直前に人に負けていたら、探さずに数秒「探しています」を見せてから Bot。
      //   それ以外はまず人を探し、BOT_WAIT_MS 経っても組めなければ Bot に切り替える
      //   (画面を離れるときの後片付けが掲示と部屋を消す)
      const plan = planRef.current;
      if (plan === "now") {
        const bot = makeBot(myRating(), myName());
        const timer = setTimeout(() => {
          if (!o.current) onBotReady(bot);
        }, botSearchDelay());
        return () => {
          o.current = !0;
          clearTimeout(timer);
        };
      }
      const fallback =
        plan === "fallback"
          ? setTimeout(() => {
              if (o.current) return;
              o.current = !0;
              onBotReady(makeBot(myRating(), myName()));
            }, BOT_WAIT_MS)
          : null;
      (async () => {
        // 待ち合わせの掲示は uid で名乗る。ルール側が「持ち主だけが動かせる」
        // ようにしてあるので、端末ごとの仮のidでは掲示できない
        let auth = await ensureAuth();
        if (o.current) return;
        if (!auth) {
          (u(
            "サインインできませんでした。通信状況を確認して、もう一度お試しください。",
          ),
            n("error"));
          return;
        }
        let r = auth.uid,
          d = await readLobby();
        if (o.current) return;
        if (!d.ok) {
          (u(d.error), n("error"));
          return;
        }
        let m = Date.now(),
          all = Object.entries(d.data || {}),
          // 時間切れの掲載は誰も拾えない。見つけたついでに片付ける。
          // 部屋には手番の列がまるごと入っているので、残したままにしない
          // 未来の日付を入れた掲示は、いつまでも「新しい」ままになる。
          // 先の日付も古いものと同じく片付ける
          stale = all.filter(
            ([, g]) =>
              !g ||
              m - (g.createdAt || 0) >= LOBBY_TTL ||
              (g.createdAt || 0) > m + 60e3,
          );
        for (let [z] of stale) {
          deleteLobbyPath(`/${z}`);
          deleteRoom(z);
        }
        let s = all
          .filter(
            ([z, g]) =>
              g &&
              matchesOnlineSize(g, boardSize) &&
              !g.guest &&
              g.host !== r &&
              // 見えなくした相手の掲示は拾わない(ランキングの「⋯」)
              !isBlocked(g.host) &&
              m - (g.createdAt || 0) < LOBBY_TTL &&
              (g.createdAt || 0) <= m + 60e3,
          )
          // 偽の掲示を撒かれても、往復に付き合うのは先頭の数件までにする
          .slice(0, 6)
          .sort((z, g) => (g[1].createdAt || 0) - (z[1].createdAt || 0));
        for (let [z] of s) {
          // 先に掲示へ名乗る。ランダムマッチの部屋の席は「掲示で名乗った人」
          // にしか開かないので、この順でないと座れない。
          // 名乗りは自分で下ろせるので、途中で降りても持ち主を固めない
          let g = await writeLobby(`/${z}/guest`, r);
          if (o.current) return;
          if (!g.ok) continue;
          claimed.current = z;
          let A = await readLobbyPath(`/${z}/guest`);
          if (o.current) return;
          if (!A.ok || A.data !== r) {
            // 掲示は他の人に取られた
            claimed.current = null;
            continue;
          }
          let seat = await joinRoom(z);
          if (o.current) return;
          if (!seat.ok) {
            (await deleteLobbyPath(`/${z}/guest`), (claimed.current = null));
            continue;
          }
          {
            let b = await readRoom(z);
            if (o.current) return;
            if (!b.ok) {
              (await leaveRoom(z),
                await deleteLobbyPath(`/${z}/guest`),
                (claimed.current = null),
                u(b.error),
                n("error"));
              return;
            }
            if (!matchesOnlineSize(b.data, boardSize)) {
              await leaveRoom(z);
              await deleteLobbyPath(`/${z}/guest`);
              claimed.current = null;
              continue;
            }
            const ready = await updateRoom(z, {
              guestPresent: !0,
              guestName: myName(),
              guestIcon: myIcon(),
              guestTitle: myTitle(),
              guestRating: myRating(),
              guestSkins: loadout,
              guestRuleVersion: GAME_RULE_VERSION,
              guestMatchSize: boardSize,
            });
            if (o.current) return;
            if (!ready.ok) {
              await leaveRoom(z);
              await deleteLobbyPath(`/${z}/guest`);
              claimed.current = null;
              u(ready.error);
              n("error");
              return;
            }
            claimed.current = null;
            onRoomReady({
              random: !0,
              code: z,
              createdAt: b.data?.createdAt,
              myPlayerIndex: 1,
              foeUid: foeOf(b.data && b.data.seats, myUid()),
              ruleVersion: roomRuleVersion({
                ...b.data,
                guestRuleVersion: GAME_RULE_VERSION,
              }),
              names: [safeName(b.data && b.data.hostName), myName()],
              icons: [safeTag(b.data && b.data.hostIcon), myIcon()],
              titles: [safeTag(b.data && b.data.hostTitle), myTitle()],
              ratings: [safeRating(b.data && b.data.hostRating), myRating()],
              skins: [sanitizeLoadout(b.data?.hostSkins), loadout],
            });
            return;
          }
        }
        let v = generateRoomCode() + generateRoomCode(),
          p = await createRoom(v, {
            matchSize: boardSize,
            guestPresent: !1,
            gameState: null,
            hostName: myName(),
            hostIcon: myIcon(),
            hostTitle: myTitle(),
            hostRating: myRating(),
            hostSkins: loadout,
            hostRuleVersion: GAME_RULE_VERSION,
          });
        if (o.current) return;
        if (!p.ok) {
          (u(p.error), n("error"));
          return;
        }
        let w = await writeLobby(`/${v}`, {
          matchSize: boardSize,
          host: r,
          guest: null,
          createdAt: Date.now(),
        });
        if (!o.current) {
          if (!w.ok) {
            (u(w.error), n("error"));
            return;
          }
          ((f.current = v), n("waiting"));
        }
      })();
      return () => {
        if (fallback) clearTimeout(fallback);
      };
    }, []),
    // 人を探せなかった(通信が無いなど)ときも、Bot に切り替える予約があるなら
    // 「探しています」のまま待つ。誤りの画面を数秒見せてから対局が始まるのを避ける
    l === "error" && planRef.current !== "fallback" ? (
      <div className="center-stage">
        <h2>マッチングできませんでした</h2>
        <p
          className="hint"
          style={{
            color: "#e2896f",
          }}
        >
          {a}
        </p>
        <button className="btn btn-ghost" onClick={onBack}>
          対戦相手を選ぶに戻る
        </button>
      </div>
    ) : (
      <div className="center-stage">
        <Dice size={32} className="dim-icon spin-icon" />
        <h2>
          {l === "searching"
            ? "対戦相手を探しています…"
            : "対戦相手を待っています…"}
        </h2>
        <p className="hint">
          {l === "searching"
            ? "待機中のプレイヤーがいないか確認しています。"
            : "あなたは待機中です。誰かが参加すると自動的に始まります。"}
        </p>
        <button
          className="btn btn-ghost"
          style={{
            marginTop: 18,
          }}
          onClick={onBack}
        >
          やめる
        </button>
      </div>
    )
  );
}
/**
 * 詳細設定の中身(src/game/custom-rules.js)。
 * 使う札のオン/オフ(駒と手札の数が連動)・エリアを立てる側・対局開始時に公開する駒
 */
function CustomRulesPanel({ custom, size, onChange }) {
  const army = armySizeFor(size, custom.ranks.length);
  const hand = handSizeFor(size, custom.ranks.length);
  const set = (patch) => onChange({ ...custom, ...patch });
  const maxReveal = Math.max(0, army - 1);
  return (
    <div className="custom-rules" role="group" aria-label="詳細設定">
      <div className="custom-row">
        <div className="rule-section-label">使う札</div>
        <div className="rank-toggles">
          {RANKS.map((rank) => {
            const on = custom.ranks.includes(rank);
            const next = toggleRank(custom.ranks, rank);
            return (
              <button
                key={rank}
                className={`rank-toggle ${on ? "active" : ""}`}
                aria-pressed={on}
                disabled={on && !next}
                title={on && !next ? "これ以上は減らせません(4種類以上・数字の札2種類以上)" : ""}
                onClick={() => next && set({ ranks: next })}
              >
                {rank}
              </button>
            );
          })}
        </div>
        <p className="hint">
          <b>札 {custom.ranks.length * 4}枚</b> → 盤に置く駒 <b>{army}枚</b>・手札 <b>{hand}枚</b>
          <br />
          4種類以上、J・Q・K 以外を2種類以上。駒は3枚を下回りません。
        </p>
      </div>
      {size === 9 && (
        <div className="custom-row">
          <div className="rule-section-label">盤面エリア</div>
          <div className="area-choices">
            {CUSTOM_AREA_SIDES.map((side) => (
              <button
                key={side}
                className={`area-choice ${custom.areas === side ? "active" : ""}`}
                aria-pressed={custom.areas === side}
                onClick={() => set({ areas: side })}
              >
                <b>{AREA_SIDE_LABEL[side]}</b>
                <small>
                  {side === "both"
                    ? "王のフォイルがあれば、どちらも立つ"
                    : side === "host"
                      ? "自分(ルームを作る側・先手の席)だけ"
                      : side === "guest"
                        ? "相手だけ。自分は立てない"
                        : "どちらも立てない素の対局"}
                </small>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="custom-row">
        <div className="rule-section-label">対局開始時に公開する駒</div>
        <label className="custom-field">
          公開する枚数(王を除く)
          <select
            aria-label="公開する枚数"
            value={Math.min(custom.reveal.count, maxReveal)}
            onChange={(e) => {
              const count = Number(e.target.value) || 0;
              set({ reveal: { ...custom.reveal, count, choose: count > 0 && custom.reveal.choose } });
            }}
          >
            {Array.from({ length: maxReveal + 1 }, (_, n) => (
              <option key={n} value={n}>
                {n === 0 ? "公開しない" : `${n}枚`}
              </option>
            ))}
          </select>
        </label>
        <label className="custom-field">
          <input
            type="checkbox"
            checked={custom.reveal.king}
            onChange={(e) => set({ reveal: { ...custom.reveal, king: e.target.checked } })}
          />
          王も公開する
        </label>
        {custom.reveal.count > 0 && (
          <div className="area-choices">
            <button
              className={`area-choice ${!custom.reveal.choose ? "active" : ""}`}
              aria-pressed={!custom.reveal.choose}
              onClick={() => set({ reveal: { ...custom.reveal, choose: false } })}
            >
              <b>ランダム</b>
              <small>王を除いた駒から自動で選ばれる</small>
            </button>
            <button
              className={`area-choice ${custom.reveal.choose ? "active" : ""}`}
              aria-pressed={custom.reveal.choose}
              onClick={() => set({ reveal: { ...custom.reveal, choose: true } })}
            >
              <b>自分で選ぶ</b>
              <small>布陣を確定するときに、公開する駒を自分で選ぶ</small>
            </button>
          </div>
        )}
      </div>
      <p className="hint">
        始める側の設定が使われます(CPU戦は自分、ルームは作る側、近くの端末はタップされた側)。
        <br />
        レートは動きません。
      </p>
    </div>
  );
}

export function RulesSelectScreen({
  onStart,
  onBack,
  backLabel,
  note,
  initialSize = 5,
  ranked = false,
  // CPU戦で、相手のエリア(定石)を選べるとき。null なら出さない
  cpuArea = null,
  onCpuArea = null,
  // 手元の対局のときの自分のレベル。札と 9×9 をレベルで絞る。null なら絞らない(オンライン)
  level = null,
  // 詳細設定(src/game/custom-rules.js)。onCustom が無い画面(ランダムマッチ)では出さない
  custom = null,
  onCustom = null,
}) {
  const locked9 = level !== null && !boardOpen(9, level);
  let [a, u] = (0, useState)(locked9 && initialSize === 9 ? 5 : initialSize);
  // 詳細設定はフォイルを持ってエリアを解放した人だけ(本人の指示 2026-09-17)
  const customUnlocked = !!onCustom && foilRevealed(getCollection());
  const [customOpen, setCustomOpen] = useState(!!custom && !isDefaultCustom(custom));
  return (
    <div className="setup-wrap">
      <h2>ルール設定</h2>
      <div className="rule-section">
        <div className="rule-section-label">ルール</div>
        <div className="nav-stack">
          <button
            className={`btn btn-choice ${!custom || isDefaultCustom(custom) ? "btn-primary" : "btn-ghost"}`}
            aria-pressed={!custom || isDefaultCustom(custom)}
            onClick={() => {
              if (onCustom) onCustom(null);
              setCustomOpen(false);
            }}
          >
            <Check size={18} />
            <span className="choice-label">
              クラシック<small>基本ルールで対戦します</small>
            </span>
          </button>
          {onCustom &&
            (customUnlocked ? (
              <button
                className={`btn btn-choice ${custom && !isDefaultCustom(custom) ? "btn-primary" : "btn-ghost"}`}
                aria-pressed={!!custom && !isDefaultCustom(custom)}
                aria-expanded={customOpen}
                onClick={() => {
                  if (!custom) onCustom(DEFAULT_CUSTOM);
                  setCustomOpen(true);
                }}
              >
                <Settings size={18} />
                <span className="choice-label">
                  詳細設定
                  <small>{custom ? customSummary(normalizeCustom(custom, a), a) : "使う札・エリア・公開する駒を決める"}</small>
                </span>
              </button>
            ) : (
              <button className="btn btn-ghost btn-choice" disabled>
                <Lock size={18} />
                <span className="choice-label">
                  詳細設定<small>フォイルを手に入れてエリアを解放すると使えます</small>
                </span>
              </button>
            ))}
        </div>
        {onCustom && customUnlocked && customOpen && (
          <CustomRulesPanel
            custom={normalizeCustom(custom || DEFAULT_CUSTOM, a)}
            size={a}
            onChange={onCustom}
          />
        )}
      </div>
      <div className="rule-section">
        <div className="rule-section-label">盤面のサイズ</div>
        <div className="size-choices">
          {[5, 9].map((i) => (
            <button
              className={`board-choice ${a === i ? "active" : ""}`}
              onClick={() => u(i)}
              aria-pressed={a === i}
              disabled={i === 9 && locked9}
              key={i}
            >
              <div
                className="board-choice-grid"
                style={{
                  gridTemplateColumns: `repeat(${i},1fr)`,
                }}
              >
                {Array.from({
                  length: i * i,
                }).map((f, o) => (
                  <span key={o} />
                ))}
              </div>
              <span>
                {i}×{i}
              </span>
              <small>
                {i === 5 ? "5枚で戦う短期戦" : foilRevealed(getCollection()) ? "9枚で戦う本格戦。王のフォイルで盤面エリアが立つ" : "9枚で戦う本格戦"}
                {/* レートが動くのは9×9だけ。選ぶ前に分かるようにしておく */}
                {ranked && i === 9 && (
                  <>
                    <br />
                    <b className="board-choice-ranked">ランキングに載ります</b>
                  </>
                )}
                {i === 9 && locked9 && (
                  <>
                    <br />
                    <b className="board-choice-lock">Lv{BOARD9_LEVEL} で開きます</b>
                  </>
                )}
              </small>
            </button>
          ))}
        </div>
        {level !== null && (
          <p className="hint card-unlock-hint">{cardUnlockText(level)}</p>
        )}
      </div>
      {onCpuArea && a === 9 && (
        <div className="rule-section">
          <div className="rule-section-label">CPUのエリア</div>
          <p className="hint">
            相手のエリアを決めて、そのエリアの定石と戦う練習ができます。おまかせでは相手が手札から王を選びます。
          </p>
          <div className="area-choices">
            <button
              className={`area-choice ${cpuArea === null ? "active" : ""}`}
              aria-pressed={cpuArea === null}
              onClick={() => onCpuArea(null)}
            >
              <b>おまかせ</b>
              <small>相手が手札から王を選ぶ</small>
            </button>
            <button
              className={`area-choice ${cpuArea === "none" ? "active" : ""}`}
              aria-pressed={cpuArea === "none"}
              onClick={() => onCpuArea("none")}
            >
              <b>エリアなし</b>
              <small>相手だけ盤面エリアなし。自分のエリアは装備どおり</small>
            </button>
            {JOSEKI_AREAS.map((type) => (
              <button
                key={type}
                className={`area-choice area-choice-${type} ${cpuArea === type ? "active" : ""}`}
                aria-pressed={cpuArea === type}
                onClick={() => onCpuArea(type)}
              >
                <b>
                  {JOSEKI_INFO[type].label}
                  <span className="area-choice-style">
                    {JOSEKI_INFO[type].style}
                  </span>
                </b>
                <small>{JOSEKI_INFO[type].text}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* フォイルは持っているが札を絞っているレベル: エリア練習は定石の札がそろってから */}
      {!onCpuArea &&
        a === 9 &&
        level !== null &&
        poolForLevel(level) &&
        foilRevealed(getCollection()) && (
          <p className="hint">
            CPUのエリアを選ぶ練習は、すべての札が開く Lv{ALL_CARDS_LEVEL} からです。
          </p>
        )}
      {note && <p className="hint">{note}</p>}
      <div className="setup-actions">
        <button className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={18} /> {backLabel}
        </button>
        <button className="btn btn-primary" onClick={() => onStart(a)}>
          <Play size={16} /> ゲームを始める
        </button>
      </div>
    </div>
  );
}
/**
 * 近くの端末と対戦(Bluetooth / 近距離 Wi‑Fi、インターネット不要。src/net/nearby.js)。
 * 両端末がこの画面を開くと互いに見つかり、どちらかが相手をタップすると対局へ。
 * タップした側がゲスト(後手の席)、された側がホスト(先手の席・盤の大きさはこちらの設定)。
 * レート・シーズン・オンラインの回数には数えない
 */
export function NearbyScreen({ boardSize, onReady, onBack }) {
  const loadout = useRef(mySkins()).current;
  const [peers, setPeers] = useState([]);
  const [status, setStatus] = useState("searching");
  const [error, setError] = useState("");
  const readyRef = useRef(!1);
  useEffect(() => {
    const n = nearby();
    let gone = !1;
    const offPeers = n.onPeers((list) => !gone && setPeers(list));
    const offState = n.onState((e) => {
      if (gone) return;
      if (e.state === "connected") setStatus("connecting");
      else if (e.state === "ready") setStatus("ready");
      else if (e.state === "disconnected" && !readyRef.current) {
        setStatus("searching");
        setError("つながりませんでした。もう一度相手をタップしてください");
        // 探索をやり直す
        n.start(profile(), ready).catch((err) => setError(err.message));
      }
    });
    const profile = () => ({
      name: myName() || "名無し",
      icon: myIcon(),
      title: myTitle(),
      skins: loadout,
      ruleVersion: GAME_RULE_VERSION,
      boardSize,
    });
    const ready = (network) => {
      readyRef.current = !0;
      onReady({
        ...network,
        names: network.names.map(safeName),
        icons: network.icons.map(safeTag),
        titles: network.titles.map(safeTag),
        skins: network.skins.map(sanitizeLoadout),
        ruleVersion: roomRuleVersion({
          hostRuleVersion: network.hostRuleVersion,
          guestRuleVersion: network.guestRuleVersion,
        }),
      });
    };
    n.start(profile(), ready).catch((err) =>
      setError(err && err.message ? err.message : "近くの端末との接続を始められませんでした"),
    );
    return () => {
      gone = !0;
      offPeers();
      offState();
      // 対局へ進んだときは切らない(部屋の写しを使い続ける)
      if (!readyRef.current) n.stop();
    };
  }, []);
  return (
    <div className="setup-wrap friend-wrap">
      <div className="friend-head">
        <Nearby size={44} style={{ color: "var(--gold)" }} />
        <h2 style={{ margin: "10px 0 8px" }}>近くの端末と対戦</h2>
        <p className="hint" style={{ margin: 0 }}>
          相手の端末でもこの画面を開いてください。
          <br />
          見つかった相手をタップすると始まります。インターネットは要りません。
        </p>
      </div>
      <div className="conn-badge conn-checking">
        <span className="conn-dot" />
        {status === "searching"
          ? `${myName() || "あなた"} として近くを探しています…`
          : status === "connecting"
            ? "つながりました。準備しています…"
            : "対局へ進みます"}
      </div>
      <div className="nearby-list" role="list" aria-label="近くの端末">
        {peers.length === 0 ? (
          <p className="hint">
            まだ見つかりません。相手の端末でも同じ画面を開いてください。
            <br />
            Bluetooth と Wi‑Fi をオンに(機内モード中でも、コントロールセンターから両方をオンにできます)。
          </p>
        ) : (
          peers.map((p) => (
            <button
              key={p.id}
              className="btn btn-primary btn-wide nearby-peer"
              role="listitem"
              disabled={status !== "searching"}
              onClick={() => {
                setError("");
                setStatus("connecting");
                nearby()
                  .invite(p.id)
                  .catch((err) => {
                    setStatus("searching");
                    setError(err && err.message ? err.message : "招待できませんでした");
                  });
              }}
            >
              <Users size={18} /> {safeName(p.name)} と対戦する
            </button>
          ))
        )}
      </div>
      {error && (
        <p className="hint" style={{ color: "#e08b7a" }}>
          {error}
        </p>
      )}
      <p className="code-note">
        <Info size={14} /> 盤の大きさは、タップされた側(先手)の設定になります。レートは動きません。
      </p>
      <button className="btn btn-ghost btn-wide" style={{ marginTop: 12 }} onClick={onBack}>
        <ArrowLeft size={18} /> フレンド対戦に戻る
      </button>
    </div>
  );
}

export function RoomScreen({
  onOfflineLocal,
  onRoomReady,
  onBackToMatching,
  onBeforeRoom,
  autoCreate,
  // 近くの端末と対戦(Bluetooth / 近距離 Wi‑Fi)。iOS アプリだけ
  onNearby = null,
  // リンク(?room=ABCDEF)から開いたときの合言葉。通信が通ったら自動で参加する(使ったら onCodeUsed で捨てる)
  initialCode = "",
  onCodeUsed = null,
  // フレンドを招待して作る部屋(2026-09-23)。できた合言葉を onRoomCreated で相手に届ける
  inviteName = "",
  onRoomCreated = null,
}) {
  const loadout = useRef(mySkins()).current;
  // 「コピーしました」などの短い知らせ
  const [notice, setNotice] = useState("");
  let [u, i] = (0, useState)(null),
    [f, o] = (0, useState)(""),
    [r, d] = (0, useState)(""),
    [m, s] = (0, useState)(""),
    [v, p] = (0, useState)(!1),
    [w, z] = (0, useState)("checking"),
    [g, A] = (0, useState)("");
  (0, useEffect)(() => {
    let P = !1;
    return (
      (async () => {
        let x = `diag${Date.now()}`,
          N = await createRoom(x, {});
        if (P) return;
        if (!N.ok) {
          (z("fail"), A(N.error));
          return;
        }
        let M = await readRoom(x);
        if (!P) {
          if (!M.ok) {
            (z("fail"), A(M.error));
            return;
          }
          (deleteRoom(x), z("ok"));
        }
      })(),
      () => {
        P = !0;
      }
    );
  }, []);
  let b = (0, useRef)(!1);
  // リンクから開いた合言葉は、通信が通ったら一度だけ自動で参加する
  const joined = (0, useRef)(!1);
  ((0, useEffect)(() => {
    if (!initialCode || joined.current || w !== "ok") return;
    joined.current = !0;
    d(initialCode);
    if (onCodeUsed) onCodeUsed();
    T(initialCode);
  }, [initialCode, w]),
  (0, useEffect)(() => {
    !autoCreate || b.current || w !== "ok" || ((b.current = !0), y());
  }, [autoCreate, w]),
    (0, useEffect)(() => {
      if (u !== "waitingHost") return;
      let P = !1,
        x = setInterval(async () => {
          let N = await readRoom(f);
          if (!P) {
            if (!N.ok) {
              s(N.error);
              return;
            }
            N.data &&
              N.data.guestPresent &&
              (clearInterval(x),
              onRoomReady({
                code: f,
                createdAt: N.data.createdAt,
                myPlayerIndex: 0,
                foeUid: foeOf(N.data.seats, myUid()),
                ruleVersion: roomRuleVersion(N.data),
                names: [myName(), safeName(N.data.guestName)],
                icons: [myIcon(), safeTag(N.data.guestIcon)],
                titles: [myTitle(), safeTag(N.data.guestTitle)],
                ratings: [myRating(), safeRating(N.data.guestRating)],
                skins: [loadout, sanitizeLoadout(N.data.guestSkins)],
              }));
          }
        }, 1200);
      return () => {
        ((P = !0), clearInterval(x));
      };
    }, [u, f]));
  async function y() {
    (p(!0), s(""));
    // 合言葉そのものが鍵になる。4文字(約100万通り)では総当たりで
    // 待機中の部屋に入り込まれ、伏せた王まで見えてしまう
    // 6文字(約10億通り)。伝えやすさと総当たりされにくさの折り合い(src/net/room-code.js)
    let P = generateFriendCode(),
      x = await createRoom(P, {
        guestPresent: !1,
        gameState: null,
        hostName: myName(),
        hostIcon: myIcon(),
        hostTitle: myTitle(),
        hostRating: myRating(),
        hostSkins: loadout,
        hostRuleVersion: GAME_RULE_VERSION,
      });
    if ((p(!1), !x.ok)) {
      s(x.error);
      return;
    }
    (o(P), i("waitingHost"));
    if (onRoomCreated) onRoomCreated(P);
  }
  async function T(given = null) {
    let P = cleanRoomCode(given || r);
    if (P.length < ROOM_CODE_LENGTH) {
      s(`${ROOM_CODE_LENGTH}文字の合言葉を入力してください`);
      return;
    }
    (p(!0), s(""));
    // 先に席をとる。部屋の中身は席についてからでないと読めない。
    // 断られたら、その合言葉の部屋が無いか、もう二人そろっている
    let seat = await joinRoom(P);
    if (!seat.ok) {
      (p(!1),
        s("そのコードのルームは見つからないか、既に対戦相手が参加しています"));
      return;
    }
    let x = await readRoom(P);
    if (!x.ok) {
      (await leaveRoom(P), p(!1), s(x.error));
      return;
    }
    // 席をとれたからといって部屋があるとは限らない(締める前のルールでは
    // 存在しない部屋にも座れてしまう)。中身を見て確かめる
    if (!x.data || (!x.data.createdAt && !x.data.hostName)) {
      (await leaveRoom(P),
        p(!1),
        s("そのコードのルームは見つかりませんでした"));
      return;
    }
    if (x.data.guestPresent) {
      (await leaveRoom(P), p(!1), s("このルームは既に対戦相手が参加済みです"));
      return;
    }
    let N = await updateRoom(P, {
      guestPresent: !0,
      guestName: myName(),
      guestIcon: myIcon(),
      guestTitle: myTitle(),
      guestRating: myRating(),
      guestSkins: loadout,
      guestRuleVersion: GAME_RULE_VERSION,
    });
    if ((p(!1), !N.ok)) {
      (await leaveRoom(P), s(N.error));
      return;
    }
    onRoomReady({
      code: P,
      createdAt: x.data.createdAt,
      foeUid: foeOf(x.data.seats, myUid()),
      names: [safeName(x.data.hostName), myName()],
      icons: [safeTag(x.data.hostIcon), myIcon()],
      titles: [safeTag(x.data.hostTitle), myTitle()],
      ratings: [safeRating(x.data.hostRating), myRating()],
      skins: [sanitizeLoadout(x.data.hostSkins), loadout],
      myPlayerIndex: 1,
      ruleVersion: roomRuleVersion({
        ...x.data,
        guestRuleVersion: GAME_RULE_VERSION,
      }),
    });
  }
  function R() {
    (f && deleteRoom(f), o(""), s(""), i(null));
  }
  const link = () => roomLink(f, SEASON_API_ORIGIN);
  async function copyText(text, done) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(done);
    } catch {
      setNotice("コピーできませんでした。合言葉を読み上げて伝えてください");
    }
  }
  /** リンクを共有(共有シートがあればそれ、無ければコピー) */
  async function shareLink() {
    const text = `トッタリーでフレンド対戦しよう。合言葉 ${formatRoomCode(f)}\n${link()}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "トッタリー フレンド対戦", text, url: link() });
        return;
      } catch {
        /* 閉じた・使えない → コピーへ */
      }
    }
    copyText(text, "リンクをコピーしました。LINE などに貼って送ってください");
  }
  /** 貼り付けて参加: クリップボードのリンクや「ABC-DEF」から合言葉を読む */
  async function pasteJoin() {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      s("貼り付けが許可されませんでした。合言葉を入力してください");
      return;
    }
    const code = parseRoomCode(text);
    if (!code) {
      s("貼り付けた内容に合言葉が見つかりませんでした");
      return;
    }
    d(code);
    T(code);
  }
  return u === "waitingHost" ? (
    <div className="center-stage">
      <Users size={28} className="dim-icon" />
      <h2>ルームを作成しました</h2>
      <div className="room-code" aria-label={`合言葉 ${f}`}>{formatRoomCode(f)}</div>
      {inviteName ? (
        <p className="hint">
          <b>{inviteName}</b> に招待を届けました。相手がフレンドの画面で「参加する」を押すと自動的に始まります。
          合言葉やリンクを直接送っても入れます。
        </p>
      ) : (
        <p className="hint">
          この合言葉を相手に伝えるか、リンクを送ってください。相手が参加すると自動的に始まります。
        </p>
      )}
      <div className="share-row">
        <button className="btn btn-primary" onClick={shareLink}>
          <Mail size={16} /> リンクを共有
        </button>
        <button className="btn btn-ghost" onClick={() => copyText(formatRoomCode(f), "合言葉をコピーしました")}>
          合言葉をコピー
        </button>
      </div>
      {notice && (
        <p className="hint" role="status">
          {notice}
        </p>
      )}
      <Dice size={22} className="dim-icon spin-icon" />
      {m && (
        <p
          className="hint"
          style={{
            color: "#e2896f",
          }}
        >
          {m}
        </p>
      )}
      <div
        className="nav-stack"
        style={{
          marginTop: 20,
        }}
      >
        <button className="btn btn-ghost" onClick={R}>
          ルームを取り消す
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            (R(), onBackToMatching());
          }}
        >
          対戦相手を選ぶに戻る
        </button>
      </div>
    </div>
  ) : (
    <div className="setup-wrap friend-wrap">
      <div className="friend-head">
        <Users
          size={44}
          style={{
            color: "var(--gold)",
          }}
        />
        <h2
          style={{
            margin: "10px 0 8px",
          }}
        >
          フレンド対戦
        </h2>
        <p
          className="hint"
          style={{
            margin: 0,
          }}
        >
          ルームを作って相手にリンクか合言葉を送るか、
          <br />
          届いたリンクや合言葉で参加します。
        </p>
      </div>
      <div className={`conn-badge conn-${w}`}>
        <span className="conn-dot" />
        接続状態:
        {w === "ok"
          ? "オンライン"
          : w === "checking"
            ? "確認中…"
            : "利用できません"}
      </div>
      {w === "fail" && (
        <p
          className="hint"
          style={{
            color: "#e08b7a",
          }}
        >
          {g}
        </p>
      )}
      <button
        className="btn btn-primary btn-wide"
        disabled={v || w !== "ok"}
        onClick={onBeforeRoom}
      >
        <DoorOut size={22} /> ルームを作る
      </button>
      <div className="code-row">
        <div
          className="code-boxes"
          onClick={() => {
            let P = document.getElementById("code-input");
            P && P.focus();
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((P) => (
            <div
              className={`code-box ${r.length === P ? "code-box-active" : ""} ${P === 3 ? "code-box-gap" : ""}`}
              key={P}
            >
              {r[P] || <span className="code-placeholder">—</span>}
            </div>
          ))}
          <input
            id="code-input"
            className="code-hidden"
            value={r}
            maxLength={ROOM_CODE_LENGTH + 3}
            onChange={(P) => d(cleanRoomCode(P.target.value))}
            onPaste={(P) => {
              // リンクや「ABC-DEF」を貼ったら合言葉だけ取り出す
              const code = parseRoomCode(P.clipboardData?.getData("text"));
              if (code) {
                P.preventDefault();
                d(code);
              }
            }}
            inputMode="text"
            autoComplete="off"
          />
        </div>
        <button
          className="btn btn-ghost code-join"
          disabled={v || w !== "ok"}
          onClick={() => T()}
        >
          <DoorIn size={18} /> {v ? "参加中…" : "参加する"}
        </button>
        <button
          className="btn btn-ghost code-join"
          disabled={v || w !== "ok"}
          onClick={pasteJoin}
        >
          貼り付けて参加
        </button>
      </div>
      <p className="code-note">
        <Info size={14} />
        <span>合言葉は{ROOM_CODE_LENGTH}文字(ABC-DEF)。リンクを開けば入力はいりません。</span>
      </p>
      {m && (
        <p
          className="hint"
          style={{
            color: "#e08b7a",
          }}
        >
          {m}
        </p>
      )}
      {onNearby && nearbyAvailable() && (
        <button className="btn btn-teal btn-wide" onClick={onNearby}>
          <Nearby size={20} /> 近くの端末と対戦(通信不要)
        </button>
      )}
      <button
        className="btn btn-teal btn-wide"
        style={{ marginTop: 12 }}
        onClick={onOfflineLocal}
      >
        <Users size={20} /> オフラインで対戦(1台で2人)
      </button>
      <button
        className="btn btn-ghost btn-wide"
        style={{
          marginTop: 12,
        }}
        onClick={onBackToMatching}
      >
        <ArrowLeft size={18} /> 対戦相手を選ぶに戻る
      </button>
    </div>
  );
}
export function TotteryApp() {
  // 獲得時はホームのレベル欄も新しい経験値へ更新する。
  useSyncExternalStore(subscribeXpNotices, getXpNotices, getXpNotices);
  return (
    <>
      <TotteryScreens />
      <XpGainToast />
      <TitleAcquisition />
      <ProfileSyncNotice />
    </>
  );
}

function TotteryScreens() {
  const collection = useCollection();
  const [cpuSkins, setCpuSkins] = useState({});
  // ガチャ・スキンを開いたときの戻り先と、最初に出すタブ(ショップから来たら「加工」など)
  const [skinsFrom, setSkinsFrom] = useState("menu");
  const [skinsTab, setSkinsTab] = useState("gacha");
  // CPU戦で選んだ相手のエリア({ type, king })。null なら相手が手札から王を選ぶ
  const [cpuArea, setCpuArea] = useState(null);
  // CPU の装備からフォイルを外す(「エリアなし」用。フォイルの王でしかエリアは立たない)
  const stripFoils = (loadout) =>
    Object.fromEntries(Object.entries(loadout || {}).map(([rank, id]) => [rank, baseSkinId(id)]));
  // ランダムマッチの練習相手(Bot)。レート 1750 未満のあいだ、人の代わりに当たる。中身は CPU(強さ3段階)
  const [bot, setBot] = useState(null);
  // はじめて遊ぶときは、まず名前を決めてもらう
  let [named, setNamed] = (0, useState)(() => hasName()),
    [e, t] = (0, useState)("home"),
    [l, n] = (0, useState)(!1),
    [a, u] = (0, useState)(null),
    [i, f] = (0, useState)(5),
    [o, r] = (0, useState)("game"),
    [d, m] = (0, useState)(!1),
    [tut, setTut] = (0, useState)(null),
    // ルール設定を開いた元の画面。「戻る」はここへ帰る。
    // 対戦の種類(o)から推測すると、CPU対戦とルームの「オフラインで対戦」が
    // どちらも "game" なので見分けられず、CPUの戻り先がフレンド対戦になる
    [rulesFrom, setRulesFrom] = (0, useState)("matching"),
    // 同じ部屋で何局目か。再戦のたびに1つ進める
    [round, setRound] = (0, useState)(0),
    // 運営に使用停止にされたかどうか
    [banned, setBanned] = (0, useState)(!1),
    // 名前を決めた直後に一度だけ出す、第1話への案内
    [offerTutorial, setOfferTutorial] = (0, useState)(!1),
    // 詳細設定(src/game/custom-rules.js)。端末に覚える。null ならクラシック
    [customRules, setCustomRules] = (0, useState)(() => loadCustomRules()),
    // リンク(?room=ABCDEF)から開いたときの合言葉。名前を決めたらフレンド対戦の画面へ
    [pendingRoom, setPendingRoom] = (0, useState)(() => roomFromLocation()),
    // フレンド(2026-09-23)。開いているプロフィールの uid(null なら自分)と戻り先、招待の相手
    [profileUid, setProfileUid] = (0, useState)(null),
    [profileFrom, setProfileFrom] = (0, useState)("menu"),
    [inviteTo, setInviteTo] = (0, useState)(null);
  // フレンドを対戦に招待する: ルールを決めて部屋を作り、できた合言葉を相手に届ける(RoomScreen の onRoomCreated)
  function inviteToRoom(friend) {
    (setInviteTo(friend), setPendingRoom(""), u(null), m(!1), r("room"), setRulesFrom("room"), t("rules"));
  }
  // 届いた招待に乗る: リンクから開いたときと同じ道(合言葉で自動参加)
  function joinInvite(code) {
    (setInviteTo(null), setPendingRoom(code), u(null), m(!1), t("room"));
  }
  useEffect(() => {
    if (named && pendingRoom) t("room");
  }, [named, pendingRoom]);
  // 場面に合った曲へ。対局中は GameCore のほうが決めるので、ここは触らない
  useScreenBgm(e);
  // 起動時に、登録した人の台帳へ自分を置き直す。使用停止なら名前を捨てる
  useEffect(() => {
    let gone = false;
    (async () => {
      // 先に Firebase のサインインを通す。サーバーの記録は uid を鍵に持つので、
      // 名前がまだ無い人でもここは通す(名前を決めた瞬間に uid で載るように)。
      // 通信できなければ null が返る。そのときは今までどおり素で進む
      const auth = await ensureAuth();
      const me = loadProfile();
      if (auth && me.id !== auth.uid) {
        // 端末が名乗っていた古い鍵から、Firebase の uid へ持ち替える。
        // 名前・レート・戦績は端末の中にあるので、鍵が変わっても失われない。
        //
        // まだ名前が無い(id も無い)初回起動でも、ここを通しておく。
        // 通さないと、名前を決めたときに端末が自分で p… という鍵を作り、
        // その鍵で台帳に載せようとして弾かれる(ルールは uid しか許さない)。
        const oldId = me.id;
        adoptUid(auth.uid);
        const now = loadProfile();
        // 先に新しい鍵で載せ直してから、古い鍵の行を消す。
        // 逆順だと、途中で落ちたときランキングから消えたままになる
        if (now.name) {
          await syncPlayer(now);
        }
        dropOldRows(oldId);
        if (gone) return;
      }
      const now = loadProfile();
      if (!now.id || !now.name) return;
      retrySeasonMatches().catch(() => {});
      seasonRequest("summary").catch(() => {});
      // 引き継ぎの控えを預け直す(本人確認済みのときだけ。間が空いていなければ何もしない)
      backupIfDue().catch(() => {});
      // いま持っている札をサーバーへ知らせる(2026-09-18)。
      // 対局では装備の所持が誰にも検証されていないので、まず「正しく遊んで手に入れた」記録を貯める。
      // いまは何も拒まず、遊びも止めない(noteCollection は投げない)
      noteCollection();
      // 使用頻度のミッション用に、1日1回だけ数える
      touchDay();
      if (gone) return;
      const stopped = await syncPlayer(loadProfile());
      if (gone || !stopped) return;
      // 名前を捨てて決め直させてはいけない。停止の印は uid に付くので、
      // 何度名乗り直しても同じ印が見つかり、名前を決める画面から
      // 出られなくなる。ここで止めて、理由を出す
      setBanned(!0);
    })();
    return () => {
      gone = true;
    };
    // 名前を決めた直後にも通す(初回の記録を取りこぼさないため)
  }, [named]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [e]);
  function s() {
    (u(null), m(!1), setTut(null), t("home"));
  }
  // ハブ(対戦する等の menu)へ戻す。「ホームへ」はタイトル(home)ではなくここが正しい
  // (2026-09-21 本人の指示。他画面の「ホームに戻る」と同じ行き先にそろえる)。
  // 対局からも使うので goHome と同じ後片付け(近くの端末・部屋)をしてから menu へ。
  function goMenu() {
    (dropNearby(), w(!1), u(null), m(!1), setTut(null), t("menu"));
  }
  // 対局後の「戻る」。オンラインとCPU戦は、初期画面まで戻さず「対戦相手を選ぶ」へ
  // 近くの端末との対戦を抜けるときは、部屋の片付けの知らせが届いてから接続を切る
  function dropNearby() {
    if (a && a.nearby) setTimeout(() => nearby().stop(), 1500);
  }
  /**
   * 左上の戻る釦の行き先。タイトル(home)だけは戻り先が無いので出さない。
   * 対局中(game)は GameCore が自分の GameShell で持っている(やめる確認を通す)
   */
  function backFor(screen) {
    if (screen === "home" || screen === "game") return undefined;
    const up = {
      menu: "home",
      skins: skinsFrom,
      shop: "menu",
      matching: "menu",
      tutorial: "menu",
      tsume: "menu",
      missions: "menu",
      battlepass: "menu",
      cards: "menu",
      letters: "menu",
      friends: "menu",
      profile: profileFrom,
      // ランキングは「対戦する」の中にあるので、そこへ戻す
      ranking: "matching",
      online: "matching",
      room: "matching",
      nearby: "matching",
      rules: rulesFrom,
    };
    const to = up[screen];
    if (!to) return undefined;
    // 対戦の待ち合わせから戻るときは、掲示や部屋の後片付けが要る
    if (screen === "online" || screen === "room" || screen === "nearby")
      return backToMatching;
    if (screen === "menu") return goHome;
    return () => t(to);
  }
  function backToMatching() {
    (dropNearby(), u(null), m(!1), setTut(null), setBot(null), t("matching"));
  }
  // 連戦。同じ盤の大きさのまま、次の相手を探しに行く(RandomMatchScreen は開くと同時に探し始める)
  function nextRandomMatch() {
    (dropNearby(), u(null), m(!1), setTut(null), setBot(null), setRound(0), t("online"));
  }
  function startTutorial(chosen) {
    (u(null), setTut(chosen), m(!0), r("game"), t("game"));
    window.scrollTo(0, 0);
  }
  function showTutorials() {
    (u(null), m(!1), setTut(null), t("tutorial"));
  }
  // 上の「トッタリー」から。ルーム作成の予約(p)も引きずらないように
  function goHome() {
    (dropNearby(), w(!1), s());
  }
  function v(b) {
    (u(b), setRound(0), t("game"));
  }
  let [p, w] = (0, useState)(!1);
  // 手元の対局(CPU戦・同じ端末)で使える札は、自分のレベルで決まる。
  // 全部開いていれば null(絞らない)。src/game/card-unlock.js
  const localLevel = levelOf(loadProfile());
  const localPool = poolForLevel(localLevel);
  function z(b) {
    if (o === "online") saveOnlineSize(b);
    (f(b), o === "room" && w(!0), t(o));
  }
  // 画面の枠(背景や上のバー)は GameShell が出すので、その中に入れる
  //
  // 使用停止は名前ではなく口座に付く。名前を決め直させても同じ印が
  // 残るので、ここで行き止まりにする
  if (banned)
    return (
      <GameShell>
        <div className="center-stage">
          <h2>ご利用を停止しています</h2>
          <p className="hint">
            他の方への迷惑行為が確認されたため、このアカウントではトッタリーをご利用いただけません。
          </p>
          <p className="hint">
            心当たりがない場合や、内容についてのお問い合わせは、ストアの製品ページに記載の連絡先までご連絡ください。
          </p>
        </div>
      </GameShell>
    );
  if (!named)return (
      <GameShell showRules={l} setShowRules={n}>
        <NameSetupScreen
          onDone={() => {
            setNamed(!0);
            // 初めての人にだけ、一度きり。第1話を終えていれば出さない
            if (shouldOfferFirstTutorial(loadProfile())) {
              markFirstTutorialOffered();
              setOfferTutorial(!0);
            }
          }}
        />
      </GameShell>
    );
  if (e === "game") {
    const nextTutorial = tut ? nextTutorialAfter(tut.id) : null;
    // 対局中に出す名前。相手の名前が分からない席は色名のまま
    let mine = loadProfile(),
      me = mine.name || null,
      names = a
        ? a.names || [null, null]
        : d
          ? [
              me,
              tut
                ? null
                : bot
                  ? bot.name
                  : cpuArea && cpuArea.king && i === 9
                    ? `CPU(${JOSEKI_INFO[cpuArea.type].label})`
                    : "CPU",
            ]
          : [null, null],
      icons = a
        ? a.icons || [null, null]
        : d
          ? [mine.icon, bot ? bot.icon : null]
          : [null, null],
      // 称号はマッチした相手と交わすもの。CPU戦・同じ端末では渡さない。
      // Bot(ランダムマッチの練習相手)は人物として見せるので、レートに応じた称号を名乗る(2026-09-23)
      titles = a
        ? a.titles || [null, null]
        : bot
          ? [titleOf(mine).id, botTitle(bot)]
          : [null, null],
      skins = a
        ? (a.skins || [{}, {}]).map(sanitizeLoadout)
        : tut
          ? // 第13話は台本が装備を持つ(王のスキンでエリアが立つ)
            (tut.loadouts || [{}, {}]).map(sanitizeLoadout)
          : d
            ? [
                collection.equipped,
                // エリアを選んだCPU戦は、王の数字にフォイルを必ず持たせる(でないとエリアが立たない)。
                // 「エリアなし」は CPU の装備からフォイルを外し、CPU のエリアだけ立てない(自分のエリアは装備どおり)
                cpuArea && cpuArea.type === "none" && i === 9 && d && !tut
                  ? stripFoils(cpuSkins)
                  : cpuArea && cpuArea.king && i === 9 && foilRevealed(collection) && (!localPool || bot)
                    ? ensureCpuFoil(cpuSkins, cpuArea.king)
                    : cpuSkins,
              ]
            : [collection.equipped, collection.equipped];
    return (
      <SeatsProvider value={{ names, icons, titles, skins }}>
        <AppearanceSeats network={a} cpu={d} tutorial={tut}>
          <GameCore
            // 再戦のたびに作り直す。見た手の控えも記録済みの印も、
            // 前の対局のものを引きずらせない。
            // チュートリアルは話ごとに作り直す
            key={tut ? tut.id : `battle-${round}`}
            round={round}
            onRematch={a ? () => setRound((n) => n + 1) : null}
            network={a}
            boardSize={tut ? tut.boardSize : i}
            cpu={d}
            // フォイルを初めて手に入れるまでは、エリアを選ぶ欄そのものを出さない(選べても渡さない)
            cpuArea={
              d && !tut && i === 9 && foilRevealed(collection) && (!localPool || bot) ? cpuArea : null
            }
            // ランダムマッチの練習相手。人との対局と同じ扱い(レートが動く、札は絞らない)
            bot={d && !tut ? bot : null}
            // 詳細設定は CPU戦・同じ端末・フレンド対戦(合言葉・近くの端末)だけ。ランダムマッチ・Bot・チュートリアルでは使わない
            custom={!tut && !bot && !(a && a.random) ? customRules : null}
            // 手元の対局は、レベルで開いている札だけを配る。オンライン・チュートリアル・Bot は絞らない
            pool={!a && !tut && !bot ? localPool : null}
            handSize={!a && !tut && !bot ? handSizeForLevel(localLevel) : null}
            tutorial={tut}
            nextTutorial={nextTutorial}
            onNextTutorial={
              nextTutorial ? () => startTutorial(nextTutorial) : null
            }
            onTutorialList={showTutorials}
            onExit={tut ? s : backToMatching}
            exitLabel={tut ? "タイトルに戻る" : "対戦相手を選ぶに戻る"}
            // チュートリアルの「ホームへ」はハブ(menu)へ。タイトルに戻る(onExit=s)とは
            // 別の行き先にする(2026-09-21 本人の指示)。それ以外の対局は従来どおり
            onHome={goMenu}
            onNextMatch={(a && a.random) || bot ? nextRandomMatch : null}
          />
        </AppearanceSeats>
      </SeatsProvider>
    );
  }
  return (
    <GameShell
      showRules={l}
      setShowRules={n}
      onHome={e === "home" ? null : goHome}
      // 左上の戻る釦は、タイトル以外のすべての画面に出す(2026-09-18 本人の指示)。
      // 行き先は「1つ上」。画面の中の「ホームに戻る」と同じ場所へ着く
      onBack={backFor(e)}
    >
      {
        {
          home: (
            <>
              <HomeScreen onStart={() => t("menu")} />
              {offerTutorial && (
                <div className="modal-overlay">
                  <div className="modal-panel tutorial-offer">
                    <h3>はじめまして</h3>
                    <p className="hint">
                      第1話は1分。相手の王を討つところまで、まず一度やってみますか？
                    </p>
                    <p className="hint">ホームの「チュートリアル」からいつでも始められます。</p>
                    <div className="setup-actions">
                      <button
                        className="btn btn-ghost"
                        onClick={() => setOfferTutorial(!1)}
                      >
                        あとで
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setOfferTutorial(!1);
                          startTutorial(TUTORIALS[0]);
                        }}
                      >
                        第1話を始める
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ),
          skins: (
            <SkinsScreen
              onBack={() => t(skinsFrom)}
              onBattlePass={() => t("battlepass")}
              initialTab={skinsTab}
            />
          ),
          shop: (
            <ShopScreen
              onBack={() => t("menu")}
              onGacha={() => {
                (setSkinsTab("gacha"), setSkinsFrom("shop"), t("skins"));
              }}
              onFoil={() => {
                (setSkinsTab("foil"), setSkinsFrom("shop"), t("skins"));
              }}
              onBattlePass={() => t("battlepass")}
            />
          ),
          menu: (
            <MenuScreen
              onPlay={() => t("matching")}
              onTutorial={showTutorials}
              onTsume={() => t("tsume")}
              onSkins={() => t("skins")}
              onBattlePass={() => t("battlepass")}
              onMissions={() => t("missions")}
              onCards={() => t("cards")}
              onLetters={() => t("letters")}
              onFriends={() => t("friends")}
              onShop={() => t("shop")}
              onProfile={() => {
                (setProfileUid(null), setProfileFrom("menu"), t("profile"));
              }}
            />
          ),
          matching: (
            <MatchingScreen
              onBack={() => t("menu")}
              onTutorial={showTutorials}
              onRanking={() => t("ranking")}
              onOnline={() => {
                (u(null),
                  m(!1),
                  r("online"),
                  setRulesFrom("matching"),
                  t("rules"));
              }}
              onFriend={() => {
                (setInviteTo(null), u(null), m(!1), t("room"));
              }}
              onCpu={() => {
                setCpuSkins(createCpuLoadout());
                setCpuArea(null);
                setBot(null);
                (u(null),
                  m(!0),
                  setTut(null),
                  r("game"),
                  setRulesFrom("matching"),
                  t("rules"));
              }}
            />
          ),
          ranking: <RankingScreen onBack={() => t("matching")} />,
          tsume: <TsumeScreen onBack={() => t("menu")} />,
          // ミッションとバトルパスは1つの画面。どちらを開いているかは画面の id で持つ
          missions: (
            <QuestsScreen
              tab="missions"
              onTab={t}
              onBack={() => t("menu")}
              onSkins={() => t("skins")}
            />
          ),
          battlepass: (
            <QuestsScreen
              tab="battlepass"
              onTab={t}
              onBack={() => t("menu")}
              onSkins={() => t("skins")}
            />
          ),
          cards: <CardMasteryScreen onBack={() => t("menu")} />,
          // お知らせとフレンドは1つの画面(InboxScreen)のタブ。タブ = 画面 id
          friends: (
            <InboxScreen
              tab="friends"
              onTab={(id) => t(id)}
              onBack={() => t("menu")}
              onProfile={(uid) => {
                (setProfileUid(uid), setProfileFrom("friends"), t("profile"));
              }}
              onInvite={inviteToRoom}
              onJoinInvite={joinInvite}
            />
          ),
          profile: (
            <ProfileScreen
              uid={profileUid}
              onBack={() => t(profileFrom)}
              backLabel={profileFrom === "friends" ? "フレンドに戻る" : "ホームに戻る"}
              onFriends={() => t("friends")}
              onInvite={inviteToRoom}
              onRemoved={() => t("friends")}
            />
          ),
          letters: <InboxScreen tab="letters" onTab={(id) => t(id)} onBack={() => t("menu")} />,
          tutorial: (
            <TutorialSelect onBack={() => t("menu")} onStart={startTutorial} />
          ),
          online: (
            <RandomMatchScreen
              boardSize={i}
              onBack={() => t("matching")}
              onRoomReady={v}
              // レート 1750 未満: Bot と組む。中身は CPU 戦の作りをそのまま使う
              onBotReady={(b) => {
                clearBotNow();
                setCpuSkins(createCpuLoadout());
                // Bot のエリアは6種を均等に(人物が持つ)。エリアを知らない(フォイルを持たない)人には立てない
                setCpuArea(b.area && b.king && foilRevealed(collection) ? { type: b.area, king: b.king } : null);
                setBot(b);
                (u(null), m(!0), setTut(null), setRound(0), r("game"), t("game"));
              }}
            />
          ),
          room: (
            <RoomScreen
              autoCreate={p}
              initialCode={pendingRoom}
              onCodeUsed={() => setPendingRoom("")}
              inviteName={inviteTo ? inviteTo.name : ""}
              onRoomCreated={(code) => {
                // 招待した相手に合言葉を届ける。届かなくても部屋は残る(合言葉を伝えれば入れる)。
                // 相手の名前は待つ画面に出し続けるので、ここでは消さない(部屋を出るときに消す)
                if (inviteTo) inviteFriend(inviteTo.uid, code).catch(() => {});
              }}
              onNearby={() => {
                (setPendingRoom(""), r("nearby"), setRulesFrom("room"), t("rules"));
              }}
              onOfflineLocal={() => {
                (w(!1),
                  u(null),
                  m(!1),
                  r("game"),
                  setRulesFrom("room"),
                  t("rules"));
              }}
              onBeforeRoom={() => {
                (setPendingRoom(""), r("room"), setRulesFrom("room"), t("rules"));
              }}
              onRoomReady={v}
              onBackToMatching={() => {
                (setPendingRoom(""), setInviteTo(null), w(!1), t("matching"));
              }}
            />
          ),
          nearby: (
            <NearbyScreen
              boardSize={i}
              onReady={v}
              onBack={() => {
                (w(!1), t("room"));
              }}
            />
          ),
          rules: (
            <RulesSelectScreen
              // ランキングに載るのはランダムマッチの 9×9 だけ。フレンド対戦は載らない(2026-09-17)
              ranked={o === "online"}
              // 近くの端末との対戦はフレンド対戦と同じく、レベルで札を絞らない
              initialSize={o === "online" ? loadOnlineSize() : 5}
              // 手元の対局は、レベルで札と 9×9 を絞る(src/game/card-unlock.js)
              level={o === "online" || o === "room" || o === "nearby" ? null : localLevel}
              onStart={z}
              // 詳細設定はランダムマッチ以外
              custom={o === "online" ? null : customRules}
              onCustom={
                o === "online"
                  ? null
                  : (c) => {
                      setCustomRules(c);
                      saveCustomRules(c);
                    }
              }
              onBack={() => t(rulesFrom)}
              backLabel={
                rulesFrom === "room"
                  ? "フレンド対戦に戻る"
                  : "対戦相手を選ぶに戻る"
              }
              note={
                o === "room"
                  ? "この設定でルームを作ります。"
                  : o === "nearby"
                    ? "近くの端末と対戦します。盤の大きさは、相手にタップされた側(先手)の設定になります。"
                    : null
              }
              // 相手のエリアを選べるのは CPU戦で、フォイルを持っている(エリアを知っている)人だけ
              cpuArea={cpuArea ? cpuArea.type : null}
              onCpuArea={
                d && !tut && foilRevealed(collection) && !localPool
                  ? (type) =>
                      setCpuArea(
                        // "none" は CPU のエリアだけ立てない(装備からフォイルを外す)。王は決めない
                        type === "none"
                          ? { type: "none", king: null }
                          : type
                            ? { type, king: pickJosekiKing(type) }
                            : null,
                      )
                  : null
              }
            />
          ),
        }[e]
      }
    </GameShell>
  );
}
