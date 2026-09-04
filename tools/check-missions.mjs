/**
 * 通常ミッションと、その土台(ガチャチケット・使った日数・
 * チュートリアルの初回だけ経験値)を検査する。通信も画面も使わない。
 */
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};

const { KINDS, MISSIONS, STATS, claimableCount, listMissions, statusOf } =
  await import("../src/game/missions.js");
const { loadProfile, markMissionClaimed, recordGame, saveName, touchDay } =
  await import("../src/game/profile.js");
const { addTickets, grantSkin, normalize, spendTickets } = await import(
  "../src/skins/collection.js"
);
const { findTitle } = await import("../src/game/titles.js");
const { findIcon, ICONS } = await import("../src/game/icons.js");
const { byId: skinById } = await import("../src/skins/catalog.js");

let ok = 0;
const fails = [];
function is(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    ok++;
    console.log(`  ok   ${label}`);
  } else {
    fails.push(label);
    console.log(
      `  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`,
    );
  }
}

console.log("台帳");
is("id が重複しない", new Set(MISSIONS.map((m) => m.id)).size, MISSIONS.length);
is("条件は知っている種類だけ", MISSIONS.every((m) => STATS[m.kind] && KINDS[m.kind]), true);
is("目標は1以上の整数", MISSIONS.every((m) => Number.isInteger(m.goal) && m.goal > 0), true);
is("指示の3種がそろっている", Object.keys(KINDS).sort(), ["battles", "days", "level"]);
// 指示された組み合わせ: 使用頻度→称号/スキン、レベル→チケット/アイコン、対戦回数→チケット
const kinds = (k) => new Set(MISSIONS.filter((m) => m.kind === k).map((m) => m.reward.type));
is("使用頻度の褒美は称号かスキン", [...kinds("days")].sort(), ["skin", "title"]);
is("レベルの褒美はチケットかアイコン", [...kinds("level")].sort(), ["icon", "ticket"]);
is("対戦回数の褒美はチケット", [...kinds("battles")], ["ticket"]);
// 褒美の指し先が実在するか
const missing = MISSIONS.filter((m) => {
  const r = m.reward;
  if (r.type === "ticket") return !Number.isInteger(r.amount) || r.amount <= 0;
  if (r.type === "title") return !findTitle(r.id);
  if (r.type === "icon") return !ICONS.some((i) => i.id === r.id);
  if (r.type === "skin") return !skinById(r.id);
  return true;
}).map((m) => m.id);
is("褒美の指し先が実在する", missing, []);
// 称号とアイコンの褒美は、条件で勝手に開かないもの(受け取る意味があるもの)
is(
  "褒美の称号は自動で開かない",
  MISSIONS.filter((m) => m.reward.type === "title").every((m) => {
    const t = findTitle(m.reward.id);
    return t && !t.free && !t.unlocked;
  }),
  true,
);
is(
  "褒美のアイコンは最初から使えるものではない",
  MISSIONS.filter((m) => m.reward.type === "icon").every((m) => !findIcon(m.reward.id).free),
  true,
);

console.log("進み具合");
saveName("たろう");
const p = { ...loadProfile(), days: 5, battles: 12, missions: ["days-3"] };
const s3 = statusOf(MISSIONS.find((m) => m.id === "days-3"), p);
is("届いていれば done", [s3.done, s3.claimed], [true, true]);
const s10 = statusOf(MISSIONS.find((m) => m.id === "days-10"), p);
is("途中なら done でない", [s10.done, s10.now, s10.goal], [false, 5, 10]);
is("帯は0〜1に収まる", listMissions(p).every((m) => m.ratio >= 0 && m.ratio <= 1), true);
is("目標を越えても表示は目標まで", statusOf(MISSIONS.find((m) => m.id === "battles-10"), p).now, 10);
is("受け取れるものが先に並ぶ", listMissions(p)[0].done && !listMissions(p)[0].claimed, true);
is("受け取り済みは最後", listMissions(p)[listMissions(p).length - 1].claimed, true);
is("受け取れる数", claimableCount(p), listMissions(p).filter((m) => m.done && !m.claimed).length);

console.log("受け取りの控え");
is("控える前", loadProfile().missions, []);
markMissionClaimed("battles-10");
is("控えたあと", loadProfile().missions, ["battles-10"]);
markMissionClaimed("battles-10");
is("二度控えても1つ", loadProfile().missions, ["battles-10"]);

console.log("ガチャチケット");
let c = normalize(null);
is("最初は0枚", c.tickets, 0);
c = addTickets(c, 3);
is("もらうと増える", c.tickets, 3);
c = spendTickets(c, 1);
is("使うと減る", c.tickets, 2);
c = spendTickets(c, 99);
is("足りなければ減らない", c.tickets, 2);
c = addTickets(c, -5);
is("負の値では増えない", c.tickets, 2);
is("読み直しても残る", normalize(c).tickets, 2);
c = grantSkin(c, "pirate-male");
is("褒美のスキンが入る", c.owned["pirate-male"], 1);
c = grantSkin(c, "no-such");
is("知らないスキンは無視", Object.keys(c.owned), ["pirate-male"]);

console.log("使った日数");
store["tottery.account.v1"] = JSON.stringify({ id: "p1", name: "たろう" });
let d = touchDay(Date.parse("2026-09-04T10:00:00"));
is("はじめて開いた日", [d.days, d.streak], [1, 1]);
d = touchDay(Date.parse("2026-09-04T23:00:00"));
is("同じ日は数えない", [d.days, d.streak], [1, 1]);
d = touchDay(Date.parse("2026-09-05T09:00:00"));
is("翌日は続く", [d.days, d.streak], [2, 2]);
d = touchDay(Date.parse("2026-09-08T09:00:00"));
is("飛んだら続きは切れる", [d.days, d.streak], [3, 1]);

console.log("チュートリアルの経験値は初回だけ");
store["tottery.account.v1"] = JSON.stringify({ id: "p2", name: "はなこ" });
let r = recordGame(true, { xp: 100, tutorial: true, tutorialId: 1 });
is("初回はもらえる", [r.gained, r.firstClear, r.xp], [100, true, 100]);
r = recordGame(true, { xp: 100, tutorial: true, tutorialId: 1 });
is("2回目はもらえない", [r.gained, r.firstClear, r.xp], [0, false, 100]);
r = recordGame(true, { xp: 300, tutorial: true, tutorialId: 2 });
is("別の話は初回なのでもらえる", [r.gained, r.xp], [300, 400]);
is("クリア済みが残る", loadProfile().cleared, [1, 2]);
is("チュートリアルは対戦の数に入れない", loadProfile().battles, 0);
r = recordGame(true);
is("対戦は毎回もらえる", [r.gained, r.battles], [50, 1]);

console.log(`\n${ok} ok / ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
