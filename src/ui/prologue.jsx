/**
 * はじまりの語りと、門の語り(2026-09-28 本人の指示
 * 「インストール後にすぐガチャが始まるのはいいが、その前になにか物語性を織り交ぜて、
 *  自然な流れでガチャになる導入口を作りたい」)。
 *
 * 2026-10-01 本人の指示で、置き場所と中身を改めた(10連は導入の最後。はじめの一局に勝った褒美):
 *  - 語り(PROLOGUE)2枚は、タイトルのあと、はじめの一局の前。最後の釦は「盤へ」
 *    1枚目で、伏せ札を自分の指で1枚取る(外れ)。2枚目で、別の一枚を取ると王冠が出る
 *  - 門の語り(GATE)1枚は、はじめの一局に勝って名前を決めたあと、10連の前。釦は「門を開く」
 *  - 背景のタイトル絵は敷かない(絵に焼き込まれた「相手の王を討て」が見出しと並んで透けるため)
 *
 * 決まりごと:
 *  - **1枚1つ**。見出しは読点ごとの行の配列で渡す(text-wrap: balance だと「王か/もしれない」と割れる)
 *  - どこを押しても次へ。ただし触りのある札(1枚目)は、絵の外を押しても進まない(取る指と取り違えない)
 *  - いつでも読み飛ばせる。物語で足止めしない
 *  - 絵の駒の動きはルールどおり(盤の駒と同じ Piece で描き、取る駒は真正面へ縦に1マス)
 *  - 動きを減らす設定(端末の設定・対局中の演出オフ)では止め絵
 *
 * 呼ぶ側(screens.jsx)が使う形:
 *   <Prologue kind="intro" onDone={…} />
 *     語り2枚。onDone は「盤へ」と「読み飛ばす」のどちらでも一度だけ呼ぶ(→ はじめの一局)
 *   <Prologue kind="gate" onDone={…} />
 *     門の語り1枚。onDone は「門を開く」と「読み飛ばす」のどちらでも一度だけ呼ぶ(→ 召喚の門・初回10連)
 *   どちらも一度きり。出すかどうかは呼ぶ側が決める
 */
import { useEffect, useRef, useState } from "react";
import { typing } from "./key-target.js";
import { cardBackImg } from "../assets.js";
import { Piece } from "./cards.jsx";
import { useReducedMotion } from "./skin-modal.jsx";
import { useCollection } from "../skins/store.js";

/**
 * 語りの札。lines は見出し(読点ごとの行)、note はその下の一行、art は絵の種類。
 * touch のある札は、絵の伏せ札を押して取れる(その札だけ、絵の外を押しても進まない)
 */
export const PROLOGUE = Object.freeze([
  Object.freeze({
    key: "one",
    // 導入1枚目。広告にも使う(2026-10-01 本人の決め)
    lines: Object.freeze(["その一枚が、", "王かもしれない。"]),
    note: "トランプの札を駒に、伏せて戦う一対一。",
    art: "take",
    touch: true,
  }),
  Object.freeze({
    key: "read",
    lines: Object.freeze(["動きを読め。", "隠れた王を討て。"]),
    note: "相手の王を取れば、あなたの勝ち。",
    art: "king",
  }),
]);

/** 門の語り。はじめの一局に勝ったあと、10連の前に1枚だけ */
export const GATE = Object.freeze([
  Object.freeze({
    key: "gate",
    lines: Object.freeze(["はじめての勝ちに、", "門が開く。"]),
    // 「十人」は駒が増えるように読めるので使わない。門の「この手に」との重なりも避ける
    note: "札に宿る英雄を、呼び出そう。",
    art: "gate",
  }),
]);

/** 語りの組ごとの、最後の釦と読み飛ばしの行き先 */
const SETS = Object.freeze({
  intro: { cards: PROLOGUE, label: "はじまりの語り", done: "盤へ", skip: "語りを読み飛ばして盤へ" },
  gate: { cards: GATE, label: "門の語り", done: "門を開く", skip: "語りを読み飛ばして召喚の門へ" },
});

/**
 * 絵の二列。奥(上)は相手の伏せ札5枚、手前(下)はあなたの札5枚を表で。
 * 手前の5枚は、どれも真正面へ縦に1マス進める数字(2・4・8・J)にした。
 * どの伏せ札を押されても、その真正面の駒がルールどおりに取りに行ける
 * (tools/check-prologue.mjs が本物の getLegalMoves で確かめる)。
 * はじめの一局(4♠・4♦・2♥・3♣・5♥)とは札を分ける
 */
export const TAKE_ART = Object.freeze({
  mine: Object.freeze([
    ["8", "spade"],
    ["4", "heart"],
    ["J", "heart"],
    ["2", "spade"],
    ["8", "diamond"],
  ]),
  // 1枚目でどれを取っても、めくれるのはこの1枚(王ではない)
  taken: Object.freeze(["9", "diamond"]),
  // 2枚目で取ると王冠が出る1枚
  king: Object.freeze(["7", "club"]),
});

/** 2枚目で王を取る列。1枚目で取った列とは重ねない(真ん中の J が取りに行く。真ん中を取っていれば左隣) */
export function kingColumn(taken) {
  return taken === 2 ? 1 : 2;
}

/** 絵の駒を1枚作る。盤の駒とまったく同じ描き方にする */
const chip = (id, rank, suit, owner, isKing = false) => ({
  id,
  rank,
  suit,
  owner,
  isKing,
  revealed: false,
  alive: true,
  history: [],
});

/**
 * 二列の絵。
 *   taken     1枚目で取った列(null ならまだ)
 *   kingAt    王を取った列(2枚目だけ。null なら出さない)
 *   settled   1枚目の取りを動かさずに置く(2枚目に入ったあと。めくれた 9♦ はそのまま)
 *   onTake    伏せ札を押したとき(1枚目だけ。取ったあとは押せない)
 */
function TakeArt({ taken, kingAt, settled, onTake }) {
  const inviting = !!onTake && taken === null;
  return (
    <div className={`prologue-art prologue-rows${inviting ? " is-inviting" : ""}`}>
      {TAKE_ART.mine.map(([rank, suit], col) => {
        const isTaken = col === taken;
        const isKing = col === kingAt;
        const struck = isTaken || isKing;
        const [fr, fs] = isKing ? TAKE_ART.king : TAKE_ART.taken;
        return (
          <div
            key={col}
            className={`prologue-col${struck ? " is-struck" : ""}${isTaken && settled ? " is-settled" : ""}${isKing ? " is-king" : ""}`}
            style={{ "--i": col }}
          >
            {/* 奥の伏せ札。押すと、真正面の駒が取りに行く */}
            <button
              type="button"
              className="prologue-foe"
              disabled={!inviting}
              aria-label={`相手の伏せ札(左から${col + 1}枚目)を取る`}
              tabIndex={inviting ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation();
                if (inviting) onTake(col);
              }}
            >
              <Piece piece={chip(`f${col}`, fr, fs, 1)} viewer={0} />
            </button>
            {/* 取った札は表になって、列の上へ退く(王なら王冠) */}
            {struck && (
              <div className="prologue-taken" aria-hidden="true">
                <Piece piece={chip(`t${col}`, fr, fs, 1, isKing)} viewer={0} revealAll />
              </div>
            )}
            <div className="prologue-mine" aria-hidden="true">
              <Piece piece={chip(`m${col}`, rank, suit, 0)} viewer={0} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 門の語りの絵。札の裏が一枚、金の光の中に浮かぶ */
function GateArt() {
  return (
    <div className="prologue-art prologue-gate-art" aria-hidden="true">
      <i className="prologue-gate-glow" />
      <img className="prologue-gate-card" src={cardBackImg} alt="" draggable="false" />
    </div>
  );
}

export function Prologue({ kind = "intro", onDone }) {
  const set = SETS[kind] || SETS.intro;
  const cards = set.cards;
  const [at, setAt] = useState(0);
  // 1枚目で取った伏せ札の列。一度きり(どれを押しても外れの 9♦)
  const [taken, setTaken] = useState(null);
  const done = useRef(false);
  const reduce = useReducedMotion();
  const collection = useCollection();
  // 動きを減らす設定では止め絵(端末の設定と、設定画面の「対局中の演出」)
  const still = reduce || collection.motion === "off";
  const last = at >= cards.length - 1;
  const card = cards[at];
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  const next = () => (last ? finish() : setAt((n) => n + 1));
  // 画面を開いたら、下の画面は動かさない
  useEffect(() => {
    const onKey = (e) => {
      // 上に開いた設定・早見表の入力欄や釦に向いたキーは取らない
      // (2026-09-30 見直し。名前の変更で空白を打つと語りが進んでいた)
      if (typing(e)) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div
      className={`prologue prologue-${kind}${card.touch ? " is-touch" : ""}${still ? " is-still" : ""}`}
      role="group"
      aria-label={set.label}
      // 触りのある札は、絵の外を押しても進まない(取る指と取り違えないため)
      onClick={card.touch ? undefined : next}
    >
      <button
        type="button"
        className="prologue-skip"
        aria-label={set.skip}
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
      >
        読み飛ばす ≫
      </button>
      {/* 札を差し替えるたびに入り直す(key で作り直す) */}
      <div className="prologue-text" key={card.key}>
        <h2 className="prologue-title">
          {card.lines.map((line) => (
            <span className="prologue-line" key={line}>
              {line}
            </span>
          ))}
        </h2>
        <p className="prologue-note">{card.note}</p>
      </div>
      {card.art === "gate" ? (
        <GateArt />
      ) : (
        <TakeArt
          taken={taken}
          kingAt={card.art === "king" ? kingColumn(taken) : null}
          settled={card.art !== "take"}
          onTake={card.touch ? setTaken : null}
        />
      )}
      {/* 絵の下の一言。二列の札では、一言の無い2枚目でも同じ高さを取る(絵が上下に跳ねない) */}
      {card.art !== "gate" && (
        <p className="prologue-cue" aria-live="polite" key={card.touch ? (taken === null ? "ask" : "miss") : "none"}>
          {card.touch ? (taken === null ? "一枚、取ってみて。" : "外れ。王は、残りの四枚の中。") : null}
        </p>
      )}
      <div className="prologue-foot">
        {cards.length > 1 && (
          <div className="prologue-dots" aria-hidden="true">
            {cards.map((c, i) => (
              <i key={c.key} className={i === at ? "is-at" : ""} />
            ))}
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary prologue-next"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
        >
          {last ? set.done : "つづき"}
        </button>
      </div>
    </div>
  );
}
