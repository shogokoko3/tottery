import { HomeCustomizationButton } from "./home-customization.jsx";
import { AppearanceSettings } from "./season.jsx";
import { useCollection, updateCollection } from "../skins/store.js";
import { useEffect, useState } from "react";
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
      dice: "サイコロフェーズ",
      mulligan: "引き直しフェーズ",
      setup: "布陣フェーズ",
      turn: "ターン交代",
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
        <h3>ここに動かしますか</h3>
        <p className="hint">
          {from ? (
            <>
              <strong>{from}</strong> から <strong>{to}</strong> へ動かします。
            </>
          ) : (
            <>
              <strong>{to}</strong> へ動かします。
            </>
          )}
          <br />
          やめれば、別のマスや別の駒を選び直せます。
        </p>
        <div className="setup-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            やめる
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            動かす
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
              ? `伏せ札を${count}枚、まとめて取る?`
              : where
                ? `${where[0]} の伏せ札を、取る?`
                : "この伏せ札を、取る?"
            : count > 1
              ? `${count}体をまとめて取ります`
              : "この駒を取ります"}
        </h3>
        <p className="hint">
          {where && !plain && (
            <>
              対象のマス: <strong>{where.join(" / ")}</strong>
              <br />
            </>
          )}
          {plain ? "取れば、正体が分かる。" : "取った駒の正体は、取ったあとに公開されます。"}
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

export function LogViewer({ piece, viewer, onClose, revealAll, onMemo }) {
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
        {onMemo && (
          <button className="btn btn-ghost" onClick={onMemo}>
            ✎ 自分だけの推理メモ
          </button>
        )}
        {u && piece.originalRank && piece.originalRank !== piece.rank && (
          <p className="card-origin-note">
            元のカード：<b>{piece.originalRank}{SUIT_SYMBOL[piece.suit]}</b>
            <span> → {piece.alive ? "現在" : "撃破時"}：{piece.rank}{SUIT_SYMBOL[piece.suit]}</span>
          </p>
        )}
        {u && (
          <CardGuide
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

/**
 * 音の設定。
 *
 * 触ったその場で鳴っている音に効き、そのまま端末に残る。
 * 効果音のつまみを動かしたときは、その場で1度鳴らして大きさを確かめられる。
 */
function SoundSettings() {
  const [audio, setAudio] = useState(() => audioSettings());
  return (
    <div className="settings-list">
      <div className="settings-row">
        <span>音</span>
        <button
          className="btn btn-ghost btn-small"
          onClick={() => setAudio(setMuted(!audio.muted))}
        >
          {audio.muted ? "鳴らす" : "鳴らさない"}
        </button>
      </div>
      <VolumeRow
        label="BGM"
        value={audio.bgm}
        muted={audio.muted}
        onChange={(v) => setAudio(setBgmVolume(v))}
      />
      <VolumeRow
        label="効果音"
        value={audio.se}
        muted={audio.muted}
        onChange={(v) => {
          setAudio(setSeVolume(v));
          playSound("place");
        }}
      />
      <div className="settings-row">
        <span>出どころ</span>
        <b>
          {MUSIC_CREDIT} / {SE_CREDIT}
        </b>
      </div>
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
          <h3>見えなくした人</h3>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            <Close size={18} />
          </button>
        </div>
        {list.length === 0 ? (
          <p className="hint">
            いません。ランキングの右端の「⋯」から、見たくない相手を隠せます。
          </p>
        ) : (
          <div className="settings-list">
            {list.map((b) => (
              <div className="settings-row" key={b.id}>
                <span>{b.name || "(名前なし)"}</span>
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => setList(unblock(b.id))}
                >
                  戻す
                </button>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-primary btn-wide" onClick={onClose}>
          閉じる
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
        setError(`シーズンの記録を消せませんでした: ${err.message}`);
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
          <h3>記録を消す</h3>
          {step !== "running" && (
            <button className="icon-btn" onClick={onClose} aria-label="閉じる">
              <Close size={18} />
            </button>
          )}
        </div>

        {step === "ask" && (
          <>
            {/* 2026-09-28 本人の報告。以前は名前と戦績だけを消しており、
                引いた札や財布が残ったまま次の人に見えていた。いまは全部消す */}
            <p className="hint">
              この端末に残っている<b>すべて</b>を消します。
            </p>
            <ul className="delete-me-list">
              <li>名前・アイコン・称号・戦績・レート</li>
              <li>
                <b>引いたスキン・ガチャチケット・ジェム・バトルパス</b>
              </li>
              <li>チュートリアルの進み・詰めトッタリーの記録・ミッション</li>
              <li>設定(音・演出・操作)と、見えなくした人の一覧</li>
              <li>公開ランキングに載っているあなたの行</li>
            </ul>
            <p className="hint">
              <b>元には戻せません。</b>
              買ったジェムやチケットも戻りません。消したあとは、名前を決めるところから
              まっさらでやり直しになります。
            </p>
            <div className="settings-actions">
              <button className="btn btn-primary btn-wide" onClick={onClose}>
                やめる
              </button>
              <button
                className="btn btn-ghost btn-wide btn-danger"
                onClick={run}
              >
                消す
              </button>
            </div>
          </>
        )}
        {step === "running" && <p className="hint">消しています…</p>}
        {step === "error" && (
          <>
            <p className="error-text">{error}</p>
            <p className="hint">
              通信できないと、公開されている記録を消せません。電波の届くところでもう一度お試しください。
            </p>
            <div className="settings-actions">
              <button className="btn btn-primary btn-wide" onClick={onClose}>
                閉じる
              </button>
              <button className="btn btn-ghost btn-wide" onClick={run}>
                もう一度
              </button>
            </div>
          </>
        )}
        {step === "done" && (
          <>
            <p className="report-done">消しました。</p>
            <button className="btn btn-primary btn-wide" onClick={onDeleted}>
              最初から始める
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
        <span>対局中の演出（動画）</span>
        <button
          className="btn btn-ghost btn-small"
          aria-pressed={on}
          onClick={() => {
            const motion = on ? "off" : "full";
            setError("");
            updateCollection((s) => ({ ...s, motion })).catch((err) =>
              setError(err.message),
            );
          }}
        >
          {on ? "出さない" : "出す"}
        </button>
      </div>
      <p className="settings-note">
        いまは{on ? "出します" : "出しません"}。装備した駒が相手を取ったときの動画と、A の魔法の演出に効きます。召喚の演出はスキン画面の召喚ボタンの横で変えられます。
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
        <span>駒を動かす前に確認する</span>
        <button
          className="btn btn-ghost btn-small"
          aria-pressed={on}
          onClick={() => setSettings(savePlaySettings({ confirmMove: !on }))}
        >
          {on ? "しない" : "する"}
        </button>
      </div>
      <p className="settings-note">
        いまは
        {on
          ? "行き先のマスを押したあと「動かす」で確定します。押し間違いで動いてしまうのを防げます。"
          : "行き先のマスを押すとすぐ動きます。"}
        相手の駒を取る手は、この設定に関わらず必ず確認します。
      </p>
    </div>
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
          <h3>設定</h3>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            <Close size={18} />
          </button>
        </div>
        {/* 中身が増えて縦に長くなったので、4つに分けて1画面ずつ出す
            (2026-09-18 本人の指示「使いやすいUIで見やすいレイアウトに」) */}
        <div className="settings-tabs" role="tablist" aria-label="設定の種類">
          {[
            ["account", "プレイヤー"],
            ["look", "音と演出"],
            ["safety", "安心"],
            ["about", "アプリ"],
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
              <p className="settings-head">音</p>
              <SoundSettings />
              <p className="settings-head">対局中の操作</p>
              <PlaySettings />
              <p className="settings-head">対局中の演出</p>
              <BattleMotionSettings />
            </>
          )}
          {tab === "safety" && (
            <>
              <div className="settings-list">
                <div className="settings-row">
                  <span>見えなくした人</span>
                  <button
                    className="btn btn-ghost btn-small"
                    onClick={() => setEditing("blocked")}
                  >
                    {loadBlocked().length}人
                  </button>
                </div>
              </div>
              <p className="settings-note">
                ランキングの右端の「⋯」から、その人を通報したり、見えなくしたりできます。
              </p>
              <p className="settings-head">記録を消す</p>
              <div className="settings-list">
                <div className="settings-row">
                  <span>自分の記録を消す</span>
                  <button
                    className="btn btn-ghost btn-small btn-danger"
                    onClick={() => setEditing("delete")}
                  >
                    消す
                  </button>
                </div>
              </div>
              <p className="settings-note">
                名前・戦績・レートと、公開ランキングのあなたの行を消します。元には戻せません。
              </p>
            </>
          )}
          {tab === "about" && (
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
              <div className="settings-row">
                <span>お問い合わせ</span>
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
                  <b className="settings-todo">未設定</b>
                )}
              </div>
              <div className="settings-row">
                <span>プライバシーポリシー</span>
                {hasPrivacyUrl() ? (
                  <a
                    className="settings-link"
                    href={PRIVACY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    開く
                  </a>
                ) : (
                  <b className="settings-todo">未設定</b>
                )}
              </div>
            </div>
          )}
        </div>
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
          対局をやめますか?
        </h3>
        <p className="hint">
          {network && !counts ? (
            <>
              途中でやめると<b>降参</b>になり、相手の勝ちとして勝敗がつきます。相手には「降参」と伝わります(この対局はレートに数えません)。
            </>
          ) : network ? (
            <>
              オンライン対戦では、途中でやめると<b>降参</b>になります。
              <br />
              相手の勝ちとして勝敗がつき、レート(月間シーズンの成績)を清算します。相手には「降参」と伝わります。
            </>
          ) : story ? (
            // ストーリーのステージ: 中断(クリアにも負けにもしない)。一覧へ戻る(2026-10-01)
            "ステージを中断して、ストーリーの一覧に戻ります。クリアにも負けにもなりません。"
          ) : (
            "今の対局は最初からやり直しになります。"
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
            <ArrowLeft size={16} />{" "}
            {network ? "降参してホームに戻る" : story ? "中断してストーリーへ" : "やめてタイトルに戻る"}
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
