import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TotteryApp } from "./ui/screens.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TotteryApp />
  </StrictMode>,
);
