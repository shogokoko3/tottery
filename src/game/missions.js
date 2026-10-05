/**
 * 通常ミッション。条件を満たすと褒美を受け取れる。
 *
 * 台帳に1行足せば増える。条件は「いまの数字」と「目標」の比べ算だけにして、
 * 進み具合をそのまま帯で出せるようにしてある。
 *
 * kind は条件の種類。増やすときは STATS に読み方を足す。
 *   days    使用頻度(遊んだ日数)     → 称号・スキン
 *   level   プレイヤーレベル          → ガチャチケット・アイコン
 *   battles 対戦回数(チュートリアルは含めない) → ガチャチケット
 *   foil    指定キャラのフォイル所持         → 専用称号
 *
 * reward の type:
 *   title / icon / skin  それぞれの id を配る
 *   ticket               amount 枚のガチャチケットを配る
 */
import { levelOf } from "./profile.js";
import { MISSIONS } from "./mission-catalog.js";
import { foilRevealed } from "../skins/collection.js";
import { periodicMissionRows } from "./periodic-missions.js";

/** 条件ごとの、いまの数字の読み方 */
export const STATS = {
  days: (p) => p.days || 0,
  level: (p) => levelOf(p),
  battles: (p) => p.battles || 0,
  foil: (_profile, collection, mission) => {
    const owned = collection?.owned?.[mission?.skinId];
    return Number.isSafeInteger(owned) && owned > 0 ? 1 : 0;
  },
};

/** 条件ごとの見出しと単位 */
export const KINDS = {
  days: { label: "使用頻度", unit: "日" },
  level: { label: "プレイヤーレベル", unit: "" },
  battles: { label: "対戦回数", unit: "戦" },
  foil: { label: "フォイル獲得", unit: "枚" },
};

export { MISSIONS } from "./mission-catalog.js";

export const byId = (id) => MISSIONS.find((m) => m.id === id) || null;

/**
 * ミッション1つの様子。
 * now が goal に届いていれば done、受け取り済みなら claimed。
 */
export function statusOf(mission, profile, collection) {
  if (mission.periodic)
    return (
      periodicMissionRows(profile, collection).find(
        (m) => m.id === mission.id,
      ) || { ...mission, done: false, claimed: false, now: 0, ratio: 0 }
    );
  const read = STATS[mission.kind];
  const raw = read ? read(profile, collection, mission) : 0;
  const currency = ["ticket", "gems"].includes(mission.reward.type);
  const claimed = currency && Array.isArray(collection?.walletMissionClaims)
    ? collection.walletMissionClaims.includes(mission.id)
    : (profile.missions || []).includes(mission.id);
  // Keep a received foil mission complete even while collection data is absent.
  const now =
    claimed && mission.kind === "foil" ? Math.max(raw, mission.goal) : raw;
  const done = now >= mission.goal;
  return {
    ...mission,
    now: Math.min(now, mission.goal),
    raw,
    done,
    claimed,
    ratio: mission.goal ? Math.min(1, now / mission.goal) : 0,
  };
}

/**
 * 一覧。受け取れるものを先に、次に進行中、最後に受け取り済み。
 * 同じ種類の中では目標の小さい順。
 */
export function listMissions(profile, collection) {
  const rank = (s) => (s.done && !s.claimed ? 0 : s.claimed ? 2 : 1);
  // フォイルのミッションは、フォイルを1枚も持たないうちは見せない(達成・受取済みなら出す)
  const known = foilRevealed(collection);
  return [
    ...MISSIONS.filter((m) => m.kind !== "foil" || known).map((m) =>
      statusOf(m, profile, collection),
    ),
    ...periodicMissionRows(profile, collection),
  ].sort((a, b) => rank(a) - rank(b) || a.goal - b.goal);
}

/** 受け取れるものの数。入り口に出す印に使う */
export function claimableCount(profile, collection) {
  return listMissions(profile, collection).filter((m) => m.done && !m.claimed)
    .length;
}
