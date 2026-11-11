import { HomeCustomizationButton } from "./home-customization.jsx";
import { HomeMusicSettings } from "./home-music-settings.jsx";
import { AppearanceSettings } from "./season.jsx";
import { useCollection, updateCollection } from "../skins/store.js";
import { useEffect, useState, useSyncExternalStore } from "react";
import { hapticsEnabled, setHapticsEnabled, subscribeHaptics } from "../game/haptic-settings.js";
import { vibrate } from "../game/haptics.js";
import {
  MUSIC_CREDIT,
  SE_CREDIT,
  audioSettings,
  playSound,
  setBgmVolume,
  setMuted,
  setSeVolume,
} from "../audio/index.js";
import { sanitizeHistory } from "../game/board.js";
import { logText } from "../game/reducer.js";
import { L, Lx, langSetting, setLangSetting } from "../i18n/index.js";
import {
  PLAYER_META,
  SUIT_SYMBOL,
  VERSION,
  VERSION_NOTE,
  nameOf,
  playerLabel,
} from "../game/constants.js";
import { ArrowLeft, Check, Close, Flag, Sparkle } from "../icons.jsx";
import { CardFace, Piece } from "./cards.jsx";
import { CardGuide } from "./guides.jsx";
import { useNames } from "./names.jsx";
import {
  AccountCard,
  IconPickModal,
  NameEditModal,
  TitlePickModal,
} from "./account.jsx";
import { forgetMe, loadProfile } from "../game/profile.js";
// 端末に残ったものを全部消す(2026-09-28 本人の報告)
import { forgetEverything } from "../game/forget.js";
import { loadBlocked, unblock } from "../game/blocked.js";
import { loadPlaySettings, savePlaySettings } from "../game/play-settings.js";
import { deleteRank } from "../net/ranking.js";
import { clearProfileSync } from "../net/profile-sync.js";
import { forgetSeason, clearSeasonQueue } from "../net/season.js";
import {
  PRIVACY_URL,
  hasPrivacyUrl,
  hasSupportContact,
  SUPPORT_EMAIL,
  supportMailto,
} from "../game/support.js";

export function Interstitial({ forPlayer, kind, onReady }) {
  let n = PLAYER_META[forPlayer],
    a = PLAYER_META[1 - forPlayer],
    u = {
      dice: L("サイコロフェーズ"),
      mulligan: L("引き直しフェーズ"),
      setup: L("布陣フェーズ"),
      turn: L("ターン交代"),
    },
    // 英語は語順が違うので、名前の前後で文を切って組む
    [passPre, passPost] = L("{who}の担当者に画面を渡してください。").split("{who}"),
    [hidePre, hidePost] = L("{who}には見えないようにしてください。").split("{who}");
  return (
    <div className="interstitial">
      <div className="interstitial-card">
        <div className="interstitial-eyebrow">PASS THE DEVICE</div>
        <h2
          style={{
            color: n.color,
          }}
        >
          {L("{who}の番です", { who: Lx(n.name) })}
        </h2>
        <p>
          {u[kind] || ""} —{" "}
          {passPre}
          <b
            style={{
              color: n.color,
            }}
          >
            {Lx(n.name)}
          </b>
          {passPost}
          <br />
          {hidePre}
          <b
            style={{
              color: a.color,
            }}
          >
            {Lx(a.name)}
          </b>
          {hidePost}
        </p>
        <button className="btn btn-primary" onClick={onReady}>
          <Sparkle size={16} /> {L("準備ができた")}
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
            {L("{who}の王が倒れました", { who: Lx(a.name) })}
          </h2>
          <p>
            {L("残っている{rank}の中から、新しい王を選びます。画面を渡してください。", { rank: n.rank })}
          </p>
          <button
            className="btn btn-primary"
            onClick={() =>
              dispatch({
                type: "ACK_KING_CHOICE",
              })
            }
          >
            <Sparkle size={16} /> {L("準備ができた")}
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
        {L("新しい王を選んでください")}
      </h2>
      <p className="hint">
        {L("光っている{rank}のうち、どれを王にするか選びます。", { rank: n.rank })}
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
/**
 * 駒を取らない移動の確認(2026-09-28 本人の指示)。
 *
 * 取る手は CaptureConfirm が前から確認していた。指の滑りで意図しないマスへ動くのを
 * 防ぐため、取らない手にも同じ二段(選ぶ→確認→確定)を入れる。
 * 設定「駒を動かす前に確認する」で切れる(既定は on。src/game/play-settings.js)
 */
export function MoveConfirm({ from, to, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-panel capture-confirm move-confirm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{L("ここに動かしますか")}</h3>
        <p className="hint">
          {from ? (
            (() => {
              // 英語は語順が違うので、マスの前後で文を切って組む
              const [a, rest] = L("{from} から {to} へ動かします。").split("{from}");
              const [b, c] = rest.split("{to}");
              return (
                <>
                  {a}
                  <strong>{from}</strong>
                  {b}
                  <strong>{to}</strong>
                  {c}
                </>
              );
            })()
          ) : (
            (() => {
              const [a, b] = L("{to} へ動かします。").split("{to}");
              return (
                <>
                  {a}
                  <strong>{to}</strong>
                  {b}
                </>
              );
            })()
          )}
          <br />
          {L("やめれば、別のマスや別の駒を選び直せます。")}
        </p>
        <div className="setup-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            {L("やめる")}
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            {L("動かす")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 取る前の確認。plain ははじめの一局(台本をストーリーとして遊ぶ一局)。導入の言葉の調子にそろえ、
 * 決まり文句の「取った駒の正体は、取ったあとに公開されます。」を短い一行にする(2026-10-05 見直し)。
 * 見出しも問いかけに替え、マスは見出しに入れる(「この駒を取ります」「対象のマス: c4」はです・ます調と
 * 硬い言葉のまま残っていた。2026-10-06 見直し)。はじめの一局の相手の駒は、どれも伏せ札
 */
export function CaptureConfirm({ count, squares, onCancel, onConfirm, plain = false }) {
  const where = squares && squares.length > 0 ? squares : null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-panel capture-confirm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>
          {plain
            ? count > 1
              ? L("伏せ札を{n}枚、まとめて取る?", { n: count })
              : where
                ? L("{square} の伏せ札を、取る?", { square: where[0] })
                : L("この伏せ札を、取る?")
            : count > 1
              ? L("{n}体をまとめて取ります", { n: count })
              : L("この駒を取ります")}
        </h3>
        <p className="hint">
          {where && !plain && (
            <>
              {L("対象のマス:")} <strong>{where.join(" / ")}</strong>
              <br />
            </>
          )}
          {plain ? L("取れば、正体が分かる。") : L("取った駒の正体は、取ったあとに公開されます。")}
        </p>
        <div className="setup-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            {L("やめる")}
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {L("取る")}
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

export function LogViewer({ piece, viewer, onClose, revealAll, onMemo }) {
  let a = PLAYER_META[piece.owner],
    u = (piece.owner === viewer && !piece.ownerHidden) || !piece.alive || revealAll,
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
            {L("{card} の行動ログ", { card: u ? `${piece.rank}${SUIT_SYMBOL[piece.suit]}` : "???" })}
          </h3>
          <button className="icon-btn" onClick={onClose}>
            <Close size={18} />
          </button>
        </div>
        {onMemo && (
          <button className="btn btn-ghost" onClick={onMemo}>
            {L("✎ 自分だけの推理メモ")}
          </button>
        )}
        {u && piece.originalRank && piece.originalRank !== piece.rank && (
          <p className="card-origin-note">
            {L("元のカード：")}<b>{piece.originalRank}{SUIT_SYMBOL[piece.suit]}</b>
            <span>
              {" → "}
              {L("{when}：{card}", {
                when: piece.alive ? L("現在") : L("撃破時"),
                card: `${piece.rank}${SUIT_SYMBOL[piece.suit]}`,
              })}
            </span>
          </p>
        )}
        {u && (
          <CardGuide
            alice={!!piece.aliceSkin}
            movementRank={piece.movementRank}
            rank={piece.rank}
            suit={piece.suit}
            mark={piece.mark}
            originalRank={piece.originalRank}
            /* 王の力なしの対局(駒に powers:false)では「王の効果」を出さない */
            isKing={!!piece.isKing && piece.powers !== false}
            compact={!0}
          />
        )}
        {i.length === 0 ? (
          <p className="hint">{L("まだ行動していません。")}</p>
        ) : (
          <ol className="log-list">
            {i.map((f, o) => (
              <li key={o}>
                {o + 1}. {logText(f)}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
/** 音量のつまみ1本ぶん */
function VolumeRow({ label, value, muted, onChange }) {
  const percent = Math.round(value * 100);
  return (
    <div className="settings-row">
      <span>{label}</span>
      <input
        className="settings-slider"
        type="range"
        min="0"
        max="100"
        step="5"
        value={percent}
        disabled={muted}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <b>{muted ? "—" : percent}</b>
    </div>
  );
}

/** 端末に保存する、すべての場面に共通の振動設定。 */
export function HapticSettings() {
  const on = useSyncExternalStore(subscribeHaptics, hapticsEnabled);
  return (
    <div className="settings-list">
      <div className="settings-row">
        <span>{L("振動")}</span>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          role="switch"
          aria-label={L("振動")}
          aria-checked={on}
          onClick={() => {
            const next = setHapticsEnabled(!on);
            if (next) vibrate("capture");
          }}
        >
          {on ? "ON" : "OFF"}
        </button>
      </div>
      <p className="settings-note">
        {L("対局・召喚・マッチ成立の振動をまとめて切り替えます。音と動画の設定とは別に保存されます。")}
      </p>
    </div>
  );
}

/** 音量をその場で反映する。効果音のつまみは試聴もできる。 */
function SoundSettings() {
  const [audio, setAudio] = useState(() => audioSettings());
  return (
    <div className="settings-list">
      <div className="settings-row">
        <span>{L("音")}</span>
        <button
          className="btn btn-ghost btn-small"
          onClick={() => setAudio(setMuted(!audio.muted))}
        >
          {audio.muted ? L("鳴らす") : L("鳴らさない")}
        </button>
      </div>
      <VolumeRow
        label="BGM"
        value={audio.bgm}
        muted={audio.muted}
        onChange={(v) => setAudio(setBgmVolume(v))}
      />
      <VolumeRow
        label={L("効果音")}
        value={audio.se}
        muted={audio.muted}
        onChange={(v) => {
          setAudio(setSeVolume(v));
          playSound("place");
        }}
      />
      <HomeMusicSettings />
    </div>
  );
}

/**
 * 見えなくした人の一覧と、戻す手立て。
 * ガイドライン 1.2 が求める blocking の、解除側にあたる。
 */
function BlockedListModal({ onClose }) {
  const [list, setList] = useState(() => loadBlocked());
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel settings-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{L("見えなくした人")}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={L("閉じる")}>
            <Close size={18} />
          </button>
        </div>
        {list.length === 0 ? (
          <p className="hint">
            {L("いません。ランキングの右端の「⋯」から、見たくない相手を隠せます。")}
          </p>
        ) : (
          <div className="settings-list">
            {list.map((b) => (
              <div className="settings-row" key={b.id}>
                <span>{b.name || L("(名前なし)")}</span>
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => setList(unblock(b.id))}
                >
                  {L("戻す")}
                </button>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-primary btn-wide" onClick={onClose}>
          {L("閉じる")}
        </button>
      </div>
    </div>
  );
}

/**
 * 自分の記録を消す。ガイドライン 5.1.1(v)。
 * 端末の中(profile.js の forgetMe)と、サーバー(Firebase の ranks/<uid>・players/<uid>、
 * Cloudflare のシーズン台帳)の両方を消す。
 */
export function DeleteMeModal({ onClose, onDeleted }) {
  const me = loadProfile();
  const [step, setStep] = useState("ask");
  const [error, setError] = useState("");

  async function run() {
    setStep("running");
    // 送り待ちの成績があると、消したあとに再送されて戻ってしまうので先に捨てる
    await clearProfileSync();
    clearSeasonQueue();
    // 先にサーバー側を消す。端末の中を先に消すと id を見失う。
    // シーズン(Cloudflare の台帳) → ランキングと台帳(Firebase) の順。
    // どちらかが消せなければ止まり、端末の中は消さない
    if (me.id) {
      try {
        await forgetSeason();
      } catch (err) {
        setError(L("シーズンの記録を消せませんでした: {msg}", { msg: Lx(err.message) }));
        setStep("error");
        return;
      }
    }
    const res = me.id ? await deleteRank(me.id) : { ok: true };
    if (!res.ok) {
      setError(res.error);
      setStep("error");
      return;
    }
    forgetMe();
    // **端末に残ったものを全部**消す(2026-09-28 本人の報告
    // 「アカウントを消しても、以前に引いたガチャ結果が残ったまま」)。
    // forgetMe は名前と戦績だけなので、スキン・財布・バトルパスなどが残っていた
    forgetEverything();
    setStep("done");
  }

  return (
    <div
      className="modal-overlay"
      onClick={step === "running" ? undefined : onClose}
    >
      <div
        className="modal-panel settings-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{L("記録を消す")}</h3>
          {step !== "running" && (
            <button className="icon-btn" onClick={onClose} aria-label={L("閉じる")}>
              <Close size={18} />
            </button>
          )}
        </div>

        {step === "ask" && (
          <>
            {/* 2026-09-28 本人の報告。以前は名前と戦績だけを消しており、
                引いた札や財布が残ったまま次の人に見えていた。いまは全部消す */}
            <p className="hint">
              {(() => {
                const [pre, post] = L("この端末に残っている{all}を消します。").split("{all}");
                return (
                  <>
                    {pre}
                    <b>{L("すべて")}</b>
                    {post}
                  </>
                );
              })()}
            </p>
            <ul className="delete-me-list">
              <li>{L("名前・アイコン・称号・戦績・レート")}</li>
              <li>
                <b>{L("引いたスキン・ガチャチケット・ジェム・バトルパス")}</b>
              </li>
              <li>{L("チュートリアルの進み・詰めトッタリーの記録・ミッション")}</li>
              <li>{L("設定(音・演出・操作)と、見えなくした人の一覧")}</li>
              <li>{L("公開ランキングに載っているあなたの行")}</li>
            </ul>
            <p className="hint">
              <b>{L("元には戻せません。")}</b>
              {L("買ったジェムやチケットも戻りません。消したあとは、名前を決めるところから まっさらでやり直しになります。")}
            </p>
            <div className="settings-actions">
              <button className="btn btn-primary btn-wide" onClick={onClose}>
                {L("やめる")}
              </button>
              <button
                className="btn btn-ghost btn-wide btn-danger"
                onClick={run}
              >
                {L("消す")}
              </button>
            </div>
          </>
        )}
        {step === "running" && <p className="hint">{L("消しています…")}</p>}
        {step === "error" && (
          <>
            <p className="error-text">{Lx(error)}</p>
            <p className="hint">
              {L("通信できないと、公開されている記録を消せません。電波の届くところでもう一度お試しください。")}
            </p>
            <div className="settings-actions">
              <button className="btn btn-primary btn-wide" onClick={onClose}>
                {L("閉じる")}
              </button>
              <button className="btn btn-ghost btn-wide" onClick={run}>
                {L("もう一度")}
              </button>
            </div>
          </>
        )}
        {step === "done" && (
          <>
            <p className="report-done">{L("消しました。")}</p>
            <button className="btn btn-primary btn-wide" onClick={onDeleted}>
              {L("最初から始める")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 対局中の演出(装備した駒が相手を取ったときの動画、A の魔法)を出すかどうか。オン/オフだけ(2026-09-17 本人の指示)。
 * 召喚(ガチャ)の演出はここでは変えず、スキン画面の召喚ボタンの横で変える(2026-09-17 本人の指示)
 */
export function BattleMotionSettings() {
  const collection = useCollection();
  const [error, setError] = useState("");
  const on = collection.motion !== "off";
  return (
    <div className="settings-list battle-motion-settings">
      <div className="settings-row">
        <span>{L("対局中の演出（動画）")}</span>
        <button
          className="btn btn-ghost btn-small"
          aria-pressed={on}
          onClick={() => {
            const motion = on ? "off" : "full";
            setError("");
            updateCollection((s) => ({ ...s, motion })).catch((err) =>
              setError(Lx(err.message)),
            );
          }}
        >
          {on ? L("出さない") : L("出す")}
        </button>
      </div>
      <p className="settings-note">
        {L("いまは{state}。装備した駒が相手を取ったときの動画と、A の魔法の演出に効きます。召喚の演出はスキン画面の召喚ボタンの横で変えられます。", {
          state: on ? L("出します") : L("出しません"),
        })}
      </p>
      {error && <p className="settings-note settings-error">{error}</p>}
    </div>
  );
}

/**
 * 対局中の操作の設定(2026-09-28 本人の指示)。
 * いまは「駒を動かす前に確認する」の1つだけ。既定は on
 */
export function PlaySettings() {
  const [settings, setSettings] = useState(() => loadPlaySettings());
  const on = settings.confirmMove;
  return (
    <div className="settings-list">
      <div className="settings-row">
        <span>{L("駒を動かす前に確認する")}</span>
        <button
          className="btn btn-ghost btn-small"
          aria-pressed={on}
          onClick={() => setSettings(savePlaySettings({ confirmMove: !on }))}
        >
          {on ? L("しない") : L("する")}
        </button>
      </div>
      <p className="settings-note">
        {L("いまは")}
        {on
          ? L("行き先のマスを押したあと「動かす」で確定します。押し間違いで動いてしまうのを防げます。")
          : L("行き先のマスを押すとすぐ動きます。")}
        {L("相手の駒を取る手は、この設定に関わらず必ず確認します。")}
      </p>
    </div>
  );
}

/**
 * 言語(2026-11-11 本人の指示「設定画面に 日本語 / English の切り替えを足したい」)。
 * 端末に合わせる・日本語・English。言語は起動のときに決まるので、選んだら開き直す
 */
function LanguageSetting() {
  const [current] = useState(langSetting);
  const [picked, setPicked] = useState(current);
  const options = [
    ["auto", L("端末に合わせる")],
    ["ja", "日本語"], // i18n-ignore 言語の名前は、その言語で書く
    ["en", "English"],
  ];
  return (
    <>
      <div className="settings-list">
        <div className="settings-row">
          <span>{L("言語")}</span>
          <div className="settings-lang" role="radiogroup" aria-label={L("言語")}>
            {options.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={picked === id}
                className={`btn btn-small ${picked === id ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setPicked(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {picked !== current ? (
        <div className="settings-lang-apply">
          <p className="settings-note">
            {L("アプリを開き直して切り替えます。対局中は、終わってから切り替えてください。")}
          </p>
          <button className="btn btn-primary btn-small" onClick={() => setLangSetting(picked)}>
            {L("開き直して切り替える")}
          </button>
        </div>
      ) : (
        <p className="settings-note">{L("ストーリーの本文と漫画は、どちらの言語でも日本語です。")}</p>
      )}
    </>
  );
}

export function SettingsModal({ onClose }) {
  const [profile, setProfile] = useState(() => loadProfile());
  // "name" は名前を変える画面、"icon" はアイコンを選ぶ画面
  const [editing, setEditing] = useState(null);
  // 設定の種類(あなた・音と演出・安心・アプリ)
  const [tab, setTab] = useState("account");
  if (editing === "name")return (
      <NameEditModal
        onClose={() => setEditing(null)}
        onSaved={(next) => setProfile(next)}
      />
    );
  if (editing === "icon")return (
      <IconPickModal
        onClose={() => setEditing(null)}
        onSaved={(next) => setProfile(next)}
      />
    );
  if (editing === "title")return (
      <TitlePickModal
        onClose={() => setEditing(null)}
        onSaved={(next) => setProfile(next)}
      />
    );
  if (editing === "blocked")return <BlockedListModal onClose={() => setEditing(null)} />;
  if (editing === "delete")return (
      <DeleteMeModal
        onClose={() => setEditing(null)}
        // 名前を決める画面から出し直す。TotteryApp は起動時に
        // hasName() を読むので、読み込み直せばそこへ戻る
        onDeleted={() => location.reload()}
      />
    );
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel settings-panel"
        onClick={(t) => t.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{L("設定")}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={L("閉じる")}>
            <Close size={18} />
          </button>
        </div>
        {/* 中身が増えて縦に長くなったので、4つに分けて1画面ずつ出す
            (2026-09-18 本人の指示「使いやすいUIで見やすいレイアウトに」) */}
        <div className="settings-tabs" role="tablist" aria-label={L("設定の種類")}>
          {[
            ["account", L("プレイヤー")],
            ["look", L("音と演出")],
            ["safety", L("安心")],
            ["about", L("アプリ")],
          ].map(([id, label]) => (
            <button
              key={id}
              className="btn btn-ghost"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="settings-body">
          {tab === "account" && (
            <>
              <AccountCard
                profile={profile}
                onEditName={() => setEditing("name")}
                onEditIcon={() => setEditing("icon")}
                onEditTitle={() => setEditing("title")}
              />
              <div className="settings-list">
                {/* 着せ替えを決めたら設定ごと閉じて、ホームを見せる(2026-09-18 本人の指示) */}
                <HomeCustomizationButton settings onApplied={onClose} />
              </div>
              <AppearanceSettings />
            </>
          )}
          {tab === "look" && (
            <>
              <p className="settings-head">{L("音")}</p>
              <SoundSettings />
              <p className="settings-head">{L("振動")}</p>
              <HapticSettings />
              <p className="settings-head">{L("対局中の操作")}</p>
              <PlaySettings />
              <p className="settings-head">{L("対局中の演出")}</p>
              <BattleMotionSettings />
            </>
          )}
          {tab === "safety" && (
            <>
              <div className="settings-list">
                <div className="settings-row">
                  <span>{L("見えなくした人")}</span>
                  <button
                    className="btn btn-ghost btn-small"
                    onClick={() => setEditing("blocked")}
                  >
                    {L("{n}人", { n: loadBlocked().length })}
                  </button>
                </div>
              </div>
              <p className="settings-note">
                {L("ランキングの右端の「⋯」から、その人を通報したり、見えなくしたりできます。")}
              </p>
              <p className="settings-head">{L("記録を消す")}</p>
              <div className="settings-list">
                <div className="settings-row">
                  <span>{L("自分の記録を消す")}</span>
                  <button
                    className="btn btn-ghost btn-small btn-danger"
                    onClick={() => setEditing("delete")}
                  >
                    {L("消す")}
                  </button>
                </div>
              </div>
              <p className="settings-note">
                {L("名前・戦績・レートと、公開ランキングのあなたの行を消します。元には戻せません。")}
              </p>
            </>
          )}
          {tab === "about" && (
            <LanguageSetting />
          )}
          {tab === "about" && (
            <div className="settings-list">
              <div className="settings-row">
                <span>{L("ゲームの版")}</span>
                <b>{VERSION}</b>
              </div>
              <div className="settings-row">
                <span>{L("この版の内容")}</span>
                <b>{Lx(VERSION_NOTE)}</b>
              </div>
              <div className="settings-row">
                <span>{L("音の出どころ")}</span>
                <b>
                  {Lx(MUSIC_CREDIT)} / {Lx(SE_CREDIT)}
                </b>
              </div>
              <div className="settings-row">
                <span>{L("ルールの確認")}</span>
                <b>{L("右上の「i」から")}</b>
              </div>
              <div className="settings-row">
                <span>{L("通信")}</span>
                <b>{L("オンライン対戦に対応")}</b>
              </div>
              <div className="settings-row">
                <span>{L("お問い合わせ")}</span>
                {hasSupportContact() ? (
                  <a
                    className="settings-link"
                    href={supportMailto(VERSION)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                ) : (
                  <b className="settings-todo">{L("未設定")}</b>
                )}
              </div>
              <div className="settings-row">
                <span>{L("プライバシーポリシー")}</span>
                {hasPrivacyUrl() ? (
                  <a
                    className="settings-link"
                    href={PRIVACY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {L("開く")}
                  </a>
                ) : (
                  <b className="settings-todo">{L("未設定")}</b>
                )}
              </div>
            </div>
          )}
        </div>
        <button className="btn btn-primary btn-wide" onClick={onClose}>
          {L("閉じる")}
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
          {L("降参しますか?")}
        </h3>
        <p className="hint">
          {(() => {
            const [pre, post] = L("{who}の負けとして、この対局が終わります。").split("{who}");
            return (
              <>
                {pre}
                <b
                  style={{
                    color: n.color,
                  }}
                >
                  {playerLabel(viewer, viewer, names)}
                </b>
                {post}
              </>
            );
          })()}
        </p>
        <div
          className="setup-actions"
          style={{
            marginTop: 16,
            flexDirection: "column",
          }}
        >
          <button className="btn btn-primary" onClick={onCancel}>
            {L("対局を続ける")}
          </button>
          <button className="btn btn-ghost" onClick={onResign}>
            <Flag size={16} /> {L("降参する")}
          </button>
        </div>
      </div>
    </div>
  );
}
/** counts: レートに数える対局か(ランダムマッチの 9×9)。フレンド対戦・近くの端末・5×5 は数えない */
export function QuitConfirm({ onCancel, onQuit, network, counts = !!network, story = false }) {
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
          {L("対局をやめますか?")}
        </h3>
        <p className="hint">
          {network && !counts ? (
            (() => {
              const [pre, post] = L(
                "途中でやめると{resign}になり、相手の勝ちとして勝敗がつきます。相手には「降参」と伝わります(この対局はレートに数えません)。",
              ).split("{resign}");
              return (
                <>
                  {pre}
                  <b>{L("降参")}</b>
                  {post}
                </>
              );
            })()
          ) : network ? (
            (() => {
              const [pre, post] = L("オンライン対戦では、途中でやめると{resign}になります。").split("{resign}");
              return (
                <>
                  {pre}
                  <b>{L("降参")}</b>
                  {post}
                  <br />
                  {L("相手の勝ちとして勝敗がつき、レート(月間シーズンの成績)を清算します。相手には「降参」と伝わります。")}
                </>
              );
            })()
          ) : story ? (
            // ストーリーのステージ: 中断(クリアにも負けにもしない)。一覧へ戻る(2026-10-01)
            L("ステージを中断して、ストーリーの一覧に戻ります。クリアにも負けにもなりません。")
          ) : (
            L("今の対局は最初からやり直しになります。")
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
            {L("対局を続ける")}
          </button>
          <button className="btn btn-ghost" onClick={onQuit}>
            <ArrowLeft size={16} />{" "}
            {network ? L("降参してホームに戻る") : story ? L("中断してストーリーへ") : L("やめてタイトルに戻る")}
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
    me === null ? nameOf(i, names) : i === me ? L("あなた") : L("相手");
  const shown = effects.revealed || [];
  const myShown = me === null ? [] : shown.filter((c) => c.owner === me);
  const foeShown = me === null ? shown : shown.filter((c) => c.owner !== me);

  return (
    <div className="modal-overlay">
      <div className="modal-panel bonus-panel">
        <p className="bonus-eyebrow">{L("布陣ボーナス")}</p>

        <ul className="bonus-list">
          {[0, 1].map((i) =>
            effects.straights[i] ? (
              <li className="bonus-row" key={`s${i}`}>
                <span
                  className="bonus-tag"
                  style={{ "--who": PLAYER_META[i].color }}
                >
                  {L("ストレート")}
                </span>
                <span>{L("{side}の布陣が数字で並んだ", { side: side(i) })}</span>
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
                  {L("フラッシュ")}
                </span>
                <span>{L("{side}の布陣がマークでそろった", { side: side(i) })}</span>
              </li>
            ) : null,
          )}
        </ul>

        {effects.straights.some(Boolean) && (
          <p className="bonus-note">
            {effects.swapped
              ? L("先手と後手が入れ替わり、{side}から始まります。", { side: side(effects.first) })
              : L("両者ストレートのため、先手はそのままです。")}
          </p>
        )}

        {foeShown.length > 0 && (
          <>
            <p className="bonus-note">
              {me === null
                ? L("{n}枚の駒が公開されました。", { n: foeShown.length })
                : L("相手の駒が{n}枚めくれました。", { n: foeShown.length })}
            </p>
            <div className="bonus-cards">
              {foeShown.map((c) => (
                <div className="bonus-card" key={c.id}>
                  <CardFace
                    owner={c.owner}
                    rank={c.rank}
                    suit={c.suit}
                    size="sm"
                  />
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
            {L("あなたの駒が{n}枚、相手に見えてしまいました。 盤の「公開」の印が目印です。", { n: myShown.length })}
          </p>
        )}

        <button className="btn btn-primary" onClick={onClose}>
          {L("対局を始める")} <Check size={16} />
        </button>
      </div>
    </div>
  );
}
