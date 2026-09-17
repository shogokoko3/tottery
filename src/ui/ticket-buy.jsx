/**
 * ガチャチケットをジェムで買う欄。ガチャ画面とショップの両方から使う。
 * 選ぶ→確認→確定の二段(本人の決め)。決済は src/ui/buy.js の buyTicketsFor
 */
import { useState } from "react";
import { GemAmount } from "./gem.jsx";
import { GEM_PER_TICKET, TICKET_BUNDLE } from "../iap/catalog.js";

const yen = (n) => Number(n || 0).toLocaleString("ja-JP");

export function TicketBuy({ gems = 0, working = false, onBuy, onShop, message = "" }) {
  const [picked, setPicked] = useState(null); // 確認中の枚数
  const lots = [
    { tickets: 1, gems: GEM_PER_TICKET },
    { tickets: TICKET_BUNDLE.tickets, gems: TICKET_BUNDLE.gems },
  ];
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
      <div className="shop-list">
        {lots.map((lot) => (
          <button
            key={lot.tickets}
            className="skin-btn shop-item"
            disabled={working}
            onClick={() => setPicked(lot)}
            aria-label={`チケット${lot.tickets}枚 ジェム ${yen(lot.gems)}`}
          >
            <span>チケット{lot.tickets}枚</span>
            <GemAmount amount={lot.gems} size={20} />
          </button>
        ))}
      </div>
      <p className="hint">
        使うときは無償ジェムから先に減ります。チケットはガチャ・装備の画面で使えます。
      </p>
      {message && (
        <p className="skins-message" role="status">
          {message}
        </p>
      )}
    </>
  );
}
