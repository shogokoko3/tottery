/**
 * 布陣ボーナス。
 *
 * 盤に並べた札の組み合わせで、対局が始まる前に一度だけ効果が起きる。
 *
 *   ストレート … 先手と後手が入れ替わる
 *   フラッシュ … 相手の王以外の駒が公開される(5×5は1枚、9×9は3枚)
 *
 * 判定は盤に出した札すべて(5×5なら5枚、9×9なら9枚)で行う。
 */
import { RANKS } from "./constants.js";
import { territoryRows } from "./board.js";

/** A=1 … K=13 */
function value(rank) {
  return RANKS.indexOf(rank) + 1;
}

function isRun(values) {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  if (sorted.length !== values.length) return false;
  return sorted[sorted.length - 1] - sorted[0] === sorted.length - 1;
}

/**
 * 数字が途切れずに並んでいるか。
 * Aは一番弱い札だが、K の上に置く数え方(10-J-Q-K-A)も認める。
 */
export function isStraight(cards) {
  if (!cards || cards.length < 3) return false;
  const values = cards.map((c) => value(c.rank));
  if (isRun(values)) return true;
  if (!values.includes(1)) return false;
  return isRun(values.map((v) => (v === 1 ? 14 : v)));
}

/** すべて同じマークか */
export function isFlush(cards) {
  if (!cards || cards.length < 3) return false;
  return cards.every((c) => c.suit === cards[0].suit);
}

/** フラッシュで公開される枚数 */
export function revealCount(size) {
  return size >= 9 ? 3 : 1;
}

/** 文字列から数を作る。同じ文字列からは必ず同じ数が出る */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 公開する駒を選ぶ。
 *
 * 乱数を使わず、両者の布陣から決める。オンラインでは同じアクション列を
 * 両者が再生するので、ここで乱数を引くと画面がずれてしまう。相手の布陣は
 * 伏せられているから、どの駒が選ばれるかは誰にも読めない。
 */
export function pickRevealed(ids, count, seedText) {
  const rest = [...ids].sort();
  const out = [];
  let h = hash(seedText);
  while (out.length < count && rest.length) {
    h = hash(`${h}:${out.length}`);
    out.push(rest.splice(h % rest.length, 1)[0]);
  }
  return out;
}

/* ---------------------------- 隅の要塞 ---------------------------- */

/**
 * 隅の要塞。9×9で、自陣の隅の 3×3 を自分の9体で埋め、王をいちばん奥の隅に
 * 置いた布陣。効果は無く、組んだ本人にだけ演出と称号「堅牢な要塞」を出す
 * (相手に知らせると王の位置が漏れるので、state にも記録にも載せない)。
 *
 * 組んだ隅の左端の列(0 か size-3)を返す。要塞でなければ null。
 */
export function fortressCorner(pieces, size, player) {
  if (size < 9) return null;
  const mine = Object.values(pieces || {}).filter(
    (p) => p.owner === player && p.alive,
  );
  if (mine.length !== 9) return null;
  const [lo, hi] = territoryRows(size, player);
  const back = player === 0 ? hi : lo;
  const king = mine.find((p) => p.isKing);
  if (!king) return null;
  for (const col0 of [0, size - 3]) {
    const inBlock = mine.every(
      (p) => p.row >= lo && p.row <= hi && p.col >= col0 && p.col < col0 + 3,
    );
    if (!inBlock) continue;
    const cornerCol = col0 === 0 ? 0 : size - 1;
    return king.row === back && king.col === cornerCol ? col0 : null;
  }
  return null;
}

export function isFortress(pieces, size, player) {
  return fortressCorner(pieces, size, player) !== null;
}

/* ---------------------------- 布陣の型 ---------------------------- */

/**
 * 布陣の型。エリアが立っているときに、決まった9枚を決まった形に組んで対局を始めると、
 * 組んだ本人にだけ演出と称号を出す(相手に知らせると王の位置が漏れるので、state にも
 * 記録にも載せない)。実測(reports/fortress-tactics)で各エリアの最適解だった形。
 *
 * cells は [前列からの深さ, 左端からの列, ランク, 王か]。左右対称(鏡写し)は同じ形。
 * edge が真なら自陣の隅(左端か、鏡写しで右端)に組んだときだけ。そうでなければ横のずらしも同じ形。
 */
export const FORMATIONS = Object.freeze([
  {
    id: "twin-wings",
    name: "双翼の陣",
    title: "双翼の将",
    area: "sky",
    flavor: "空のエリアに、10を2枚そろえて王を隠し、J・Qの4枚で取り返しを利かせた布陣。",
    counts: { 10: 2, J: 2, Q: 2, 4: 1, 2: 1, 8: 1 },
    width: 5,
    cells: [
      [0, 0, "Q"],
      [0, 1, "J"],
      [0, 2, "J"],
      [0, 3, "Q"],
      [1, 0, "8"],
      [1, 1, "2"],
      [1, 2, "4"],
      [1, 4, "10"],
      [2, 2, "10", true],
    ],
  },
  {
    // 土「継承の狩り」: 2を4枚(王の射程9、倒れても継ぐ)。王は中列で前線に立つ
    id: "heir-hunt",
    name: "継承の狩り",
    title: "軌跡の追跡者",
    area: "earth",
    flavor: "土のエリアに、2を4枚そろえて王を中列に据えた布陣。王ごと前に出て、正体の分からない駒を狩る。",
    counts: { 2: 4, J: 2, Q: 2, 10: 1 },
    width: 5,
    cells: [
      [0, 0, "J"],
      [0, 1, "J"],
      [0, 3, "Q"],
      [1, 0, "2"],
      [1, 1, "2", true],
      [1, 4, "Q"],
      [2, 0, "2"],
      [2, 1, "2"],
      [2, 2, "10"],
    ],
  },
  {
    // 森「消去法の詰め」: 隅の3×3。4回の発動で王以外を全部見抜き、残った1体を10×2とJ・Qで詰める
    id: "elimination",
    name: "消去法の詰め",
    title: "静寂な狩人",
    area: "forest",
    flavor: "森のエリアに、隅の3×3で6の王を固めた布陣。王以外を全部見抜いて残った1体を、10とJ・Qで詰める。",
    counts: { 6: 1, J: 2, Q: 2, 10: 2, 4: 1, 2: 1 },
    width: 3,
    edge: true,
    cells: [
      [0, 0, "Q"],
      [0, 1, "10"],
      [0, 2, "J"],
      [1, 0, "4"],
      [1, 1, "2"],
      [1, 2, "J"],
      [2, 0, "6", true],
      [2, 1, "Q"],
      [2, 2, "10"],
    ],
  },
  {
    // 海「道連れの特攻」: 4を4枚(仲間の射程10、取られても道連れ)。王は後列でJ・Qと4が守り、仲間の4が縦に並ぶ
    id: "kamikaze",
    name: "道連れの特攻",
    title: "荒波の航海士",
    area: "sea",
    flavor: "海のエリアに、4を4枚そろえて王を後列に守った布陣。仲間の4が道連れ覚悟で突っ込み、海で崩した守りを食い破る。",
    counts: { 4: 4, J: 2, Q: 2, 10: 1 },
    width: 5,
    cells: [
      [0, 0, "Q"],
      [0, 3, "J"],
      [0, 4, "4"],
      [1, 1, "Q"],
      [1, 2, "10"],
      [1, 3, "J"],
      [1, 4, "4"],
      [2, 3, "4", true],
      [2, 4, "4"],
    ],
  },
  {
    // 宮殿「昇格の砦」: K王＋J・Q＋10×3＋9＋4・2 の通常配置。隅の要塞は6王に一列刈られるので組まない
    id: "royal-road",
    name: "昇格の砦",
    title: "覇道",
    area: "palace",
    flavor: "宮殿に、10を3枚と9を昇格の種に据えた布陣。毎手番の昇格で仲間を育て、倒れたJ・Qは予備札で呼び戻す。",
    counts: { K: 1, J: 1, Q: 1, 10: 3, 9: 1, 4: 1, 2: 1 },
    width: 7,
    cells: [
      [0, 0, "2"],
      [0, 1, "J"],
      [0, 4, "10"],
      [0, 5, "Q"],
      [1, 3, "10"],
      [1, 4, "9"],
      [1, 6, "10"],
      [2, 1, "4"],
      [2, 5, "K", true],
    ],
  },
]);

/** 互換用。双翼の陣の定義 */
export const TWIN_WINGS = FORMATIONS[0];

/** その型に組めていれば { mirror, dx } を、違えば null を返す */
export function formationMatch(state, player, def) {
  const size = state?.boardSize;
  if (!size || size < 9) return null;
  if (state.areas?.[player]?.type !== def.area) return null;
  const mine = Object.values(state.pieces || {}).filter(
    (p) => p.owner === player && p.alive,
  );
  if (mine.length !== 9) return null;
  const counts = {};
  for (const p of mine) counts[p.rank] = (counts[p.rank] || 0) + 1;
  for (const [rank, n] of Object.entries(def.counts))
    if (counts[rank] !== n) return null;
  const [lo, hi] = territoryRows(size, player);
  const front = player === 0 ? lo : hi;
  const dir = player === 0 ? 1 : -1;
  const maxDx = def.edge ? 0 : size - def.width;
  for (const mirror of [false, true])
    for (let dx = 0; dx <= maxDx; dx++) {
      const ok = def.cells.every(([depth, c, rank, king]) => {
        const col = mirror ? size - 1 - (c + dx) : c + dx;
        const row = front + depth * dir;
        const p = mine.find((q) => q.row === row && q.col === col);
        return !!p && p.rank === rank && !!p.isKing === !!king;
      });
      if (ok) return { mirror, dx };
    }
  return null;
}

/** 組めている型をすべて返す(通常は0か1つ) */
export function matchFormations(state, player) {
  return FORMATIONS.map((def) => {
    const hit = formationMatch(state, player, def);
    return hit ? { def, ...hit } : null;
  }).filter(Boolean);
}

/** 互換用。双翼の陣なら { mirror, dx } */
export function twinWingsMatch(state, player) {
  return formationMatch(state, player, TWIN_WINGS);
}
