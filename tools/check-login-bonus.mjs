/** ログインボーナスの検査。ひと回りの進み方と、1日1回だけ配ること */
import {
  CYCLE,
  TICKETS,
  cycleOf,
  cycleRows,
  dayOf,
  isPending,
  rewardOf,
  ticketsOf,
} from "../src/game/login-bonus.js";

let ok = 0,
  fail = 0;
const t = (name, cond) => {
  if (cond) {
    ok++;
    console.log("  ok  ", name);
  } else {
    fail++;
    console.log("  NG  ", name);
  }
};
const section = (s) => console.log(s);

section("ひと回り");
t("7日で1周", CYCLE === 7 && TICKETS.length === 7);
t("合計10枚 = 10連1回ぶん", TICKETS.reduce((a, b) => a + b, 0) === 10);
t("7日目が一番厚い", Math.max(...TICKETS) === TICKETS[6]);
t("0枚の日がない", TICKETS.every((n) => n >= 1));

section("何日目か");
t("まだ受け取っていなければ1日目", dayOf(0) === 1);
t("3回受け取っていれば4日目", dayOf(3) === 4);
t("6回で7日目", dayOf(6) === 7);
t("7回で次の周の1日目", dayOf(7) === 1);
t("13回で7日目", dayOf(13) === 7);
t("壊れた値でも1日目に落ちる", dayOf(null) === 1 && dayOf(-5) === 1);
t("周の数", cycleOf(0) === 1 && cycleOf(6) === 1 && cycleOf(7) === 2);

section("その日の褒美");
t("1日目は1枚", ticketsOf(1) === 1);
t("4日目は2枚", ticketsOf(4) === 2);
t("7日目は3枚", ticketsOf(7) === 3);
t("枠の外は0枚", ticketsOf(0) === 0 && ticketsOf(8) === 0);
t(
  "手紙やミッションと同じ形",
  JSON.stringify(rewardOf(7)) === JSON.stringify({ type: "ticket", amount: 3 }),
);

section("札に出す7マス");
{
  const rows = cycleRows(3);
  t("7マス出る", rows.length === 7);
  t("今日は4日目だけ光る", rows.filter((r) => r.today).length === 1 && rows[3].today);
  t("3日目までは受け取り済み", rows.slice(0, 3).every((r) => r.taken));
  t("5日目以降はまだ", rows.slice(4).every((r) => !r.taken && !r.today));
  const first = cycleRows(0);
  t("1日目は受け取り済みが無い", first.every((r) => !r.taken) && first[0].today);
  const last = cycleRows(6);
  t("7日目まで来ると6マスが済み", last.filter((r) => r.taken).length === 6 && last[6].today);
}

section("1日1回だけ");
{
  const p = { bonusDay: null, bonusTaken: 0 };
  t("まだ一度も受け取っていない人には配る", isPending(p, "2026-09-04"));
  t("今日ぶんを受け取った人には配らない", !isPending({ ...p, bonusDay: "2026-09-04" }, "2026-09-04"));
  t("日が変われば また配る", isPending({ ...p, bonusDay: "2026-09-03" }, "2026-09-04"));
  t("空の相手でも落ちない", !isPending(null, "2026-09-04") && !isPending(p, null));
}

section("休んでも巻き戻らない");
{
  // 3日受け取って1週間空けた人。4日目から続けられる
  const taken = 3;
  t("空けても続きから", dayOf(taken) === 4);
  t("振り出しに戻らない", dayOf(taken) !== 1);
}

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
