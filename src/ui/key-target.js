/**
 * window で受けるキーが「自分宛て」かどうか(2026-09-30)。
 *
 * 語り(prologue)や手引き(primer)は window に keydown を付けて Enter・矢印で送る。
 * その上に設定(名前の入力欄)や早見表が開いていると、そこへ打った Enter・空白まで
 * 拾って下の画面を進めてしまっていた。入力欄・釦・重なった別の画面に向いたキーは
 * 取らない、という判定をここに一つ置く。
 */
const TAKEN = "input, textarea, select, button, a, [contenteditable], .modal-overlay";

/** 別のものに向いたキーなら true(呼ぶ側はそのまま return する) */
export function typing(e) {
  const t = e?.target;
  if (!t || t === document.body || t === document.documentElement) return false;
  return typeof t.closest === "function" && !!t.closest(TAKEN);
}
