import { useSyncExternalStore } from "react";
import { HOME_MUSIC_CHOICES } from "../audio/home-music-options.js";
import { homeMusicForProfile } from "../audio/home-music.js";
import { homeMusicChoice, setHomeMusicChoice, subscribeHomeMusic } from "../audio/home-music-settings.js";
import { useCollection } from "../skins/store.js";
import { useMissionProfile } from "./mission-profile.js";
import STYLES from "./home-music-settings.css";

export function HomeMusicSettings() {
  const choice = useSyncExternalStore(subscribeHomeMusic, homeMusicChoice, () => "auto");
  const collection = useCollection();
  const [profile] = useMissionProfile();
  const playing = homeMusicForProfile(collection, profile, choice);
  const name = HOME_MUSIC_CHOICES.find((item) => item.id === playing)?.name;
  return (
    <section className="home-music-settings" aria-label="ホームの音楽">
      <style>{STYLES}</style>
      <label className="settings-row home-music-row">
        <span>ホームBGM</span>
        <select aria-label="ホームBGMを選ぶ" value={choice}
          onChange={(event) => setHomeMusicChoice(event.target.value)}>
          {HOME_MUSIC_CHOICES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <p className="settings-note home-music-note">
        {choice === "auto"
          ? "ストーリーの背景では、その背景に関連する曲。それ以外の背景では、標準のホームBGMが流れます。"
          : "背景やストーリーが変わっても、選んだ曲を使い続けます。"}
      </p>
      <p className="home-music-current" role="status">{choice === "auto" ? "おまかせの選曲" : "選択中"}：{name}</p>
    </section>
  );
}
