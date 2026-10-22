import { hasStore } from "../net/platform.js";
import { WALLET_SERVER } from "../net/wallet.js";
import { useCollection, getCollection } from "../skins/store.js";
import { usePass, getPass } from "../game/battlepass-store.js";
import { CONTENT_SEASONS, DEFAULT_SEASON, contentSeason, openSeasons } from "../game/content-seasons.js";

/**
 * そのシーズンのバトルパスを持っているか(2026-10-15 からシーズンごと)。
 * Webの無料開放と先行受取済みのパスは維持。アプリ版は購入権利(シーズンごとの名前)で解放する。
 */
export function passUnlockedFor(seasonId = DEFAULT_SEASON, collection = getCollection(), pass = getPass(seasonId)) {
  const season = contentSeason(seasonId) || contentSeason(DEFAULT_SEASON);
  return (
    !WALLET_SERVER ||
    !hasStore() ||
    pass?.claimed === true ||
    (collection?.entitlements || []).includes(season.entitlement)
  );
}
export function useBattlePassUnlocked(seasonId = DEFAULT_SEASON) {
  const collection = useCollection();
  const pass = usePass(seasonId);
  return passUnlockedFor(seasonId, collection, pass);
}
/** 持っている(解放済みの)パスのシーズン id の一覧。開いているシーズンだけ */
export function useUnlockedPassSeasons() {
  const collection = useCollection();
  // フックは数が変わらないよう、開いているシーズンでなく表の全部を読む
  const passes = CONTENT_SEASONS.map((s) => usePass(s.id));
  const open = openSeasons();
  return CONTENT_SEASONS.filter((s, i) => open.some((o) => o.id === s.id) && passUnlockedFor(s.id, collection, passes[i])).map((s) => s.id);
}
/** どれか1つでも持っているか(ホームの案内などに) */
export function useAnyBattlePassUnlocked() {
  return useUnlockedPassSeasons().length > 0;
}
/** 持っていて、進められるパスのシーズン。いま選んでいるものを持っていなければ、持っている中でいちばん新しいもの */
export function progressablePassSeason(activeId, collection = getCollection()) {
  if (passUnlockedFor(activeId, collection)) return activeId;
  const owned = openSeasons().filter((s) => passUnlockedFor(s.id, collection)).map((s) => s.id);
  return owned.at(-1) || activeId;
}
