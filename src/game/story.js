/**
 * ストーリー(2026-09-30 本人の指示。設計は ストーリーとフェーズ.md)。
 *
 * 王の軸で作った 7 ステージ: 2・3 / 4・5 / 6・7 / 8・9 / 10 / J・Q / K(2026-09-30 に J・Q と K を分けた)。
 * 同じ 7 ステージをフェーズごとに一周する(1: 王の力なし / 2: 王の力あり / 3: エリアあり)。
 *
 * 1 ステージ = CPU 戦。盤はフェーズ1 が 5×5、フェーズ2 からは 9×9(phase.js stageSize)。**相手(CPU)の王はその軸の数字**
 * (CPU はその軸の札が王になるように引き直し・王選び・配置をする。cpuAxis で伝える)。
 * 勝てばクリア。褒美はガチャチケット STORY_TICKETS 枚(サーバーの道 kind=story)。
 *
 * 始める前に、相手の王の特徴を毎回説明する(本人の指示)。中身はフェーズで変わる:
 *   1: 駒の動き方だけ(MOVE_TEXT)  2: 王の力(KING_TEXT)  3: エリアの効果(AREA_INFO)
 * 文はルールの持ちものをそのまま引く。ここに書き写すと、ルールを直したとき嘘になる。
 *
 * 決めごとの控え(未定): ステージごとの xp の量。いまは STORY_XP で仮置き
 */
import { MOVE_TEXT, KING_TEXT } from "./constants.js";
import { AREA_BY_RANK, AREA_INFO } from "./areas.js";
import { buildDeck, shuffle } from "./board.js";
import { josekiDeck } from "./cpu-joseki.js";
import { STORY_TICKETS, normalizePhase, normalizeStory, phaseOf, rulesForPhase, setupFlagsForPhase, stageSize } from "./phase.js";

/** ステージ。並びは STORY_AXES と同じ */
export const STORY_STAGES = Object.freeze([
  Object.freeze({ axis: "23", ranks: Object.freeze(["2", "3"]), name: "二と三", tagline: "小回りの王。近くで討ち合う" }),
  Object.freeze({ axis: "45", ranks: Object.freeze(["4", "5"]), name: "四と五", tagline: "二歩の王。仲間と並んで押す" }),
  Object.freeze({ axis: "67", ranks: Object.freeze(["6", "7"]), name: "六と七", tagline: "偶数マスの王。飛び石で迫る" }),
  Object.freeze({ axis: "89", ranks: Object.freeze(["8", "9"]), name: "八と九", tagline: "奇数マスの王。一歩から遠くまで" }),
  Object.freeze({ axis: "10", ranks: Object.freeze(["10"]), name: "十", tagline: "跳ぶ王。間の駒を飛び越える" }),
  Object.freeze({ axis: "jq", ranks: Object.freeze(["J", "Q"]), name: "JとQ", tagline: "果てまで走る王。縦横か斜めに一直線" }),
  Object.freeze({ axis: "k", ranks: Object.freeze(["K"]), name: "K", tagline: "縦横斜めに走り、跳ぶこともできる王" }),
]);

/** ステージごとの xp(仮置き。本人が決めるまでの値) */
export const STORY_XP = 300;

export function stageOf(axis) {
  return STORY_STAGES.find((s) => s.axis === axis) || null;
}

/** 並びで次のステージ(クリアの有無は見ない)。最後なら null */
export function stageAfter(axis) {
  const i = STORY_STAGES.findIndex((s) => s.axis === axis);
  return i < 0 ? null : STORY_STAGES[i + 1] || null;
}

/**
 * 対局後の「次のステージへ」。いまの軸の**次から順に**、まだクリアしていないステージを探す
 * (末尾まで無ければ先頭から)。全部クリア済みなら null。
 * 並びの最後(K)を先に勝っても「全ステージクリア」にならないように、クリアの有無を見る
 */
export function nextStageAfter(profile, axis) {
  const list = storyList(profile);
  const i = list.findIndex((s) => s.axis === axis);
  const order = i < 0 ? list : [...list.slice(i + 1), ...list.slice(0, i + 1)];
  return order.find((s) => !s.cleared) || null;
}

/** 数字の並びを「2 か 3」のように読める形に */
export const ranksLabel = (ranks) => ranks.join(" か ");

/**
 * ステージの前に出す、相手の王の説明。フェーズで中身が変わる。
 *   { title, lead, items: [{ rank, text }] , note: string[] }
 * note は1文1行の配列(2026-10-01 本人の指示。長い1行だと語の途中で割れる)
 */
export function stageIntro(axis, phase) {
  const stage = stageOf(axis);
  if (!stage) return null;
  const p = normalizePhase(phase);
  const lead = `相手の王は ${ranksLabel(stage.ranks)}。`;
  if (p === 1)
    return Object.freeze({
      title: `${stage.name}の王`,
      lead,
      // フェーズ1は駒の動き方だけ(2026-09-30 本人の指示)。王の力には触れない
      items: stage.ranks.map((rank) => Object.freeze({ rank, text: MOVE_TEXT[rank] })),
      // 「名乗らない」はやめた(2026-10-01 本人の指示。語りと手引きからも外した言い回し)
      note: Object.freeze(["相手の王を取れば、勝ち。", "王は、伏せたまま。取るまで分からない。"]),
    });
  if (p === 2)
    return Object.freeze({
      title: `${stage.name}の王の力`,
      lead,
      items: stage.ranks.map((rank) => Object.freeze({ rank, text: KING_TEXT[rank] })),
      note: Object.freeze(["王にした駒だけに付く力。", "相手の王の力を読んで討つ。"]),
    });
  const type = AREA_BY_RANK[stage.ranks[0]];
  const area = AREA_INFO[type];
  return Object.freeze({
    title: `${stage.name}の王と${area.name}`,
    lead,
    items: [Object.freeze({ rank: stage.ranks.join("・"), text: `${area.name}: ${area.text}` })],
    // フェーズ3のステージは 9×9。相手(CPU)の王にはフォイルが付くので、相手のエリアは必ず立つ
    note: Object.freeze(["相手の王のエリアが立つ。", "あなたの王も、その数字のフォイルを装備していればエリアが立つ。"]),
  });
}

/**
 * ステージの対局の START_SETUP に足すもの(game.jsx が使う)。
 *   size 5、CPU の王の軸、フェーズの旗。フェーズ<3 ではエリアを立てない
 */
export function stageSetup(axis, phase) {
  const stage = stageOf(axis);
  if (!stage) return null;
  const p = normalizePhase(phase);
  return Object.freeze({
    size: stageSize(p),
    cpuAxis: [...stage.ranks],
    ...setupFlagsForPhase(p),
    areas: rulesForPhase(p).areas,
  });
}

/** その回の CPU の王の数字を1つ決める(軸からランダム。2・3 の回なら 2 か 3) */
export function pickStoryKing(axis, random = Math.random) {
  const stage = stageOf(axis);
  if (!stage) return null;
  return stage.ranks[Math.floor(random() * stage.ranks.length)];
}

/**
 * CPU に渡す「相手のエリア」({ type, king })。定石CPU(cpu-joseki.js josekiCpuAction)は
 * この王の数字を軸に、引き直し・王選び・布陣・指し方を決める。軸は 7 つ、エリアは 6 つ
 * (2・3=土 / 4・5=海 / 6・7=森 / 8・9=氷 / 10=空 / J・Q と K はどちらも宮殿)。
 * フェーズ<3 ではエリアそのものは立たない(定石の指し方だけが残る)。フェーズ3 の 9×9 では相手のエリアが立つ
 */
export function storyCpuArea(axis, king) {
  const stage = stageOf(axis);
  if (!stage || !stage.ranks.includes(king)) return null;
  return Object.freeze({ type: AREA_BY_RANK[king], king });
}

/**
 * 軸の王を**約束する**山札。通常の 52 枚を切り、CPU(後手の席 = player 1)の手札の
 * 先頭に「王の数字 2 枚 + 軸の残りの数字 1 枚ずつ」を積む。残りは人間 13 枚 → CPU の残り → 予備札。
 *
 * 引き直しは乱数(reducer の CONFIRM_MULLIGAN は Math.random)なので、引き直しで狙うだけでは
 * 2・3 の軸でおよそ 3%、10 の軸でおよそ 19% が軸の札を持てない。山札に積めば必ず持つ。
 * 9×9 の定石(josekiDeck)は 9 枚も積むので手の内が読めてしまう。5×5 は 3 枚まで。
 * 人間の 13 枚は積んだ札を除いた残りから配るので、人間の手は普段どおりの乱数
 */
export function storyDeck(axis, king, handSize = 13) {
  const stage = stageOf(axis);
  if (!stage || !stage.ranks.includes(king)) return null;
  const deck = shuffle(buildDeck(null));
  const want = [king, king, ...stage.ranks.filter((r) => r !== king)];
  const used = new Set();
  const stacked = [];
  for (const r of want) {
    const c = deck.find((c) => c.rank === r && !used.has(c.id));
    if (!c) continue;
    used.add(c.id);
    stacked.push(c);
  }
  const rest = deck.filter((c) => !used.has(c.id));
  const human = rest.slice(0, handSize);
  const cpuRest = rest.slice(handSize, handSize + handSize - stacked.length);
  const tail = rest.slice(handSize + handSize - stacked.length);
  return [...human, ...stacked, ...cpuRest, ...tail];
}

/**
 * ステージの山札。5×5 は storyDeck(軸の札を 2〜3 枚積む。10 と K は王の数字 2 枚)、9×9 は定石の山札 josekiDeck
 * (9×9 の「CPUのエリア」練習と同じ。王の数字を先頭に 9 枚積む。9×9 は軍が 9 体なので、それで読まれすぎない)
 */
export function storyDeckFor(axis, king, size) {
  const stage = stageOf(axis);
  if (!stage || !stage.ranks.includes(king)) return null;
  return size === 9 ? josekiDeck(AREA_BY_RANK[king], king) : storyDeck(axis, king);
}

/** 画面に出す一覧。いまのフェーズで、どの軸をクリアしたか */
export function storyList(profile) {
  const phase = phaseOf(profile);
  const cleared = normalizeStory(profile?.story)[phase];
  return STORY_STAGES.map((s) => Object.freeze({ ...s, phase, cleared: cleared.includes(s.axis), tickets: STORY_TICKETS, xp: STORY_XP }));
}

/** 次に遊ぶステージ(いまのフェーズで最初の未クリア)。全部済んでいれば null */
export function nextStage(profile) {
  return storyList(profile).find((s) => !s.cleared) || null;
}

/**
 * 次に遊ぶステージの一行(2026-10-01 本人の指示)。ストーリー一覧の見出しの下と、手引きの最後の札に出す。
 * 導入の終わり(10連のあと)に一覧へ着いた人には「次は、四と五の王。」。全部済んでいれば null
 */
export function nextStageLine(profile) {
  const next = nextStage(profile);
  return next ? `次は、${next.name}の王。` : null;
}

/** この1局で**はじめて**その軸をクリアするか(褒美を二度配らないため、終える前に見る) */
export function storyFreshClear(profile, axis) {
  const phase = phaseOf(profile);
  return !normalizeStory(profile?.story)[phase].includes(axis);
}

/**
 * ステージをクリアした褒美を配る。端末の財布(giveGift)とサーバーの台帳(earnStoryTicket)の両方へ。
 * どちらも失敗しても対局は止めない。返り値は配った枚数
 */
export async function grantStoryReward(phase, axis) {
  if (!stageOf(axis)) return 0;
  const { giveGift } = await import("./gifts.js");
  const { earnStoryTicket } = await import("../net/wallet.js");
  await giveGift({ type: "ticket", amount: STORY_TICKETS }).catch(() => {});
  await earnStoryTicket(normalizePhase(phase), axis).catch(() => {});
  return STORY_TICKETS;
}

/**
 * 導入(はじめての手引き)を見たか。ストーリーをはじめて開いたときに一度だけ出すため(2026-09-30)。
 * 端末ごとの印(localStorage)。消えても導入がもう一度出るだけ。
 * 2026-10-01 本人の指示で手引きは自動で出さなくなった(導入は src/game/intro.js)。いまは画面から呼ばない。
 * 自動で出すのを戻すときのために残す
 */
const PRIMER_SEEN_KEY = "tottery.storyPrimer.v1";
// 保存(setItem)だけが失敗する端末(容量いっぱいなど)でも、この起動のあいだは二度と出さない
let primerSeenThisRun = false;
export function storyPrimerSeen(storage = globalThis.localStorage) {
  if (primerSeenThisRun) return true;
  try {
    return storage.getItem(PRIMER_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}
export function markStoryPrimerSeen(storage = globalThis.localStorage) {
  primerSeenThisRun = true;
  try {
    storage.setItem(PRIMER_SEEN_KEY, "1");
  } catch {
    /* 保存できなくても進める */
  }
}

/**
 * 手引きの最後の札(「あとはストーリーで」)の文。次に遊ぶステージとフェーズに合わせる
 * (「まずは 2 と 3 から。」を固定にすると、進めた人や上のフェーズの人には合わない。2026-09-30 レビュー)。
 * 2行目はストーリー一覧の一行と同じ(nextStageLine。2026-10-01 本人の指示で手引きは自動で出さなくなり、
 * 開くのは一覧の「遊び方」と早見表の「はじめに」だけ。閉じた先の一覧と同じ言葉で次の一歩を示す)
 */
export function primerOutroLines(profile) {
  const phase = phaseOf(profile);
  const first =
    phase >= 3
      ? "ステージごとに、相手の王のエリアを覚えます。"
      : phase === 2
        ? "ステージごとに、相手の王の力を覚えます。"
        : "ステージごとに、相手の王になる駒の動きを覚えます。";
  return [first, nextStageLine(profile) || "ステージは何度でも遊べます。"];
}
