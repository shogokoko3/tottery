/**
 * 導入の振り分け(2026-10-01 本人の指示)。起動から導入の終わりまで、次に出すものを1つに決める。
 *
 *   タイトル → 語り2枚 → はじめの一局(ストーリー「二と三の王」の初回)→ 結果 → 名前 → 門の語り → 10連 → 次の相手の紹介
 *
 * 進みは持ち物から読む(二と三の王のクリア・名前・10連の控え)。足した控えは「語りを見た」だけ。
 * 途中でやめた人は、次の起動で続きへ戻す。画面(screens.jsx)と検査(tools/check-intro.mjs)が同じ関数を呼ぶ。
 *
 * 決まりごと:
 *  - 10連まで済んだ人(いまのテスター)は導入を通さない。名前と10連はくり返さない。
 *    二と三の王が未クリアなら、ストーリー1つ目を開いたときに台本の一局になる(firstGameStage)
 *  - 10連の控えが入る前(2026-09-28 より前)に名前を決めて遊んでいた人も、導入を通さない(earlierTester。
 *    2026-10-05 見直し)。控えが無いので、見ないと語りから出直し、門の無料10連まで出ていた
 *  - 初回の10連を引いて、結果を閉じる前にアプリを閉じた人は、次の起動で結果へ戻す("first-pull"。2026-10-05 見直し)
 *  - 一局を中断した起動のあいだは押し付けない(deferred)。次の起動でまた続きへ
 *  - 合言葉つき(?room=)で開いた起動は、名前を聞いて部屋へ通すだけ(名前は screens.jsx の名前の壁)。導入は次の起動から
 *  - 称号の知らせは導入と相手の紹介のあいだ止めておく(introHoldsTitles)
 */
import { FIRST_GAME } from "./tutorial.js";
import { normalizeStory, phaseOf } from "./phase.js";
import { stageOf } from "./story.js";
import { firstPullDone, firstPullOpen } from "../skins/first-pull.js";

/**
 * 導入の段。null は「導入は済んだ(または今は出さない)」。
 * "first-pull" は、初回の10連の結果を閉じる前にアプリを閉じた人を結果へ戻す段(2026-10-05 見直し)
 */
export const INTRO_STEPS = Object.freeze(["prologue", "first-game", "name", "gate", "first-pull"]);

/**
 * 前の版から遊んでいるテスターか(2026-10-05 見直し)。
 * 10連の控え(firstPullDone)は 2026-09-28 に入り、その版は名前を決めた直後にしか立てなかった。
 * それより前に名前を決めた端末には控えが無い。控えだけで見ると、語り → 一局 → 門(SSR 確定の無料10連)へ
 * 通してしまう(二と三の王をクリア済み・フェーズ2 の人は、いきなり門)。
 * 名前があり、遊んだ跡(対局・チュートリアルのクリア・ガチャ)があり、この端末で導入を始めた控え
 * (introStarted。語りを見た・合言葉つきの起動で来た)が無ければ、前の版の人とみる
 */
export function earlierTester({ profile, collection, started = false } = {}) {
  if (started || !(profile && profile.name) || firstPullDone(collection)) return false;
  const plays = Number(profile.plays) || 0;
  const cleared = Array.isArray(profile.cleared) ? profile.cleared.length : 0;
  const draws = Number(collection && collection.draws) || 0;
  return plays > 0 || cleared > 0 || draws > 0;
}

/**
 * はじめの一局に勝ったか。フェーズ1 の二と三の王のクリアで見る。
 * 昇格した人(フェーズ2 から)はフェーズ1 を全部クリアしているので済んだものとする
 * (台本の一局はフェーズ1 にしか無い。済んだことにしないと、10連のまだな人が行き止まる)
 */
export function firstGameDone(profile) {
  if (phaseOf(profile) > FIRST_GAME.phase) return true;
  return normalizeStory(profile?.story)[FIRST_GAME.phase].includes(FIRST_GAME.storyAxis);
}

/**
 * ストーリーのこのステージを開くと、台本の一局(はじめの一局)になるか。
 * フェーズ1 で二と三の王が未クリアのときだけ。2回目からは、ステージ前の説明と CPU 戦
 */
export function firstGameStage(profile, axis) {
  return axis === FIRST_GAME.storyAxis && phaseOf(profile) === FIRST_GAME.phase && !firstGameDone(profile);
}

/**
 * はじめの一局を、ストーリーのステージとして GameCore に渡す形(game.jsx は tutorial と story を同時に受ける)。
 * 相手の王は台本の王(3♦)。席の名前は「二と三の王」
 */
export function firstGameStory() {
  const stage = stageOf(FIRST_GAME.storyAxis);
  const king = FIRST_GAME.deck.find((c) => c.id === FIRST_GAME.foe.kingId);
  return Object.freeze({
    axis: stage.axis,
    phase: FIRST_GAME.phase,
    size: FIRST_GAME.boardSize,
    king: king ? king.rank : stage.ranks[0],
    title: `${stage.name}の王`,
  });
}

/**
 * 次に出す導入の段。
 *   profile       loadProfile() の形(name・phase・story・plays・cleared)
 *   collection    スキンの持ち物(10連の控え firstPullDone・結果を閉じたか firstPullOpen・draws)
 *   prologueSeen  語りを見たか(prologueSeen())
 *   introStarted  この端末で導入を始めたか(introStarted())。語りを見ていれば始めている
 *   room          合言葉つき(?room=)で開いた起動か
 *   deferred      この起動のあいだ、導入を押し付けないか(一局を中断した)
 * 返すのは "prologue" | "first-game" | "name" | "gate" | "first-pull" | null
 */
export function introStep({ profile, collection, prologueSeen = false, introStarted = false, room = false, deferred = false } = {}) {
  // 合言葉つきの起動は部屋へ(名前が無ければ名前の壁が先に聞く)。導入は次の起動から
  if (room || deferred) return null;
  // 10連まで済んだ(いまのテスター)。名前が無くても、ここでは聞かない(人と遊ぶ前に名前の壁が聞く)。
  // 引いた結果を閉じる前にアプリを閉じていたら、結果から(閉じると次の相手の紹介へ。2026-10-05 見直し)
  if (firstPullDone(collection)) return firstPullOpen(collection) ? "first-pull" : null;
  // 10連の控えが入る前から遊んでいる人(2026-10-05 見直し)。名前と10連はもう済んだものとみる
  if (earlierTester({ profile, collection, started: introStarted || prologueSeen })) return null;
  if (!firstGameDone(profile)) return prologueSeen ? "first-game" : "prologue";
  if (!(profile && profile.name)) return "name";
  return "gate";
}

/**
 * はじめの一局に勝ったら、導入の続き(名前・門の語り → 初回の10連)へ進むか(2026-10-06 見直し)。
 * 結果に光る「門へ進む」を出すかをこれで決める。introStep と同じ決まりで、10連の済んだ人と
 * 前の版のテスター(earlierTester)には出さない。
 * 前は「10連の控えが無い」だけで決めていて、前の版のテスターがストーリーの二と三の王から台本の一局に勝つと、
 * 門の語りから SSR 確定の無料10連まで進めた(タイトルからはホームへ行くのに、ストーリーからは門へ抜けていた)。
 * 勝つ前に決める(勝ったあとの記録を待たない)。勝っても変わらないもの(名前・10連の控え・導入を始めた控え)だけで見る
 */
export function gateAfterFirstGame({ profile, collection, prologueSeen = false, introStarted = false } = {}) {
  if (firstPullDone(collection)) return false;
  return !earlierTester({ profile, collection, started: introStarted || prologueSeen });
}

/**
 * 導入のあいだ称号の知らせを止めるか。語り・名前・門の語り(intro)、はじめの一局、初回の10連。
 * 相手の紹介にも重ねない。閉じるか対局へ進むと再開する。
 * 導入を終えたあと(afterIntro。初回の10連を閉じてから、この起動でホームを開くまで)は、次の対局のあいだも
 * 止める(2026-10-05 見直し。一局と10連で積んだ知らせが、四と五の王のサイコロの上に出ていた)
 */
export function introHoldsTitles({ intro = null, screen = null, firstGame = false, firstPull = false, stageIntro = false, afterIntro = false } = {}) {
  return (
    !!intro ||
    (screen === "story" && !!stageIntro) ||
    (screen === "game" && (!!firstGame || !!afterIntro)) ||
    (screen === "skins" && !!firstPull)
  );
}

/** 導入を終えたあと、ホームを開くまでに出してよい称号の知らせの数(2026-10-05 見直し) */
export const AFTER_INTRO_TITLES = 1;

/**
 * 導入を終えたあとの称号の知らせの数(title-notices.js の limitTitleNotices に渡す)。null は数えない。
 * 一局と10連で「初陣」「至高との邂逅」「召喚者」「図鑑の開拓者」などが一度に積まれる。続けて流すと、
 * 一覧の見出しと「次は、四と五の王。」を 20 秒あまり覆う。一覧では1件だけ、ホーム(menu)で残りを出す
 */
export function introTitleQuota({ afterIntro = false, screen = null } = {}) {
  return afterIntro && screen !== "menu" ? AFTER_INTRO_TITLES : null;
}

/**
 * 語りを見たかの控え(端末ごと)。消えても語りがもう一度出るだけ。
 * 値は "prologue"(語りを見た)か "room"(合言葉つきの起動で、名前のまだ無いうちに来た。語りはまだ。2026-10-05 見直し)
 */
const PROLOGUE_KEY = "tottery.intro.v1";
// 保存(setItem)だけが失敗する端末でも、この起動のあいだは二度と出さない
let prologueSeenThisRun = false;
let introStartedThisRun = false;
export function prologueSeen(storage = globalThis.localStorage) {
  if (prologueSeenThisRun) return true;
  try {
    return storage.getItem(PROLOGUE_KEY) === "prologue";
  } catch {
    // 読めない端末で毎回語りが出るより、盤へ進むほうがよい
    return true;
  }
}
export function markPrologueSeen(storage = globalThis.localStorage) {
  prologueSeenThisRun = true;
  try {
    storage.setItem(PROLOGUE_KEY, "prologue");
  } catch {
    /* 保存できなくても進める */
  }
}

/**
 * この端末で導入を始めたか(2026-10-05 見直し)。語りを見たか、合言葉つきの起動で名前のまだ無いうちに来たか。
 * 前の版のテスター(earlierTester)と見分けるのに使う。合言葉の人は部屋で遊んでも(遊んだ跡が付いても)、
 * 次の起動で導入へ通す。読めない端末では始めたことにする(導入の途中の人を外へ出さない)
 */
export function introStarted(storage = globalThis.localStorage) {
  if (prologueSeenThisRun || introStartedThisRun) return true;
  try {
    const v = storage.getItem(PROLOGUE_KEY);
    return v === "prologue" || v === "room";
  } catch {
    return true;
  }
}
/** 合言葉つきの起動で来た新しい人の控え。語りを見た控え("prologue")は上書きしない */
export function markIntroStarted(storage = globalThis.localStorage) {
  introStartedThisRun = true;
  try {
    if (storage.getItem(PROLOGUE_KEY) !== "prologue") storage.setItem(PROLOGUE_KEY, "room");
  } catch {
    /* 保存できなくても進める */
  }
}
