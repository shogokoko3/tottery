/**
 * ガチャチケットをジェムで買う欄。ガチャ画面とショップの両方から使う。
 * 選ぶ→確認→確定の二段(本人の決め)。決済は src/ui/buy.js の buyTicketsFor
 */
import { useState } from "react";
import { GemAmount } from "./gem.jsx";
import { GEM_PER_TICKET, TICKET_BUNDLE } from "../iap/catalog.js";

const yen = (n) => Number(n || 0).toLocaleString("ja-JP");

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
    return (
      <div className="foil-offer-confirm">
        <p>
          ガチャチケット <b>{picked.tickets}枚</b>を ジェム <b>{yen(picked.gems)}</b>{" "}
          で買いますか？
        </p>
        <div className="setup-actions">
          <button className="btn btn-ghost" disabled={working} onClick={() => setPicked(null)}>
            やめる
          </button>
          <button
            className="btn btn-primary"
            disabled={working || short}
            onClick={async () => {
              const ok = await onBuy(picked.tickets);
              if (ok) setPicked(null);
            }}
          >
            買う
          </button>
        </div>
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
  return (
    <>
      <div className={layout === "grid" ? "skins-pull-buttons" : "shop-list"}>
        {lots.map((lot) => (
          <button
            key={lot.tickets}
            className={layout === "grid" ? "skin-btn" : "skin-btn shop-item"}
            disabled={working}
            onClick={() => (confirm ? setPicked(lot) : onBuy(lot.tickets))}
            aria-label={`チケット${lot.tickets}枚 ジェム ${yen(lot.gems)}`}
          >
            <span>チケット{lot.tickets}枚</span>
            <GemAmount amount={lot.gems} size={20} />
          </button>
        ))}
      </div>
      {onToggleConfirm && (
        <label className="ticket-confirm-toggle">
          <input
            type="checkbox"
            checked={confirm}
            disabled={working}
            onChange={onToggleConfirm}
          />
          買う前に確認する
          <small>
            切ると、押した瞬間にジェムで買います。フォイルとバトルパスの確認は外せません
          </small>
        </label>
      )}
      {layout !== "grid" && (
        <p className="hint">
          使うときは無償ジェムから先に減ります。チケットはガチャ・スキンの画面で使えます。
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
