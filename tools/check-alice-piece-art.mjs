import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {build} from "esbuild";
import {alicePieceArt} from "../src/skins/alice-piece-art.js";
import masks from "../src/skins/alice-extra-foil-masks.js";
const loadout={8:"alice-4-hatter:foil",9:"alice-5-march-hare:foil",J:"alice-J-knave:foil"};
for(const [flags,slug] of [[{tea:true,teaMovement:"orth",aliceKingRank:"8"},"teacup-blue-gold"],[{tea:true,teaMovement:"diag",aliceKingRank:"9"},"teacup-green-copper"],[{soldier:true,aliceKingRank:"J"},"card-soldier"]]){
 for(const foil of [false,true]){
  const art=alicePieceArt(flags,foil?loadout:{});
  assert.equal(art.foil,foil);assert.ok(art.boardCard.endsWith(slug+".png"));
  assert.ok(fs.existsSync("assets/"+art.boardCard));
  assert.ok(masks[art.baseId]?.alpha);
 }
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"tottery-extra-art-"));
try{
 const out=path.join(tmp,"render.cjs");
 await build({stdin:{resolveDir:process.cwd(),loader:"jsx",contents:`
 import {renderToStaticMarkup} from "react-dom/server";
 import {Piece,CapturedCardFace} from "./src/ui/cards.jsx";
 import {SeatsProvider} from "./src/ui/names.jsx";
 export function render(piece,viewer,captured=false){return renderToStaticMarkup(<SeatsProvider value={{skins:[${JSON.stringify(loadout)},{}]}}>{captured?<CapturedCardFace piece={piece}/>:<Piece piece={piece} viewer={viewer} size="xs"/>}</SeatsProvider>);}
 `},bundle:true,platform:"node",format:"cjs",jsx:"automatic",loader:{".css":"text",".png":"dataurl",".webp":"dataurl"},define:{__AUDIO_FILES__:"{}"},outfile:out,logLevel:"silent"});
 const {render}=createRequire(import.meta.url)(out);
 const soldier={rank:"2",suit:"spade",owner:0,soldier:true,aliceKingRank:"J"};
 assert.match(render(soldier,0),/alice-extra-foils-v1\/card-soldier.png/);
 assert.match(render(soldier,0),/data-foil="alice-extra-card-soldier"/);
 assert.match(render(soldier,0),/2<small>♠/);
 assert.match(render(soldier,1),/card-back/);
 assert.doesNotMatch(render(soldier,1),/card-soldier.png/);
 for(const [movement,rank,slug] of [["orth","8","blue-gold"],["diag","9","green-copper"]]){
  const cup={rank:"tea",suit:null,owner:0,tea:true,teaMovement:movement,aliceKingRank:rank};
  assert.match(render(cup,1),new RegExp("alice-extra-foils-v2/teacup-"+slug+".png"));
  assert.doesNotMatch(render(cup,1),/undefined|null/);
  assert.match(render(cup,0,true),new RegExp("teacup-"+slug+".png"));
  assert.doesNotMatch(render(cup,0,true),/<canvas/);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log("Alice piece art: correct normal/foil assets, masks, two cup movements, soldier rank/suit, hidden identity and captured cards OK");
