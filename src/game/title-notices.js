import { newlyEarned } from "./titles.js";

// 保存済みの新規獲得だけを並べる。画面やエリアが変わっても失わず、
// 起動・引き継ぎ時に所持済みの称号をもう一度流すことはしない。
// left は、いま出してよい残りの件数(数えていなければ null)。0 のあいだは held と同じく出さない
let state = Object.freeze({ notices: Object.freeze([]), held: false, left: null });
let sequence = 0;
const holds = new Set();
// 件数の決まり(limitTitleNotices)。鍵ごとに、あと何件出してよいか
const limits = new Map();
const listeners = new Set();
const leftOf = () => (limits.size ? Math.min(...limits.values()) : null);
export const getTitleNotices = () => state;
export function subscribeTitleNotices(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function update(notices = state.notices) {
  const left = leftOf();
  state = Object.freeze({
    notices: Object.freeze(notices),
    held: holds.size > 0 || left === 0,
    left,
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
  // 出した1件を、いまの件数の決まりから引く
  for (const [token, left] of limits) limits.set(token, Math.max(0, left - 1));
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
// 出してよい件数を決める(2026-10-05 見直し)。n 件を閉じたら、残りは解除するまで held と同じく待たせる。
// 導入を終えたあと、ホームを開くまで1件だけにするのに使う(src/game/intro.js の introTitleQuota)
export function limitTitleNotices(n) {
  const token = Symbol();
  limits.set(token, Math.max(0, Math.floor(Number(n) || 0)));
  update();
  return () => {
    if (limits.delete(token)) update();
  };
}
