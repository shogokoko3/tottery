const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const ease = (n) => {
  n = clamp(n, 0, 1);
  return n * n * (3 - 2 * n);
};
const mix = (a, b, t) => a + (b - a) * t;

/** 盤の位置ではなく画面中央へ。見出し・上部バー・確認欄の間に収める。 */
export function captureLayout({
  width,
  height,
  headerBottom,
  footerTop,
  titleHeight,
}) {
  const gap = 16;
  const top = Math.max(0, headerBottom) + gap;
  const bottom = Math.min(height, footerTop) - gap;
  const zoom = Math.max(
    0.1,
    Math.min(
      1.16,
      width / 380,
      (bottom - top - titleHeight - gap) / (101 * 1.46),
    ),
  );
  const halfCard = (101 * 1.46 * zoom) / 2;
  const focal = {
    x: width / 2,
    y: clamp(height / 2, top + titleHeight + gap + halfCard, bottom - halfCard),
  };
  return { focal, zoom, titleY: focal.y - halfCard - gap - titleHeight };
}

/** 裏面だけを中央へ運ぶ。正体や王かどうかは参照しない。 */
export function captureBackPose(t, q, from, focal, base, zoom) {
  const travel = q.reduced
    ? Number(t >= q.ready)
    : ease((t - q.lift) / Math.max(1, q.ready - q.lift));
  return {
    x: mix(from.x, focal.x, travel),
    // 通常演出の裏面は描画側で28px浮き上がるので、その分を補う。
    y: mix(from.y, focal.y + (q.reduced ? 0 : 28 * zoom), travel),
    scale: mix(base, zoom, travel),
  };
}
