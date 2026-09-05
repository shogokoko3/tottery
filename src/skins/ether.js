/**
 * エーテル。ダブったスキンを崩して、狙った1枚に作り替えるための素材。
 *
 * ■ 値づけの根拠
 * 分解でもらえる量は「その1枚の出にくさ」に比例させてある。
 * 抽選の中身は R 4枚で65%、SR 4枚で32%、SSR 7枚で3%。1枚あたりだと
 *   R 16.25% / SR 8% / SSR 0.4286%
 * R を 10 とすると SR は 16.25÷8 ≒ 2倍、SSR は 16.25÷0.4286 ≒ 37.9倍。
 * きりのいいところで 10 / 20 / 375 にした。
 *
 * ■ 生成は分解の4倍
 * 同じ格なら「ダブり4枚で、好きな1枚」。R 40 / SR 80 / SSR 1500。
 * 4倍にしたのは、1倍だと交換所になって引く意味が消え、
 * 10倍だと崩しても届かず素材が死ぬため。
 *
 * ■ その結果どうなるか(1回引くごとに入るエーテル)
 *   R から 0.65×10 = 6.5 / SR から 0.32×20 = 6.4 / SSR から 0.03×375 = 11.25
 * なので
 *   R だけを崩して SSR 1枚(1500) → 231回
 *   SR だけを崩して SSR 1枚      → 234回
 *   狙った SSR を運で当てる       → 233回   ← ほぼ同じ手間
 *   引いたものを全部崩す          → 62回    ← 運任せの3.7倍の速さ
 * 「単一の格を崩す道は運と同じ、全部崩せば確実に速い」という形になる。
 * これは狙ってそうしたのではなく、出にくさに比例させた当然の帰結。
 * だから抽選の顔ぶれを変えたら、この数字も一緒に動く(check-ether が見張る)。
 *
 * ■ 決まり
 * - 分解できるのは2枚目から。最後の1枚は残す(装備が消えない)
 * - LIMITED と SPECIAL は分解も生成もできない。一度だけ受け取れる
 *   特典なので、抽選で手に入る札とは別に保管する
 * - 生成は好きな1枚を選ぶ。すでに持っている札も選べる(枚数が増える)
 */
import { ODDS, POOL, byId, rate } from "./catalog.js";

/** 分解でもらえる量 */
export const DUST = Object.freeze({ R: 10, SR: 20, SSR: 375 });

/** 生成は分解の何倍か */
export const CRAFT_RATIO = 4;

/** 生成に要る量 */
export const CRAFT = Object.freeze({
  R: DUST.R * CRAFT_RATIO,
  SR: DUST.SR * CRAFT_RATIO,
  SSR: DUST.SSR * CRAFT_RATIO,
});

/** エーテルの呼び名。画面で何度も出るので1か所に置く */
export const ETHER_NAME = "エーテル";

/** その札を崩すともらえる量。崩せない札は 0 */
export function dustOf(skin) {
  const s = typeof skin === "string" ? byId(skin) : skin;
  return (s && DUST[s.rarity]) || 0;
}

/** その札を作るのに要る量。作れない札は null */
export function costOf(skin) {
  const s = typeof skin === "string" ? byId(skin) : skin;
  if (!s) return null;
  return CRAFT[s.rarity] ?? null;
}

/** 一度だけ受け取れる特典として、錬成の対象外にする札か */
export function isKeepsake(skin) {
  const s = typeof skin === "string" ? byId(skin) : skin;
  return !!s && (s.rarity === "LIMITED" || s.rarity === "SPECIAL");
}

/** いま持っている枚数 */
export function heldOf(state, id) {
  const n = state?.owned?.[id];
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/** 崩してよい枚数。最後の1枚は残すので、所持から1を引いた数 */
export function spareOf(state, id) {
  if (isKeepsake(id)) return 0;
  return Math.max(0, heldOf(state, id) - 1);
}

/** いま持っているエーテル */
export function etherOf(state) {
  const n = state?.ether;
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/** 崩せるか。理由も返す(画面にそのまま出す) */
export function dismantleCheck(state, id) {
  const skin = byId(id);
  if (!skin) return { ok: false, why: "その札はありません。" };
  if (isKeepsake(skin))
    return {
      ok: false,
      why:
        skin.rarity === "SPECIAL"
          ? "特別スキンは崩せません。"
          : "早期特典の札は崩せません。二度と手に入らないためです。",
    };
  if (heldOf(state, id) === 0) return { ok: false, why: "持っていません。" };
  if (spareOf(state, id) === 0)
    return { ok: false, why: "最後の1枚は崩せません。" };
  return { ok: true, gain: dustOf(skin) };
}

/** 作れるか。理由も返す */
export function craftCheck(state, id) {
  const skin = byId(id);
  if (!skin) return { ok: false, why: "その札はありません。" };
  if (isKeepsake(skin))
    return {
      ok: false,
      why:
        skin.rarity === "SPECIAL"
          ? "特別スキンはエーテルで作れません。"
          : "早期特典の札は作れません。",
    };
  const cost = costOf(skin);
  if (cost === null) return { ok: false, why: "この札は作れません。" };
  const have = etherOf(state);
  if (have < cost)
    return {
      ok: false,
      why: `あと ${cost - have} 足りません。`,
      cost,
      short: cost - have,
    };
  return { ok: true, cost };
}

/** 崩せる札の一覧。多くもらえる順に並べる */
export function spares(state, skins) {
  return skins
    .map((skin) => ({
      skin,
      spare: spareOf(state, skin.id),
      gain: dustOf(skin),
    }))
    .filter((row) => row.spare > 0)
    .sort((a, b) => b.gain * b.spare - a.gain * a.spare);
}

/** その量を全部崩すと、どれだけになるか(「全部崩す」の下見に使う) */
export function totalOfSpares(state, skins) {
  return spares(state, skins).reduce((sum, r) => sum + r.gain * r.spare, 0);
}

/** ある札を作るのに、その格のダブりが何枚要るか。説明文に使う */
export function sparesNeeded(target, source) {
  const cost = costOf(target);
  const gain = dustOf(source);
  if (!cost || !gain) return null;
  return Math.ceil(cost / gain);
}

/**
 * 画面に出す「目安」の数字を、抽選の中身から毎回引き直す。
 *
 * 手で書いておくと、抽選の顔ぶれを変えたときに片方だけ古いまま残る。
 * (実際に竜騎士を SSR に移したとき、表の1か所が取り残された)
 */
export function forgeSummary() {
  const ranks = ["R", "SR", "SSR"];
  const perPull = (r) => (ODDS[r] / 100) * DUST[r];
  const rows = ranks.map((rarity) => {
    const sample = POOL.find((s) => s.rarity === rarity);
    return {
      rarity,
      dust: DUST[rarity],
      craft: CRAFT[rarity],
      // その格の1枚を狙って当てるまでの平均回数
      pulls: sample ? Math.round(100 / rate(sample)) : null,
      // SSR 1枚ぶんを、その格のダブりだけで貯めるなら何枚・何回引くぶんか
      cardsForTop: Math.ceil(CRAFT.SSR / DUST[rarity]),
      pullsForTop: Math.round(CRAFT.SSR / perPull(rarity)),
    };
  });
  const all = ranks.reduce((sum, r) => sum + perPull(r), 0);
  return {
    rows,
    // 引いたものを全部崩したときに、SSR 1枚が何回で貯まるか
    pullsIfAll: Math.round(CRAFT.SSR / all),
    byId: (rarity) => rows.find((r) => r.rarity === rarity),
  };
}
