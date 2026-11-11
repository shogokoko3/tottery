/**
 * 何枚ぶん実行するかを選ぶ小さな部品。確認の一段の中だけで使う
 * (まとめ錬成・フォイルの一括分解。本人の指示 2026-09-19)。
 *
 * 選ぶ→確認→確定の二段は崩さない。ここは「確認」の中で枚数を決めるところで、
 * 押しただけでは何も起きない。上限(max)は呼ぶ側が計算して渡す。
 */
import { L } from "../i18n/index.js";

export function AmountPicker({
  value,
  max,
  unit = null,
  working = false,
  onChange,
}) {
  const set = (n) => onChange(Math.max(1, Math.min(max, n)));
  const amount = (n) => (unit == null ? L("{n}枚", { n }) : `${n}${unit}`);
  return (
    <div className="amount-picker">
      <button
        className="btn btn-ghost amount-step"
        disabled={working || value <= 1}
        onClick={() => set(value - 1)}
        aria-label={L("1つ減らす")}
      >
        −
      </button>
      <b aria-live="polite">{amount(value)}</b>
      <button
        className="btn btn-ghost amount-step"
        disabled={working || value >= max}
        onClick={() => set(value + 1)}
        aria-label={L("1つ増やす")}
      >
        {L("＋")}
      </button>
      <button
        className="btn btn-ghost btn-small amount-max"
        disabled={working || value >= max}
        onClick={() => set(max)}
      >
        {L("最大（{n}）", { n: amount(max) })}
      </button>
    </div>
  );
}
