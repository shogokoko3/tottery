import { createSummonScene } from "../src/skins/summon-scene.js";
import { SUMMON_WORLDS } from "../src/skins/summon-plan.js";
const canvas = document.querySelector("canvas"),
  select = document.querySelector("select"),
  slider = document.querySelector("input"),
  clock = document.querySelector("output"),
  metal = document.querySelector("#metal"),
  play = document.querySelector("#play");
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
  last = 3000;
if (query.has("time"))
  last = Math.max(0, Math.min(9000, Number(query.get("time"))));
function resize() {
  scene.resize(innerWidth, innerHeight);
  draw(last);
}
function draw(t) {
  last = t;
  scene.render(t);
  slider.value = t;
  clock.textContent = `${(t / 1000).toFixed(2)}秒`;
}
function remake() {
  cancelAnimationFrame(raf);
  scene?.dispose();
  scene = createSummonScene(canvas, { world: select.value, gold, count: 10 });
  document.querySelector("h1").textContent = SUMMON_WORLDS[select.value].name;
  metal.textContent = gold ? "金の門" : "銅の門";
  resize();
  scene.ready.then(() => draw(last));
}
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
