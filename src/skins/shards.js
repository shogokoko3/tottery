/**
 * フォイルの欠片。ダブったフォイルを崩すと出て、持っていないフォイル1枚と交換する。
 *
 * ■ 値づけ(2026-09-10、本人の決め)
 *   崩すと   R 1 / SR 2 / SSR 5
 *   作るのに R 1 / SR 2 / SSR 5(宮殿も空も 5)
 *
 * ■ 根拠
 * 余ったフォイルの一番安い作り方は R の錬成(40 エーテル、完成時 1% でフォイル)で、
 * 期待 4,000 エーテル。だから 1 欠片 ≒ 4,000 エーテル ≒ 毎日遊んで約3週間。
 * SR はその2倍。SSR のダブり(期待 150,000 エーテル)は「1枚で何とでも交換できる」で十分。
 * 交換の値段は、エリアの強さ(R 56〜57% / SR 62% / 宮殿 58% / 空 75%。reports/area-tuning)と
 * 希少さの順に並べてある。空(10)は入手が難しい分、強いまま残す。
 *
 * ■ 決まり
 * - 欠片が出るのは、そのフォイルの2枚目以降だけ(最後の1枚は残す。エーテルの分解と同じ)
 * - フォイルは崩してもエーテルにならない。欠片だけ(エーテルより値打ちが高いので迷わせない)
 * - 交換で作れるのは「持っていないフォイル」だけ。各キャラ1回(1枚あれば装備できる)
 * - 早期特典・特別スキンにフォイルは無い。対象はガチャの15キャラ(POOL)だけ
 * - 交換で得たフォイルも通算獲得に数える(ガチャ・錬成・配布と同じ)
 */
import { POOL, baseSkinId, byId, foilId } from "./catalog.js";
import { heldOf } from "./ether.js";

export const SHARD_NAME = "フォイルの欠片";

/** フォイルのダブりを崩すと出る欠片 */
export const SHARD_VALUE = Object.freeze({ R: 1, SR: 2, SSR: 5 });

/** フォイル1枚と交換するのに要る欠片 */
export const EXCHANGE_COST = Object.freeze({ R: 1, SR: 2, SSR: 5 });

/** いま持っている欠片 */
export function shardsOf(state) {
  const n = state?.shards;
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/** そのフォイルを崩すと出る欠片。フォイル以外は 0 */
export function shardValueOf(skin) {
  const s = typeof skin === "string" ? byId(skin) : skin;
  return s && s.foil ? SHARD_VALUE[s.rarity] || 0 : 0;
}

/** そのキャラのフォイルと交換するのに要る欠片。対象外は null */
export function exchangeCostOf(skin) {
  const s = typeof skin === "string" ? byId(skin) : skin;
  const base = s && byId(baseSkinId(s.id));
  if (!base || !POOL.some((p) => p.id === base.id)) return null;
  return EXCHANGE_COST[base.rarity] ?? null;
}

/** 崩して欠片にできるか。理由も返す(画面にそのまま出す) */
export function shatterCheck(state, id) {
  const skin = byId(id);
  if (!skin) return { ok: false, why: "その札はありません。" };
  if (!skin.foil) return { ok: false, why: "欠片になるのはフォイルだけです。" };
  const held = heldOf(state, id);
  if (held === 0) return { ok: false, why: "持っていません。" };
  if (held < 2) return { ok: false, why: "最後の1枚は崩せません。" };
  return { ok: true, gain: shardValueOf(skin) };
}

/** 欠片で作れるか。理由も返す */
export function exchangeCheck(state, baseId) {
  const base = byId(baseSkinId(baseId));
  const cost = base ? exchangeCostOf(base) : null;
  if (!base || cost === null)
    return { ok: false, why: "このキャラのフォイルは交換できません。" };
  const id = foilId(base.id);
  if (heldOf(state, id) > 0)
    return {
      ok: false,
      why: "このフォイルはもう持っています。交換は持っていない札だけです。",
      cost,
    };
  const have = shardsOf(state);
  if (have < cost)
    return {
      ok: false,
      why: `${SHARD_NAME}があと ${cost - have} 足りません。`,
      cost,
      short: cost - have,
    };
  return { ok: true, cost };
}

/** 崩せるフォイルの一覧(2枚目以降があるもの)。多く出る順 */
export function foilSpares(state) {
  return POOL.map((base) => byId(foilId(base.id)))
    .map((skin) => ({
      skin,
      spare: Math.max(0, heldOf(state, skin.id) - 1),
      gain: shardValueOf(skin),
    }))
    .filter((row) => row.spare > 0)
    .sort((a, b) => b.gain * b.spare - a.gain * a.spare);
}
