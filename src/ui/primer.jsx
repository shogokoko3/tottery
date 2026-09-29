/**
 * はじめての手引き(2026-09-29 本人の指示)。
 *
 * 「寿司将棋」の導入が分かりやすかったので、その形を借りる:
 *   - **1ページ = 1つのこと**。絵1枚と1〜2行だけ
 *   - 先に「どんなゲームか」「どうすれば勝ちか」、**あとから駒の動き**
 *   - 駒は**1ページに1つ**。まとめて並べない
 *   - いつでも読み飛ばせる。あとから何度でも開ける
 *
 * トッタリーの早見表(RulesPanel)は13段を1枚に並べた**調べる用の表**で、
 * 初めての人が読む形ではなかった。手引きはその逆で、覚える順に1枚ずつ渡す。
 *
 * 出すのは2か所:
 *   - 10連のあと、第1話に誘うところ(screens.jsx)。最後の札が「第1話を始める」
 *   - 早見表の「はじめに」(guides.jsx)。読み返しはこちら
 *
 * 決まりごと:
 *   - **数字は書かない。** 動ける先は MoveDiagram が実際の getLegalMoves から描く。
 *     文も MOVE_TEXT をそのまま使う。ここに書き写すと、ルールを直したとき嘘になる
 *   - 導入で見せる段は 2〜5 だけ。第1話の札束(CARD_POOLS.basic)と同じにして、
 *     いま使う分だけを渡す。6 から先は早見表へ
 */
import { useEffect, useRef, useState } from "react";
import { typing } from "./key-target.js";
import { MOVE_TEXT } from "../game/constants.js";
import { MoveDiagram } from "./guides.jsx";
import { CardFace, Piece } from "./cards.jsx";

/** 導入で見せる段。第1話の札束とそろえる(2〜5) */
export const PRIMER_RANKS = Object.freeze(["2", "3", "4", "5"]);

/** ルールの札。駒の札はこのあと PRIMER_RANKS から作る */
const RULE_PAGES = Object.freeze([
  Object.freeze({
    key: "welcome",
    title: "トッタリーへようこそ",
    lines: ["トランプの札を駒にして戦う、1対1のボードゲームです。"],
    art: "cards",
  }),
  Object.freeze({
    key: "win",
    title: "勝ち方",
    lines: ["相手の王を討てば勝ちです。"],
    art: "win",
  }),
  Object.freeze({
    key: "hidden",
    title: "王は名乗らない",
    lines: [
      "王はお互いに伏せたまま。",
      "どれが王かは、討たれるまで分かりません。",
    ],
    art: "hidden",
  }),
  Object.freeze({
    key: "setup",
    title: "陣を組む",
    lines: [
      "配られた札から駒を選んで並べ、",
      "その中の1枚を王に決めます。",
    ],
    art: "setup",
  }),
]);

/** 最後の札。ここから先は早見表へ渡す */
const OUTRO = Object.freeze({
  key: "more",
  title: "つづきは早見表で",
  lines: [
    "6 から K、A の動きと、王の力は",
    "右上の ? からいつでも見られます。",
  ],
  art: "more",
});

/** 王の力。2・3 と 4・5 で向きが違うので、ここで一言だけ渡しておく */
const KING_PAGE = Object.freeze({
  key: "king-power",
  title: "王にすると",
  lines: [
    "王にした駒には力がつきます。",
    "2 と 3 の王は自分が遠くへ、4 と 5 の王は仲間を伸ばします。",
  ],
  art: "king-power",
});

/** 全部の札。ルール4枚 → 駒4枚 → 王 → 締め */
export const PRIMER_PAGES = Object.freeze([
  ...RULE_PAGES,
  ...PRIMER_RANKS.map((rank) =>
    Object.freeze({
      key: `rank-${rank}`,
      title: `${rank} の動き`,
      // 文はルールの持ちもの(MOVE_TEXT)をそのまま。ここで書き直さない
      lines: [MOVE_TEXT[rank]],
      rank,
    }),
  ),
  KING_PAGE,
  OUTRO,
]);

/** 見せ札を1枚作る。盤の駒とまったく同じ描き方にする(別に絵を用意しない) */
const chip = (rank, suit, owner, isKing = false) => ({
  id: `p${rank}${suit}${owner}`,
  rank,
  suit,
  owner,
  isKing,
  // revealed は立てない。立てると盤と同じ「公開」の印が付いてしまう
  // (フラッシュで公開された駒の意味になる)。表で見せたい相手の駒は revealAll で
  revealed: false,
  alive: true,
  history: [],
});

/**
 * 絵のところ。
 *
 * 別に挿し絵を描かず、**盤で使っているものをそのまま並べる**。
 * 手引きで見たものがそのまま対局に出てくるので、説明と盤がずれない
 */
function PrimerArt({ page }) {
  if (page.rank)
    return (
      <div className="primer-rank-art">
        <CardFace rank={page.rank} suit="spade" />
        <MoveDiagram rank={page.rank} gridSize={5} />
      </div>
    );
  if (page.art === "king-power")
    return (
      <div className="primer-figs">
        <figure>
          <MoveDiagram rank="2" gridSize={7} />
          <figcaption>ふつうの 2</figcaption>
        </figure>
        <figure>
          <MoveDiagram rank="2" isKing gridSize={7} />
          <figcaption>2 の王</figcaption>
        </figure>
      </div>
    );
  if (page.art === "cards")
    return (
      <div className="primer-chips">
        {[
          ["2", "spade"],
          ["3", "heart"],
          ["4", "spade"],
          ["5", "heart"],
        ].map(([rank, suit]) => (
          <Piece key={rank} piece={chip(rank, suit, 0)} viewer={0} size="sm" />
        ))}
      </div>
    );
  if (page.art === "win")
    return (
      <div className="primer-chips">
        <Piece piece={chip("5", "spade", 0)} viewer={0} size="sm" />
        <span className="primer-arrow" aria-hidden="true">
          ▶
        </span>
        <Piece piece={chip("2", "diamond", 1, true)} viewer={0} size="sm" revealAll />
      </div>
    );
  if (page.art === "hidden")
    return (
      <div className="primer-chips">
        {[0, 1, 2].map((i) => (
          <Piece key={i} piece={chip("2", "diamond", 1, i === 1)} viewer={0} size="sm" />
        ))}
      </div>
    );
  if (page.art === "setup")
    return (
      <div className="primer-chips primer-chips-setup">
        {[
          ["2", "spade"],
          ["4", "spade"],
          ["3", "heart"],
        ].map(([rank, suit], i) => (
          <Piece
            key={rank}
            piece={chip(rank, suit, 0, i === 1)}
            viewer={0}
            size="sm"
          />
        ))}
      </div>
    );
  if (page.art === "more")
    return (
      <div className="primer-chips primer-chips-more">
        {["6", "8", "10", "Q", "A"].map((rank) => (
          <CardFace key={rank} rank={rank} suit="spade" size="sm" />
        ))}
      </div>
    );
  return null;
}

/**
 * 手引き。
 *
 * onDone   読み終えた(最後の札の釦)。導入では第1話へ
 * onSkip   途中でやめる。渡さなければその釦を出さない
 * doneLabel 最後の札の釦の一言
 * skipLabel 途中でやめる釦の一言(導入は「あとで」、早見表からは「とじる」)
 */
export function Primer({ onDone, onSkip = null, doneLabel = "はじめる", skipLabel = "あとで" }) {
  const [at, setAt] = useState(0);
  const done = useRef(false);
  const last = at >= PRIMER_PAGES.length - 1;
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  const next = () => (last ? finish() : setAt((n) => n + 1));
  const back = () => setAt((n) => Math.max(0, n - 1));
  // 左右のキーでも送れる(パソコンで読むとき)
  useEffect(() => {
    const onKey = (e) => {
      // 入力欄・釦・上に重なった別の画面に向いたキーは取らない
      // (釦に乗ったまま Enter/Space を押すと click と二重に進むのも防ぐ)
      if (typing(e)) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const page = PRIMER_PAGES[at];
  return (
    <div className="modal-overlay">
      <div className="modal-panel primer" role="group" aria-label="はじめての手引き">
        <div className="primer-head">
          <h3>{page.title}</h3>
          {onSkip && (
            <button
              type="button"
              className="primer-skip"
              aria-label={`手引きを${skipLabel === "とじる" ? "とじる" : "読み飛ばす"}`}
              onClick={onSkip}
            >
              {skipLabel}
            </button>
          )}
        </div>
        {/* 札を送るたびに入り直す(key で作り直す) */}
        <div className="primer-body" key={page.key}>
          <PrimerArt page={page} />
          <div className="primer-text">
            {page.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        {/* 点は上の段へ。下に釦2つと並べると、長い一言(「第1話を始める」)で
            枠からはみ出していた(2026-09-29 実機幅375で確認) */}
        <div className="primer-dots" aria-hidden="true">
          {PRIMER_PAGES.map((p, i) => (
            <i key={p.key} className={i === at ? "is-at" : ""} />
          ))}
        </div>
        <div className="primer-foot">
          <button
            type="button"
            className="btn btn-ghost primer-back"
            onClick={back}
            disabled={at === 0}
          >
            ‹ 戻る
          </button>
          <button type="button" className="btn btn-primary primer-next" onClick={next}>
            {last ? doneLabel : "つづき ›"}
          </button>
        </div>
      </div>
    </div>
  );
}
