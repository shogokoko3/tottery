/**
 * プレイヤーのアカウント。
 *
 * 名前・対局数・勝数を端末に持つ。名前は対戦相手にも渡して、
 * 「どちらの手番か」「誰が指したのか」を色だけでなく名前でも分かるようにする。
 * レベルは貯めた経験値から決まり、チュートリアルの開放条件になる。
 *
 * 保存先は端末の localStorage だけ。サーバーには置いていない。
 * レーティングやランキングを入れるときは、ここに rating を足したうえで、
 * 端末を替えても続く本物のアカウント(サーバー側の識別)が別に要る。
 * いまの id は端末ごとの目印で、作り直せてしまう。
 */

import { hasIcon } from "./icons.js";
import { normalizeCard } from "./profile-card.js";
import { findTitle, hasTitle, newlyEarned } from "./titles.js";
import { SECRETS } from "./secrets.js";
import { MAX_LEVEL, XP, levelOfXp, progressOfXp } from "./level.js";
import { publishXpNotice } from "./xp-notices.js";
import { clearTitleNotices, publishTitleNotices } from "./title-notices.js";
import {
  sanitizeMissionProgress,
  recordMissionLogin,
  recordMissionGame,
} from "./periodic-missions.js";

export { MAX_LEVEL };
import {
  START_RATING,
  ratingFromProfile,
  normalizeRating,
  RATING_VERSION,
  nextRating,
  wrFromProfile,
} from "./rating.js";
import {
  RANKS,
  MASTERY_STEPS,
  MASTERY_PER_GAME,
} from "./constants.js";
import { findBadWord } from "./badwords.js";
import { clearBlocked } from "./blocked.js";

const KEY = "tottery.account.v1";
/** 名前を持たなかった頃の保存先。1度だけ読み込んで引き継ぐ */
const OLD_KEY = "tottery.profile.v1";

/** 名前の長さの上限 */
export const MAX_NAME_LEN = 10;

/**
 * テストプレイ用の時計停止を許可する。?test= を付けた場合だけ働く。
 * レベルはテスト環境でも実際の経験値で決まり、0XPならレベル1から始まる。
 *
 * 配信ビルドでは false。手元の `npm run serve`(http://localhost)だけは
 * この旗に関わらず ?test=1 が効く(下の isTestPlay を見る)ので、
 * 動作確認のためにここを true に戻す必要はない。
 */
export const TEST_BUILD = false;

/**
 * 手元のサーバーで開いているか。http の localhost だけを手元とみなす。
 * iOS のアプリは capacitor://localhost なので当てはまらない
 */
function isLocalhost() {
  try {
    return (
      location.protocol === "http:" &&
      (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

/**
 * テストプレイ用モード。URL に ?test=1 を付けたときだけ有効になる。
 * 布陣の1分と対局の持ち時間を止めて、画面をゆっくり確かめられるようにする。
 * TEST_BUILD が false の配信ビルドでは、何を付けても有効にならない。
 */
export function isTestPlay() {
  if (!TEST_BUILD && !isLocalhost()) return false;
  try {
    return new URLSearchParams(location.search).has("test");
  } catch {
    return false;
  }
}

const EMPTY = {
  id: null,
  name: "",
  icon: null,
  icons: [],
  // 選んでいる称号と、あとから配られた称号。対局数などで決まるものは
  // titles.js が profile から判定するので、ここには持たない
  title: null,
  titles: [],
  // 達成したシークレットミッションの id
  secrets: [],
  // ガチャ称号の実績(collection.gachaStatsOf の写し)。称号判定に使う。獲得した称号は
  // titles に焼き付くので、表示・共有はこれが無くても効く(2026-09-21)
  gacha: null,
  // 札ごとの熟練度。その札を王に選び、王として動かした回数({ "J": 120, ... })。
  // 1局で同じ札を数えるのは MASTERY_PER_GAME 回まで(長引かせる遊びを得にしない)。
  // 恩恵は称号・アイコン・フレームだけ。盤の有利不利には一切効かせない(2026-09-22 本人の決め)
  mastery: null,
  plays: 0,
  // 対戦だけの数(チュートリアルを含めない)。ミッションの条件に使う
  battles: 0,
  // 対戦だけの勝ち・引き分け。戦績の表示に使う(plays/wins は全体の数で、称号などが使う)
  battleWins: 0,
  battleDraws: 0,
  wins: 0,
  draws: 0,
  // 経験値。レベルはここから毎回導くので、レベルは保存しない
  xp: 0,
  // 使った日数。ミッションの「使用頻度」に使う
  days: 0,
  streak: 0,
  lastDay: null,
  // ログインボーナスを最後に受け取った日と、受け取った回数。
  // 回数がひと回りの中の位置になる(休んでも巻き戻らない)
  bonusDay: null,
  bonusTaken: 0,
  // 褒美を受け取り済みのミッション
  missions: [],
  missionProgress: null,
  // 一度クリアしたチュートリアル。2回目からは経験値を配らない
  cleared: [],
  // 受け取り済みの手紙。二重取りを防ぐ
  letters: [],
  // レーティングと、その対象になった対局数(オンラインだけ)
  rating: START_RATING,
  // 旧保存の引き継ぎ用。Elo移行後の持ち点計算には使わない
  wr: 0.5,
  // 持ち点つき対局の勝ち数・引き分け数(勝率の見積もりを復元するのに使う)
  ratedWins: 0,
  ratedDraws: 0,
  rated: 0,
  // プロフィールの飾り(背景・記録のアピール・固定の称号。src/game/profile-card.js)
  card: null,
};

/**
 * 札ごとの熟練度。
 *
 * **その札を王に選び、王として動かした回数**で上がる(本人の決め 2026-09-22)。
 * 勝敗では上がらない。1局で育つのは王にした1種類だけ。
 * 負けても伸びるので、覚えたての人が痛くない。
 *
 * 1局で同じ札を数えるのは3回まで。ここに歯止めが無いと「わざと長引かせて
 * 同じ札を指し続ける」のが一番効率のいい遊び方になり、盤がつまらなくなる。
 *
 * 段は5つで、**500回で頭打ち**にする。青天井にすると、1000局遊んだ人と
 * 100局遊んだ人の差が永久に開き続け、あとから始めた人が追いつけない。
 */
export { MASTERY_STEPS, MASTERY_PER_GAME };

/** 保存されている熟練度を、知っている札だけの数に整える */
function normalizeMastery(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const rank of RANKS) {
    const n = Math.max(0, Math.floor(Number(raw[rank]) || 0));
    if (n > 0) out[rank] = n;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * 指した回数から、いまの段と「次の段までの進み具合」を出す。
 * 終局画面のメーターがこれを使う(2026-09-22 本人の指示)。
 */
export function masteryProgress(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  let step = 0;
  for (const need of MASTERY_STEPS) if (n >= need) step += 1;
  const done = step >= MASTERY_STEPS.length;
  const floor = step === 0 ? 0 : MASTERY_STEPS[step - 1];
  const ceil = done ? MASTERY_STEPS[MASTERY_STEPS.length - 1] : MASTERY_STEPS[step];
  const span = Math.max(1, ceil - floor);
  const into = Math.max(0, Math.min(n, ceil) - floor);
  return {
    count: n,
    step,
    done,
    into,
    need: span,
    ratio: done ? 1 : into / span,
    left: done ? 0 : ceil - n,
    next: done ? null : ceil,
  };
}

/** その札の段(0〜5)。0 は「まだ段に届いていない」 */
export function masteryStep(profile, rank) {
  return masteryProgress((profile && profile.mastery && profile.mastery[rank]) || 0)
    .step;
}

/** 全部の札が step 段に届いているか(通しの褒美の条件) */
export function masteryAll(profile, step) {
  return RANKS.every((rank) => masteryStep(profile, rank) >= step);
}

/**
 * 1局ぶんの「指した回数」を熟練度に足す。
 *
 * used は { 札: その局で王として動かした回数 }。数えるのは自分の王の手だけ。
 * チュートリアルは台本なので呼ばない(画面側で外す)。
 */
export function recordMastery(used) {
  const profile = loadProfile();
  const none = { profile, gains: [], titles: [] };
  if (!used || typeof used !== "object") return none;
  const mastery = { ...(profile.mastery || {}) };
  const gains = [];
  for (const rank of RANKS) {
    const n = Math.min(MASTERY_PER_GAME, Math.floor(Number(used[rank]) || 0));
    if (n <= 0) continue;
    const before = mastery[rank] || 0;
    mastery[rank] = before + n;
    gains.push({
      rank,
      added: n,
      before,
      after: mastery[rank],
      stepBefore: masteryProgress(before).step,
      progress: masteryProgress(mastery[rank]),
    });
  }
  if (!gains.length) return none;
  const next = { ...profile, mastery };
  // 届いた称号は焼き付ける。以後は熟練度の数字が無くても名乗れる(持ち点の称号と同じ)
  const earned = newlyEarned(profile, next);
  if (earned.length)
    next.titles = [...next.titles, ...earned.map((t) => t.id)];
  saveProfile(next);
  return {
    profile: next,
    gains,
    // 終局画面で見せる、この局で届いた称号
    titles: earned.map((t) => ({ id: t.id, name: t.name })),
  };
}

/** 端末ごとの目印。名前が同じ人と区別するために持つ */
function makeId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // プライベートブラウズなどで読めないことがある
    return null;
  }
}

export function loadProfile() {
  const saved = read(KEY) || read(OLD_KEY);
  if (!saved) return { ...EMPTY };
  const savedDraws = Number(saved.draws);
  // 対戦だけの数と、その勝ち・引き分け。古い保存には無いので、全体の数から
  // 見積もる(対戦の数を超えない)。以後は recordGame が対戦だけを数える
  const battles =
    Number(Number.isFinite(saved.battles) ? saved.battles : saved.plays) || 0;
  const wins = Number(saved.wins) || 0;
  const draws =
    Number.isSafeInteger(savedDraws) && savedDraws > 0 ? savedDraws : 0;
  const battleWins = Number.isFinite(saved.battleWins)
    ? Math.max(0, Number(saved.battleWins))
    : Math.min(wins, battles);
  const battleDraws = Number.isFinite(saved.battleDraws)
    ? Math.max(0, Number(saved.battleDraws))
    : Math.min(draws, battles);
  return {
    id: typeof saved.id === "string" && saved.id ? saved.id : null,
    name: normalizeName(saved.name || ""),
    // 選んでいるアイコンと、手に入れたアイコン。今後増やしていく
    icon: typeof saved.icon === "string" ? saved.icon : null,
    icons: Array.isArray(saved.icons)
      ? saved.icons.filter((x) => typeof x === "string")
      : [],
    title: typeof saved.title === "string" ? saved.title : null,
    titles: Array.isArray(saved.titles)
      ? saved.titles.filter((x) => typeof x === "string")
      : [],
    secrets: Array.isArray(saved.secrets)
      ? saved.secrets.filter((x) => typeof x === "string")
      : [],
    gacha:
      saved.gacha && typeof saved.gacha === "object" && !Array.isArray(saved.gacha)
        ? {
            pulls: Number(saved.gacha.pulls) || 0,
            freeze: Number(saved.gacha.freeze) || 0,
            foil: Number(saved.gacha.foil) || 0,
            ssr: Number(saved.gacha.ssr) || 0,
            allR: Number(saved.gacha.allR) || 0,
            bestTenSsr: Number(saved.gacha.bestTenSsr) || 0,
            foilsOwned: Number(saved.gacha.foilsOwned) || 0,
            normalsOwned: Number(saved.gacha.normalsOwned) || 0,
          }
        : null,
    mastery: normalizeMastery(saved.mastery),
    plays: Number(saved.plays) || 0,
    battles,
    battleWins,
    battleDraws,
    wins,
    draws,
    // 経験値を持たない古い保存は、それまでの対局数ぶんを配って引き継ぐ
    xp:
      Number(
        Number.isFinite(saved.xp)
          ? saved.xp
          : (Number(saved.plays) || 0) * XP.BATTLE,
      ) || 0,
    days: Number(saved.days) || 0,
    streak: Number(saved.streak) || 0,
    lastDay: typeof saved.lastDay === "string" ? saved.lastDay : null,
    bonusDay: typeof saved.bonusDay === "string" ? saved.bonusDay : null,
    bonusTaken: Number(saved.bonusTaken) || 0,
    missions: Array.isArray(saved.missions)
      ? saved.missions.filter((x) => typeof x === "string")
      : [],
    missionProgress: sanitizeMissionProgress(saved.missionProgress),
    cleared: Array.isArray(saved.cleared)
      ? saved.cleared.filter((x) => Number.isInteger(x))
      : [],
    letters: Array.isArray(saved.letters)
      ? saved.letters.filter((x) => typeof x === "string")
      : [],
    // 旧方式の点数は初回だけ移行し、以降はEloの点数を保持する。
    rating: ratingFromProfile(saved),
    ratingVersion: RATING_VERSION,
    wr: wrFromProfile(saved),
    ratedWins: Number(saved.ratedWins) || 0,
    ratedDraws: Number(saved.ratedDraws) || 0,
    rated: Number(saved.rated) || 0,
    card: saved.card ? normalizeCard(saved.card) : null,
  };
}

/**
 * 引き継ぎで受け取った記録を、この端末の記録として置く(src/net/backup.js)。
 * 形は loadProfile() が読むときに整えるので、ここでは口座の id だけ今のものにそろえる。
 * 持ち物(スキン・ジェム)は別の保存なので、呼ぶ側が一緒に戻す
 */
export function restoreProfile(saved, uid) {
  if (!saved || typeof saved !== "object") return loadProfile();
  const id = uid || saved.id || loadProfile().id;
  clearTitleNotices();
  saveProfile({ ...saved, id }, { notifyTitles: false });
  return loadProfile();
}

/** 名前を決めたかどうか。決まるまで対局に入れない */
export function hasName(profile) {
  return !!(profile || loadProfile()).name;
}

/**
 * 入力された名前を整える。
 * 前後の空白を落とし、途中の空白は1つにまとめ、長すぎる分は切る。
 *
 * 切るときは [...s] で符号点ごとに数える。slice() だと絵文字などの
 * サロゲートペアを途中で割ってしまい、壊れた文字が相手の画面に出る。
 */
export function normalizeName(raw) {
  const s = String(raw == null ? "" : raw)
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return [...s].slice(0, MAX_NAME_LEN).join("");
}

/**
 * 名前と端末の目印を捨てて、決め直しの画面へ戻す。
 * 運営に使用停止にされたときに使う。対局数などの記録も一緒に消える
 */
export function resetAccount() {
  clearTitleNotices();
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {
    // 消せなくても次で上書きされる
  }
  return { ...EMPTY };
}

/** 名前として使えるか。使えないときは理由を返す */
export function nameError(raw) {
  const name = normalizeName(raw);
  if (!name) return "名前を入力してください";
  // 整えたあとの長さで見る。生の文字列を見ると、前後に空白を付けただけで
  // 10文字以内の名前を断ってしまう
  const trimmed = String(raw == null ? "" : raw)
    .trim()
    .replace(/\s+/g, " ");
  if ([...trimmed].length > MAX_NAME_LEN)
    return `名前は${MAX_NAME_LEN}文字までです`;
  // 他人の画面と公開ランキングに出るので、露骨な語は断る(ガイドライン 1.2)
  if (findBadWord(name)) return "その名前は使えません。別の名前にしてください";
  return null;
}

/**
 * 名前を決める。はじめて決めたときに id も作る。
 *
 * 画面側でも nameError() を見ているが、ここでも断る。
 * 呼び出しが1つ増えたときに検査を飛ばしてしまわないようにするため。
 */
export function saveName(raw) {
  const name = normalizeName(raw);
  if (!name || findBadWord(name)) return loadProfile();
  const profile = loadProfile();
  const next = { ...profile, name, id: profile.id || makeId() };
  saveProfile(next);
  return next;
}

/**
 * 自分の記録が変わったことを、開いている画面に知らせる合図。
 *
 * localStorage の "storage" イベントは**他のタブにしか届かない**。
 * 同じ画面の中で称号や名前を変えても誰も気づかず、ホームの札は
 * 次の見直し(最長60秒)まで古いままだった(2026-09-22 本人の指摘)。
 */
export const PROFILE_CHANGED = "tottery:profile";

function announce() {
  // 書き込んだ処理の途中で描き直しが始まらないよう、一拍おいて配る
  setTimeout(() => {
    try {
      window.dispatchEvent(new CustomEvent(PROFILE_CHANGED));
    } catch {
      // 画面の無いところ(検査・サーバー)では何もしない
    }
  }, 0);
}

function saveProfile(profile, { notifyTitles = true } = {}) {
  const before = notifyTitles ? loadProfile() : null;
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // 保存できなくても遊べる方を優先する。未保存の報酬は獲得表示しない。
    announce();
    return;
  }
  if (notifyTitles) publishTitleNotices(before, profile);
  announce();
}

/**
 * 端末に残っている自分の記録を全部消す。
 *
 * ガイドライン 5.1.1(v)。サーバー側(ranks/<id>)を消すのは
 * src/net/ranking.js の deleteRank() で、画面側が両方を呼ぶ。
 * 消したあとは名前を決める画面からやり直しになる。
 */
export function forgetMe() {
  clearTitleNotices();
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {
    // 消せなくても続ける。呼び出し側が改めて空の状態を描く
  }
  announce();
  clearBlocked();
  return { ...EMPTY };
}

/** 使うアイコンを選ぶ。持っていないものは受け付けない */
export function saveIcon(id) {
  const profile = loadProfile();
  if (!hasIcon(profile, id)) return profile;
  const next = { ...profile, icon: id };
  saveProfile(next);
  return next;
}

/**
 * プロフィールの飾りを選ぶ(2026-09-23)。固定の称号は持っているものだけ。
 * 背景の解放は所持品(collection)で決まるので、呼ぶ側(画面)が unlockedBackgrounds で絞ってから渡す。
 * 写しを作るときにも落とす(buildProfileCard)
 */
export function saveProfileCard(raw) {
  const profile = loadProfile();
  const card = normalizeCard(raw);
  if (card.pinnedTitle && !hasTitle(profile, card.pinnedTitle)) card.pinnedTitle = null;
  const next = { ...profile, card };
  saveProfile(next);
  return next;
}

/** 使う称号を選ぶ。持っていないものは受け付けない */
export function saveTitle(id) {
  const profile = loadProfile();
  if (!hasTitle(profile, id)) return profile;
  const next = { ...profile, title: id };
  saveProfile(next);
  return next;
}

/**
 * ガチャの実績(collection.gachaStatsOf の結果)をプロフィールに写し、
 * 新しく使えるようになった称号を焼き付ける(2026-09-21)。
 * 焼き付ければ、以後は持ち点の称号と同じく titles だけで表示・共有できる。
 * ガチャ・錬成のあとに呼ぶ。変化がなければ保存しない。
 */
export function recordGachaStats(stats) {
  const profile = loadProfile();
  if (!stats || typeof stats !== "object") return profile;
  const next = { ...profile, gacha: stats };
  const earned = newlyEarned(profile, next).map((t) => t.id);
  next.titles = [
    ...next.titles,
    ...earned.filter((id) => !next.titles.includes(id)),
  ];
  const same =
    JSON.stringify(profile.gacha) === JSON.stringify(next.gacha) &&
    next.titles.length === profile.titles.length;
  if (same) return profile;
  saveProfile(next);
  return next;
}

/** 称号を配る。対局数などで決まらない、催しなどの褒美の想定 */
/**
 * シークレットミッションの達成を控え、褒美の称号を配る。
 * すでに達成しているなら何もしない(同じ出来事に何度出くわしても1回)
 */
export function achieveSecret(id) {
  const profile = loadProfile();
  if ((profile.secrets || []).includes(id)) return null;
  const secret = SECRETS.find((s) => s.id === id);
  if (!secret) return null;
  const titles = profile.titles.includes(secret.reward.id)
    ? profile.titles
    : [...profile.titles, secret.reward.id];
  saveProfile({
    ...profile,
    secrets: [...(profile.secrets || []), id],
    titles,
  });
  return secret;
}

export function grantTitle(id) {
  const profile = loadProfile();
  if (profile.titles.includes(id)) return profile;
  const next = { ...profile, titles: [...profile.titles, id] };
  saveProfile(next);
  return next;
}

/** アイコンを手に入れる。対局の褒美として配る想定 */
export function grantIcon(id) {
  const profile = loadProfile();
  if (profile.icons.includes(id)) return profile;
  const next = { ...profile, icons: [...profile.icons, id] };
  saveProfile(next);
  return next;
}

/**
 * 1局終えた記録をつけて、更新後のプロフィールを返す。
 *
 * opts.foeRating を渡した対局だけレーティングが動く。オンライン対戦で
 * 相手の持ち点が分かっているときだけ渡す。増減は戻り値の delta に入る。
 * opts.xp を渡すと、対戦ぶんの代わりにその経験値を配る(チュートリアル)。
 * opts.tutorial を立てた対局は、対戦の数に数えない。
 * won は true が勝ち、false が負け、null が引き分け。
 * 引き分けでも通常対局の経験値は入り、チュートリアルはクリアに数えない。
 */
/**
 * サーバー(月間シーズンの台帳)が出した持ち点を、端末の持ち点にする(2026-09-23 本人の指示
 * 「オンラインのレーティングと持ち点は同じもの」)。
 *
 * 対局の直後は端末が同じ式で仮の値を出すが、正はサーバー。届いたら上書きし、
 * 持ち点で決まる称号もここで焼き付ける。変わらなければ何もしない
 */
export function adoptServerRating(rating) {
  const profile = loadProfile();
  if (!Number.isFinite(Number(rating))) return profile;
  const value = normalizeRating(rating);
  if (value === profile.rating && profile.ratingVersion === RATING_VERSION)
    return profile;
  const next = { ...profile, rating: value, ratingVersion: RATING_VERSION };
  const newTitles = newlyEarned(profile, next);
  next.titles = [
    ...next.titles,
    ...newTitles.map((t) => t.id).filter((id) => !next.titles.includes(id)),
  ];
  saveProfile(next);
  return next;
}

export function recordGame(won, opts) {
  const profile = loadProfile();
  const draw = won === null;
  // 呼び出し側はチュートリアルなら必ず opts.tutorial を立てる(tutorialId は勝ったときだけ)
  const isTutorial = !!(opts && opts.tutorial);
  const foeRating = opts && opts.foeRating;
  const rated = typeof foeRating === "number";
  const before =
    rated && Number.isFinite(opts?.startRating)
      ? normalizeRating(opts.startRating)
      : profile.rating;
  const step = rated ? nextRating(before, foeRating, won) : null;
  const after = step ? step.rating : before;
  // チュートリアルは初回だけ経験値が入る。2回目からは0
  const again =
    opts &&
    opts.tutorialId != null &&
    profile.cleared.includes(opts.tutorialId);
  const tutorialDraw = draw && (opts?.tutorial || opts?.tutorialId != null);
  const gained =
    again || tutorialDraw
      ? 0
      : opts && Number.isFinite(opts.xp) && opts.xp >= 0
        ? opts.xp
        : XP.BATTLE;
  const levelBefore = levelProgress(profile).level;
  const next = {
    ...profile,
    plays: profile.plays + 1,
    missionProgress: recordMissionGame(
      profile.missionProgress,
      {
        online: opts?.online === true,
        tutorial: !!opts?.tutorial || opts?.tutorialId != null,
        won,
        kingRank: opts?.kingRank ?? null,
        matchId: opts?.matchId,
      },
      opts?.at,
    ),
    battles: profile.battles + (isTutorial ? 0 : 1),
    // 対戦だけの勝ち・引き分け(戦績の表示用)。チュートリアルは数えない
    battleWins: profile.battleWins + (!isTutorial && won === true ? 1 : 0),
    battleDraws: profile.battleDraws + (!isTutorial && draw ? 1 : 0),
    wins: profile.wins + (won ? 1 : 0),
    draws: profile.draws + (draw ? 1 : 0),
    xp: profile.xp + gained,
    cleared:
      opts && opts.tutorialId != null && !again && !draw
        ? [...profile.cleared, opts.tutorialId]
        : profile.cleared,
    rating: after,
    ratingVersion: RATING_VERSION,
    wr: profile.wr,
    ratedWins: profile.ratedWins + (rated && won === true ? 1 : 0),
    ratedDraws: profile.ratedDraws + (rated && draw ? 1 : 0),
    rated: profile.rated + (rated ? 1 : 0),
  };
  // この1局で新しく使えるようになった称号。画面で知らせる。
  // 持ち点で決まるものは、あとで持ち点が下がっても失わないように焼き付ける
  const newTitles = newlyEarned(profile, next);
  next.titles = [
    ...next.titles,
    ...newTitles.map((t) => t.id).filter((id) => !next.titles.includes(id)),
  ];
  saveProfile(next);
  const levelAfter = levelProgress(next).level;
  const xpNoticeId = publishXpNotice({
    beforeXp: profile.xp,
    afterXp: next.xp,
    source: opts?.tutorial ? "tutorial" : "battle",
    ready: !opts?.deferXpNotice,
  });
  return {
    ...next,
    delta: rated ? after - before : null,
    before,
    // この1局で新しく使えるようになった称号。
    // 保存の earned(功績値)とは別物なので、返り値ではこちらが優先する
    earned: newTitles,
    gained,
    firstClear: !!(opts && opts.tutorialId != null) && !again && !draw,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
    xpNoticeId,
  };
}

/** レベル。経験値の総量から決まる */
export function levelOf(profile) {
  return levelOfXp((profile || EMPTY).xp);
}

/** いまのレベルの中での進み具合。帯や「あと◯」の表示に使う */
export function levelProgress(profile) {
  // テスト環境も含め、帯には実際に貯めた経験値を出す。
  return progressOfXp((profile || EMPTY).xp);
}

/** 次のレベルまでに必要な経験値。最高レベルなら null */
export function toNextLevel(profile) {
  return levelProgress(profile).left;
}

/** 端末の時計での今日。日付だけを "2026-09-04" の形で持つ */
export function dayKey(at) {
  const d = at instanceof Date ? at : new Date(at == null ? Date.now() : at);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 「今日も遊んだ」を1日1回だけ数える。アプリを開いたときに呼ぶ。
 * 続けて遊んだ日数(streak)は、前日から続いていれば伸び、飛ぶと1に戻る。
 */
export function touchDay(at) {
  const profile = loadProfile();
  const now = at == null ? Date.now() : at;
  const today = dayKey(now);
  const missionProgress = recordMissionLogin(profile.missionProgress, now);
  if (profile.lastDay === today) {
    if (
      JSON.stringify(profile.missionProgress) ===
      JSON.stringify(missionProgress)
    )
      return profile;
    const next = { ...profile, missionProgress };
    saveProfile(next);
    return next;
  }
  const yesterday = dayKey(now - 24 * 60 * 60 * 1000);
  const next = {
    ...profile,
    days: profile.days + 1,
    streak: profile.lastDay === yesterday ? profile.streak + 1 : 1,
    lastDay: today,
    missionProgress,
  };
  saveProfile(next);
  return next;
}

/** ミッションの褒美を受け取ったことを控える */
export function markMissionClaimed(id) {
  const profile = loadProfile();
  if (!id || profile.missions.includes(id)) return profile;
  const next = { ...profile, missions: [...profile.missions, id] };
  saveProfile(next);
  return next;
}

/** 称号報酬と受取済みの控えを同時に保存し、失敗時は再受取できるようにする。 */
export function grantMissionTitle(missionId, titleId) {
  if (typeof missionId !== "string" || !missionId || !findTitle(titleId))
    throw new Error("称号報酬が見つかりません。");
  const profile = loadProfile();
  if (profile.missions.includes(missionId)) return profile;
  const next = {
    ...profile,
    titles: profile.titles.includes(titleId)
      ? profile.titles
      : [...profile.titles, titleId],
    missions: [...profile.missions, missionId],
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    throw new Error(
      "保存できませんでした。空き容量や保存設定を確認して、もう一度受け取ってください。",
    );
  }
  publishTitleNotices(profile, next);
  announce();
  return next;
}

/**
 * ログインボーナスを受け取ったことを控える。
 * 同じ日に2回目を呼んでも増えない(端末の時計が戻された時の備え)。
 */
export function markBonusTaken(at) {
  const profile = loadProfile();
  const today = dayKey(at);
  if (profile.bonusDay === today) return profile;
  const next = {
    ...profile,
    bonusDay: today,
    bonusTaken: profile.bonusTaken + 1,
  };
  saveProfile(next);
  return next;
}

/**
 * サーバー上の記録を Firebase の uid で持ち直す。
 *
 * 端末が自分で名乗る id は誰でも騙れるので、書き込みの本人確認に使えない。
 * Firebase が発行する uid に付け替えると、ルール側で「自分の行だけ書ける」を
 * 強制できる。名前・持ち点・戦績は端末の中にあるので、鍵が変わっても失われず、
 * 次にサーバーへ載せ直したときに新しい鍵で並ぶ。
 */
export function adoptUid(uid) {
  const profile = loadProfile();
  if (!uid || profile.id === uid) return profile;
  const next = { ...profile, id: uid };
  saveProfile(next);
  return next;
}

/** 手紙を受け取ったことを控える */
export function markLetterTaken(id) {
  const profile = loadProfile();
  if (!id || profile.letters.includes(id)) return profile;
  const next = { ...profile, letters: [...profile.letters, id] };
  saveProfile(next);
  return next;
}

/** そのチュートリアルをもうクリアしているか。経験値は初回だけ配る */
export function hasCleared(id, profile) {
  return (profile || loadProfile()).cleared.includes(id);
}

/**
 * チュートリアルを飛ばす。終えたことにして、初回ぶんの経験値も同じだけ配る
 * (終えたのと同じ扱い。飛ばした話はあとからいつでも遊べるが、経験値は入らない)。
 * 対局の数(plays)や対戦の数には数えない。
 * tutorials は { id, xp } の並び。もう終えている話は飛ばさない(経験値も入らない)。
 * 戻り値は addXp と同じ形(gained / levelBefore / levelAfter / xpNoticeId)に skipped(飛ばした id)を足したもの
 */
export function skipTutorials(tutorials) {
  const profile = loadProfile();
  const todo = (tutorials || []).filter(
    (t) => t && Number.isInteger(t.id) && !profile.cleared.includes(t.id),
  );
  const gained = todo.reduce(
    (n, t) => n + (Number.isFinite(t.xp) && t.xp > 0 ? Math.floor(t.xp) : 0),
    0,
  );
  if (!todo.length)
    return {
      ...profile,
      gained: 0,
      skipped: [],
      levelBefore: levelProgress(profile).level,
      levelAfter: levelProgress(profile).level,
      leveledUp: false,
      xpNoticeId: null,
    };
  const levelBefore = levelProgress(profile).level;
  const next = {
    ...profile,
    xp: profile.xp + gained,
    cleared: [...profile.cleared, ...todo.map((t) => t.id)],
  };
  saveProfile(next);
  const levelAfter = levelProgress(next).level;
  const xpNoticeId = gained
    ? publishXpNotice({ beforeXp: profile.xp, afterXp: next.xp, source: "tutorial-skip" })
    : null;
  return {
    ...next,
    gained,
    skipped: todo.map((t) => t.id),
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
    xpNoticeId,
  };
}

/** 経験値を足す。対局以外(有償ガチャなど)から呼ぶ */
export function addXp(amount, { source = "reward" } = {}) {
  const profile = loadProfile();
  const gained = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  if (!gained)
    return { ...profile, gained: 0, leveledUp: false, xpNoticeId: null };
  const levelBefore = levelProgress(profile).level;
  const next = { ...profile, xp: profile.xp + gained };
  saveProfile(next);
  const levelAfter = levelProgress(next).level;
  const xpNoticeId = publishXpNotice({
    beforeXp: profile.xp,
    afterXp: next.xp,
    source,
  });
  return {
    ...next,
    gained,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
    xpNoticeId,
  };
}
