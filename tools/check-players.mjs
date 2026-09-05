/**
 * 登録した人の台帳に置く形を検査する。通信はしない。
 */
const { playerRecord, publishPlayer, syncPlayer } =
  await import("../src/net/players.js");

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

console.log("サーバーに置く形");
is("名前が無い人は置かない", playerRecord({ id: "p1", name: "" }), null);
is("id が無い人は置かない", playerRecord({ name: "たろう" }), null);
const r = playerRecord({
  id: "p1",
  name: "たろう",
  icon: "crown",
  title: "first",
  plays: 3,
  wins: 1,
  rating: 1520,
  rated: 2,
});
is("欄がそろう", Object.keys(r).sort(), [
  "at",
  "icon",
  "name",
  "plays",
  "rated",
  "rating",
  "title",
  "wins",
]);
is("時刻が入る", typeof r.at === "number" && r.at > 0, true);
is("数は数のまま", [r.plays, r.wins, r.rating, r.rated], [3, 1, 1520, 2]);
is(
  "名前は10文字まで(ルールと同じ)",
  playerRecord({ id: "p2", name: "あいうえおかきくけこさし" }).name.length,
  10,
);
// null にすると Firebase では「その欄が無い」ことになる。
// ルールは行の欄がぴったりそろっていることを求める（知らない名前を
// 1つ足すだけで弾ける形にしてあるため）ので、空でも欄は残す
is(
  "アイコンと称号が無ければ空文字（欄は残す）",
  [
    playerRecord({ id: "p3", name: "x" }).icon,
    playerRecord({ id: "p3", name: "x" }).title,
  ],
  ["", ""],
);
is(
  "壊れた数は 0 に",
  playerRecord({ id: "p4", name: "x", plays: "abc" }).plays,
  0,
);

console.log("起動時の同期(通信は偽物)");
{
  const me = {
    id: "p1",
    name: "たろう",
    plays: 1,
    wins: 0,
    rating: 1500,
    rated: 0,
  };
  let sent = [];
  /**
   * 通信の代わり。停止の印(bans)と台帳(players)は別の木なので、
   * 呼ばれた先で返すものを変える
   */
  const serve = ({ ban = null, row = null, status = 200 } = {}) => {
    globalThis.fetch = async (url, opt) => {
      const method = (opt && opt.method) || "GET";
      if (method === "PATCH") sent.push(JSON.parse(opt.body));
      const isBan = String(url).includes("/bans/");
      return {
        ok: status < 400,
        status,
        json: async () => (method === "GET" ? (isBan ? ban : row) : {}),
      };
    };
  };
  serve({ ban: { at: 1 } });
  is("使用停止の印があれば true", await syncPlayer(me), true);
  sent = [];
  serve({ ban: null, row: null });
  is(
    "記録が無ければ false で、登録日つきで置く",
    [await syncPlayer(me), "since" in sent[0]],
    [false, true],
  );
  sent = [];
  serve({ ban: null, row: { name: "たろう", plays: 0, since: 12345 } });
  is(
    "記録があれば登録日を引き継ぐ",
    [await syncPlayer(me), sent[0].since],
    [false, 12345],
  );
  is(
    "置く中身に名前と時刻",
    [sent[0].name, typeof sent[0].at],
    ["たろう", "number"],
  );
  sent = [];
  serve({ ban: null, row: { name: "たろう" } });
  is(
    "登録日を持たない古い記録なら、今日を入れる",
    [await syncPlayer(me), typeof sent[0].since],
    [false, "number"],
  );
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  is("通信できなくても投げない(publish)", (await publishPlayer(me)).ok, false);
  is("通信できなくても投げない(sync)", await syncPlayer(me), false);
  is(
    "名前が無ければ置かない",
    (await publishPlayer({ id: "p9", name: "" })).ok,
    false,
  );
}

console.log(`\n${ok} ok / ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
