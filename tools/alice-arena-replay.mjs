/**
 * alice-arena.mjs の1局を再生して、布陣と手の流れを読む(負けた局の振り返り用)。
 *   node tools/alice-arena-replay.mjs <seed> <seat> [mode] [testedKing] [baseKing]
 *     mode: series(既定) | mirror | alice-king | hero-king | alice-mirror-king
 *     seat: 測る側の席(0 か 1)
 *   PROFILE=... で CPU の知恵を切り替えられる(arena と同じ)
 */
import { play, ALICE_FOIL, HERO_FOIL } from "./alice-arena.mjs";

const [seedArg, seatArg, mode = "series", testedKing = null, baseKing = null] = process.argv.slice(2);
const seed = Number(seedArg), seat = Number(seatArg || 0);
const tested = mode === "hero-king" ? HERO_FOIL : ALICE_FOIL;
const base = mode === "series" || mode === "alice-king" ? HERO_FOIL : mode === "hero-king" ? ALICE_FOIL : ALICE_FOIL;
const loadouts = seat === 0 ? [tested, base] : [base, tested];
const kings = seat === 0 ? [testedKing, baseKing] : [baseKing, testedKing];
const r = play(seed, kings, loadouts, { full: true });
const s = r.state;
const SUIT = { heart: "♥", diamond: "♦", spade: "♠", club: "♣" };
// 記録の色の名前は reducer の PLAYER_META と同じ(席0=赤、席1=青)
const name = (i) => (i === 0 ? "赤" : "青");
console.log(`seed ${seed} / 測る側=席${seat}(${name(seat)}) / 王 ${r.kings[0]}(${r.areas[0]}) 対 ${r.kings[1]}(${r.areas[1]}) / 勝ち: ${r.winner == null ? "未決着" : name(r.winner)} / ${r.turns}手`);
console.log(`軍 赤: ${r.army0}\n軍 青: ${r.army1}`);
// 布陣(開始時)。pieces の初期位置は history に無いので、残っている駒の今の位置と倒れた駒を出す
for (const i of [0, 1]) {
  const ps = Object.values(s.pieces).filter((p) => p.owner === i);
  console.log(`${name(i)}の駒: ` + ps.map((p) => `${p.isKing ? "王" : ""}${p.rank}${SUIT[p.suit] || ""}${p.tea ? "☕" : ""}${p.alive ? `@${String.fromCharCode(97 + p.col)}${p.row + 1}` : "†"}${p.revealed ? "(公開)" : ""}`).join(" "));
}
console.log("\n--- 記録 ---");
for (const line of r.log) console.log("  " + line);
