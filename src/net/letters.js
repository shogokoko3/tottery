/**
 * 運営からの手紙。
 *
 * 補填やプレゼントを渡すための一方向の連絡。サーバーの letters/<id> に置き、
 * 端末は起動時に読んで、受け取っていないものを未読として出す。
 *
 *   宛先 to: "all"      … 全員宛て
 *        to: "<端末id>" … その端末だけ
 *
 * 受け取ったかどうかは端末側(profile.letters)にだけ控える。サーバーには
 * 誰が受け取ったかを書かない(端末を替えれば取り直せてしまうが、いまは
 * 本人確認の仕組みが無いので、そこは割り切る)。
 *
 * 添付(gifts)は [{ type, id?, amount? }] の並び。ミッションの褒美と同じ形に
 * してあるので、配る側の処理も同じものを使える。
 */
import { DB_URL } from "./firebase.js";
import { authedFetch } from "./auth.js";

const TIMEOUT_MS = 8000;
/** 一度に読む手紙の数 */
export const LETTER_LIMIT = 50;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_r, reject) =>
      setTimeout(() => {
        const err = new Error("timeout");
        err.__timeout = true;
        reject(err);
      }, ms),
    ),
  ]);
}

/** 添付1つの形をそろえる。知らないものは落とす */
export function normalizeGift(raw) {
  if (!raw || typeof raw !== "object") return null;
  const type = raw.type;
  if (type === "ticket" || type === "ether" || type === "xp") {
    const amount = Number(raw.amount);
    return Number.isSafeInteger(amount) && amount > 0 ? { type, amount } : null;
  }
  if (type === "title" || type === "icon" || type === "skin")
    return typeof raw.id === "string" && raw.id ? { type, id: raw.id } : null;
  return null;
}

/** 手紙1通の形をそろえる */
export function normalizeLetter(id, raw) {
  if (!raw || typeof raw !== "object") return null;
  const subject = String(raw.subject || "").slice(0, 60);
  if (!subject) return null;
  return {
    id,
    to: typeof raw.to === "string" && raw.to ? raw.to : "all",
    subject,
    body: String(raw.body || "").slice(0, 1000),
    gifts: Array.isArray(raw.gifts)
      ? raw.gifts.map(normalizeGift).filter(Boolean).slice(0, 10)
      : [],
    at: Number(raw.at) || 0,
    // 期限。過ぎた手紙は届かない。0 なら期限なし
    until: Number(raw.until) || 0,
  };
}

/**
 * 自分に届いているお知らせか。
 *
 * 置き場を分けたので、届く時点でもう自分宛てのものしか来ない。
 * ここで見るのは期限だけ。myId は残してあるが、混ぜていた頃の
 * 保存を読み込んだときのために、宛先が入っていれば一応照らす。
 */
export function isFor(letter, myId, now) {
  if (!letter) return false;
  if (letter.until && letter.until < (now == null ? Date.now() : now))
    return false;
  if (!letter.to || letter.to === "all") return true;
  return !myId || letter.to === myId;
}

/** 1か所ぶんを読んで、形をそろえた並びにする */
async function readFrom(path) {
  const res = await withTimeout(
    authedFetch(
      `${DB_URL}/${path}.json?orderBy=%22at%22&limitToLast=${LETTER_LIMIT}`,
    ),
    TIMEOUT_MS,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Object.entries(data || {})
    .map(([id, row]) => normalizeLetter(id, row))
    .filter(Boolean);
}

/**
 * お知らせを読む。読めなくても遊びは止めないので、黙って空を返す。
 *
 * 置き場を2つに分けてある。
 *   letters/all/<id>       … 全員宛て。サインインしていれば誰でも読める
 *   letters/to/<uid>/<id>  … 個人宛て。**本人と運営しか読めない**
 * ひとつの木に混ぜていたときは、端末が全部を受け取ってから自分宛てを
 * 選り分けていた。つまり他人宛ての件名・本文・添付・宛先が、通信としては
 * 全員に渡っていた。分けたので、届く前に絞られる。
 */
export async function readLetters(myUid) {
  try {
    const [all, mine] = await Promise.all([
      readFrom("letters/all"),
      myUid ? readFrom(`letters/to/${myUid}`) : Promise.resolve([]),
    ]);
    const list = [...all, ...mine].sort((a, b) => b.at - a.at);
    return { ok: true, list };
  } catch {
    return { ok: false, list: [] };
  }
}

/* ---- 管理画面から ---- */

/** 手紙を出す */
export async function sendLetter(letter) {
  const body = {
    to: letter.to || "all",
    subject: String(letter.subject || "").slice(0, 60),
    body: String(letter.body || "").slice(0, 1000),
    gifts: (letter.gifts || []).map(normalizeGift).filter(Boolean),
    at: Date.now(),
    ...(letter.until ? { until: Number(letter.until) } : null),
  };
  if (!body.subject) throw new Error("件名を入れてください");
  // 全員宛てと個人宛てで置き場が違う。個人宛ては本人しか読めない場所へ
  const where = body.to === "all" ? "letters/all" : `letters/to/${body.to}`;
  const res = await withTimeout(
    authedFetch(`${DB_URL}/${where}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** お知らせを取り消す。個人宛ては宛先も要る */
export async function deleteLetter(id, to) {
  const where = !to || to === "all" ? "letters/all" : `letters/to/${to}`;
  const res = await withTimeout(
    authedFetch(`${DB_URL}/${where}/${id}.json`, { method: "DELETE" }),
    TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
