import { STORY_HOME_THEMES, storyHomeProgress, storyHomeTheme, storyHomeThemeById } from "../skins/home-story-themes.js";
import { phaseOf } from "../game/phase.js";
import { useMissionProfile } from "./mission-profile.js";
import { playSound } from "../audio/index.js";
import { Fragment, useRef, useState } from "react";
import { ArrowLeft, Book, Check, Close, Crown, Lock, Sparkle } from "../icons.jsx";
import { SkinModal } from "./skin-modal.jsx";
import { useCollection, updateCollection } from "../skins/store.js";
import { byId } from "../skins/catalog.js";
import {
  phaseHomeOf,
  homeThemeForProfile,
  setPhaseHome,
  HOME_THEMES,
  homeThemeAssets,
  DEFAULT_HOME_THEME,
  homeThemeOf,
  unlockedHomeThemes,
  homePortraitOf,
  homePortraitsOf,
  unlockedHomePortraits,
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
    image: character ? asset(HOME_SCENES[id]) : homeThemeAssets(theme).scene,
    position: "50% 50%",
  };
}
export const findHomeTheme = (id) =>
  HOME_THEMES.find((theme) => theme.id === id) || storyHomeThemeById(id);
export function homeThemeStyle(theme) {
  return theme
    ? {
        "--home-accent": theme.accent,
        "--home-surface": theme.panel,
        ...(theme.secondary ? { "--home-frame": theme.secondary } : {}),
        "--home-decoration": `url("${homeThemeAssets(theme).decoration}")`,
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
          src={homeThemeAssets(theme).corner}
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
          src={homeThemeAssets(theme).crest}
          alt=""
        />
        {["left", "right"].map((side) => (
          <img
            key={side}
            className={`home-frame-rail is-${side}`}
            src={homeThemeAssets(theme).rail}
            alt=""
          />
        ))}
        <img
          className="home-frame-crest is-bottom"
          src={homeThemeAssets(theme).crest}
          alt=""
        />
      </div>
    </div>
  );
}

export function HomeRealmPortrait({ theme }) {
  const source = useCollection();
  const [profile] = useMissionProfile();
  const collection = phaseHomeOf(source, phaseOf(profile));
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
        key={portrait.image}
        style={{ objectPosition: portrait.position }}
      />
      <div className="home-realm-caption">
        <span>{theme.phase ? `PHASE ${theme.phase} · ${theme.subtitle}` : theme.title}</span>
        <h2>{portrait.name}</h2>
      </div>
      <HomeFrameCorners theme={theme} />
      <img
        className="home-frame-crest"
        src={homeThemeAssets(theme).crest}
        alt=""
        aria-hidden="true"
      />
    </section>
  );
}

const ORIGINAL = {
  id: DEFAULT_HOME_THEME,
  label: "ストーリーに連動",
  title: "進行に合わせて背景が変わるホーム",
  condition: "はじめから使用できます",
};

/**
 * ホームの着せ替え。
 * onApplied を渡すと、決めたあとはそこへ渡す(設定ごと閉じてホームへ戻す。
 * 2026-09-18 本人の指示「着せ替え先を決めたらホーム画面に戻る」)
 */
export function HomeCustomizationModal({ onClose, onApplied = null }) {
  const source = useCollection();
  const [profile] = useMissionProfile();
  const [phase, setPhase] = useState(() => phaseOf(profile));
  const collection = phaseHomeOf(source, phase);
  const current = homeThemeOf(collection);
  const [selected, setSelected] = useState(current);
  const [portraits, setPortraits] = useState(() => homePortraitsOf(collection));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const scroller = useRef(null);
  const manualSelections = useRef({});
  const progress = storyHomeProgress({ ...profile, phase });
  const autoTheme = storyHomeTheme({ ...profile, phase });
  const choices = HOME_THEMES;
  const storyChoices = STORY_HOME_THEMES.filter((item) => item.phase === phase);
  const automatic = selected === DEFAULT_HOME_THEME;
  const unlocked = unlockedHomeThemes(collection);
  const choice = findHomeTheme(selected) || { ...ORIGINAL, title: autoTheme.name };
  const fixedStory = choice.series === "story";
  const theme = findHomeTheme(choice.id) || autoTheme;
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
  const selectTheme = (id) => {
    if (id !== DEFAULT_HOME_THEME) manualSelections.current[phase] = id;
    setSelected(id);
    setError("");
  };
  const apply = async () => {
    if (saving || !available) return;
    setSaving(true);
    setError("");
    try {
      await updateCollection((state) =>
        setPhaseHome(state, phase, choice.id, characters ? portraitId : null),
      );
      playSound("equip");
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
        <div className="home-phase-selector" role="group" aria-label="着せ替えるフェーズ">
          {[1, 2, 3].map((value) => (
            <button key={value} className={`btn ${phase === value ? "btn-primary" : "btn-ghost"}`}
              aria-pressed={phase === value} disabled={saving}
              onClick={() => {
                const state = phaseHomeOf(source, value);
                setPhase(value);
                setSelected(homeThemeOf(state));
                setPortraits(homePortraitsOf(state));
                setError("");
              }}>フェーズ{value}</button>
          ))}
        </div>
        <p className="home-customize-guide">
          フェーズ{phase}で使う背景の切り替え方を選べます。
        </p>
        <div className="home-background-modes" role="group" aria-label="背景の切り替え方">
          <button
            type="button"
            className={`home-background-mode${automatic ? " is-selected" : ""}`}
            aria-pressed={automatic}
            disabled={saving}
            onClick={() => selectTheme(DEFAULT_HOME_THEME)}
          >
            <Book size={21} />
            <b>ストーリーに連動</b>
            <small>進行に合わせて自動で変わる</small>
            {automatic && <Check size={15} className="home-background-mode-check" />}
          </button>
          <button
            type="button"
            className={`home-background-mode${automatic ? "" : " is-selected"}`}
            aria-pressed={!automatic}
            disabled={saving}
            onClick={() => selectTheme(manualSelections.current[phase] ||
              (current !== DEFAULT_HOME_THEME ? current : `phase-${phase}`))}
          >
            <Crown size={21} />
            <b>背景を選ぶ</b>
            <small>好きな背景を使い続ける</small>
            {!automatic && <Check size={15} className="home-background-mode-check" />}
          </button>
        </div>
        <section className="home-story-picker" aria-label={`フェーズ${phase}のストーリー背景`}>
          <h3>ストーリーの背景</h3>
          <p>第1話〜第7話から選ぶと、その背景に固定できます。</p>
          <div className="home-story-chapters" role="group" aria-label="ストーリーの話数を選ぶ">
            {storyChoices.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`home-story-chapter${selected === item.id ? " is-selected" : ""}`}
                aria-label={`ストーリー${item.chapter}・${item.name}`}
                aria-pressed={selected === item.id}
                disabled={saving}
                onClick={() => selectTheme(item.id)}
              >
                <img src={item.assets.scene} alt="" loading="lazy" />
                <span>第{item.chapter}話</span>
                {selected === item.id && <Check size={13} />}
              </button>
            ))}
          </div>
        </section>
        {automatic && (
          <div className="home-story-follow" role="status">
            <span>現在の進行 · フェーズ{phase} / 第{autoTheme.chapter}話</span>
            <b>{autoTheme.name}</b>
            <p>{progress.complete
              ? "このフェーズは全話クリア済みです。最後の話の背景を表示します。"
              : "話をクリアすると、次の話の背景へ自動で切り替わります。"}</p>
          </div>
        )}
        {fixedStory && (
          <div className="home-story-follow" role="status">
            <span>背景を固定 · フェーズ{phase} / 第{choice.chapter}話</span>
            <b>{choice.name}</b>
            <p>ストーリーが進んでも、この背景を使い続けます。</p>
          </div>
        )}
        <div
          className={`home-customize-set-preview${theme ? " has-theme" : ""}`}
          style={homeThemeStyle(theme)}
          data-home-area={theme.id}
        >
          <HomeRealmDecoration theme={theme} />
          <div className="home-customize-preview">
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
              {automatic || fixedStory ? theme.title : `${choice.label} · ${characters ? portrait.name : choice.title}`}
            </span>
          </div>
        </div>
        <div
          className={`home-customize-condition${available ? " is-unlocked" : ""}`}
          role="status"
        >
          {available ? <Check size={17} /> : <Lock size={17} />}
          <span>
            {available ? (isCurrent ? (automatic ? "ストーリー連動を使用中" : "現在使用中") : (automatic ? "適用すると、現在の進行に合わせて切り替わります" : "解放済み")) : condition}
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
        {!automatic && <div
          className="home-theme-grid"
          role="group"
          aria-label="ホーム装飾を選ぶ"
        >
          {choices.map((item, index) => {
            const open = unlocked.includes(item.id);
            const active = item.id === selected;
            return (
              <Fragment key={item.id}>
                {(index === 0 || item.series !== choices[index - 1].series) && (
                  <h3 className="home-theme-series">
                    {item.series === "alice"
                      ? "ワンダーランド"
                      : item.series === "phase" ? "フェーズ専用ホーム" : "初期シリーズ"}
                  </h3>
                )}
                <button
                  className={`home-theme-option${active ? " is-selected" : ""}${open ? "" : " is-locked"}`}
                  aria-pressed={active}
                  aria-label={`${item.label}のホーム ${open ? (item.id === current ? "使用中" : "解放済み") : `未解放・${item.condition}`}`}
                  onClick={() => {
                    selectTheme(item.id);
                    if (scroller.current) scroller.current.scrollTop = 0;
                  }}
                  disabled={saving}
                >
                  <span className="home-theme-thumbnail">
                    {item.id === DEFAULT_HOME_THEME ? (
                      <img src={homeThemeAssets(autoTheme).scene} alt="" loading="lazy" />
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
              </Fragment>
            );
          })}
        </div>}
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
                : automatic
                  ? "ストーリー連動を使う"
                  : fixedStory
                    ? "この話の背景を使う"
                    : "この装飾に着せ替える"}
        </button>
      </footer>
    </SkinModal>
  );
}

export function HomeCustomizationButton({
  settings = false,
  onApplied = null,
}) {
  const collection = useCollection();
  const [open, setOpen] = useState(false);
  const [profile] = useMissionProfile();
  const theme = homeThemeForProfile(collection, profile);
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
