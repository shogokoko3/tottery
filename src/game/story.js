/**
 * ストーリー(2026-09-30 本人の指示。設計は ストーリーとフェーズ.md)。
 *
 * 王の軸で作った 7 ステージ: 2・3 / 4・5 / 6・7 / 8・9 / 10 / J・Q / K(2026-09-30 に J・Q と K を分けた)。
 * 同じ 7 ステージをフェーズごとに一周する(1: 王の力なし / 2: 王の力あり / 3: エリアあり)。
 *
 * 1 ステージ = CPU 戦。盤はフェーズ1・2 が 5×5、フェーズ3 は 9×9(phase.js stageSize)。**相手(CPU)の王はその軸の数字**
 * (CPU はその軸の札が王になるように引き直し・王選び・配置をする。cpuAxis で伝える)。
 * 勝てばクリア。褒美はガチャチケット STORY_TICKETS 枚(サーバーの道 kind=story)。
 *
 * 始める前に、相手の王の特徴を毎回説明する(本人の指示)。中身はフェーズで変わる:
 *   1・2: 駒の動き方(MOVE_TEXT。フェーズ2 は王の力がプレイヤーの席だけなので、相手の王は動きだけ)  3: エリアの効果(AREA_INFO)
 * 文はルールの持ちものをそのまま引く。ここに書き写すと、ルールを直したとき嘘になる。
 *
 * 決めごとの控え(未定): ステージごとの xp の量。いまは STORY_XP で仮置き
 */
import { storyArc, storyEpisode, episodeAccess } from "./story-narrative.js";
import { MOVE_TEXT, SUIT_SYMBOL, movePhrases } from "./constants.js";
import { AREA_BY_RANK, AREA_INFO } from "./areas.js";
import { areaShort, foeKingPowerText } from "./king-power-text.js";
import { buildDeck, shuffle, squareName } from "./board.js";
import { josekiDeck } from "./cpu-joseki.js";
import { L, isEnglish } from "../i18n/index.js";
import { STORY_TICKETS, normalizePhase, normalizeStory, phaseOf, rulesForPhase, storySetupFlags, stageSize } from "./phase.js";

/**
 * 句の並び(画面は句ごとに折り返す)。日本語は句ごと、英語は句の英訳を空白でつないだ1つの句
 * (英語は語の間で折り返せるので、句に切らない)
 */
const P = (...phrases) => (isEnglish ? [capitalize(phrases.join(" "))] : phrases);
// 英語の句は、ほかの画面と同じ訳(文の途中から始まる「or …」など)を使うことがあるので、文頭だけ大文字に
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** ステージ。並びは STORY_AXES と同じ */
export const STORY_STAGES = Object.freeze([
  Object.freeze({ axis: "23", ranks: Object.freeze(["2", "3"]), name: L("二と三"), tagline: L("小回りの王。近くで討ち合う") }),
  Object.freeze({ axis: "45", ranks: Object.freeze(["4", "5"]), name: L("四と五"), tagline: L("二歩の王。仲間と並んで押す") }),
  Object.freeze({ axis: "67", ranks: Object.freeze(["6", "7"]), name: L("六と七"), tagline: L("偶数マスの王。飛び石で迫る") }),
  Object.freeze({ axis: "89", ranks: Object.freeze(["8", "9"]), name: L("八と九"), tagline: L("奇数マスの王。一歩から遠くまで") }),
  Object.freeze({ axis: "10", ranks: Object.freeze(["10"]), name: L("十"), tagline: L("跳ぶ王。間の駒を飛び越える") }),
  Object.freeze({ axis: "jq", ranks: Object.freeze(["J", "Q"]), name: L("JとQ"), tagline: L("果てまで走る王。縦横か斜めに一直線") }),
  Object.freeze({ axis: "k", ranks: Object.freeze(["K"]), name: "K", tagline: L("縦横斜めに走り、跳ぶこともできる王") }),
]);

/** ステージごとの xp(仮置き。本人が決めるまでの値) */
export const STORY_XP = 300;

export function stageOf(axis) {
  return STORY_STAGES.find((s) => s.axis === axis) || null;
}

/** フェーズ1は、この相手までに出会った札で遊ぶ。手札と予備札も一緒に調整する。 */
export function storyLesson(axis, phase = 1) {
  const index = STORY_STAGES.findIndex((s) => s.axis === axis);
  if (index < 0 || normalizePhase(phase) !== 1) return null;
  const pool = STORY_STAGES.slice(0, Math.max(2, index + 1)).flatMap((s) => s.ranks);
  const handSize = [7, 7, 9, 11, 13, 13, 13][index];
  return { pool, handSize };
}

/**
 * 一言の挑戦状と、その局で意識すること。長い会話を挟まず盤につなぐ。
 * aim(この局のねらい。対局説明に出る)の数え方は算用数字(「1枚」「2マス」。2026-10-06 本人の指示)。
 * 「一直線」は言葉なので漢数字のまま
 */
const RIVALS = Object.freeze({
  "23": { name: L("門前の番人"), quote: L("逃げた一枚を、どう読む？"), aim: L("相手の動きから、王を探そう。"), after: L("読みは届いた。門の先へ進め。") },
  "45": { name: L("双歩の衛士"), quote: L("今度は、君の王を探そう。"), aim: L("自分の王に、味方を1枚添えよう。"), after: L("その陣なら、先へ進める。") },
  "67": { name: L("飛び石の旅人"), quote: L("届かないと思った、その先へ。"), aim: L("2マス先から届く手に注目しよう。"), after: L("距離を読めたな。次はもっと遠くだ。") },
  "89": { name: L("遠見の狩人"), quote: L("遠くにいるから、安心かい？"), aim: L("1・3マス先への動きを見よう。"), after: L("遠くの一手まで、見えてきたね。") },
  "10": { name: L("空渡りの騎士"), quote: L("その壁を、越えてみせよう。"), aim: L("駒を飛び越える行き先を見よう。"), after: L("壁の向こうまで、読まれたか。") },
  "jq": { name: L("二筋の宰相"), quote: L("縦横か、斜めか。道を見よ。"), aim: L("一直線に届く道を探そう。"), after: L("道は開いた。玉座で待つ者のもとへ。") },
  "k": { name: L("玉座の主"), quote: L("ここまでの読みを、見せてみよ。"), aim: L("動きと逃げ方から、王を絞ろう。"), after: L("見事だ。その読みを、次の相手へ。") },
});

export function storyRival(axis, phase = 1) {
  if (!RIVALS[axis]) return null;
  const p = normalizePhase(phase);
  const arc = storyArc(axis), episode = storyEpisode(axis, p);
  const voice = episode.before.filter(line => arc.characters.some(c => c.name === line.speaker)).at(-1)
    // i18n-ignore(本文の話者の目印。比べるだけ)
    || episode.before.filter(line => line.speaker !== "語り").at(-1) || episode.before[0];
  return {
    ...RIVALS[axis],
    name: arc.cast,
    skin: false,
    quote: voice.text,
    quoteSpeaker: voice.speaker,
    after: episode.after.at(-1).text,
    // フェーズ2・3 は一言を出さない(すぐ下の欄と同じ話。行を減らして欄を最初の画面に入れる。design-v2)
    aim: p === 1 ? RIVALS[axis].aim : "",
  };
}

/** エリアの一文の句(king-power-text.js の AREA_SHORT で手で切ってある) */
function areaPhrases(type) {
  return areaShort(type)?.phrases || [];
}

/**
 * ストーリーの CPU の手加減(2026-10-26 本人の指示「いちばん良い手をときどき外す形で、ストーリーのCPUを少し弱めて」)。
 * rate の割合で、いちばん良い手の代わりに 2・3 番目の手を選ぶ(いちばん良い手より margin 以上低い手は選ばない)。
 * 王を追い詰める定石の手(cpu-joseki の act)はそのまま。値は CPU どうしの対局で測って決めた(ストーリーとフェーズ.md)
 */
// random: 取られない手の中からでたらめに指す割合(2026-10-26 本人の指示「でたらめな手も織り交ぜる」)
export const STORY_CPU_SLIP = Object.freeze({ rate: 0.3, margin: 12, random: 0.15 });

/** 新規対局の配札。通常のCPU戦・通信対戦の配札には使わない。 */
export function storyDeal(story) {
  if (!story || !stageOf(story.axis)) return null;
  const lesson = storyLesson(story.axis, story.phase);
  return lesson
    ? { ...lesson, deck: storyDeck(story.axis, story.king, lesson.handSize, lesson.pool) }
    : { deck: storyDeckFor(story.axis, story.king, stageSize(story.phase)) };
}

/** 結果で確かめられる事実を一つだけ伝える。未公開の推測やCPUの意図は説明しない。 */
export function storyLossNote(state, seat = 0) {
  if (!state || state.phase !== "gameover" || state.winner == null || state.winner === seat) return null;
  if (state.resignedBy === seat) return { fact: L("今回は、ここで一休み。"), tip: L("同じ相手に、何度でも挑める。") };
  if (state.adjudication) return { fact: L("今回は、採用した札の合計で決着。"), tip: L("次は、判定の前に王を探してみよう。") };
  const king = state.pieces?.[state.players?.[seat]?.kingId];
  const move = state.lastMove;
  const mover = state.pieces?.[move?.pieceId];
  const taken = state.replay?.at(-1)?.mark?.taken || [];
  if (king?.alive === false && mover && move.owner !== seat && move.captured &&
      taken.some((p) => p.owner === seat && p.row === king.row && p.col === king.col)) {
    return {
      fact: L("{piece} の {from} → {to} が、王に届いた。", {
        piece: `${mover.rank}${SUIT_SYMBOL[mover.suit]}`,
        from: squareName(move.from.row, move.from.col, state.boardSize),
        to: squareName(move.to.row, move.to.col, state.boardSize),
      }),
      tip: L("次は、王の近くの相手がどこへ動けるか見よう。"),
    };
  }
  return { fact: L("次の一局で、もう一度読んでみよう。"), tip: L("振り返りで、決着の一手を確かめられる。") };
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
export const ranksLabel = (ranks) => ranks.join(L(" か "));

/**
 * ステージの前に出す、相手の王の説明。フェーズで中身が変わる。
 *   { title, lead, items: [{ rank, text, phrases? }] , note: string[] }
 * フェーズ1 の items は phrases(MOVE_PHRASES の句の並び)も持つ。画面は句ごとに折り返す(2026-10-05 見直し)
 * note は1文1行の配列(2026-10-01 本人の指示。長い1行だと語の途中で割れる)
 */
export function stageIntro(axis, phase) {
  const stage = stageOf(axis);
  if (!stage) return null;
  const p = normalizePhase(phase);
  const lead = L("相手の王は {ranks}。", { ranks: ranksLabel(stage.ranks) });
  if (p === 1)
    return Object.freeze({
      title: L("{name}の王", { name: stage.name }),
      lead,
      // フェーズ1は駒の動き方だけ(2026-09-30 本人の指示)。王の力には触れない
      // 文は MOVE_TEXT のまま。画面は句(phrases)ごとに出す(375 幅で「縦横に2マスま/で。」と割れた)
      items: stage.ranks.map((rank) => Object.freeze({ rank, text: MOVE_TEXT[rank], phrases: Object.freeze([...movePhrases(rank)]) })),
      // 「名乗らない」はやめた(2026-10-01 本人の指示。語りと手引きからも外した言い回し)。
      // 1文1行(2026-10-06 見直し。2文を1行に入れていて、320 幅で「取/るまで分からない。」と割れた。文は変えない)
      note: Object.freeze([L("相手の王を取れば、勝ち。"), L("王は、伏せたまま。"), L("取るまで分からない。")]),
    });
  if (p === 2)
    return Object.freeze({
      title: L("{name}の王", { name: stage.name }),
      lead,
      // フェーズ2 の CPU の王は力なし(2026-10-25 本人の指示「王の力は、プレイヤー側のみが発動できる」)。
      // 相手の王について知ることは動き方だけなので、フェーズ1 と同じく MOVE_TEXT を句ごとに出す
      items: stage.ranks.map((rank) => Object.freeze({ rank, text: MOVE_TEXT[rank], phrases: Object.freeze([...movePhrases(rank)]) })),
      // 相手の王の動きの欄の見出し(王の力の図と取り違えないように。AI プレイヤーの評価 2026-10-25)
      itemsTitle: L("相手の王の動き(王の力なし)"),
      note: Object.freeze([L("王の力は、あなたの王だけが使える。"), L("相手の王は力を持たない。取れば、勝ち。")]),
      // フェーズ2 の第1話では、王の力とは何かを先に見せる(2026-10-25 本人の指示)。図は 2 の王の力なし/ありの比べ。
      // 文は AI プレイヤー3人の評価(1回目 2.0〜2.8)で直した: 「取られても新しい王」を先に言う・1文1つ・用語は「札」「取る」
      ...(axis === "23"
        ? {
            // 一度に覚えられるのは3〜4つ(AI プレイヤーの評価 5回目)。継ぐ話・置く枚数の話は王を選ぶ画面の「この盤では」に任せる
            // AI プレイヤー3人で話し合って決めた形(design-v2): ここでは仕組みだけを3つ教える
            // (王の力は数字で決まる/中身は王を選ぶ画面で見られる/力はあなたの王だけ)。図は 2 の「ふつう → 王」。
            // 動詞は「持つ」(4・5・K は王自身が強くならないので「強くなる」と言わない。「付く」は何に付くか迷う)
            power: Object.freeze({
              title: L("王の力"),
              // 句の塊で出す(「…特別な力を持/つ。」と割れないように)。つなぐと1文
              lines: Object.freeze([
                Object.freeze(P(L("フェーズ2から、"), L("王にした駒の数字で"), L("「王の力」が決まる。"))),
                // 4・5・K は王ではない駒に効く。「王が強くなる」とだけ言うと、王を選ぶ画面の4で食い違って見えた(評価 13回目)
                Object.freeze(P(L("王が強く動ける数字も、"), L("ほかの駒が強くなる数字もある。"))),
              ]),
              // 「3マスまで」は盤の2が1枚のときの数。条件を言わないと決まった数に読まれた(評価 18回目、誤り探し2人)
              example: Object.freeze({ rank: "2", label: L("例: 盤の2が1枚のとき、2を王にすると") }),
              // 数字ごとの中身は、対局中に使える場面で光と一言で教える(2026-10-25 本人の指示。説明の画面は短く)
              after: Object.freeze(P(L("対局中、"), L("王の力で行けるマスが"), L("金色に光る。"))),
              // 「あなたの王だけ」は、ほかの駒に効く4・5・Kと食い違って見えた。「1回」は「2回取る場合もあるのか」と疑われた(評価 7回目)
              // 使うと王だと気づかれやすい、を選ぶ前にも(対局中だけだと、王を選ぶときに代償が分からなかった。評価 12回目)
              rules: Object.freeze([Object.freeze(P(L("王の力は、"), L("あなたの側だけ。"))), Object.freeze(P(L("相手の王には無い。"), L("相手の王を取れば、"), L("あなたの勝ち。"))), Object.freeze(P(L("王の力を使うと、"), L("相手に王を"), L("読まれやすい。")))]),
            }),
          }
        : null),
    });
  // フェーズ3(2026-10-26 本人の指示): 盤は 5×5、相手の王も王の力を持つ、エリアはあなただけ(王にした数字のエリアを貸す)。
  // 題のすぐ下の札(phase3)に、フェーズ3で変わることと相手の王の力をまとめる(案B。2026-10-26 本人の指示)。
  // 結びの行に置くと下の釦に隠れて最初の画面に入らなかった。第1話は「変わること」、2話目からは「決まり」
  return Object.freeze({
    title: L("{name}の王", { name: stage.name }),
    lead,
    items: stage.ranks.map((rank) => Object.freeze({ rank, text: foeKingPowerText(rank) })),
    itemsTitle: L("相手の王の力"),
    phase3: Object.freeze({
      title: axis === "23" ? L("フェーズ3で変わること") : L("フェーズ3の決まり"),
      // 句の塊で出す(語の途中で割らない)。つなぐと1文
      lines: Object.freeze([
        Object.freeze(P(L("相手の王も、"), L("王の力を持つ。"))),
        // エリアは、おすすめの駒(この話の数字)を王にしたときだけ付く。フォイルを着けた札なら、そのフォイルのエリア(2026-10-26 本人の指示)
        Object.freeze(P(L("{ranks}を王にすると、", { ranks: stage.ranks.join(L("か")) }), L("あなたの王に"), L("{area}が付く。", { area: areaShort(storyArea(axis)).name }))),
        Object.freeze(isEnglish ? [areaPhrases(storyArea(axis)).join(" ")] : areaPhrases(storyArea(axis))),
        Object.freeze(P(L("フォイルを着けた札を"), L("王にすると、"), L("そのフォイルのエリアが付く。"))),
        Object.freeze(P(L("対局中、"), L("エリアが使える場面で"), L("光って知らせる。"))),
      ]),
    }),
    note: Object.freeze([]),
  });
}

/**
 * 結びの行(stageIntro の note)を句に切ったもの(2026-10-06 見直し)。画面は句の塊(phrases.jsx の Phrases)で出し、
 * 塊の間でだけ折り返す。読点・句点で切っただけで 320 幅の列に入る行はここに書かない(Phrases がそう切る)。
 * いまは手で切る行が無い(フェーズ3 の結びは題の下の札へ移した。2026-10-26)。行を足したらここに切り方を書く
 */
const NOTE_PHRASES = new Map(
  [].map((phrases) => [phrases.join(""), Object.freeze(phrases)]),
);

/** 結びの1行を句の並びに。手で切った並びが無ければ行のまま返す(Phrases が読点・句点で切る) */
export function notePhrases(line) {
  return NOTE_PHRASES.get(line) || line;
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
    ...storySetupFlags(p),
    areas: rulesForPhase(p).areas,
    // フェーズ3 は話ごとにプレイヤーのエリアを決める(2026-10-26 本人の指示「１話目なら土、２話目なら海」)
    ...(p >= 3 ? { areaTypes: [storyArea(axis), null], areaRanks: [[...stage.ranks], null] } : null),
  });
}

/**
 * フェーズ3 のストーリーで、おすすめの駒を王にしたときに貸すエリア(2026-10-26 本人の指示「１話目なら土、２話目なら海のように」
 * 「推奨の駒を選んだ時のみ」)。話の軸の数字のエリア: 二と三 → 土、四と五 → 海、六と七 → 森、八と九 → 氷、十 → 空、JとQ・K → 宮殿。
 * フォイルを着けた札を王にしたときは、そのフォイルのエリア(areas.js storyAreaFor)
 */
export function storyArea(axis) {
  const stage = stageOf(axis);
  return stage ? AREA_BY_RANK[stage.ranks[0]] || null : null;
}

/** ストーリーの対局を始める旗(START_SETUP に載せる)。フェーズ3 は話のエリアも */
export function storyStartFlags(story) {
  const p = normalizePhase(story?.phase);
  const stage = story ? stageOf(story.axis) : null;
  // フェーズ3: フォイルが無いときは、おすすめの駒(話の軸の数字)を王にしたときだけ話のエリアを貸す(2026-10-26 本人の指示)
  return { ...storySetupFlags(p), ...(p >= 3 && stage ? { areaTypes: [storyArea(story.axis), null], areaRanks: [[...stage.ranks], null] } : null) };
}

/**
 * ストーリーの対局に時計をかけないか(2026-10-01 本人の指示)。フェーズ1 は時間制限なし
 * (サイコロ・引き直し・布陣・持ち時間のどれも動かさない)。はじめて出会うサイコロ・引き直し・陣を急かさないため。
 * フェーズ2・3 は今までどおり(オンラインは story を持たない)
 */
export function storyUntimed(story) {
  return !!story && normalizePhase(story.phase) === 1;
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
 * 軸の王を**約束する**山札。指定した pool(省略時は52枚)を切り、CPU(席1)の手札の
 * 先頭に「王の数字 2 枚 + 軸の残りの数字 1 枚ずつ」を積む。残りは人間の手札 → CPU の残り → 予備札。
 *
 * 引き直しは乱数(reducer の CONFIRM_MULLIGAN は Math.random)なので、引き直しで狙うだけでは
 * 2・3 の軸でおよそ 3%、10 の軸でおよそ 19% が軸の札を持てない。山札に積めば必ず持つ。
 * 9×9 の定石(josekiDeck)は 9 枚も積むので手の内が読めてしまう。5×5 は 3 枚まで。
 * 人間の手札は積んだ札を除いた残りから配る。手札枚数は pool の総数と合わせて storyLesson で決める
 */
export function storyDeck(axis, king, handSize = 13, pool = null) {
  const stage = stageOf(axis);
  if (!stage || !stage.ranks.includes(king)) return null;
  const deck = shuffle(buildDeck(pool));
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
  return STORY_STAGES.map((s) => Object.freeze({ ...s, phase, available: episodeAccess(profile, s.axis, phase).available, cleared: cleared.includes(s.axis), tickets: STORY_TICKETS, xp: STORY_XP }));
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
  return next ? L("次は、{name}の王。", { name: next.name }) : null;
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
  // 1行目は句の並び(Primer は句ごとに折り返す。2026-10-05 見直し。1本の文字列だと
  // 「…駒の動きを / 覚えます。」の手前で語の途中から割れた)。2行目は一覧の一行と同じ文字列(読点で切る)。
  // 言葉は導入の調子(です・ますを使わない。2026-10-06 本人の指示)。句は読点で切り、狭い幅でも読点で折れる
  const first =
    phase >= 3
      ? P(L("ステージごとに、"), L("相手の王のエリアを覚える。"))
      : phase === 2
        ? P(L("ステージごとに、"), L("相手の王の力を覚える。"))
        : P(L("ステージごとに、"), L("相手の王の動きを覚える。"));
  return [first, nextStageLine(profile) || L("ステージは、何度でも遊べる。")];
}
