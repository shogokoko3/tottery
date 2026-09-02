/**
 * プレイヤーのアカウント画面。
 *
 * はじめて遊ぶときに名前を決めてもらい、あとから変えられるようにする。
 * 名前は対戦相手にも見えるので、そのことを先に伝える。
 */
import { useState } from "react";
import {
  MAX_NAME_LEN,
  levelOf,
  loadProfile,
  nameError,
  normalizeName,
  saveName,
  toNextLevel,
} from "../game/profile.js";
import { Check, Close, Sparkle } from "../icons.jsx";

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
          対戦相手にも見えます。あとから変えられます。
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
        <p className="hint">対戦相手にも見える名前です。</p>
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

/** 設定に出す、いまのアカウントの中身 */
export function AccountRows({ profile }) {
  const next = toNextLevel(profile);
  return (
    <>
      <div className="settings-row">
        <span>名前</span>
        <b>{profile.name || "(未設定)"}</b>
      </div>
      <div className="settings-row">
        <span>レベル</span>
        <b>
          {levelOf(profile)}
          {next === null ? "" : `(あと${next})`}
        </b>
      </div>
      <div className="settings-row">
        <span>戦績</span>
        <b>
          {profile.plays}戦 {profile.wins}勝
        </b>
      </div>
    </>
  );
}
