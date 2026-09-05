/**
 * データベースのルール(firebase-rules.json)を、実際に公開する前に検査する。
 *
 * Firebase の判定を丸ごと真似ることはできないので、要点だけを真似た小さな
 * 評価器で確かめる。真似ているのは次の四つ:
 *
 *   ・.read/.write は上から下へだけ効く。祖先のどれかが許せば通る。
 *     深いところに書いた規則で、浅いところの許可を取り消すことはできない。
 *   ・**.validate は書いた場所とその下しか見ない。祖先の .validate は
 *     評価されない。** だから .validate は防壁にならない。書き込み位置を
 *     1段下げれば素通りする。保証は .write に置くこと。
 *   ・.validate は消すときには見ない。
 *   ・無いところの値を数と比べても真にならない(JS と違うので、ここを合わせる)。
 *
 * 検査は三つの口で行う:
 *   canRead  … GET
 *   canWrite … その場所へ値を丸ごと置く(PUT / DELETE / POST)
 *   canPatch … PATCH。直下の子ごとに評価される。祖先の .write は効くが、
 *              祖先の .validate は効かない。**.validate だけで守っている
 *              条項は、ここで必ず破れる。**
 *
 * 通信はしない。公開する手順は firebase-rules.md にある。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(
  readFileSync(join(here, "..", "firebase-rules.json"), "utf8"),
).rules;

const { OPERATOR_UID } = await import("../src/net/auth.js");
const OP = OPERATOR_UID;

const NOW = 1_700_000_000_000;

/* ------------------------- 覗き見の口 ------------------------- */

/** 木の中の一点。Firebase の RuleDataSnapshot にあたる */
class Snap {
  constructor(root, path) {
    this.root = root;
    this.path = path;
  }
  get raw() {
    let v = this.root;
    for (const seg of this.path) {
      if (v == null || typeof v !== "object") return undefined;
      v = v[seg];
    }
    return v;
  }
  /**
   * 無い場所の値。Firebase では null が返り、数と比べても真にならない。
   * JS の null は数と比べると 0 になってしまうので undefined にしておく
   */
  val() {
    const v = this.raw;
    if (v === undefined || v === null) return undefined;
    return typeof v === "object" ? null : v;
  }
  child(p) {
    return new Snap(this.root, [...this.path, ...String(p).split("/")]);
  }
  parent() {
    return new Snap(this.root, this.path.slice(0, -1));
  }
  exists() {
    return this.raw !== undefined && this.raw !== null;
  }
  hasChild(k) {
    return this.child(k).exists();
  }
  hasChildren(keys) {
    return keys.every((k) => this.hasChild(k));
  }
  numChildren() {
    const v = this.raw;
    return v && typeof v === "object" ? Object.keys(v).length : 0;
  }
  isString() {
    return typeof this.raw === "string";
  }
  isNumber() {
    return typeof this.raw === "number";
  }
  isBoolean() {
    return typeof this.raw === "boolean";
  }
}

const cache = new Map();
function compile(src) {
  if (!cache.has(src))
    cache.set(
      src,
      new Function(
        "auth",
        "data",
        "newData",
        "root",
        "now",
        `return (${src});`,
      ),
    );
  return cache.get(src);
}

function evalExpr(expr, ctx) {
  if (typeof expr === "boolean") return expr;
  let src = expr;
  for (const [k, v] of Object.entries(ctx.vars))
    src = src.split("$" + k).join(JSON.stringify(v));
  try {
    return !!compile(src)(ctx.auth, ctx.data, ctx.newData, ctx.root, ctx.now);
  } catch (e) {
    throw new Error(`式が評価できません: ${expr}\n  ${e.message}`);
  }
}

/** path をたどりながら、規則のある節とワイルドカードの束縛を集める */
function walk(path) {
  const steps = [];
  let node = RULES;
  const vars = {};
  steps.push({ node, vars: { ...vars }, path: [] });
  for (let i = 0; i < path.length; i++) {
    const seg = path[i];
    if (!node) return steps;
    let next = node[seg];
    if (next === undefined) {
      const wild = Object.keys(node).find((k) => k.startsWith("$"));
      if (wild === undefined) return steps;
      vars[wild.slice(1)] = seg;
      next = node[wild];
    }
    node = next;
    steps.push({ node, vars: { ...vars }, path: path.slice(0, i + 1) });
  }
  return steps;
}

/** 木のコピーに、path の場所へ value を書いたもの */
function writtenTree(db, path, value) {
  const copy = structuredClone(db);
  if (path.length === 0) return value;
  let v = copy;
  for (const seg of path.slice(0, -1)) {
    if (v[seg] == null || typeof v[seg] !== "object") v[seg] = {};
    v = v[seg];
  }
  const last = path[path.length - 1];
  if (value === null) delete v[last];
  else v[last] = value;
  return copy;
}

/** .read が通るか */
export function canRead(db, path, auth) {
  const root = new Snap(db, []);
  for (const step of walk(path)) {
    if (!step.node || step.node[".read"] === undefined) continue;
    const ok = evalExpr(step.node[".read"], {
      auth,
      vars: step.vars,
      data: new Snap(db, step.path),
      newData: new Snap(db, step.path),
      root,
      now: NOW,
    });
    if (ok) return true;
  }
  return false;
}

/** 書いた後の木で .validate を回す。消すとき(値が null)は見ない */
function validates(db, after, path, value, vars0) {
  if (value === null) return true;
  const rootAfter = new Snap(after, []);
  const rootBefore = new Snap(db, []);
  const stack = [{ path, value, node: null }];
  // 書いた場所の規則の節を取る
  const steps = walk(path);
  const start = steps[steps.length - 1];
  if (steps.length !== path.length + 1) return true; // 規則の無い深さ
  stack[0].node = start.node;
  stack[0].vars = start.vars;
  while (stack.length) {
    const cur = stack.pop();
    if (!cur.node) continue;
    if (cur.node[".validate"] !== undefined) {
      const ok = evalExpr(cur.node[".validate"], {
        auth: vars0.auth,
        vars: cur.vars,
        data: new Snap(db, cur.path),
        newData: new Snap(after, cur.path),
        root: rootAfter,
        now: NOW,
      });
      if (!ok) return false;
    }
    if (cur.value && typeof cur.value === "object")
      for (const [k, v] of Object.entries(cur.value)) {
        if (v === null) continue;
        let node = cur.node[k];
        const vars = { ...cur.vars };
        if (node === undefined) {
          const wild = Object.keys(cur.node).find((w) => w.startsWith("$"));
          if (wild === undefined) continue;
          vars[wild.slice(1)] = k;
          node = cur.node[wild];
        }
        stack.push({ path: [...cur.path, k], value: v, node, vars });
      }
  }
  void rootBefore;
  return true;
}

/** 木のコピーに、path の直下の子を patch の分だけ書いたもの */
function patchedTree(db, path, patch) {
  let out = structuredClone(db);
  for (const [k, v] of Object.entries(patch))
    out = writeInto(out, [...path, k], v);
  return out;
}

function writeInto(tree, path, value) {
  if (path.length === 0) return value;
  let v = tree;
  for (const seg of path.slice(0, -1)) {
    if (v[seg] == null || typeof v[seg] !== "object") v[seg] = {};
    v = v[seg];
  }
  const last = path[path.length - 1];
  if (value === null) delete v[last];
  else v[last] = value;
  return tree;
}

/** 書いたあとの木を渡して、その1か所が通るか */
function writeAllowed(db, after, path, auth) {
  const root = new Snap(db, []);
  for (const step of walk(path)) {
    if (!step.node || step.node[".write"] === undefined) continue;
    if (
      evalExpr(step.node[".write"], {
        auth,
        vars: step.vars,
        data: new Snap(db, step.path),
        newData: new Snap(after, step.path),
        root,
        now: NOW,
      })
    )
      return true;
  }
  return false;
}

/** その場所へ値を丸ごと置けるか(PUT / DELETE / POST) */
export function canWrite(db, path, auth, value) {
  const after = writtenTree(db, path, value);
  if (!writeAllowed(db, after, path, auth)) return false;
  return validates(db, after, path, value, { auth });
}

/**
 * PATCH できるか。
 *
 * RTDB の PATCH は直下の子ごとの書き込みとして判定される。祖先の .write は
 * 効くが、**祖先の .validate は評価されない**。.validate だけで守っている
 * 条項は、ここで破れる。
 */
export function canPatch(db, path, auth, patch) {
  const after = patchedTree(db, path, patch);
  for (const [k, v] of Object.entries(patch)) {
    const at = [...path, k];
    if (!writeAllowed(db, after, at, auth)) return false;
    if (!validates(db, after, at, v, { auth })) return false;
  }
  return true;
}

/* ------------------------- ここから検査 ------------------------- */

let ok = 0;
const fails = [];
function is(label, got, want) {
  if (got === want) {
    ok++;
    console.log(`  ok   ${label}`);
  } else {
    fails.push(label);
    console.log(`  NG   ${label}  ${got} であるべきは ${want}`);
  }
}
const allow = (l, g) => is(l, g, true);
const deny = (l, g) => is(l, g, false);

const op = { uid: OP };
/** 実際にクライアントが置く形。欄が1つでも欠けると弾かれる */
const rankRow = (o) => ({
  name: "え",
  rating: 1500,
  rated: 0,
  plays: 0,
  wins: 0,
  at: NOW,
  icon: "",
  title: "",
  ...o,
});
const playerRow = (o) => ({ ...rankRow(), since: NOW, ...o });
const A = { uid: "uidA" };
const B = { uid: "uidB" };
const X = { uid: "uidX" }; // 部外者
const none = null;

/* --- 対局部屋 --- */
console.log("\n対局部屋は当事者だけのもの");
const room = {
  rooms: {
    ABCD: {
      members: { uidA: true, uidB: true },
      createdAt: NOW - 60_000,
      hostName: "あ",
      acts: { "-N1": { type: "MOVE_PIECE", by: "uidA" } },
    },
  },
};
allow("席についている人は部屋を読める", canRead(room, ["rooms", "ABCD"], A));
allow(
  "席についている人は手番の列を読める",
  canRead(room, ["rooms", "ABCD", "acts"], B),
);
deny("部外者は部屋を読めない", canRead(room, ["rooms", "ABCD"], X));
deny(
  "部外者は手番の列を読めない(伏せた王が見える口)",
  canRead(room, ["rooms", "ABCD", "acts"], X),
);
deny(
  "サインインしていない人は読めない",
  canRead(room, ["rooms", "ABCD"], none),
);
deny(
  "部外者は投了を差し込めない",
  canWrite(room, ["rooms", "ABCD", "acts", "-N9"], X, {
    type: "RESIGN",
    player: 0,
    by: "uidX",
  }),
);
allow(
  "当事者は自分の名前で手を指せる",
  canWrite(room, ["rooms", "ABCD", "acts", "-N9"], A, {
    type: "RESIGN",
    player: 0,
    by: "uidA",
    __id: "a-1",
  }),
);
deny(
  "当事者でも相手の名前は騙れない",
  canWrite(room, ["rooms", "ABCD", "acts", "-N9"], A, {
    type: "RESIGN",
    player: 1,
    by: "uidB",
    __id: "a-1",
  }),
);
deny(
  "名前を書かない手は通らない",
  canWrite(room, ["rooms", "ABCD", "acts", "-N9"], A, { type: "RESIGN" }),
);
deny(
  "一度指した手は書き換えられない",
  canWrite(room, ["rooms", "ABCD", "acts", "-N1"], A, {
    type: "MOVE_PIECE",
    by: "uidA",
    __id: "a-9",
  }),
);
deny(
  "部外者は部屋を丸ごと上書きできない",
  canWrite(room, ["rooms", "ABCD"], X, { members: { uidX: true } }),
);
deny(
  "部外者は対局中の部屋を消せない",
  canWrite(room, ["rooms", "ABCD"], X, null),
);
allow(
  "当事者は終わった部屋を消せる",
  canWrite(room, ["rooms", "ABCD"], A, null),
);

console.log("\n席の取り合い");
deny(
  "二人そろった部屋には割り込めない",
  canWrite(room, ["rooms", "ABCD", "members", "uidX"], X, true),
);
deny(
  "他人を席に着かせることはできない",
  canWrite(room, ["rooms", "ABCD", "members", "uidB"], X, true),
);
const half = {
  rooms: { EFGH: { members: { uidA: true }, createdAt: NOW - 10_000 } },
};
allow(
  "空いている席には座れる",
  canWrite(half, ["rooms", "EFGH", "members", "uidB"], B, true),
);
deny(
  "無い部屋の席には座れない",
  canWrite(half, ["rooms", "ZZZZ", "members", "uidB"], B, true),
);
deny("座る前に部屋の中身は読めない", canRead(half, ["rooms", "EFGH"], B));
allow(
  "部屋を作れる",
  canWrite({}, ["rooms", "WXYZ"], A, {
    members: { uidA: true },
    createdAt: NOW,
  }),
);
deny(
  "自分の入らない部屋は作れない",
  canWrite({}, ["rooms", "WXYZ"], A, {
    members: { uidB: true },
    createdAt: NOW,
  }),
);

console.log("\n名乗りの欄");
allow(
  "席についた人は自分の名前を書ける",
  canWrite(room, ["rooms", "ABCD", "guestName"], B, "い"),
);
deny(
  "部外者は名前の欄も書けない",
  canWrite(room, ["rooms", "ABCD", "guestName"], X, "の"),
);
deny(
  "名乗りの欄から席をこじ開けられない",
  canWrite(room, ["rooms", "ABCD", "members"], X, { uidX: true }),
);
allow(
  "座った席は自分で立てる",
  canWrite(room, ["rooms", "ABCD", "members", "uidA"], A, null),
);
deny(
  "相手を席から降ろせない",
  canWrite(room, ["rooms", "ABCD", "members", "uidB"], A, null),
);

console.log("\n放り出された部屋の片付け");
const stale = {
  rooms: { OLD1: { members: { uidA: true }, createdAt: NOW - 10 * 60_000 } },
};
allow(
  "相手が来ないまま古くなった部屋は誰でも片付けられる",
  canWrite(stale, ["rooms", "OLD1"], X, null),
);
const playing = {
  rooms: {
    PLAY: { members: { uidA: true, uidB: true }, createdAt: NOW - 10 * 60_000 },
  },
};
deny(
  "対局が続いている部屋は片付けられない",
  canWrite(playing, ["rooms", "PLAY"], X, null),
);
const veryOld = {
  rooms: {
    OLD2: {
      members: { uidA: true, uidB: true },
      createdAt: NOW - 25 * 3600_000,
    },
  },
};
allow(
  "1日置かれた部屋は誰でも片付けられる",
  canWrite(veryOld, ["rooms", "OLD2"], X, null),
);

/* --- 待ち合わせ --- */
console.log("\n待ち合わせの掲示");
const lob = {
  rooms: { ABCD: { members: { uidA: true }, createdAt: NOW - 30_000 } },
  lobby: { ABCD: { host: "uidA", createdAt: NOW - 30_000 } },
};
allow("掲示は誰でも見られる", canRead(lob, ["lobby"], X));
const mine = {
  rooms: { QQQQ: { members: { uidA: true }, createdAt: NOW - 1000 } },
};
allow(
  "自分の部屋なら掲示できる",
  canWrite(mine, ["lobby", "QQQQ"], A, { host: "uidA", createdAt: NOW }),
);
deny(
  "他人の名前では掲示できない",
  canWrite(mine, ["lobby", "QQQQ"], A, { host: "uidB", createdAt: NOW }),
);
deny(
  "部屋の無い掲示は出せない（空振りの掲示で埋められない）",
  canWrite({}, ["lobby", "QQQQ"], A, { host: "uidA", createdAt: NOW }),
);
deny("他人の掲示は消せない", canWrite(lob, ["lobby", "ABCD"], X, null));
allow("自分の掲示は消せる", canWrite(lob, ["lobby", "ABCD"], A, null));
allow("運営は掲示を消せる", canWrite(lob, ["lobby", "ABCD"], op, null));
allow(
  "空いている席に手を挙げられる",
  canWrite(lob, ["lobby", "ABCD", "guest"], B, "uidB"),
);
deny(
  "他人の名前で手を挙げられない",
  canWrite(lob, ["lobby", "ABCD", "guest"], B, "uidA"),
);
const taken = {
  rooms: { ABCD: { members: { uidA: true }, createdAt: NOW - 30_000 } },
  lobby: { ABCD: { host: "uidA", guest: "uidB", createdAt: NOW - 30_000 } },
};
deny(
  "先に手を挙げた人を押しのけられない",
  canWrite(taken, ["lobby", "ABCD", "guest"], X, "uidX"),
);
const oldLob = {
  lobby: { OLD: { host: "uidA", createdAt: NOW - 10 * 60_000 } },
};
allow(
  "時間切れの掲示は誰でも片付けられる",
  canWrite(oldLob, ["lobby", "OLD"], X, null),
);

/* --- 運営 --- */
console.log("\n運営ができること");
const db = {
  players: { uidA: { name: "あ" } },
  bans: { uidA: { at: NOW } },
  letters: { all: { L1: { subject: "お知らせ", at: NOW } }, to: { uidA: {} } },
  ranks: { uidA: { name: "あ", rating: 1500 } },
};
allow("台帳を一覧できる", canRead(db, ["players"], op));
allow("停止の印を一覧できる", canRead(db, ["bans"], op));
allow("お知らせを丸ごと読める", canRead(db, ["letters"], op));
allow("宛先ごとのお知らせを読める", canRead(db, ["letters", "to"], op));
allow("使用停止にできる", canWrite(db, ["bans", "uidA"], op, { at: NOW }));
allow("停止を解除できる", canWrite(db, ["bans", "uidA"], op, null));
allow(
  "全員宛てのお知らせを出せる",
  canWrite(db, ["letters", "all", "L2"], op, { subject: "件名", at: NOW }),
);
allow("台帳の行を消せる", canWrite(db, ["players", "uidA"], op, null));

console.log("\n遊ぶ側にできないこと");
deny("台帳を一覧できない", canRead(db, ["players"], X));
deny("他人の台帳を読めない", canRead(db, ["players", "uidA"], X));
deny(
  "他人の台帳を書き換えられない",
  canWrite(db, ["players", "uidA"], X, { name: "の" }),
);
deny("停止の印を一覧できない", canRead(db, ["bans"], X));
deny("自分の停止を消せない", canWrite(db, ["bans", "uidA"], A, null));
allow("自分の停止は見える", canRead(db, ["bans", "uidA"], A));
deny("他人宛てのお知らせを読めない", canRead(db, ["letters", "to", "uidA"], X));
deny(
  "お知らせを出せない",
  canWrite(db, ["letters", "all", "L3"], X, { subject: "にせ", at: NOW }),
);
deny("他人の成績を消せない", canWrite(db, ["ranks", "uidA"], X, null));
allow("自分の成績は置ける", canWrite(db, ["ranks", "uidX"], X, rankRow()));
deny(
  "持ち点は上限を越えられない",
  canWrite(db, ["ranks", "uidX"], X, rankRow({ rating: 99999 })),
);
deny(
  "知らない項目は混ぜられない",
  canWrite(db, ["ranks", "uidX"], X, rankRow({ admin: true })),
);
deny(
  "欄が欠けた行は置けない",
  canWrite(db, ["ranks", "uidX"], X, { name: "え", rating: 1500 }),
);
deny(
  "深いところへ知らない名前を生やせない(5段でも)",
  canWrite(db, ["ranks", "uidX", "junk", "a", "b", "c", "d"], X, "x"),
);
deny(
  "台帳も同じ(5段でも)",
  canWrite(db, ["players", "uidX", "junk", "a", "b", "c", "d"], X, "x"),
);
deny(
  "既にある行へ知らない名前を足せない",
  canWrite({ ranks: { uidX: rankRow() } }, ["ranks", "uidX", "junk"], X, "x"),
);
allow("自分の台帳も置ける", canWrite(db, ["players", "uidX"], X, playerRow()));
deny(
  "素性の知れない人は何も書けない",
  canWrite(db, ["ranks", "uidX"], none, { name: "え", rating: 1500 }),
);

/* --- 1段下げた書き込みと PATCH（.validate は防壁にならない） --- */
console.log("\n書き込む場所を1段下げても破れないか");
deny(
  "手番の名乗りを、1段下げて省けない",
  canWrite(room, ["rooms", "ABCD", "acts", "-N9", "type"], A, "RESIGN"),
);
deny(
  "手番の名乗りを、1段下げて騙れない",
  canWrite(room, ["rooms", "ABCD", "acts", "-N9", "by"], A, "uidB"),
);
deny(
  "自分の入らない部屋を PATCH で作れない",
  canPatch({}, ["rooms", "NEW1"], A, {
    members: { uidB: true },
    createdAt: NOW,
  }),
);
deny(
  "成績の名前を、葉の下へ書いて壊せない",
  canWrite(db, ["ranks", "uidX", "name", "x"], X, "boom"),
);
deny(
  "成績の名前を、PATCH で物に変えられない",
  canPatch(db, ["ranks", "uidX", "name"], X, { x: "boom" }),
);
deny(
  "台帳の名前も、葉の下へ書けない",
  canWrite(db, ["players", "uidX", "name", "x"], X, "boom"),
);
deny(
  "知らない項目を、葉の下へ書いて混ぜられない",
  canWrite(db, ["ranks", "uidX", "junk", "deep"], X, "x"),
);

console.log("\n部屋の埋め尽くし");
deny(
  "はじめから二人いる部屋は作れない",
  canWrite({}, ["rooms", "SPAM"], X, {
    members: { uidX: true, uidY: true },
    createdAt: NOW,
  }),
);
deny(
  "未来の日付の部屋は作れない",
  canWrite({}, ["rooms", "SPAM"], X, {
    members: { uidX: true },
    createdAt: NOW + 400 * 24 * 3600_000,
  }),
);
allow(
  "運営はどんな部屋も片付けられる",
  canWrite(room, ["rooms", "ABCD"], op, null),
);

console.log("\n待っているだけの部屋を覗けないか");
deny(
  "掲示のある部屋(ランダムマッチ)は、名乗った人以外は座れない",
  canWrite(
    {
      rooms: { RNDM: { members: { uidA: true }, createdAt: NOW - 10_000 } },
      lobby: { RNDM: { host: "uidA", guest: "uidB", createdAt: NOW - 10_000 } },
    },
    ["rooms", "RNDM", "members", "uidX"],
    X,
    true,
  ),
);
deny(
  "座れないので、待機中の部屋の中身も読めない",
  canRead(
    {
      rooms: { RNDM: { members: { uidA: true }, createdAt: NOW - 10_000 } },
      lobby: { RNDM: { host: "uidA", guest: "uidB", createdAt: NOW - 10_000 } },
    },
    ["rooms", "RNDM"],
    X,
  ),
);
// 合言葉の部屋には掲示が無い。鍵は合言葉そのものなので、
// 総当たりされない長さ(8文字)であることが前提になる。長さは check-account が見る
allow(
  "合言葉の部屋は、合言葉を知っていれば座れる",
  canWrite(half, ["rooms", "EFGH", "members", "uidX"], X, true),
);
const posted = {
  rooms: { EFGH: { members: { uidA: true }, createdAt: NOW - 10_000 } },
  lobby: { EFGH: { host: "uidA", guest: "uidB", createdAt: NOW - 10_000 } },
};
allow(
  "掲示で名乗った人だけが座れる",
  canWrite(posted, ["rooms", "EFGH", "members", "uidB"], B, true),
);
deny(
  "名乗っていない第三者は座れない",
  canWrite(posted, ["rooms", "EFGH", "members", "uidX"], X, true),
);

console.log("\n待ち合わせの掲示");
allow(
  "掲示への名乗りは早い者勝ち（席はそのあと）",
  canWrite(lob, ["lobby", "ABCD", "guest"], X, "uidX"),
);
allow(
  "居座られたら、掲示の持ち主が名乗りを外せる",
  canWrite(taken, ["lobby", "ABCD", "guest"], A, null),
);
allow(
  "名乗った本人は取り下げられる",
  canWrite(taken, ["lobby", "ABCD", "guest"], B, null),
);
deny(
  "他人の名乗りは取り下げられない",
  canWrite(taken, ["lobby", "ABCD", "guest"], X, null),
);
deny(
  "未来の日付の掲示は作れない",
  canWrite({}, ["lobby", "FAKE"], X, {
    host: "uidX",
    createdAt: NOW + 400 * 24 * 3600_000,
  }),
);
deny(
  "持ち主のいない掲示は作れない",
  canWrite({}, ["lobby", "FAKE"], X, { createdAt: NOW }),
);

console.log("\n使用停止が実際に効くか");
const stopped = {
  bans: { uidX: { at: NOW } },
  rooms: {
    ABCD: { members: { uidA: true, uidX: true }, createdAt: NOW - 1000 },
  },
  lobby: {},
  ranks: { uidX: { name: "と", rating: 1500 } },
  players: { uidX: { name: "と" } },
};
deny(
  "止められた人は成績を置けない",
  canWrite(stopped, ["ranks", "uidX"], X, rankRow({ name: "と" })),
);
deny(
  "止められた人は台帳に載せられない",
  canWrite(stopped, ["players", "uidX"], X, playerRow({ name: "と" })),
);
deny(
  "止められた人は掲示を出せない",
  canWrite(stopped, ["lobby", "QQ"], X, { host: "uidX", createdAt: NOW }),
);
deny(
  "止められた人は手を指せない",
  canWrite(stopped, ["rooms", "ABCD", "acts", "-Z"], X, {
    type: "MOVE_PIECE",
    by: "uidX",
    __id: "z",
  }),
);
deny(
  "止められた人は部屋を作れない",
  canWrite(stopped, ["rooms", "NEW"], X, {
    members: { uidX: true },
    createdAt: NOW,
  }),
);
allow(
  "止められていない人は今までどおり置ける",
  canWrite(stopped, ["ranks", "uidA"], A, rankRow({ name: "あ" })),
);

console.log("\n通報の置き場");
const rep = {
  reports: { R1: { targetId: "uidA", reason: "暴言", at: NOW } },
};
allow(
  "誰でも通報できる",
  canWrite(rep, ["reports", "R2"], X, {
    targetId: "uidA",
    reason: "暴言",
    at: NOW,
    reporterId: "uidX",
  }),
);
allow("運営は通報を消せる", canWrite(rep, ["reports", "R1"], op, null));
allow(
  "運営は処理の印を付けられる",
  canWrite(rep, ["reports", "R1", "handled"], op, true),
);
deny("他人の通報は読めない", canRead(rep, ["reports", "R1"], X));
deny(
  "通報の体裁を欠いたものは置けない",
  canWrite(rep, ["reports", "R3"], X, { junk: "x" }),
);
deny(
  "1段下げて任意の中身を置けない",
  canWrite(rep, ["reports", "R3", "junk"], X, "x"),
);
deny(
  "通報者を騙れない",
  canWrite(rep, ["reports", "R4"], X, {
    targetId: "uidA",
    reason: "暴言",
    at: NOW,
    reporterId: "uidB",
  }),
);
deny(
  "余計な項目は混ぜられない",
  canWrite(rep, ["reports", "R5"], X, {
    targetId: "uidA",
    reason: "暴言",
    at: NOW,
    payload: "x".repeat(100),
  }),
);
deny("自分の通報も消せない", canWrite(rep, ["reports", "R1"], X, null));

console.log("\n名乗りの欄の中身");
deny(
  "相手の名前を物にして画面を壊せない",
  canWrite(room, ["rooms", "ABCD", "guestName"], B, { evil: 1 }),
);
deny(
  "持ち点を桁外れに偽れない",
  canWrite(room, ["rooms", "ABCD", "guestRating"], B, 999999),
);
deny(
  "知らない欄を部屋に生やせない",
  canWrite(room, ["rooms", "ABCD", "payload"], B, "x"),
);

console.log("\n手番の中身と、止められた人の名乗り");
// 手の中身は、入れ替えや布陣のように入れ子を持つので形を決められない。
// 欄の数(24)と件数(1000)で抑えるところまでが限界で、
// 1つの手をどれだけ大きくできるかはルールでは縛れていない
deny(
  "欄を並べすぎた手は積めない",
  canWrite(room, ["rooms", "ABCD", "acts", "-N9"], A, {
    type: "MOVE_PIECE",
    by: "uidA",
    __id: "a-9",
    ...Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`f${i}`, i]),
    ),
  }),
);
deny(
  "席についていない人は手番の中へ1段下げても書けない",
  canWrite(room, ["rooms", "ABCD", "acts", "-N9", "payload"], X, "x"),
);
deny(
  "止められた人は名乗りの欄も書けない",
  canWrite(
    {
      bans: { uidB: { at: NOW } },
      rooms: {
        ABCD: { members: { uidA: true, uidB: true }, createdAt: NOW - 1000 },
      },
    },
    ["rooms", "ABCD", "guestName"],
    B,
    "と",
  ),
);

console.log("\nスキンと掲示のすき間");
deny(
  "スキンの欄を深いところで物にできない",
  canWrite(room, ["rooms", "ABCD", "guestSkins", "2", "x"], B, "boom"),
);
allow(
  "正しいスキンは置ける",
  canWrite(room, ["rooms", "ABCD", "guestSkins", "2"], B, "skin-2-a"),
);
deny(
  "掲示の無い部屋(合言葉の部屋)に名乗りを生やせない",
  canWrite(
    { rooms: { EFGH: { members: { uidA: true }, createdAt: NOW - 1000 } } },
    ["lobby", "EFGH", "guest"],
    X,
    "uidX",
  ),
);

console.log("\nランキングの見え方");
deny("未サインインではランキングを読めない", canRead(db, ["ranks"], none));
allow("サインインしていれば読める", canRead(db, ["ranks"], X));

/* --- 埋め込んだ uid がずれていないか --- */
console.log("\n運営の uid のつじつま");
const raw = readFileSync(join(here, "..", "firebase-rules.json"), "utf8");
/** 式の中に現れる「uid らしい並び」を全部集める */
function uidLiterals(node, out = new Set()) {
  if (typeof node === "string") {
    for (const m of node.matchAll(/'([A-Za-z0-9]{20,})'/g)) out.add(m[1]);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) uidLiterals(v, out);
  }
  return out;
}
const lits = [...uidLiterals(RULES)];
is(
  `ルールに出てくる uid が全部 src/net/auth.js と同じ(${lits.length}か所)`,
  lits.length > 0 && lits.every((u) => u === OP),
  true,
);
is(
  "置き換え忘れの目印が残っていない",
  /PUT-OPERATOR-UID-HERE/.test(raw),
  false,
);

console.log(`\n${ok} 件 ok / ${fails.length} 件 NG`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
