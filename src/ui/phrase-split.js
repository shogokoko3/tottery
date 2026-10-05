/**
 * 文を句(語のまとまり)に切る(2026-10-06 見直し)。画面の部品は phrases.jsx の Phrases が、検査は直接これを使う。
 *
 * iPhone の WebKit は word-break: auto-phrase を知らない。幅が足りないと「二枚をね/らう。」「王だっ/た。」
 * 「選ん/でいる。」のように語の途中で割れる。句を1つの塊(.text-phrase。display: inline-block)にして、
 * 塊の間でだけ折り返す。
 *
 * 行は文字列か句の配列(primer.jsx と同じ決まり)。文字列は読点・句点・「?」のあとで切る。
 * 読点の無い長い句は、持つ側が配列で手で切る(「最後まで」「伏せたまま。」)。
 * 塊が列より長いときは、塊の中で折り返す(はみ出さない)。
 * iOS 15 は正規表現の後読みを知らないので、どれも match で切る
 */

/** 行を句の並びにする。配列ならそのまま、文字列なら読点・句点・「?」のあとで切る */
export function phrasesOf(line) {
  if (Array.isArray(line)) return line;
  return String(line ?? "").match(/[^、。?]+[、。?」]*|[、。?」]+/g) || [];
}

/**
 * 札(英雄)の名を句に切る。「の」と空白のあとで切る(「黄昏の」「レヴナント」、「癒天使 」「ラファエル」)。
 * 10連の結果の4列の狭い列で「黄昏のレヴナン/ト」「癒天使 ラファ/エル」と1字だけ落ちた
 */
export function namePhrases(name) {
  return String(name ?? "").match(/[^の\s]*の|\S+\s*/g) || [];
}
