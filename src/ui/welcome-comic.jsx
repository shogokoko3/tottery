import { WELCOME_COMIC_PAGES } from "../game/welcome-comic.js";
import { StoryReader } from "./story-chronicle.jsx";
import { L } from "../i18n/index.js";

export function WelcomeComic({ onDone, onClose = onDone, firstRun = false }) {
  return (
    <StoryReader
      axis="prologue"
      onDone={onDone}
      onClose={onClose}
      lesson={{
        title: L("はじめてのトッタリー"),
        pages: WELCOME_COMIC_PAGES,
        closeLabel: firstRun ? L("すぐに遊ぶ") : L("閉じる"),
        doneLabel: firstRun ? L("やってみる") : L("閉じる"),
      }}
    />
  );
}
