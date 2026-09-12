/**
 * 広告リワード(iOS の AdMob)。広告を1本見ると、ガチャ1回ぶん(チケット1枚)。
 * 1日の上限(ADS_PER_DAY)はサーバーが数える。ここは「広告を出す」だけで、
 * 報酬の付与はサーバーの財布(/api/wallet/ad-reward)で行う(端末は回数を決めない)。
 * Web では広告を出さない(iOS だけ)。
 *
 * ネイティブの広告 ID は本人が AdMob で作る。設定は catalog/env ではなくビルド時に
 * 差し込む(いまはテスト用の公開 ID を既定にしてある。配信前に本番 ID へ)。
 */
import { Capacitor } from "@capacitor/core";
import { ensureAuth } from "./auth.js";
import { seasonApiBase } from "./season.js";
import { updateCollection } from "../skins/store.js";
import { newEventId } from "./wallet.js";

// Google が公開しているリワード動画のテスト ID。配信前に本番の広告ユニット ID に差し替える
const TEST_REWARDED_AD_ID = "ca-app-pub-3940256099942544/1712485313";
const AD_UNIT_ID =
  (typeof __ADMOB_REWARDED_ID__ !== "undefined" && __ADMOB_REWARDED_ID__) || TEST_REWARDED_AD_ID;

let admob = null;
let initialized = false;

async function mod() {
  if (admob) return admob;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return null;
  admob = await import("@capacitor-community/admob");
  return admob;
}

/** 広告を出せる端末か(iOS で、プラグインが載っている) */
export async function adsAvailable() {
  return !!(await mod());
}

async function ensureInit(m) {
  if (initialized) return;
  await m.AdMob.initialize();
  initialized = true;
}

/**
 * 広告を1本見せ、最後まで見たらサーバーに報酬(チケット1枚)を頼む。
 * 返り値: 見なかった/失敗なら null、もらえたら財布の要約(残り回数つき)。
 * サーバーが1日の上限を持つので、端末をいじっても3回を超えては配られない。
 */
export async function watchAdForTicket() {
  const m = await mod();
  if (!m) throw new Error("広告は iOS アプリで見られます。");
  const { AdMob, RewardAdPluginEvents } = m;
  await ensureInit(m);
  let earned = false;
  const onReward = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
    earned = true;
  });
  try {
    await AdMob.prepareRewardVideoAd({ adId: AD_UNIT_ID });
    await AdMob.showRewardVideoAd();
  } catch {
    await onReward.remove();
    throw new Error("広告を読み込めませんでした。少し待ってからお試しください。");
  }
  await onReward.remove();
  if (!earned) return null; // 途中で閉じた
  return claimAdReward();
}

/** 見終わった広告の報酬をサーバーに頼む(冪等)。通信できないと投げる */
async function claimAdReward() {
  const auth = await ensureAuth();
  if (!auth) throw new Error("通信を確認して、もう一度お試しください。");
  const res = await fetch(`${seasonApiBase()}/api/wallet/ad-reward`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.idToken}` },
    body: JSON.stringify({ id: newEventId("ad") }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "報酬を受け取れませんでした。");
  if (Number.isSafeInteger(data.tickets))
    await updateCollection((s) => ({ ...s, tickets: data.tickets }));
  return data;
}
