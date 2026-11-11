/**
 * TestFlight の期間に遊んだ人の記録を、一度だけ全部消す(2026-11-11 本人の指示
 * 「テストフライトから遊んでいるプレイヤーのデータを初期化してください」。範囲は「全部を最初から」)。
 *
 * 見分け方: この端末のアカウント(Firebase の口座)が作られた時刻が、App Store で公開した
 * 2026-11-11 08:47(日本時間)より前なら、テスト期間の人。公開の時点で口座は 647 件あり、
 * 公開後に作られたものは 0 件だった(auth:export で確認)。
 *
 * 消し方は「自分の記録を消す」(overlays.jsx の DeleteMeModal)と同じ手順:
 *   送り待ちを捨てる → シーズン台帳・財布・フレンド(Worker の forget) → ランキングと台帳(Firebase)
 *   → 端末の `tottery.` の鍵を全部。口座の控え(tottery.auth.v1)も消えるので、次は新しい口座になる。
 *
 * 画面を出す前(main.jsx)に走らせる。画面が先に読み込むと、消したあとに古い値を書き戻すため。
 * - 起動した時点で口座の控えが無い(新しく入れた)端末は、調べずに印だけ付ける。
 *   あとで Apple でサインインして古い口座に戻っても、消し直さない
 * - 通信できない・サーバー側が消せないときは、端末の中は消さず印も付けない(次の起動でやり直す)
 * - 終わったら印(MARK)を付ける。印は端末の鍵を全部消したあとに付ける
 */
import { API_KEY, ensureAuth } from "./auth.js";
import { clearProfileSync } from "./profile-sync.js";
import { clearSeasonQueue, forgetSeason } from "./season.js";
import { deleteRank } from "./ranking.js";
import { forgetMe, loadProfile } from "../game/profile.js";
import { forgetEverything } from "../game/forget.js";

/** App Store で公開した時刻(2026-11-11 08:47 JST) */
export const RELEASE_CUTOFF = Date.parse("2026-11-10T23:47:00Z");
/** 調べ終わった印。消したあとに付けるので、全部消す対象には入らない */
export const MARK = "tottery.tf-reset.v1";
const AUTH_KEY = "tottery.auth.v1";

/** 消すかどうか。口座の控えがあり、その口座が公開より前に作られたときだけ */
export function shouldReset({ hadAccount, createdAt }) {
  if (!hadAccount) return false;
  const t = Number(createdAt);
  return Number.isFinite(t) && t > 0 && t < RELEASE_CUTOFF;
}

/** 口座の作られた時刻(ms)。分からなければ null */
async function accountCreatedAt() {
  const auth = await ensureAuth();
  if (!auth?.idToken) return null;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: auth.idToken }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!res.ok) return null;
  const created = Number((await res.json()).users?.[0]?.createdAt);
  return Number.isFinite(created) && created > 0 ? created : null;
}

/**
 * 必要なら一度だけ消す。返り値は { reset: true } (消した) / { reset: false }。
 * stillWanted() が偽になったら(起動を待たせすぎたとき)、端末の中を消す手前で止める。
 * deps は検査用の差し替え口
 */
export async function runTestflightReset({
  storage = globalThis.localStorage,
  stillWanted = () => true,
  deps,
} = {}) {
  try {
    if (!storage || storage.getItem(MARK)) return { reset: false };
  } catch {
    return { reset: false };
  }
  const d = deps || defaultDeps();
  const mark = () => {
    try {
      storage.setItem(MARK, String(Date.now()));
    } catch {
      /* 付けられなければ次も調べる。口座が新しくなっているので消し直しにはならない */
    }
  };
  let hadAccount = false;
  try {
    hadAccount = !!storage.getItem(AUTH_KEY);
  } catch {
    /* 読めなければ新しい端末として扱う */
  }
  if (!hadAccount) {
    mark();
    return { reset: false };
  }
  let createdAt;
  try {
    createdAt = await d.createdAt();
  } catch {
    return { reset: false }; // 通信できない。次の起動で
  }
  if (createdAt == null) return { reset: false };
  if (!shouldReset({ hadAccount, createdAt })) {
    mark();
    return { reset: false };
  }
  try {
    // DeleteMeModal と同じ順番。サーバー側が消せなければ端末の中は消さない
    await d.clearProfileSync();
    d.clearSeasonQueue();
    await d.forgetSeason();
    const id = d.profileId();
    if (id) {
      const res = await d.deleteRank(id);
      if (!res?.ok) return { reset: false };
    }
  } catch {
    return { reset: false };
  }
  if (!stillWanted()) return { reset: false };
  d.forgetMe();
  d.forgetEverything();
  mark();
  return { reset: true };
}

const defaultDeps = () => ({
  createdAt: accountCreatedAt,
  clearProfileSync,
  clearSeasonQueue,
  forgetSeason,
  deleteRank,
  profileId: () => loadProfile().id,
  forgetMe,
  forgetEverything,
});
