import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { reducer } from "../src/game/reducer.js";
import { areaFixture } from "./area-fixture.mjs";
import { discardCards, replenishReserve } from "../src/game/reserve.js";
import { publicPiece } from "../src/skins/ace-magic.js";

let state = { ...areaFixture("palace"), ruleVersion: 9 };
// 6→8→9→10→J と繰り返しても、最初の札は6のまま。
for (const steps of [2, 1, 1, 1]) {
  state = reducer(state, { type: "USE_AREA", pieceId: "fx1", promotionSteps: steps });
  state = { ...state, turnNo: state.turnNo + 2, interstitial: null };
}
const promoted = state.pieces.fx1;
assert.equal(promoted.rank, "J");
assert.equal(promoted.originalRank, "6");
assert.equal(promoted.mark, "palace");

// 相手のJで撃破。履歴はJ、補充される札は6という区別を維持する。
state = structuredClone(state);
state.areas = [null, null];
state.currentTurn = 1;
state.board[state.pieces.fx5.row][state.pieces.fx5.col] = null;
Object.assign(state.pieces.fx5, { rank: "J", row: 6, col: 0 });
state.board[6][0] = state.pieces.fx5;
const dead = reducer(state, { type: "MOVE_PIECE", pieceId: "fx5", row: 6, col: 3, player: 1 });
const corpse = dead.players[0].capturedOwn[0];
assert.equal(corpse.rank, "J");
assert.equal(corpse.originalRank, "6");
assert.equal(corpse.alive, false);
assert.equal(dead.captureReveal.defeated[0].mark, "palace");
assert.equal(dead.captureReveal.defeated[0].originalRank, "6");
assert.equal(dead.kPlacement.cards.find(c => c.id === corpse.id)?.rank, "6");
const resurrected = reducer({ ...dead, captureReveal: null, interstitial: null }, {
  type: "PLACE_RESERVE_CARD", cardId: corpse.id, row: 8, col: 0, player: 0,
});
assert.equal(resurrected.pieces[corpse.id].rank, "6");
assert.equal(resurrected.pieces[corpse.id].mark, undefined);
const opened = reducer(resurrected, { type: "VIEW_LOG", id: corpse.id, capturedOwner: 0, capturedIndex: 0 });
assert.equal(opened.logViewerSnapshot.rank, "J");
assert.equal(opened.logViewerSnapshot.originalRank, "6");

assert.equal(publicPiece(promoted, 1, state).mark, "palace");
const hidden = { ...promoted, revealed: false };
assert.deepEqual(Object.keys(publicPiece(hidden, 1, state)).sort(), ["col", "face", "owner", "row"]);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-promotion-"));
try {
  const out = path.join(dir, "render.cjs");
  await build({
    stdin: {
      resolveDir: process.cwd(), loader: "jsx",
      contents: `import {renderToStaticMarkup} from 'react-dom/server';
        import {CardFace,Piece,CapturedCardFace} from './src/ui/cards.jsx';
        import {CapturedRow} from './src/ui/game.jsx';
        import {LogViewer} from './src/ui/overlays.jsx';
        import {SeatsProvider} from './src/ui/names.jsx';
        export function render(kind,props,skins=[{},{}]){
          const C={card:CardFace,piece:Piece,lost:CapturedCardFace,row:CapturedRow,log:LogViewer}[kind];
          return renderToStaticMarkup(<SeatsProvider value={{skins}}><C {...props}/></SeatsProvider>);
        }`,
    },
    bundle: true, platform: "node", format: "cjs", jsx: "automatic",
    loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
    define: { __AUDIO_FILES__: "{}" }, outfile: out, logLevel: "silent",
  });
  const { render } = createRequire(import.meta.url)(out);
  for (const size of ["xs", "sm", "tray", "md", "lg"]) {
    for (const suit of ["spade", "heart", "diamond", "club"]) {
      for (const skins of [[{}, {}], [{ J: "angel-j" }, {}]]) {
        const html = render("piece", { piece: { ...promoted, suit }, viewer: 1, size }, skins);
        assert.match(html, /card-suit-promoted/);
        assert.doesNotMatch(html, /mark-palace|mark-badge|>宮</);
        assert.match(html, /元は6/);
      }
    }
  }
  const concealed = render("piece", { piece: hidden, viewer: 1 });
  assert.doesNotMatch(concealed, /card-suit-promoted|昇格|元は6|mark-palace/);
  assert.match(render("piece", { piece: {...promoted, mark:"sky"}, viewer:1 }), /mark-sky/);
  const originalArt = fs.readFileSync("assets/cards/standard/6.webp").toString("base64");
  for (const kind of ["lost", "row"]) {
    const html = render(kind, kind === "lost" ? { piece: corpse } : { players:dead.players,viewer:0,dispatch:()=>{} });
    assert.ok(html.includes(originalArt));
    assert.match(html, /6<small>♠<\/small>/);
    assert.match(html, /撃破時 J/);
    assert.doesNotMatch(html, /card-suit-promoted/);
  }
  const skinLost = render("lost", { piece: corpse }, [{6:"elf-male",J:"angel-j"},{}]);
  assert.match(skinLost, /data-skin="elf-male"/);
  assert.doesNotMatch(skinLost, /data-skin="angel-j"/);
  assert.match(render("log", {piece:opened.logViewerSnapshot,viewer:1}), /元のカード：<b>6♠/);
  assert.doesNotMatch(render("log", {piece:hidden,viewer:1}), /元のカード|card-origin-note/);
  // 旧記録の未昇格札はそのまま。空から宮殿を経た札は、途中の10ではなくAに戻る。
  assert.doesNotMatch(render("lost", {piece:{...corpse,originalRank:undefined,mark:undefined}}), /撃破時/);
  const fromAce={...corpse,originalRank:"A"};
  assert.match(render("lost",{piece:fromAce}), /A<small>♠<\/small>/);
  const recycled = replenishReserve(discardCards({...state,reserve:[],discardPile:[],winner:null},[fromAce]));
  assert.equal(recycled.reserve[0].rank,"A");
} finally {
  fs.rmSync(dir, { recursive:true, force:true });
}
console.log("昇格のスート表示・全5サイズ・スキン・撃破時の原札・繰り返し昇格・再登場後の履歴・伏せ札保護: OK");
