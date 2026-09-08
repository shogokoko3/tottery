import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Crown, RotateCcw, Ticket } from "../icons.jsx";
import { playSound } from "../audio/index.js";
import { useCollection, updateCollection } from "../skins/store.js";
import { CardBack, CardFace } from "./cards.jsx";
import { squareName } from "../game/board.js";
import {
  dailyTsume,
  joinDailyTsume,
  tsumeReceipt,
} from "../game/tsume-daily.js";
import {
  tsumeQuestion,
  createTsumePosition,
  tsumeMoves,
  applyTsumeAction,
  tsumeWon,
  isTsumeAnswer,
  clearDailyTsume,
  TSUME_ORDERS,
} from "../game/tsume.js";

export function useTsumeDay(now = Date.now) {
  const [today, setToday] = useState(() => dailyTsume(now()));
  useEffect(() => {
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      const next = dailyTsume(now());
      setToday((previous) => (previous.day === next.day ? previous : next));
      timer = setTimeout(
        refresh,
        Math.max(50, Math.min(60000, next.nextDay - now() + 10)),
      );
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [now]);
  return today;
}

export function TsumeScreen({ onBack, now = Date.now }) {
  const today = useTsumeDay(now);
  return (
    <DailyPuzzle key={today.day} today={today} now={now} onBack={onBack} />
  );
}

function DailyPuzzle({ today, now, onBack }) {
  const collection = useCollection();
  const receipt = tsumeReceipt(collection, today.day);
  const q = tsumeQuestion(today.questionId);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const guard = useRef(false);
  async function start() {
    if (guard.current) return;
    guard.current = true;
    setStarting(true);
    setError("");
    try {
      await updateCollection((value) =>
        joinDailyTsume(value, today.day, now()),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      guard.current = false;
      setStarting(false);
    }
  }
  async function clear(evidence) {
    await updateCollection((value) =>
      clearDailyTsume(value, today.day, evidence, now()),
    );
  }
  return (
    <section className="tsume-screen" aria-label="詰めトッタリー">
      <header className="tsume-heading">
        <div className="tsume-eyebrow">一日一問 · 毎朝5時更新（日本時間）</div>
        <h2>詰めトッタリー</h2>
        <div className="tsume-rewards">
          <span className={receipt?.joined ? "received" : ""}>
            参加 · エーテル50 {receipt?.joined && <Check size={14} />}
          </span>
          <span className={receipt?.cleared ? "received" : ""}>
            <Ticket size={14} /> クリア · チケット1枚{" "}
            {receipt?.cleared && <Check size={14} />}
          </span>
        </div>
      </header>
      {!receipt?.joined ? (
        <div className="tsume-scroll tsume-intro">
          <div className="tsume-seal">
            <Crown size={40} />
          </div>
          <p className="tsume-date">{today.day.replaceAll("-", "/")} の一問</p>
          <h3>{q.title}</h3>
          <p className="hint">
            {q.kind === "inference" ? "伏せ札の推理" : "王を取って決着"} ·{" "}
            {q.size}×{q.size} · {q.level}
          </p>
          <p>札の動きと王の力を読み、答えを見つけよう。</p>
          <button
            className="btn btn-primary"
            onClick={start}
            disabled={starting}
          >
            {starting ? "保存中…" : "挑戦する"}
          </button>
          <p className="hint">
            参加でエーテル50を受け取れます。
            <br />
            今日の問題は何度でも再挑戦できます。
          </p>
          {error && (
            <p role="alert" className="tsume-error">
              {error}
            </p>
          )}
        </div>
      ) : (
        <PuzzleAttempt
          key={attempt}
          q={q}
          receipt={receipt}
          onClear={clear}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      )}
      <footer className="tsume-footer">
        {receipt?.joined && (
          <button
            className="btn btn-ghost"
            onClick={() => setAttempt((n) => n + 1)}
          >
            <RotateCcw size={15} /> やり直す
          </button>
        )}
        <button className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={15} /> ホームに戻る
        </button>
      </footer>
    </section>
  );
}

function PuzzleAttempt({ q, receipt, onClear, onRetry }) {
  const [state, setState] = useState(() => createTsumePosition(q));
  const [selected, setSelected] = useState(null);
  const [picks, setPicks] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [actions, setActions] = useState([]);
  const [solved, setSolved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [trace, setTrace] = useState([]);
  const [defeated, setDefeated] = useState([]);
  const timer = useRef(null),
    guard = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  async function complete(evidence) {
    setSolved(true);
    setShowAnswer(true);
    setPending(evidence);
    setError("");
    guard.current = true;
    setBusy(true);
    try {
      await onClear(evidence);
      if (mounted.current) setPending(null);
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) {
        guard.current = false;
        setBusy(false);
      }
    }
  }
  function submitAnswer() {
    if (guard.current || answer === null || solved) return;
    if (answer !== q.correctOption) {
      setFeedback("もう一度、移動と公開情報を確認してみましょう。");
      return;
    }
    setFeedback("正解です！");
    complete({ answer });
  }
  function perform(action) {
    if (guard.current || failed || solved) return;
    const next = applyTsumeAction(state, action);
    if (next === state) {
      setFeedback("その操作はできません。選ぶ駒とマスを確認してください。");
      return;
    }
    const history = [...actions, action];
    guard.current = true;
    setBusy(true);
    setFeedback("");
    setTrace(action.type === "move" ? [action] : []);
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    timer.current = setTimeout(
      () => {
        setState(next);
        setActions(history);
        setSelected(null);
        setPicks([]);
        const taken = next.captureReveal?.defeated || [];
        setDefeated((previous) => [...previous, ...taken]);
        playSound(taken.length ? "capture" : "place");
        guard.current = false;
        setBusy(false);
        if (tsumeWon(next) && isTsumeAnswer(q, { actions: history })) {
          setFeedback("相手の王を撃破。あなたの勝利です！");
          complete({ actions: history });
        } else if (tsumeWon(next)) {
          setFailed(true);
          setFeedback(
            "今回は王を取れましたが、別の入れ替え結果では勝てません。どの配置でも包囲できる2枚を探しましょう。",
          );
        } else if (
          next.phase !== "play" ||
          next.currentTurn !== 0 ||
          !next.extraMoveFor
        ) {
          setFailed(true);
          setFeedback(
            "この手番では王を取れませんでした。やり直して、別の手を探しましょう。",
          );
        } else {
          setSelected(next.extraMoveFor);
          setFeedback("王の10は、続けてもう一度動けます。王を狙いましょう。");
        }
      },
      reduceMotion ? 0 : 420,
    );
  }
  function chooseCell(square) {
    if (guard.current || solved || failed || q.kind === "inference") return;
    const piece = Object.values(state.pieces).find(
      (p) => p.alive && squareName(p.row, p.col, q.size) === square,
    );
    if (selected && state.pieces[selected]?.rank === "A") {
      if (piece?.id === selected) {
        setSelected(null);
        setPicks([]);
        return;
      }
      if (!piece) return;
      setPicks((values) =>
        values.includes(square)
          ? values.filter((p) => p !== square)
          : values.length < 2
            ? [...values, square]
            : [values[1], square],
      );
      return;
    }
    const mover = state.pieces[selected];
    if (
      mover &&
      tsumeMoves(state, selected).some(
        (m) => squareName(m.row, m.col, q.size) === square,
      )
    ) {
      perform({
        type: "move",
        from: squareName(mover.row, mover.col, q.size),
        to: square,
      });
      return;
    }
    if (
      piece?.owner === 0 &&
      (!state.extraMoveFor || state.extraMoveFor === piece.id)
    ) {
      setSelected(piece.id === selected ? null : piece.id);
      setFeedback("");
    } else setFeedback("自分の駒を選んでから、行き先を押してください。");
  }
  const ace = selected && state?.pieces[selected]?.rank === "A";
  const ownTriangle =
    ace &&
    picks.length === 2 &&
    picks.every((square) =>
      Object.values(state.pieces).some(
        (p) =>
          p.alive &&
          p.owner === 0 &&
          squareName(p.row, p.col, q.size) === square,
      ),
    );
  return (
    <div className="tsume-scroll">
      <div className="tsume-problem-heading">
        <span className="tsume-eyebrow">
          今日の一問 ·{" "}
          {q.kind === "inference" ? "伏せ札の推理" : "王を取って決着"} ·{" "}
          {q.size}×{q.size}
        </span>
        <h3>{q.title}</h3>
        {receipt.cleared && (
          <span className="tsume-completed">
            <Check size={14} /> 本日クリア済み · 報酬受取済み
          </span>
        )}
      </div>
      <p className="tsume-question">{q.question}</p>
      <p className="tsume-note">{q.note}</p>
      <PuzzleBoard
        q={q}
        state={state}
        selected={selected}
        picks={picks}
        arrows={q.observation || trace}
        triangle={
          q.kind === "triangle" && (solved || ownTriangle)
            ? [q.actor, ...(solved ? q.picks : picks)]
            : null
        }
        onCell={chooseCell}
        disabled={busy || solved || failed}
      />
      <div className="tsume-legend">
        <span>赤：自分</span>
        <span>青：相手</span>
        <span>王：王の駒</span>
      </div>
      {q.kind === "inference" ? (
        <fieldset className="tsume-options" disabled={busy || solved}>
          <legend>答えを選んでください</legend>
          {q.options.map((option, i) => (
            <label key={option} className={answer === i ? "selected" : ""}>
              <input
                type="radio"
                name={`tsume-${q.id}`}
                checked={answer === i}
                onChange={() => {
                  setAnswer(i);
                  setFeedback("");
                }}
              />
              {option}
            </label>
          ))}
          <button
            className="btn btn-primary"
            onClick={submitAnswer}
            disabled={answer === null || busy || solved}
          >
            回答する
          </button>
        </fieldset>
      ) : (
        <div className="tsume-play-controls">
          {!solved && !failed && (
            <p className="tsume-note">
              {ace
                ? picks.length === 2
                  ? "選んだ2枚で入れ替えを実行できます。"
                  : `入れ替える駒をあと${2 - picks.length}枚選んでください。`
                : "自分の駒 → 行き先の順に押してください。"}
            </p>
          )}
          {ace && (
            <button
              className="btn btn-primary"
              disabled={picks.length !== 2 || busy}
              onClick={() =>
                perform({
                  type: "shuffle",
                  from: q.actor,
                  picks,
                  order: TSUME_ORDERS[Math.floor(Math.random() * 6)],
                })
              }
            >
              この2枚で入れ替える
            </button>
          )}
          {failed && (
            <button className="btn btn-primary" onClick={onRetry}>
              もう一度挑戦する
            </button>
          )}
        </div>
      )}
      {defeated.length > 0 && (
        <div className="tsume-taken">
          撃破：
          {defeated.map((p, i) => (
            <span key={i} className={p.isKing ? "king" : ""}>
              {p.rank}
              {p.isKing ? "（王）" : ""}
            </span>
          ))}
        </div>
      )}
      <p
        role="status"
        aria-live="polite"
        className={`tsume-feedback ${solved ? "correct" : ""}`}
      >
        {feedback}
      </p>
      {solved && (
        <div className="tsume-success">
          <Crown size={24} />
          <b>クリア！</b>
          <span>
            {busy
              ? "報酬を保存しています…"
              : pending
                ? "正解です。報酬の保存を再試行してください。"
                : "ガチャチケット1枚 · 本日の報酬受取済み"}
          </span>
        </div>
      )}
      {error && (
        <div role="alert" className="tsume-error">
          {error}
          <button
            className="btn"
            disabled={busy}
            onClick={() => complete(pending)}
          >
            報酬の保存を再試行
          </button>
        </div>
      )}
      <details className="tsume-hint">
        <summary>ヒントを見る</summary>
        <p>{q.hint}</p>
      </details>
      {!solved && (
        <button
          className="btn btn-ghost tsume-explain-toggle"
          aria-expanded={showAnswer}
          onClick={() => setShowAnswer((v) => !v)}
        >
          {showAnswer ? "解説を閉じる" : "答え・解説を見る"}
        </button>
      )}
      {showAnswer && (
        <div className="tsume-explanation">
          <h4>答え</h4>
          <p>{q.answer}</p>
          <p>{q.explanation}</p>
          {!solved && (
            <p className="tsume-note">
              答えを確認したら、実際に解いてクリアしましょう。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PuzzleBoard({
  q,
  state,
  selected,
  picks,
  arrows,
  triangle,
  onCell,
  disabled,
}) {
  const inference = q.kind === "inference";
  const pieces = state
    ? Object.values(state.pieces)
        .filter((p) => p.alive)
        .map((p) => ({
          ...p,
          at: squareName(p.row, p.col, q.size),
          king: p.isKing,
        }))
    : q.pieces.map((p) => ({ ...p, suit: "spade" }));
  const legal = selected
    ? tsumeMoves(state, selected).map((m) => squareName(m.row, m.col, q.size))
    : [];
  const xy = (at) => [
    (at.charCodeAt(0) - 97 + 0.5) * 100,
    (q.size - Number(at.slice(1)) + 0.5) * 100,
  ];
  return (
    <div className="tsume-board" style={{ "--tsume-size": q.size }}>
      <div className="tsume-files">
        {Array.from({ length: q.size }, (_, i) => (
          <span key={i}>{String.fromCharCode(97 + i)}</span>
        ))}
      </div>
      <div className="tsume-board-body">
        <div className="tsume-ranks">
          {Array.from({ length: q.size }, (_, i) => (
            <span key={i}>{q.size - i}</span>
          ))}
        </div>
        <div
          className="tsume-grid"
          role="group"
          aria-label={`${q.size}×${q.size}の盤面`}
        >
          {Array.from({ length: q.size * q.size }, (_, i) => {
            const row = Math.floor(i / q.size),
              col = i % q.size,
              square = squareName(row, col, q.size);
            const p = pieces.find((p) => p.at === square),
              picked = picks.includes(square) || (!!p?.id && p.id === selected);
            const description = p
              ? `${p.owner === 0 ? "自分" : "相手"} ${p.rank === "?" ? "伏せ札" + p.label : (p.king ? "王の" : "") + p.rank}`
              : "空きマス";
            return (
              <button
                type="button"
                key={square}
                className={`tsume-cell ${(row + col) % 2 ? "light" : ""} ${picked ? "picked" : ""} ${legal.includes(square) ? "legal" : ""}`}
                disabled={inference || disabled}
                onClick={() => onCell(square)}
                aria-label={`${square} ${description}`}
                aria-pressed={inference ? undefined : picked}
              >
                {p ? (
                  <span
                    className={`tsume-card side-${p.owner}`}
                    aria-hidden="true"
                  >
                    {p.rank === "?" ? (
                      <>
                        <CardBack colorHex="var(--p1)" />
                        <b className="tsume-hidden-label">{p.label}</b>
                      </>
                    ) : (
                      <>
                        <CardFace
                          rank={p.rank}
                          suit={p.suit}
                          isKing={p.king}
                          owner={p.owner}
                          animated={false}
                        />
                        <b className="tsume-rank-label">
                          {p.rank}
                          {p.king && <small>王</small>}
                        </b>
                      </>
                    )}
                  </span>
                ) : legal.includes(square) ? (
                  <span className="tsume-move-dot" />
                ) : null}
              </button>
            );
          })}
          <svg
            className="tsume-paths"
            viewBox={`0 0 ${q.size * 100} ${q.size * 100}`}
            aria-hidden="true"
          >
            {triangle && (
              <polygon
                points={triangle.map((p) => xy(p).join(",")).join(" ")}
                className="tsume-triangle"
              />
            )}
            {(arrows || []).map((a, i) => {
              const [x1, y1] = xy(a.from),
                [x2, y2] = xy(a.to),
                dx = x2 - x1,
                dy = y2 - y1,
                len = Math.hypot(dx, dy),
                ux = dx / len,
                uy = dy / len;
              const x = x2 - ux * 22,
                y = y2 - uy * 22;
              return (
                <g key={i} className={inference ? "observed" : "played"}>
                  <line x1={x1 + ux * 20} y1={y1 + uy * 20} x2={x} y2={y} />
                  <polyline
                    points={`${x - ux * 15 - uy * 10},${y - uy * 15 + ux * 10} ${x},${y} ${x - ux * 15 + uy * 10},${y - uy * 15 - ux * 10}`}
                  />
                  {arrows.length > 1 && (
                    <>
                      <circle
                        cx={(x1 + x2) / 2}
                        cy={(y1 + y2) / 2}
                        r={q.size * 4}
                      />
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2}
                        dominantBaseline="central"
                        textAnchor="middle"
                      >
                        {a.label || ""}
                        {i + 1}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
