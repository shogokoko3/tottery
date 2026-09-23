/**
 * 設定の幕を開く手。GameShell(src/ui/screens.jsx)が持っている設定の札を、
 * 中の画面(ホームの自分の札・プロフィール)から開けるように context で渡す。
 * screens.jsx と profile.jsx が互いを読み合わないよう、ここに切り出してある(2026-09-24)
 */
import { createContext, useContext } from "react";

export const OpenSettings = createContext(null);
export const useOpenSettings = () => useContext(OpenSettings);
