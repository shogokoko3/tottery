// 表示のためだけの通知列。経験値の保存とは独立し、読み込み時には復元しない。
let notices = Object.freeze([]);
let sequence = 0;
const listeners = new Set();

export const getXpNotices = () => notices;

export function subscribeXpNotices(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(next) {
  notices = Object.freeze(next);
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      // 表示の失敗で、保存済みの報酬受け取りを失敗扱いにしない。
      console.error("経験値の表示を更新できませんでした。", error);
    }
  }
}

export function publishXpNotice({
  beforeXp,
  afterXp,
  source = "reward",
  ready = true,
} = {}) {
  if (
    !Number.isFinite(beforeXp) ||
    !Number.isFinite(afterXp) ||
    beforeXp < 0 ||
    afterXp <= beforeXp ||
    source === "gacha"
  )
    return null;
  const origin = typeof source === "string" && source ? source : "reward";
  const canShow = ready !== false;
  const last = notices[notices.length - 1];
  // まとめ受け取りは、まだ表示を始めていない末尾にだけ足す。
  // 保留中の対局結果や、表示中のゲージを追い越したり書き替えたりしない。
  if (canShow && last?.ready && !last.started && last.afterXp === beforeXp) {
    update([
      ...notices.slice(0, -1),
      Object.freeze({
        ...last,
        afterXp,
        source: last.source === origin ? origin : "reward",
      }),
    ]);
    return last.id;
  }
  const id = `xp-${++sequence}`;
  update([
    ...notices,
    Object.freeze({
      id,
      beforeXp,
      afterXp,
      source: origin,
      ready: canShow,
      started: false,
    }),
  ]);
  return id;
}

export function startXpNotice(id) {
  const first = notices[0];
  if (!first || first.id !== id || !first.ready || first.started) return false;
  update([Object.freeze({ ...first, started: true }), ...notices.slice(1)]);
  return true;
}

export function releaseXpNotice(id) {
  const index = notices.findIndex((notice) => notice.id === id);
  if (index < 0 || notices[index].ready) return false;
  // 既発行IDは変えない。後続の通知と統合せず、元の順序で表示可能にする。
  update(
    notices.map((notice, i) =>
      i === index ? Object.freeze({ ...notice, ready: true }) : notice,
    ),
  );
  return true;
}

export function dismissXpNotice(id) {
  const index = notices.findIndex((notice) => notice.id === id);
  if (index < 0) return false;
  update(notices.filter((notice) => notice.id !== id));
  return true;
}
