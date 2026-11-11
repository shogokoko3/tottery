/**
 * 対局中に「王の力が使える場面」を見つける(2026-10-25 本人の指示「対局中、王の力が使える場面になったら、
 * その場で一言と光で知らせる形にして、説明の画面と王を選ぶ画面は短くしてください」)。
 *
 * 王の力は説明を読むだけでは分かりにくかった(AI プレイヤー3人の評価 11回。2 と 10 以外は文を読まれない)。
 * そこで、力を使える手があるときに、その手だけを光らせて一言で言う。
 *
 * 「力を使える手」= 王の力ありの合法手のうち、王の力なしでは指せない手(行き先か、取る駒が違う手)。
 * 盤・採用枚数・王の数字は、盤の画面で動ける先を出すのと同じもの(getLegalMoves)を使う。
 *   2・3・J・Q・6〜9 … 王自身の手
 *   4・5 … 王ではない同じ数字の手
 *   10・A の2回目 … reducer の extraMoveFor(すでに「もう一度動けます」の帯がある。光と一言だけ足す)
 * K の予備札は、置く場面の画面(ReservePlacer)がすでにあるので扱わない。
 */
import { getLegalMoves, kingPowersOn, kingRankOf } from "./board.js";
import { canUseArea } from "./areas.js";
import { isAutomaticArea } from "./area-presentation.js";
import { areaShort } from "./king-power-text.js";
import { L, isEnglish } from "../i18n/index.js";

const key = (m) => `${m.row},${m.col}`;
const capKey = (m) => (m.captures || (m.capture ? [m] : [])).map(key).sort().join("|");

/** 王の力ありの手のうち、力なしでは指せない手 */
function powerOnlyMoves(piece, board, size, counts, kingRank) {
  const withPower = getLegalMoves(piece, board, size, counts, kingRank);
  const plain = getLegalMoves({ ...piece, powers: false }, board, size, counts, null);
  const seen = new Set(plain.map((m) => `${key(m)}/${capKey(m)}`));
  return withPower.filter((m) => !seen.has(`${key(m)}/${capKey(m)}`));
}

/**
 * いま、その席が王の力を使えるか。使えなければ null。
 *   board  盤の画面に出している盤(アリスの幻を入れた aliceBoard など)。省けば state.board
 * 返すのは { kind, rank, pieceIds: 光らせる駒, moves: { [駒id]: 力を使う手 }, prompt: 選ぶ前の一言, line: 選んだあとの一言 }
 *   kind: "reach"(遠くへ動ける)・"capture"(止まらずに何枚も取れる)・"step"(J・Q の+1マス)・
 *         "others"(4・5: ほかの同じ数字が遠くへ)・"again"(10・A の2回目)
 */
export function kingPowerChance(state, seat, board = null) {
  if (!state || state.phase !== "play" || seat == null || state.currentTurn !== seat) return null;
  if (!kingPowersOn(state, seat)) return null;
  const kingId = state.players?.[seat]?.kingId;
  const king = kingId ? state.pieces?.[kingId] : null;
  // スキンの王(シーズン2)は別の力。ここでは扱わない
  if (!king || !king.alive || king.aliceSkin || king.powers === false) return null;
  const rank = king.rank;
  if (state.extraMoveFor) {
    if (state.extraMoveFor !== king.id) return null;
    return {
      kind: "again",
      rank,
      pieceIds: [king.id],
      moves: {},
      line: rank === "A" ? L("王のAは、この番にもう一度入れ替えられる。") : L("王の10は、この番にもう一度動ける。"),
    };
  }
  const b = board || state.board;
  const size = state.boardSize;
  const counts = state.players[seat].armyRankCounts;
  const kr = kingRankOf(state, seat);
  if (rank === "4" || rank === "5") {
    const moves = {};
    for (const p of Object.values(state.pieces)) {
      if (!p.alive || p.owner !== seat || p.isKing || p.rank !== rank || p.aliceSkin) continue;
      const only = powerOnlyMoves(p, b, size, counts, kr);
      if (only.length) moves[p.id] = only;
    }
    const ids = Object.keys(moves);
    if (!ids.length) return null;
    return {
      kind: "others",
      rank,
      pieceIds: ids,
      moves,
      // 「王ではない4が王の力で」で「王ではないのに王の力?」と止まった(評価 14回目)
      line: L("金色のマスは、王が{rank}なので、ほかの{rank}が行けるマス。相手の駒がほかの{rank}を取ると、その駒も取り除かれる。", { rank }),
      prompt: L("光っている{rank}をタップすると、王の力で行けるマスが金色に光る。", { rank }),
    };
  }
  if (!["2", "3", "6", "7", "8", "9", "J", "Q"].includes(rank)) return null;
  const only = powerOnlyMoves(king, b, size, counts, kr);
  if (!only.length) return null;
  const most = Math.max(...only.map((m) => (m.captures ? m.captures.length : m.capture ? 1 : 0)));
  const kind = ["6", "7", "8", "9"].includes(rank) ? "capture" : rank === "J" || rank === "Q" ? "step" : "reach";
  // 選ぶ前は「どの駒をタップすると光るか」、選んだあとは「金色のマスが何か」を言う
  // (「光ったマスまで」だけでは、ふつうに動けるマスの丸と見分けられなかった。評価 12回目)
  const line =
    kind === "capture"
      ? most >= 2
        ? L("金色のマスまで進むと、{n}枚まとめて取れる。赤い枠のマスで止まってもよい。", { n: most })
        : L("金色のマスは、相手の駒を取っても止まらずに行けるマス。")
      : L("金色のマスは、王の{rank}が王の力で行けるマス。", { rank });
  const prompt =
    kind === "capture" && most >= 2
      ? L("王の{rank}で、相手の駒を{n}枚まとめて取れる。王の{rank}をタップしてみよう。", { rank, n: most })
      : L("王の{rank}をタップすると、王の力で行けるマスが金色に光る。", { rank });
  return { kind, rank, pieceIds: [king.id], moves: { [king.id]: only }, line, prompt };
}

/** 一言のあとに添える、使うときの注意(どの場面でも同じ) */
// 光は相手にも見えるのかと不安がられた(評価 14回目)
// 「気づかれやすい」だけでは何に気をつけるか分からなかった(評価 15回目)。起きることを言う
export const CHANCE_TELL = L("金色のマスに動くと、相手に王を読まれやすい。光はあなたにだけ見える。");

/**
 * 貸し出しのエリア(ストーリーのフェーズ3)の知らせ(2026-10-26 本人の指示「光と一言で知らせる」)。
 *   自分で使うエリア(海・空・宮殿)が使える番 → { kind: "area-ready", line }(画面は「発動」を光らせる)
 *   自動で働くエリア(土・森・氷)が、この番の初めに働いた → { kind: "area-fired", line }
 * 知らせるのは自分のエリアだけ(相手にはエリアが無い)
 */
export function areaChance(state, seat) {
  if (!state || !state.areaLend || state.phase !== "play" || seat == null || state.currentTurn !== seat) return null;
  const area = state.areas?.[seat];
  const info = area && areaShort(area.type);
  if (!info) return null;
  if (!isAutomaticArea(state, area.type)) {
    if (!canUseArea(state, seat).ok) return null;
    // 「毎ターン」を外す(英語は "Every turn, tap" → "Tap")
    const how = isEnglish
      ? info.text.replace(/^Every turn, (\w)/, (m, c) => c.toUpperCase())
      : info.text.replace(/^毎ターン/, ""); // i18n-ignore 文の頭を外す目印
    return { kind: "area-ready", type: area.type, line: L("{name}が使える。{how}", { name: info.name, how }) };
  }
  const last = state.lastArea;
  if (!last || last.player !== seat || last.type !== area.type || area.lastUsedTurn !== (state.turnNo || 0)) return null;
  const n = Array.isArray(last.pieceIds) ? last.pieceIds.length : 0;
  const line =
    area.type === "earth"
      ? last.hit
        ? L("土のエリアが働いた: 相手が動かした駒の正体を見抜いた(あなたにだけ見える)。")
        : L("土のエリアが働いた: 今回は見抜けなかった。")
      : area.type === "forest"
        ? L("森のエリアが働いた: 相手の駒を{n}体見抜いた(あなたにだけ見える)。", { n: n || 2 })
        : L("氷のエリアが働いた: 相手の駒を1体凍らせた(3ターン動けない)。");
  return { kind: "area-fired", type: area.type, line };
}
