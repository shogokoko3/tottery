/**
 * ショップ。ホームの「ショップ」から来る(2026-09-17、本人の指示)。
 *
 * **その場で買う**。欄を押すとそこに商品が並ぶ(2026-09-17 本人の指示
 * 「他の画面に飛んで買うシステムをやめて、一覧ボタンを押したらその場に商品が並ぶように」)。
 * 開くのは一度に1つだけ。閉じている欄は描かない(フォイルの絵とジェムの読み込みが重いため)。
 *
 * 決済の呼び出しは src/ui/buy.js の1本に寄せてあり、商品の見た目も
 * ガチャ画面・バトルパス画面と**同じ部品**を使う。同じ商品の値段・残高・失敗の文言が
 * 片方だけ古くなるのを防ぐため。それぞれの画面の購入UIはそのまま残してある
 * (「飛んで買うのをやめる」であって「他では買えなくする」ではない)。
 */
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Grid, Lock, Sparkle, Ticket } from "../icons.jsx";
import { GemAmount, GemIcon } from "./gem.jsx";
import { GemPacks } from "./gem-shop.jsx";
import { FoilOfferPicker } from "./foil-offer.jsx";
import { TicketBuy } from "./ticket-buy.jsx";
import { BattlePassBuy } from "./battlepass-buy.jsx";
import { buyFoilFor, buyPassFor, buyTicketsFor } from "./buy.js";
import { shopAvailable } from "../net/iap.js";
import { syncWallet } from "../net/wallet.js";
import { updateCollection, useCollection } from "../skins/store.js";
import { useBattlePassUnlocked } from "./battlepass-access.js";
import { FREE_GACHA, foilRevealed } from "../skins/collection.js";
import { foilOffers } from "../skins/foil-shop.js";
import {
  BATTLEPASS_GEMS,
  GEM_PER_TICKET,
  TICKET_BUNDLE,
} from "../iap/catalog.js";

const yen = (n) => Number(n || 0).toLocaleString("ja-JP");

export function ShopScreen({ onBack, onGacha, onFoil, onBattlePass }) {
  const collection = useCollection();
  const passUnlocked = useBattlePassUnlocked();
  // ジェムの購入は iOS のアプリだけ(StoreKit)。Web では入り口を出すが、押すと理由を出す
  const [shopOk, setShopOk] = useState(false);
  // いま開いている欄。一度に1つだけ("gems" | "ticket" | "foil" | "pass" | null)
  const [open, setOpen] = useState(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    shopAvailable().then((ok) => alive && setShopOk(ok));
    // 有償ジェムで買わせる画面なので、残高と権利をサーバーから引き直してから並べる
    syncWallet().catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const foilKnown = foilRevealed(collection);
  const offers = foilKnown ? foilOffers(collection) : [];
  const gems = collection.gems || 0;
  const gemsPaid = collection.gemsPaid || 0;
  const openGems = () => {
    setMessage("");
    setOpen("gems");
  };
  const toggle = (key) => {
    setMessage("");
    setOpen((cur) => (cur === key ? null : key));
  };
  /** 買えたら残高を引き直す。失敗の文言と「ジェムを買う」への誘導は buy.js が決める */
  const run = async (fn) => {
    if (working) return false;
    setWorking(true);
    setMessage("");
    const r = await fn();
    if (r.ok) await syncWallet().catch(() => {});
    if (r.needGems && shopOk) setOpen("gems");
    setMessage(r.message);
    setWorking(false);
    return r.ok;
  };
  const arrow = (key) => (
    <ArrowRight
      size={16}
      className="home-wide-arrow"
      style={open === key ? { transform: "rotate(90deg)" } : undefined}
    />
  );
  return (
    <div className="center-stage shop-screen">
      <h2>ショップ</h2>
      <div className="shop-balance" aria-label="いまの残高">
        <GemAmount amount={gems} size={26} />
        <span className="shop-balance-tickets">
          <Ticket size={16} /> チケット {collection.tickets}枚
        </span>
      </div>
      {message && !open && (
        <p className="mission-message" role="status" aria-live="polite">
          {message}
        </p>
      )}
      <div className="nav-stack">
        <button
          className="btn btn-primary btn-choice"
          aria-expanded={open === "gems"}
          onClick={() =>
            shopOk
              ? toggle("gems")
              : setMessage(
                  "ジェムは iPhone・iPad のアプリでのみ買えます。ほかの買い物はこのままお使いいただけます。",
                )
          }
        >
          <span className="shop-choice-icon">
            <GemIcon size={30} />
          </span>
          <span className="choice-label">
            ジェムを買う
            <small>150・600・1,500・3,000・5,000・10,000 の6種</small>
          </span>
          {arrow("gems")}
        </button>
        {open === "gems" && (
          <div className="shop-panel">
            <GemPacks
              gems={gems}
              gemsPaid={gemsPaid}
              gemsFree={collection.gemsFree || 0}
              onMessage={setMessage}
            />
            {message && (
              <p className="skins-message" role="status">
                {message}
              </p>
            )}
          </div>
        )}
        <button
          className="btn btn-teal btn-choice"
          aria-expanded={open === "ticket"}
          onClick={() => toggle("ticket")}
        >
          <Ticket size={30} />
          <span className="choice-label">
            ガチャチケット
            <small>
              {FREE_GACHA
                ? "いまは無料で引けます"
                : `1枚 ${yen(GEM_PER_TICKET)}ジェム / ${TICKET_BUNDLE.tickets}枚 ${yen(TICKET_BUNDLE.gems)}ジェム`}
            </small>
          </span>
          {arrow("ticket")}
        </button>
        {open === "ticket" && (
          <div className="shop-panel">
            {FREE_GACHA ? (
              <p className="hint">いまは無料で引けます。チケットは要りません。</p>
            ) : (
              <TicketBuy
                gems={gems}
                working={working}
                confirm={collection.ticketConfirm !== false}
                onToggleConfirm={() =>
                  updateCollection((c) => ({
                    ...c,
                    ticketConfirm: c.ticketConfirm === false,
                  })).catch(() => {})
                }
                onBuy={(n) => run(() => buyTicketsFor(n))}
                onShop={shopOk ? openGems : null}
                message={message}
              />
            )}
            <button className="btn btn-ghost btn-small" onClick={onGacha}>
              ガチャ・装備へ <ArrowRight size={14} />
            </button>
          </div>
        )}
        <button
          className="btn btn-friend btn-choice"
          aria-expanded={open === "foil"}
          disabled={!foilKnown}
          onClick={() => toggle("foil")}
        >
          {foilKnown ? <Sparkle size={30} /> : <Lock size={30} />}
          <span className="choice-label">
            フォイルを買う
            <small>
              {foilKnown
                ? "持っていないフォイルを有償ジェムで"
                : "ガチャでフォイルを引くと開きます"}
            </small>
          </span>
          {foilKnown && arrow("foil")}
        </button>
        {open === "foil" && foilKnown && (
          <div className="shop-panel">
            <p className="skins-note">
              有償ジェム <b>{yen(gemsPaid)}</b>
              。無償ジェムは使えません。セットの片方を持っていれば、残りの1枚ぶんの値段です。
            </p>
            <FoilOfferPicker
              offers={offers}
              gemsPaid={gemsPaid}
              working={working}
              onBuy={(offer) => run(() => buyFoilFor(offer))}
              onShop={shopOk ? openGems : null}
              message={message}
            />
            <button className="btn btn-ghost btn-small" onClick={onFoil}>
              フォイルの一覧へ <ArrowRight size={14} />
            </button>
          </div>
        )}
        <button
          className="btn btn-ghost btn-choice"
          aria-expanded={open === "pass"}
          onClick={() => toggle("pass")}
        >
          <Grid size={30} />
          <span className="choice-label">
            バトルパス
            <small>
              {passUnlocked
                ? "解放済み。マスを埋める"
                : `${yen(BATTLEPASS_GEMS)}ジェムで解放`}
            </small>
          </span>
          {arrow("pass")}
        </button>
        {open === "pass" && (
          <div className="shop-panel">
            {passUnlocked ? (
              <p className="hint">
                解放済みです。マスを埋めるとガチャチケットがもらえます。
              </p>
            ) : (
              <BattlePassBuy
                gemsPaid={gemsPaid}
                working={working}
                onBuy={() => run(() => buyPassFor())}
                onShop={shopOk ? openGems : null}
                message={message}
              />
            )}
            <button className="btn btn-ghost btn-small" onClick={onBattlePass}>
              バトルパスの盤へ <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={18} /> ホームに戻る
      </button>
    </div>
  );
}
