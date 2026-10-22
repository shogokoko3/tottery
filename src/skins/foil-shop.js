/**
 * フォイルの直接購入(有償ジェムだけ)。
 *
 * ガチャでフォイルを引いた直後に「ほかのフォイルも」として出す(本人の指示 2026-09-16)。
 * 商品は帯ごとのセット。値段は本人の決め(1〜4 は入手難易度の順、5〜9 は 5,000 で統一)。
 *  - 買えるのは持っていないフォイルだけ。セットの一部を持っていれば、残りを按分の値段で
 *  - **有償ジェムだけで払う**(無償ジェムは使えない。src/server/wallet.js の paidOnly)
 *  - 商品10(A のフォイル)は「A のフォイル以外の全カードをそろえた人」にだけ見せる(secret)。
 *    そろうまでは存在すら出さない。購入時にもサーバーへ同期した所持一覧を全件照合する。
 *  - アリスのフォイル(secret, series:"alice")も同じ決まりで、ワンダーランドの全カードをそろえた人にだけ(2026-10-15 本人の指示)
 *  - ワンダーランド・ゲートにも同じ仕組み(2026-10-15 本人の指示)。商品はシリーズごと(series)。帯と値段は
 *    レジェンド・ゲートと同じ数字の組(2・3 / 4・5 / 6・7 / 8・9 / 10)。J・K はセット、Q は単体(本人の決め)。72時間の欄もシリーズごとに別
 *  - サーバーとアプリの両方がこのファイルを読む(値段はサーバーがここから決める。端末の言い値は使わない)
 */
import { ALL_SKINS, SERIES, baseSkinId, byId, foilId, poolForSeries } from "./catalog.js";

export const FOIL_PRODUCTS = Object.freeze(
  [
    {
      id: "foil-2-3",
      series: "heroes",
      name: "2・3 のフォイルセット",
      skins: ["zombie-male", "zombie-female"],
      price: 1500,
    },
    {
      id: "foil-4-5",
      series: "heroes",
      name: "4・5 のフォイルセット",
      skins: ["pirate-male", "pirate-female"],
      price: 1500,
    },
    {
      id: "foil-6-7",
      series: "heroes",
      name: "6・7 のフォイルセット",
      skins: ["elf-male", "elf-female"],
      price: 3000,
    },
    {
      id: "foil-8-9",
      series: "heroes",
      name: "8・9 のフォイルセット",
      skins: ["viking-male", "viking-female"],
      price: 3000,
    },
    {
      id: "foil-10",
      series: "heroes",
      name: "10 のフォイル",
      skins: ["dragon-knight"],
      price: 5000,
    },
    {
      id: "foil-jq-angel",
      series: "heroes",
      name: "J・Q のフォイルセット(天使)",
      skins: ["angel-j", "angel-q"],
      price: 5000,
    },
    {
      id: "foil-jq-demon",
      series: "heroes",
      name: "J・Q のフォイルセット(悪魔)",
      skins: ["demon-j", "demon-q"],
      price: 5000,
    },
    {
      id: "foil-k-angel",
      series: "heroes",
      name: "K のフォイル(天使)",
      skins: ["angel-k"],
      price: 5000,
    },
    {
      id: "foil-k-demon",
      series: "heroes",
      name: "K のフォイル(悪魔)",
      skins: ["demon-k"],
      price: 5000,
    },
    // ワンダーランド・ゲート(2026-10-15 本人の指示「レジェンド・ゲートと同じ仕組みをワンダーランドにも」)。
    // 帯と値段はレジェンド・ゲートと同じ数字の組。札の id の数字は昔の並びなので、rank で組んである
    // (4=グリフォン alice-6, 5=ニセウミガメ alice-7, 6=白ウサギ alice-8, 7=イモムシ alice-9, 8=帽子屋 alice-4, 9=三月ウサギ alice-5)
    {
      id: "foil-alice-2-3",
      series: "alice",
      name: "2・3 のフォイルセット",
      skins: ["alice-2-dodo", "alice-3-bill"],
      price: 1500,
    },
    {
      id: "foil-alice-4-5",
      series: "alice",
      name: "4・5 のフォイルセット",
      skins: ["alice-6-gryphon", "alice-7-mock-turtle"],
      price: 1500,
    },
    {
      id: "foil-alice-6-7",
      series: "alice",
      name: "6・7 のフォイルセット",
      skins: ["alice-8-white-rabbit", "alice-9-caterpillar"],
      price: 3000,
    },
    {
      id: "foil-alice-8-9",
      series: "alice",
      name: "8・9 のフォイルセット",
      skins: ["alice-4-hatter", "alice-5-march-hare"],
      price: 3000,
    },
    {
      id: "foil-alice-10",
      series: "alice",
      name: "10 のフォイル",
      skins: ["alice-10-cheshire-cat"],
      price: 5000,
    },
    // J・K をセット、Q を単体に(2026-10-15 本人の指示。レジェンド・ゲートの J・Q／K とは組が違う)
    {
      id: "foil-alice-jk",
      series: "alice",
      name: "J・K のフォイルセット",
      skins: ["alice-J-knave", "alice-K-king"],
      price: 5000,
    },
    {
      id: "foil-alice-q",
      series: "alice",
      name: "Q のフォイル",
      skins: ["alice-Q-queen"],
      price: 5000,
    },
    // 全カードをそろえた人だけ。有償購入済みの札はサーバーに保存して復元する。
    {
      id: "foil-a",
      name: "A のフォイル",
      skins: ["genie-magician"],
      price: 2000,
      secret: true,
      series: "heroes",
    },
    {
      id: "foil-alice-a",
      name: "アリスのフォイル",
      skins: ["alice-A-alice"],
      price: 2000,
      secret: true,
      series: "alice",
    },
  ].map(Object.freeze),
);

export const productOf = (id) => FOIL_PRODUCTS.find((p) => p.id === id) || null;

/**
 * フォイルの欄がショップに並ぶ時間(2026-09-18 本人の指示)。
 * ガチャでフォイルを引いたときから72時間だけ。引くたびに引き直す(その時点から72時間)。
 * 「持っているかどうか」ではなく「いつ引いたか」で開け閉めする
 */
export const FOIL_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * いま並んでいるか。{ open, until, leftMs }
 *   open   … 並んでいる
 *   until  … いつまで(時刻。まだ引いていなければ null)
 *   leftMs … 残り(閉じていれば 0)
 */
/** そのシリーズでフォイルを引いた時刻。レジェンド・ゲート(heroes)は従来の foilOfferAt、ほかは foilOfferAtBySeries */
export function foilOfferAtOf(collection, series = "heroes") {
  return series === "heroes" ? collection?.foilOfferAt : collection?.foilOfferAtBySeries?.[series];
}
export function foilWindow(collection, now = Date.now(), series = "heroes") {
  const at = foilOfferAtOf(collection, series);
  if (!Number.isFinite(at) || at <= 0) return { open: false, until: null, leftMs: 0 };
  const until = at + FOIL_WINDOW_MS;
  const leftMs = until - now;
  return { open: leftMs > 0, until, leftMs: Math.max(0, leftMs) };
}
/** いま欄が並んでいるシリーズ(SERIES の順)。シリーズごとに別の72時間(2026-10-15) */
export function openFoilSeries(collection, now = Date.now()) {
  return SERIES.filter((s) => foilWindow(collection, now, s.id).open);
}

/** 残りの言い方。「あと2日と3時間」「あと5時間」「あと20分」 */
export function foilWindowLabel(leftMs) {
  if (!(leftMs > 0)) return "";
  const mins = Math.ceil(leftMs / 60000);
  if (mins < 60) return `あと${mins}分`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `あと${hours}時間`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `あと${days}日と${rest}時間` : `あと${days}日`;
}

/**
 * フォイルを引いた印を押す(ここから72時間)。
 *
 * **並んでいる間に引いても、引き直さない**(2026-09-22 本人の指示)。以前は引くたびに
 * その時点から72時間に戻していたが、毎回「ほかのフォイルも」が出て圧が強すぎた。
 * 商品が時間切れで消えたあと、次にフォイルを引いたときだけ新しく72時間が始まり、
 * そのときだけポップアップを出す(画面側は foilWindow(before).open で見分ける)
 */
export function startFoilWindow(state, now = Date.now(), series = "heroes") {
  if (foilWindow(state, now, series).open) return state;
  if (series === "heroes") return { ...state, foilOfferAt: now };
  return { ...state, foilOfferAtBySeries: { ...(state?.foilOfferAtBySeries || {}), [series]: now } };
}

/**
 * 「しばらく表示しない」(2026-09-22 本人の指示)。ガチャのあとのポップアップを1週間出さない。
 * ショップのフォイルの欄はそのまま(消すのはポップアップだけ)
 */
export const FOIL_OFFER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export function snoozeFoilOffer(state, now = Date.now()) {
  return { ...state, foilOfferSnoozeUntil: now + FOIL_OFFER_SNOOZE_MS };
}
export function foilOfferSnoozed(collection, now = Date.now()) {
  const until = collection?.foilOfferSnoozeUntil;
  return Number.isFinite(until) && until > now;
}

/**
 * ガチャの結果を閉じるときに「ほかのフォイルも」を出すか。
 *   before … 閉じる前の台帳(72時間が開いていたか)
 *   after  … 印を押したあとの台帳(しばらく表示しない、が効いているか)
 * 新しく72時間が始まったときだけ、しかも止めていないときだけ出す
 */
export function shouldOfferFoils(before, after, now = Date.now(), series = "heroes") {
  return !foilWindow(before, now, series).open && foilWindow(after, now, series).open && !foilOfferSnoozed(after, now);
}

/** その商品の一部(skins)だけ買うときの値段。按分して四捨五入。空や商品外の札があれば null */
export function priceFor(product, skins) {
  if (!product || !Array.isArray(skins) || !skins.length) return null;
  const set = new Set(skins);
  if (set.size !== skins.length) return null;
  if (!skins.every((s) => product.skins.includes(s))) return null;
  return Math.round((product.price * skins.length) / product.skins.length);
}

/** そのキャラ(通常版の id)が入っている商品(secret は除く) */
export function bandOf(baseId) {
  const id = baseSkinId(baseId);
  return FOIL_PRODUCTS.find((p) => !p.secret && p.skins.includes(id)) || null;
}

/** そのシリーズの、A のフォイル以外の全カード(通常版もフォイルも)を持っているか */
export function ownsAllButSecret(collection, series = "heroes") {
  const owned = collection?.owned || {};
  const secretFoils = new Set(
    FOIL_PRODUCTS.filter((p) => p.secret).flatMap((p) => p.skins.map(foilId)),
  );
  return ALL_SKINS.filter(s => s.series === series).every(
    (s) => secretFoils.has(s.id) || (owned[s.id] || 0) > 0,
  );
}

/** 図鑑・種類数・通常/フォイル切替で使う、シークレット版の公開条件。 */
export function skinVisibleInCollection(collection, skin) {
  if (!skin) return false;
  if (!skin.secret) return true;
  const product = FOIL_PRODUCTS.find(
    (p) => p.secret && p.skins.some((id) => foilId(id) === skin.id),
  );
  return !!product && !product.pending && (
    (collection?.owned?.[skin.id] || 0) > 0 || ownsAllButSecret(collection, product.series || "heroes")
  );
}

/**
 * いま買える商品。持っていないフォイルだけを残し、値段は按分。
 * exclude には「引いたばかりの帯」の商品 id を入れる(そのフォイル以外を勧めるため)。
 * series を渡せばそのシリーズの商品だけ(引いた直後のポップアップとショップの欄はシリーズごと。2026-10-15)。
 * includeOwned を立てると、全部そろえた商品も done:true で返す(ショップで「獲得済み」と見せる。
 * 2026-10-15 本人の指示「ポップアップには出さなくてよいが、ショップに行けば獲得済みだとわかるように」)
 */
export function foilOffers(collection, { exclude = [], series = null, includeOwned = false } = {}) {
  const owned = collection?.owned || {};
  const out = [];
  for (const p of FOIL_PRODUCTS) {
    if (p.pending) continue;
    if (series && (p.series || "heroes") !== series) continue;
    if (p.secret && !ownsAllButSecret(collection, p.series || "heroes")) continue;
    if (exclude.includes(p.id)) continue;
    const remaining = p.skins.filter((s) => !(owned[foilId(s)] || 0));
    if (!remaining.length && !includeOwned) continue;
    out.push({
      product: p,
      skins: remaining,
      owned: p.skins.filter((s) => (owned[foilId(s)] || 0) > 0),
      price: remaining.length ? priceFor(p, remaining) : 0,
      partial: remaining.length > 0 && remaining.length < p.skins.length,
      done: remaining.length === 0,
    });
  }
  return out;
}

/** 検査用: そのシリーズのガチャの全キャラのフォイルが、secret でない商品にちょうど1回ずつ入っているか */
export function coversPool(series = "heroes") {
  const pool = poolForSeries(series);
  const ids = FOIL_PRODUCTS.filter((p) => !p.secret && (p.series || "heroes") === series).flatMap((p) => p.skins);
  return (
    ids.length === pool.length &&
    pool.every((s) => ids.filter((i) => i === s.id).length === 1) &&
    ids.every((i) => byId(i))
  );
}
