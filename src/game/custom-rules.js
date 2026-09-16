/**
 * 詳細設定(カスタムルール)。本人の指示 2026-09-17。
 *
 * フォイルを持ってエリアを解放した人だけが使える(画面側 foilRevealed で門を閉じる)。
 * 決めるのは 3 つ:
 *   ranks  … 使う札(A・2〜10・J・Q・K のオン/オフ)。4 種類以上、J・Q・K 以外を 2 種類以上
 *            (絵札に偏って並べられない手札は数字の札で配り直す(rescueHand)ので、数字が要る)
 *   areas  … 盤面エリアを立てる側。both(両方) / host(作った側だけ) / guest(相手だけ) / none
 *   reveal … 対局開始時に公開する駒。count 枚(王を除いてランダム)、king(王も公開)、
 *            choose(ランダムでなく自分で選ぶ。布陣の確定時に選ぶ)
 *
 * 使う札を減らすと山札が減るので、盤に置く駒の数(採用枚数)と手札も減らす:
 *   採用枚数 = min(盤の決まり(5/9), max(3, floor(種類数 × 盤の決まり / 13)))  … 3 枚を下回らない
 *   手札     = max(採用枚数, min(13, floor(札の枚数 / 3), 2×種類数 − 4))
 *              (予備札が 8 枚以上残るように。引き直しは 4 枚までを 2 人が行う)
 *
 * 設定は START_SETUP の custom に載って両者に届く(通信は版 17 から)。
 */
import { RANKS } from "./constants.js";
import { totalSlots } from "./board.js";
import { AREA_SKIN_SUFFIX } from "./areas.js";

export const CUSTOM_AREA_SIDES = Object.freeze(["both", "host", "guest", "none"]);
export const COURT_RANKS = Object.freeze(["J", "Q", "K"]);
export const MIN_CUSTOM_RANKS = 4;
export const MIN_PLAIN_RANKS = 2;
export const MIN_ARMY = 3;
export const MAX_REVEAL = 8;

/** 盤に置く駒の数。使う札の種類数で減る。3 枚を下回らない */
export function armySizeFor(size, rankCount) {
  const full = totalSlots(size);
  const n = Math.max(0, Math.floor(Number(rankCount) || 0));
  return Math.min(full, Math.max(MIN_ARMY, Math.floor((n * full) / RANKS.length)));
}

/** 配る手札の枚数 */
export function handSizeFor(size, rankCount) {
  const n = Math.max(0, Math.floor(Number(rankCount) || 0));
  const army = armySizeFor(size, n);
  return Math.max(army, Math.min(13, Math.floor((n * 4) / 3), 2 * n - 4));
}

/** 使う札の並びを RANKS の順に直す。使えない並びなら null */
export function normalizeRanks(raw) {
  if (!Array.isArray(raw)) return null;
  const set = new Set(raw.filter((r) => typeof r === "string"));
  const ranks = RANKS.filter((r) => set.has(r));
  if (ranks.length < MIN_CUSTOM_RANKS) return null;
  if (ranks.filter((r) => !COURT_RANKS.includes(r)).length < MIN_PLAIN_RANKS) return null;
  return ranks;
}

/** 公開の設定を整える */
function normalizeReveal(raw, army) {
  const r = raw && typeof raw === "object" ? raw : {};
  const max = Math.max(0, Math.min(MAX_REVEAL, army - 1));
  const count = Math.max(0, Math.min(max, Math.floor(Number(r.count) || 0)));
  return { count, king: r.king === true, choose: r.choose === true && count > 0 };
}

/**
 * 届いた設定を、使ってよい形に直す。null なら詳細設定なし(クラシック)。
 * 通信で届く手にも通すので、言い値を信じない
 */
export function normalizeCustom(raw, size) {
  if (!raw || typeof raw !== "object") return null;
  const ranks = normalizeRanks(raw.ranks) || RANKS.slice();
  const areas = CUSTOM_AREA_SIDES.includes(raw.areas) ? raw.areas : "both";
  const army = armySizeFor(size, ranks.length);
  return { ranks, areas, reveal: normalizeReveal(raw.reveal, army) };
}

/** 何も変えていない設定か(クラシックと同じ) */
export function isDefaultCustom(custom) {
  return (
    !custom ||
    (custom.ranks.length === RANKS.length &&
      custom.areas === "both" &&
      custom.reveal.count === 0 &&
      !custom.reveal.king)
  );
}

export const DEFAULT_CUSTOM = Object.freeze({
  ranks: RANKS.slice(),
  areas: "both",
  reveal: { count: 0, king: false, choose: false },
});

/** 使う札のオン/オフを切り替えた並び。最低条件を割るなら変えない(null) */
export function toggleRank(ranks, rank) {
  const next = ranks.includes(rank) ? ranks.filter((r) => r !== rank) : [...ranks, rank];
  return normalizeRanks(next);
}

/** 詰めて書いた札の一覧(2〜9・J のように) */
export function rankListText(ranks) {
  const idx = ranks.map((r) => RANKS.indexOf(r)).sort((a, b) => a - b);
  const parts = [];
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
    parts.push(j - i >= 2 ? `${RANKS[idx[i]]}〜${RANKS[idx[j]]}` : idx.slice(i, j + 1).map((k) => RANKS[k]).join("・"));
    i = j + 1;
  }
  return parts.join("・");
}

export const AREA_SIDE_LABEL = Object.freeze({
  both: "両方",
  host: "自分だけ",
  guest: "相手だけ",
  none: "なし",
});

/** 画面と記録に出す要約 */
export function customSummary(custom, size) {
  if (!custom || isDefaultCustom(custom)) return "クラシック";
  const army = armySizeFor(size, custom.ranks.length);
  const parts = [];
  if (custom.ranks.length !== RANKS.length)
    parts.push(`札 ${rankListText(custom.ranks)}(駒 ${army}枚・手札 ${handSizeFor(size, custom.ranks.length)}枚)`);
  if (custom.areas !== "both") parts.push(`エリア ${AREA_SIDE_LABEL[custom.areas]}`);
  if (custom.reveal.count > 0 || custom.reveal.king)
    parts.push(
      `公開 ${custom.reveal.count}枚${custom.reveal.king ? "＋王" : ""}${custom.reveal.choose ? "(自分で選ぶ)" : ""}`,
    );
  return parts.join(" / ") || "クラシック";
}

/**
 * エリアを立てる側に合わせて装備を直す。立てない側はフォイルを外す(フォイルの王でしかエリアは立たない)。
 * loadouts は [作った側(席0), 相手(席1)]
 */
export function loadoutsForCustom(custom, loadouts) {
  const pair = Array.isArray(loadouts) ? loadouts : [{}, {}];
  if (!custom || custom.areas === "both") return pair;
  const strip = (lo) =>
    Object.fromEntries(
      Object.entries(lo || {}).map(([rank, id]) => [
        rank,
        typeof id === "string" && id.endsWith(AREA_SKIN_SUFFIX) ? id.slice(0, -AREA_SKIN_SUFFIX.length) : id,
      ]),
    );
  if (custom.areas === "none") return [strip(pair[0]), strip(pair[1])];
  if (custom.areas === "host") return [pair[0], strip(pair[1])];
  return [strip(pair[0]), pair[1]];
}
