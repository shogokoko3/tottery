/**
 * サーバー側の財布(チケット残高・買い切りの権利)とやり取りする。
 *
 * 残高の正はサーバー(Worker の台帳)。端末の collection.tickets は「最後に
 * 見た残高」の写しで、画面はそれを出す。
 *  - ガチャ: サーバーで消費・通常抽選・フリーズ昇格を保存し、端末は最終結果を受け取る
 *  - 遊んで貯める分: 出来事 id(決まった形)で加算を頼む。圏外なら溜めて、次に通じたとき送る。
 *    同じ id は二度効かないので、やり直しで二重にならない
 *  - 引き継ぎ: 端末にあった枚数を一度だけ送る(サーバー側でも uid ごとに一度きり・上限つき)
 * 通信の口は season.js と同じ(Worker、Firebase の合言葉つき)。
 */
import { ensureAuth } from "./auth.js";
import { seasonApiBase } from "./season.js";
import { updateCollection, getCollection } from "../skins/store.js";
import { byId } from "../skins/catalog.js";
import { grantSkin } from "../skins/collection.js";

/** チケットをサーバーの財布で持つか。false なら今まで通り端末だけ */
export const WALLET_SERVER = true;
const PENDING_KEY = "tottery.wallet.pending.v1";
const MIGRATED_KEY = "tottery.wallet.migrated.v1";

async function walletRequest(op, body = {}) {
  const auth = await ensureAuth();
  if (!auth) throw new Error("通信を確認して、もう一度お試しください。");
  let res;
  try {
    res = await fetch(`${seasonApiBase()}/api/wallet/${op}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.idToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("通信を確認して、もう一度お試しください。");
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("財布を読み込めませんでした。");
  }
  if (!res.ok) throw new Error(data.error || "財布を読み込めませんでした。");
  return data;
}

/** サーバーの残高・権利を端末の写しへ */
async function mirror(data) {
  if (!Number.isSafeInteger(data.tickets)) return data;
  await updateCollection((s) => {
    // 購入済みの最低1枚を復元する。応答再送を「もう1枚取得」にしない。
    let next = s;
    for (const id of data.purchasedFoils || []) {
      if (byId(id)?.foil && !next.owned[id]) next = grantSkin(next, id);
    }
    return {
      ...next,
      tickets: data.tickets,
      gems: Number.isSafeInteger(data.gems) ? data.gems : s.gems || 0,
      gemsPaid: Number.isSafeInteger(data.gemsPaid)
        ? data.gemsPaid
        : s.gemsPaid || 0,
      gemsFree: Number.isSafeInteger(data.gemsFree)
        ? data.gemsFree
        : s.gemsFree || 0,
      entitlements: Array.isArray(data.entitlements)
        ? data.entitlements
        : s.entitlements || [],
      // 運営がバトルパスをクリア状態にした印(時刻)。端末はこれを見て盤を埋める
      passComplete: Number.isSafeInteger(data.passComplete)
        ? data.passComplete
        : s.passComplete || null,
    };
  });
  return data;
}

function readPending() {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writePending(list) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    /* 保存できなくても次で拾う */
  }
}

/** 溜めていた加算を送る。送れた分だけ消す */
export async function flushPending() {
  let list = readPending();
  for (const ev of [...list]) {
    try {
      // チケットは earn、無償ジェムは earn-gems、バトルパスのマス報酬は pass-reward
      await mirror(
        ev.pass
          ? await walletRequest("pass-reward", { id: ev.id })
          : ev.gems
            ? await walletRequest("earn-gems", { id: ev.id, gems: ev.gems })
            : await walletRequest("earn", { id: ev.id, n: ev.n }),
      );
      list = list.filter((x) => x.id !== ev.id);
      writePending(list);
    } catch (e) {
      // 上限・形の誤り・パスの週上限や未所持で拒まれたものは捨てる(残しても二度と通らない)。通信の失敗は残す
      if (
        /これ以上|正しくありません|他の人|上限|持っていません/.test(e.message)
      ) {
        list = list.filter((x) => x.id !== ev.id);
        writePending(list);
      } else break;
    }
  }
}

/** 残高を取り直す(溜めていた加算も先に送る) */
export async function syncWallet() {
  if (!WALLET_SERVER) return getCollection();
  await flushPending().catch(() => {});
  return mirror(await walletRequest("summary"));
}

/**
 * 遊んで貯める分を財布へ。id は「何で」「いつ」で決まる形にする
 * (例: login:2026-09-12, mission:daily-1:2026-09-12)。同じ id は二度効かない
 */
export async function earnTickets(id, n) {
  if (!WALLET_SERVER || !Number.isSafeInteger(n) || n <= 0) return;
  const list = readPending();
  if (!list.some((x) => x.id === id))
    writePending([...list, { id, n, at: Date.now() }]);
  await flushPending().catch(() => {});
}

/**
 * バトルパスのマスをクリアした報酬(チケット1枚)。所持者だけ・週72枚まで(サーバーが数える)。
 * id は「周と マス」で決まる形(bp:pass:<周>:<マスid>)。同じ id は二度効かない。圏外なら控えて後で送る
 */
export async function earnPassTicket(id) {
  if (!WALLET_SERVER) return;
  const list = readPending();
  if (!list.some((x) => x.id === id))
    writePending([...list, { id, pass: true, at: Date.now() }]);
  await flushPending().catch(() => {});
}

/**
 * 記念配布(src/game/campaigns.js)を受け取る。サーバーが枚数を決めて uid ごとに一度だけ足す。
 * 通れば新しい残高(applied が false なら受け取り済み)。圏外なら投げる(控えない。手紙は残るので後で押せる)
 */
export async function claimCampaign(campaignId) {
  return mirror(await walletRequest("campaign", { campaign: campaignId }));
}

/**
 * **サーバーに引いてもらう**(2026-09-18)。チケットの消費と抽選を1つの要求で行う。
 *
 * 盤面エリアはフォイルの王で立つのに、対局では所持が検証されていない。
 * 端末が引いて事後に申告する形では、サーバーは「何を引いたか」を知らないので検証の正にならない。
 *
 * 同じ id で送り直しても同じ札が返る。札とフリーズ前の札を一緒に返す。NEW かどうかは端末が決める
 * (所持の正は端末にある)。未対応の404だけは呼び出し側で旧経路へ戻す。
 * 成功応答が不正・通信失敗の場合は同じ要求を再確認し、抽選し直さない。
 */
export async function pullFromServer(id, n) {
  const data = await walletRequest("pull", { id, n });
  if (!(Array.isArray(data?.skins) && data.skins.length === n && data.skins.every(id => byId(id))))
    throw new Error("抽選結果を読み込めませんでした。同じ召喚をもう一度確認してください。");
  await mirror(data);
  return { skins: data.skins, freeze: data.freeze || null, receipt: id };
}

/** ガチャの前に減らす。通れば新しい残高、足りなければ投げる */
export async function debitTickets(id, n) {
  return mirror(await walletRequest("debit", { id, n }));
}

/**
 * 無償ジェムを財布へ(ミッション・手紙・バトルパスの完成など)。id は「何で」「いつ」で
 * 決まる形にする。同じ id は二度効かない。圏外なら控えて後で送る
 */
export async function earnGems(id, n) {
  if (!WALLET_SERVER || !Number.isSafeInteger(n) || n <= 0) return;
  const list = readPending();
  if (!list.some((x) => x.id === id))
    writePending([...list, { id, gems: n, at: Date.now() }]);
  await flushPending().catch(() => {});
}

/** 無償ジェムをエーテルに。通れば { ether } を含む新しい残高、足りなければ投げる */
export async function buyEther(id, gems) {
  return mirror(await walletRequest("ether", { id, gems }));
}

/** フォイルを有償ジェムで買う(src/skins/foil-shop.js)。通れば新しい残高、足りなければ投げる */
export async function buyFoil(product, skins) {
  // 購入ごとに最新の所持を登録し、サーバーも保存済み全カードを照合する。
  await syncCollection();
  return mirror(await walletRequest("foil", { product, skins }));
}

/**
 * 所持一覧を、失敗しても黙って送る(2026-09-18)。
 *
 * 対局では装備の所持が誰にも検証されていない。検証を始めるには「正しく遊んで手に入れた」
 * 記録がサーバーに要るので、まずは貯めるだけ。いまは**誰も拒まない**。
 * 1枚も持っていないときは送らない — 送るとサーバーの写し(collection_skins)が空で入れ直され、
 * フォイルの購入条件(ownsAllButSecret)が壊れる。
 */
export async function noteCollection() {
  if (!WALLET_SERVER) return null;
  try {
    const owned = getCollection().owned || {};
    if (!Object.values(owned).some((n) => Number.isSafeInteger(n) && n > 0))
      return null;
    return await syncCollection();
  } catch {
    // 記録は best-effort。遊びを止めない
    return null;
  }
}

/** 現行の端末所持一覧を同期。secretFoilEligibleは保存した一覧の再照合結果。 */
export async function syncCollection() {
  const ownedIds = Object.entries(getCollection().owned)
    .filter(
      ([id, count]) => byId(id) && Number.isSafeInteger(count) && count > 0,
    )
    .map(([id]) => id);
  return mirror(await walletRequest("collection", { ownedIds }));
}

/** ジェムでチケットを買う(両替)。通れば新しい残高、足りなければ投げる */
export async function exchangeGems(id, tickets) {
  return mirror(await walletRequest("exchange", { id, tickets }));
}

/** ジェムでバトルパス(買い切りの権利)を買う。足りなければ投げる */
export async function buyPassWithGems(id) {
  return mirror(await walletRequest("buy-pass", { id }));
}

/** ガチャの結果を運営の履歴に残す。残高は動かさない。記録が落ちても遊びは止めない */
export async function logPull(items) {
  if (!WALLET_SERVER || !Array.isArray(items) || !items.length) return;
  try {
    await walletRequest("log-pull", {
      items: items.slice(0, 20).map((r) => ({ id: r.id, isNew: !!r.isNew })),
    });
  } catch {
    /* 履歴は best-effort */
  }
}

/** 端末にあった枚数を一度だけ引き継ぐ */
export async function migrateOnce() {
  if (!WALLET_SERVER) return null;
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return null;
  } catch {
    /* 読めなければ送って、サーバー側の一度きりに任せる */
  }
  const local = getCollection().tickets || 0;
  const data = await walletRequest("migrate", { tickets: local });
  try {
    localStorage.setItem(MIGRATED_KEY, "1");
  } catch {
    /* 次回はサーバーが弾く */
  }
  return mirror(data);
}

/** 出来事の id を作る(ガチャ1回ごとなど、決まった形が無いもの) */
export const newEventId = (kind) =>
  `${kind}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
