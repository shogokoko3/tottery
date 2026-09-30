/**
 * はじめての手引き(2026-09-29 本人の指示。2026-09-30 に導入だけに絞った)。
 *
 * 「寿司将棋」の導入が分かりやすかったので、その形を借りる:
 *   - **1ページ = 1つのこと**。絵1枚と1〜2行だけ
 *   - 先に「どんなゲームか」「どうすれば勝ちか」
 *   - いつでも読み飛ばせる。あとから何度でも開ける
 *
 * **駒の動きはここでは見せない**(2026-09-30 本人の指示)。ストーリーのフェーズ1 で、ステージごとに
 * 相手の王になる駒の動きを盤の図で見せる(story.jsx StoryIntro)。王の力もフェーズ1 には無いので載せない。
 *
 * 出すのは3か所:
 *   - 10連のあと、はじめての人に(screens.jsx)。最後の札が「ストーリーを始める」
 *   - ストーリーをはじめて開いたとき(まだ見ていない人に一度だけ)。ストーリー画面の「遊び方」からも
 *   - 早見表の「はじめに」(guides.jsx)
 */
import { useEffect, useRef, useState } from "react";
import { typing } from "./key-target.js";
import { CardFace, Piece } from "./cards.jsx";

/**
 * 導入の札。どんなゲームか → 1手ずつ → 勝ち方 → 討てなくなったら → 王は伏せたまま → 陣 → あとはストーリーで。
 * 最後の札(story)の文は、呼ぶ側が次に遊ぶステージに合わせて差し替えられる(Primer の outro。story.js primerOutroLines)
 */
export const PRIMER_PAGES = Object.freeze([
  Object.freeze({
    key: "welcome",
    title: "トッタリーへようこそ",
    lines: ["トランプの札を駒にして戦う、1対1のボードゲームです。"],
    art: "cards",
  }),
  Object.freeze({
    key: "turn",
    title: "1手ずつ",
    lines: ["自分の番に、駒を1つ動かします。", "相手の駒のマスへ進むと、その駒を取れます。"],
    art: "capture",
  }),
  Object.freeze({
    key: "win",
    title: "勝ち方",
    lines: ["相手の王を討てば勝ちです。"],
    art: "win",
  }),
  // 勝ち方のもう1つ(adjudication.js)。5×5 の 2・3 の王どうしでも起こりうる(2026-09-30 レビュー)
  Object.freeze({
    key: "judge",
    title: "討てなくなったら",
    lines: [
      "どちらの王も討てなくなったら、",
      "はじめに並べた札の数字の合計が小さいほうの勝ちです。",
    ],
    art: "judge",
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
  Object.freeze({
    key: "story",
    title: "あとはストーリーで",
    lines: [
      "ステージごとに、相手の王になる駒の動きを覚えます。",
      "まずは 2 と 3 から。",
    ],
    art: "story",
  }),
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
  if (page.art === "capture")
    return (
      <div className="primer-chips">
        <Piece piece={chip("4", "spade", 0)} viewer={0} size="sm" />
        <span className="primer-arrow" aria-hidden="true">
          ▶
        </span>
        <Piece piece={chip("3", "diamond", 1)} viewer={0} size="sm" />
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
  if (page.art === "judge")
    return (
      <div className="primer-judge">
        {[
          [["2", "3", "4"], 9, true],
          [["5", "6", "7"], 18, false],
        ].map(([ranks, total, win], i) => (
          <div key={i} className={`primer-judge-side ${win ? "is-win" : ""}`}>
            <div className="primer-judge-cards">
              {ranks.map((rank) => (
                <CardFace key={rank} rank={rank} suit={i ? "heart" : "spade"} size="xs" />
              ))}
            </div>
            <small>
              合計 {total}
              {win ? " の勝ち" : ""}
            </small>
          </div>
        ))}
      </div>
    );
  if (page.art === "story")
    return (
      <div className="primer-chips primer-chips-more">
        {["2", "4", "6", "8", "10", "J", "K"].map((rank) => (
          <CardFace key={rank} rank={rank} suit="spade" size="sm" />
        ))}
      </div>
    );
  return null;
}

/**
 * 手引き。
 *
 * onDone   読み終えた(最後の札の釦)。導入ではストーリーへ
 * onSkip   途中でやめる。渡さなければその釦を出さない
 * doneLabel 最後の札の釦の一言
 * skipLabel 途中でやめる釦の一言(導入は「あとで」、早見表からは「とじる」)
 */
export function Primer({ onDone, onSkip = null, doneLabel = "はじめる", skipLabel = "あとで", outro = null }) {
  const [at, setAt] = useState(0);
  const done = useRef(false);
  // 開いたら「つづき」に focus を置く(キーで送れるように。画面は送らない)
  const nextRef = useRef(null);
  useEffect(() => {
    try {
      if (nextRef.current && nextRef.current.focus) nextRef.current.focus({ preventScroll: true });
    } catch {
      /* focus できなくても読める */
    }
  }, []);
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
      // 入力欄・上に重なった別の画面に向いたキーは取らない。自分(.primer)の中の釦に向いた矢印・Escape は受ける
      // (矢印は click を起こさないので二重に進まない。Enter/Space は釦の click に任せる)
      const t = e && e.target;
      const mine = !!(t && typeof t.closest === "function" && t.closest(".primer"));
      if (typing(e) && !mine) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
      else if (e.key === "Escape" && onSkip) onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const base = PRIMER_PAGES[at];
  const page = base.key === "story" && Array.isArray(outro) && outro.length ? { ...base, lines: outro } : base;
  return (
    <div className="modal-overlay">
      <div className="modal-panel primer" role="dialog" aria-modal="true" aria-label="はじめての手引き">
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
        <div className="primer-body" key={page.key} aria-live="polite">
          <PrimerArt page={page} />
          <div className="primer-text">
            {page.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        {/* 点は上の段へ。下に釦2つと並べると、長い一言(「ストーリーを始める」)で
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
          <button type="button" className="btn btn-primary primer-next" onClick={next} ref={nextRef}>
            {last ? doneLabel : "つづき ›"}
          </button>
        </div>
      </div>
    </div>
  );
}
