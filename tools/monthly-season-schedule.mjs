/**
 * 検査用: 以前の月間シーズン(毎月1日 5:00 区切り、id "2026-09")と同じ表。
 * 2026-11-11 にレート戦のシーズンを決まった日時の表(season.js の RATED_SEASONS)へ替えたが、
 * レート・連勝・報酬・Bot 戦などの検査は 2026 年 9 月の日付で書かれているので、この表を Ledger に渡して使う
 */
const JST5 = 4 * 3600000;
export const MONTHLY_TEST_SCHEDULE = Object.freeze(
  Array.from({ length: 48 }, (_, i) => {
    const y = 2026 + Math.floor((i + 6) / 12), m = (i + 6) % 12; // 2026-07 から
    return Object.freeze({
      id: `${y}-${String(m + 1).padStart(2, "0")}`,
      start: Date.UTC(y, m, 1) - JST5,
      end: Date.UTC(y, m + 1, 1) - JST5,
    });
  }),
);
export const MONTHLY = { schedule: MONTHLY_TEST_SCHEDULE };
