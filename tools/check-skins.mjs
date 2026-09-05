import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import {
  SKINS,
  POOL,
  ODDS,
  rate,
  draw,
  sanitizeLoadout,
} from "../src/skins/catalog.js";
import {
  normalize,
  pull,
  equip,
  unequip,
  claimEarly,
} from "../src/skins/collection.js";
import { captureFilm } from "../src/skins/events.js";
import { initialState, reducer } from "../src/game/reducer.js";
import { emptyBoard } from "../src/game/board.js";

assert.equal(SKINS.length, 17);
// 早期特典(天馬騎士)だけが抽選に入らない。竜騎士は SSR として入る
assert.equal(POOL.length, 15);
assert.deepEqual(
  SKINS.filter((s) => s.rarity === "LIMITED").map((s) => s.id),
  ["pegasus-knight"],
);
assert.equal(POOL.filter((s) => s.rarity === "SSR").length, 7);
assert.deepEqual(ODDS, { R: 65, SR: 32, SSR: 3 });
// SSR は7枚なので 3÷7 が割り切れない。小数の誤差ぶんは許す
// (draw は最後の1枚に落とす作りなので、足りなくても溢れても引ける)
assert.ok(
  Math.abs(POOL.reduce((n, s) => n + rate(s), 0) - 100) < 1e-9,
  "提供割合の合計が100%にならない",
);
const histogram = { R: 0, SR: 0, SSR: 0 };
// 乱数の全区間を均等に渡し、境界と各アイテムの幅を検査する。
const perSkin = {};
for (let i = 0; i < 10000; i++) {
  const skin = draw(() => (i + 0.5) / 10000);
  histogram[skin.rarity]++;
  perSkin[skin.id] = (perSkin[skin.id] || 0) + 1;
}
assert.deepEqual(histogram, { R: 6500, SR: 3200, SSR: 300 });
// SSR は 3÷7 で割り切れないので、1枚ぶんの幅は小数になる。丸めて見る
for (const s of POOL)
  assert.ok(
    Math.abs(perSkin[s.id] - rate(s) * 100) <= 1,
    `${s.id} の幅が合わない`,
  );
assert.equal(draw(() => 0.65).rarity, "SR");
assert.equal(draw(() => 0.97).rarity, "SSR");
for (const bad of [-1, 1, NaN, Infinity]) assert.throws(() => draw(() => bad));

const fresh = normalize(null);
let state = pull(fresh, 10, () => 0.65);
assert.equal(fresh.draws, 0);
assert.equal(state.owned["elf-male"], 10);
assert.equal(state.pending.results.filter((r) => r.isNew).length, 1);
assert.throws(() => pull(state, 1));
assert.throws(() => pull(fresh, 0));
assert.deepEqual(normalize(JSON.parse(JSON.stringify(state))), state);
state = equip(state, "elf-male");
assert.equal(state.equipped["6"], "elf-male");
assert.throws(() => equip(state, "angel-k"));
assert.deepEqual(unequip(state, "6").equipped, {});
// 早期特典は天馬騎士だけ。竜騎士は SSR としてガチャから出る
state = claimEarly(state);
assert.equal(state.owned["pegasus-knight"], 1);
assert.equal(state.owned["dragon-knight"], void 0);
assert.deepEqual(claimEarly(state), state);
state = equip(state, "pegasus-knight");
assert.equal(state.equipped["10"], "pegasus-knight");
assert.equal(Object.keys(state.equipped).length, 2);
// 回数制限なし。チケット・課金・確定枠による別の確率分岐が無い。
for (let i = 0; i < 120; i++)
  state = pull({ ...state, pending: null }, 10, () => 0);
assert.equal(state.draws, 1210);
assert.equal(state.owned["zombie-male"], 1200);
const corrupt = normalize({
  owned: { "elf-male": -1, "elf-female": 2, evil: 50 },
  equipped: { 6: "elf-male", 7: "elf-female", K: "elf-female" },
  pending: { results: [null, { id: "evil" }] },
});
assert.deepEqual(corrupt.owned, { "elf-female": 2 });
assert.deepEqual(corrupt.equipped, { 7: "elf-female" });
assert.equal(corrupt.pending, null);
assert.deepEqual(
  sanitizeLoadout({
    6: "elf-male",
    7: "https://example.com/track",
    Q: "angel-j",
    10: "pegasus-knight",
  }),
  { 6: "elf-male", 10: "pegasus-knight" },
);
assert.deepEqual(sanitizeLoadout(null), {});
assert.deepEqual(
  normalize({
    version: 1,
    owned: ["elf-male", "elf-male", "unknown"],
    equipped: { 6: "elf-male" },
  }).owned,
  { "elf-male": 1 },
);
console.log("確率65/32/3、無制限、重複、装備制約、早期特典、データ復元: OK");

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) || null,
  setItem: (k, v) => memory.set(k, v),
};
const { COLLECTION_KEY, getCollection, updateCollection } =
  await import("../src/skins/store.js");
memory.set(
  "tottery.skin-preview.v1",
  JSON.stringify({
    version: 1,
    owned: ["elf-male"],
    equipped: { 6: "elf-male" },
  }),
);
assert.equal(getCollection().equipped["6"], "elf-male");
const concurrent = await Promise.allSettled([
  updateCollection((s) => pull(s, 10, () => 0)),
  updateCollection((s) => pull(s, 10, () => 0)),
]);
assert.deepEqual(
  concurrent.map((r) => r.status),
  ["fulfilled", "rejected"],
);
assert.equal(JSON.parse(memory.get(COLLECTION_KEY)).draws, 10);
assert.equal(getCollection().pending.results.length, 10);
const saved = memory.get(COLLECTION_KEY),
  shown = getCollection();
globalThis.localStorage.setItem = () => {
  throw new Error("quota");
};
await assert.rejects(
  updateCollection((s) => ({ ...s, pending: null })),
  /保存できません/,
);
assert.equal(memory.get(COLLECTION_KEY), saved);
assert.equal(getCollection(), shown);
globalThis.localStorage.setItem = (k, v) => memory.set(k, v);
await updateCollection((s) => ({ ...s, pending: null }));
assert.equal(getCollection().pending, null);
console.log("連打の排他、演出前の永続化、旧版移行、保存失敗時の保護: OK");

function position() {
  const s = initialState();
  s.phase = "play";
  s.setupMode = "simultaneous";
  s.board = emptyBoard(5);
  const cards = [
    ["elf", "6", 0, 3, 1, false],
    ["foe", "8", 1, 2, 2, false],
    ["king0", "K", 0, 4, 0, true],
    ["king1", "K", 1, 0, 4, true],
  ];
  for (const [id, rank, owner, row, col, isKing] of cards) {
    const p = {
      id,
      rank,
      owner,
      row,
      col,
      isKing,
      suit: "spade",
      alive: true,
      revealed: false,
      history: [],
    };
    s.board[row][col] = p;
    s.pieces[id] = p;
    if (isKing) s.players[owner].kingId = id;
  }
  return s;
}
const before = position();
const after = reducer(before, {
  type: "MOVE_PIECE",
  pieceId: "elf",
  row: 2,
  col: 2,
  elapsedMs: 700,
});
const loadouts = [{ 6: "elf-male" }, {}];
assert.equal(captureFilm(before, after, loadouts, 0)?.id, "elf-male");
assert.equal(
  captureFilm(before, after, loadouts, 1),
  null,
  "裏向きの相手の正体を漏らさない",
);
const revealed = position();
revealed.pieces.elf.revealed = true;
assert.equal(
  captureFilm(
    revealed,
    reducer(revealed, { type: "MOVE_PIECE", pieceId: "elf", row: 2, col: 2 }),
    loadouts,
    1,
  )?.id,
  "elf-male",
);
assert.equal(captureFilm(before, after, [{}, {}]), null);
assert.equal(captureFilm(after, { ...after }, loadouts), null);
assert.equal(
  captureFilm(
    before,
    reducer(before, { type: "SELECT_PIECE", id: "elf" }),
    loadouts,
  ),
  null,
);
assert.equal(
  captureFilm(
    before,
    reducer(before, { type: "MOVE_PIECE", pieceId: "elf", row: 2, col: 0 }),
    loadouts,
  ),
  null,
);
assert.equal(captureFilm({ ...before, phase: "intro" }, after, loadouts), null);
assert.equal(
  captureFilm(before, { ...after, lastMove: null }, loadouts),
  null,
  "包囲は射撃にしない",
);
const victory = position();
victory.pieces.foe.isKing = true;
victory.players[1].kingId = "foe";
const won = reducer(victory, {
  type: "MOVE_PIECE",
  pieceId: "elf",
  row: 2,
  col: 2,
});
assert.equal(won.phase, "gameover");
assert.equal(captureFilm(victory, won, loadouts)?.id, "elf-male");
console.log(
  "実際のreducerと接続: 射撃、勝利手、移動のみ、再描画、隠し情報: OK",
);

// Reactの実描画を検査。相手の裏札のHTMLにスキン画像も数字も混ぜない。
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-skins-check-"));
try {
  const out = path.join(dir, "cards.cjs");
  await build({
    stdin: {
      contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {Piece,CardFace} from './src/ui/cards.jsx'; import {SeatsProvider} from './src/ui/names.jsx'; export function render(piece,viewer,skins){return renderToStaticMarkup(React.createElement(SeatsProvider,{value:{skins}},React.createElement(Piece,{piece,viewer,size:'xs'})));} export function card(rank,skinId){return renderToStaticMarkup(React.createElement(CardFace,{rank,skinId,suit:'heart'}));}`,
      resolveDir: process.cwd(),
      loader: "jsx",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    loader: { ".webp": "dataurl", ".png": "dataurl" },
    outfile: out,
    logLevel: "silent",
  });
  const { render, card } = createRequire(import.meta.url)(out);
  const piece = { ...before.pieces.elf };
  assert.match(render(piece, 0, loadouts), /data-skin="elf-male"/);
  assert.match(render(piece, 0, loadouts), /data-size="xs"/);
  const hidden = render(piece, 1, loadouts);
  assert.match(hidden, /class="card-back"/);
  assert.doesNotMatch(hidden, /elf-male|翠樹|card-skinned/);
  assert.match(
    render({ ...piece, revealed: true }, 1, loadouts),
    /data-skin="elf-male"/,
  );
  assert.doesNotMatch(render({ ...piece, owner: 1 }, 1, loadouts), /elf-male/);
  assert.doesNotMatch(card("7", "elf-male"), /data-skin/);
  assert.match(card("6", "elf-male"), /red-suit/);
  const ace = { ...piece, rank: "A", isKing: true };
  assert.match(
    render(ace, 0, [{ A: "genie-magician" }, {}]),
    /data-skin="genie-magician"/,
  );
  assert.doesNotMatch(
    render(ace, 1, [{ A: "genie-magician" }, {}]),
    /genie-magician|ランプ|skin-king-mark|card-captain/,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
for (const skin of SKINS)
  for (const asset of [
    skin.image,
    skin.card,
    skin.video,
    ...Object.values(skin.videos || {}),
  ].filter(Boolean)) {
    assert.ok(fs.statSync(path.join("assets", asset)).size > 0, asset);
  }
if (SKINS.some((s) => !s.video && !(s.videos?.swap && s.videos?.capture))) throw new Error("動画の無いスキンがある");
console.log("盤面の表裏・所有者・数字・全34画像と18本の動画: OK");

// 開示演出の決まり。前兆は束の中でいちばん強い格(SSR は低確率で SR に抑える)、
// 昇格は R→SR→SSR だが素で出ることもある。乱数は使わず束の中身から決める
{
  const {
    OMEN_FAKEOUT,
    OMEN_TEXT,
    STRAIGHT,
    bestOf,
    ladderFor,
    ladderOf,
    omenOf,
    roll,
    seedOf,
  } = await import("../src/skins/reveal.js");
  assert.deepEqual(ladderOf("R"), ["R"]);
  assert.deepEqual(ladderOf("SR"), ["R", "SR"]);
  assert.deepEqual(ladderOf("SSR"), ["R", "SR", "SSR"]);
  assert.deepEqual(ladderOf("LIMITED"), ["R", "SR", "SSR"]);
  assert.equal(bestOf([]), "R");
  assert.equal(bestOf([{ id: "zombie-male" }, { id: "elf-male" }]), "SR");
  assert.equal(bestOf([{ id: "elf-male" }, { id: "angel-j" }]), "SSR");
  assert.equal(bestOf([{ id: "no-such" }]), "R");
  for (const k of ["R", "SR", "SSR"]) assert.ok(OMEN_TEXT[k]);
  // 同じ文字列なら同じ値、範囲は [0,1)
  assert.equal(roll("abc"), roll("abc"));
  assert.notEqual(roll("abc"), roll("abd"));
  for (const t of ["", "a", "zombie-male,angel-j#omen"]) {
    assert.ok(roll(t) >= 0 && roll(t) < 1);
  }
  // 前兆は強く見せすぎない: SSR のいない束で SSR の前兆は出ない
  const rs = ["zombie-male", "pirate-female", "zombie-female", "pirate-male"];
  const srs = ["elf-male", "elf-female", "viking-male", "viking-female"];
  const ssrs = [
    "angel-j",
    "angel-q",
    "angel-k",
    "demon-j",
    "demon-q",
    "demon-k",
  ];
  let fake = 0,
    ssrBatches = 0,
    srOmenWithoutSsr = 0;
  // 束が毎回ちがう並びになるように、簡単な擬似乱数で札を選ぶ
  let x = 12345;
  const next = () => (x = (Math.imul(x, 1103515245) + 12345) >>> 0);
  // 線形合同法の下位ビットは周期が短いので、上位ビットで選ぶ
  const pick = (arr) => arr[(next() >>> 16) % arr.length];
  let at = 0;
  for (let n = 0; n < 4000; n++) {
    // SSR 入りの10連
    const batch = Array.from({ length: 10 }, (_, i) => ({
      id: i === (at = n % 10) ? pick(ssrs) : pick(rs),
    }));
    ssrBatches++;
    const omen = omenOf(batch);
    assert.ok(omen === "SSR" || omen === "SR");
    if (omen === "SR") fake++;
    assert.equal(omenOf(batch), omen, "同じ束なら同じ前兆");
    // SR 止まりの10連
    const b2 = Array.from({ length: 10 }, (_, i) => ({
      id: i === at ? pick(srs) : pick(rs),
    }));
    assert.notEqual(omenOf(b2), "SSR");
    if (omenOf(b2) === "SR") srOmenWithoutSsr++;
    // R だけの10連
    const b3 = Array.from({ length: 10 }, () => ({ id: pick(rs) }));
    assert.equal(omenOf(b3), "R");
  }
  const fakeRate = fake / ssrBatches;
  assert.ok(
    Math.abs(fakeRate - OMEN_FAKEOUT) < 0.03,
    `SSR を SR の前兆に抑える割合 ${fakeRate.toFixed(3)} が ${OMEN_FAKEOUT} から離れている`,
  );
  assert.equal(srOmenWithoutSsr, 4000, "SR がいれば前兆は SR");
  // 昇格: 最後は必ず本当の格。素で出る割合は決めた通り
  let straight = { SSR: 0, SR: 0 };
  const N = 4000;
  for (let n = 0; n < N; n++) {
    const seed = `${seedOf(Array.from({ length: 10 }, () => ({ id: pick(rs) })))}#${n % 10}`;
    for (const [rarity, tier] of [
      ["SSR", "SSR"],
      ["LIMITED", "SSR"],
      ["SR", "SR"],
    ]) {
      const l = ladderFor(rarity, seed);
      assert.equal(l[l.length - 1], tier, "最後は本当の格");
      assert.ok(l.length === 1 || l.join() === ladderOf(rarity).join());
      if (rarity !== "LIMITED" && l.length === 1) straight[tier]++;
    }
    assert.deepEqual(ladderFor("R", seed), ["R"]);
    assert.deepEqual(
      ladderFor("SSR", seed),
      ladderFor("SSR", seed),
      "同じ種なら同じ段階",
    );
  }
  for (const tier of ["SSR", "SR"]) {
    const rate = straight[tier] / N;
    assert.ok(
      Math.abs(rate - STRAIGHT[tier]) < 0.03,
      `${tier} が素で出る割合 ${rate.toFixed(3)} が ${STRAIGHT[tier]} から離れている`,
    );
  }
  console.log(
    `開示演出: 前兆(SSR を SR に抑える ${(fakeRate * 100).toFixed(1)}%)、昇格(素で出る SSR ${((straight.SSR / N) * 100).toFixed(1)}% / SR ${((straight.SR / N) * 100).toFixed(1)}%)、乱数なし: OK`,
  );
}
