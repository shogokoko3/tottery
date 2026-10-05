/**
 * 通常キャラの原画。数字・スートは CardFace で重ね、4スートで画像を共有する。
 * 240×320 WebP を data URI として埋め込むため、通信なしでも表示できる。
 * 採用原画・版は assets/cards/standard/manifest.json を参照。
 */
import n_A from "../assets/cards/standard/A.webp";
import n_2 from "../assets/cards/standard/2.webp";
import n_3 from "../assets/cards/standard/3.webp";
import n_4 from "../assets/cards/standard/4.webp";
import n_5 from "../assets/cards/standard/5.webp";
import n_6 from "../assets/cards/standard/6.webp";
import n_7 from "../assets/cards/standard/7.webp";
import n_8 from "../assets/cards/standard/8.webp";
import n_9 from "../assets/cards/standard/9.webp";
import n_10 from "../assets/cards/standard/10.webp";
import n_J from "../assets/cards/standard/J.webp";
import n_Q from "../assets/cards/standard/Q.webp";
import n_K from "../assets/cards/standard/K.webp";

import cardBackImg from "../assets/ui/card-back.webp";
import titleBgImg from "../assets/ui/title-bg.webp";
import dieImg from "../assets/ui/die.webp";
import winKingCardImg from "../assets/ui/win-king-card.webp";
export { cardBackImg, titleBgImg, dieImg, winKingCardImg };

const artByRank = {
  "A": n_A,
  "2": n_2,
  "3": n_3,
  "4": n_4,
  "5": n_5,
  "6": n_6,
  "7": n_7,
  "8": n_8,
  "9": n_9,
  "10": n_10,
  "J": n_J,
  "Q": n_Q,
  "K": n_K,
};

/** 通常版52枚。王も同じ人物を使い、金色の枠は画面側で描画する。 */
export const NORMAL_CARD_ART = Object.fromEntries(
  Object.entries(artByRank).flatMap(([rank, art]) =>
    ["S", "H", "D", "C"].map((suit) => [rank + suit, art]),
  ),
);
