import { Capacitor } from "@capacitor/core";
import { BATTLEPASS_ENTITLEMENT } from "../iap/catalog.js";
import { WALLET_SERVER } from "../net/wallet.js";
import { useCollection } from "../skins/store.js";
import { usePass } from "../game/battlepass-store.js";

// Webの無料開放と先行受取済みのパスは維持。アプリ版は購入権利で解放する。
export function useBattlePassUnlocked() {
  const collection = useCollection();
  const pass = usePass();
  return (
    !WALLET_SERVER ||
    !Capacitor.isNativePlatform() ||
    pass.claimed ||
    (collection.entitlements || []).includes(BATTLEPASS_ENTITLEMENT)
  );
}
