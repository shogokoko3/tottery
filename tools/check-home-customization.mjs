// Exercise the real chooser's handlers; layout is covered separately by the CSS/home checks.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { normalize } from "../src/skins/collection.js";
import { setPhaseHome, homeThemeForProfile } from "../src/skins/home-themes.js";
import { STORY_AXES } from "../src/game/phase.js";

const mocks = {
  react: `export const Fragment="fragment";export const useState=v=>globalThis.homeChooser.state(v);export const useRef=v=>globalThis.homeChooser.ref(v);`,
  "react/jsx-runtime": `export const Fragment="fragment";export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
  "../audio/index.js": `export const playSound=()=>{};`,
  "./skin-modal.jsx": `export const SkinModal="dialog";`,
  "./mission-profile.js": `export const useMissionProfile=()=>[globalThis.homeChooser.profile];`,
  "../skins/store.js": `export const useCollection=()=>globalThis.homeChooser.collection;export const updateCollection=f=>globalThis.homeChooser.update(f);`,
};
const bundle = await build({
  entryPoints: ["src/ui/home-customization.jsx"], bundle: true, write: false,
  platform: "node", format: "esm", jsx: "automatic", logLevel: "silent",
  plugins: [{ name: "chooser-boundaries", setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) =>
      mocks[args.path] && (args.path.startsWith("react") || args.importer.endsWith("/src/ui/home-customization.jsx"))
        ? { path: args.path, namespace: "chooser-fixture" } : undefined);
    builder.onLoad({ filter: /.*/, namespace: "chooser-fixture" }, (args) => ({ contents: mocks[args.path], loader: "js" }));
  } }],
});
const { HomeCustomizationModal } = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
let values = [], cursor = 0, applied = 0, closed = 0, failSave = false;
const fixture = globalThis.homeChooser = {
  profile: { phase: 2, story: { 2: ["23", "45"] } },
  collection: normalize(null),
  state(initial) {
    const i = cursor++;
    if (!(i in values)) values[i] = typeof initial === "function" ? initial() : initial;
    return [values[i], (next) => { values[i] = typeof next === "function" ? next(values[i]) : next; }];
  },
  ref(initial) { const i = cursor++; return values[i] ||= { current: initial }; },
  async update(change) {
    if (failSave) throw new Error("保存できませんでした");
    fixture.collection = normalize(change(fixture.collection));
    return fixture.collection;
  },
};
for (const phase of [1, 2, 3]) fixture.collection = normalize(setPhaseHome(fixture.collection, phase, `phase-${phase}`));
const render = () => { cursor = 0; return HomeCustomizationModal({ onClose: () => closed++, onApplied: () => applied++ }); };
const nodes = (value, out = []) => {
  if (Array.isArray(value)) value.forEach((child) => nodes(child, out));
  else if (value && typeof value === "object") { out.push(value); nodes(value.props?.children, out); }
  return out;
};
const text = (value) => Array.isArray(value) ? value.map(text).join("") : value && typeof value === "object" ? text(value.props?.children) : value == null || typeof value === "boolean" ? "" : String(value);
const button = (tree, label) => {
  const found = nodes(tree).find((node) => node.type === "button" && (node.props["aria-label"] === label || text(node).startsWith(label)));
  assert.ok(found, `Button: ${label}`);
  return found;
};
const preview = (tree) => nodes(tree).find((node) => node.props?.["data-home-area"])?.props["data-home-area"];
const click = async (label) => { const target = button(render(), label); assert.ok(!target.props.disabled); await target.props.onClick(); return render(); };

const before = structuredClone(fixture.collection);
assert.equal(button(render(), "背景を選ぶ").props["aria-pressed"], true);
assert.equal(preview(render()), "phase-2");
let tree = await click("ストーリーに連動");
assert.equal(button(tree, "ストーリーに連動").props["aria-pressed"], true);
assert.equal(preview(tree), "phase-2-story-67");
assert.match(text(tree), /フェーズ2 \/ 第3話/);
assert.match(text(tree), /裂かれた本/);
assert.ok(!nodes(tree).some((node) => node.props?.className === "home-theme-grid"), "Automatic mode shows the current story instead of the fixed gallery");
assert.deepEqual(fixture.collection, before, "Previewing a mode never saves it");
await click("ストーリー連動を使う");
assert.equal(applied, 1);
assert.equal(homeThemeForProfile(fixture.collection, fixture.profile).axis, "67");
assert.deepEqual(fixture.collection.phaseHomes[1], before.phaseHomes[1]);
assert.deepEqual(fixture.collection.phaseHomes[3], before.phaseHomes[3]);
assert.equal(closed, 0);

values = [];
assert.equal(button(render(), "ストーリーに連動").props["aria-pressed"], true, "Reopening restores automatic mode");
fixture.profile.story[2].push("67");
assert.equal(preview(render()), "phase-2-story-89", "Preview follows new story progress");
await click("背景を選ぶ");
assert.equal(preview(render()), "phase-2", "First manual selection uses an unlocked phase cover");
await click("フェーズ3のホーム 解放済み");
assert.equal(preview(render()), "phase-3");
await click("ストーリーに連動");
await click("背景を選ぶ");
assert.equal(preview(render()), "phase-3", "Toggling back keeps the chosen fixed background");
await click("フェーズ1");
assert.equal(preview(render()), "phase-1");
await click("フェーズ2");
assert.equal(preview(render()), "phase-2-story-89", "Changing phase loads that phase's saved mode");
await click("背景を選ぶ");
failSave = true;
await click("この装飾に着せ替える");
assert.match(text(render()), /保存できませんでした/);
assert.equal(applied, 1);
assert.equal(homeThemeForProfile(fixture.collection, fixture.profile).axis, "89");
failSave = false;
await click("この装飾に着せ替える");
assert.equal(applied, 2);
fixture.profile.story[2].push("89");
assert.equal(homeThemeForProfile(fixture.collection, fixture.profile).id, "phase-3", "Fixed mode does not follow progress");

values = [];
fixture.profile.story[2] = [...STORY_AXES];
await click("ストーリーに連動");
assert.equal(preview(render()), "phase-2-story-k");
assert.match(text(render()), /全話クリア済み/);
const saved = structuredClone(fixture.collection);
await click("戻る");
assert.deepEqual(fixture.collection, saved, "Closing without applying keeps the saved background");
assert.equal(closed, 1);
delete globalThis.homeChooser;
console.log("着せ替え: 連動/固定の切り替え・進行プレビュー・適用/取消・保存復元・フェーズ分離・保存失敗からの再試行を確認");
