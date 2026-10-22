/**
 * シリーズを選ぶタブ(2026-10-15 本人の指示)。
 *
 * ふつうのタブではなく、この世界観(紺と金、明朝)に合わせた「札」の並び。選んだ札は金に灯り、下に◆の印。
 * 横に増えても流れる(今後シリーズが増えるため。2つ並びの釦ではもう並べきれない)。
 * ガチャの選択画面・所持・錬成・加工・バトルパスのシーズンで同じものを使う。
 *
 * items: [{ id, name, note? }]  note は札の下の小さな文字(「12キャラ」「進行中」など)
 */
import { useEffect, useRef } from "react";

export function SeriesTabs({
  items,
  value,
  onChange,
  label,
  disabled = false,
  allowAll = false,
  allLabel = "全シリーズ",
  className = "",
}) {
  const rail = useRef(null);
  const list = allowAll ? [{ id: "all", name: allLabel }, ...items] : items;
  // 選んだ札が隠れていたら、横だけ動かして見えるところへ(縦には動かさない)
  useEffect(() => {
    const r = rail.current;
    const el = r?.querySelector('[aria-selected="true"]');
    if (!r || !el || r.scrollWidth <= r.clientWidth) return;
    const box = el.getBoundingClientRect();
    const rb = r.getBoundingClientRect();
    if (box.left < rb.left || box.right > rb.right)
      r.scrollTo({ left: el.offsetLeft - (r.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [value]);
  return (
    <div className={`series-tabs${className ? ` ${className}` : ""}`} role="tablist" aria-label={label} ref={rail}>
      {list.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={`series-tab${value === item.id ? " is-active" : ""}${item.id === "all" ? " series-tab-all" : ""}`}
          disabled={disabled}
          onClick={() => value !== item.id && onChange(item.id)}
        >
          <span className="series-tab-name">{item.name}</span>
          {item.note && <small className="series-tab-note">{item.note}</small>}
        </button>
      ))}
    </div>
  );
}
