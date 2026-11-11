/**
 * ガチャチケットをジェムで買う欄。ガチャ画面とショップの両方から使う。
 * 選ぶ→確認→確定の二段(本人の決め)。決済は src/ui/buy.js の buyTicketsFor
 */
import { useState } from "react";
import { GemAmount } from "./gem.jsx";
import { GEM_PER_TICKET, TICKET_BUNDLE } from "../iap/catalog.js";
import { L, fmtNumber } from "../i18n/index.js";

// ジェムの数の書式(名前は前のまま。値段は円ではなくジェム)
const yen = (n) => fmtNumber(n);

export function TicketBuy({
  gems = 0,
  working = false,
  onBuy,
  onShop,
  message = "",
  // 買う前に確認するか。切ると押した瞬間に買う(本人の指示 2026-09-17)
  confirm = true,
  onToggleConfirm = null,
  // "list"(ショップ) か "grid"(ガチャ画面の2列)
  layout = "list",
}) {
  const [picked, setPicked] = useState(null); // 確認中の枚数
  const lots = [
    { tickets: 1, gems: GEM_PER_TICKET },
    { tickets: TICKET_BUNDLE.tickets, gems: TICKET_BUNDLE.gems },
  ];
  const shortFor = (lot) => gems < lot.gems;
  if (picked) {
    const short = gems < picked.gems;
    // 文の途中に太字が2つ入るので、英語の語順で切って組む(枚数 → ジェムの順は英語でも同じ)
    const [askA, askB, askC] = L("ガチャチケット {t}を ジェム {g} で買いますか？").split(/\{t\}|\{g\}/);
    return (
      <div className="foil-offer-confirm">
        <p>
          {askA}<b>{L("{n}枚", { n: picked.tickets })}</b>{askB}<b>{yen(picked.gems)}</b>{askC}
        </p>
        <div className="setup-actions">
          <button className="btn btn-ghost" disabled={working} onClick={() => setPicked(null)}>
            {L("やめる")}
          </button>
          <button
            className="btn btn-primary"
            disabled={working || short}
            onClick={async () => {
              const ok = await onBuy(picked.tickets);
              if (ok) setPicked(null);
            }}
          >
            {L("買う")}
          </button>
        </div>
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
  return (
    <>
      <div className={layout === "grid" ? "skins-pull-buttons" : "shop-list"}>
        {lots.map((lot) => (
          <button
            key={lot.tickets}
            className={layout === "grid" ? "skin-btn" : "skin-btn shop-item"}
            disabled={working}
            onClick={() => (confirm ? setPicked(lot) : onBuy(lot.tickets))}
            aria-label={L("チケット{t}枚 ジェム {g}", { t: lot.tickets, g: yen(lot.gems) })}
          >
            <span>{L("チケット{n}枚", { n: lot.tickets })}</span>
            <GemAmount amount={lot.gems} size={20} />
          </button>
        ))}
      </div>
      {onToggleConfirm && (
        /* 説明は label の外。中に入れていると、読もうとして触れただけで
           切り替わっていた(2026-09-28 本人の報告) */
        <div className="toggle-row">
          <label className="ticket-confirm-toggle toggle-hit">
            <input
              type="checkbox"
              checked={confirm}
              disabled={working}
              onChange={onToggleConfirm}
            />
            {L("買う前に確認する")}
          </label>
          <p className="toggle-note">
            {L("切ると、押した瞬間にジェムで買います。フォイルとバトルパスの確認は外せません")}
          </p>
        </div>
      )}
      {layout !== "grid" && (
        <p className="hint">
          {L("使うときは無償ジェムから先に減ります。チケットはガチャ・スキンの画面で使えます。")}
        </p>
      )}
      {message && (
        <p className="skins-message" role="status">
          {message}
        </p>
      )}
    </>
  );
}
