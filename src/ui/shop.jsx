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
import { useUnlockedPassSeasons } from "./battlepass-access.js";
import { openSeasons } from "../game/content-seasons.js";
import { rewardSkin } from "../game/battlepass.js";
import { FREE_GACHA } from "../skins/collection.js";
import { SERIES } from "../skins/catalog.js";
import { isSeriesOpen } from "../game/content-seasons.js";
import { foilOffers, foilWindow, foilWindowLabel, openFoilSeries } from "../skins/foil-shop.js";
import {
  BATTLEPASS_GEMS,
  GEM_PER_TICKET,
  TICKET_BUNDLE,
} from "../iap/catalog.js";
import { L, Lx, fmtNumber } from "../i18n/index.js";

// ジェムの数の書式(名前は前のまま。値段は円ではなくジェム)
const yen = (n) => fmtNumber(n);

export function ShopScreen({ onBack, onGacha, onFoil, onBattlePass }) {
  const collection = useCollection();
  // シーズンごとのバトルパス(2026-10-15)。持っているシーズンの一覧。全部持っていれば「解放済み」
  const unlockedSeasons = useUnlockedPassSeasons();
  const passSeasons = openSeasons();
  const passUnlocked = passSeasons.every((s) => unlockedSeasons.includes(s.id));
  // ジェムの購入は iOS のアプリだけ(StoreKit)。Web では入り口を出すが、押すと理由を出す
  const [shopOk, setShopOk] = useState(false);
  // いま開いている欄。一度に1つだけ("gems" | "ticket" | "foil" | "pass" | null)
  const [open, setOpen] = useState(null);
  // フォイルの欄で開いているシリーズの釦(series の id)。一度に1つだけ
  const [foilOpen, setFoilOpen] = useState(null);
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
  // フォイルの欄はシリーズごとの釦。押すとそのシリーズの商品が並ぶ(2026-10-15 本人の指示)。
  // 買えるのはガチャでフォイルを引いてから72時間だけ(2026-09-18。シリーズごとに別の72時間)だが、
  // **釦は72時間の外でも置く**(本人の指示「ポップアップ商品がない時でも、ボタンは用意して」)。
  // 外のときは一覧を見るだけで買えない(FoilOfferPicker の locked)。まだ始まっていないシーズンは出さない
  const foilSeriesAll = SERIES.filter((s) => isSeriesOpen(s.id));
  const foilSeries = openFoilSeries(collection);
  const foilLeftMs = Math.max(0, ...foilSeries.map((s) => foilWindow(collection, Date.now(), s.id).leftMs));
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
  const chevron = (on) => (
    <ArrowRight
      size={16}
      className="home-wide-arrow"
      style={on ? { transform: "rotate(90deg)" } : undefined}
    />
  );
  const arrow = (key) => chevron(open === key);
  // 文の途中に太字が入るので、英語の語順で切って組む
  const [paidPre, paidPost] = L(
    "有償ジェム {b}。無償ジェムは使えません。セットの片方を持っていれば、残りの1枚ぶんの値段です。",
  ).split("{b}");
  const [leftPre, leftPost] = L("{b}。ガチャでフォイルを引くと、そこから72時間だけ並びます。").split("{b}");
  const toggleFoilSeries = (id) => {
    setMessage("");
    setFoilOpen((cur) => (cur === id ? null : id));
  };
  return (
    <div className="center-stage shop-screen">
      <h2>{L("ショップ")}</h2>
      <div className="shop-balance" aria-label={L("いまの残高")}>
        <GemAmount amount={gems} size={26} />
        <span className="shop-balance-tickets">
          <Ticket size={16} /> {L("チケット {n}枚", { n: collection.tickets })}
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
                  L("ジェムは iPhone・iPad のアプリでのみ買えます。ほかの買い物はこのままお使いいただけます。"),
                )
          }
        >
          <span className="shop-choice-icon">
            <GemIcon size={30} />
          </span>
          <span className="choice-label">
            {L("ジェムを買う")}
            <small>{L("150・600・1,500・3,000・5,000・10,000 の6種")}</small>
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
            {L("ガチャチケット")}
            <small>
              {FREE_GACHA
                ? L("いまは無料で引けます")
                : L("1枚 {one}ジェム / {n}枚 {bundle}ジェム", {
                    one: yen(GEM_PER_TICKET),
                    n: TICKET_BUNDLE.tickets,
                    bundle: yen(TICKET_BUNDLE.gems),
                  })}
            </small>
          </span>
          {arrow("ticket")}
        </button>
        {open === "ticket" && (
          <div className="shop-panel">
            {FREE_GACHA ? (
              <p className="hint">{L("いまは無料で引けます。チケットは要りません。")}</p>
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
              {L("ガチャ・スキンへ")} <ArrowRight size={14} />
            </button>
          </div>
        )}
        <button
          className="btn btn-friend btn-choice"
          aria-expanded={open === "foil"}
          onClick={() => toggle("foil")}
        >
          <Sparkle size={30} />
          <span className="choice-label">
            {L("フォイルを買う")}
            <small>
              {foilSeries.length
                ? L("持っていないフォイルを有償ジェムで・{left}", { left: Lx(foilWindowLabel(foilLeftMs)) })
                : L("シリーズを選ぶと商品が並びます。買えるのはガチャでフォイルを引いてから72時間")}
            </small>
          </span>
          {arrow("foil")}
        </button>
        {open === "foil" && (
          <div className="shop-panel">
            <p className="skins-note">
              {paidPre}<b>{yen(gemsPaid)}</b>{paidPost}
            </p>
            {foilSeriesAll.map((series) => {
              const w = foilWindow(collection, Date.now(), series.id);
              const on = foilOpen === series.id;
              return (
                <div className="shop-foil-series" key={series.id}>
                  <button
                    className={`btn btn-ghost btn-choice shop-foil-series-btn${w.open ? "" : " is-closed"}`}
                    aria-expanded={on}
                    onClick={() => toggleFoilSeries(series.id)}
                  >
                    {w.open ? <Sparkle size={22} /> : <Lock size={22} />}
                    <span className="choice-label">
                      {Lx(series.name)}
                      <small>
                        {w.open
                          ? L("{left}・持っていないフォイルを有償ジェムで", { left: Lx(foilWindowLabel(w.leftMs)) })
                          : L("いまは買えません。商品を見るだけ")}
                      </small>
                    </span>
                    {chevron(on)}
                  </button>
                  {on && (
                    <div className="shop-foil-series-body">
                      {w.open ? (
                        <p className="skins-note">
                          {leftPre}<b className="shop-foil-left">{Lx(foilWindowLabel(w.leftMs))}</b>{leftPost}
                        </p>
                      ) : (
                        <p className="skins-note">
                          {L("いまは買えません。{name}のガチャでフォイルを引くと、そこから72時間だけ並びます。", {
                            name: Lx(series.name),
                          })}
                        </p>
                      )}
                      <FoilOfferPicker
                        offers={foilOffers(collection, { series: series.id, includeOwned: true })}
                        showOwned
                        locked={!w.open}
                        gemsPaid={gemsPaid}
                        working={working}
                        onBuy={(offer) => run(() => buyFoilFor(offer))}
                        onShop={shopOk ? openGems : null}
                        message={message}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <button className="btn btn-ghost btn-small" onClick={onFoil}>
              {L("フォイルの一覧へ")} <ArrowRight size={14} />
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
            {L("バトルパス")}
            <small>
              {passUnlocked
                ? L("解放済み。マスを埋める")
                : L("{n}ジェムで解放", { n: yen(BATTLEPASS_GEMS) })}
            </small>
          </span>
          {arrow("pass")}
        </button>
        {open === "pass" && (
          <div className="shop-panel">
            {passSeasons.map((season) => (
              <div className="shop-pass-season" key={season.id}>
                <h4>{season.passName}</h4>
                {unlockedSeasons.includes(season.id) ? (
                  <p className="hint">
                    {L("解放済みです。マスを埋めるとガチャチケットがもらえます。")}
                  </p>
                ) : (
                  <BattlePassBuy
                    gems={gems}
                    working={working}
                    onBuy={() => run(() => buyPassFor(season.id))}
                    onShop={shopOk ? openGems : null}
                    message={message}
                    art={false}
                    passName={season.passName}
                    rewardName={L("A専用「{name}」", { name: Lx(rewardSkin(season.id).name) })}
                  />
                )}
              </div>
            ))}
            <button className="btn btn-ghost btn-small" onClick={onBattlePass}>
              {L("バトルパスの盤へ")} <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={18} /> {L("ホームに戻る")}
      </button>
    </div>
  );
}
