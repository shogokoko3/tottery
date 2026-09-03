/**
 * プレイヤーのアカウント画面。
 *
 * はじめて遊ぶときに名前を決めてもらい、あとから変えられるようにする。
 * 名前は対戦相手にも見えるので、そのことを先に伝える。
 */
import { useState } from "react";
import {
  LEVEL_STEP,
  MAX_LEVEL,
  MAX_NAME_LEN,
  levelOf,
  saveIcon,
  loadProfile,
  nameError,
  normalizeName,
  saveName,
  toNextLevel,
} from "../game/profile.js";
import { ICONS, hasIcon } from "../game/icons.js";
import { Check, Close, Sparkle } from "../icons.jsx";
import { PlayerIcon } from "./playericon.jsx";

/** 名前を入れてもらう欄。登録画面と変更画面で共通に使う */
function NameField({ value, onChange, error }) {
  const left = MAX_NAME_LEN - normalizeName(value).length;
  return (
    <>
      <input
        className={`name-input ${error ? "name-input-bad" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="プレイヤー名"
        maxLength={MAX_NAME_LEN + 4}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <p className={`name-note ${error ? "name-note-bad" : ""}`}>
        {error || `${MAX_NAME_LEN}文字まで(あと${Math.max(0, left)}文字)`}
      </p>
    </>
  );
}

/** はじめて遊ぶときの登録画面 */
export function NameSetupScreen({ onDone }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(null);

  function submit() {
    const bad = nameError(value);
    if (bad) {
      setError(bad);
      return;
    }
    onDone(saveName(value));
  }

  return (
    <div className="center-stage name-stage">
      <div className="name-card">
        <p className="name-eyebrow">はじめまして</p>
        <h2>名前を決めてください</h2>
        <p className="hint">
          対戦中の手番や記録に、この名前が出ます。
          <br />
          対戦相手と、インターネット上のランキングに出ます。
          <br />
          本名は入れないでください。あとから変えられます。
        </p>
        <NameField
          value={value}
          onChange={(v) => {
            setValue(v);
            setError(null);
          }}
          error={error}
        />
        <button className="btn btn-primary btn-wide" onClick={submit}>
          <Sparkle size={16} /> はじめる
        </button>
      </div>
    </div>
  );
}

/** 設定から開く、名前の変更 */
export function NameEditModal({ onClose, onSaved }) {
  const profile = loadProfile();
  const [value, setValue] = useState(profile.name);
  const [error, setError] = useState(null);

  function submit() {
    const bad = nameError(value);
    if (bad) {
      setError(bad);
      return;
    }
    const next = saveName(value);
    onSaved && onSaved(next);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>名前を変える</h3>
          <button className="icon-btn" onClick={onClose}>
            <Close size={18} />
          </button>
        </div>
        <p className="hint">
          対戦相手と、ランキングに出る名前です。本名は入れないでください。
        </p>
        <NameField
          value={value}
          onChange={(v) => {
            setValue(v);
            setError(null);
          }}
          error={error}
        />
        <div className="setup-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            やめる
          </button>
          <button className="btn btn-primary" onClick={submit}>
            <Check size={16} /> 決定
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 設定に出すアカウントの札。
 *
 * 名前・レベル・戦績を1枚にまとめる。項目名と値を並べただけの表よりも、
 * 「いまの自分」がひと目で分かる形にした。
 */
export function AccountCard({ profile, onEditName, onEditIcon }) {
  const level = levelOf(profile);
  const next = toNextLevel(profile);
  const rate = profile.plays
    ? Math.round((profile.wins / profile.plays) * 100)
    : null;
  // 次のレベルまでの進み具合。最高レベルなら満杯にする
  const step = next === null ? 1 : (LEVEL_STEP - next) / LEVEL_STEP;

  return (
    <div className="account-card">
      <div className="account-head">
        <button
          className="account-mark"
          onClick={onEditIcon}
          title="アイコンを選ぶ"
        >
          <PlayerIcon icon={profile.icon} name={profile.name} size="lg" />
          <span className="account-mark-edit">変える</span>
        </button>
        <div className="account-id">
          <b className="account-name">{profile.name || "(未設定)"}</b>
          <span className="account-sub">
            レベル {level}
            {level >= MAX_LEVEL ? "(最高)" : ""}
          </span>
        </div>
        <button className="btn btn-ghost btn-small" onClick={onEditName}>
          名前を変える
        </button>
      </div>

      <div className="level-bar">
        <span className="level-fill" style={{ width: `${step * 100}%` }} />
      </div>
      <p className="level-note">
        {next === null
          ? "これ以上は上がりません"
          : `次のレベルまであと${next}(1局で1、勝つと2)`}
      </p>

      <div className="stat-row">
        <div className="stat">
          <b>{profile.plays}</b>
          <span>対局</span>
        </div>
        <div className="stat">
          <b>{profile.wins}</b>
          <span>勝ち</span>
        </div>
        <div className="stat">
          <b>{rate === null ? "—" : `${rate}%`}</b>
          <span>勝率</span>
        </div>
      </div>
    </div>
  );
}

/**
 * アイコンを選ぶ画面。
 *
 * まだ手に入れていないものも並べて、これから増えることが分かるようにする。
 * 手に入れ方は今後決めるので、いまは「これから手に入ります」とだけ出す。
 */
export function IconPickModal({ onClose, onSaved }) {
  const profile = loadProfile();
  const [picked, setPicked] = useState(profile.icon || "initial");

  function submit() {
    onSaved && onSaved(saveIcon(picked));
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>アイコンを選ぶ</h3>
          <button className="icon-btn" onClick={onClose}>
            <Close size={18} />
          </button>
        </div>
        <p className="hint">対戦相手にも見えます。</p>
        <div className="icon-grid">
          {ICONS.map((icon) => {
            const owned = hasIcon(profile, icon.id);
            return (
              <button
                className={`icon-choice ${picked === icon.id ? "icon-choice-on" : ""} ${
                  owned ? "" : "icon-choice-locked"
                }`}
                disabled={!owned}
                title={owned ? icon.label : icon.how}
                onClick={() => owned && setPicked(icon.id)}
                key={icon.id}
              >
                <PlayerIcon icon={icon.id} name={profile.name} />
                <span className="icon-label">{icon.label}</span>
              </button>
            );
          })}
        </div>
        <p className="hint">
          鍵のかかったものは、これから対局で手に入るようになります。
        </p>
        <div className="setup-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            やめる
          </button>
          <button className="btn btn-primary" onClick={submit}>
            <Check size={16} /> 決定
          </button>
        </div>
      </div>
    </div>
  );
}
