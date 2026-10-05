/**
 * ゲーム全体で、長押しによるブラウザの選択・コピー・画像の持ち上げを抑える。
 * body に出すダイアログも対象。入力欄の編集・貼り付けは許可する。
 * 伝播や pointer/touch イベントは止めず、駒の移動・推理メモ・スクロールを保つ。
 */
export function installNativeInteractionGuard(doc) {
  const prevent = (event) => {
    const target = event.target?.nodeType === 1
      ? event.target
      : event.target?.parentElement;
    if (target?.closest("input, textarea") || target?.isContentEditable) return;
    event.preventDefault();
  };
  for (const type of ["contextmenu", "selectstart", "dragstart"])
    doc.addEventListener(type, prevent, true);
}
