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
// 受け取り済みのキー(2026-09-05)。移行の段取りが整うまでは入れない。
// 入れた瞬間から uid への付け替えが始まり、ranks の行がいったん消えるため。
//   AIzaSyDcV6cXMZyzOYrhpUO2Pd4wvP9oXe9vTdY

/** 取り直し用の合言葉を控える場所。端末の外へは出さない */
const KEY = "tottery.auth.v1";
/**
 * サインインの上限。呼び出し側の上限(8秒)より短くしてある。
 * 同じ8秒にすると、サインインだけで持ち時間を使い切り、
 * そのあとの本来の通信ぶんが残らない。
 */
const TIMEOUT_MS = 4000;
/** 期限より少し early に取り直す。時計のずれと通信の遅れを見込む */
const EARLY_MS = 5 * 60 * 1000;

/** いま持っている合言葉。{ idToken, uid, expiresAt } */
let held = null;
/** 同時に何度も呼ばれても、取りに行くのは1回だけにする */
let inflight = null;
/**
 * 失敗したあと、次に試してよくなる時刻。
 *
 * これが無いと、圏外のときに呼ばれるたび8秒待たされる。対局中は0.7秒ごとに
 * 手番を読みに行くので、待ちが積み上がって盤が固まって見える。
 * 一度失敗したらしばらく諦めて、素の URL で進む(繋がらないのは同じだが、待たない)。
 */
let quietUntil = 0;
const RETRY_MS = 30 * 1000;

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

/**
 * 取り直しが弾かれた理由が「控えがもう使えない」ときだけ真。
 *
 * 通信が届かなかっただけで口座を作り直すと uid が変わり、その人の記録が
 * 別人のものになる(ランキングに同じ人が二重に並ぶ)。作り直してよいのは、
 * 控えそのものが無効だと Firebase が言ったときだけ。
 */
const DEAD_TOKEN = [
  "TOKEN_EXPIRED",
  "USER_DISABLED",
  "USER_NOT_FOUND",
  "INVALID_REFRESH_TOKEN",
  "MISSING_REFRESH_TOKEN",
];

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
  if (!res.ok) {
    // 本文の error.message を見て、控えが死んでいるのかどうかを分ける
    let why = "";
    try {
      why = ((await res.json()).error || {}).message || "";
    } catch {
      /* 本文が読めなくても、下の判定で「死んでいない」に倒す */
    }
    const err = new Error(`refresh HTTP ${res.status}`);
    err.__dead = res.status === 400 && DEAD_TOKEN.some((m) => why.includes(m));
    throw err;
  }
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
  // 直前に失敗しているあいだは、待たずにすぐ諦める。
  // ただし手持ちの合言葉がまだ本当に切れていないなら、それを使う。
  // 早めの取り直し(5分前)にしくじっただけで捨てると、まだ使えるものを
  // 手放して素の通信になり、締めたあとは対局中の手が届かなくなる
  if (Date.now() < quietUntil) return usable();

  inflight = (async () => {
    try {
      const saved = readSaved();
      // 一度でも作ってあれば、同じ uid のまま取り直す(記録が続く)
      held = saved ? await refresh(saved.refreshToken) : await signUp();
      quietUntil = 0;
      return held;
    } catch (err) {
      // 作り直してよいのは「控えが死んでいる」と Firebase が言ったときだけ。
      // 圏外や 5xx で作り直すと uid が変わり、その人の記録が別人になる
      if (err && err.__dead) {
        try {
          held = await signUp();
          quietUntil = 0;
          return held;
        } catch {
          /* 作り直しても駄目なら、下の諦めへ */
        }
      }
      quietUntil = Date.now() + RETRY_MS;
      // 手持ちがまだ切れていなければ手放さない
      return usable();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 期限がまだ来ていない合言葉。切れていれば null */
function usable() {
  return held && held.expiresAt > Date.now() ? held : null;
}

/** いまの uid。まだ通っていなければ null */
export function myUid() {
  return held ? held.uid : (readSaved() || {}).uid || null;
}

/**
 * 合言葉を付けてから投げる。
 *
 * `fetch(await authed(url))` と書くと、合言葉を取りに行く往復が
 * 呼び出し側の withTimeout の**外**に出てしまう。取りに行くのに8秒、
 * そのあと通信に8秒で、上限が二重に積まれる。対局中は0.7秒ごとに
 * 読みに行くので、これだけで盤が止まって見える。
 *
 * ひとつの約束にまとめて返せば、呼び出し側の withTimeout が
 * 合言葉の取得ごと包む。
 */
export function authedFetch(url, init) {
  return (async () => fetch(await authed(url), init))();
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
