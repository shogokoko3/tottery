import { GemIcon, GemAmount } from "./gem.jsx";
/**
 * ジェム(有償の通貨)の店。iOS で StoreKit が使えるときだけ出す。
 * 商品と表示価格は StoreKit から。購入の前に Apple サインインを求める(財布の鍵)。
 * ガチャ画面とバトルパスの両方から使う。
 */
import { useEffect, useState } from "react";
import { buy, restore, loadProducts } from "../net/iap.js";
import { syncWallet } from "../net/wallet.js";
import { isVerified } from "../net/auth.js";
import { signInWithApple } from "../net/apple-signin.js";

export function GemShop({ gems, gemsPaid = 0, gemsFree = 0, onClose, onMessage }) {
  const [products, setProducts] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    loadProducts()
      .then((p) => alive && setProducts(p))
      .catch(() => alive && setProducts([]));
    return () => {
      alive = false;
    };
  }, []);
  const say = (m) => onMessage && onMessage(m);
  const gate = async () => {
    if (isVerified()) return true;
    const r = await signInWithApple();
    return !!r;
  };
  const purchase = async (id) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await gate())) return;
      const r = await buy(id);
      if (r === null) return;
      if (r.firstPurchase)
        say("初回購入ありがとうございます！ジェム2倍＋ペガサスナイトのスキンを差し上げました。");
      else
        say(r.pending ? "購入を受け付けました。通信が戻ると反映されます。" : "ジェムを受け取りました。");
      onClose();
    } catch (e) {
      say((e && e.message) || "購入できませんでした。");
    } finally {
      setBusy(false);
    }
  };
  const restoreAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await gate())) return;
      const { restored } = await restore();
      await syncWallet().catch(() => {});
      say(restored ? "購入を確かめ直しました。" : "確かめ直す購入はありませんでした。");
    } catch (e) {
      say((e && e.message) || "確かめ直せませんでした。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-overlay" role="dialog" aria-label="ジェムを買う">
      <div className="modal-panel gem-shop-panel">
        <div className="modal-head"><h3>ジェムを買う</h3><button className="btn btn-ghost btn-small" disabled={busy} onClick={onClose}>閉じる</button></div>
        <div className="gem-shop-scroll">
        <div className="gem-shop-balance"><GemIcon size={104} /><div><small>所持ジェム</small><GemAmount amount={gems} size={28} /><p>有償 {gemsPaid.toLocaleString("ja-JP")} · 無償 {gemsFree.toLocaleString("ja-JP")}</p></div></div>
        <p className="hint">
          使うときは無償ジェムから先に減ります。
          ジェムはアカウント(Apple でのサインイン)に紐づき、機種変更やインストールし直しのあとも残ります。
          有効期限はありません。パックのおまけ分は無償ジェムです。
        </p>
        <div className="shop-list">
          {products === null && <p className="hint">商品を読み込んでいます…</p>}
          {products &&
            products.map((p) => (
              <button
                key={p.id}
                className="skin-btn shop-item"
                disabled={busy}
                onClick={() => purchase(p.id)}
              >
                <span className="gem-pack-name"><GemIcon size={38} />{p.name}</span>
                <span className="gem-pack-price">{p.price}</span>
              </button>
            ))}
          {products && !products.length && (
            <p className="hint">商品を取れませんでした。少し待ってからお試しください。</p>
          )}
        </div>
        <p className="hint">
          価格は App Store の表示に従います。ジェムはこのゲームの中でだけ使え、払い戻しはできません。
        </p>
        </div>
        <div className="setup-actions">
          <button className="btn btn-ghost btn-small" disabled={busy} onClick={restoreAll}>
            購入を確かめ直す
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
