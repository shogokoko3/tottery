import {ALICE_SKINS} from "../skins/alice.js";
import { useState } from "react";
import { emptyBoard, getLegalMoves } from "../game/board.js";
import {
  KING_TEXT,
  MOVE_TEXT,
  RANKS,
  moveOnlyText,
} from "../game/constants.js";
import { Close, Crown } from "../icons.jsx";
import { figCell } from "../game/king-power-text.js";
import { CardFace } from "./cards.jsx";
import { AreaGuide } from "./area-guide.jsx";
// はじめての手引き(2026-09-29 本人の指示)。早見表からも読み返せるようにする
import { Primer } from "./primer.jsx";
import { primerOutroLines } from "../game/story.js";
import { loadProfile } from "../game/profile.js";
import { getCollection } from "../skins/store.js";
import { foilRevealed } from "../skins/collection.js";

export function MoveDiagram({ rank, isKing = !1, gridSize = 7 }) {
  // 4・5 の王は自分ではなく「王以外の同じ数字」を伸ばす。
  // 王の欄では、その伸びた駒のほうを描く(王自身は素の動きのままなので、
  // 王として描くと通常の欄と同じ図になり、何が変わったのか読めない)
  const growsOthers = rank === "4" || rank === "5";
  const drawAsKing = isKing && !growsOthers;
  let n = Math.floor(gridSize / 2),
    a = emptyBoard(gridSize),
    u = {
      id: "me",
      rank,
      suit: "spade",
      owner: 0,
      isKing: drawAsKing,
      row: n,
      col: n,
      alive: !0,
      history: [],
    };
  if (((a[n][n] = u), drawAsKing && ["6", "7", "8", "9"].includes(rank)))
    for (let o = 0; o < gridSize; o++)
      for (let r = 0; r < gridSize; r++)
        (o === n && r === n) ||
          (a[o][r] = {
            id: `e${o}-${r}`,
            rank: "2",
            suit: "heart",
            owner: 1,
            isKing: !1,
            row: o,
            col: r,
            alive: !0,
            history: [],
          });
  let i =
      rank === "A"
        ? []
        : getLegalMoves(u, a, gridSize, { [rank]: 1 }, isKing ? rank : null),
    f = new Set(i.map((o) => `${o.row},${o.col}`));
  return (
    <div
      className="move-diagram"
      style={{
        gridTemplateColumns: `repeat(${gridSize},1fr)`,
      }}
    >
      {Array.from({
        length: gridSize,
      }).map((o, r) =>
        Array.from({
          length: gridSize,
        }).map((d, m) => {
          let s = r === n && m === n,
            v = f.has(`${r},${m}`);
          return (
            <span
              className={`md-cell ${s ? "md-me" : ""} ${v ? "md-reach" : ""}`}
              key={`${r}-${m}`}
            />
          );
        }),
      )}
    </div>
  );
}
/**
 * 王の力の図(2026-10-25。王を選ぶ画面と、フェーズ2 第1話の「王の力とは」)。
 * 実際の盤の大きさ(既定 5×5)で、駒を好きなマス(origin)に置き、相手の駒(foes)も置ける。
 * 届くマスを金、一度に取れる相手の駒を赤い輪で描く。数は合法手(getLegalMoves)から出す
 *   asKing  王として描く(力あり)。false なら素の動き
 *   grows   4・5 の王の「ほかの同じ数字」を描く(その駒は王ではない。王は同じ数字)
 *   count   盤に置いた同じ数字の枚数(伸びの計算。王を含む)
 */
export function PowerDiagram({ rank, size = 5, origin = null, foes = [], asKing = true, grows = false, count = 1 }) {
  const at = origin || { row: Math.floor(size / 2), col: Math.floor(size / 2) };
  const board = emptyBoard(size);
  const me = { id: "me", rank, suit: "spade", owner: 0, isKing: asKing && !grows, row: at.row, col: at.col, alive: true, history: [], ...(asKing || grows ? {} : { powers: false }) };
  board[at.row][at.col] = me;
  for (const [i, f] of foes.entries())
    board[f.row][f.col] = { id: `f${i}`, rank: "2", suit: "heart", owner: 1, isKing: false, row: f.row, col: f.col, alive: true, history: [] };
  const moves = rank === "A" ? [] : getLegalMoves(me, board, size, { [rank]: Math.max(1, count) }, asKing || grows ? rank : null);
  const reach = new Set(moves.map((m) => `${m.row},${m.col}`));
  const taken = new Set(moves.flatMap((m) => (m.captures || (m.capture ? [m] : [])).map((c) => `${c.row},${c.col}`)));
  // 一度に何枚も取る手があれば、その手で取れる駒だけを赤くする(6〜9 の王)
  const best = moves.reduce((b, m) => ((m.captures?.length || 0) > (b?.captures?.length || 0) ? m : b), null);
  const multi = best && best.captures && best.captures.length > 1 ? new Set(best.captures.map((c) => `${c.row},${c.col}`)) : null;
  return (
    <div className="move-diagram power-diagram" style={{ gridTemplateColumns: `repeat(${size},1fr)` }}>
      {Array.from({ length: size }).map((_, r) =>
        Array.from({ length: size }).map((__, c) => {
          const key = `${r},${c}`;
          const foe = foes.some((f) => f.row === r && f.col === c);
          const cap = foe && (multi ? multi.has(key) : taken.has(key));
          return (
            <span
              key={key}
              className={`md-cell${r === at.row && c === at.col ? " md-me" : ""}${reach.has(key) && !foe ? " md-reach" : ""}${foe ? " md-foe" : ""}${cap ? " md-cap" : ""}`}
            />
          );
        }),
      )}
    </div>
  );
}

/**
 * 王の力の説明の図(2026-10-25 design-v2)。5×5、1マス 18px。中身は king-power-text.js の図の形
 * (pieces=白い四角の駒、dots=ふつうに行けるマス、gold=王の力で行けるマス、foes=相手の駒(faded=届かない、frame=取れる)、arrow/arrows=動く道すじ)。
 * 印は対局の盤(.cell-move の丸・.cell-capture の赤い枠・.cell-kp-power の金色)とそろえる
 * ルールから描く PowerDiagram と違い、場面を1つに決めて描く(6〜9 の「ふつうは1枚取って止まる/王は2枚とも取る」を同じ並びで比べる)
 */
export function PowerFigure({ spec, caption = true, mini = false }) {
  const N = 5;
  const key = (at) => { const c = figCell(at); return `${c.row},${c.col}`; };
  const gold = new Set(spec.gold.map(key));
  const dots = new Set((spec.dots || []).map(key));
  const pieces = new Map(spec.pieces.map((p) => [key(p.at), p]));
  const foes = new Map(spec.foes.map((f) => [key(f.at), f]));
  const center = (at) => { const c = figCell(at); return [c.col * 19 + 10, c.row * 19 + 10]; };
  // 矢印は1本(arrow)か、続けて動く道すじ(arrows。王の10の2回)
  const arrows = (spec.arrows || (spec.arrow ? [spec.arrow] : [])).map(([from, to]) => {
    const [x1, y1] = center(from);
    const [x2, y2] = center(to);
    const len = Math.hypot(x2 - x1, y2 - y1);
    // 矢じりが行き先の駒に重なりすぎないよう、少し手前で止める
    const k = (len - 5) / len;
    return { x1, y1, x2: x1 + (x2 - x1) * k, y2: y1 + (y2 - y1) * k };
  });
  return (
    <figure className={`pf${mini ? " is-mini" : ""}`}>
      <div className="pf-board" role="img" aria-label={spec.caption}>
        {Array.from({ length: N }).map((_, r) =>
          Array.from({ length: N }).map((__, c) => {
            const k = `${r},${c}`;
            const p = pieces.get(k);
            const f = foes.get(k);
            return (
              <span key={k} className={`pf-cell${gold.has(k) ? " pf-gold" : ""}${dots.has(k) ? " pf-dot" : ""}${f && f.frame ? " pf-frame" : ""}`}>
                {p && (
                  <span className={`pf-me${p.king ? " is-king" : ""}`}>
                    {p.rank}
                    {p.king && <Crown size={mini ? 7 : 11} className="pf-crown" />}
                  </span>
                )}
                {f && <span className={`pf-foe${f.faded ? " is-faded" : ""}`} />}
              </span>
            );
          }),
        )}
        {arrows.length > 0 && (
          <svg className="pf-arrow" viewBox="0 0 96 96" aria-hidden="true">
            <defs>
              <marker id="pf-head" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M0,0 L6,3 L0,6 z" fill="#fff" />
              </marker>
            </defs>
            {arrows.map((ar, i) => (
              <line key={i} x1={ar.x1} y1={ar.y1} x2={ar.x2} y2={ar.y2} stroke="#fff" strokeWidth="2" markerEnd="url(#pf-head)" />
            ))}
          </svg>
        )}
      </div>
      {/* 「ふつう: 縦横1マス」は「ふつう」と中身の2行に分ける(語の途中で割らない。「:」は式のようで読みにくいと言われたので画面には出さない) */}
      {caption && spec.caption && (
        <figcaption>
          {spec.caption.includes(": ") ? (
            <>
              <span>{spec.caption.split(": ")[0]}</span>
              <span>{spec.caption.split(": ").slice(1).join(": ")}</span>
            </>
          ) : (
            spec.caption
          )}
        </figcaption>
      )}
    </figure>
  );
}

/** ふつう → 王 の2枚を並べる */
export function PowerFigurePair({ figs }) {
  return (
    <div className="pf-pair">
      <PowerFigure spec={figs[0]} />
      <span className="pf-to" aria-hidden="true">→</span>
      <PowerFigure spec={figs[1]} />
    </div>
  );
}

/** 10・A の回数の帯(盤の図は描かない)。kind: "move"(動く)か "swap"(入れ替え) */
export function PowerBands({ kind }) {
  const mark = kind === "swap" ? "⇄" : "→";
  return (
    <div className="pf-bands">
      <div className="pf-band">
        <span className="pf-band-who">ふつう</span>
        <span className="pf-band-turn">1回の番</span>
        <span className="pf-band-marks">{mark} ①</span>
      </div>
      <div className="pf-band is-king">
        <span className="pf-band-who">王</span>
        <span className="pf-band-turn">1回の番</span>
        <span className="pf-band-marks">{mark} {mark} ①②</span>
      </div>
    </div>
  );
}

/**
 * 王にしたときの図。
 * 4・5 の王は自分ではなく仲間の同じ数字を伸ばすので、図を1つにすると「王がこう動く」と読めてしまう
 * (本人の指摘 2026-09-16)。王自身(2マスのまま)と仲間(伸びた)の2つを、名札つきで並べる
 */
export function KingMoveFigure({ rank, gridSize = 7 }) {
  if (rank !== "4" && rank !== "5")
    return <MoveDiagram rank={rank} isKing gridSize={gridSize} />;
  return (
    <div className="md-pair">
      <figure>
        <MoveDiagram rank={rank} gridSize={gridSize} />
        <figcaption>王(2マスのまま)</figcaption>
      </figure>
      <figure>
        <MoveDiagram rank={rank} isKing gridSize={gridSize} />
        <figcaption>仲間の{rank}(伸びる)</figcaption>
      </figure>
    </div>
  );
}

/**
 * 札の説明(絵・動きの図・文)。
 * placing: 予備札から盤に出す場面。採用の但し書き(2枚まで採用可、王にする時のみ)は
 * その札を置けないかのように読めるので外す(2026-09-15)
 */
export function CardGuide({
  rank,
  suit,
  isKing = !1,
  compact = !1,
  placing = !1,
  mark,
  originalRank,
  alice = false,
  movementRank = null,
}) {
  return (
    <div className={`card-guide ${compact ? "card-guide-compact" : ""}`}>
      <div className="cg-head">
        {suit ? (
          <CardFace rank={rank} suit={suit} mark={mark} originalRank={originalRank} />
        ) : (
          <div className="cg-rank">{rank}</div>
        )}
        {alice && rank==="A" ? <p className="hint">数字逆転<br/>2↔K・3↔Q・4↔J<br/>5↔10・6↔9・7↔8</p> : isKing && (!alice || ["2","3"].includes(rank)) ? <KingMoveFigure rank={rank} /> : <MoveDiagram rank={movementRank || rank} />}
      </div>
      <p className="cg-text">
        {placing ? moveOnlyText(rank) : MOVE_TEXT[rank]}
      </p>
      {isKing && <p className="cg-king">王の効果: {alice ? ALICE_SKINS.find(s=>s.rank===rank)?.description : KING_TEXT[rank]}</p>}
      {movementRank && <p className="hint">カドリール：現在は{movementRank}と同じ動きです。</p>}
    </div>
  );
}
export function RulesPanel({ onClose, initialTab = "moves" }) {
  // "moves" 通常の動き / "king" 王にした時 / "areas" 盤面エリア
  let [tab, setTab] = (0, useState)(
    ["moves", "king", "areas", "primer"].includes(initialTab) ? initialTab : "moves",
  );
  let t = tab === "king",
    l = (king) => setTab(king ? "king" : "moves");
  // 盤面エリアはフォイルを持つまで見せない。対局中の「?」から開いたときは見せる
  let areasKnown = initialTab === "areas";
  try {
    areasKnown = areasKnown || foilRevealed(getCollection());
  } catch {
    /* 読めなければ隠したまま */
  }
  // はじめての手引き。**覚える順に1枚ずつ**なので、調べる用の表とは分けて置く
  if (tab === "primer")
    return (
      /* 1枚目からでも閉じられるように、途中でやめる釦も「とじる」にする
         (2026-09-30 見直し。10枚送らないと閉じられなかった) */
      <Primer doneLabel="とじる" onDone={onClose} onSkip={onClose} skipLabel="とじる" outro={primerOutroLines(loadProfile())} />
    );
  if (tab === "areas")
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-panel" onClick={(n) => n.stopPropagation()}>
          <div className="modal-head">
            <h3>盤面エリア</h3>
            <button className="icon-btn" onClick={onClose}>
              <Close size={18} />
            </button>
          </div>
          <div className="rule-toggle">
            <button className="btn btn-ghost" onClick={() => setTab("primer")}>
              はじめに
            </button>
            <button className="btn btn-ghost" onClick={() => setTab("moves")}>
              通常の動き
            </button>
            <button className="btn btn-ghost" onClick={() => setTab("king")}>
              王にした時
            </button>
            <button className="btn btn-primary" onClick={() => setTab("areas")}>
              盤面エリア
            </button>
          </div>
          <AreaGuide />
        </div>
      </div>
    );
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(n) => n.stopPropagation()}>
        <div className="modal-head">
          <h3>カード早見表</h3>
          <button className="icon-btn" onClick={onClose}>
            <Close size={18} />
          </button>
        </div>
        <div className="rule-toggle">
          <button className="btn btn-ghost" onClick={() => setTab("primer")}>
            はじめに
          </button>
          <button
            className={`btn ${t ? "btn-ghost" : "btn-primary"}`}
            onClick={() => l(!1)}
          >
            通常の動き
          </button>
          <button
            className={`btn ${t ? "btn-primary" : "btn-ghost"}`}
            onClick={() => l(!0)}
          >
            王にした時
          </button>
          {areasKnown && (
            <button className="btn btn-ghost" onClick={() => setTab("areas")}>
              盤面エリア
            </button>
          )}
        </div>
        <p
          className="hint"
          style={{
            marginBottom: 14,
          }}
        >
          {t
            ? "王にした時に加わる効果です。図は同じ数字を1枚だけ採用した場合。"
            : "金色のマスが動ける先です。"}
        </p>
        <div className="rule-grid">
          {RANKS.map((n) => (
            <div className="rule-row" key={n}>
              <div className="rule-diagram">
                <div className="rule-rank">{n}</div>
                {t ? <KingMoveFigure rank={n} /> : <MoveDiagram rank={n} />}
              </div>
              <div className="rule-desc">{t ? KING_TEXT[n] : MOVE_TEXT[n]}</div>
            </div>
          ))}
        </div>
        {/* 表になる場面は2つしかないので、早見表の足元に添えておく */}
        <p className="hint rule-foot">
          駒が表になるのは3つの場面です。布陣が<b>フラッシュ</b>
          で相手に公開された とき、<b>相手の王を討った</b>
          とき（その駒はその場で名乗りを上げます）、 そして<b>Kの王の予備札</b>
          から出たとき。表になった駒は、相手にも 正体が見えます。
        </p>
        <p className="hint rule-foot">
          <b>終局できない局面の判定：</b>駒の移動範囲から両者の王を討てないと確定した場合、または動く側に合法な行動がない場合は、対局開始時に採用した札の数字の合計が低い側の勝ちです。同点は引き分け。A=1、J=11、Q=12、K=13として数え、倒れた駒も含みます。途中で投入した予備札は合計に含みません。CPU戦・ストーリー・同じ端末の対局では、同じ局面が3回目になったとき、または駒が1枚も倒れない手番が続いたとき(5×5は両者合わせて40手番、9×9は60手番)も同じ判定です。オンライン対戦では、同じ局面の繰り返しだけでは判定しません。
        </p>
      </div>
    </div>
  );
}
