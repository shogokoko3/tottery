/**
 * バトルパスの画面。
 *
 * 真ん中から外へ、縦横に隣り合うマスだけを埋めていく。クリアしたマスは
 * ひっくり返すと、保存されたランダム位置の絵の一片が現れる。
 * 全25マスを開くと魔法で並び替わり、完成後にスキンを自動で受け取る。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Sparkle } from "../icons.jsx";
import {
  CELLS,
  SIZE,
  allCleared,
  allFlipped,
  canClaim,
  flipAll,
  markAssembled,
  rewardSkin,
  statusOf,
  toggleFlip,
} from "../game/battlepass.js";
import { getPass, updatePass, usePass } from "../game/battlepass-store.js";
import { claimSpecial } from "../skins/collection.js";
import { updateCollection } from "../skins/store.js";
import { unlockAudio } from "../audio/index.js";
import { BattlePassMagic } from "./battlepass-magic.jsx";

export function BattlePassScreen({ onBack, onSkins }) {
  const pass = usePass();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [animationReady, setAnimationReady] = useState(false);
  const [showConditions, setShowConditions] = useState(false);
  const claiming = useRef(false);
  const attempted = useRef(false);
  const mounted = useRef(false);
  const skin = rewardSkin();
  const imageSrc = skin.boardCard || skin.card;
  const rows = CELLS.map((c) => statusOf(c, pass));
  const done = rows.filter((c) => c.cleared).length;
  const turned = rows.filter((c) => c.flipped).length;
  const pending = allFlipped(pass) && !pass.assembled && !pass.claimed;
  const assembled = pass.assembled || pass.claimed;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 最後の札のめくりを見せてから、同じ25片の並び替えへつなぐ。
  useEffect(() => {
    if (!pending) {
      setAnimationReady(false);
      return;
    }
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 560;
    const timer = setTimeout(() => setAnimationReady(true), delay);
    return () => clearTimeout(timer);
  }, [pending]);

  const claim = useCallback(async () => {
    if (claiming.current || !canClaim(getPass())) return;
    claiming.current = true;
    setBusy(true);
    setMessage("");
    try {
      // 先行受取済みの場合や保存の再試行でも、特別スキンは1枚だけ。
      await updateCollection((s) => claimSpecial(s, skin.id));
      updatePass((s) => (canClaim(s) ? { ...s, claimed: true } : s));
      if (mounted.current) setMessage(`「${skin.name}」を手に入れました。`);
    } catch (e) {
      if (mounted.current)
        setMessage(
          (e && e.message) || "受け取れませんでした。もう一度お試しください。",
        );
    } finally {
      claiming.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [skin.id, skin.name]);

  // 完成後だけ自動付与。保存失敗時には完成状態を保ち、明示的に再試行できる。
  useEffect(() => {
    if (!canClaim(pass) || attempted.current) return;
    attempted.current = true;
    claim();
  }, [pass, claim]);

  const finishMagic = useCallback(() => {
    updatePass(markAssembled);
  }, []);

  function flip(id) {
    if (pending || assembled) return;
    unlockAudio();
    updatePass((s) => toggleFlip(s, id));
  }

  function flipCompleted() {
    if (pending || assembled) return;
    unlockAudio();
    updatePass((s) => flipAll(s, turned < done));
  }

  return (
    <div className="setup-wrap">
      <h2>バトルパス</h2>
      <p className="hint">
        相手の駒を取ると、真ん中のとなりのマスから埋まっていきます。
        めくるとランダムな絵の欠片が現れます。25マスすべてを開くと魔法で並び替わり、絵が完成してスキンを獲得できます。
      </p>
      <p className="pass-reward">
        <Sparkle size={16} /> コンプリート報酬
        <strong>A専用スキン「{skin.name}」</strong>
      </p>
      <div className="pass-counts">
        <span>
          クリア <b>{done}</b>/{CELLS.length}
        </span>
        <span>
          めくった <b>{assembled ? CELLS.length : turned}</b>/{CELLS.length}
        </span>
      </div>
      {pending && animationReady ? (
        <BattlePassMagic
          imageSrc={imageSrc}
          order={pass.puzzleOrder}
          onComplete={finishMagic}
        />
      ) : assembled && !showConditions ? (
        <div className="pass-complete-art">
          <img src={imageSrc} alt={`完成した${skin.name}のイラスト`} />
        </div>
      ) : (
        <div
          className="pass-grid"
          style={{ "--n": SIZE }}
          role="group"
          aria-label="バトルパスのマス"
        >
          {rows.map((c, index) => {
            const piece = pass.puzzleOrder[index];
            const flipped = c.flipped && !showConditions;
            // ミッションの位置は固定。絵の欠片だけ、保存した順序で出す。
            const art = {
              backgroundImage: `url(${imageSrc})`,
              backgroundSize: `${SIZE * 100}% ${SIZE * 100}%`,
              backgroundPosition: `${((piece % SIZE) / (SIZE - 1)) * 100}% ${
                (Math.floor(piece / SIZE) / (SIZE - 1)) * 100
              }%`,
            };
            const label = c.free
              ? c.name
              : `${c.name}（${c.now}/${c.goal}）${
                  flipped ? "・めくり済み" : c.cleared ? "・クリア済み" : ""
                }`;
            return (
              <button
                type="button"
                className={`pass-cell ${c.free ? "is-free" : ""} ${
                  c.cleared ? "is-cleared" : c.open ? "is-open" : "is-locked"
                } ${flipped ? "is-flipped" : ""}`}
                key={c.id}
                aria-label={label}
                title={label}
                disabled={!c.cleared || pending || assembled}
                onClick={() => flip(c.id)}
              >
                {/* 表は条件、裏は絵柄の一片。押すとくるっと回って入れ替わる */}
                <span className="pass-inner">
                  <span className="pass-front">
                    <span className="pass-name">{c.name}</span>
                    {!c.free && (
                      <span className="pass-num">
                        {c.now}/{c.goal}
                      </span>
                    )}
                    {c.cleared && !c.free && !assembled && (
                      <span className="pass-turn">めくる</span>
                    )}
                    {!c.cleared && (
                      <span
                        className="pass-bar"
                        style={{ "--p": `${Math.round(c.ratio * 100)}%` }}
                      />
                    )}
                  </span>
                  <span className="pass-back" style={art} />
                </span>
              </button>
            );
          })}
        </div>
      )}
      {assembled ? (
        <div className="pass-actions">
          <button
            className="btn btn-ghost"
            onClick={() => setShowConditions((v) => !v)}
          >
            {showConditions ? "完成したイラストを見る" : "クリアした条件を見る"}
          </button>
        </div>
      ) : (
        done > 1 &&
        !pending && (
          <div className="pass-actions">
            <button className="btn btn-ghost" onClick={flipCompleted}>
              {turned < done
                ? "クリアしたマスを全部めくる"
                : "全部を条件に戻す"}
            </button>
          </div>
        )
      )}
      <p className="mission-message" role="status" aria-live="polite">
        {message}
      </p>
      {pass.claimed ? (
        <p className="pass-earned" role="status">
          <Sparkle size={18} /> スキン獲得
          <strong>A専用「{skin.name}」</strong>
        </p>
      ) : canClaim(pass) ? (
        <button
          className="btn btn-primary btn-wide"
          disabled={busy}
          onClick={claim}
        >
          <Check size={16} />{" "}
          {busy ? "スキンを受け取っています…" : "スキンの受け取りを再試行"}
        </button>
      ) : (
        <p className="hint">
          {pending
            ? "25枚の欠片が、ひとつの絵に。"
            : allCleared(pass)
              ? "最後のマスをめくると、並び替えの魔法が始まります。"
              : "25マスすべてを開くと、並び替えの魔法が始まります。"}
        </p>
      )}
      {pass.claimed && onSkins && (
        <button className="btn btn-primary btn-wide" onClick={onSkins}>
          スキン画面でAに装備する
        </button>
      )}
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> ホームに戻る
      </button>
    </div>
  );
}
