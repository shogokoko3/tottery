import { WELCOME_COMIC_PAGES } from "../game/welcome-comic.js";
import { StoryReader } from "./story-chronicle.jsx";

export function WelcomeComic({ onDone, onClose = onDone, firstRun = false }) {
  return (
    <StoryReader
      axis="prologue"
      onDone={onDone}
      onClose={onClose}
      lesson={{
        title: "はじめてのトッタリー",
        pages: WELCOME_COMIC_PAGES,
        closeLabel: firstRun ? "すぐに遊ぶ" : "閉じる",
        doneLabel: firstRun ? "やってみる" : "閉じる",
      }}
    />
  );
}
