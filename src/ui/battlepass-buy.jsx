/**
 * バトルパスをジェムで解放する欄(無償→有償の順に使う。2026-09-24 本人の決め。それまでは有償だけ)。バトルパス画面とショップの両方から使う。
 * 選ぶ→確認→確定の二段(本人の決め)。決済は src/ui/buy.js の buyPassFor
 */
import { useState } from "react";
import { GemAmount } from "./gem.jsx";
import { BATTLEPASS_GEMS } from "../iap/catalog.js";
import { BattlePassSkinLock } from "./battlepass-skin-lock.jsx";
import { L, fmtNumber } from "../i18n/index.js";

const yen = (n) => fmtNumber(n);

export function BattlePassBuy({
  gems = 0,
  working = false,
  onBuy,
  onShop,
  message = "",
  art = true,
  passName = L("バトルパス"),
  rewardName = L("限定のAスキン"),
}) {
  const [confirm, setConfirm] = useState(false);
  const short = gems < BATTLEPASS_GEMS;
  // 文の途中に太字・ジェムの絵が入るので、英語の語順で切って組む
  const [askPre, askPost] = L(
    "{name}を ジェム {gems} で解放しますか？ 買い切りです。無償ジェムから先に使います。",
    { name: passName },
  ).split("{gems}");
  const [hintPre, hintPost] = L(
    "マスを埋めるとガチャチケット。1周目の完成で{reward}。週3回まで周回できます。 解放は買い切りです。ミッションでためた{b}。",
    { reward: rewardName },
  ).split("{b}");
  const [unlockPre, unlockPost] = L("{gems} で解放する").split("{gems}");
  return (
    <div className="pass-purchase">
      {art && <BattlePassSkinLock className="pass-locked-art" />}
      {confirm ? (
        <div className="foil-offer-confirm">
          <p>
            {askPre}<b>{yen(BATTLEPASS_GEMS)}</b>{askPost}
          </p>
          <div className="setup-actions">
            <button className="btn btn-ghost" disabled={working} onClick={() => setConfirm(false)}>
              {L("やめる")}
            </button>
            <button
              className="btn btn-primary"
              disabled={working || short}
              onClick={async () => {
                const ok = await onBuy();
                if (ok) setConfirm(false);
              }}
            >
              {L("買う")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="hint">
            {hintPre}<b>{L("無償ジェムでも解放できます")}</b>{hintPost}
          </p>
          <p className="hint">
            {L("ジェム")} <b>{yen(gems)}</b>
          </p>
          <button
            className="btn btn-primary"
            disabled={working}
            onClick={() => setConfirm(true)}
          >
            {unlockPre}<GemAmount amount={BATTLEPASS_GEMS} size={20} />{unlockPost}
          </button>
        </>
      )}
      {short && onShop && (
        <button className="btn btn-ghost btn-small" disabled={working} onClick={onShop}>
          {L("ジェムが足りません · ジェムを買う")}
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
