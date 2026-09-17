/**
 * ショップ。ホームの「ショップ」から来る(2026-09-17、本人の指示)。
 *
 * 買えるものの入り口をここ1か所にまとめる。買う操作そのものはそれぞれの持ち場に置いたまま
 * にしてある(ジェムは GemShop、チケットとフォイルはガチャ・装備の画面、バトルパスはその画面)。
 * 同じ購入の道を2つ持つと、値段や残高の扱いが片方だけ古くなるため。
 */
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Grid, Sparkle, Ticket } from "../icons.jsx";
import { GemAmount, GemIcon } from "./gem.jsx";
import { GemShop } from "./gem-shop.jsx";
import { shopAvailable } from "../net/iap.js";
import { useCollection } from "../skins/store.js";
import { useBattlePassUnlocked } from "./battlepass-access.js";
import { FREE_GACHA } from "../skins/collection.js";
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
  const [shop, setShop] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    shopAvailable().then((ok) => alive && setShopOk(ok));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="center-stage shop-screen">
      <h2>ショップ</h2>
      <div className="shop-balance" aria-label="いまの残高">
        <GemAmount amount={collection.gems || 0} size={26} />
        <span className="shop-balance-tickets">
          <Ticket size={16} /> チケット {collection.tickets}枚
        </span>
      </div>
      {message && (
        <p className="mission-message" role="status" aria-live="polite">
          {message}
        </p>
      )}
      <div className="nav-stack">
        <button
          className="btn btn-primary btn-choice"
          onClick={() =>
            shopOk
              ? setShop(true)
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
          <ArrowRight size={16} className="home-wide-arrow" />
        </button>
        <button className="btn btn-teal btn-choice" onClick={onGacha}>
          <Ticket size={30} />
          <span className="choice-label">
            ガチャチケット
            <small>
              {FREE_GACHA
                ? "いまは無料で引けます"
                : `1枚 ${yen(GEM_PER_TICKET)}ジェム / ${TICKET_BUNDLE.tickets}枚 ${yen(TICKET_BUNDLE.gems)}ジェム`}
            </small>
          </span>
          <ArrowRight size={16} className="home-wide-arrow" />
        </button>
        <button className="btn btn-friend btn-choice" onClick={onFoil}>
          <Sparkle size={30} />
          <span className="choice-label">
            フォイルを買う
            <small>持っていない王のフォイルを有償ジェムで</small>
          </span>
          <ArrowRight size={16} className="home-wide-arrow" />
        </button>
        <button className="btn btn-ghost btn-choice" onClick={onBattlePass}>
          <Grid size={30} />
          <span className="choice-label">
            バトルパス
            <small>
              {passUnlocked
                ? "解放済み。マスを埋める"
                : `${yen(BATTLEPASS_GEMS)}ジェムで解放`}
            </small>
          </span>
          <ArrowRight size={16} className="home-wide-arrow" />
        </button>
      </div>
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={18} /> ホームに戻る
      </button>
      {shop && (
        <GemShop
          gems={collection.gems || 0}
          gemsPaid={collection.gemsPaid || 0}
          gemsFree={collection.gemsFree || 0}
          onClose={() => setShop(false)}
          onMessage={setMessage}
        />
      )}
    </div>
  );
}
