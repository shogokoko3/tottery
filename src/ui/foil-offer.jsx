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
import { L, fmtNumber } from "../i18n/index.js";

const yen = (n) => fmtNumber(n);
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
    return <p className="skins-note">{L("いま買えるフォイルはありません。")}</p>;
  // フォイルは有償ジェムだけ。引いた直後は残高が無いことが多いので、
  // **商品を選ぶ前から**ジェムを買う道を出す(本人の指示 2026-09-17)。見るだけ(locked)のときは出さない
  const cheapest = buyable.length ? Math.min(...buyable.map((o) => o.price)) : 0;
  const short = !locked && buyable.length > 0 && gemsPaid < cheapest;
  // 足りない額だけ太字。文を額の前後で切る
  const [shortPre, shortPost] = (
    onShop
      ? L("有償ジェムが {n} 足りません。買うと、そのまま続けられます。")
      : L("有償ジェムが {n} 足りません。有償ジェムは iPhone・iPad のアプリで買えます。")
  ).split("{n}");
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
            {got && <small>{L("獲得済み")}</small>}
          </span>
        );
      })}
    </span>
  );
  // 確かめの文。値段だけ太字にするので、文を値段の前後で切る(英語では語順が違う)
  const [confirmPre, confirmPost] = picked
    ? L("「{name}」{series}{rest}を 有償ジェム {price} で買いますか？", {
        name: picked.product.name,
        series: picked.product.series ? L("（{series}）", { series: seriesNameOf(picked.product.series) }) : "",
        rest: picked.partial ? L("の残り{n}枚", { n: picked.skins.length }) : "",
      }).split("{price}")
    : ["", ""];
  return (
    <>
      {picked ? (
        <div className="foil-offer-confirm">
          <p>
            {confirmPre}
            <b>{yen(picked.price)}</b>
            {confirmPost}
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
              {L("やめる")}
            </button>
            <button
              className="btn btn-primary"
              disabled={working || gemsPaid < picked.price}
              onClick={async () => {
                const ok = await onBuy(picked);
                if (ok) setPicked(null);
              }}
            >
              {L("買う")}
            </button>
          </div>
          {gemsPaid < picked.price && onShop && (
            <button
              className="btn btn-ghost btn-small"
              disabled={working}
              onClick={onShop}
            >
              {L("有償ジェムが足りません · ジェムを買う")}
            </button>
          )}
        </div>
      ) : (
        <>
          {showOwned && !buyable.length && (
            <p className="skins-note">{L("このシリーズのフォイルはすべて獲得済みです。")}</p>
          )}
          {!locked && buyable.length > 0 && (short || onShop) && (
            <div className="foil-offer-buy">
              {short && (
                <p className="skins-note">
                  {shortPre}
                  <b>{yen(cheapest - gemsPaid)}</b>
                  {shortPost}
                </p>
              )}
              {onShop && (
                <button
                  className={`btn ${short ? "btn-primary" : "btn-ghost btn-small"}`}
                  disabled={working}
                  onClick={onShop}
                >
                  <GemIcon size={18} /> {L("ジェムを買う")}
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
                aria-label={L("{name} 獲得済み", { name: o.product.name })}
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
                <span className="foil-offer-price foil-offer-done">{L("獲得済み")}</span>
              </div>
            ) : (
              <button
                key={o.product.id}
                className={`foil-offer${locked ? " is-locked" : ""}`}
                disabled={working || locked}
                onClick={() => setPicked(o)}
                aria-label={L("{name} 有償ジェム {price}{locked}", { name: o.product.name, price: yen(o.price), locked: locked ? L(" いまは買えません") : "" })}
              >
                {arts(o)}
                <span className="foil-offer-name">
                  <b>{o.product.name}</b>
                  {o.partial && <small>{L("残り{n}枚ぶん", { n: o.skins.length })}</small>}
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
                  <small>{L("有償ジェム")}</small>
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
  // 「有償ジェム」だけ太字。文をその前後で切る
  const [sheetPre, sheetPost] = L(
    "持っていないフォイルを{b}で買えます(無償ジェムは使えません)。セットの片方を持っていれば、残りの1枚ぶんの値段です。",
  ).split("{b}");
  return (
    <SkinModal
      label={L("ほかのフォイルも")}
      onClose={onClose}
      className="foil-offer-overlay"
    >
      <div className="skin-modal-head">
        <div>
          <span className="skins-eyebrow">FOIL SHOP</span>
          <h2>{L("ほかのフォイルも")}</h2>
          {series && <p className="skins-note foil-offer-series">{L("{series}のフォイル", { series: seriesNameOf(series) })}</p>}
          <p className="skins-note">
            {sheetPre}
            <b>{L("有償ジェム")}</b>
            {sheetPost}
          </p>
          <p className="skins-note foil-offer-balance">
            {L("有償ジェム")} <b>{yen(gemsPaid)}</b>
          </p>
        </div>
        <button
          className="skin-close"
          aria-label={L("ほかのフォイルもを閉じる")}
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
            {L("しばらく表示しない")}
          </button>
          <small>{L("1週間はガチャのあとに出ません。ショップのフォイルの欄からは買えます")}</small>
        </div>
      )}
    </SkinModal>
  );
}
