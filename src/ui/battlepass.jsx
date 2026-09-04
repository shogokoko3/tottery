/**
 * バトルパスの画面。
 *
 * 真ん中から外へ、縦横に隣り合うマスだけを埋めていく。クリアしたマスは
 * ひっくり返せて、全部返すと1枚の絵になり、その絵柄のスキンが手に入る。
 * 絵は褒美スキンの札を5×5に切って、マスごとにその一片を出している。
 */
import { useState } from "react";
import { ArrowLeft, Check, Sparkle } from "../icons.jsx";
import {
  CELLS,
  SIZE,
  allCleared,
  canClaim,
  flipAll,
  rewardSkin,
  statusOf,
  toggleFlip,
} from "../game/battlepass.js";
import { updatePass, usePass } from "../game/battlepass-store.js";
import { grantSkin } from "../skins/collection.js";
import { updateCollection } from "../skins/store.js";

export function BattlePassScreen({ onBack }) {
  const pass = usePass();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const skin = rewardSkin();
  const rows = CELLS.map((c) => statusOf(c, pass));
  const done = rows.filter((c) => c.cleared).length;
  const turned = rows.filter((c) => c.flipped).length;

  async function claim() {
    if (busy || !canClaim(pass)) return;
    setBusy(true);
    try {
      await updateCollection((s) => grantSkin(s, skin.id));
      updatePass((s) => ({ ...s, claimed: true }));
      setMessage(`「${skin.name}」を手に入れました。`);
    } catch (e) {
      setMessage((e && e.message) || "受け取れませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setup-wrap">
      <h2>バトルパス</h2>
      <p className="hint">
        相手の駒を取ると、真ん中のとなりのマスから埋まっていきます。
        クリアしたマスはめくれて、全部そろうと絵柄が現れます。
      </p>
      <div className="pass-counts">
        <span>
          クリア <b>{done}</b>/{CELLS.length}
        </span>
        <span>
          めくった <b>{turned}</b>/{CELLS.length}
        </span>
      </div>
      <div
        className="pass-grid"
        style={{ "--n": SIZE }}
        role="group"
        aria-label="バトルパスのマス"
      >
        {rows.map((c) => {
          // 絵柄の一片。5×5に切った札の、このマスの場所
          const art = {
            backgroundImage: `url(${skin.card})`,
            backgroundSize: `${SIZE * 100}% ${SIZE * 100}%`,
            backgroundPosition: `${(c.col / (SIZE - 1)) * 100}% ${
              (c.row / (SIZE - 1)) * 100
            }%`,
          };
          const label = c.free
            ? c.name
            : `${c.name}（${c.now}/${c.goal}）${
                c.flipped ? "・めくり済み" : c.cleared ? "・めくれます" : ""
              }`;
          return (
            <button
              type="button"
              className={`pass-cell ${c.free ? "is-free" : ""} ${
                c.cleared ? "is-cleared" : c.open ? "is-open" : "is-locked"
              } ${c.flipped ? "is-flipped" : ""}`}
              key={c.id}
              aria-label={label}
              title={label}
              disabled={!c.cleared}
              onClick={() => updatePass((s) => toggleFlip(s, c.id))}
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
                  {c.cleared && !c.free && (
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
      {done > 1 && (
        <div className="pass-actions">
          <button
            className="btn btn-ghost"
            onClick={() => updatePass((s) => flipAll(s, turned < done))}
          >
            {turned < done ? "クリアしたマスを全部めくる" : "全部を条件に戻す"}
          </button>
        </div>
      )}
      <p className="mission-message" role="status">
        {message}
      </p>
      {pass.claimed ? (
        <p className="hint">
          <Sparkle size={14} /> 「{skin.name}」は受け取り済みです。
        </p>
      ) : canClaim(pass) ? (
        <button
          className="btn btn-primary btn-wide"
          disabled={busy}
          onClick={claim}
        >
          <Check size={16} /> 「{skin.name}」を受け取る
        </button>
      ) : (
        <p className="hint">
          {allCleared(pass)
            ? "残りのマスをめくると、絵柄がそろいます。もう一度押すと条件に戻ります。"
            : "全部のマスをクリアして、めくると絵柄が現れます。"}
        </p>
      )}
      <button className="btn btn-ghost" onClick={onBack}>
        <ArrowLeft size={16} /> もどる
      </button>
    </div>
  );
}
