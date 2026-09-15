import { GemIcon, GemAmount } from "./gem.jsx";
/**
 * ジェム(有償の通貨)の店。iOS で StoreKit が使えるときだけ出す。
 * 商品と表示価格は StoreKit から。購入の前に Apple サインインを求める(財布の鍵)。
 * ガチャ画面とバトルパスの両方から使う。
 */
import { useEffect, useState } from "react";
import {
  buy,
  restore,
  loadProducts,
  storeDiagnostics,
  reportDiag,
  currentLoadStage,
  APP_BUILD_LABEL,
  APP_BUILD,
} from "../net/iap.js";

/** 店の見張り。iap.js の打ち切り(12秒)より少し長く */
const WATCHDOG_MS = 15000;
import { syncWallet } from "../net/wallet.js";
import { isVerified } from "../net/auth.js";
import { signInWithApple } from "../net/apple-signin.js";

export function GemShop({
  gems,
  gemsPaid = 0,
  gemsFree = 0,
  onClose,
  onMessage,
  // 確認画面・検査用。渡すと StoreKit を呼ばずにこの一覧を出す
  initialProducts = null,
}) {
  const [products, setProducts] = useState(initialProducts);
  const [loadError, setLoadError] = useState("");
  // 商品が並ばないときの切り分け(ビルド・ストアの国・秒数)。失敗のときだけ取る
  const [diag, setDiag] = useState(null);
  // 読み込み中の経過秒(画面写真だけで「何秒待ったか」「どのビルドか」が分かるように)
  const [waited, setWaited] = useState(0);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initialProducts) return undefined;
    let alive = true;
    setProducts(null);
    setLoadError("");
    setDiag(null);
    setWaited(0);
    const started = Date.now();
    let settled = false;
    // 失敗の扱い(打ち切りも同じ道)。診断を取ってから画面とサーバーへ
    const fail = (e) => {
      if (!alive || settled) return;
      settled = true;
      setProducts([]);
      setLoadError((e && e.message) || "");
      storeDiagnostics(e && e.elapsedMs)
        .then((d) => {
          if (!alive) return;
          setDiag(d);
          reportDiag({
            build: d.build,
            storefront: d.storefront,
            ms: d.elapsedMs,
            count: 0,
            error: (e && e.message) || "",
          });
        })
        .catch(() => {});
    };
    // 経過秒を刻む。iap.js の打ち切りが効かない端末があった(2026-09-15、実機とシミュレータで再現)ので、
    // この時計でも見張り、WATCHDOG_MS を過ぎたら段階つきで打ち切る
    const tick = setInterval(() => {
      if (!alive) return;
      const ms = Date.now() - started;
      setWaited(Math.floor(ms / 1000));
      if (!settled && ms >= WATCHDOG_MS) {
        const e = new Error(
          `App Store から応答がありません(段階: ${currentLoadStage()})。`,
        );
        e.elapsedMs = ms;
        fail(e);
      }
    }, 1000);
    loadProducts()
      .then((p) => {
        if (!alive || settled) return;
        settled = true;
        setProducts(p);
        reportDiag({
          build: APP_BUILD,
          count: p.length,
          ms: Date.now() - started,
        });
      })
      .catch(fail);
    return () => {
      alive = false;
      clearInterval(tick);
    };
  }, [reload]);
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
        say(
          "初回購入ありがとうございます！ジェム2倍＋ペガサスナイトのスキンを差し上げました。",
        );
      else
        say(
          r.pending
            ? `購入を受け付けました。通信が戻ると反映されます。${r.reason ? `(${r.reason})` : ""}`
            : "ジェムを受け取りました。",
        );
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
      say(
        restored
          ? "購入を確かめ直しました。"
          : "確かめ直す購入はありませんでした。",
      );
    } catch (e) {
      say((e && e.message) || "確かめ直せませんでした。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-overlay" role="dialog" aria-label="ジェムを買う">
      <div className="modal-panel gem-shop-panel">
        <div className="modal-head">
          <h3>ジェムを買う</h3>
          <button
            className="btn btn-ghost btn-small"
            disabled={busy}
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
        <div className="gem-shop-scroll">
          <div className="gem-shop-balance">
            <GemIcon size={104} />
            <div>
              <small>所持ジェム</small>
              <GemAmount amount={gems} size={28} />
              <p>
                有償 {gemsPaid.toLocaleString("ja-JP")} · 無償{" "}
                {gemsFree.toLocaleString("ja-JP")}
              </p>
            </div>
          </div>
          <p className="hint">
            使うときは無償ジェムから先に減ります。ジェムはアカウント(Appleでのサインイン)に紐づき、機種変更やインストールし直しのあとも残ります。有効期限はありません。パックのおまけ分は無償ジェムです。
          </p>
          <div className="shop-list">
            {products === null && (
              <p className="hint">
                商品を読み込んでいます…
                <span className="gem-shop-diag">
                  {waited}秒 · ビルド {APP_BUILD_LABEL} · {currentLoadStage()}
                </span>
              </p>
            )}
            {products &&
              products.map((p) => (
                <button
                  key={p.id}
                  className="skin-btn shop-item"
                  disabled={busy}
                  onClick={() => purchase(p.id)}
                >
                  <span className="gem-pack-name">
                    {p.image ? (
                      <img
                        className="gem-pack-art"
                        src={p.image}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <GemIcon size={38} />
                    )}
                    {p.name}
                  </span>
                  <span className="gem-pack-price">{p.price}</span>
                </button>
              ))}
            {products && !products.length && (
              <>
                <p className="hint">
                  {loadError || "商品を取れませんでした。"}
                  App Store
                  に商品が並ぶまで時間がかかることがあります。通信を確かめて、少し待ってからもう一度お試しください。
                </p>
                <button
                  className="btn btn-ghost btn-small"
                  disabled={busy}
                  onClick={() => setReload((n) => n + 1)}
                >
                  もう一度読み込む
                </button>
                {diag && (
                  <p className="hint gem-shop-diag">
                    診断: ビルド {diag.build || "(Web)"} · ストア{" "}
                    {diag.storefront || "(不明)"}
                    {diag.elapsedMs != null &&
                      ` · ${(diag.elapsedMs / 1000).toFixed(1)}秒`}
                  </p>
                )}
              </>
            )}
          </div>
          <p className="hint">
            価格は App Store
            の表示に従います。ジェムはこのゲームの中でだけ使え、払い戻しはできません。
          </p>
        </div>
        <div className="setup-actions">
          <button
            className="btn btn-ghost btn-small"
            disabled={busy}
            onClick={restoreAll}
          >
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
