/**
 * 王の力の、やさしい言い方と図(2026-10-25 本人の指示「王の力とはなにか説明が出るように」)。
 *
 * AI プレイヤー3人の評価が 3点台で止まったので、3人で話し合って決めた設計(design-v2)の形にした:
 *   - 王を選ぶ画面では、タップした駒1つ分だけを、どの数字でも同じ形で見せる
 *       見出し「○を王にすると」→ 図(ふつう → 王)→ 太字の1行 → この盤だけの1行
 *     (2026-10-25 本人の指示で短くした。細かい決まりと使うときの注意は、対局中に使える場面で光と一言で出す)
 *   - 図はいつも 5×5。駒は左下のすみ(a1)から。金色=止まれるマス、赤い丸=相手の駒(うすい=届かない)、×=取られる駒、矢印=動く道すじ
 *   - 距離は「○マスまで」か「盤の端まで」だけ(式は出さない)
 *   - 盤の上のものは「駒」、王の力の動詞は「持つ」。盤に無い場合の話・この盤で起きない話は出さない
 * 数は board.js の rangeBonus・parityMoves と同じ決まり:
 *   2・3 の王 … 1 + 2×枚数 マスまで(枚数は王も含む)。途中の駒は越えない。取られたら盤の同じ数字が新しい王になる(2枚以上残れば選ぶ)
 *   4・5 の王 … 王でない同じ数字が 2 + 2×枚数 マスまで。王でない同じ数字を取った相手の駒も取られる
 *   6〜9 の王 … 止まれるマス(6・7 は2・4…、8・9 は1・3…)にいる相手を取りながら進める。手前で止まってもよい。
 *               止まれないマスの相手は飛び越える。味方は越えられない
 */
import { KING_RANGE_PER_CARD } from "./board.js";

const SIDE = { 2: "縦横", 3: "斜め", 4: "縦横", 5: "斜め", 6: "縦横", 7: "斜め", 8: "縦横", 9: "斜め" };
const DIAG = { 3: true, 5: true, 7: true, 9: true };

/** 1本の線で止まれるマスの数(= 1回の動きで取れる最大の枚数) */
function stopCount(rank, size) {
  const odd = rank === "8" || rank === "9";
  return Math.floor((size - 1 - (odd ? 1 : 2)) / 2) + 1;
}
/** 取れる駒の並び方(6・7 は「1マスあけて、1つとばしに」、8・9 は「すぐ前から、1つとばしに」)。6 と 8 の違いを一言で(評価 10回目) */
const lineWords = (rank) => (rank === "8" || rank === "9" ? "すぐ前から1つとばしに" : "1マスあけて1つとばしに");
/** 6〜9 で最初に取れる駒の場所(6・7 は2マス先、8・9 はすぐ前)。向きも添える */
const firstStop = (rank) => `${SIDE[rank]}${rank === "8" || rank === "9" ? "のすぐ前" : "に2マス先"}`;
/** 1枚目のあと、どこまで取れるか(5×5 は2枚目まで。9×9 はその先も2マスごと) */
const moreStops = (size) => (size > 5 ? "その先も2マスごとに相手を取れる" : "さらに2マス先の相手も取れる");
/** 4・5 の図で、王の4(5)を置くマス。金色(ほかの4・5の行ける先)から離す(近いと王が動けるように見えた。評価 16回目) */
const kingSpot = (rank) => (rank === "4" ? "d4" : "e2");
const reachWords = (reach, size) => (reach >= size - 1 ? "盤の端まで" : `${reach}マスまで`);

/** 相手の駒が出てくる図(6〜9)の上に出す短い見方(凡例が「くわしく」の中だけだと、図の赤い丸が何か分からなかった。評価 8回目) */
export const FOE_LEGEND = "赤い丸は相手の駒。赤い枠は取れる駒。金色は王の力で行けるマス。";
/** 相手の駒が出てこない図の上に出す短い見方 */
export const MOVE_LEGEND = "丸はふつうに行けるマス。金色は王の力で行けるマス。";

/* ---------- 図(5×5)。マスの呼び名は列 a〜e(左から)・段 1〜5(下から)。左下のすみが a1 ---------- */
const FIG = 5;
/** "a1" → { row, col }(row は上から) */
export function figCell(name) {
  return { row: FIG - Number(name.slice(1)), col: name.charCodeAt(0) - 97 };
}
const line = (diag, from, to) => {
  const out = [];
  for (let d = from; d <= to; d++) out.push(diag ? `${String.fromCharCode(97 + d)}${d + 1}` : `a${d + 1}`);
  return out;
};
const row1 = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d++) out.push(`${String.fromCharCode(97 + d)}1`);
  return out;
};
/** 距離 reach まで(図の盤の端で切る)の、a1 からの止まれるマス */
function reachCells(rank, reach) {
  const r = Math.min(reach, FIG - 1);
  return DIAG[rank] ? line(true, 1, r) : [...line(false, 1, r), ...row1(1, r)];
}

/**
 * 1つの図の中身。印は対局の盤と同じにする(図と対局で印がちがうと迷われた。評価 13回目):
 *   pieces: [{ at, rank, king }]  白い四角(自分の駒)
 *   dots:   [at]                  丸 = ふつうに行けるマス(対局の盤の「動ける先」と同じ)
 *   gold:   [at]                  金色 = 王の力で行けるマス(対局で光るマスと同じ)
 *   foes:   [{ at, faded, frame }] 相手の駒(faded=届かない、frame=赤い枠: 取れる)
 *   arrow:  [from, to] | null     動く道すじ
 *   caption 図の下の一言
 */
const fig = (pieces, dots, gold, caption, foes = [], arrow = null) => ({ pieces, dots, gold, foes, arrow, caption });
const minus = (all, some) => all.filter((c) => !some.includes(c));

/** 6〜9 の比べの図(ふつう: 1枚取って止まる/王: 金色まで進んで2枚取れる) */
function captureFigs(rank) {
  const diag = !!DIAG[rank];
  const odd = rank === "8" || rank === "9";
  const [near, far] = odd ? [1, 3] : [2, 4];
  const at = (d) => line(diag, d, d)[0];
  return [
    fig([{ at: "a1", rank }], [], [], "ふつう: 1枚取って止まる", [{ at: at(near), frame: true }, { at: at(far) }], ["a1", at(near)]),
    fig([{ at: "a1", rank, king: true }], [], [at(far)], "王: 2枚まとめて取れる", [{ at: at(near), frame: true }, { at: at(far) }], ["a1", at(far)]),
  ];
}

/**
 * 王を選ぶ画面の、タップした駒1つ分の説明。
 *   rank   王にする駒の数字
 *   count  盤に置いた同じ数字の枚数(王を含む)
 *   size   盤の大きさ(5 か 9)
 *   hasJQ  盤にあなたの J か Q があるか(K のとき)
 * 返すのは { head, figs: [ふつう, 王] | null, bands: "move"|"swap"|null, bold, plain(太字にしない文), board(この盤だけの1行),
 *            active(いまの盤で力を持つか) }
 * 細かい決まり(途中の駒・飛び越え)と使うときの注意は、対局中に力を使える場面で出す(king-power-hint.js)
 */
export function kingPowerCard(rank, count = 1, size = 5, hasJQ = true) {
  const n = Math.max(1, Number(count) || 1);
  const head = `${rank}を王にすると`;
  const base = { head, figs: null, bands: null, bold: null, plain: null, board: null, active: true };
  switch (rank) {
    case "2":
    case "3": {
      const reach = Math.min(1 + KING_RANGE_PER_CARD * n, size - 1);
      const plainCap = rank === "2" ? "ふつう: 縦横1マス" : "ふつう: 斜め1マス";
      return {
        ...base,
        figs: [
          fig([{ at: "a1", rank }], reachCells(rank, 1), [], plainCap),
          fig([{ at: "a1", rank, king: true }], reachCells(rank, 1), minus(reachCells(rank, reach), reachCells(rank, 1)), `王: ${SIDE[rank]}に${reachWords(reach, size)}`),
        ],
        bold: `王の${rank}は、${SIDE[rank]}に${reachWords(reach, size)}動ける。`,
        board:
          n >= 3
            ? `王の${rank}が取られても、盤にほかの${rank}が残っていれば、その中から1枚を選んで新しい王にする。`
            : n === 2
              ? `王の${rank}が取られても、盤にほかの${rank}が残っていれば、その${rank}が新しい王になる。`
              : null,
      };
    }
    case "4":
    case "5": {
      if (n < 2)
        return { ...base, bold: `${rank}を王にすると、ほかの${rank}が強くなる。`, plain: `いまの盤にはほかの${rank}が無いので、この力は起きない。`, active: false };
      const reach = Math.min(2 + KING_RANGE_PER_CARD * n, size - 1);
      // 「強くなるのは、盤のほかの4」は「あなたの王が力を持つ」と逆に見えた(評価 7回目)。だれが強くなるかを先に言う
      return {
        ...base,
        figs: [
          fig([{ at: "a1", rank }, { at: kingSpot(rank), rank }], reachCells(rank, 2), [], `ふつう: ${SIDE[rank]}2マスまで`),
          fig([{ at: "a1", rank }, { at: kingSpot(rank), rank, king: true }], reachCells(rank, 2), minus(reachCells(rank, reach), reachCells(rank, 2)), `ほかの${rank}: ${reachWords(reach, size)}`),
        ],
        // 「王ではない4」が早口言葉のよう(評価 14回目)、説明が長い(評価 16回目)。短い文にする
        bold: `${rank}を王にすると、ほかの${rank}が強くなる。`,
        plain: `ほかの${rank}は、${SIDE[rank]}に${reachWords(reach, size)}動ける。`,
        // 相討ちは王を決める前に要る(評価 18回目。対局中にしか出ていなかった)。短い一文で
        board: `ほかの${rank}を取った相手の駒も、一緒に取られる。`,
      };
    }
    case "6":
    case "7":
    case "8":
    case "9": {
      return {
        ...base,
        figs: captureFigs(rank),
        // 条件として読める文にする(「(2・4マス目)」が謎の言葉だった。評価 16回目)。6 と 8 は「最初に取れる駒の場所」だけが違う
        bold: `ふつうの${rank}は、${firstStop(rank)}の相手を取ったら止まる。王の${rank}は止まらず、${moreStops(size)}。`,
        board: `1枚目で止まってもよい。`,
      };
    }
    case "10":
      // 盤の図で見せる(帯の「→ ①②」は記号のようで目がすべった。評価 12〜15回目)。
      // 10 は c3 から跳ぶ(ふつうの動き)。王は1回目で e4 へ、2回目で c5 へ
      return {
        ...base,
        figs: [
          fig([{ at: "c3", rank }], ["e2", "d1", "e4", "d5", "a2", "b1", "a4", "b5"], [], "ふつう: 1回の番に1回"),
          { ...fig([{ at: "c3", rank, king: true }], ["e4"], ["c5"], "王: 1回の番に2回"), arrows: [["c3", "e4"], ["e4", "c5"]] },
        ],
        bold: "王の10は、1回の番で2回続けて動ける。1回でやめてもよい。",
      };
    case "J":
      return {
        ...base,
        figs: [
          fig([{ at: "a1", rank }], reachCells("2", 4), [], "ふつう: 縦横に何マスでも"),
          fig([{ at: "a1", rank, king: true }], reachCells("2", 4), ["b2"], "王: ＋斜め1マス"),
        ],
        bold: "王のJは、縦横に何マスでも動けるのに加えて、斜めにも1マス動ける。",
      };
    case "Q":
      return {
        ...base,
        figs: [
          fig([{ at: "a1", rank }], reachCells("3", 4), [], "ふつう: 斜めに何マスでも"),
          fig([{ at: "a1", rank, king: true }], reachCells("3", 4), ["a2", "b1"], "王: ＋縦横1マス"),
        ],
        bold: "王のQは、斜めに何マスでも動けるのに加えて、縦横にも1マス動ける。",
      };
    // 「Kは必ず王」を先に(力の説明は後でいい。評価 12回目)
    case "K":
      return hasJQ
        ? { ...base, bold: "Kを置くと、Kが必ず王になる。", plain: "王のKは、JかQが取られると、山札の残りから1枚を盤に出せる。" }
        : // 「何も変わらない」だけでは K の力が分からず、K を置く意味も分からなかった(評価 7回目)
          { ...base, bold: "Kを置くと、Kが必ず王になる。", plain: "王のKは、JかQが取られると、山札の残りから1枚を盤に出せる。いまの盤にはJもQも無いので、この力は起きない。", active: false };
    case "A":
      return { ...base, bands: "swap", bold: "王のAは、入れ替えを1回の番で2回使える。" };
    default:
      return { ...base, active: false };
  }
}

/**
 * 王を選ぶ前に、盤の駒ごとに出す力の一言(タップする前から比べられるように。評価 14・15回目)。
 * 一言は短く(1行に入る長さ)。いまの盤で力が起きなければ active:false
 */
export function kingPowerTag(rank, count = 1, size = 5, hasJQ = true) {
  const n = Math.max(1, Number(count) || 1);
  switch (rank) {
    case "2":
    case "3":
      return { text: `${SIDE[rank]}に${reachWords(Math.min(1 + KING_RANGE_PER_CARD * n, size - 1), size)}`, active: true };
    case "4":
    case "5":
      return n >= 2
        ? { text: `ほかの${rank}が${reachWords(Math.min(2 + KING_RANGE_PER_CARD * n, size - 1), size)}動く。ほかの${rank}を取った相手も取られる`, active: true }
        // 何の力が無いのかを添える(「力なし」だけでは分からなかった。評価 18回目)
        : { text: `ほかの${rank}を強くする力。いまはほかの${rank}が無いので、力なし`, active: false };
    case "6":
    case "7":
    case "8":
    case "9":
      // 6 と 8 が同じ一言にならず、条件として読める文に(評価 16回目)
      return { text: `${firstStop(rank)}の相手を取っても止まらず、${moreStops(size)}`, active: true };
    case "10":
      return { text: "2回続けて動ける", active: true };
    case "J":
      return { text: "斜めにも1マス", active: true };
    case "Q":
      return { text: "縦横にも1マス", active: true };
    case "K":
      return hasJQ ? { text: "JかQが取られると札を出せる", active: true } : { text: "JかQが取られると札を出す力。いまはJもQも無いので、力なし", active: false };
    case "A":
      return { text: "入れ替えを2回", active: true };
    default:
      return { text: "", active: false };
  }
}

/** ステージ前の説明(フェーズ2 第1話)の、2 の比べの図 */
export function introFigs() {
  return [
    fig([{ at: "a1", rank: "2" }], reachCells("2", 1), [], "ふつう: 縦横1マス"),
    fig([{ at: "a1", rank: "2", king: true }], reachCells("2", 1), minus(reachCells("2", 3), reachCells("2", 1)), "王: 縦横に3マスまで"),
  ];
}
/** 相手の王(力なし)の動きの図。2・3 だけ(第1話の相手) */
export function plainFig(rank) {
  if (rank === "2" || rank === "3") return fig([{ at: "a1", rank }], reachCells(rank, 1), [], "");
  return null;
}
