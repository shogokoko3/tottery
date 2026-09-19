/**
 * 何枚ぶん実行するかを選ぶ小さな部品。確認の一段の中だけで使う
 * (まとめ錬成・フォイルの一括分解。本人の指示 2026-09-19)。
 *
 * 選ぶ→確認→確定の二段は崩さない。ここは「確認」の中で枚数を決めるところで、
 * 押しただけでは何も起きない。上限(max)は呼ぶ側が計算して渡す。
 */
export function AmountPicker({
  value,
  max,
  unit = "枚",
  working = false,
  onChange,
}) {
  const set = (n) => onChange(Math.max(1, Math.min(max, n)));
  return (
    <div className="amount-picker">
      <button
        className="btn btn-ghost amount-step"
        disabled={working || value <= 1}
        onClick={() => set(value - 1)}
        aria-label="1つ減らす"
      >
        −
      </button>
      <b aria-live="polite">
        {value}
        {unit}
      </b>
      <button
        className="btn btn-ghost amount-step"
        disabled={working || value >= max}
        onClick={() => set(value + 1)}
        aria-label="1つ増やす"
      >
        ＋
      </button>
      <button
        className="btn btn-ghost btn-small amount-max"
        disabled={working || value >= max}
        onClick={() => set(max)}
      >
        最大（{max}
        {unit}）
      </button>
    </div>
  );
}
