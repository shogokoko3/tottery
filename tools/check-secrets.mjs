/**
 * シークレットミッションを検査する。
 *
 * いちばん大事なのは「書いてある確率が本当か」。画面に「約2600局に1回」と
 * 出す以上、当てずっぽうを書いてはいけない。実際の配り方を回して数え、
 * 書いてある値と桁が合っているかを見る。
 */
import { SECRETS, chanceLabel, listSecrets } from "../src/game/secrets.js";
import { canFillBoard } from "../src/game/reducer.js";
import { buildDeck, shuffle, totalSlots } from "../src/game/board.js";
import { TITLES } from "../src/game/titles.js";

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

console.log("台帳の形");
is(
  "id が重なっていない",
  new Set(SECRETS.map((s) => s.id)).size,
  SECRETS.length,
);
for (const s of SECRETS) {
  is(
    `${s.id}: 名前と条件と確率がそろっている`,
    !!(s.name && s.how && s.chance > 0 && s.chance < 1),
    true,
  );
  is(
    `${s.id}: 褒美の称号が台帳にある`,
    !!TITLES.find((t) => t.id === s.reward.id),
    true,
  );
}

console.log("\n言い方");
is("2600に丸まる", chanceLabel(0.00038), "約 2,600 局に1回 (0.038%)");

console.log("\n達成したものだけが出る");
is("何も達成していなければ0件", listSecrets({ secrets: [] }).found.length, 0);
is("伏せている数が合う", listSecrets({ secrets: [] }).hidden, SECRETS.length);
is("達成すると出る", listSecrets({ secrets: ["court-heavy"] }).found.length, 1);

console.log("\n書いてある確率が実測と合うか");
{
  // 「9×9で手札が絵札に偏って並べきれない」を実際に数える
  const N = Number(process.env.SECRET_N || 120000);
  const slots = totalSlots(9);
  let hit = 0;
  for (let i = 0; i < N; i++) {
    const d = shuffle(buildDeck(null));
    if (
      !canFillBoard(d.slice(0, 13), slots) ||
      !canFillBoard(d.slice(13, 26), slots)
    )
      hit++;
  }
  const measured = hit / N;
  const written = SECRETS.find((s) => s.id === "court-heavy").chance;
  console.log(
    `       実測 ${(measured * 100).toFixed(4)}% / 書いてある値 ${(written * 100).toFixed(4)}% (${N.toLocaleString()}回)`,
  );
  // 桁が合っていればよい(実測はぶれる)。2倍以内に収まること
  is(
    "書いてある確率が実測の2倍以内",
    measured > 0 && written / measured < 2 && measured / written < 2,
    true,
  );
}

console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
