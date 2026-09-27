import { useEffect, useRef, useState, useMemo } from "react";
import { RANKS } from "../game/constants.js";
import { sanitizeHistory, squareName } from "../game/board.js";
import { candidatesFromHistory } from "../game/rank-candidates.js";
import { movePresentationMs } from "../game/capture-presentation.js";
import {
  advanceNotes,
  cleanNote,
  hasNote,
  noteSquare,
  noteTarget,
} from "../game/private-notes.js";

export function usePrivateNotes(state, viewer, blocked) {
  const [notes, setNotes] = useState({}),
    [square, setSquare] = useState(null),
    [moving, setMoving] = useState(false);
  const previous = useRef(state),
    press = useRef(null),
    swallow = useRef(false);
  const changed =
    previous.current.lastMove !== state.lastMove ||
    previous.current.lastSwap !== state.lastSwap;
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    setNotes((n) => advanceNotes(n, before, state, viewer));
    const boardChanged = before.board !== state.board;
    if (boardChanged || state.phase !== "play") {
      setSquare(null);
      clearTimeout(press.current?.timer);
      press.current = null;
    }
    if (before.lastMove !== state.lastMove && state.lastMove) {
      setMoving(true);
      const timer = setTimeout(
        () => setMoving(false),
        movePresentationMs(state.lastMove),
      );
      return () => clearTimeout(timer);
    }
    setMoving(false);
  }, [state.board, state.lastMove, state.lastSwap, state.phase, viewer]);
  useEffect(() => () => clearTimeout(press.current?.timer), []);
  useEffect(() => {
    if (blocked) {
      clearTimeout(press.current?.timer);
      press.current = null;
      setSquare(null);
    }
  }, [blocked]);
  useEffect(() => {
    if (!square) return;
    const close = (e) => {
      if (e.key === "Escape") setSquare(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [square]);
  const available = !blocked && !changed && !moving;
  const open = (cell) => {
    const key = typeof cell === "string" ? cell : noteSquare(cell);
    if (available && noteTarget(state, key, viewer)) setSquare(key);
  };
  const cancel = () => {
    clearTimeout(press.current?.timer);
    press.current = null;
  };
  return {
    open,
    can: (cell) => available && noteTarget(state, noteSquare(cell), viewer),
    marker: (cell) =>
      available && notes[noteSquare(cell)] ? (
        <span className="private-note-mark" aria-label="自分だけの推理メモあり">
          ✎
        </span>
      ) : null,
    handlers: (cell) => ({
      onPointerDown: (e) => {
        cancel();
        swallow.current = false;
        if (
          e.button !== 0 ||
          !available ||
          !noteTarget(state, noteSquare(cell), viewer)
        )
          return;
        const x = e.clientX,
          y = e.clientY,
          target = e.currentTarget,
          pointerId = e.pointerId;
        press.current = {
          x,
          y,
          timer: setTimeout(() => {
            swallow.current = true;
            // 指を離したクリックで、新しく開いたダイアログを閉じさせない。
            try {
              target.setPointerCapture(pointerId);
            } catch {}
            open(cell);
          }, 500),
        };
      },
      onPointerMove: (e) => {
        if (
          press.current &&
          Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) >
            8
        )
          cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu: (e) => {
        if (available && noteTarget(state, noteSquare(cell), viewer)) {
          e.preventDefault();
          e.stopPropagation();
          cancel();
          open(cell);
        }
      },
      onClickCapture: (e) => {
        if (swallow.current) {
          e.preventDefault();
          e.stopPropagation();
          swallow.current = false;
        }
      },
    }),
    editor:
      square && available && noteTarget(state, square, viewer) ? (
        <NoteEditor
          key={square}
          square={square}
          size={state.boardSize}
          /* その駒の、**相手に見せてよい**行動記録だけを渡す。
             正体(rank・isKing)は渡さない(2026-09-28 本人の指示の仕組み) */
          history={visibleHistoryAt(state, square, viewer)}
          initial={notes[square]}
          onClose={() => setSquare(null)}
          onSave={(value) => {
            const note = cleanNote(value);
            setNotes((n) => {
              const out = { ...n };
              if (hasNote(note)) out[square] = note;
              else delete out[square];
              return out;
            });
            setSquare(null);
          }}
        />
      ) : null,
  };
}
/**
 * そのマスの駒の行動記録のうち、**この viewer に見せてよい行だけ**を返す。
 * sanitizeHistory を通すので、王位の継承など伏せる行は落ちる。
 * 駒の rank・isKing はここから先へ渡さない
 */
function visibleHistoryAt(state, square, viewer) {
  const [row, col] = square.split(",").map(Number);
  const piece = state.board?.[row]?.[col];
  if (!piece) return [];
  return sanitizeHistory(piece, viewer, false);
}

function NoteEditor({ square, size, history = [], initial, onSave, onClose }) {
  const [value, setValue] = useState(() => cleanNote(initial));
  const [row, col] = square.split(",").map(Number);
  // 見えている動きだけから、ありうる数字を機械的に絞る
  const deduced = useMemo(
    () => candidatesFromHistory(history, size),
    [history, size],
  );
  return (
    <div className="modal-overlay private-notes-overlay" onClick={onClose}>
      <section
        className="modal-panel private-notes-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="private-note-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3 id="private-note-title">
            {squareName(row, col, size)}の推理メモ
          </h3>
          <button className="btn btn-ghost" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="private-notes-scroll">
          <p className="hint">自分だけに見える予想です。</p>
          {/* 見えている動きから、ありうる数字を機械的に絞る(2026-09-28 本人の指示)。
              使うのは行動記録に出ている「どこからどこへ動いたか」だけで、
              伏せ札の正体は読んでいない */}
          <fieldset className="private-notes-deduced">
            <legend>動きから絞った候補</legend>
            {deduced.unmoved ? (
              <p className="hint">
                まだ動いていないので絞れません。動いたら、その動き方でここが狭まります。
              </p>
            ) : (
              <>
                <p className="private-notes-deduced-list">
                  {deduced.ranks.map((rank) => (
                    <span
                      key={rank}
                      className={
                        deduced.kingOnly.includes(rank)
                          ? "deduced-rank deduced-rank-king"
                          : "deduced-rank"
                      }
                    >
                      {rank}
                    </span>
                  ))}
                </p>
                <p className="hint">
                  {deduced.moves}手ぶんの動きから、{deduced.ranks.length}通りまで
                  絞れました。
                  {deduced.certain && " これで確定です。"}
                  {deduced.kingOnly.length > 0 &&
                    ` 金の数字(${deduced.kingOnly.join("・")})は、王でないとできない動きです。`}
                  {deduced.mustBeKing && " つまり、この駒は王です。"}
                </p>
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() =>
                    setValue((v) => ({ ...v, ranks: deduced.ranks }))
                  }
                >
                  この候補を下に写す
                </button>
              </>
            )}
          </fieldset>
          <fieldset>
            <legend>数字の候補</legend>
            <div className="private-notes-ranks">
              {RANKS.map((rank) => (
                <button
                  key={rank}
                  className="btn btn-ghost"
                  aria-pressed={value.ranks.includes(rank)}
                  onClick={() =>
                    setValue((v) => ({
                      ...v,
                      ranks: v.ranks.includes(rank)
                        ? v.ranks.filter((r) => r !== rank)
                        : [...v.ranks, rank],
                    }))
                  }
                >
                  {rank}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="private-notes-flags">
            {[
              ["king", "王かも"],
              ["counter", "道連れ注意"],
            ].map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={value[key]}
                  onChange={(e) =>
                    setValue((v) => ({ ...v, [key]: e.target.checked }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <label className="private-notes-text">
            ひとこと
            <input
              maxLength={40}
              value={value.text}
              onChange={(e) =>
                setValue((v) => ({ ...v, text: e.target.value }))
              }
              placeholder="例：縦に二マス動いた"
            />
          </label>
          <p className="hint">Aの入れ替え対象になったメモは解除されます。</p>
        </div>
        <footer>
          <button className="btn btn-ghost" onClick={() => onSave(null)}>
            消す
          </button>
          <button className="btn btn-primary" onClick={() => onSave(value)}>
            保存する
          </button>
        </footer>
      </section>
    </div>
  );
}
