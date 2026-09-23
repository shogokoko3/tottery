import { newlyEarned } from "./titles.js";

// 保存済みの新規獲得だけを並べる。画面やエリアが変わっても失わず、
// 起動・引き継ぎ時に所持済みの称号をもう一度流すことはしない。
let state = Object.freeze({ notices: Object.freeze([]), held: false });
let sequence = 0;
const holds = new Set();
const listeners = new Set();
export const getTitleNotices = () => state;
export function subscribeTitleNotices(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function update(notices = state.notices) {
  state = Object.freeze({
    notices: Object.freeze(notices),
    held: holds.size > 0,
  });
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      console.error("称号の獲得表示を更新できませんでした。", error);
    }
  }
}
export function publishTitleNotices(before, after) {
  const queued = new Set(state.notices.map((notice) => notice.titleId));
  const earned = newlyEarned(before, after).filter(
    (title) => !title.free && !queued.has(title.id),
  );
  if (!earned.length) return;
  update([
    ...state.notices,
    ...earned.map((title) =>
      Object.freeze({
        id: `title-${++sequence}`,
        titleId: title.id,
        name: title.name,
      }),
    ),
  ]);
}
export function dismissTitleNotice(id) {
  if (state.notices[0]?.id !== id) return false;
  update(state.notices.slice(1));
  return true;
}
export function clearTitleNotices() {
  if (state.notices.length) update([]);
}
// ガチャの正体公開・撃破・布陣演出が済むまで待つ。複数の演出が
// 重なっても、すべてが完了するまで称号名で結果を先に知らせない。
export function holdTitleNotices() {
  const token = Symbol();
  holds.add(token);
  if (!state.held) update();
  return () => {
    if (holds.delete(token) && !holds.size) update();
  };
}
