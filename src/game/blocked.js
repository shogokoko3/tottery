/**
 * 見たくない相手を隠す。
 *
 * App Store のガイドライン 1.2 は、利用者が作った文章を他人に見せるアプリに
 * 「不快な利用者をブロックする手段」を求めている。
 *
 * 置き場所は端末の中だけ。相手には何も伝わらないし、サーバーにも送らない
 * (「誰が誰をブロックしたか」を集めると、それ自体が扱いの難しい記録になる)。
 * 隠すのはランキングの行と、待ち合わせの相手。
 */

const KEY = "tottery.blocked.v1";

/** 隠した相手の一覧。[{id, name, at}] を新しい順で返す */
export function loadBlocked() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((b) => b && typeof b.id === "string" && b.id)
      .map((b) => ({
        id: b.id,
        name: typeof b.name === "string" ? b.name : "",
        at: Number(b.at) || 0,
      }))
      .sort((a, b) => b.at - a.at);
  } catch {
    // プライベートブラウズなどで読めないことがある
    return [];
  }
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 保存できなくても遊べる方を優先する
  }
}

/** 隠しているか */
export function isBlocked(id) {
  if (!id) return false;
  return loadBlocked().some((b) => b.id === id);
}

/** 隠す。すでに隠していれば何もしない */
export function block(id, name) {
  if (!id) return loadBlocked();
  const list = loadBlocked();
  if (list.some((b) => b.id === id)) return list;
  const next = [{ id, name: name || "", at: Date.now() }, ...list];
  save(next);
  return next;
}

/** 隠すのをやめる */
export function unblock(id) {
  const next = loadBlocked().filter((b) => b.id !== id);
  save(next);
  return next;
}

/** 隠した相手を一覧から除く。ランキングなどに掛ける */
export function withoutBlocked(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows || [];
  const hidden = new Set(loadBlocked().map((b) => b.id));
  if (!hidden.size) return rows;
  return rows.filter((r) => !hidden.has(r && r.id));
}

/** 全部やめる。記録を消すときに一緒に消す */
export function clearBlocked() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 消せなくても続ける
  }
}
