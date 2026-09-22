/**
 * フォイルの直接購入(有償ジェムだけ)。
 *
 * ガチャでフォイルを引いた直後に「ほかのフォイルも」として出す(本人の指示 2026-09-16)。
 * 商品は帯ごとのセット。値段は本人の決め(1〜4 は入手難易度の順、5〜9 は 5,000 で統一)。
 *  - 買えるのは持っていないフォイルだけ。セットの一部を持っていれば、残りを按分の値段で
 *  - **有償ジェムだけで払う**(無償ジェムは使えない。src/server/wallet.js の paidOnly)
 *  - 商品10(A のフォイル)は「A のフォイル以外の全カードをそろえた人」にだけ見せる(secret)。
 *    そろうまでは存在すら出さない。購入時にもサーバーへ同期した所持一覧を全件照合する。
 *  - サーバーとアプリの両方がこのファイルを読む(値段はサーバーがここから決める。端末の言い値は使わない)
 */
import { ALL_SKINS, POOL, baseSkinId, byId, foilId } from "./catalog.js";

export const FOIL_PRODUCTS = Object.freeze(
  [
    {
      id: "foil-2-3",
      name: "2・3 のフォイルセット",
      skins: ["zombie-male", "zombie-female"],
      price: 1500,
    },
    {
      id: "foil-4-5",
      name: "4・5 のフォイルセット",
      skins: ["pirate-male", "pirate-female"],
      price: 1500,
    },
    {
      id: "foil-6-7",
      name: "6・7 のフォイルセット",
      skins: ["elf-male", "elf-female"],
      price: 3000,
    },
    {
      id: "foil-8-9",
      name: "8・9 のフォイルセット",
      skins: ["viking-male", "viking-female"],
      price: 3000,
    },
    {
      id: "foil-10",
      name: "10 のフォイル",
      skins: ["dragon-knight"],
      price: 5000,
    },
    {
      id: "foil-jq-angel",
      name: "J・Q のフォイルセット(天使)",
      skins: ["angel-j", "angel-q"],
      price: 5000,
    },
    {
      id: "foil-jq-demon",
      name: "J・Q のフォイルセット(悪魔)",
      skins: ["demon-j", "demon-q"],
      price: 5000,
    },
    {
      id: "foil-k-angel",
      name: "K のフォイル(天使)",
      skins: ["angel-k"],
      price: 5000,
    },
    {
      id: "foil-k-demon",
      name: "K のフォイル(悪魔)",
      skins: ["demon-k"],
      price: 5000,
    },
    // 全カードをそろえた人だけ。有償購入済みの札はサーバーに保存して復元する。
    {
      id: "foil-a",
      name: "A のフォイル",
      skins: ["genie-magician"],
      price: 2000,
      secret: true,
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
export function foilWindow(collection, now = Date.now()) {
  const at = collection?.foilOfferAt;
  if (!Number.isFinite(at) || at <= 0) return { open: false, until: null, leftMs: 0 };
  const until = at + FOIL_WINDOW_MS;
  const leftMs = until - now;
  return { open: leftMs > 0, until, leftMs: Math.max(0, leftMs) };
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
export function startFoilWindow(state, now = Date.now()) {
  if (foilWindow(state, now).open) return state;
  return { ...state, foilOfferAt: now };
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
export function shouldOfferFoils(before, after, now = Date.now()) {
  return !foilWindow(before, now).open && foilWindow(after, now).open && !foilOfferSnoozed(after, now);
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

/** A のフォイル以外の全カード(通常版もフォイルも)を持っているか */
export function ownsAllButSecret(collection) {
  const owned = collection?.owned || {};
  const secretFoils = new Set(
    FOIL_PRODUCTS.filter((p) => p.secret).flatMap((p) => p.skins.map(foilId)),
  );
  return ALL_SKINS.every(
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
    (collection?.owned?.[skin.id] || 0) > 0 || ownsAllButSecret(collection)
  );
}

/**
 * いま買える商品。持っていないフォイルだけを残し、値段は按分。
 * exclude には「引いたばかりの帯」の商品 id を入れる(そのフォイル以外を勧めるため)
 */
export function foilOffers(collection, { exclude = [] } = {}) {
  const owned = collection?.owned || {};
  const complete = ownsAllButSecret(collection);
  const out = [];
  for (const p of FOIL_PRODUCTS) {
    if (p.pending) continue;
    if (p.secret && !complete) continue;
    if (exclude.includes(p.id)) continue;
    const remaining = p.skins.filter((s) => !(owned[foilId(s)] || 0));
    if (!remaining.length) continue;
    out.push({
      product: p,
      skins: remaining,
      price: priceFor(p, remaining),
      partial: remaining.length < p.skins.length,
    });
  }
  return out;
}

/** 検査用: ガチャの15キャラのフォイルが、secret でない商品にちょうど1回ずつ入っているか */
export function coversPool() {
  const ids = FOIL_PRODUCTS.filter((p) => !p.secret).flatMap((p) => p.skins);
  return (
    ids.length === POOL.length &&
    POOL.every((s) => ids.filter((i) => i === s.id).length === 1) &&
    ids.every((i) => byId(i))
  );
}
