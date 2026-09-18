import { useRef, useState } from "react";
import { ArrowLeft, Check, Close, Crown, Lock, Sparkle } from "../icons.jsx";
import { SkinModal } from "./skin-modal.jsx";
import { useCollection, updateCollection } from "../skins/store.js";
import { byId } from "../skins/catalog.js";
import {
  HOME_THEMES,
  DEFAULT_HOME_THEME,
  homeThemeOf,
  setHomeTheme,
  unlockedHomeThemes,
  homePortraitOf,
  homePortraitsOf,
  unlockedHomePortraits,
  setHomePortrait,
} from "../skins/home-themes.js";

const asset = (file) => `skins/home-v1/${file}`;
const HOME_PORTRAITS = {
  earth: ["zombie-male", "zombie-female"],
  sea: ["pirate-male", "pirate-female"],
  forest: ["elf-male", "elf-female"],
  ice: ["viking-male", "viking-female"],
  heaven: ["angel-j", "angel-q", "angel-k"],
  hell: ["demon-j", "demon-q", "demon-k"],
};
// Each scene includes its character and environment in one wide illustration.
const HOME_SCENES = {
  "zombie-male": "earth-king.webp",
  "zombie-female": "characters/zombie-female.webp",
  "pirate-male": "sea-king.webp",
  "pirate-female": "characters/pirate-female.webp",
  "elf-male": "characters/elf-male.webp",
  "elf-female": "forest-king.webp",
  "viking-male": "characters/viking-male.webp",
  "viking-female": "ice-king.webp",
  "angel-j": "characters/angel-j.webp",
  "angel-q": "characters/angel-q.webp",
  "angel-k": "heaven-king.webp",
  "demon-j": "characters/demon-j.webp",
  "demon-q": "characters/demon-q.webp",
  "demon-k": "hell-king.webp",
};
function portraitView(theme, id) {
  const skin = byId(id);
  const character = HOME_PORTRAITS[theme.id]?.includes(id) ? skin : null;
  return {
    name: character?.name || theme.name,
    image: asset(character ? HOME_SCENES[id] : `${theme.id}-king.webp`),
    position: "50% 50%",
  };
}
export const findHomeTheme = (id) =>
  HOME_THEMES.find((theme) => theme.id === id);
export function homeThemeStyle(theme) {
  return theme
    ? {
        "--home-accent": theme.accent,
        "--home-surface": theme.panel,
        "--home-decoration": `url("${asset(`${theme.id}-home-decor.webp`)}")`,
      }
    : undefined;
}

export function HomeFrameCorners({ theme, small = false }) {
  if (!theme) return null;
  return (
    <span
      className={`home-frame-corners${small ? " is-small" : ""}`}
      aria-hidden="true"
    >
      {["tl", "tr", "bl", "br"].map((corner) => (
        <img
          key={corner}
          className={`home-frame-corner is-${corner}`}
          src={asset(`frames/${theme.id}-corner.svg`)}
          alt=""
          draggable="false"
        />
      ))}
    </span>
  );
}

export function HomeRealmDecoration({ theme }) {
  if (!theme) return null;
  return (
    <div className="home-realm-decoration" aria-hidden="true">
      <div className="home-realm-background" />
      <div className="home-realm-frame">
        <HomeFrameCorners theme={theme} />
        <img
          className="home-frame-crest"
          src={asset(`frames/${theme.id}-crest.svg`)}
          alt=""
        />
        {["left", "right"].map((side) => (
          <img
            key={side}
            className={`home-frame-rail is-${side}`}
            src={asset(`frames/${theme.id}-rail.svg`)}
            alt=""
          />
        ))}
        <img
          className="home-frame-crest is-bottom"
          src={asset(`frames/${theme.id}-crest.svg`)}
          alt=""
        />
      </div>
    </div>
  );
}

export function HomeRealmPortrait({ theme }) {
  const collection = useCollection();
  if (!theme) return null;
  const portrait = portraitView(theme, homePortraitOf(collection, theme.id));
  return (
    <section
      className="home-realm-portrait"
      aria-label={`${theme.label}のホーム装飾`}
    >
      <img
        className="home-realm-king"
        src={portrait.image}
        alt={portrait.name}
        style={{ objectPosition: portrait.position }}
      />
      <div className="home-realm-caption">
        <span>{theme.title}</span>
        <h2>{portrait.name}</h2>
      </div>
      <HomeFrameCorners theme={theme} />
      <img
        className="home-frame-crest"
        src={asset(`frames/${theme.id}-crest.svg`)}
        alt=""
        aria-hidden="true"
      />
    </section>
  );
}

const ORIGINAL = {
  id: DEFAULT_HOME_THEME,
  label: "標準",
  title: "紺と金のホーム",
  condition: "はじめから使用できます",
};

/**
 * ホームの着せ替え。
 * onApplied を渡すと、決めたあとはそこへ渡す(設定ごと閉じてホームへ戻す。
 * 2026-09-18 本人の指示「着せ替え先を決めたらホーム画面に戻る」)
 */
export function HomeCustomizationModal({ onClose, onApplied = null }) {
  const collection = useCollection();
  const current = homeThemeOf(collection);
  const [selected, setSelected] = useState(current);
  const [portraits, setPortraits] = useState(() => homePortraitsOf(collection));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const scroller = useRef(null);
  const choices = [ORIGINAL, ...HOME_THEMES];
  const unlocked = unlockedHomeThemes(collection);
  const choice = choices.find((item) => item.id === selected) || ORIGINAL;
  const theme = findHomeTheme(choice.id);
  const characters = HOME_PORTRAITS[choice.id];
  const portraitId =
    portraits[choice.id] ||
    homePortraitOf(collection, choice.id) ||
    characters?.[0];
  const portrait = theme && portraitView(theme, portraitId);
  const ownedPortraits = unlockedHomePortraits(collection, choice.id);
  const available =
    unlocked.includes(choice.id) &&
    (!characters || ownedPortraits.includes(portraitId));
  const isCurrent =
    choice.id === current &&
    (!characters || portraitId === homePortraitOf(collection, choice.id));
  const condition = characters
    ? `${byId(portraitId).rank} ${byId(portraitId).name}のフォイルを獲得`
    : choice.condition;
  const apply = async () => {
    if (saving || !available) return;
    setSaving(true);
    setError("");
    try {
      await updateCollection((state) => {
        const next = setHomeTheme(state, choice.id);
        return characters ? setHomePortrait(next, choice.id, portraitId) : next;
      });
      (onApplied || onClose)();
    } catch (err) {
      setError(err.message || "着せ替えを保存できませんでした。");
      setSaving(false);
    }
  };
  return (
    <SkinModal
      label="ホームの着せ替え"
      onClose={onClose}
      className="home-customize-overlay"
    >
      <header className="home-customize-head">
        <div>
          <span className="home-customize-eyebrow">
            帰る場所を、あなたらしく。
          </span>
          <h2>ホームの着せ替え</h2>
        </div>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="着せ替えを閉じる"
        >
          <Close size={20} />
        </button>
      </header>
      <div className="home-customize-scroll" ref={scroller}>
        <p className="home-customize-guide">
          各エリアに対応するフォイルを獲得すると解放されます。
        </p>
        <div
          className="home-customize-preview"
          style={homeThemeStyle(theme)}
          data-home-area={choice.id}
        >
          {theme ? (
            <img
              src={portrait.image}
              alt={`${theme.label}のホーム装飾の見本・${portrait.name}`}
              style={{ objectPosition: portrait.position }}
            />
          ) : (
            <div className="home-original-art">
              <Crown size={48} />
              <span>トッタリー</span>
            </div>
          )}
          <HomeFrameCorners theme={theme} />
          <span className="home-preview-label">
            {choice.label} · {characters ? portrait.name : choice.title}
          </span>
        </div>
        <div
          className={`home-customize-condition${available ? " is-unlocked" : ""}`}
          role="status"
        >
          {available ? <Check size={17} /> : <Lock size={17} />}
          <span>
            {available ? (isCurrent ? "現在使用中" : "解放済み") : condition}
          </span>
        </div>
        {characters && (
          <section
            className="home-characters"
            aria-label="ホームに表示するキャラ"
          >
            <h3>ホームに迎えるキャラ</h3>
            <p>対応するキャラのフォイルで解放</p>
            <div
              className="home-character-grid"
              style={{ "--home-character-count": characters.length }}
            >
              {characters.map((id) => {
                const skin = byId(id);
                const open = ownedPortraits.includes(id);
                const view = portraitView(theme, id);
                return (
                  <button
                    key={id}
                    className={`home-character-option${portraitId === id ? " is-selected" : ""}${open ? "" : " is-locked"}`}
                    aria-label={`${skin.rank} ${skin.name} ${open ? "解放済み" : "未解放"}`}
                    aria-pressed={portraitId === id}
                    disabled={saving}
                    onClick={() => {
                      setPortraits((value) => ({ ...value, [choice.id]: id }));
                      setError("");
                    }}
                  >
                    <span className="home-character-image">
                      <img
                        src={view.image}
                        alt=""
                        style={{ objectPosition: view.position }}
                      />
                      {!open && <Lock size={18} />}
                    </span>
                    <b>{skin.rank}</b>
                    <span>{skin.name}</span>
                    <small>{open ? "解放済み" : "未解放"}</small>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <div
          className="home-theme-grid"
          role="group"
          aria-label="ホーム装飾を選ぶ"
        >
          {choices.map((item) => {
            const open = unlocked.includes(item.id);
            const active = item.id === selected;
            return (
              <button
                key={item.id}
                className={`home-theme-option${active ? " is-selected" : ""}${open ? "" : " is-locked"}`}
                aria-pressed={active}
                aria-label={`${item.label}のホーム ${open ? (item.id === current ? "使用中" : "解放済み") : `未解放・${item.condition}`}`}
                onClick={() => {
                  setSelected(item.id);
                  setError("");
                  if (scroller.current) scroller.current.scrollTop = 0;
                }}
                disabled={saving}
              >
                <span className="home-theme-thumbnail">
                  {item.id === DEFAULT_HOME_THEME ? (
                    <span className="home-original-thumbnail">
                      <Crown size={27} />
                    </span>
                  ) : (
                    <img
                      src={
                        portraitView(
                          item,
                          portraits[item.id] ||
                            homePortraitOf(collection, item.id),
                        ).image
                      }
                      alt=""
                      loading="lazy"
                      style={{
                        objectPosition: portraitView(
                          item,
                          portraits[item.id] ||
                            homePortraitOf(collection, item.id),
                        ).position,
                      }}
                    />
                  )}
                  {!open && (
                    <span className="home-theme-lock">
                      <Lock size={20} />
                    </span>
                  )}
                  {item.id === current && (
                    <span className="home-theme-current">
                      <Check size={12} />
                      使用中
                    </span>
                  )}
                </span>
                <span className="home-theme-name">
                  {item.label}
                  <small>{open ? item.title : "フォイルで解放"}</small>
                </span>
                {active && (
                  <Check className="home-theme-selected-mark" size={16} />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <footer className="home-customize-footer">
        {error && <p role="alert">{error}</p>}
        <button className="btn btn-ghost" onClick={onClose}>
          <ArrowLeft size={17} />
          戻る
        </button>
        <button
          className="btn btn-primary"
          onClick={apply}
          disabled={!available || saving}
        >
          {saving
            ? "保存中…"
            : !available
              ? "未解放"
              : isCurrent
                ? "このまま使う"
                : "この装飾に着せ替える"}
        </button>
      </footer>
    </SkinModal>
  );
}

export function HomeCustomizationButton({ settings = false, onApplied = null }) {
  const collection = useCollection();
  const [open, setOpen] = useState(false);
  const theme = findHomeTheme(homeThemeOf(collection));
  return (
    <>
      <div
        className={
          settings ? "settings-row home-customize-setting" : "home-theme-bar"
        }
      >
        <span>
          {settings
            ? "ホームの着せ替え"
            : theme
              ? `${theme.label}の領域`
              : "あなたのホーム"}
        </span>
        <button
          className={
            settings ? "btn btn-ghost btn-small" : "home-customize-button"
          }
          onClick={() => setOpen(true)}
          aria-label="ホームの着せ替えを開く"
        >
          <Sparkle size={16} />
          着せ替え
        </button>
      </div>
      {open && (
        <HomeCustomizationModal
          onClose={() => setOpen(false)}
          onApplied={() => {
            setOpen(false);
            onApplied && onApplied();
          }}
        />
      )}
    </>
  );
}
