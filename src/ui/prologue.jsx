/**
 * はじまりの語り(2026-09-28 本人の指示
 * 「インストール後にすぐガチャが始まるのはいいが、その前になにか物語性を織り交ぜて、
 *  自然な流れでガチャになる導入口を作りたい」)。
 *
 * 名前を決めたあと、最初の10連の**直前**に出す。狙いは2つ:
 *  - このゲームの軸(**王は名乗らない**)を、遊ぶ前に一行で渡す
 *  - 「だから従える者が要る」→「門が開く」と続けて、召喚へ自然につなげる
 *
 * 決まりごと:
 *  - **1枚1〜2行**(チュートリアルと同じ。読ませず、進ませる)
 *  - どこを押しても次へ。最後の1枚だけ「門へ進む」を出す
 *  - いつでも読み飛ばせる。物語で足止めしない
 *  - 一度きり。出すかどうかは呼ぶ側(まだ10連を引いていない人)が決める
 */
import { useEffect, useRef, useState } from "react";
import { titleBgImg } from "../assets.js";

/** 語りの札。1枚1〜2行。増やすならここだけ */
export const PROLOGUE = Object.freeze([
  Object.freeze({
    lines: ["盤の上では、王は名乗らない。"],
    note: "同じ姿の駒にまぎれ、討たれるまで誰にも分からない。",
  }),
  Object.freeze({
    lines: ["あなたの王も、まだ決まっていない。"],
    note: "従える者たちが揃うまでは。",
  }),
  Object.freeze({
    lines: ["門が開く。"],
    note: "最初の十人を、この手に。",
  }),
]);

export function Prologue({ onDone }) {
  const [at, setAt] = useState(0);
  const done = useRef(false);
  const last = at >= PROLOGUE.length - 1;
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  const next = () => (last ? finish() : setAt((n) => n + 1));
  // 画面を開いたら、下の画面は動かさない
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const card = PROLOGUE[at];
  return (
    <div
      className="prologue"
      role="group"
      aria-label="はじまりの語り"
      onClick={next}
    >
      <img
        className="prologue-bg"
        src={titleBgImg}
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <div className="prologue-shade" aria-hidden="true" />
      <button
        type="button"
        className="prologue-skip"
        aria-label="語りを読み飛ばして召喚へ"
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
      >
        読み飛ばす ≫
      </button>
      {/* 札を差し替えるたびに入り直す(key で作り直す) */}
      <div className="prologue-text" key={at}>
        {card.lines.map((line) => (
          <p className="prologue-line" key={line}>
            {line}
          </p>
        ))}
        <p className="prologue-note">{card.note}</p>
      </div>
      <div className="prologue-foot">
        <div className="prologue-dots" aria-hidden="true">
          {PROLOGUE.map((_, i) => (
            <i key={i} className={i === at ? "is-at" : ""} />
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary prologue-next"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
        >
          {last ? "門へ進む" : "つづき"}
        </button>
      </div>
    </div>
  );
}
