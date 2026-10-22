/**
 * ガチャでフォイルを引いた直後に出す「ほかのフォイルも」(src/skins/foil-shop.js)。
 * 有償ジェムだけで買える。選ぶ→確認→確定の二段。足りなければ「ジェムを買う」へ。
 * A のフォイル(secret)は、全カードをそろえた人にしか offers に入ってこない
 */
import { useState } from "react";
import { SERIES, byId, foilId } from "../skins/catalog.js";
import { AREA_INFO, areaForSkin } from "../game/areas.js";
import { FoilArtwork } from "./foil-artwork.jsx";
import { GemIcon } from "./gem.jsx";
import { SkinModal } from "./skin-modal.jsx";

const yen = (n) => n.toLocaleString("ja-JP");
const seriesNameOf = (series) => SERIES.find((s) => s.id === series)?.name || "";

/**
 * その商品で立つ効果盤面(エリア)。同じエリアは1つにまとめる。
 * 「どのエリアが手に入るのか、何ができるのか」を買う前に見せる(2026-09-18 本人の指示)
 */
function areaOf(skins) {
  const out = [];
  for (const id of skins) {
    const rank = byId(id)?.rank;
    // ワンダーランドの札はその札の盤面効果(areaForSkin)。レジェンド・ゲートは数字のエリア
    const type = rank ? areaForSkin(rank, id) : null;
    if (!type || out.some((a) => a.type === type)) continue;
    out.push({ type, name: AREA_INFO[type].name, text: AREA_INFO[type].text });
  }
  return out;
}

/**
 * フォイルの商品一覧(中身だけ)。ガチャ直後のシートにも、ショップの欄の中にもそのまま置ける。
 * SkinModal(portal)を通さないので、サーバー側の描画(検査)でも使える。
 * locked を立てると「見るだけ」。商品も値段も並べるが押せず、ジェムを買う誘いも出さない
 * (ショップで72時間の外のとき。2026-10-15 本人の指示「ポップアップ商品がない時でも、ボタンは用意して」)
 */
export function FoilOfferPicker({
  offers,
  gemsPaid,
  working,
  onBuy,
  onShop,
  message = "",
  showOwned = false,
  locked = false,
}) {
  const [picked, setPicked] = useState(null); // 確認中の商品
  // 買える商品。全部そろえた done の商品は、ショップ(showOwned)で「獲得済み」と見せるだけ(2026-10-15 本人の指示)
  const buyable = offers.filter((o) => !o.done);
  if (!offers.length)
    return <p className="skins-note">いま買えるフォイルはありません。</p>;
  // フォイルは有償ジェムだけ。引いた直後は残高が無いことが多いので、
  // **商品を選ぶ前から**ジェムを買う道を出す(本人の指示 2026-09-17)。見るだけ(locked)のときは出さない
  const cheapest = buyable.length ? Math.min(...buyable.map((o) => o.price)) : 0;
  const short = !locked && buyable.length > 0 && gemsPaid < cheapest;
  // 札の絵。showOwned のときは持っている札も薄く「獲得済み」の印つきで並べる
  const arts = (o) => (
    <span className="foil-offer-arts">
      {(showOwned ? o.product.skins : o.skins).map((b) => {
        const f = byId(foilId(b));
        const got = showOwned && o.owned.includes(b);
        return (
          <span key={b} className={`foil-offer-art-wrap${got ? " is-owned" : ""}`}>
            <FoilArtwork
              skin={f}
              src={f.card}
              alt={f.name}
              animated={false}
              className="foil-offer-art"
            />
            {got && <small>獲得済み</small>}
          </span>
        );
      })}
    </span>
  );
  return (
    <>
      {picked ? (
        <div className="foil-offer-confirm">
          <p>
            「{picked.product.name}」
            {picked.product.series ? `（${seriesNameOf(picked.product.series)}）` : ""}
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
        <>
          {showOwned && !buyable.length && (
            <p className="skins-note">このシリーズのフォイルはすべて獲得済みです。</p>
          )}
          {!locked && buyable.length > 0 && (short || onShop) && (
            <div className="foil-offer-buy">
              {short && (
                <p className="skins-note">
                  有償ジェムが <b>{yen(cheapest - gemsPaid)}</b> 足りません
                  {onShop
                    ? "。買うと、そのまま続けられます。"
                    : "。有償ジェムは iPhone・iPad のアプリで買えます。"}
                </p>
              )}
              {onShop && (
                <button
                  className={`btn ${short ? "btn-primary" : "btn-ghost btn-small"}`}
                  disabled={working}
                  onClick={onShop}
                >
                  <GemIcon size={18} /> ジェムを買う
                </button>
              )}
            </div>
          )}
          <div className="foil-offer-list">
          {offers.map((o) =>
            o.done ? (
              // 全部そろえた商品(ショップだけ)。買えない行として残し、「獲得済み」と出す(2026-10-15 本人の指示)
              <div
                key={o.product.id}
                className="foil-offer is-owned"
                aria-label={`${o.product.name} 獲得済み`}
              >
                {arts(o)}
                <span className="foil-offer-name">
                  <b>{o.product.name}</b>
                  {areaOf(o.product.skins).map((area) => (
                    <small className={`foil-offer-area area-${area.type}`} key={area.type}>
                      <b>{area.name}</b>
                      {area.text}
                    </small>
                  ))}
                </span>
                <span className="foil-offer-price foil-offer-done">獲得済み</span>
              </div>
            ) : (
              <button
                key={o.product.id}
                className={`foil-offer${locked ? " is-locked" : ""}`}
                disabled={working || locked}
                onClick={() => setPicked(o)}
                aria-label={`${o.product.name} 有償ジェム ${yen(o.price)}${locked ? " いまは買えません" : ""}`}
              >
                {arts(o)}
                <span className="foil-offer-name">
                  <b>{o.product.name}</b>
                  {o.partial && <small>残り{o.skins.length}枚ぶん</small>}
                  {/* 買うとどのエリアが立つのか、効果まで見せる(2026-09-18 本人の指示) */}
                  {areaOf(o.skins).map((area) => (
                    <small className={`foil-offer-area area-${area.type}`} key={area.type}>
                      <b>{area.name}</b>
                      {area.text}
                    </small>
                  ))}
                </span>
                <span className="foil-offer-price">
                  {yen(o.price)}
                  <small>有償ジェム</small>
                </span>
              </button>
            ),
          )}
          </div>
        </>
      )}
      {message && <p className="skins-message" role="status">{message}</p>}
    </>
  );
}

/** ガチャでフォイルを引いた直後に出すシート。中身は FoilOfferPicker */
export function FoilOfferSheet({
  offers,
  gemsPaid,
  working,
  onBuy,
  onClose,
  onShop,
  onSnooze = null,
  message = "",
  series = null,
}) {
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
          {series && <p className="skins-note foil-offer-series">{seriesNameOf(series)}のフォイル</p>}
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
      <FoilOfferPicker
        offers={offers}
        gemsPaid={gemsPaid}
        working={working}
        onBuy={onBuy}
        onShop={onShop}
        message={message}
      />
      {/* 「しばらく表示しない」(2026-09-22 本人の指示)。1週間はガチャのあとに出さない。
          ショップのフォイルの欄は残るので、買いたくなったらそちらから */}
      {onSnooze && (
        <div className="foil-offer-snooze">
          <button
            type="button"
            className="skin-btn foil-offer-snooze-btn"
            disabled={working}
            onClick={onSnooze}
          >
            しばらく表示しない
          </button>
          <small>1週間はガチャのあとに出ません。ショップのフォイルの欄からは買えます</small>
        </div>
      )}
    </SkinModal>
  );
}
