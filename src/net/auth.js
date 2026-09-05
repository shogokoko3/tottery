/**
 * Firebase の匿名サインイン。
 *
 * ■ なぜ要るか
 * これまでは認証を一切使わず、端末が自分で名乗った id をそのまま信じていた。
 * そのため誰でも他人の行を書き換え・削除でき、運営を名乗ってお知らせも配れた
 * (公開中のURLに対して実測で確認済み)。
 *
 * 匿名サインインを通すと、Firebase が端末ごとに uid を発行する。
 * これは端末が名乗るものではなく Firebase が署名して発行するので、
 * 他人になりすませない。ルール側で「自分の uid の行だけ書ける」を強制する。
 *
 * ■ 匿名でも本人確認になる理由
 * 名前もメールも聞かないが、uid は Firebase が持つ鍵で署名された合言葉付き
 * (idToken)でしか使えない。合言葉は1時間で切れ、refreshToken で取り直す。
 * refreshToken は端末の中にだけ置く。
 *
 * ■ SDK を載せない理由
 * 通信は REST で足りるうえ、SDK を足すと配布物が数百KB太る。
 * 使う口は2つだけ。
 *   accounts:signUp        … 匿名の口座を作る
 *   securetoken /v1/token  … 合言葉を取り直す
 */

/**
 * Firebase コンソールの「ウェブ API キー」。
 * (プロジェクトの設定 → 全般 → ウェブ API キー)
 *
 * これは秘密ではない。誰の端末にも配られる前提のもので、これ単体では
 * 何もできない。何ができるかを決めるのはデータベースのルールのほう。
 */
export const API_KEY = "";

/** 取り直し用の合言葉を控える場所。端末の外へは出さない */
const KEY = "tottery.auth.v1";
const TIMEOUT_MS = 8000;
/** 期限より少し early に取り直す。時計のずれと通信の遅れを見込む */
const EARLY_MS = 5 * 60 * 1000;

/** いま持っている合言葉。{ idToken, uid, expiresAt } */
let held = null;
/** 同時に何度も呼ばれても、取りに行くのは1回だけにする */
let inflight = null;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_r, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

function readSaved() {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.refreshToken === "string" ? v : null;
  } catch {
    return null;
  }
}

function save(refreshToken, uid) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ refreshToken, uid }));
  } catch {
    // 保存できなくても遊べる方を優先する。次に開いたとき別の uid になるだけ
  }
}

/** 匿名の口座を新しく作る */
async function signUp() {
  const res = await withTimeout(
    fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
      },
    ),
    TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`signUp HTTP ${res.status}`);
  const d = await res.json();
  save(d.refreshToken, d.localId);
  return {
    idToken: d.idToken,
    uid: d.localId,
    expiresAt: Date.now() + Number(d.expiresIn || 3600) * 1000,
  };
}

/** 控えてある合言葉で取り直す */
async function refresh(refreshToken) {
  const res = await withTimeout(
    fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    }),
    TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`refresh HTTP ${res.status}`);
  const d = await res.json();
  // 取り直すと合言葉が変わることがあるので、控えも更新する
  save(d.refresh_token || refreshToken, d.user_id);
  return {
    idToken: d.id_token,
    uid: d.user_id,
    expiresAt: Date.now() + Number(d.expires_in || 3600) * 1000,
  };
}

/**
 * 使える合言葉を用意する。失敗しても投げず null を返す。
 * 通信できないときに対局そのものが止まらないようにするため。
 */
export async function ensureAuth() {
  if (!API_KEY) return null;
  if (held && held.expiresAt - EARLY_MS > Date.now()) return held;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const saved = readSaved();
      // 一度でも作ってあれば、同じ uid のまま取り直す(記録が続く)
      held = saved ? await refresh(saved.refreshToken) : await signUp();
      return held;
    } catch {
      // 控えが古くて弾かれたときは、作り直して次に繋ぐ
      try {
        held = await signUp();
        return held;
      } catch {
        held = null;
        return null;
      }
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** いまの uid。まだ通っていなければ null */
export function myUid() {
  return held ? held.uid : (readSaved() || {}).uid || null;
}

/**
 * 合言葉を付けた URL にする。通っていなければ素のまま返す
 * (ルールが公開のうちは素のままでも通り、締めたあとは弾かれる)
 */
export async function authed(url) {
  const a = await ensureAuth();
  if (!a) return url;
  return `${url}${url.includes("?") ? "&" : "?"}auth=${encodeURIComponent(a.idToken)}`;
}
