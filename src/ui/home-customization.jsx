import { useState } from "react";
import { ArrowLeft, Check, Close, Crown, Lock, Sparkle } from "../icons.jsx";
import { SkinModal } from "./skin-modal.jsx";
import { useCollection, updateCollection } from "../skins/store.js";
import {
  HOME_THEMES,
  DEFAULT_HOME_THEME,
  homeThemeOf,
  setHomeTheme,
  unlockedHomeThemes,
} from "../skins/home-themes.js";

const asset = (file) => `skins/home-v1/${file}`;
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
  if (!theme) return null;
  return (
    <section
      className="home-realm-portrait"
      aria-label={`${theme.label}のホーム装飾`}
    >
      <img
        className="home-realm-king"
        src={asset(`${theme.id}-king.webp`)}
        alt={theme.name}
      />
      <div className="home-realm-caption">
        <span>{theme.title}</span>
        <h2>{theme.name}</h2>
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

export function HomeCustomizationModal({ onClose }) {
  const collection = useCollection();
  const current = homeThemeOf(collection);
  const [selected, setSelected] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const choices = [ORIGINAL, ...HOME_THEMES];
  const unlocked = unlockedHomeThemes(collection);
  const choice = choices.find((item) => item.id === selected) || ORIGINAL;
  const available = unlocked.includes(choice.id);
  const theme = findHomeTheme(choice.id);
  const apply = async () => {
    if (saving || !available) return;
    setSaving(true);
    setError("");
    try {
      await updateCollection((state) => setHomeTheme(state, choice.id));
      onClose();
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
      <div className="home-customize-scroll">
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
              src={asset(`${theme.id}-king.webp`)}
              alt={`${theme.label}のホーム装飾の見本`}
            />
          ) : (
            <div className="home-original-art">
              <Crown size={48} />
              <span>トッタリー</span>
            </div>
          )}
          <HomeFrameCorners theme={theme} />
          <span className="home-preview-label">
            {choice.label} · {choice.title}
          </span>
        </div>
        <div
          className={`home-customize-condition${available ? " is-unlocked" : ""}`}
          role="status"
        >
          {available ? <Check size={17} /> : <Lock size={17} />}
          <span>
            {available
              ? choice.id === current
                ? "現在使用中"
                : "解放済み"
              : choice.condition}
          </span>
        </div>
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
                      src={asset(`${item.id}-king.webp`)}
                      alt=""
                      loading="lazy"
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
              : choice.id === current
                ? "このまま使う"
                : "この装飾に着せ替える"}
        </button>
      </footer>
    </SkinModal>
  );
}

export function HomeCustomizationButton({ settings = false }) {
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
            ? "ホームの装飾"
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
      {open && <HomeCustomizationModal onClose={() => setOpen(false)} />}
    </>
  );
}
