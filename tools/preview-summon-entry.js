import { createSummonScene } from "../src/skins/summon-scene.js";
import { SUMMON_WORLDS } from "../src/skins/summon-plan.js";
const canvas = document.querySelector("canvas"),
  select = document.querySelector("select"),
  slider = document.querySelector("input"),
  clock = document.querySelector("output"),
  metal = document.querySelector("#metal"),
  play = document.querySelector("#play");
const loading = document.createElement("div");
loading.className = "summon-preview-loading";
loading.setAttribute("role", "status");
loading.setAttribute("aria-live", "polite");
loading.innerHTML =
  '<span class="summon-preview-mark" aria-hidden="true"></span><p>召喚の門を準備中</p><button type="button" hidden>もう一度読み込む</button>';
document.body.append(loading);
const loadingText = loading.querySelector("p"),
  retry = loading.querySelector("button"),
  loadingStyle = document.createElement("style");
loadingStyle.textContent = `
  .summon-preview-loading {position:fixed;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:24px;background:radial-gradient(ellipse at 50% 44%,#162636,#050b13 70%);color:#e6d1a2;font:500 14px/1.8 serif;letter-spacing:.12em;text-align:center;pointer-events:none}
  .summon-preview-loading[hidden] {display:none}
  .summon-preview-loading p {margin:0}
  .summon-preview-mark {width:28px;height:28px;transform:rotate(45deg);border:1px solid #c6a86c;outline:1px solid #c6a86c40;outline-offset:7px;background:radial-gradient(#d7ba7840,transparent 72%);box-shadow:0 0 28px #c6a86c25}
  .summon-preview-loading button {pointer-events:auto}
  nav,h1 {z-index:3}
  button:disabled,input:disabled {opacity:.45;cursor:wait}
`;
document.head.append(loadingStyle);
const query = new URLSearchParams(location.search);
for (const [key, item] of Object.entries(SUMMON_WORLDS)) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = item.name;
  select.append(option);
}
select.value = SUMMON_WORLDS[query.get("world")]
  ? query.get("world")
  : "heaven";
let gold = query.get("gold") === "1",
  scene,
  raf,
  loadingTimer,
  generation = 0,
  ready = false,
  last = 3000;
if (query.has("time"))
  last = Math.max(0, Math.min(9000, Number(query.get("time"))));
function resize() {
  scene?.resize(innerWidth, innerHeight);
  if (ready) draw(last);
}
function draw(t) {
  if (!ready || !scene) return;
  last = t;
  scene.render(t);
  slider.value = t;
  clock.textContent = `${(t / 1000).toFixed(2)}秒`;
}
function remake() {
  cancelAnimationFrame(raf);
  clearTimeout(loadingTimer);
  const currentGeneration = ++generation;
  scene?.dispose();
  scene = undefined;
  ready = false;
  canvas.style.visibility = "hidden";
  play.disabled = slider.disabled = true;
  loading.hidden = false;
  retry.hidden = true;
  loadingText.textContent = "召喚の門を準備中";
  clock.textContent = "準備中";
  document.querySelector("h1").textContent = SUMMON_WORLDS[select.value].name;
  metal.textContent = gold ? "金の門" : "銅の門";
  const failed = () => {
    if (currentGeneration !== generation) return;
    clearTimeout(loadingTimer);
    scene?.dispose();
    scene = undefined;
    ready = false;
    loadingText.textContent = "召喚の門を読み込めませんでした";
    clock.textContent = "読み込み失敗";
    retry.hidden = false;
  };
  loadingTimer = setTimeout(failed, 15000);
  try {
    const currentScene = createSummonScene(canvas, {
      world: select.value,
      gold,
      count: 10,
    });
    scene = currentScene;
    resize();
    currentScene.ready
      .then(() => {
        if (currentGeneration !== generation || scene !== currentScene) return;
        clearTimeout(loadingTimer);
        ready = true;
        draw(last);
        canvas.style.visibility = "visible";
        loading.hidden = true;
        play.disabled = slider.disabled = false;
      })
      .catch(failed);
  } catch {
    failed();
  }
}
retry.onclick = remake;
select.onchange = remake;
metal.onclick = () => {
  gold = !gold;
  remake();
};
slider.oninput = () => {
  cancelAnimationFrame(raf);
  draw(Number(slider.value));
};
play.onclick = () => {
  if (!ready) return;
  cancelAnimationFrame(raf);
  const start = performance.now();
  function tick(now) {
    draw(Math.min(9000, now - start));
    if (now - start < 9000) raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
};
window.addEventListener("resize", resize);
remake();
