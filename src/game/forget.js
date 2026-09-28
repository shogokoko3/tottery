/**
 * 端末に残ったものを**全部**消す(2026-09-28 本人の報告
 * 「アカウントを消しても、以前に引いたガチャ結果が残ったままでした」)。
 *
 * それまでは profile.js の forgetMe が **名前と戦績だけ**を消していた。
 * スキンの所持(tottery.skins.v1)・財布・バトルパス・詰めの進み・設定などは
 * そのまま残るので、消して名前を付け直しても、前の人の引いた札が並んでいた。
 *
 * 消し方は「鍵の名前で1つずつ」にしない。**`tottery.` で始まる鍵を全部**消す。
 * 保存する場所が増えるたびに消し忘れる(まさに今回それで起きた)ので、
 * 数え上げない形にしておく。
 *
 * localStorage だけでなく sessionStorage も見る
 * (src/net/match-rating.js が tottery.match-ratings.v2 をそちらへ置く)。
 *
 * 消したあとは画面を開き直す(呼ぶ側がそうしている)。
 * 覚えている値(スキンの写しなど)も一緒に捨てるため
 */

/** この印で始まる鍵は、このアプリのもの */
export const STORAGE_PREFIX = "tottery.";

/** 見る保存先。window が無いところ(検査)では空 */
function stores() {
  const out = [];
  for (const name of ["localStorage", "sessionStorage"]) {
    try {
      const s = globalThis[name];
      if (s && typeof s.removeItem === "function") out.push(s);
    } catch {
      // プライベートブラウズなどで触れないことがある。触れるものだけ見る
    }
  }
  return out;
}

/** その保存先にある、このアプリの鍵 */
export function keysIn(store) {
  const keys = [];
  try {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (typeof k === "string" && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
  } catch {
    // 読めなければ消しようもない
  }
  return keys;
}

/**
 * このアプリの保存を全部消す。返り値は消した鍵の並び(検査と、消し残りの確認に使う)。
 * 消せない鍵があっても、そこで止めずに残りを消す
 */
export function forgetEverything() {
  const removed = [];
  for (const store of stores())
    for (const key of keysIn(store)) {
      try {
        store.removeItem(key);
        removed.push(key);
      } catch {
        // 1つ消せなくても、ほかは消す
      }
    }
  return removed;
}

/** 消し残りがあるか(消したあとの確かめ用) */
export function leftovers() {
  return stores().flatMap(keysIn);
}
