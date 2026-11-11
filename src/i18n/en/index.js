/**
 * 英語の辞書(日本語 → 英語)。画面のまとまりごとにファイルを分け、ここで1つにする。
 * 同じ日本語が2つのファイルにあるときは、英語も同じでなければならない(検査が見る)。
 * 言葉の揃え方は reports/i18n-20261111/訳語の表.md
 */
import { EN_COMMON } from "./common.js";
import { EN_RULES } from "./rules.js";
import { EN_CARDS } from "./cards.js";
import { EN_LEARN } from "./learn.js";
import { EN_PUZZLE } from "./puzzle.js";
import { EN_MATCH } from "./match.js";
import { EN_SHOP } from "./shop.js";
import { EN_HOME } from "./home.js";

export const EN_PARTS = {
  common: EN_COMMON,
  rules: EN_RULES,
  cards: EN_CARDS,
  learn: EN_LEARN,
  puzzle: EN_PUZZLE,
  match: EN_MATCH,
  shop: EN_SHOP,
  home: EN_HOME,
};

export const EN = Object.freeze(Object.assign({}, ...Object.values(EN_PARTS)));
