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

/**
 * 設定に出すアカウントの札。
 *
 * 名前・レベル・戦績を1枚にまとめる。項目名と値を並べただけの表よりも、
 * 「いまの自分」がひと目で分かる形にした。
 */
export function AccountCard({ profile, onEdit }) {
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
        <span className="account-mark">
          {(profile.name || "?").slice(0, 1)}
        </span>
        <div className="account-id">
          <b className="account-name">{profile.name || "(未設定)"}</b>
          <span className="account-sub">
            レベル {level}
            {level >= MAX_LEVEL ? "(最高)" : ""}
          </span>
        </div>
        <button className="btn btn-ghost btn-small" onClick={onEdit}>
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
