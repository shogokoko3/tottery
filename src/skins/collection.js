import { normalizeSummonFreeze, resolveSummonFreeze } from "./summon-freeze.js";
import { sanitizeSeasonCache } from "../game/season.js";
import {
  SKINS,
  ALL_SKINS,
  POOL,
  FOIL_SKINS,
  FOIL_CHANCE,
  baseSkinId,
  byId,
  draw,
  foilId,
  sanitizeLoadout,
} from "./catalog.js";
import {
  CRAFT_MAX,
  craftCheck,
  dismantleCheck,
  dustOf,
} from "./ether.js";
import { exchangeCheck, shatterCheck } from "./shards.js";
import { homePortraitsOf, homeThemeOf } from "./home-themes.js";
import { sanitizeTsumeProgress } from "../game/tsume-daily.js";
import {
  missionPeriods,
  sanitizeMissionClaims,
} from "../game/periodic-missions.js";

const count = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : 0);
const addCount = (a, b) => Math.min(Number.MAX_SAFE_INTEGER, a + b);
export const FOIL_MILESTONE = 100;

// 初めて得たキャラのホーム表示も獲得と一緒に確定する。既存の選択は維持する。
function withHomePortraits(state) {
  return { ...state, homePortraits: homePortraitsOf(state) };
}

/** キャラごとの通算獲得数。旧保存は、確認できる現在所持分から始める。 */
export function acquiredOf(state, id) {
  const baseId = baseSkinId(id);
  if (!POOL.some((skin) => skin.id === baseId)) return 0;
  const held = addCount(
    count(state?.owned?.[baseId]),
    count(state?.owned?.[foilId(baseId)]),
  );
  // 達成報酬そのものを累計へ戻さない。受取済みフラグと所持は同時に保存する。
  const baseline = Math.max(
    0,
    held - (state?.foilMilestones?.[baseId] === true ? 1 : 0),
  );
  return Math.max(count(state?.acquired?.[baseId]), baseline);
}

function acquiredTotals(state) {
  return Object.fromEntries(
    POOL.map((skin) => [skin.id, acquiredOf(state, skin.id)]).filter(
      ([, total]) => total > 0,
    ),
  );
}

function recordAcquisition(acquired, id) {
  const baseId = baseSkinId(id);
  if (POOL.some((skin) => skin.id === baseId))
    acquired[baseId] = addCount(count(acquired[baseId]), 1);
}

/** 通算100回の無料フォイル。キャラごとに一度だけ受け取れる。 */
export function foilMilestoneCheck(state, baseId) {
  const eligible = POOL.some((skin) => skin.id === baseId);
  const total = eligible ? acquiredOf(state, baseId) : 0;
  const claimed = eligible && state?.foilMilestones?.[baseId] === true;
  const remaining = Math.max(0, FOIL_MILESTONE - total);
  const why = !eligible
    ? "通常版の対象キャラクターを選んでください。"
    : claimed
      ? "このキャラクターの達成報酬は受け取り済みです。"
      : remaining > 0
        ? `通算獲得があと${remaining}回必要です。`
        : state?.pending || state?.lastCraft
          ? "先にガチャ・錬成の結果を確認してください。"
          : null;
  return {
    ok: why === null,
    total,
    target: FOIL_MILESTONE,
    remaining,
    claimed,
    why,
  };
}

export function claimFoilMilestone(state, baseId) {
  const check = foilMilestoneCheck(state, baseId);
  if (!check.ok) throw new Error(check.why);
  const id = foilId(baseId);
  return withHomePortraits({
    ...state,
    acquired: acquiredTotals(state),
    foilMilestones: { ...state.foilMilestones, [baseId]: true },
    owned: { ...state.owned, [id]: addCount(count(state.owned?.[id]), 1) },
    lastCraft: { id, isNew: !state.owned?.[id], source: "milestone" },
  });
}

export function normalize(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const owned = {};
  for (const skin of ALL_SKINS) {
    // 旧プレビューの所持リストも引き継ぐ。
    const n = Array.isArray(value.owned)
      ? Number(value.owned.includes(skin.id))
      : count(value.owned?.[skin.id]);
    if (n) owned[skin.id] = n;
  }
  const equipped = Object.fromEntries(
    Object.entries(sanitizeLoadout(value.equipped)).filter(
      ([, id]) => owned[id],
    ),
  );
  const results = Array.isArray(value.pending?.results)
    ? value.pending.results
        .slice(0, 10)
        .filter((r) => byId(r?.id) && owned[r.id])
        .map((r) => ({ id: r.id, isNew: r.isNew === true }))
    : [];
  // まとめ錬成の結果も、召喚の結果と同じ手順で作り直す(知らない札・持っていない札は落とす)
  const craftRows = Array.isArray(value.lastCraft?.results)
    ? value.lastCraft.results
        .slice(0, CRAFT_MAX)
        .filter((r) => byId(r?.id) && owned[r.id])
        .map((r) => ({ id: r.id, isNew: r.isNew === true }))
    : [];
  const foilMilestones = Object.fromEntries(
    POOL.filter((skin) => value.foilMilestones?.[skin.id] === true).map(
      (skin) => [skin.id, true],
    ),
  );
  return {
    version: 1,
    // ガチャチケット。ミッションの褒美で増える。
    // いまのガチャは無料のテスト版なので、まだ減らない
    tickets: count(value.tickets),
    // ジェム。サーバーの財布の写し(正はサーバー)。gems=合計、gemsPaid=有償、gemsFree=無償
    gems: count(value.gems),
    gemsPaid: count(value.gemsPaid),
    gemsFree: count(value.gemsFree),
    // 買い切りの権利(サーバーの財布の写し。正はサーバー)
    entitlements: Array.isArray(value.entitlements)
      ? value.entitlements.filter(
          (x) => typeof x === "string" && x.length <= 120,
        )
      : [],
    // 運営がバトルパスをクリア状態にした印(サーバーの写し)
    passComplete:
      Number.isSafeInteger(value.passComplete) && value.passComplete > 0
        ? value.passComplete
        : null,
    season: sanitizeSeasonCache(value.season),
    tsume: sanitizeTsumeProgress(value.tsume),
    missionClaims: sanitizeMissionClaims(value.missionClaims),
    missionDrawDay:
      typeof value.missionDrawDay === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.missionDrawDay)
        ? value.missionDrawDay
        : null,
    // エーテル。ダブりを崩すと増え、狙った1枚を作ると減る
    ether: count(value.ether),
    // フォイルの欠片。フォイルのダブりを崩すと増え、持っていないフォイルと交換すると減る
    shards: count(value.shards),
    owned,
    acquired: acquiredTotals({ ...value, owned, foilMilestones }),
    foilMilestones,
    equipped,
    homeTheme: homeThemeOf({ owned, homeTheme: value.homeTheme }),
    homePortraits: homePortraitsOf({
      owned,
      homePortraits: value.homePortraits,
    }),
    draws: count(value.draws),
    // ガチャ称号の実績カウンタ。抽選のたびに applyPull で増える(2026-09-21)
    gacha: {
      freeze: count(value.gacha?.freeze),
      foil: count(value.gacha?.foil),
      ssr: count(value.gacha?.ssr),
      allR: count(value.gacha?.allR),
      bestTenSsr: count(value.gacha?.bestTenSsr),
    },
    earlyClaimed: value.earlyClaimed === true,
    // ガチャでフォイルを引いた時刻。ここから72時間だけ、ショップにフォイルの欄が並ぶ
    // (2026-09-18 本人の指示。src/skins/foil-shop.js の foilWindow)
    foilOfferAt:
      Number.isFinite(value.foilOfferAt) && value.foilOfferAt > 0
        ? Math.floor(value.foilOfferAt)
        : null,
    // 「しばらく表示しない」を押した人には、この時刻までポップアップを出さない(2026-09-22 本人の指示)
    foilOfferSnoozeUntil:
      Number.isFinite(value.foilOfferSnoozeUntil) && value.foilOfferSnoozeUntil > 0
        ? Math.floor(value.foilOfferSnoozeUntil)
        : null,
    // 対局中の演出(装備した駒の動画・A の魔法)。"full" か "off" だけ(2026-09-17 本人の指示で「短縮」を廃止)。
    // 以前の「短縮」は短くしたい人の選択なので off に寄せる。設定画面で変える
    motion: ["short", "off"].includes(value.motion) ? "off" : "full",
    // ガチャ結果のダブりを自動で崩すか(2026-09-17 本人の指示)。既定は切。結果画面で入れる
    autoDismantle: value.autoDismantle === true,
    // チケットを買う前に確認するか(2026-09-17 本人の指示)。既定は確認する。
    // 有償ジェムだけで買うもの(フォイル・バトルパス)の確認は外せない
    ticketConfirm: value.ticketConfirm !== false,
    // そのうち**どのレア度を崩すか**(2026-09-17 本人の指示で選べるようにした)。
    // 既定は R と SR。SSR は自分で入れたときだけ崩す(黙って消えると困るため)。
    // 空にもできる(そのときは何も崩さない)。手で押すときも自動のときも、この選択に従う
    dismantleRarities: Array.isArray(value.dismantleRarities)
      ? DISMANTLE_RARITIES.filter((r) => value.dismantleRarities.includes(r))
      : [...DEFAULT_DISMANTLE_RARITIES],
    // 召喚(ガチャ)の演出。"full" か "skip"。召喚ボタンの横で変える(2026-09-17 本人の指示で対局の演出と分けた)。
    // 以前は「短縮」「なし」がガチャも飛ばしていたので、その保存には skip を引き継ぐ
    summonMotion:
      value.summonMotion === "skip" || value.summonMotion === "full"
        ? value.summonMotion
        : ["short", "off"].includes(value.motion)
          ? "skip"
          : "full",
    pendingPull: value.pendingPull && typeof value.pendingPull.id === "string" && /^pull:[\w:-]{1,150}$/.test(value.pendingPull.id) && [1, 10].includes(value.pendingPull.amount)
      ? { id: value.pendingPull.id, amount: value.pendingPull.amount } : null,
    lastPullId: typeof value.lastPullId === "string" ? value.lastPullId.slice(0, 160) : null,
    pending: results.length ? { results, freeze: normalizeSummonFreeze(value.pending?.freeze, results.map(r => r.id)) } : null,
    lastCraft:
      byId(value.lastCraft?.id) && owned[value.lastCraft.id]
        ? {
            id: value.lastCraft.id,
            isNew: value.lastCraft.isNew === true,
            // まとめ錬成の結果。2枚以上のときだけ残す(1枚以下なら今までの単数に落ちる)
            ...(craftRows.length > 1 ? { results: craftRows } : {}),
            ...(value.lastCraft.source === "milestone" &&
            byId(value.lastCraft.id).foil &&
            foilMilestones[baseSkinId(value.lastCraft.id)]
              ? { source: "milestone" }
              : value.lastCraft.source === "exchange" &&
                  byId(value.lastCraft.id).foil
                ? { source: "exchange" }
                : {}),
          }
        : null,
  };
}

// 所持数や過去の当落に依存しない、キャラ決定後の独立した1%判定。
function finishedId(baseId, random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1)
    throw new Error("乱数の範囲が不正です");
  return n < FOIL_CHANCE ? foilId(baseId) : baseId;
}

// 現在はテスト用の無料ガチャ。チケット数、購入、対局報酬には依存しない。
// 抽選と所持への追加を一度に確定し、演出の中断や再読み込みで失わない。
/**
 * ガチャが無料か。2026-09-13 本人の指示で false に(実際の経済＝チケット消費で試す)。
 * false のとき 1回=チケット1枚、10回=10枚を消費する。無料に戻すなら true。
 * tools/check-submit.mjs は提出前に false であることを見張る
 */
export const FREE_GACHA = false;
/** 1回の召喚で使うチケットの枚数(有料のとき) */
export const PULL_COST = 1;

/** 1回の抽選(キャラを決めてから、独立した1%で仕上げを決める)。サーバーも同じ順で引く */
export function drawOne(random = Math.random) {
  return finishedId(draw(random).id, random);
}

/**
 * **引いた結果を所持に入れる**(抽選はしない)。
 *
 * サーバーが引いた結果を受け取る道(2026-09-18)と、端末で引く道(pull)の両方がここを通る。
 * チケットは呼ぶ側の決め: free なら減らさない(サーバーで先に減らしているときも free で呼ぶ)。
 */
export function applyPull(state, skinIds, { free = FREE_GACHA } = {}) {
  const receipt = !Array.isArray(skinIds) && skinIds?.receipt;
  if (receipt && receipt === state.lastPullId) return state;
  if (receipt && state.pendingPull?.id !== receipt)
    throw new Error("未受取の召喚と結果が一致しません。もう一度確認してください。");
  const ids = Array.isArray(skinIds) ? skinIds : skinIds?.skins || [];
  const freeze = normalizeSummonFreeze(skinIds?.freeze, ids);
  if (ids.length !== 1 && ids.length !== 10)
    throw new Error("1回または10回を選んでください");
  if (ids.some((id) => !byId(id))) throw new Error("知らない札が混ざっています");
  if (state.pending || state.lastCraft)
    throw new Error("先にガチャ・錬成の結果を確認してください");
  const cost = free ? 0 : ids.length * PULL_COST;
  const tickets = count(state.tickets);
  if (cost > tickets)
    throw new Error(`ガチャチケットが足りません(あと${cost - tickets}枚)`);
  const owned = { ...state.owned };
  const acquired = acquiredTotals(state);
  const results = ids.map((id) => {
    const isNew = !owned[id];
    owned[id] = (owned[id] || 0) + 1;
    recordAcquisition(acquired, id);
    return { id, isNew };
  });
  // ガチャ称号の実績。最終結果(昇格後)で数える。フリーズは freeze が非nullなら1回
  const finals = ids.map(byId);
  const ssrThis = finals.filter((s) => s.rarity === "SSR").length;
  const foilThis = finals.filter((s) => s.foil).length;
  const allRThis =
    ids.length === 10 && finals.every((s) => s.rarity === "R") ? 1 : 0;
  const g = state.gacha || {};
  const gacha = {
    freeze: count(g.freeze) + (freeze ? 1 : 0),
    foil: count(g.foil) + foilThis,
    ssr: count(g.ssr) + ssrThis,
    allR: count(g.allR) + allRThis,
    bestTenSsr: Math.max(count(g.bestTenSsr), ids.length === 10 ? ssrThis : 0),
  };
  return withHomePortraits({
    ...state,
    owned,
    acquired,
    gacha,
    tickets: tickets - cost,
    draws: state.draws + ids.length,
    missionDrawDay: missionPeriods().day,
    pending: { results, freeze },
    ...(receipt ? { pendingPull: null, lastPullId: receipt } : {}),
  });
}

export function pull(
  state,
  amount,
  random = Math.random,
  { free = FREE_GACHA } = {},
) {
  if (amount !== 1 && amount !== 10)
    throw new Error("1回または10回を選んでください");
  if (state.pending || state.lastCraft)
    throw new Error("先にガチャ・錬成の結果を確認してください");
  const cost = free ? 0 : amount * PULL_COST;
  const tickets = count(state.tickets);
  if (cost > tickets)
    throw new Error(`ガチャチケットが足りません(あと${cost - tickets}枚)`);
  const initial = Array.from({ length: amount }, () => drawOne(random));
  return applyPull(state, resolveSummonFreeze(initial, random), { free });
}

/**
 * ガチャ称号(src/game/titles.js)が使う実績のまとめ。
 * 抽選ごとの回数(collection.gacha)と、そろえた枚数(owned)から毎回作り直す。
 */
export function gachaStatsOf(state) {
  const g = state?.gacha || {};
  const owned = state?.owned || {};
  return {
    pulls: count(state?.draws),
    freeze: count(g.freeze),
    foil: count(g.foil),
    ssr: count(g.ssr),
    allR: count(g.allR),
    bestTenSsr: count(g.bestTenSsr),
    foilsOwned: FOIL_SKINS.filter((s) => count(owned[s.id]) > 0).length,
    normalsOwned: POOL.filter((s) => count(owned[s.id]) > 0).length,
  };
}

/** 無償ジェムを足す(端末の写し。正はサーバーの財布で、呼び出し側が earnGems で送る) */
export function addFreeGems(state, n) {
  const add = Number.isSafeInteger(n) && n > 0 ? n : 0;
  return add
    ? {
        ...state,
        gems: count(state.gems) + add,
        gemsFree: count(state.gemsFree) + add,
      }
    : state;
}

/** チケットを足す */
export function addTickets(state, n) {
  const add = Number.isSafeInteger(n) && n > 0 ? n : 0;
  return add ? { ...state, tickets: state.tickets + add } : state;
}

/** チケットを使う。足りなければ何もしない */
/** エーテルを足す。運営からの手紙やミッションの褒美から呼ぶ */
export function addEther(state, n) {
  const add = count(n);
  return add ? { ...state, ether: count(state.ether) + add } : state;
}

export function spendTickets(state, n) {
  const cost = Number.isSafeInteger(n) && n > 0 ? n : 0;
  if (!cost || state.tickets < cost) return state;
  return { ...state, tickets: state.tickets - cost };
}

/** ガチャを通さずにスキンを配る。ミッションの褒美から呼ぶ */
export function grantSkin(state, id) {
  if (!byId(id)) return state;
  const acquired = acquiredTotals(state);
  recordAcquisition(acquired, id);
  return withHomePortraits({
    ...state,
    acquired,
    owned: { ...state.owned, [id]: (state.owned[id] || 0) + 1 },
  });
}

/** 買ったフォイルを所持に足す(通常版の id で受ける)。通算獲得にも数える */
export function grantFoils(state, baseIds) {
  let next = state;
  for (const b of baseIds) next = grantSkin(next, foilId(baseSkinId(b)));
  return next;
}

export function equip(state, id) {
  const skin = byId(id);
  if (!skin || !state.owned[id])
    throw new Error("このスキンはまだ所持していません");
  return { ...state, equipped: { ...state.equipped, [skin.rank]: id } };
}
export function unequip(state, rank) {
  const equipped = { ...state.equipped };
  delete equipped[rank];
  return { ...state, equipped };
}
/**
 * ダブりを1枚崩して、エーテルに変える。
 * 最後の1枚と初回購入特典の札は崩さない(ether.js の決まり)。
 */
export function dismantle(state, id) {
  const check = dismantleCheck(state, id);
  if (!check.ok) throw new Error(check.why);
  const owned = { ...state.owned, [id]: state.owned[id] - 1 };
  return {
    ...state,
    owned,
    acquired: acquiredTotals(state),
    ether: count(state.ether) + check.gain,
  };
}

/**
 * 同じ通常版のダブりを、まとめてエーテルにする(本人の指示 2026-09-21)。
 * 錬成で10枚作ったあと、余りをまとめて崩せるように。最後の1枚は必ず残る。
 */
export function dismantleMany(state, id, n) {
  const check = dismantleCheck(state, id, n);
  if (!check.ok) throw new Error(check.why);
  return {
    ...state,
    owned: { ...state.owned, [id]: state.owned[id] - check.count },
    acquired: acquiredTotals(state),
    ether: count(state.ether) + check.gain,
  };
}

/**
 * フォイルのダブりを1枚崩して、フォイルの欠片にする(shards.js の決まり)。
 * 最後の1枚は残す。エーテルは増えない。
 */
export function shatter(state, id) {
  return shatterMany(state, id, 1);
}

/**
 * 同じフォイルのダブりを、まとめて欠片にする(本人の指示 2026-09-19)。
 * 最後の1枚は必ず残る(枚数の上限は shatterCheck が見る)。
 */
export function shatterMany(state, id, n) {
  const check = shatterCheck(state, id, n);
  if (!check.ok) throw new Error(check.why);
  return {
    ...state,
    owned: { ...state.owned, [id]: state.owned[id] - check.count },
    acquired: acquiredTotals(state),
    shards: count(state.shards) + check.gain,
  };
}

/**
 * 欠片を払って、持っていないフォイルを1枚作る。抽選はない(必ずそのフォイル)。
 * 交換で得た分も通算獲得に数える。結果は lastCraft に source: "exchange" で残す。
 */
export function exchangeFoil(state, baseId) {
  if (state.pending || state.lastCraft)
    throw new Error("先にガチャ・錬成の結果を確認してください。");
  const check = exchangeCheck(state, baseId);
  if (!check.ok) throw new Error(check.why);
  const id = foilId(baseSkinId(baseId));
  const acquired = acquiredTotals(state);
  recordAcquisition(acquired, id);
  return withHomePortraits({
    ...state,
    acquired,
    owned: { ...state.owned, [id]: (state.owned[id] || 0) + 1 },
    shards: count(state.shards) - check.cost,
    lastCraft: { id, isNew: true, source: "exchange" },
  });
}

/** 崩す対象に選べるレア度。記念の札(LIMITED・SPECIAL)はそもそも崩せないので入れない */
export const DISMANTLE_RARITIES = Object.freeze(["R", "SR", "SSR"]);
/** 既定で崩すレア度。SSR は守る(本人の指示 2026-09-17) */
export const DEFAULT_DISMANTLE_RARITIES = Object.freeze(["R", "SR"]);

/**
 * ガチャ結果のうち、**その抽選で来たダブりだけ**を崩してエーテルにする(本人の指示 2026-09-17)。
 *
 * 崩さないもの:
 *  - フォイル(欠片にする別の道があり、エーテルにはしない)
 *  - ペガサス・A などの記念の札(isKeepsake)
 *  - 最後の1枚(dismantleCheck が守る)
 *  - **抽選より前から持っていたダブり**。崩すのはこの抽選で増えた分までに限る
 *    (一括分解と違い、勝手に手持ちを減らさない)
 *
 * 状態を変えずに下見にも使える。返り値の state を捨てれば、gain と rows だけが得られる。
 */
export function dismantleResults(state, results, rarities = null) {
  const only = Array.isArray(rarities) ? new Set(rarities) : null;
  const pulled = {};
  for (const r of Array.isArray(results) ? results : [])
    if (r && typeof r.id === "string") pulled[r.id] = (pulled[r.id] || 0) + 1;
  let next = state;
  let gain = 0;
  const rows = [];
  for (const id of Object.keys(pulled)) {
    // 選んだレア度だけを崩す。選んでいないものは「重複」の印が付いていても残す
    if (only && !only.has(byId(id)?.rarity)) continue;
    let n = 0;
    // この抽選で来た枚数を上限に、崩せるだけ崩す
    while (n < pulled[id]) {
      const check = dismantleCheck(next, id);
      if (!check.ok) break;
      next = dismantle(next, id);
      gain += check.gain;
      n += 1;
    }
    if (n) rows.push({ id, count: n, gain: dustOf(byId(id)) * n });
  }
  return { state: next, gain, rows };
}

/**
 * 崩した札を、結果の並びのどの位置だったかに直す。
 * 同じ札が複数来ていたら**後ろから** count 枚に印を付ける(先頭は NEW の1枚なので残る)。
 */
export function dismantledIndexes(results, done) {
  const marked = new Map(); // index -> その1枚で得たエーテル
  if (!done) return marked;
  for (const row of done.rows) {
    const at = [];
    results.forEach((r, i) => {
      if (r.id === row.id) at.push(i);
    });
    const each = row.count ? Math.round(row.gain / row.count) : 0;
    for (const i of at.slice(-row.count)) marked.set(i, each);
  }
  return marked;
}

/** 通常版のダブりをまとめて崩す。フォイルは欠片にするので含めない。 */
export function dismantleAll(state) {
  let next = state;
  for (const skin of SKINS) {
    // 1枚ずつ減らす。途中で崩せなくなったら、その札はそこで止める
    while (dismantleCheck(next, skin.id).ok) next = dismantle(next, skin.id);
  }
  return next;
}

/** エーテルを払って、好きな1枚を作る。すでに持っている札なら枚数が増える */
export function craft(state, id, random = Math.random) {
  if (state.pending || state.lastCraft)
    throw new Error("先にガチャ・錬成の結果を確認してください");
  const check = craftCheck(state, id);
  if (!check.ok) throw new Error(check.why);
  const resultId = finishedId(id, random);
  const acquired = acquiredTotals(state);
  recordAcquisition(acquired, resultId);
  const isNew = !state.owned[resultId];
  const owned = {
    ...state.owned,
    [resultId]: (state.owned[resultId] || 0) + 1,
  };
  return withHomePortraits({
    ...state,
    owned,
    acquired,
    ether: count(state.ether) - check.cost,
    lastCraft: { id: resultId, isNew },
  });
}

/**
 * エーテルを払って、同じ札をまとめて作る(本人の指示 2026-09-19)。
 * 1枚ごとに 1% のフォイル抽選を**別々に**引く(まとめても確率は薄まらない)。
 *
 * 結果は lastCraft に入れる。2枚以上のときだけ results を添え、結果画面は
 * それを並べる。題名は今までどおり craftResult が真なら「錬成結果」になる。
 */
export function craftMany(state, id, n, random = Math.random) {
  if (state.pending || state.lastCraft)
    throw new Error("先にガチャ・錬成の結果を確認してください");
  const check = craftCheck(state, id, n);
  if (!check.ok) throw new Error(check.why);
  const acquired = acquiredTotals(state);
  const owned = { ...state.owned };
  const results = [];
  for (let i = 0; i < check.count; i += 1) {
    const resultId = finishedId(id, random);
    recordAcquisition(acquired, resultId);
    // 同じ回の中で2枚目以降は NEW にしない。走らせながら数える
    const isNew = !owned[resultId];
    owned[resultId] = (owned[resultId] || 0) + 1;
    results.push({ id: resultId, isNew });
  }
  return withHomePortraits({
    ...state,
    owned,
    acquired,
    ether: count(state.ether) - check.cost,
    // **pending には入れない**。pending は召喚の席で、自動分解(ResultDismantle)・
    // freeze・logPull・閉じたあとのフォイル窓が全部そこにぶら下がっている。
    // 錬成は払った 1/4 しか戻らない(CRAFT_RATIO=4)ので、自動分解を入れている人が
    // まとめて作った瞬間に大半を無言で失う。lastCraft 側を複数枚に広げる。
    // id / isNew は1枚目のぶんを残す(craftResult.id を見ている既存の箇所のため)
    lastCraft:
      results.length > 1
        ? { id: results[0].id, isNew: results[0].isNew, results }
        : { id: results[0].id, isNew: results[0].isNew },
  });
}

export function claimEarly(state) {
  if (state.earlyClaimed) return state;
  const owned = { ...state.owned };
  for (const skin of SKINS.filter((s) => s.rarity === "LIMITED"))
    owned[skin.id] = (owned[skin.id] || 0) + 1;
  return { ...state, owned, earlyClaimed: true };
}

export function claimSpecial(state, id) {
  const skin = byId(id);
  if (skin?.rarity !== "SPECIAL" || skin.foil)
    throw new Error("特別スキンを選んでください");
  if (state.owned[id]) return state;
  return { ...state, owned: { ...state.owned, [id]: 1 } };
}

/**
 * フォイルが「明らかになった」か。**いま持っているか**だけで決める。
 * ガチャ・錬成・フォイル加工・配布など、入手の経路は見ない(経路は今後増える)。
 *
 * フォイルかどうかは台帳(catalog.js)の `foil` の印で見る。id の付け方に頼らない。
 * 持つまでは、フォイル関連(フォイル版の一覧・切り替え・加工・効果盤面の説明・
 * 第13話・ルール画面のタブ)を画面に出さない。ガチャの提供割合だけは、
 * 持つ前からフォイルの確率を明記する(本人の決め、2026-09-09)。
 */
export function foilRevealed(state) {
  const owned = state?.owned || {};
  return ALL_SKINS.some((skin) => skin.foil && owned[skin.id] > 0);
}
