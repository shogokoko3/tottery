/**
 * 名前に使えない語の判定。
 *
 * プレイヤー名は、見ず知らずの対戦相手の画面と、世界中に公開される
 * ランキングに出る。App Store のガイドライン 1.2 は、利用者が作った文章を
 * 他人に見せるアプリに「投稿される前に不適切なものを弾く仕組み」を求めている。
 *
 * **完全な検査はできない。** ここで止めるのは、そのまま出すと明らかにまずいものだけ。
 * 抜けたものは通報(src/net/reports.js)で受けて、運営が消す。この2段構えで扱う。
 *
 * 判定の前に必ず normalizeForCheck() を通す。全角・伏せ字・繰り返しで
 * すり抜けるのを防ぐため。
 */

/**
 * 判定用に文字を均す。表示には使わない。
 *
 * - NFKC で全角英数を半角に(ＦＵＣＫ → fuck)
 * - 小文字化
 * - ゼロ幅文字と結合文字を落とす(f‍uck のような割り込みを潰す)
 * - 数字や記号による伏せ字を戻す(f4ck, sh1t, @ss → fuck, shit, ass)
 * - 同じ文字の3連以上を1つに畳む(fuuuuck → fuck)
 * - カタカナをひらがなに寄せる(シネ → しね)
 * - 残った記号・空白を落とす(f.u.c.k → fuck)
 */
export function normalizeForCheck(raw) {
  let s = String(raw == null ? "" : raw);
  try {
    s = s.normalize("NFKC");
  } catch {
    // 環境が normalize を持たないときは、そのまま進める
  }
  s = s.toLowerCase();
  // ゼロ幅・方向制御・結合文字
  s = s.replace(/[​-‏‪-‮⁠-⁯﻿̀-ͯ]/g, "");
  // 見た目が似た文字の置き換え
  const LOOKALIKE = {
    "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
    "@": "a", $: "s", "!": "i", "|": "i", "+": "t",
  };
  s = s.replace(/[0134578@$!|+]/g, (c) => LOOKALIKE[c] || c);
  // カタカナ → ひらがな(長音符はそのまま)
  s = s.replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
  // 3連以上の繰り返しを1つに
  s = s.replace(/(.)\1{2,}/g, "$1");
  // 英数・かな・漢字以外を落とす
  s = s.replace(/[^0-9a-z぀-ゟ一-鿿]/g, "");
  return s;
}

/**
 * どこに含まれていても断る語。
 * 他の語に紛れにくい、それ自体で露骨なものだけを置く。
 *
 * 増やすときは tools/check-account.mjs にも例を1つ足すこと。
 */
const BAD_ANYWHERE = [
  // 英語の露骨な語(伏せ字は正規化が畳むので素の形だけでよい)
  "fuck", "fck", "fack", "phuck", "shit", "sht", "cunt", "bitch", "btch",
  "bastard", "asshole", "dick", "cock", "pussy", "penis", "vagina",
  "boobs", "porn", "sex", "rape", "nigger", "nigga", "faggot", "retard",
  "whore", "slut", "wank", "jerkoff",
  // 憎悪・暴力
  "hitler", "nazi", "kkk", "isis", "killyou", "killurself", "kys",
  "suicide", "genocide",
  // 日本語(正規化でカタカナはひらがなになる)
  "ころして", "くたばれ", "きちがい", "きえうせろ",
  "ちんこ", "ちんちん", "まんこ", "おっぱい", "せっくす",
  "ヴぁぎな", "ぺにす", "れいぷ", "ちかん", "ろりこん",
  "うんこ", "うんち", "ごみくず", "しねよ", "しねや",
  // 漢字の形(正規化ではかなに変わらないので個別に置く)
  "死ね", "殺す", "殺せ", "自殺", "強姦", "痴漢", "変態", "売春",
  "馬鹿", "阿呆", "気違い", "基地外",
  // なりすまし
  "うんえい", "かんりにん", "じむきょく",
  "運営", "管理人", "公式", "事務局",
  "admin", "moderator", "official", "staff", "support", "tottery",
];

/**
 * 名前の全体がこれと一致したときだけ断る語。
 *
 * 短くて、まっとうな名前の一部として出てくるもの。
 * 例: 「しね」を部分一致で断ると「かしね」まで巻き込む。
 */
const BAD_EXACT = [
  "しね", "ころす", "じさつ", "きえろ", "きもい", "うざい",
  "ぶす", "でぶ", "はげ", "げり", "しっこ",
  "ばか", "あほ", "くそ", "糞", "屑",
  "きちく", "どれい", "えた", "ひにん",
];

/**
 * 使えない語を含むか。
 * 含むときはその語を、問題なければ null を返す。
 */
export function findBadWord(raw) {
  const s = normalizeForCheck(raw);
  if (!s) return null;
  for (const w of BAD_ANYWHERE) if (s.includes(w)) return w;
  for (const w of BAD_EXACT) if (s === w) return w;
  return null;
}

/** 使えない語を含むか。真偽だけ要るとき */
export function isBadName(raw) {
  return findBadWord(raw) !== null;
}

/** 検査から見た語の数。tools/check-account.mjs が数える */
export const BAD_WORD_COUNT = BAD_ANYWHERE.length + BAD_EXACT.length;
