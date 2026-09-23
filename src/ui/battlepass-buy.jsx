/**
 * バトルパスをジェムで解放する欄(無償→有償の順に使う。2026-09-24 本人の決め。それまでは有償だけ)。バトルパス画面とショップの両方から使う。
 * 選ぶ→確認→確定の二段(本人の決め)。決済は src/ui/buy.js の buyPassFor
 */
import { useState } from "react";
import { GemAmount } from "./gem.jsx";
import { BATTLEPASS_GEMS } from "../iap/catalog.js";
import { BattlePassSkinLock } from "./battlepass-skin-lock.jsx";

const yen = (n) => Number(n || 0).toLocaleString("ja-JP");

export function BattlePassBuy({
  gems = 0,
  working = false,
  onBuy,
  onShop,
  message = "",
  art = true,
}) {
  const [confirm, setConfirm] = useState(false);
  const short = gems < BATTLEPASS_GEMS;
  return (
    <div className="pass-purchase">
      {art && <BattlePassSkinLock className="pass-locked-art" />}
      {confirm ? (
        <div className="foil-offer-confirm">
          <p>
            バトルパスを ジェム <b>{yen(BATTLEPASS_GEMS)}</b> で解放しますか？
            買い切りです。無償ジェムから先に使います。
          </p>
          <div className="setup-actions">
            <button className="btn btn-ghost" disabled={working} onClick={() => setConfirm(false)}>
              やめる
            </button>
            <button
              className="btn btn-primary"
              disabled={working || short}
              onClick={async () => {
                const ok = await onBuy();
                if (ok) setConfirm(false);
              }}
            >
              買う
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="hint">
            マスを埋めるとガチャチケット。1周目の完成で限定のAスキン。週3回まで周回できます。
            解放は買い切りです。ミッションでためた<b>無償ジェムでも解放できます</b>。
          </p>
          <p className="hint">
            ジェム <b>{yen(gems)}</b>
          </p>
          <button
            className="btn btn-primary"
            disabled={working}
            onClick={() => setConfirm(true)}
          >
            <GemAmount amount={BATTLEPASS_GEMS} size={20} /> で解放する
          </button>
        </>
      )}
      {short && onShop && (
        <button className="btn btn-ghost btn-small" disabled={working} onClick={onShop}>
          ジェムが足りません · ジェムを買う
        </button>
      )}
      {message && (
        <p className="skins-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
