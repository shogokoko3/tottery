/**
 * 手に入れたスキンを自動で装備する(2026-09-28 本人の指示)。
 *
 * それまではガチャの結果の画面から1枚ずつ手で装備していた。引いたのに装備し忘れる、
 * 何が新しいのか分からない、という声があったので、手に入れた時点で装備まで済ませる。
 *
 * 決まり(本人の指示そのまま):
 *  - **装備していない段**にだけ自動で装備する
 *  - 通常とフォイルの両方を持っていれば**フォイルを優先**
 *  - **J・Q・K のように「2種類以上のキャラがある段」**は、すでに何か装備していれば触らない。
 *    天使を装備している人に、引いたからといって悪魔を着せない
 *
 * 2種類以上かどうかは札の台帳(catalog.js)から数える。いまは 10(竜騎士・天馬騎士)と
 * J・Q・K(天使・悪魔)がそれ。2〜9 と A は1キャラしかないので、
 * 通常を装備しているところへフォイルが来たら**同じキャラの上位として差し替える**。
 */
import { ALL_SKINS, baseSkinId, byId, foilId } from "./catalog.js";

/** 段ごとの「キャラの数」(フォイルは同じキャラなので数えない) */
const BASES_BY_RANK = (() => {
  const m = {};
  for (const s of ALL_SKINS) {
    const set = (m[s.rank] ||= new Set());
    set.add(baseSkinId(s.id));
  }
  return Object.fromEntries(Object.entries(m).map(([r, set]) => [r, set.size]));
})();

/** その段に2種類以上のキャラがあるか(J・Q・K・10) */
export function rankHasChoice(rank) {
  return (BASES_BY_RANK[rank] || 0) > 1;
}

const owns = (state, id) => !!(state.owned && state.owned[id] > 0);

/**
 * その段で自動装備するものを選ぶ。
 * いま引いたもの(prefer)を先に、次にフォイル、最後に台帳の並び順
 */
function pickFor(state, rank, prefer) {
  const mine = ALL_SKINS.filter((s) => s.rank === rank && owns(state, s.id));
  if (!mine.length) return null;
  const score = (s) =>
    (prefer.includes(s.id) ? 4 : 0) +
    // 引いたもののフォイル版を持っていれば、そちらを先に
    (prefer.some((p) => baseSkinId(p) === baseSkinId(s.id)) ? 2 : 0) +
    (s.foil ? 1 : 0);
  let best = mine[0];
  for (const s of mine) if (score(s) > score(best)) best = s;
  return best.id;
}

/**
 * 持っているスキンを、決まりに沿って自動で装備した state を返す。
 * prefer はいま手に入れた id(あれば優先して着せる)
 */
export function autoEquip(state, { prefer = [] } = {}) {
  if (!state || !state.owned) return state;
  const ids = Array.isArray(prefer) ? prefer.filter((id) => !!byId(id)) : [];
  const equipped = { ...(state.equipped || {}) };
  let changed = false;
  for (const rank of Object.keys(BASES_BY_RANK)) {
    const now = equipped[rank];
    // いま装備しているものを持っていない(崩した)なら、空いているものとして扱う
    const held = now && owns(state, now) ? now : null;
    if (!held) {
      const pick = pickFor(state, rank, ids);
      if (pick && pick !== now) {
        equipped[rank] = pick;
        changed = true;
      } else if (now && !pick) {
        delete equipped[rank];
        changed = true;
      }
      continue;
    }
    // すでに装備している段。2種類以上のキャラがあるなら触らない(本人の指示)
    if (rankHasChoice(rank)) continue;
    // 1キャラだけの段は、同じキャラのフォイルを持っていれば上位へ差し替える
    const foil = foilId(held);
    if (held !== foil && owns(state, foil)) {
      equipped[rank] = foil;
      changed = true;
    }
  }
  return changed ? { ...state, equipped } : state;
}

/** 自動装備で変わる段と札(画面で「装備しました」を出すため) */
export function autoEquipChanges(before, after) {
  const a = before?.equipped || {};
  const b = after?.equipped || {};
  return Object.keys(b)
    .filter((rank) => a[rank] !== b[rank])
    .map((rank) => ({ rank, id: b[rank], from: a[rank] || null }));
}
