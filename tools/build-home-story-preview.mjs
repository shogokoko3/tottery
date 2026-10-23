/** 実際の GameShell/MenuScreen を使い、全話の背景を切り替えられる確認用画面を作る。 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { build, transform } from "esbuild";
import { STORY_AXES, PHASE_EPOCH } from "../src/game/phase.js";
import { STORY_HOME_SCENES, storyHomeTheme } from "../src/skins/home-story-themes.js";
import { phaseHomeTheme } from "../src/skins/home-phase-themes.js";

const report = path.resolve("reports/home-story-20261023");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "home-story-preview-"));
const output = process.argv[2] ? path.resolve(process.argv[2]) : path.join(report, "preview-fragment.html");
fs.mkdirSync(report, { recursive: true });
try {
  const outfile = path.join(temporary, "view.cjs");
  await build({
    stdin: {
      resolveDir: process.cwd(), loader: "jsx",
      contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {GameShell,MenuScreen,HomeLearningMenu} from './src/ui/screens.jsx';
import {updateCollection} from './src/skins/store.js';
import {storyTileNote} from './src/ui/story.jsx';
const noop=()=>{};
export const note=storyTileNote;
export const renderHome=async(profile)=>{
localStorage.setItem('tottery.account.v1',JSON.stringify(profile));
await updateCollection(()=>({tickets:30,gems:0,owned:{'elf-male':1},homeTheme:'default'}));
return renderToStaticMarkup(<GameShell title="トッタリー" setShowRules={noop} topLeft={<HomeLearningMenu onPhaseGuide={noop} onWelcomeComic={noop}/>}><MenuScreen onPlay={noop} onStory={noop} onTutorial={noop} onTsume={noop} onSkins={noop} onBattlePass={noop} onMissions={noop} onCards={noop} onShop={noop} onLetters={noop}/></GameShell>);
};`,
    },
    bundle: true, platform: "node", format: "cjs", jsx: "automatic", outfile, logLevel: "silent",
    define: { __FIELD_FILES__: "{}", __BUILD_VERSION__: '"preview"' },
    loader: { ".css": "text", ".png": "dataurl", ".jpg": "dataurl", ".webp": "dataurl", ".mp4": "dataurl", ".mp3": "dataurl", ".svg": "dataurl" },
  });
  const noop = () => {};
  const memory = new Map();
  Object.assign(globalThis, {
    localStorage: { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: (key) => memory.delete(key) },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
    requestAnimationFrame: (fn) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout,
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 2, scrollTo: noop,
    location: { protocol: "http:", hostname: "localhost", host: "localhost", href: "http://localhost/", search: "", origin: "http://localhost", pathname: "/" },
    document: {
      addEventListener: noop, removeEventListener: noop, visibilityState: "visible", hidden: false,
      body: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, appendChild: noop, removeChild: noop },
      documentElement: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, setAttribute: noop, getAttribute: () => null },
      createElement: () => ({ style: {}, setAttribute: noop, getAttribute: () => null, appendChild: noop, remove: noop, getContext: () => null, classList: { add: noop, remove: noop } }),
      querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
      head: { appendChild: noop }, fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
    },
  });
  globalThis.window = globalThis;
  globalThis.Image ||= class { set src(_) {} };
  globalThis.Audio ||= class { play() {} pause() {} };
  const { renderHome, note } = createRequire(import.meta.url)(outfile);
  const fixtures = [];
  const previewScenes = [];
  for (const scene of STORY_HOME_SCENES) {
    const profile = { id: "home-preview", name: "ニノ", phase: scene.phase, phaseEpoch: PHASE_EPOCH, story: { [scene.phase]: STORY_AXES.slice(0, scene.chapter - 1) } };
    const theme = storyHomeTheme(profile);
    fixtures.push({ id: `${scene.phase}-${scene.axis}`, html: await renderHome(profile) });
    const thumbnail = path.join(temporary, `${scene.phase}-${scene.axis}.webp`);
    execFileSync("cwebp", ["-quiet", "-q", "65", "-resize", "420", "280", `assets/${scene.file}`, "-o", thumbnail]);
    previewScenes.push({ ...scene, accent: theme.accent, panel: theme.panel, secondary: theme.secondary, note: note(profile), image: `data:image/webp;base64,${fs.readFileSync(thumbnail).toString("base64")}` });
  }
  fs.writeFileSync(path.join(report, "home-fixtures.json"), JSON.stringify(fixtures));
  let screen = fixtures[0].html;
  const css = screen.match(/<style>([\s\S]*?)<\/style>/)[1];
  screen = screen.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<link[^>]*>/g, "");
  screen = screen.replace(/((?:src|href)=")([^"]+)(")/g, (full, prefix, file, suffix) => {
    if (file.startsWith("data:")) {
      if (!file.startsWith("data:image/png;base64,")) return full;
      const source = path.join(temporary, "gem.png");
      const thumbnail = path.join(temporary, "gem.webp");
      fs.writeFileSync(source, Buffer.from(file.split(",")[1], "base64"));
      execFileSync("cwebp", ["-quiet", "-q", "84", "-resize", "128", "128", source, "-o", thumbnail]);
      return `${prefix}data:image/webp;base64,${fs.readFileSync(thumbnail).toString("base64")}${suffix}`;
    }
    if (file === STORY_HOME_SCENES[0].file) return `${prefix}${previewScenes[0].image}${suffix}`;
    const asset = path.resolve("assets", file);
    if (!fs.existsSync(asset)) throw new Error(`Preview asset missing: ${file}`);
    return `${prefix}data:image/${file.endsWith(".svg") ? "svg+xml" : path.extname(file).slice(1)};base64,${fs.readFileSync(asset).toString("base64")}${suffix}`;
  });
  screen = screen.replaceAll(STORY_HOME_SCENES[0].file, previewScenes[0].image);
  screen = screen.replace(/<img class="home-frame-[^>]*>/g, (tag) => tag.replace(/src="[^"]*"/, 'src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="'));
  screen = screen.replace(/--home-decoration:url\(&quot;[^;]+?&quot;\)/g, '--home-decoration:none');
  const frames = Object.fromEntries([1, 2, 3].map((phase) => [phase, Object.fromEntries(["corner", "crest", "rail"].map((key) => [key, `data:image/svg+xml;base64,${fs.readFileSync(`assets/${phaseHomeTheme(phase).assets[key]}`).toString("base64")}`]))]));
  const minified = await transform(css, { loader: "css", minify: true });
  let productCss = `@scope (#tottery-story-preview){${minified.code}}`;
  // The preview contains the same components and layout at a mobile viewport size.
  productCss += `#tottery-story-preview .tt-story-stage{padding:16px 0}#tottery-story-preview .tt-story-phone{width:100%;max-width:390px;margin:auto;background:#081120;border:1px solid #665b46;border-radius:18px;overflow:hidden;box-sizing:border-box}#tottery-story-preview .tt-story-phone .tottery-root{height:760px;min-height:0;padding-top:0;padding-bottom:0;--top-bar-h:0px;display:flex;flex-direction:column}#tottery-story-preview .tt-story-phone .top-bar{position:relative;inset:auto;flex:none;width:100%;box-sizing:border-box;padding-inline:12px;min-height:62px}#tottery-story-preview .tt-story-phone .stage{flex:1;min-height:0;padding:0;display:flex;overflow:hidden}#tottery-story-preview .tt-story-phone .home-wrap{width:100%;box-sizing:border-box;margin:0}#tottery-story-preview .tt-story-phone .build-tag{display:none}#tottery-story-preview .tt-story-phone .home-realm-portrait{max-height:230px}#tottery-story-preview .tt-story-phone .home-realm-king{animation:none}#tottery-story-preview .tt-story-phone button{font-family:inherit}@media(max-width:360px){#tottery-story-preview .tt-story-phone .tottery-root{height:740px}#tottery-story-preview .tt-story-phone .home-realm-portrait{max-height:175px}}`;
  screen = screen.replace(/\bbtn\b/g, "tt-btn");
  productCss = productCss.replace(/\bbtn\b/g, "tt-btn");
  const template = fs.readFileSync(path.join(report, "preview-fragment.template.html"), "utf8");
  const fragment = template.replace("/* PRODUCT_STYLES */", productCss).replace("<!-- PRODUCT_SCREEN -->", screen)
    .replace("/* SCENE_DATA */ []", JSON.stringify(previewScenes)).replace("/* FRAME_DATA */ {}", JSON.stringify(frames))
    .replace("<!-- CHAPTER_OPTIONS -->", previewScenes.filter((scene) => scene.phase === 1).map((scene) => `<option value="${scene.chapter}">第${scene.chapter}話 · ${scene.title}</option>`).join("\n"));
  console.log(JSON.stringify({cssBytes:Buffer.byteLength(productCss),scenesBytes:Buffer.byteLength(JSON.stringify(previewScenes)),screenBytes:Buffer.byteLength(screen)}));
  if (Buffer.byteLength(fragment) >= 1_000_000) throw new Error(`Inline preview too large: ${Buffer.byteLength(fragment)}`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, fragment);
  console.log(`Home preview: ${previewScenes.length} scenes, ${Math.round(Buffer.byteLength(fragment) / 1024)} KiB, ${output}`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
