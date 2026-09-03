import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { armAudioUnlock } from "./audio/index.js";
import { TotteryApp } from "./ui/screens.jsx";

// 音は最初に画面を触るまで鳴らせない決まりになっている。
// 最初のタップを待ち受けて、そこで解錠する
armAudioUnlock();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TotteryApp />
  </StrictMode>,
);
