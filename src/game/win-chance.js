/**
 * オンライン対戦の「勝利チャンス」(2026-09-23 本人の指示)。
 *
 * オンライン対戦(ランダムマッチ。人でも Bot でも)を積極的に遊んでもらうための褒美。
 *   - 1日の上限は3回(WIN_CHANCE_MAX_PER_DAY)
 *   - 1回目は、その日の1戦目〜5戦目のどれかにランダムでチャンスが来る(WIN_CHANCE_WINDOW)
 *   - チャンスの対局に勝てば成功(褒美)。負けたら**次の対局も同じチャンス**(成功するまで持ち越す)
 *   - 2回目は、成功した次の対局を1戦目として、そこから5戦目以内にまたランダム。3回目も同じ
 *   - 日付が変わると1回目からやり直し(日の区切りはミッションと同じ 05:00 JST)
 *
 * 保存は端末(localStorage の tottery.win-chance.v1)。褒美(ガチャチケット)はサーバーの財布に
 * 出来事 id つきで積むので、同じ成功を二度受け取ることはない。
 * 決めごとはここ1か所。画面は game.jsx(開始前の対戦相手の画面と終局画面)。
 */
import { missionPeriods } from "./periodic-missions.js";

export const WIN_CHANCE_MAX_PER_DAY = 3;
export const WIN_CHANCE_WINDOW = 5;
/** 成功1回の褒美。ガチャチケットの枚数 */
export const WIN_CHANCE_REWARD_TICKETS = 1;
export const WIN_CHANCE_KEY = "tottery.win-chance.v1";

/** 何戦目にチャンスが来るか(1〜WIN_CHANCE_WINDOW)をランダムに決める */
export function drawTarget(rng = Math.random) {
  return 1 + Math.min(WIN_CHANCE_WINDOW - 1, Math.floor(rng() * WIN_CHANCE_WINDOW));
}

/** 日の区切り(ミッションと同じ 05:00 JST) */
export function chanceDay(at = Date.now()) {
  return missionPeriods(at).day;
}

/**
 * 保存の形をそろえる。日付が変わっていれば1回目からやり直す。
 *   day    … その日
 *   done   … その日に成功した回数(0〜3)
 *   played … いまの周期(成功した次の対局から)で指した数
 *   target … 何戦目にチャンスが来るか(1〜5)。played+1 がこれに届いた対局からチャンス
 */
export function normalizeWinChance(raw, day, rng = Math.random) {
  const fresh = () => ({ day, done: 0, played: 0, target: drawTarget(rng) });
  if (!raw || typeof raw !== "object" || raw.day !== day) return fresh();
  const done = Math.max(0, Math.min(WIN_CHANCE_MAX_PER_DAY, Math.floor(Number(raw.done) || 0)));
  const played = Math.max(0, Math.floor(Number(raw.played) || 0));
  const target = Number.isInteger(raw.target) && raw.target >= 1 && raw.target <= WIN_CHANCE_WINDOW
    ? raw.target
    : drawTarget(rng);
  return { day, done, played, target, ...(typeof raw.uid === "string" ? { uid: raw.uid } : {}) };
}

/** 次の対局がチャンスか(上限に届いていれば false) */
export function isChanceNext(state) {
  return state.done < WIN_CHANCE_MAX_PER_DAY && state.played + 1 >= state.target;
}

/** その日にあと何回成功できるか */
export function chancesLeft(state) {
  return Math.max(0, WIN_CHANCE_MAX_PER_DAY - state.done);
}

/**
 * 対局が終わったときの更新。
 *   won … true 勝ち / false 負け / null 引き分け
 * 返り値: { state, wasChance, rewarded, done }
 *   チャンスの対局に勝てば rewarded。負け・引き分けは持ち越し(state は played だけ進む)。
 *   成功したら played を 0 に戻し、次の target を引き直す
 */
export function settleWinChance(state, won, rng = Math.random) {
  const wasChance = isChanceNext(state);
  const next = { ...state, played: state.played + 1 };
  if (wasChance && won === true) {
    return {
      state: { ...next, done: state.done + 1, played: 0, target: drawTarget(rng) },
      wasChance,
      rewarded: true,
      done: state.done + 1,
    };
  }
  return { state: next, wasChance, rewarded: false, done: state.done };
}

/** 褒美の出来事 id。同じ日の同じ回は同じ id なので、二度は積まれない */
export function rewardEventId(uid, day, done) {
  return `win-chance:${uid || "local"}:${day}:${done}`;
}

/** 勝利チャンス開始日以降の実在日と、1日3回までの受取番号。未来日は受け付けない。 */
export function validWinChanceReward(day, done, now = Date.now()) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const at = Date.parse(day + "T00:00:00Z");
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === day &&
    day >= "2026-09-23" && day <= chanceDay(now) &&
    Number.isInteger(done) && done >= 1 && done <= WIN_CHANCE_MAX_PER_DAY;
}
/** 配布済みアプリの earn 要求も、認証済みの本人の専用報酬へ寄せる。 */
export function winChanceFromLegacyId(id, now = Date.now()) {
  const m = typeof id === "string" ? /^win-chance:([^:]+):(\d{4}-\d{2}-\d{2}):(\d)$/.exec(id) : null;
  return m && validWinChanceReward(m[2], Number(m[3]), now)
    ? { day: m[2], done: Number(m[3]) } : null;
}

/* ---- 端末への保存 ---- */
function storageOf(storage) {
  if (storage) return storage;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}
export function loadWinChance(at = Date.now(), storage = null, rng = Math.random, uid = null) {
  const st = storageOf(storage);
  let raw = null;
  try {
    raw = st ? JSON.parse(st.getItem(WIN_CHANCE_KEY) || "null") : null;
  } catch {
    raw = null;
  }
  if (uid && raw?.uid && raw.uid !== uid) raw = null;
  return normalizeWinChance(raw, chanceDay(at), rng);
}
export function saveWinChance(state, storage = null) {
  const st = storageOf(storage);
  try {
    if (st) st.setItem(WIN_CHANCE_KEY, JSON.stringify(state));
  } catch {
    /* 保存できない端末では、その場かぎり */
  }
  return state;
}
