/**
 * シリーズを選ぶ札とシート(2026-10-15 本人の決め「1」)。
 *
 * ふだんの画面には、いま選んでいるシリーズの札を1枚だけ置く(名前と小さな文字、右に「シリーズを選ぶ ▾」)。
 * 押すと「シリーズを選ぶ」のシートが下から開き、全シリーズが縦に並ぶ(スクロール。渡された順=新しい順)。
 * シリーズが何十個に増えても、ふだんの画面の場所は変わらない。
 * 所持・錬成・加工・バトルパスのシーズンで同じものを使う(横に流れる札のタブはやめた。増えると隠れて使いにくい)。
 *
 * items: [{ id, name, note?, art? }]
 *   note は小さな文字(「所持 5 / 13キャラ」「進行中」など)。art は行の小さな絵(省略可)
 */
import { useState } from "react";
import { SkinModal } from "./skin-modal.jsx";

export function SeriesSelect({
  items,
  value,
  onChange,
  label = "シリーズを選ぶ",
  hint = "シリーズを選ぶ",
  disabled = false,
  allowAll = false,
  allLabel = "全シリーズ",
  allNote = "",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const list = allowAll ? [{ id: "all", name: allLabel, note: allNote }, ...items] : items;
  const current = list.find((item) => item.id === value) || list[0] || null;
  const pick = (id) => {
    setOpen(false);
    if (id !== value) onChange(id);
  };
  return (
    <>
      <button
        type="button"
        className={`series-select${className ? ` ${className}` : ""}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="series-select-current">
          <span className="series-select-name">{current?.name || ""}</span>
          {current?.note && <small className="series-select-note">{current.note}</small>}
        </span>
        <span className="series-select-open">{hint} ▾</span>
      </button>
      {open && (
        <SkinModal label={label} onClose={() => setOpen(false)} className="series-select-overlay">
          <div className="skin-modal-head">
            <h2>{label}</h2>
            <button className="skin-close" aria-label={`${label}を閉じる`} onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          <div className="series-select-list" role="listbox" aria-label={label}>
            {list.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === value}
                className={`series-select-row${item.id === value ? " is-active" : ""}`}
                onClick={() => pick(item.id)}
              >
                {item.art ? (
                  <img className="series-select-art" src={item.art} alt="" />
                ) : (
                  <span className="series-select-art is-blank" aria-hidden="true" />
                )}
                <span className="series-select-text">
                  <span className="series-select-name">{item.name}</span>
                  {item.note && <small className="series-select-note">{item.note}</small>}
                </span>
                {item.id === value && (
                  <span className="series-select-mark" aria-hidden="true">
                    ◆
                  </span>
                )}
              </button>
            ))}
          </div>
        </SkinModal>
      )}
    </>
  );
}
