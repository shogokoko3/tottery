import { useId } from "react";
import artwork from "../../assets/ui/gem-ruby.png";

// 承認済み原画の宝石だけを表示する。背景・見本の数字は切り抜き領域の外。
export function GemIcon({ size = 24 }) {
  const clip = useId();
  return (
    <svg
      className="gem-icon"
      width={size * 0.54}
      height={size}
      viewBox="422 80 405 755"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clip}>
          <path d="M628 85 L823 269 L823 444 L809 466 L823 487 L823 645 L628 833 L426 647 L426 487 L439 465 L426 446 L426 268 Z" />
        </clipPath>
      </defs>
      <image
        href={artwork}
        x="0"
        y="0"
        width="1254"
        height="1254"
        clipPath={`url(#${clip})`}
      />
    </svg>
  );
}

export function GemAmount({ amount, size = 24 }) {
  return (
    <span className="gem-amount">
      <GemIcon size={size} />
      <b>{Number(amount || 0).toLocaleString("ja-JP")}</b>
      <span className="gem-unit">ジェム</span>
    </span>
  );
}
