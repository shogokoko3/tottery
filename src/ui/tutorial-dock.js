/**
 * チュートリアルの説明の札(前面に出すもの)を、盤を隠さない場所に置く。
 *
 * 盤の右に読める幅が残っていれば右に、無ければ盤の下に。どちらも入らない
 * (横向きの小さな画面)ときは null を返し、従来どおり盤の上に重ねる。
 * 札の中身が入りきらない高さなら、札の中でスクロールさせる(maxHeight)。
 *
 * rect は盤(.board-frame)の getBoundingClientRect()、w/h は画面の幅と高さ。
 * 純粋な関数にしてあるので tools/check-tutorial-opening.mjs で数字を見られる。
 */
export const DOCK_MIN_RIGHT = 340; // 右に置くのに要る幅(札の最小幅 + 余白)
export const DOCK_MIN_BELOW = 220; // 下に置くのに要る高さ(見出し+一覧の1行+ボタン)
const GAP = 16;
const MAX_W = 560;

export function dockSheet(rect, w, h) {
  if (!rect || !(w > 0) || !(h > 0)) return null;
  const right = w - rect.right;
  if (right >= DOCK_MIN_RIGHT) {
    const top = Math.max(8, rect.top);
    return {
      side: "right",
      style: {
        left: rect.right + GAP,
        top,
        width: Math.min(MAX_W, right - GAP * 2),
        maxHeight: h - top - 12,
      },
    };
  }
  const below = h - rect.bottom;
  if (below >= DOCK_MIN_BELOW) {
    const top = rect.bottom + 8;
    const width = Math.min(MAX_W, w - 20);
    return {
      side: "below",
      style: {
        left: Math.max(10, (w - width) / 2),
        top,
        width,
        maxHeight: h - top - 8,
      },
    };
  }
  return null;
}
