/**
 * ガチャでフォイルを引いた直後に出す「ほかのフォイルも」(src/skins/foil-shop.js)。
 * 有償ジェムだけで買える。選ぶ→確認→確定の二段。足りなければ「ジェムを買う」へ。
 * A のフォイル(secret)は、全カードをそろえた人にしか offers に入ってこない
 */
import { useState } from "react";
import { byId, foilId } from "../skins/catalog.js";
import { FoilArtwork } from "./foil-artwork.jsx";
import { SkinModal } from "./skin-modal.jsx";

const yen = (n) => n.toLocaleString("ja-JP");

export function FoilOfferSheet({
  offers,
  gemsPaid,
  working,
  onBuy,
  onClose,
  onShop,
  message = "",
}) {
  const [picked, setPicked] = useState(null); // 確認中の商品
  if (!offers.length) return null;
  return (
    <SkinModal
      label="ほかのフォイルも"
      onClose={onClose}
      className="foil-offer-overlay"
    >
      <div className="skin-modal-head">
        <div>
          <span className="skins-eyebrow">FOIL SHOP</span>
          <h2>ほかのフォイルも</h2>
          <p className="skins-note">
            持っていないフォイルを<b>有償ジェム</b>
            で買えます(無償ジェムは使えません)。セットの片方を持っていれば、残りの1枚ぶんの値段です。
          </p>
          <p className="skins-note foil-offer-balance">
            有償ジェム <b>{yen(gemsPaid)}</b>
          </p>
        </div>
        <button
          className="skin-close"
          aria-label="ほかのフォイルもを閉じる"
          disabled={working}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {picked ? (
        <div className="foil-offer-confirm">
          <p>
            「{picked.product.name}」
            {picked.partial ? `の残り${picked.skins.length}枚` : ""}を
            有償ジェム <b>{yen(picked.price)}</b> で買いますか？
          </p>
          <div className="foil-offer-arts">
            {picked.skins.map((b) => {
              const f = byId(foilId(b));
              return (
                <FoilArtwork
                  key={b}
                  skin={f}
                  src={f.card}
                  alt={f.name}
                  animated={false}
                  className="foil-offer-art"
                />
              );
            })}
          </div>
          <div className="setup-actions">
            <button
              className="btn btn-ghost"
              disabled={working}
              onClick={() => setPicked(null)}
            >
              やめる
            </button>
            <button
              className="btn btn-primary"
              disabled={working || gemsPaid < picked.price}
              onClick={async () => {
                const ok = await onBuy(picked);
                if (ok) setPicked(null);
              }}
            >
              買う
            </button>
          </div>
          {gemsPaid < picked.price && onShop && (
            <button
              className="btn btn-ghost btn-small"
              disabled={working}
              onClick={onShop}
            >
              有償ジェムが足りません · ジェムを買う
            </button>
          )}
        </div>
      ) : (
        <div className="foil-offer-list">
          {offers.map((o) => (
            <button
              key={o.product.id}
              className="foil-offer"
              disabled={working}
              onClick={() => setPicked(o)}
              aria-label={`${o.product.name} 有償ジェム ${yen(o.price)}`}
            >
              <span className="foil-offer-arts">
                {o.skins.map((b) => {
                  const f = byId(foilId(b));
                  return (
                    <FoilArtwork
                      key={b}
                      skin={f}
                      src={f.card}
                      alt={f.name}
                      animated={false}
                      className="foil-offer-art"
                    />
                  );
                })}
              </span>
              <span className="foil-offer-name">
                <b>{o.product.name}</b>
                {o.partial && <small>残り{o.skins.length}枚ぶん</small>}
              </span>
              <span className="foil-offer-price">
                {yen(o.price)}
                <small>有償ジェム</small>
              </span>
            </button>
          ))}
        </div>
      )}
      {message && <p className="skins-message" role="status">{message}</p>}
    </SkinModal>
  );
}
