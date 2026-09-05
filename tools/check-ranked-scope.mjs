/**
 * 持ち点(とランキング)に数える対局の範囲を検査する。
 *
 * 数えるのは **9×9のオンライン対戦だけ**。
 *   ・5×5は短期戦で運の割合が大きく、同じ物差しに載せると
 *     持ち点が実力を表さなくなる
 *   ・CPU戦とチュートリアルは相手の強さが決まらない
 *
 * 画面の作り(game.jsx)は Node から動かせないので、そこは中身を読んで
 * 見張る。持ち点そのものの動き(recordGame)は実際に走らせて確かめる。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { recordGame, resetAccount, saveName } from "../src/game/profile.js";
import { START_RATING } from "../src/game/rating.js";

const here = dirname(fileURLToPath(import.meta.url));
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

/* localStorage の代わり */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

console.log("持ち点が動く条件");
{
  const fresh = () => {
    mem.clear();
    saveName("ためし");
  };
  fresh();
  const ranked = recordGame(true, { foeRating: START_RATING });
  is("相手の持ち点が渡れば動く", ranked.rating > START_RATING, true);
  is("そのとき対局数も数える", ranked.rated, 1);

  fresh();
  const unranked = recordGame(true, {});
  is("渡らなければ動かない", unranked.rating, START_RATING);
  is("対局数も増えない", unranked.rated, 0);
  is("それでも対戦の記録には残る", unranked.plays >= 1, true);
}

console.log("\n画面の作り(9×9のオンラインだけに渡している)");
{
  const src = readFileSync(join(here, "..", "src", "ui", "game.jsx"), "utf8");
  const m = src.match(/const ranked = ([^;]+);/);
  is("持ち点に数える条件が書いてある", !!m, true);
  if (m) {
    const cond = m[1].replace(/\s+/g, " ");
    is("オンラインであること", /network/.test(cond), true);
    is("9×9であること", /boardSize === 9/.test(cond), true);
  }
  is(
    "相手の持ち点は、その条件のときだけ渡す",
    /const foeRating =\s*ranked && network\.ratings/.test(src),
    true,
  );
  is(
    "条件を通らない対局では渡さない",
    !/const foeRating =\s*network && network\.ratings/.test(src),
    true,
  );
}

console.log("\n画面の説明");
{
  const rank = readFileSync(
    join(here, "..", "src", "ui", "ranking.jsx"),
    "utf8",
  );
  is(
    "ランキングに9×9だけと書いてある",
    /9×9のオンライン対戦の成績/.test(rank),
    true,
  );
  const screens = readFileSync(
    join(here, "..", "src", "ui", "screens.jsx"),
    "utf8",
  );
  is("盤を選ぶときに分かる", /ランキングに載ります/.test(screens), true);
}

console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
