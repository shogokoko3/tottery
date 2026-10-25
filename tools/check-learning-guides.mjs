import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { WELCOME_COMIC_PAGES } from "../src/game/welcome-comic.js";
import welcomeSource from "../src/game/welcome-comic.json" with { type: "json" };
import { episodeAccess } from "../src/game/story-narrative.js";

const fresh = { phase: 1, story: { 1: [], 2: [], 3: [] }, phaseWins: {} };
assert.equal(WELCOME_COMIC_PAGES.length, 4);
const teachingPages = WELCOME_COMIC_PAGES.filter((p) => p.art);
assert.equal(teachingPages.length, 3);
assert.deepEqual(
  teachingPages.map((page) => page.topic),
  ["setup", "movement", "victory"],
);
assert.equal(welcomeSource.production.dialogueStart, "top-right");
assert.equal(
  welcomeSource.production.leftStartAllowedFor,
  "scene-setting-caption-only",
);
const reviewed = JSON.parse(
  fs.readFileSync(welcomeSource.production.review, "utf8"),
);
const sha256 = (path) =>
  createHash("sha256").update(fs.readFileSync(path)).digest("hex");
for (const page of teachingPages) {
  assert.ok(
    page.art.sheet.startsWith(
      page.topic === "setup" ? "tottery-welcome-v2-" : "tottery-welcome-v3-",
    ),
    "初回案内専用の新作を使う",
  );
  assert.ok(fs.existsSync(page.art.source));
  assert.ok(fs.existsSync(`assets/story/comics/${page.art.sheet}.webp`));
  assert.equal(sha256(page.art.source), page.art.pngSHA256);
  assert.equal(
    sha256(`assets/story/comics/${page.art.sheet}.webp`),
    page.art.sha256,
  );
  const review = reviewed.pages.find((item) => item.id === page.id);
  assert.equal(
    review?.pngSHA256,
    page.art.pngSHA256,
    "実見した画像と採用画像が同じ",
  );
  assert.equal(review.panels.length, page.panels.length);
  page.panels.forEach((panel, index) => {
    const dialogue = panel.lines.filter((line) => line.kind === "dialogue");
    assert.equal(dialogue[0].placement, "top-right");
    assert.ok(
      panel.lines.every(
        (line) =>
          line.placement !== "top-left" ||
          line.kind === "scene-setting-caption",
      ),
    );
    assert.equal(review.panels[index].firstDialogue, dialogue[0].text);
    assert.equal(review.panels[index].startsTopRight, true);
    assert.equal(review.panels[index].tailsMatchSpeakers, true);
    assert.equal(review.panels[index].status, "pass");
  });
}
assert.ok(
  !fs
    .readFileSync("src/game/welcome-comic.js", "utf8")
    .includes("story-comics.json"),
  "本編から説明ページを抜き出さない",
);
assert.equal(
  episodeAccess(fresh, "k", 3).available,
  false,
  "初回漫画の閲覧で最終章を解放しない",
);
const movement = teachingPages.find((page) => page.topic === "movement");
const victory = teachingPages.find((page) => page.topic === "victory");
const pageText = (page) =>
  page.panels
    .flatMap((panel) => panel.lines)
    .map((line) => line.text)
    .join("");
assert.match(pageText(movement), /動き方は、カードごとに決まっている/);
assert.match(pageText(movement), /2は縦横に1マス/);
assert.match(pageText(movement), /3は斜めに1マス/);
assert.doesNotMatch(pageText(movement), /君の勝ち|王を取れば勝ち/);
assert.match(pageText(victory), /相手の王を取れば勝ち/);
assert.doesNotMatch(pageText(victory), /2は縦横|3は斜め/);
const bridge = WELCOME_COMIC_PAGES.at(-1)
  .panels.flatMap((p) => p.lines)
  .map((l) => l.text)
  .join("");
assert.match(bridge, /王以外の札なら、勝負は続く/);
assert.match(bridge, /交互に1枚ずつ/);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-learning-"));
try {
  const outfile = path.join(dir, "render.cjs");
  await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "jsx",
      contents: `
      import {renderToStaticMarkup} from 'react-dom/server';
      import {PhaseGuide} from './src/ui/phase-guide.jsx';
      import {WelcomeComic} from './src/ui/welcome-comic.jsx';
      export const phase = profile => renderToStaticMarkup(<PhaseGuide profile={profile} onBack={()=>{}} />);
      export const comic = firstRun => renderToStaticMarkup(<WelcomeComic firstRun={firstRun} onDone={()=>{}} />);
    `,
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    outfile,
    logLevel: "silent",
    define: { __FIELD_FILES__: "{}", __BUILD_VERSION__: '"check"' },
    loader: {
      ".css": "text",
      ".png": "dataurl",
      ".webp": "dataurl",
      ".jpg": "dataurl",
      ".mp4": "dataurl",
      ".svg": "dataurl",
    },
  });
  globalThis.localStorage = {
    getItem: () => null,
    setItem() {},
    removeItem() {},
  };
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    location: { search: "" },
  };
  const render = createRequire(import.meta.url)(outfile);
  const first = render.phase(fresh);
  assert.equal(
    (first.match(/class="md-cell [^"]*md-reach/g) || []).length,
    4,
    "力なしの2は縦横1マス",
  );
  assert.match(first, /0.*\/.*7.*クリア/s);
  assert.match(first, /0.*\/.*5.*勝/s);
  assert.match(first, /王も基本の動きだけで遊びます/);
  assert.match(
    first,
    /aria-pressed="false"[^>]*>.*フェーズ.*2/s,
    "未到達の説明も選択できる",
  );
  const second = render.phase({ ...fresh, phase: 2 });
  assert.match(second, /縦横3マスまで/);
  assert.equal(
    (second.match(/class="md-cell [^"]*md-reach/g) || []).length,
    16,
    "2を1枚採用した王の図は4方向3マスと、比較用の基本4マス",
  );
  // 2026-10-25 本人の指示でフェーズ2 はストーリーもオンラインも 5×5。王の力はストーリーではあなたの王だけ
  assert.match(second, /<dt>ストーリーの盤<\/dt><dd>5×5<\/dd>/);
  assert.match(second, /<dt>オンラインの盤<\/dt><dd>5×5<\/dd>/);
  assert.doesNotMatch(second, /9×9/);
  assert.match(second, /あり\(ストーリーはあなたの王だけ\)/);
  const third = render.phase({ ...fresh, phase: 3 });
  assert.match(third, /5×5ではエリア効果を使いません/);
  assert.match(third, /フォイルを持っているだけでは発動しません/);
  assert.match(third, /最後のフェーズに到達/);
  assert.doesNotMatch(third, /フェーズ4/);
  assert.match(render.comic(true), /すぐに遊ぶ/);
  assert.match(render.comic(false), /閉じる/);
  assert.equal(episodeAccess(fresh, "k", 3).available, false);
  console.log(
    "初回漫画・実戦への補足・本編のロック維持・3フェーズの説明と進捗・読み返しを確認",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
