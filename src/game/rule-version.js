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
// 8: 海は各駒を中央方向へ最大1マスずつ引き寄せる。
// 9: 宮殿の2段階昇格を各側1局1回。予備札が尽きると捨て札を混ぜて補充。
// 10: 海を毎手番開始時の任意発動に。使わずに通常の移動もできる。
// 11: 海は相手の駒だけを流す(自分の駒は動かない)。土は足跡を読めば必ず見抜く
//     (当たり外れは手に焼き込んであるので、旧対局の再生は変わらない)。
// 12: 氷は相手の王も凍らせる(2026-09-11。凍った王は動けず、Aの入れ替えでだけ解ける。
//     通信の手の形式は変わらない。picks に王の id が入るだけ)。
// 13: 布陣ボーナス(ストレート・フラッシュ)が出た対局は、両者が確認し終えるまで始まらない
//     (2026-09-11 本人の依頼。オンラインだけ。ACK_SETUP_EFFECTS を送り合い、そろうまで指し手を受け付けない)。
// 14: 海の引き寄せで、斜めの先が埋まっていても縦か横に寄れば中央に近づくならそちらへ寄る
//     (2026-09-16 本人の指摘。通信の手の形式は変わらない。旧版の対局の再生は変わらない)。
// 15: 道連れ(王が4・5)で倒れた J・Q では、K の王の予備札を引かない(2026-09-16 本人の指示。
//     通信の手の形式は変わらない。旧版の対局の再生は変わらない)。
// 16: Aのフォイル魔法。通常の行動前に毎手番1回、ランダムな3体を循環させる。
//     自分のA・王を除き、手番・追加行動を使わず、包囲取りも起こさない。
// 17: 詳細設定(src/game/custom-rules.js)。START_SETUP の custom(使う札・エリアの側・公開)と
//     SETUP_CONFIRM の revealIds(自分で選んだ公開)が通信に載る(2026-09-17 本人の指示)。
// 18: サイコロと引き直しを両者同時に(2026-09-23 本人の指示)。サイコロは各自が自分の目を振り(20秒で自動)、
//     両方そろった時点で先手が決まる(NEXT_DICE_STEP は要らない)。引き直しは両者が同時に選び(1分で自動確定)、
//     予備札は GOTO_MULLIGAN で決定的に並べ替え、先手は前から・後手は後ろから引く(適用順に依らない)。
//     通信の手の形式は変わらない(ROLL_DICE_SINGLE / CONFIRM_MULLIGAN に player が付くだけ)。
export const GAME_RULE_VERSION = 18;
export const SIMULTANEOUS_PREP_RULE_VERSION = 18;

/** サイコロと引き直しを同時に進める版か */
export function hasSimultaneousPrep(version) {
  return (
    Number.isInteger(version) &&
    version >= SIMULTANEOUS_PREP_RULE_VERSION &&
    version <= GAME_RULE_VERSION
  );
}
export const CUSTOM_RULES_VERSION = 17;
export const ACE_FOIL_RULE_VERSION = 16;
export const REVENGE_NO_RESERVE_RULE_VERSION = 15;
export const SEA_SLIDE_RULE_VERSION = 14;
export const BONUS_ACK_RULE_VERSION = 13;
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

/** 詳細設定を通信に載せられる版か。部屋の両者がこの版のときだけ */
export function hasCustomRules(version) {
  return hasAdjudicationRules(version) && version >= CUSTOM_RULES_VERSION;
}

/** 布陣ボーナスを両者が確認してから始める版か */
export function hasBonusAckRules(version) {
  return hasAdjudicationRules(version) && version >= BONUS_ACK_RULE_VERSION;
}
