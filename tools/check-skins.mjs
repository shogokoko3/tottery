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

assert.equal(SKINS.length, 16);
assert.equal(POOL.length, 14);
assert.deepEqual(ODDS, { R: 65, SR: 32, SSR: 3 });
assert.equal(
  POOL.reduce((n, s) => n + rate(s), 0),
  100,
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
for (const s of POOL) assert.equal(perSkin[s.id], rate(s) * 100);
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
state = claimEarly(state);
assert.equal(state.owned["dragon-knight"], 1);
assert.deepEqual(claimEarly(state), state);
state = equip(equip(state, "dragon-knight"), "pegasus-knight");
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
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
for (const skin of SKINS)
  for (const asset of [skin.image, skin.card, skin.video].filter(Boolean)) {
    assert.ok(fs.statSync(path.join("assets", asset)).size > 0, asset);
  }
console.log("盤面の表裏・所有者・数字・全32画像と完成動画: OK");
