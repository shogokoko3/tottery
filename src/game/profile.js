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
import { findTitle, hasTitle, newlyEarned } from "./titles.js";
import { SECRETS } from "./secrets.js";
import { MAX_LEVEL, XP, levelOfXp, progressOfXp } from "./level.js";
import { publishXpNotice } from "./xp-notices.js";
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
};

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
  };
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

function saveProfile(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // 保存できなくても遊べる方を優先する
  }
}

/**
 * 端末に残っている自分の記録を全部消す。
 *
 * ガイドライン 5.1.1(v)。サーバー側(ranks/<id>)を消すのは
 * src/net/ranking.js の deleteRank() で、画面側が両方を呼ぶ。
 * 消したあとは名前を決める画面からやり直しになる。
 */
export function forgetMe() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {
    // 消せなくても続ける。呼び出し側が改めて空の状態を描く
  }
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

/** 使う称号を選ぶ。持っていないものは受け付けない */
export function saveTitle(id) {
  const profile = loadProfile();
  if (!hasTitle(profile, id)) return profile;
  const next = { ...profile, title: id };
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
