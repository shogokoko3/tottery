/**
 * プレイヤーのアカウントを検査する。
 *
 * 名前は対戦相手にも渡すので、変な値が入らないようにしておく。
 * また、名前を持たなかった頃の保存を引き継げるかも見る。
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
  MAX_NAME_LEN,
  hasName,
  levelOf,
  loadProfile,
  nameError,
  normalizeName,
  recordGame,
  saveName,
} = await import("../src/game/profile.js");
const { nameOf, playerLabel, shortPlayerLabel } =
  await import("../src/game/constants.js");

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

console.log("名前の整え方");
is("前後の空白を落とす", normalizeName("  しょうご  "), "しょうご");
is("途中の空白は1つにまとめる", normalizeName("しょう　　ご"), "しょう ご");
is("改行は空白として扱う", normalizeName("しょう\nご"), "しょう ご");
is(
  "長すぎる分は切る",
  normalizeName("あいうえおかきくけこさしす").length,
  MAX_NAME_LEN,
);
is("空は空のまま", normalizeName("   "), "");
is("null でも落ちない", normalizeName(null), "");

console.log("名前として使えるか");
is("空は断る", !!nameError("  "), true);
is("長すぎは断る", !!nameError("あいうえおかきくけこさ"), true);
is("ちょうどは通す", nameError("あいうえおかきくけこ"), null);
is("普通の名前は通す", nameError("しょうご"), null);

console.log("保存と引き継ぎ");
{
  is("はじめは名前が無い", hasName(), false);
  is("名前が無いうちは id も作らない", loadProfile().id, null);
  const a = saveName(" しょうご ");
  is("整えて保存する", a.name, "しょうご");
  is("id ができる", typeof a.id === "string" && a.id.length > 3, true);
  is("名前があると分かる", hasName(), true);
  const id = a.id;
  const b = saveName("たろう");
  is("名前を変えても id は変わらない", b.id, id);
  const c = recordGame(true);
  is("1局ぶん数える", [c.plays, c.wins], [1, 1]);
  is("名前は消えない", c.name, "たろう");
  is("空の名前では上書きしない", saveName("   ").name, "たろう");
}
{
  // 名前を持たなかった頃の保存だけがある状態
  delete store["tottery.account.v1"];
  store["tottery.profile.v1"] = JSON.stringify({ plays: 7, wins: 3 });
  const old = loadProfile();
  is("古い戦績を引き継ぐ", [old.plays, old.wins], [7, 3]);
  is("名前はまだ無い", old.name, "");
  is("レベルも引き継いだ戦績から出る", levelOf(old) >= 1, true);
}

console.log("画面に出す呼び名");
is("名前が無ければ色名", nameOf(0, null), "赤");
is("名前があれば名前", nameOf(1, [null, "たろう"]), "たろう");
is(
  "名前つきの自分は名前だけ",
  playerLabel(0, 0, ["しょうご", "たろう"]),
  "しょうご",
);
is("名前つきの相手", playerLabel(1, 0, ["しょうご", "たろう"]), "たろう");
is("名前が無ければ今までどおり", playerLabel(0, 0, null), "あなた(赤)");
is(
  "短い呼び名も名前を使う",
  shortPlayerLabel(1, 0, [null, "たろう"]),
  "たろう",
);
is("名前が無ければ相手", shortPlayerLabel(1, 0, null), "相手");

console.log("名前に使えない語(ガイドライン 1.2)");
{
  // 断るべきもの。全角・伏せ字・繰り返し・カタカナでの回避も含む
  for (const n of [
    "FUCK", "ＦＵＣＫ", "f*u*c*k", "fuuuuck", "sh1t", "n1gger",
    "ちんこ", "チンコ", "ﾁﾝｺ", "死ね", "しね", "シネ", "殺す",
    "ばか", "うんこ", "ﾚｲﾌﾟ", "運営", "管理人", "admin", "Official",
  ])
    is(`断る: ${n}`, typeof nameError(n) === "string", true);

  // 通すべきもの。まっとうな名前を巻き込んでいないか
  for (const n of [
    "つしま", "Shogo", "太郎", "ねこ丸", "王将", "ABC", "しんじ",
    "かしね", "あきら", "せいこう", "正孝", "はげまる", "えたじま",
    "くそげ職人", "🐱ねこ",
  ])
    is(`通す: ${n}`, nameError(n), null);

  is("使えない名前は保存もされない", saveName("ちんこ").name !== "ちんこ", true);
}

console.log("名前の整え方");
is(
  "絵文字を割らずに切る",
  [...normalizeName("🐱".repeat(12))].length,
  MAX_NAME_LEN,
);
is("前後の空白は字数に数えない", nameError("  あいうえおかきくけこ  "), null);
is("整えても10文字を超えるなら断る", typeof nameError("あいうえおかきくけこさ") === "string", true);

console.log("名前を決める画面の文言(2026-10-01 本人の指示)");
{
  // 画面(src/ui/account.jsx)を描かずに中身だけ見る。React と他の部品は偽物に差し替える
  const fs = await import("node:fs");
  const { transformSync } = await import("esbuild");
  const states = [];
  let si = 0;
  globalThis.__acc = {
    useState: (init) => {
      const i = si++;
      if (!(i in states)) states[i] = typeof init === "function" ? init() : init;
      return [states[i], (v) => (states[i] = typeof v === "function" ? v(states[i]) : v)];
    },
    profile: { MAX_NAME_LEN, nameError, normalizeName },
  };
  globalThis.__accH = (type, props, ...children) => {
    // 中の部品(NameField)は呼んで組み立てる。偽物(Sparkle など)は名前だけ残す
    if (typeof type === "function" && !type.__stub) return type({ ...(props || {}), children });
    return {
      type: typeof type === "function" ? type.__stub : type,
      props: props || {},
      children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false),
    };
  };
  // 名前の整え方は本物、ほかの取り込みは何を呼ばれても空の偽物
  globalThis.__accStub = new Proxy(
    {},
    {
      get: (_, name) => {
        if (name in globalThis.__acc.profile) return globalThis.__acc.profile[name];
        const f = () => null;
        f.__stub = String(name);
        return f;
      },
    },
  );
  const src = fs
    .readFileSync(new URL("../src/ui/account.jsx", import.meta.url), "utf8")
    .replace(/import \{[^}]*\} from "react";/, "const { useState } = globalThis.__acc;")
    .replace(/import \{([^}]*)\} from "[^"]+";/g, (_, names) => `const {${names}} = globalThis.__accStub;`);
  const js = transformSync(src, { loader: "jsx", jsx: "transform", jsxFactory: "globalThis.__accH", jsxFragment: '"fragment"', format: "esm" }).code;
  const { NameSetupScreen, NAME_LINES } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
  const texts = (n, into = []) => {
    if (typeof n === "string") into.push(n);
    else if (n && typeof n === "object") for (const c of n.children || []) texts(c, into);
    return into;
  };
  const find = (n, ok) => {
    if (!n || typeof n !== "object") return null;
    if (ok(n)) return n;
    for (const c of n.children || []) {
      const hit = find(c, ok);
      if (hit) return hit;
    }
    return null;
  };
  const cls = (n, name) => find(n, (x) => typeof x.props?.className === "string" && x.props.className.split(" ").includes(name));
  const draw = (props) => {
    states.length = 0;
    si = 0;
    return NameSetupScreen({ onDone: () => {}, ...props });
  };
  const start = draw({});
  is("見出しは「あなたの名前は?」", texts(find(start, (n) => n.type === "h2")).join(""), "あなたの名前は?");
  is("本文は2行", [...NAME_LINES], ["インターネット上のランキングに出ます。", "本名は避けて。あとから変えられます。"]);
  is("本文は1文ずつ行に分けて出す", texts(cls(start, "name-lines")), [...NAME_LINES]);
  is("法務メモ (C) の「インターネット上のランキング」を残す", texts(start).join("").includes("インターネット上のランキング"), true);
  is("本名を避けるよう言う", texts(start).join("").includes("本名は避けて"), true);
  is("起動直後は「はじめまして」", texts(cls(start, "name-eyebrow")).join(""), "はじめまして");
  is("起動直後の釦は「はじめる」", texts(cls(start, "btn-primary")).join("").trim(), "はじめる");
  const won = draw({ afterWin: true });
  is("はじめの一局に勝った直後は「はじめての勝利」", texts(cls(won, "name-eyebrow")).join(""), "はじめての勝利");
  is("勝った直後の釦は「決める」", texts(cls(won, "btn-primary")).join("").trim(), "決める");
  is("勝った直後も本文は同じ2行", texts(cls(won, "name-lines")), [...NAME_LINES]);
  is("名前の欄がある", !!cls(won, "name-input"), true);
  is("導入の中では戻る釦を出さない(名前を決めて進む)", [!!cls(start, "name-cancel"), !!cls(won, "name-cancel"), !!cls(start, "name-reason")], [false, false, false]);
  // 名前の壁(2026-10-01 本人の指示)。名前の無い人がランキングや対戦へ行こうとしたとき、わけを添えて聞き、戻れる
  let cancelled = 0;
  const wall = draw({ reason: "ランキングを見る前に、名前を決めよう。", onCancel: () => cancelled++ });
  is("名前の壁: わけの一行", texts(cls(wall, "name-reason")).join(""), "ランキングを見る前に、名前を決めよう。");
  is("名前の壁: 本文(法務メモの語)はそのまま", texts(cls(wall, "name-lines")), [...NAME_LINES]);
  is("名前の壁: 決める釦はそのまま", texts(cls(wall, "btn-primary")).join("").trim(), "はじめる");
  is("名前の壁: 「戻る」で決めずに戻れる", texts(cls(wall, "name-cancel")).join(""), "戻る");
  cls(wall, "name-cancel").props.onClick();
  is("名前の壁: 戻るを押すと onCancel", cancelled, 1);
  is("名前の壁: わけは警告の赤(name-notice)ではない", !!cls(wall, "name-notice"), false);
  const css = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  is("本文の行は1文ずつ積む", /\.name-lines span \{\s*display: block;/.test(css), true);
  is("名前の壁のわけと戻る釦の見た目がある", /\.name-reason \{/.test(css) && /\.name-cancel \{/.test(css), true);
}

console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) process.exit(1);
