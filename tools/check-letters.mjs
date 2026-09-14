/**
 * 運営からの手紙を検査する。通信はしない。
 *
 * 届く相手の見分け、添付の形、二重取りを防ぐ控え、褒美の呼び名。
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

const {
  isFor,
  normalizeGift,
  normalizeLetter,
  readLetters,
  sendLetter,
  deleteLetter,
} = await import("../src/net/letters.js");
const { giftLabel, giftsLabel } = await import("../src/game/gifts.js");
const { campaignLetters, isCampaignLetter } =
  await import("../src/game/campaigns.js");
const { loadProfile, markLetterTaken, saveName } =
  await import("../src/game/profile.js");

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

console.log("添付の形");
is("チケット", normalizeGift({ type: "ticket", amount: 3 }), {
  type: "ticket",
  amount: 3,
});
is("経験値", normalizeGift({ type: "xp", amount: 150 }), {
  type: "xp",
  amount: 150,
});
is("称号", normalizeGift({ type: "title", id: "regular" }), {
  type: "title",
  id: "regular",
});
is(
  "0枚や負の数は落とす",
  [
    normalizeGift({ type: "ticket", amount: 0 }),
    normalizeGift({ type: "ticket", amount: -1 }),
  ],
  [null, null],
);
is("小数は落とす", normalizeGift({ type: "ticket", amount: 1.5 }), null);
is("id の無い称号は落とす", normalizeGift({ type: "title" }), null);
is("知らない種類は落とす", normalizeGift({ type: "money", amount: 100 }), null);
is(
  "壊れた入力でも落ちない",
  [normalizeGift(null), normalizeGift("x")],
  [null, null],
);

console.log("手紙の形");
const l = normalizeLetter("k1", {
  to: "all",
  subject: "おわび",
  body: "本文",
  gifts: [{ type: "ticket", amount: 2 }, { type: "nope" }],
  at: 1000,
});
is(
  "件名・本文・添付がそろう",
  [l.subject, l.body, l.gifts.length],
  ["おわび", "本文", 1],
);
is(
  "宛先を書かなければ全員宛て",
  normalizeLetter("k2", { subject: "x", at: 1 }).to,
  "all",
);
is("件名が無い手紙は落とす", normalizeLetter("k3", { body: "x" }), null);
is("壊れた手紙は落とす", normalizeLetter("k4", null), null);
is(
  "件名は60文字まで",
  normalizeLetter("k5", { subject: "あ".repeat(80) }).subject.length,
  60,
);
is(
  "本文は1000文字まで",
  normalizeLetter("k6", { subject: "x", body: "あ".repeat(2000) }).body.length,
  1000,
);
is(
  "添付は10個まで",
  normalizeLetter("k7", {
    subject: "x",
    gifts: Array.from({ length: 20 }, () => ({ type: "ticket", amount: 1 })),
  }).gifts.length,
  10,
);

console.log("誰に届くか");
const all = normalizeLetter("a", { to: "all", subject: "x", at: 1 });
const mine = normalizeLetter("b", { to: "p1", subject: "x", at: 1 });
is(
  "全員宛ては誰にでも届く",
  [isFor(all, "p1", 9), isFor(all, "p2", 9)],
  [true, true],
);
is(
  "宛先つきはその人だけ",
  [isFor(mine, "p1", 9), isFor(mine, "p2", 9)],
  [true, false],
);
const limited = normalizeLetter("c", { subject: "x", at: 1, until: 100 });
is("期限内なら届く", isFor(limited, "p1", 50), true);
is("期限を過ぎたら届かない", isFor(limited, "p1", 150), false);
is("期限なしはいつでも届く", isFor(all, "p1", 9e15), true);
is("壊れた手紙は届かない", isFor(null, "p1", 1), false);

console.log("二重取りを防ぐ控え");
saveName("たろう");
is("はじめは空", loadProfile().letters, []);
markLetterTaken("a");
is("控えたあと", loadProfile().letters, ["a"]);
markLetterTaken("a");
is("二度控えても1つ", loadProfile().letters, ["a"]);
markLetterTaken("");
is("空の id は控えない", loadProfile().letters, ["a"]);

console.log("褒美の呼び名");
is("チケット", giftLabel({ type: "ticket", amount: 3 }), "ガチャチケット ×3");
is("経験値", giftLabel({ type: "xp", amount: 150 }), "経験値 150");
is("知らない種類でも壊れない", giftLabel({ type: "nope" }), "—");
is(
  "知らない id でも壊れない",
  giftLabel({ type: "title", id: "no-such" }),
  "称号「no-such」",
);
is(
  "まとめて読み上げる",
  giftsLabel([
    { type: "ticket", amount: 1 },
    { type: "xp", amount: 50 },
  ]),
  "ガチャチケット ×1、経験値 50",
);
is("添付なし", giftsLabel([]), "（添付なし）");

console.log("\n置き場を宛先ごとに分ける");
{
  // この節は「真であること」だけを見るので、is を包んで使う
  const t = (label, cond) => is(label, !!cond, true);
  const seen = [];
  globalThis.fetch = async (url, opt) => {
    const u = String(url);
    seen.push({ url: u, method: (opt && opt.method) || "GET" });
    const row = (id, to) => ({
      [id]: { to, subject: "件名", body: "本文", gifts: [], at: 1 },
    });
    return {
      ok: true,
      json: async () =>
        u.includes("/letters/all")
          ? row("a1", "all")
          : u.includes("/letters/to/")
            ? row("m1", "uidA")
            : {},
    };
  };

  const got = await readLetters("uidA");
  t(
    "全員宛てと自分宛ての2か所を読む",
    seen.filter((r) => r.url.includes("letters/all")).length === 1 &&
      seen.filter((r) => r.url.includes("letters/to/uidA")).length === 1,
  );
  t(
    "他人宛ての置き場は読まない",
    !seen.some((r) => r.url.includes("letters/to/") && !r.url.includes("uidA")),
  );
  t(
    "2通と記念配布(campaigns.js の期間内ぶん)が1本にまとまる",
    got.ok && got.list.length === 2 + campaignLetters().length,
  );
  const camp = got.list.find((l) => l.id === "campaign:release-2026-09");
  t(
    "記念配布は全員宛て・チケット添付・campaign の印つき",
    camp &&
      camp.to === "all" &&
      camp.gifts[0].type === "ticket" &&
      camp.gifts[0].amount === 50 &&
      isCampaignLetter(camp) &&
      isFor(camp, "uidA", camp.at + 1),
  );
  t(
    "記念配布は期間前には出ない",
    !campaignLetters(camp.at - 1).some((l) => l.id === camp.id),
  );
  const pre = got.list.find((l) => l.id === "campaign:prerelease-2026-09");
  t(
    "リリース前限定の300枚は期限つきで出る",
    pre && pre.gifts[0].amount === 300 && pre.until > pre.at,
  );
  t(
    "リリース前限定は期限を過ぎると出ない",
    !campaignLetters(pre.until).some((l) => l.id === pre.id),
  );
  t(
    "運営の手紙は campaign の印を持たない",
    !isCampaignLetter(got.list.find((l) => l.id === "a1")),
  );

  seen.length = 0;
  await readLetters(null);
  t(
    "uid がまだ無ければ全員宛てだけ読む",
    seen.length === 1 && seen[0].url.includes("letters/all"),
  );
  const onlineFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  const offline = await readLetters("uidA");
  t(
    "圏外でも記念配布だけは出る(受け取りは財布に頼む)",
    !offline.ok && offline.list.length === campaignLetters().length,
  );
  globalThis.fetch = onlineFetch;

  seen.length = 0;
  await sendLetter({ to: "all", subject: "みんなへ" });
  t("全員宛ては letters/all へ出す", seen[0].url.includes("/letters/all.json"));

  seen.length = 0;
  await sendLetter({ to: "uidB", subject: "あなたへ" });
  t(
    "個人宛ては letters/to/<uid> へ出す",
    seen[0].url.includes("/letters/to/uidB.json"),
  );

  seen.length = 0;
  await deleteLetter("x1", "uidB");
  t(
    "個人宛ての取り消しも同じ置き場",
    seen[0].url.includes("/letters/to/uidB/x1.json") &&
      seen[0].method === "DELETE",
  );

  seen.length = 0;
  await deleteLetter("x2", "all");
  t("全員宛ての取り消し", seen[0].url.includes("/letters/all/x2.json"));
}

console.log(`\n${ok} ok / ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
