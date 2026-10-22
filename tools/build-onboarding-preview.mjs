import fs from "node:fs";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { SOUNDS } from "../src/audio/sounds.js";

const welcome = JSON.parse(fs.readFileSync("src/game/welcome-comic.json", "utf8"));
const comicFiles = {};
fs.mkdirSync("story-comics", { recursive: true });
for (const page of welcome.pages) {
  const data = fs.readFileSync(`assets/story/comics/${page.art.sheet}.webp`);
  const name = `${page.art.sheet}.${createHash("sha256").update(data).digest("hex").slice(0,8)}.webp`;
  comicFiles[page.art.sheet] = name;
  if (!fs.existsSync(`story-comics/${name}`)) fs.writeFileSync(`story-comics/${name}`, data);
}
const audioFiles = {};
// Dedicated first-victory paintings use the same served texture paths as the game.
fs.cpSync("assets/skins/summon/first-victory-v1", "skins/summon/first-victory-v1", { recursive: true });
fs.mkdirSync("audio", { recursive: true });
for (const { file } of Object.values(SOUNDS)) {
  if (!file || audioFiles[file]) continue;
  const data = fs.readFileSync(`assets/audio/${file}`);
  const name = file.replace(/\.m4a$/, `.${createHash("sha256").update(data).digest("hex").slice(0,8)}.m4a`);
  audioFiles[file] = name;
  if (!fs.existsSync(`audio/${name}`)) fs.writeFileSync(`audio/${name}`, data);
}
const result = await build({
  entryPoints: ["tools/onboarding-preview.jsx"], bundle: true, write: false,
  format: "iife", target: ["es2020"], jsx: "automatic", minify: true,
  loader: { ".css": "text", ".webp": "dataurl", ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl" },
  define: { __STORY_COMIC_FILES__: JSON.stringify(comicFiles), __AUDIO_FILES__: JSON.stringify(audioFiles), __FIELD_FILES__: "{}", __BUILD_VERSION__: '"onboarding-preview"' },
});
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>トッタリー｜初回体験プレビュー</title></head><body><div id="root"></div><script>${result.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`;
fs.writeFileSync("onboarding-preview.html", html);
console.log("onboarding-preview.html を作成しました。本編の起動処理・プロフィール・所持品は変更しません。");
