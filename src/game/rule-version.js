// START_SETUP と部屋の双方の対応版に記録する。
// 1: 布陣判定、2: 布陣判定 + 残り30秒以下・各6回までの時計加算、
// 3: 2 + 盤面エリア(src/game/areas.js。9×9 で王のスキンがあるとき)
//
// **3 に上げるのは、Firebase のルールに acts の hit / picks / areas / loadouts を
// 足して公開してから。** 先にクライアントを 3 にすると、エリアの手が
// データベースに弾かれて二人の盤がずれる(firebase-rules.json は足してある)。
// 4: 氷を毎手番発動・凍結中も抽選し残り期間に加算。通信の手の形式は3と共通。
// 5: 全エリアを毎手番1回に。空・宮殿のみ任意発動。
// 6: 森で毎手番見抜く対象を2体へ。
// 7: 宮殿の昇格後も同じ手番で通常の移動ができる。
export const GAME_RULE_VERSION = 7;
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
