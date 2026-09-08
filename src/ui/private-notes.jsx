import { useEffect, useRef, useState } from "react";
import { RANKS } from "../game/constants.js";
import { squareName } from "../game/board.js";
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
function NoteEditor({ square, size, initial, onSave, onClose }) {
  const [value, setValue] = useState(() => cleanNote(initial));
  const [row, col] = square.split(",").map(Number);
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
