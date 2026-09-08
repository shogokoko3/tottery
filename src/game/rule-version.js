// START_SETUP と部屋の双方の対応版に記録する。
// 1: 布陣判定、2: 布陣判定 + 残り30秒以下・各6回までの時計加算、
// 3: 2 + 盤面エリア(src/game/areas.js。9×9 で王のスキンがあるとき)
//
// **3 に上げるのは、Firebase のルールに acts の hit / picks / areas / loadouts を
// 足して公開してから。** 先にクライアントを 3 にすると、エリアの手が
// データベースに弾かれて二人の盤がずれる(firebase-rules.json は足してある)。
export const GAME_RULE_VERSION = 3; // 2026-09-08 にルールを公開して 3 へ
export const ADJUDICATION_RULE_VERSION = 1;
export const CLOCK_RULE_VERSION = 2;
export const AREA_RULE_VERSION = 3;

/** 知っている版か。布陣判定は 1 から。これより新しい版は知らないので従来ルールへ */
export function hasAdjudicationRules(version) {
  return (
    Number.isInteger(version) &&
    version >= ADJUDICATION_RULE_VERSION &&
    version <= GAME_RULE_VERSION
  );
}

/** 盤面エリアを使う版か。部屋の両者がこの版のときだけオンラインで働く */
export function hasAreaRules(version) {
  return hasAdjudicationRules(version) && version >= AREA_RULE_VERSION;
}
