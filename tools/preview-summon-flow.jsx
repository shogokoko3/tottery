import { warmSummonIntro } from "../src/skins/summon-preload.js";
import { resolveSummonFreeze } from "../src/skins/summon-freeze.js";
import { useEffect, useState, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SummonReveal } from "../src/ui/skins.jsx";
import STYLES from "../src/skins/styles.css";
const q = new URLSearchParams(location.search),
  foil = q.get("foil") === "1",
  count = q.get("count") === "1" ? 1 : 10;
const mixed = [
  "angel-k",
  "demon-q",
  "zombie-male:foil",
  "elf-male",
  "pirate-female",
  "angel-j:foil",
  "viking-female",
  "zombie-female",
  "dragon-knight",
  "demon-k",
];
const original = Array.from({ length: count }, (_, i) => ({
  id:
    q.get("sample") === "mixed"
      ? mixed[i]
      : q.get("sample") === "foil-grid"
        ? i === 8
          ? "angel-k:foil"
          : "zombie-male"
        : i === 0
          ? `angel-k${foil ? ":foil" : ""}`
          : ["zombie-male", "pirate-female", "elf-male", "viking-female"][
              i % 4
            ],
  isNew: true,
}));
const freezeSamples = {
  freeze: ["angel-k", "demon-q", "elf-male", "viking-female", ...Array(6).fill("zombie-male")],
  "freeze-foil": ["angel-k:foil", "elf-female", ...Array(8).fill("pirate-male")],
  "freeze-mixed": ["angel-k", "zombie-female:foil", "elf-male", ...Array(7).fill("pirate-male")],
  "freeze-nofoil": ["angel-k", "demon-q", ...Array(8).fill("zombie-male")],
};
let sampleRoll = 0;
const initial = freezeSamples[q.get("sample")];
const packet = initial ? resolveSummonFreeze(initial, () => q.get("sample") === "freeze-nofoil" ? .9 : sampleRoll++ === 0 ? .1 : .7) : null;
const results = packet ? packet.skins.map(id => ({ id, isNew: true })) : original;
function Preview() {
  const [run, setRun] = useState(q.get("manual") !== "1"),
    [key, setKey] = useState(0);
  useEffect(() => warmSummonIntro(), []);
  useEffect(() => {
    const delay = Number(q.get("autostart"));
    if (!delay) return;
    const timer = setTimeout(() => setRun(true), delay);
    return () => clearTimeout(timer);
  }, []);
  // Visible verification trace: read the same DOM as the player, without
  // reading hidden card data or affecting the animation clock.
  const [trace, setTrace] = useState([]);
  useEffect(() => {
    if (!run) return;
    const began = performance.now(), seen = new Set();
    setTrace([]);
    const observer = new MutationObserver(() => {
      const stage = document.querySelector(".summon-intro");
      if (stage?.getAttribute("aria-busy") === "false" && !seen.has("gate")) {
        seen.add("gate");
        setTrace(t => [...t, `門の開始: ${Math.round(performance.now() - began)}ms`]);
      }
      const title = document.querySelector(".foil-unveiling-name strong")?.textContent;
      if (title && !seen.has(title)) {
        seen.add(title);
        setTrace(t => [...t, `公開: ${title}`]);
      }
    });
    observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ["aria-busy"]});
    return () => observer.disconnect();
  }, [run, key]);
  const [refreshes, setRefreshes] = useState(0);
  const refresh = q.get("refresh") === "1";
  useEffect(() => {
    if (!refresh || !run) return;
    const timer = setInterval(() => setRefreshes(n => n + 1), 900);
    return () => clearInterval(timer);
  }, [refresh, run]);
  return (
    <>
      <style>
        {STYLES}
        {`html,body{margin:0;background:#07121d;color:#f3e3bf;font-family:serif}*{box-sizing:border-box}.fixture-home{padding:36px;text-align:center}.fixture-home button{padding:14px;background:#1d2d40;border:1px solid #b39258;color:#f2d494}`}
      </style>
      <main className="fixture-home">
        <h1>召喚 → カードを並べる</h1>
        <p>購入や所持データは変更しない表示確認です。</p>
        <button
          onClick={() => {
            setKey(key + 1);
            setRun(true);
          }}
        >
          もう一度再生
        </button>
        <p>{run ? "演出中" : "開示完了"}</p>
        <output aria-label="演出確認記録">{trace.join(" → ")}</output>
      </main>
      {refresh && <output style={{ position: "fixed", top: 8, left: 8, zIndex: 7000, fontSize: 11, background: "#07121ddd", padding: 6, pointerEvents: "none" }}>同じ抽選結果でデータ更新：{refreshes}回</output>}
      {run && (
        <SummonReveal
          key={key}
          results={refresh ? results.map(result => ({ ...result })) : results}
          freeze={packet?.freeze}
          drawNumber={Number(q.get("draw") || 0)}
          reduce={q.get("reduce") === "1"}
          onFinish={() => setRun(false)}
        />
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
