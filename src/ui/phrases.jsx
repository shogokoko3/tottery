/**
 * 句ごとに折り返す文(2026-10-06 見直し)。切り方は phrase-split.js(検査も同じものを使う)。
 * 句を1つの塊(.text-phrase。display: inline-block)にして、塊の間でだけ折り返す。
 * iPhone の WebKit は word-break: auto-phrase を知らず、語の途中で割れた
 */
import { phrasesOf } from "./phrase-split.js";

export { namePhrases, phrasesOf } from "./phrase-split.js";

/** 1行を句の塊で出す(text は文字列か句の配列) */
export function Phrases({ text }) {
  return phrasesOf(text).map((phrase, i) => (
    <span className="text-phrase" key={i}>
      {phrase}
    </span>
  ));
}
