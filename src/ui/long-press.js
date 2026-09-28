/**
 * 長押しの受け口。
 *
 * 推理メモ(src/ui/private-notes.jsx)で使っていた作りを、ほかの画面でも
 * 同じ手触りで使えるように切り出した(2026-09-28 本人の指示
 * 「フォイル加工のイラストを長押しすると、スキン画面と同じフォイルの画面へ」)。
 *
 * 気をつけているところ:
 *  - **指が動いたらやめる。** 一覧を送っているだけなのに開くと、画面が使えなくなる
 *  - **離したときのクリックを飲み込む。** 長押しで開いたあと、指を離したクリックが
 *    そのまま下の釦に届くと、開いた画面がすぐ閉じたり二重に開いたりする
 *  - 右クリック(onContextMenu)でも同じところへ行く。パソコンで触るときのため
 *  - 押した指だけを追う(setPointerCapture)。ほかの指の動きで取り消さない
 */
import { useCallback, useEffect, useRef } from "react";

/** 長押しと見なすまでの時間(ミリ秒)。推理メモと同じ手触りにする */
export const LONG_PRESS_MS = 500;
/** これだけ動いたら「送っている」と見なしてやめる(px) */
const SLOP = 8;

/**
 * onLongPress を呼ぶハンドラの束を返す。
 *
 *   const press = useLongPress(() => open(skin));
 *   <button {...press}>…</button>
 *
 * enabled を false にすると何もしない(ふつうのタップだけが効く)
 */
export function useLongPress(onLongPress, { enabled = true, ms = LONG_PRESS_MS } = {}) {
  const press = useRef(null);
  const swallow = useRef(false);
  const fn = useRef(onLongPress);
  fn.current = onLongPress;

  const cancel = useCallback(() => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  }, []);
  // 画面から消えるときに、待っている時計を残さない
  useEffect(() => cancel, [cancel]);

  if (!enabled) return {};
  return {
    onPointerDown: (e) => {
      cancel();
      swallow.current = false;
      if (e.button !== 0) return;
      const target = e.currentTarget;
      const pointerId = e.pointerId;
      press.current = {
        x: e.clientX,
        y: e.clientY,
        timer: setTimeout(() => {
          swallow.current = true;
          // 指を離したクリックで、開いた画面をすぐ閉じさせない
          try {
            target.setPointerCapture(pointerId);
          } catch {
            /* 受け取れなくても、飲み込みの印は立っている */
          }
          press.current = null;
          fn.current?.();
        }, ms),
      };
    },
    onPointerMove: (e) => {
      if (
        press.current &&
        Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > SLOP
      )
        cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e) => {
      e.preventDefault();
      e.stopPropagation();
      cancel();
      fn.current?.();
    },
    onClickCapture: (e) => {
      if (swallow.current) {
        e.preventDefault();
        e.stopPropagation();
        swallow.current = false;
      }
    },
  };
}
