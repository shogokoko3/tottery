/**
 * 初回の10連(2026-09-28 本人の指示)。
 *
 * 導入の最後に引く(2026-10-01 本人の指示)。はじめの一局に勝った褒美として、
 * 名前 → 門の語り のあとに門が開き、結果を閉じると次の相手の紹介へ(振り分けは screens.jsx)。
 * 前は名前を決めた直後、チュートリアルより先に引いていた(「最初にワクワクさせる」「リセマラをしやすく」)。
 * いまは引き直すたびに語りと一局(1〜2分)を通る。リセマラのしやすさより、勝った手ごたえを先に置いた
 *
 * ふつうのガチャと違うところ:
 *  - **チケットを使わない**(まだ1枚も持っていないので)
 *  - **SSR が1枚以上確定**。10枚引いて1枚も出なければ、1枠を SSR に差し替える
 *  - **フォイルは出ない**。初回から最上位が出ると、そのあとの引きが薄くなる。
 *    フォイルは遊んで手に入れるもの、という線を崩さない
 *  - フリーズ(凍る)などの演出は**そのまま**。門も通常どおり
 *
 * 一度きり。引いたら控えを残し、二度目は出さない。
 * 結果を閉じるまでは、もう1つ控え(firstPullOpen)を立てておく。結果を閉じる前にアプリを閉じた人は、
 * 次の起動で結果へ戻り、閉じると次の相手の紹介へ進む(src/game/intro.js の "first-pull"。2026-10-05 見直し)
 */
import { POOL, baseSkinId, byId } from "./catalog.js";
import { resolveSummonFreeze } from "./summon-freeze.js";

/** 初回に引く枚数 */
export const FIRST_PULL_SIZE = 10;

/** 引いたことの控え(collection の中に持つ) */
export const FIRST_PULL_KEY = "firstPullDone";

/** 差し替えに使える SSR。フォイルは含まない */
const SSR_POOL = POOL.filter((s) => s.rarity === "SSR");

/** 初回の10連の結果をまだ閉じていない控え(collection の中に持つ。2026-10-05 見直し) */
export const FIRST_PULL_OPEN_KEY = "firstPullOpen";

/** もう初回の10連を引いたか */
export function firstPullDone(state) {
  return !!(state && state[FIRST_PULL_KEY]);
}

/**
 * 初回の10連の結果が、まだ閉じられずに残っているか。控えだけでなく結果(pending)もあるときだけ。
 * ふつうのガチャの画面から結果を閉じた人(控えは残るが結果は無い)は、もう戻さない
 */
export function firstPullOpen(state) {
  return !!(
    firstPullDone(state) &&
    state[FIRST_PULL_OPEN_KEY] &&
    Array.isArray(state.pending?.results) &&
    state.pending.results.length
  );
}

/** その id が SSR か(フォイルでも、もとが SSR なら SSR) */
const isSsr = (id) => byId(baseSkinId(id))?.rarity === "SSR";

/**
 * 初回の10連を引く。返すのは id の並び(長さ FIRST_PULL_SIZE)。
 *
 * ふつうの抽選をそのまま使うが、**仕上げ(フォイル)の抽選は通さない**ので
 * 必ず通常版になる。SSR が1枚も無ければ、どこか1枠を SSR に差し替える。
 * random は 0〜1 を返す関数(検査で固定する)
 */
export function drawFirstPull(random = Math.random) {
  const pick = () => {
    const n = random();
    if (!Number.isFinite(n) || n < 0 || n >= 1)
      throw new Error("乱数の範囲が不正です");
    let threshold = n * 100;
    for (const skin of POOL) {
      // catalog.js の rate と同じ重み
      const share =
        ({ R: 65, SR: 32, SSR: 3 }[skin.rarity] || 0) /
        (POOL.filter((p) => p.rarity === skin.rarity).length || 1);
      threshold -= share;
      if (threshold < 0) return skin.id;
    }
    return POOL[POOL.length - 1].id;
  };
  const ids = Array.from({ length: FIRST_PULL_SIZE }, pick);
  if (ids.some(isSsr)) return ids;
  // 1枚も出なかった。どこか1枠を SSR にする(いつも同じ場所だと作り物に見える)
  const slot = Math.min(FIRST_PULL_SIZE - 1, Math.floor(random() * FIRST_PULL_SIZE));
  const ssr = SSR_POOL[Math.min(SSR_POOL.length - 1, Math.floor(random() * SSR_POOL.length))];
  ids[slot] = ssr.id;
  return ids;
}

/**
 * 初回の10連の結果(フリーズの演出つき)。applyPull にそのまま渡せる形。
 * フォイルが混ざっていないことは、ここでも念のため確かめる
 */
export function firstPullResult(random = Math.random) {
  const ids = drawFirstPull(random);
  if (ids.some((id) => id !== baseSkinId(id)))
    throw new Error("初回の10連にフォイルが混ざっています");
  if (!ids.some(isSsr)) throw new Error("初回の10連に SSR がありません");
  // フリーズの演出はそのまま。ただし**フォイルへの昇格だけは起こさない**
  const out = resolveSummonFreeze(ids, random, { allowFoil: false });
  if (out.skins.some((id) => id !== baseSkinId(id)))
    throw new Error("フリーズで初回の10連にフォイルが混ざりました");
  return out;
}

/** 引いたことを控える(二度目は出さない)。結果を閉じるまでの控えも同じ更新で立てる */
export function markFirstPull(state) {
  return { ...state, [FIRST_PULL_KEY]: true, [FIRST_PULL_OPEN_KEY]: true };
}

/** 結果から盤上の姿を見せる一枚。次のステージで使える装備を優先し、未装備とは区別する。 */
export function firstPullCompanion(state, pool = null) {
  const drawn = (state?.pending?.results || []).map((r) => byId(r.id)).filter(Boolean);
  const equipped = drawn.filter((s) => state.owned?.[s.id] > 0 && state.equipped?.[s.rank] === s.id);
  const usable = (s) => !pool || pool.includes(s.rank);
  const skin = equipped.find(usable) || equipped[0] || drawn[0];
  return skin ? { skin, equipped: equipped.includes(skin), available: usable(skin) } : null;
}
