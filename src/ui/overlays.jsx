import { useEffect, useState } from "react";
import { audioSettings, setBgmVolume, setMuted } from "../audio/index.js";
import { sanitizeHistory } from "../game/board.js";
import {
  PLAYER_META,
  SUIT_SYMBOL,
  VERSION,
  VERSION_NOTE,
  nameOf,
  playerLabel,
} from "../game/constants.js";
import { ArrowLeft, Check, Close, Crown, Flag, Sparkle } from "../icons.jsx";
import { CardBack, CardFace, Piece } from "./cards.jsx";
import { CardGuide } from "./guides.jsx";
import { useNames } from "./names.jsx";
import {
  AccountCard,
  IconPickModal,
  NameEditModal,
  TitlePickModal,
} from "./account.jsx";
import { loadProfile } from "../game/profile.js";

export function Interstitial({ forPlayer, kind, onReady }) {
  let n = PLAYER_META[forPlayer],
    a = PLAYER_META[1 - forPlayer],
    u = {
      dice: "サイコロフェーズ",
      mulligan: "引き直しフェーズ",
      setup: "布陣フェーズ",
      turn: "手番交代",
    };
  return (
    <div className="interstitial">
      <div className="interstitial-card">
        <div className="interstitial-eyebrow">PASS THE DEVICE</div>
        <h2
          style={{
            color: n.color,
          }}
        >
          {n.name}の番です
        </h2>
        <p>
          {u[kind] || ""} —{" "}
          <b
            style={{
              color: n.color,
            }}
          >
            {n.name}
          </b>
          の担当者に画面を渡してください。
          <br />
          <b
            style={{
              color: a.color,
            }}
          >
            {a.name}
          </b>
          には見えないようにしてください。
        </p>
        <button className="btn btn-primary" onClick={onReady}>
          <Sparkle size={16} /> 準備ができた
        </button>
      </div>
    </div>
  );
}
export function KingChoiceInterstitial({ state, size, dispatch }) {
  let n = state.pendingKingChoice,
    a = PLAYER_META[n.owner];
  if (!n.acknowledged)
    return (
      <div className="interstitial">
        <div className="interstitial-card">
          <div className="interstitial-eyebrow">PASS THE DEVICE</div>
          <h2
            style={{
              color: a.color,
            }}
          >
            {a.name}の王が倒れました
          </h2>
          <p>
            残っている{n.rank}
            の中から、新しい王を選びます。画面を渡してください。
          </p>
          <button
            className="btn btn-primary"
            onClick={() =>
              dispatch({
                type: "ACK_KING_CHOICE",
              })
            }
          >
            <Sparkle size={16} /> 準備ができた
          </button>
        </div>
      </div>
    );
  let u = n.owner === 1;
  return (
    <div className="setup-wrap">
      <h2
        style={{
          color: a.color,
        }}
      >
        新しい王を選んでください
      </h2>
      <p className="hint">
        光っている{n.rank}のうち、どれを王にするか選びます。
      </p>
      <div className="board-outer">
        <div
          className="board-grid"
          style={{
            gridTemplateColumns: `repeat(${size},1fr)`,
          }}
        >
          {Array.from({
            length: size,
          }).map((i, f) =>
            Array.from({
              length: size,
            }).map((o, r) => {
              let d = u ? size - 1 - f : f,
                m = u ? size - 1 - r : r,
                s = state.board[d][m],
                v = s && n.candidateIds.includes(s.id);
              return (
                <div
                  className={`cell ${v ? "cell-heir" : ""}`}
                  onClick={() => {
                    v &&
                      dispatch({
                        type: "CHOOSE_HEIR",
                        id: s.id,
                      });
                  }}
                  key={`${d}-${m}`}
                >
                  {s && (
                    <div className={v ? "" : "piece-dim"}>
                      <Piece
                        piece={s}
                        viewer={n.owner}
                        size={size >= 9 ? "xs" : "md"}
                      />
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
/**
 * 取る手の確認。相手の駒は伏せたままなので、何が取れるかは出さず数だけ伝える。
 */
export function CaptureConfirm({ count, squares, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-panel capture-confirm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>
          {count > 1 ? `${count}体をまとめて取ります` : "この駒を取ります"}
        </h3>
        <p className="hint">
          {squares && squares.length > 0 && (
            <>
              対象のマス: <strong>{squares.join(" / ")}</strong>
              <br />
            </>
          )}
          取った駒の正体は、取ったあとに公開されます。
        </p>
        <div className="setup-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            やめる
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            取る
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 取った駒を見せる札。
 *
 * まず「相手の駒を取りました」と出し、少し置いてから
 * 王だったことが分かる。決着はそのあと。取るまで正体が分からない
 * という遊び方に合わせて、順を追って見せる。
 */
/**
 * 取った駒を見せる札。
 *
 * 伏せた状態から1枚ずつめくる。王は最後に回してあるので、
 * 最後の1枚をめくった瞬間に、王だったかどうかが分かる。
 * 取るまで正体が分からない、という遊び方をそのまま演出にしている。
 */
export function CaptureRevealModal({ reveal, onClose, viewer, final }) {
  const defeated = reveal.defeated || [];
  const mine =
    reveal.capturedBy === void 0 ||
    viewer === void 0 ||
    reveal.capturedBy === viewer;
  const hasKing = defeated.some((c) => c.isKing);
  const [flipped, setFlipped] = useState(0);
  const allShown = flipped >= defeated.length;

  useEffect(() => {
    if (flipped >= defeated.length) return;
    const id = setTimeout(
      () => setFlipped((n) => n + 1),
      flipped === 0 ? 450 : 420,
    );
    return () => clearTimeout(id);
  }, [flipped, defeated.length]);

  // すべてめくり終えてから、王がいたことを告げる
  const told = allShown && hasKing;

  const eyebrow = mine
    ? reveal.surround
      ? "包囲成功!"
      : "撃破!"
    : reveal.surround
      ? "包囲された!"
      : "駒を取られた!";

  const plain = mine
    ? reveal.surround
      ? defeated.length > 1
        ? `包囲して${defeated.length}枚を取りました`
        : "包囲して相手の駒を取りました"
      : defeated.length > 1
        ? `${defeated.length}枚の駒を取りました`
        : "相手の駒を取りました"
    : defeated.length > 1
      ? `あなたの駒が${defeated.length}枚取られました`
      : "あなたの駒が取られました";

  return (
    <div className="modal-overlay">
      <div className="modal-panel gameover-panel">
        <div
          className={`capture-eyebrow ${told ? "capture-eyebrow-king" : ""}`}
          style={mine ? void 0 : { color: "#e08b7a" }}
        >
          {told ? (mine ? "王を討った!" : "王が討たれた…") : eyebrow}
        </div>
        <h3 style={{ margin: "0 0 14px" }}>
          {told
            ? mine
              ? "取ったのは相手の王でした"
              : "取られたのはあなたの王でした"
            : plain}
        </h3>
        <div className="capture-cards">
          {defeated.map((card, i) => {
            const open = i < flipped;
            return (
              <div
                className={`capture-card ${open ? "capture-card-open" : ""} ${
                  open && card.isKing ? "capture-card-king" : ""
                }`}
                key={i}
              >
                {open ? (
                  <>
                    <CardFace
                      rank={card.rank}
                      suit={card.suit}
                      isKing={card.isKing}
                    />
                    {card.isKing && (
                      <Crown size={18} className="capture-crown" />
                    )}
                  </>
                ) : (
                  <CardBack colorHex={PLAYER_META[card.owner].color} />
                )}
              </div>
            );
          })}
        </div>
        <button
          className="btn btn-primary"
          style={{ marginTop: 18 }}
          disabled={!allShown}
          onClick={onClose}
        >
          {/* 王を取っても、継ぐ駒がいれば対局は続く */}
          {told && final
            ? mine
              ? "勝利を見る"
              : "結果を見る"
            : "確認した"}{" "}
          <Check size={16} />
        </button>
      </div>
    </div>
  );
}

export function LogViewer({ piece, viewer, onClose, revealAll }) {
  let a = PLAYER_META[piece.owner],
    u = piece.owner === viewer || !piece.alive || revealAll,
    i = sanitizeHistory(piece, viewer, revealAll);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(f) => f.stopPropagation()}>
        <div className="modal-head">
          <h3
            style={{
              color: a.color,
            }}
          >
            {u ? `${piece.rank}${SUIT_SYMBOL[piece.suit]}` : "???"} の行動ログ
          </h3>
          <button className="icon-btn" onClick={onClose}>
            <Close size={18} />
          </button>
        </div>
        {u && (
          <CardGuide
            rank={piece.rank}
            suit={piece.suit}
            isKing={piece.isKing}
            compact={!0}
          />
        )}
        {i.length === 0 ? (
          <p className="hint">まだ行動していません。</p>
        ) : (
          <ol className="log-list">
            {i.map((f, o) => (
              <li key={o}>
                {o + 1}. {f}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
/**
 * 音の設定。
 *
 * 触ったその場で鳴っている音に効き、そのまま端末に残る。
 * いまあるのは BGM だけ。効果音を入れたらここに1行足す。
 */
function SoundSettings() {
  const [audio, setAudio] = useState(() => audioSettings());
  const percent = Math.round(audio.bgm * 100);
  return (
    <div className="settings-list">
      <div className="settings-row">
        <span>BGM</span>
        <button
          className="btn btn-ghost btn-small"
          onClick={() => setAudio(setMuted(!audio.muted))}
        >
          {audio.muted ? "鳴らす" : "鳴らさない"}
        </button>
      </div>
      <div className="settings-row">
        <span>音量</span>
        <input
          className="settings-slider"
          type="range"
          min="0"
          max="100"
          step="5"
          value={percent}
          disabled={audio.muted}
          onChange={(e) => setAudio(setBgmVolume(Number(e.target.value) / 100))}
        />
        <b>{audio.muted ? "—" : percent}</b>
      </div>
    </div>
  );
}

export function SettingsModal({ onClose }) {
  const [profile, setProfile] = useState(() => loadProfile());
  // "name" は名前を変える画面、"icon" はアイコンを選ぶ画面
  const [editing, setEditing] = useState(null);
  if (editing === "name")
    return (
      <NameEditModal
        onClose={() => setEditing(null)}
        onSaved={(next) => setProfile(next)}
      />
    );
  if (editing === "icon")
    return (
      <IconPickModal
        onClose={() => setEditing(null)}
        onSaved={(next) => setProfile(next)}
      />
    );
  if (editing === "title")
    return (
      <TitlePickModal
        onClose={() => setEditing(null)}
        onSaved={(next) => setProfile(next)}
      />
    );
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel settings-panel"
        onClick={(t) => t.stopPropagation()}
      >
        <div className="modal-head">
          <h3>設定</h3>
          <button className="icon-btn" onClick={onClose}>
            <Close size={18} />
          </button>
        </div>

        <p className="settings-head">あなたのアカウント</p>
        <AccountCard
          profile={profile}
          onEditName={() => setEditing("name")}
          onEditIcon={() => setEditing("icon")}
          onEditTitle={() => setEditing("title")}
        />

        <p className="settings-head">音</p>
        <SoundSettings />

        <p className="settings-head">このアプリについて</p>
        <div className="settings-list">
          <div className="settings-row">
            <span>ゲームの版</span>
            <b>{VERSION}</b>
          </div>
          <div className="settings-row">
            <span>この版の内容</span>
            <b>{VERSION_NOTE}</b>
          </div>
          <div className="settings-row">
            <span>ルールの確認</span>
            <b>右上の「i」から</b>
          </div>
          <div className="settings-row">
            <span>通信</span>
            <b>オンライン対戦に対応</b>
          </div>
        </div>

        <p className="settings-note">
          レーティングとランキング、表示の調整は今後追加する予定です。
        </p>
        <button className="btn btn-primary btn-wide" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
export function ResignConfirm({ onCancel, onResign, viewer }) {
  let names = useNames(),
    n = PLAYER_META[viewer];
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-panel gameover-panel"
        onClick={(a) => a.stopPropagation()}
      >
        <Flag
          size={30}
          style={{
            color: "var(--gold)",
          }}
        />
        <h3
          style={{
            margin: "8px 0 10px",
          }}
        >
          降参しますか?
        </h3>
        <p className="hint">
          <b
            style={{
              color: n.color,
            }}
          >
            {playerLabel(viewer, viewer, names)}
          </b>
          の負けとして、この対局が終わります。
        </p>
        <div
          className="setup-actions"
          style={{
            marginTop: 16,
            flexDirection: "column",
          }}
        >
          <button className="btn btn-primary" onClick={onCancel}>
            対局を続ける
          </button>
          <button className="btn btn-ghost" onClick={onResign}>
            <Flag size={16} /> 降参する
          </button>
        </div>
      </div>
    </div>
  );
}
export function QuitConfirm({ onCancel, onQuit, network }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-panel gameover-panel"
        onClick={(n) => n.stopPropagation()}
      >
        <h3
          style={{
            margin: "0 0 10px",
          }}
        >
          対局をやめますか?
        </h3>
        <p className="hint">
          今の対局は最初からやり直しになります。
          {network && (
            <>
              <br />
              オンライン対戦の場合、相手の画面はそのまま残ります。
            </>
          )}
        </p>
        <div
          className="setup-actions"
          style={{
            marginTop: 16,
            flexDirection: "column",
          }}
        >
          <button className="btn btn-primary" onClick={onCancel}>
            対局を続ける
          </button>
          <button className="btn btn-ghost" onClick={onQuit}>
            <ArrowLeft size={16} /> やめてタイトルに戻る
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 布陣ボーナスの知らせ。対局が始まる前に一度だけ出す。
 * どちらの布陣が揃ったかは、両者に伝える。
 */
export function SetupEffectsModal({ effects, viewer, onClose }) {
  const names = useNames();
  const me = viewer === void 0 || viewer === null ? null : viewer;
  const side = (i) =>
    me === null ? nameOf(i, names) : i === me ? "あなた" : "相手";
  const shown = effects.revealed || [];
  const myShown = me === null ? [] : shown.filter((c) => c.owner === me);
  const foeShown = me === null ? shown : shown.filter((c) => c.owner !== me);

  return (
    <div className="modal-overlay">
      <div className="modal-panel bonus-panel">
        <p className="bonus-eyebrow">布陣ボーナス</p>

        <ul className="bonus-list">
          {[0, 1].map((i) =>
            effects.straights[i] ? (
              <li className="bonus-row" key={`s${i}`}>
                <span
                  className="bonus-tag"
                  style={{ "--who": PLAYER_META[i].color }}
                >
                  ストレート
                </span>
                <span>{side(i)}の布陣が数字で並んだ</span>
              </li>
            ) : null,
          )}
          {[0, 1].map((i) =>
            effects.flushes[i] ? (
              <li className="bonus-row" key={`f${i}`}>
                <span
                  className="bonus-tag"
                  style={{ "--who": PLAYER_META[i].color }}
                >
                  フラッシュ
                </span>
                <span>{side(i)}の布陣がマークでそろった</span>
              </li>
            ) : null,
          )}
        </ul>

        {effects.straights.some(Boolean) && (
          <p className="bonus-note">
            {effects.swapped
              ? `先手と後手が入れ替わり、${side(effects.first)}から始まります。`
              : "両者ストレートのため、先手はそのままです。"}
          </p>
        )}

        {foeShown.length > 0 && (
          <>
            <p className="bonus-note">
              {me === null
                ? `${foeShown.length}枚の駒が公開されました。`
                : `相手の駒が${foeShown.length}枚めくれました。`}
            </p>
            <div className="bonus-cards">
              {foeShown.map((c) => (
                <div className="bonus-card" key={c.id}>
                  <CardFace rank={c.rank} suit={c.suit} size="sm" />
                  <span
                    className="bonus-card-who"
                    style={{ color: PLAYER_META[c.owner].color }}
                  >
                    {nameOf(c.owner, names)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {myShown.length > 0 && (
          <p className="bonus-note">
            あなたの駒が{myShown.length}枚、相手に見えてしまいました。
            盤の「公開」の印が目印です。
          </p>
        )}

        <button className="btn btn-primary" onClick={onClose}>
          対局を始める <Check size={16} />
        </button>
      </div>
    </div>
  );
}
