/**
 * 場面と曲の対応を確かめる。
 *
 *   node tools/check-bgm.mjs
 *
 * 曲そのものは鳴らさない。どの場面でどれを選ぶかだけを見る。
 * 音源が揃っているかも、ここで一緒に数える。
 */
import fs from "node:fs";
import { SOUNDS, TICK_AT_MS, warnLevel } from "../src/audio/sounds.js";
import {
  AUDIO_DIR,
  ENDGAME_CLOCK_MS,
  TRACKS,
  isEndgame,
  trackForScene,
} from "../src/audio/tracks.js";

let failed = 0;
function is(got, want, label) {
  if (got === want) return;
  failed++;
  console.error(`× ${label}: ${want} のはずが ${got}`);
}

// --- 画面ごと ---
for (const screen of ["home", "matching", "tutorial", "rules"])
  is(trackForScene({ screen }), "title", `${screen} は表題の曲`);
for (const screen of ["online", "room"])
  is(trackForScene({ screen }), "waiting", `${screen} は待機の曲`);

// --- 対局の進み具合ごと ---
for (const phase of ["intro", "dice", "mulligan", "setup"])
  is(trackForScene({ screen: "game", phase }), "setup", `${phase} は布陣の曲`);
is(trackForScene({ screen: "game", phase: "play" }), "battle", "対局は対局の曲");
is(
  trackForScene({ screen: "game", phase: "play", endgame: true }),
  "endgame",
  "終盤は終盤の曲",
);
is(
  trackForScene({ screen: "game", phase: "gameover", result: "win" }),
  "win",
  "勝ちは勝ちの曲",
);
is(
  trackForScene({ screen: "game", phase: "gameover", result: "lose" }),
  "lose",
  "負けは負けの曲",
);
// 1台の端末で交互に指す対戦は勝ち負けを分けない
is(
  trackForScene({ screen: "game", phase: "gameover" }),
  "win",
  "勝敗を分けない対局は勝ちの曲",
);

// --- 終盤かどうか。公開されている情報だけで決まっていること ---
const pieces = {};
for (let i = 0; i < 10; i++) pieces[i] = { alive: true, isKing: i === 0 };
is(isEndgame({ pieces }, [300000, 300000]), false, "駒も時間も残っていれば終盤ではない");
is(isEndgame({ pieces }, [300000, ENDGAME_CLOCK_MS]), true, "持ち時間が尽きかけたら終盤");
const few = {};
for (let i = 0; i < 10; i++) few[i] = { alive: i < 3 };
is(isEndgame({ pieces: few }, [300000, 300000]), true, "駒が減ったら終盤");
// 王が倒れかけていても、それだけでは曲を変えない(伏せた王の正体が漏れる)
const kingHurt = {};
for (let i = 0; i < 10; i++) kingHurt[i] = { alive: true, isKing: i === 0, hp: i === 0 ? 1 : 9 };
is(isEndgame({ pieces: kingHurt }, [300000, 300000]), false, "王の具合では曲を変えない");

// --- 音源が揃っているか ---
for (const [id, track] of Object.entries(TRACKS)) {
  const file = `assets/${AUDIO_DIR}${track.file}`;
  if (fs.existsSync(file)) continue;
  failed++;
  console.error(`× ${id} の音源がない: ${file}`);
}
for (const [id, sound] of Object.entries(SOUNDS)) {
  const file = `assets/${AUDIO_DIR}${sound.file}`;
  if (fs.existsSync(file)) continue;
  failed++;
  console.error(`× 効果音 ${id} の音源がない: ${file}`);
}

// --- 効果音は短いこと。長いと操作から遅れて聞こえる ---
for (const [id, sound] of Object.entries(SOUNDS)) {
  const file = `assets/${AUDIO_DIR}${sound.file}`;
  if (!fs.existsSync(file)) continue;
  const kb = fs.statSync(file).size / 1024;
  if (kb <= 60) continue;
  failed++;
  console.error(`× 効果音 ${id} が大きすぎる: ${kb.toFixed(0)}KB`);
}

// --- 残り時間の知らせ ---
is(warnLevel(null), 0, "時計が無ければ知らせない");
is(warnLevel(5 * 60 * 1000), 0, "たっぷり残っていれば知らせない");
is(warnLevel(30 * 1000), 1, "残り30秒でひとつめ");
is(warnLevel(29 * 1000), 1, "30秒を切ってもひとつめのまま");
is(warnLevel(10 * 1000), 2, "残り10秒でふたつめ");
is(warnLevel(0), 2, "使い切っても数は増えない");
// 手番ごとに10秒足されて時間が戻ったら、また同じ区切りで鳴らせる
is(warnLevel(31 * 1000), 0, "時間が戻れば元に戻る");

// --- 知らせる区切りは、少ないほうへ向かって並んでいること ---
for (let i = 1; i < TICK_AT_MS.length; i++)
  is(
    TICK_AT_MS[i] < TICK_AT_MS[i - 1],
    true,
    "残り時間の区切りは短くなる順に並ぶ",
  );

if (failed) {
  console.error(`\n${failed}件おかしい`);
  process.exit(1);
}
console.log(
  `場面と曲の対応、曲${Object.keys(TRACKS).length}本、効果音${Object.keys(SOUNDS).length}本、どれも問題なし`,
);
