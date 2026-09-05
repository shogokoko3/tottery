/**
 * 相手から届いた手の関門(acceptAct)を検査する。通信はしない。
 *
 * 届いた手は相手の端末が名乗っているだけで、何の保証も無い。ここを
 * すり抜けると、投了を代わりに宣言される・盤の外を読んで画面が真っ白に
 * なる、といったことが起きる。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const { acceptAct, NET_ACTIONS, LOCAL_ONLY_ACTIONS } =
  await import("../src/net/sync.js");

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
const ME = "uidMe";
const FOE = "uidFoe";
/** 席0(ホスト)として受け取る */
const asHost = (a) => acceptAct(a, ME, 0);
/** 席1(ゲスト)として受け取る */
const asGuest = (a) => acceptAct(a, ME, 1);
const act = (o) => ({ __id: "f-1", by: FOE, ...o });

console.log("席番号のなりすまし");
is(
  "自分の席番号(数)で届いた投了は捨てる",
  asHost(act({ type: "RESIGN", player: 0 })),
  null,
);
is(
  '文字列の "0" でも捨てる（厳密等価をすり抜けさせない）',
  asHost(act({ type: "RESIGN", player: "0" })),
  null,
);
is(
  '文字列の "1" でも、ゲスト側では捨てる',
  asGuest(act({ type: "RESIGN", player: "1" })),
  null,
);
is(
  "相手の席番号なら通す",
  asHost(act({ type: "RESIGN", player: 1 })),
  act({ type: "RESIGN", player: 1 }),
);
is(
  "文字列で来た相手の席番号は、数に直して通す",
  asHost(act({ type: "RESIGN", player: "1" })),
  act({ type: "RESIGN", player: 1 }),
);
is(
  "席番号が範囲外なら捨てる",
  asHost(act({ type: "RESIGN", player: 2 })),
  null,
);
is(
  "席番号が数でなければ捨てる",
  asHost(act({ type: "RESIGN", player: "あ" })),
  null,
);
is(
  "時間切れも同じ扱い",
  asHost(act({ type: "CLOCK_TIMEOUT", player: "0" })),
  null,
);
is(
  "布陣の確定も同じ扱い",
  asGuest(act({ type: "SETUP_CONFIRM", player: "1" })),
  null,
);

console.log("\n名前のない手・知らない手");
is("知らない名前の手は捨てる", asHost(act({ type: "DROP_TABLE" })), null);
is(
  "手元だけの操作が届いたら捨てる",
  asHost(act({ type: "SELECT_PIECE", id: "c1" })),
  null,
);
is("印(__id)の無い手は捨てる", asHost({ type: "MOVE_PIECE", by: FOE }), null);
is("中身が物でなければ捨てる", asHost("こんにちは"), null);
is("空なら捨てる", asHost(null), null);

console.log("\n自分が出した手");
is(
  "自分の名前で戻ってきた手は捨てる",
  asHost({ __id: "m-1", by: ME, type: "MOVE_PIECE" }),
  null,
);
is("相手の名前なら通す", asHost({ __id: "m-1", by: FOE, type: "MOVE_PIECE" }), {
  __id: "m-1",
  by: FOE,
  type: "MOVE_PIECE",
});

console.log("\nホストしか出せない合図");
is(
  "ホストに始まりの合図は届かない",
  asHost(act({ type: "START_SETUP", size: 5 })),
  null,
);
is("ホストに再戦の合図も届かない", asHost(act({ type: "NEW_GAME" })), null);
is(
  "ゲストには始まりの合図が届く",
  asGuest(act({ type: "START_SETUP", size: 5 })),
  act({ type: "START_SETUP", size: 5 }),
);
is(
  "ゲストには再戦の合図も届く",
  asGuest(act({ type: "NEW_GAME" })),
  act({ type: "NEW_GAME" }),
);

console.log("\n二つの一覧が reducer の手を漏れなく覆っているか");
const src = readFileSync(join(here, "..", "src", "game", "reducer.js"), "utf8");
const cases = [...src.matchAll(/^\s{4}case "([A-Z_]+)":/gm)].map((m) => m[1]);
const covered = new Set([...NET_ACTIONS, ...LOCAL_ONLY_ACTIONS]);
const missing = cases.filter((c) => !covered.has(c));
is(`reducer の手 ${cases.length} 件がどちらかに入っている`, missing, []);
const stray = [...NET_ACTIONS].filter((n) => !cases.includes(n));
is("届いてよい手に、reducer が知らない名前が無い", stray, []);
const both = [...NET_ACTIONS].filter((n) => LOCAL_ONLY_ACTIONS.has(n));
is("両方に入っている手が無い", both, []);

console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
