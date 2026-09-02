/**
 * カード絵柄と UI 画像。
 * ビルド時に esbuild が data URI として埋め込むので、単一 HTML のまま配布できる。
 */

import n_AS from "../assets/cards/normal/AS.webp";
import n_AH from "../assets/cards/normal/AH.webp";
import n_AD from "../assets/cards/normal/AD.webp";
import n_AC from "../assets/cards/normal/AC.webp";
import n_2S from "../assets/cards/normal/2S.webp";
import n_2H from "../assets/cards/normal/2H.webp";
import n_2D from "../assets/cards/normal/2D.webp";
import n_2C from "../assets/cards/normal/2C.webp";
import n_3S from "../assets/cards/normal/3S.webp";
import n_3H from "../assets/cards/normal/3H.webp";
import n_3D from "../assets/cards/normal/3D.webp";
import n_3C from "../assets/cards/normal/3C.webp";
import n_4S from "../assets/cards/normal/4S.webp";
import n_4H from "../assets/cards/normal/4H.webp";
import n_4D from "../assets/cards/normal/4D.webp";
import n_4C from "../assets/cards/normal/4C.webp";
import n_5S from "../assets/cards/normal/5S.webp";
import n_5H from "../assets/cards/normal/5H.webp";
import n_5D from "../assets/cards/normal/5D.webp";
import n_5C from "../assets/cards/normal/5C.webp";
import n_6S from "../assets/cards/normal/6S.webp";
import n_6H from "../assets/cards/normal/6H.webp";
import n_6D from "../assets/cards/normal/6D.webp";
import n_6C from "../assets/cards/normal/6C.webp";
import n_7S from "../assets/cards/normal/7S.webp";
import n_7H from "../assets/cards/normal/7H.webp";
import n_7D from "../assets/cards/normal/7D.webp";
import n_7C from "../assets/cards/normal/7C.webp";
import n_8S from "../assets/cards/normal/8S.webp";
import n_8H from "../assets/cards/normal/8H.webp";
import n_8D from "../assets/cards/normal/8D.webp";
import n_8C from "../assets/cards/normal/8C.webp";
import n_9S from "../assets/cards/normal/9S.webp";
import n_9H from "../assets/cards/normal/9H.webp";
import n_9D from "../assets/cards/normal/9D.webp";
import n_9C from "../assets/cards/normal/9C.webp";
import n_TS from "../assets/cards/normal/10S.webp";
import n_TH from "../assets/cards/normal/10H.webp";
import n_TD from "../assets/cards/normal/10D.webp";
import n_TC from "../assets/cards/normal/10C.webp";
import n_JS from "../assets/cards/normal/JS.webp";
import n_JH from "../assets/cards/normal/JH.webp";
import n_JD from "../assets/cards/normal/JD.webp";
import n_JC from "../assets/cards/normal/JC.webp";
import n_QS from "../assets/cards/normal/QS.webp";
import n_QH from "../assets/cards/normal/QH.webp";
import n_QD from "../assets/cards/normal/QD.webp";
import n_QC from "../assets/cards/normal/QC.webp";
import n_KS from "../assets/cards/normal/KS.webp";
import n_KH from "../assets/cards/normal/KH.webp";
import n_KD from "../assets/cards/normal/KD.webp";
import n_KC from "../assets/cards/normal/KC.webp";

import c_AS from "../assets/cards/captain/AS.webp";
import c_AH from "../assets/cards/captain/AH.webp";
import c_AD from "../assets/cards/captain/AD.webp";
import c_AC from "../assets/cards/captain/AC.webp";
import c_2S from "../assets/cards/captain/2S.webp";
import c_2H from "../assets/cards/captain/2H.webp";
import c_2D from "../assets/cards/captain/2D.webp";
import c_2C from "../assets/cards/captain/2C.webp";
import c_3S from "../assets/cards/captain/3S.webp";
import c_3H from "../assets/cards/captain/3H.webp";
import c_3D from "../assets/cards/captain/3D.webp";
import c_3C from "../assets/cards/captain/3C.webp";
import c_4S from "../assets/cards/captain/4S.webp";
import c_4H from "../assets/cards/captain/4H.webp";
import c_4D from "../assets/cards/captain/4D.webp";
import c_4C from "../assets/cards/captain/4C.webp";
import c_5S from "../assets/cards/captain/5S.webp";
import c_5H from "../assets/cards/captain/5H.webp";
import c_5D from "../assets/cards/captain/5D.webp";
import c_5C from "../assets/cards/captain/5C.webp";
import c_6S from "../assets/cards/captain/6S.webp";
import c_6H from "../assets/cards/captain/6H.webp";
import c_6D from "../assets/cards/captain/6D.webp";
import c_6C from "../assets/cards/captain/6C.webp";
import c_7S from "../assets/cards/captain/7S.webp";
import c_7H from "../assets/cards/captain/7H.webp";
import c_7D from "../assets/cards/captain/7D.webp";
import c_7C from "../assets/cards/captain/7C.webp";
import c_8S from "../assets/cards/captain/8S.webp";
import c_8H from "../assets/cards/captain/8H.webp";
import c_8D from "../assets/cards/captain/8D.webp";
import c_8C from "../assets/cards/captain/8C.webp";
import c_9S from "../assets/cards/captain/9S.webp";
import c_9H from "../assets/cards/captain/9H.webp";
import c_9D from "../assets/cards/captain/9D.webp";
import c_9C from "../assets/cards/captain/9C.webp";
import c_TS from "../assets/cards/captain/10S.webp";
import c_TH from "../assets/cards/captain/10H.webp";
import c_TD from "../assets/cards/captain/10D.webp";
import c_TC from "../assets/cards/captain/10C.webp";

import cardBackImg from "../assets/ui/card-back.webp";
import titleBgImg from "../assets/ui/title-bg.webp";
import dieImg from "../assets/ui/die.webp";
import winKingCardImg from "../assets/ui/win-king-card.webp";

export { cardBackImg, titleBgImg, dieImg, winKingCardImg };

/** 通常版 52枚。キーは「ランク+スートコード」 */
export const NORMAL_CARD_ART = {
  AS: n_AS,
  AH: n_AH,
  AD: n_AD,
  AC: n_AC,
  "2S": n_2S,
  "2H": n_2H,
  "2D": n_2D,
  "2C": n_2C,
  "3S": n_3S,
  "3H": n_3H,
  "3D": n_3D,
  "3C": n_3C,
  "4S": n_4S,
  "4H": n_4H,
  "4D": n_4D,
  "4C": n_4C,
  "5S": n_5S,
  "5H": n_5H,
  "5D": n_5D,
  "5C": n_5C,
  "6S": n_6S,
  "6H": n_6H,
  "6D": n_6D,
  "6C": n_6C,
  "7S": n_7S,
  "7H": n_7H,
  "7D": n_7D,
  "7C": n_7C,
  "8S": n_8S,
  "8H": n_8H,
  "8D": n_8D,
  "8C": n_8C,
  "9S": n_9S,
  "9H": n_9H,
  "9D": n_9D,
  "9C": n_9C,
  "10S": n_TS,
  "10H": n_TH,
  "10D": n_TD,
  "10C": n_TC,
  JS: n_JS,
  JH: n_JH,
  JD: n_JD,
  JC: n_JC,
  QS: n_QS,
  QH: n_QH,
  QD: n_QD,
  QC: n_QC,
  KS: n_KS,
  KH: n_KH,
  KD: n_KD,
  KC: n_KC,
};

/** 隊長版 40枚。王にした駒だけこちらを使う */
export const CAPTAIN_CARD_ART = {
  AS: c_AS,
  AH: c_AH,
  AD: c_AD,
  AC: c_AC,
  "2S": c_2S,
  "2H": c_2H,
  "2D": c_2D,
  "2C": c_2C,
  "3S": c_3S,
  "3H": c_3H,
  "3D": c_3D,
  "3C": c_3C,
  "4S": c_4S,
  "4H": c_4H,
  "4D": c_4D,
  "4C": c_4C,
  "5S": c_5S,
  "5H": c_5H,
  "5D": c_5D,
  "5C": c_5C,
  "6S": c_6S,
  "6H": c_6H,
  "6D": c_6D,
  "6C": c_6C,
  "7S": c_7S,
  "7H": c_7H,
  "7D": c_7D,
  "7C": c_7C,
  "8S": c_8S,
  "8H": c_8H,
  "8D": c_8D,
  "8C": c_8C,
  "9S": c_9S,
  "9H": c_9H,
  "9D": c_9D,
  "9C": c_9C,
  "10S": c_TS,
  "10H": c_TH,
  "10D": c_TD,
  "10C": c_TC,
};
