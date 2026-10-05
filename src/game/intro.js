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
 *  - 一局を中断した起動のあいだは押し付けない(deferred)。次の起動でまた続きへ
 *  - 合言葉つき(?room=)で開いた起動は、名前を聞いて部屋へ通すだけ(名前は screens.jsx の名前の壁)。導入は次の起動から
 *  - 称号の知らせは導入と相手の紹介のあいだ止めておく(introHoldsTitles)
 */
import { FIRST_GAME } from "./tutorial.js";
import { normalizeStory, phaseOf } from "./phase.js";
import { stageOf } from "./story.js";
import { firstPullDone } from "../skins/first-pull.js";

/** 導入の段。null は「導入は済んだ(または今は出さない)」 */
export const INTRO_STEPS = Object.freeze(["prologue", "first-game", "name", "gate"]);

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
 *   profile       loadProfile() の形(name・phase・story)
 *   collection    スキンの持ち物(10連の控え firstPullDone)
 *   prologueSeen  語りを見たか(prologueSeen())
 *   room          合言葉つき(?room=)で開いた起動か
 *   deferred      この起動のあいだ、導入を押し付けないか(一局を中断した)
 * 返すのは "prologue" | "first-game" | "name" | "gate" | null
 */
export function introStep({ profile, collection, prologueSeen = false, room = false, deferred = false } = {}) {
  // 合言葉つきの起動は部屋へ(名前が無ければ名前の壁が先に聞く)。導入は次の起動から
  if (room || deferred) return null;
  // 10連まで済んだ(いまのテスター)。名前が無くても、ここでは聞かない(人と遊ぶ前に名前の壁が聞く)
  if (firstPullDone(collection)) return null;
  if (!firstGameDone(profile)) return prologueSeen ? "first-game" : "prologue";
  if (!(profile && profile.name)) return "name";
  return "gate";
}

/**
 * 導入のあいだ称号の知らせを止めるか。語り・名前・門の語り(intro)、はじめの一局、初回の10連。
 * 相手の紹介にも重ねない。閉じるか対局へ進むと再開する
 */
export function introHoldsTitles({ intro = null, screen = null, firstGame = false, firstPull = false, stageIntro = false } = {}) {
  return !!intro || (screen === "story" && !!stageIntro) || (screen === "game" && !!firstGame) || (screen === "skins" && !!firstPull);
}

/** 語りを見たかの控え(端末ごと)。消えても語りがもう一度出るだけ */
const PROLOGUE_KEY = "tottery.intro.v1";
// 保存(setItem)だけが失敗する端末でも、この起動のあいだは二度と出さない
let prologueSeenThisRun = false;
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
