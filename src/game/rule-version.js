// START_SETUP と部屋の双方の対応版に記録する。
// 1: 布陣判定、2: 布陣判定 + 残り30秒以下・各6回までの時計加算。
export const GAME_RULE_VERSION = 2;
export const ADJUDICATION_RULE_VERSION = 1;

export function hasAdjudicationRules(version) {
  return version === ADJUDICATION_RULE_VERSION || version === GAME_RULE_VERSION;
}
