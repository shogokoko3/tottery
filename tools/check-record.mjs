/**
 * 戦績(対戦だけの数)を確かめる。
 *
 * チュートリアルは plays/wins(全体。称号などが使う)には数えるが、
 * 戦績に出す battles/battleWins/battleDraws には数えない。
 * 古い保存(battleWins を持たない)は全体の数から見積もって引き継ぐ。
 * あわせて、エリア(フォイル)で手に入る紋章アイコンに foil の印が付いているかも見る。
 * 通信はしない。
 */
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const { loadProfile, recordGame, saveName } = await import("../src/game/profile.js");
const { ICONS } = await import("../src/game/icons.js");
const { FORMATION_EMBLEMS } = await import("../src/game/formation-honors.js");

let ok = 0; const fails = [];
const is = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { ok++; console.log(`  ok   ${label}`); }
  else { fails.push(label); console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); }
};
const reset = () => { for (const k of Object.keys(store)) delete store[k]; };
const pick = (p) => ({ plays: p.plays, wins: p.wins, draws: p.draws, battles: p.battles, battleWins: p.battleWins, battleDraws: p.battleDraws });

console.log("戦績はチュートリアルを数えない");
reset();
recordGame(true, { tutorial: true, tutorialId: "ep1", xp: 100 });
is("チュートリアルで勝っても対戦の数は増えない(全体の数は増える)",
   pick(loadProfile()), { plays: 1, wins: 1, draws: 0, battles: 0, battleWins: 0, battleDraws: 0 });
recordGame(true, {});
is("対戦で勝つと battles と battleWins が増える",
   pick(loadProfile()), { plays: 2, wins: 2, draws: 0, battles: 1, battleWins: 1, battleDraws: 0 });
recordGame(null, {});
is("対戦の引き分けは battleDraws に入る",
   pick(loadProfile()), { plays: 3, wins: 2, draws: 1, battles: 2, battleWins: 1, battleDraws: 1 });
recordGame(false, {});
is("対戦で負けると battles だけ増える",
   pick(loadProfile()), { plays: 4, wins: 2, draws: 1, battles: 3, battleWins: 1, battleDraws: 1 });
recordGame(false, { tutorial: true });
is("チュートリアルで負けても対戦の数は動かない",
   pick(loadProfile()), { plays: 5, wins: 2, draws: 1, battles: 3, battleWins: 1, battleDraws: 1 });
recordGame(null, { tutorial: true });
is("チュートリアルの引き分けも対戦の引き分けに入らない",
   pick(loadProfile()), { plays: 6, wins: 2, draws: 2, battles: 3, battleWins: 1, battleDraws: 1 });

console.log("\n古い保存の引き継ぎ(battleWins を持たない)");
// 保存の鍵は名前を保存して見つける
reset(); saveName("え");
const key = Object.keys(store)[0];
const legacy = (o) => { store[key] = JSON.stringify(o); return pick(loadProfile()); };
is("対戦の数を超えない範囲で見積もる(min(wins,battles))",
   legacy({ name: "え", plays: 10, battles: 6, wins: 8, draws: 3 }),
   { plays: 10, wins: 8, draws: 3, battles: 6, battleWins: 6, battleDraws: 3 });
is("battles も無い古い保存は plays を対戦の数として引き継ぐ",
   legacy({ name: "え", plays: 10, wins: 8, draws: 3 }),
   { plays: 10, wins: 8, draws: 3, battles: 10, battleWins: 8, battleDraws: 3 });
is("battleWins を持つ保存はそのまま使う(見積もらない)",
   legacy({ name: "え", plays: 10, battles: 6, wins: 8, draws: 3, battleWins: 2, battleDraws: 1 }),
   { plays: 10, wins: 8, draws: 3, battles: 6, battleWins: 2, battleDraws: 1 });
is("壊れた値は 0 に倒す",
   legacy({ name: "え", plays: 3, battles: 3, wins: 1, draws: 0, battleWins: -5, battleDraws: "x" }).battleWins,
   0);

console.log("\nエリア(フォイル)で手に入るアイコンの印");
const emblemIds = new Set(FORMATION_EMBLEMS.map((e) => e.id));
is("紋章アイコンは全部 foil の印を持つ",
   ICONS.filter((i) => emblemIds.has(i.id)).every((i) => i.foil === true), true);
is("最初から使えるアイコンとミッションのアイコンには foil の印が無い",
   ICONS.filter((i) => !emblemIds.has(i.id)).some((i) => i.foil), false);
is("紋章アイコンは7種ある", ICONS.filter((i) => i.foil).length, 7);

console.log(`\n${ok} 件 ok / ${fails.length} 件 NG`);
process.exit(fails.length ? 1 : 0);
