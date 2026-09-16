import { useState, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SummonReveal } from "../src/ui/skins.jsx";
import STYLES from "../src/skins/styles.css";
const q = new URLSearchParams(location.search),
  foil = q.get("foil") === "1",
  count = q.get("count") === "1" ? 1 : 10;
const results = Array.from({ length: count }, (_, i) => ({
  id:
    i === 0
      ? `angel-k${foil ? ":foil" : ""}`
      : ["zombie-male", "pirate-female", "elf-male", "viking-female"][i % 4],
  isNew: true,
}));
function Preview() {
  const [run, setRun] = useState(true),
    [key, setKey] = useState(0);
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
      </main>
      {run && (
        <SummonReveal
          key={key}
          results={results}
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
