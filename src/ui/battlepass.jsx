import { GemAmount } from "./gem.jsx";
/**
 * バトルパスの画面。
 *
 * 1,500ジェムで買い切り解放・周回制(2026-09-13)。真ん中から外へ、縦横に隣り合う
 * マスだけを埋めていく。各マスをクリアするとガチャチケットが1枚(1周=24枚)。
 * 1周目は全25マスを開くと魔法で並び替わり、完成でスキンを獲得。2周目以降は
 * チケットだけで、盤をリセットしてまた遊べる(周回は1週間に3回まで)。
 *
 * シーズンごとに別のパス(2026-10-15 本人の指示)。上のタブで魔術師／アリスを切り替える。
 * 進めるのは1つだけ(「このバトルパスを進める」で選ぶ。対局で取った駒はそちらに数える)。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Sparkle } from "../icons.jsx";
import {
  CELLS,
  SIZE,
  allCleared,
  allFlipped,
  canClaim,
  cycleDone,
  flipAll,
  markAssembled,
  rewardSkin,
  startNewCycle,
  completeCycle,
  statusOf,
  toggleFlip,
} from "../game/battlepass.js";
import { getPass, updatePass, usePass, useActivePassId, setActivePassId } from "../game/battlepass-store.js";
import { DEFAULT_SEASON, contentSeason, openSeasons } from "../game/content-seasons.js";
import { claimSpecial } from "../skins/collection.js";
import { useCollection } from "../skins/store.js";
import {
  BATTLEPASS_GEMS,
  BATTLEPASS_TICKETS_PER_CYCLE,
  BATTLEPASS_CYCLES_PER_WEEK,
} from "../iap/catalog.js";
import { shopAvailable } from "../net/iap.js";
import { newEventId, syncWallet } from "../net/wallet.js";
import { buyPassFor } from "./buy.js";
import { GemShop } from "./gem-shop.jsx";
import { updateCollection } from "../skins/store.js";
import { unlockAudio } from "../audio/index.js";
import { BattlePassSkinLock } from "./battlepass-skin-lock.jsx";
import { useUnlockedPassSeasons } from "./battlepass-access.js";
import { BattlePassMagic } from "./battlepass-magic.jsx";
import { SeriesSelect } from "./series-select.jsx";

/** embedded: ミッション・バトルパスのタブ画面(quests.jsx)の中。見出しは向こうが出す。initialSeason: 最初に出すシーズン */
// onSkins は受けるが使わない(クリア後に装備を促す釦は出さない。2026-10-16 本人の指示)
export function BattlePassScreen({ onBack, onSkins = null, embedded = false, initialSeason = null }) {
  const seasons = openSeasons();
  const activeId = useActivePassId();
  // 最初に出すパス：指定があればそれ、なければ進めているもの、それも無ければいちばん新しいシーズン
  const [season, setSeason] = useState(() =>
    initialSeason && seasons.some((s) => s.id === initialSeason)
      ? initialSeason
      : seasons.some((s) => s.id === activeId)
        ? activeId
        : (seasons.at(-1) || { id: DEFAULT_SEASON }).id,
  );
  useEffect(() => {
    if (initialSeason && openSeasons().some((s) => s.id === initialSeason)) setSeason(initialSeason);
  }, [initialSeason]);
  const info = contentSeason(season) || contentSeason(DEFAULT_SEASON);
  const isActive = activeId === season;
  const pass = usePass(season);
  const collection = useCollection();
  const unlocked = useUnlockedPassSeasons();
  const owned = unlocked.includes(season);
  const activeOwned = unlocked.includes(activeId);
  const [shopOk, setShopOk] = useState(false);
  const [shop, setShop] = useState(false);
  const [buying, setBuying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState("");
  const [animationReady, setAnimationReady] = useState(false);
  const [showConditions, setShowConditions] = useState(false);
  // 今週まだバトルパスで受け取れるチケット枚数(サーバーが数える)。周回の残り回数に使う
  const [passLeft, setPassLeft] = useState(null);
  const claiming = useRef(false);
  const attempted = useRef(false);
  const mounted = useRef(false);
  const skin = rewardSkin(season);
  const imageSrc = skin.boardCard || skin.card;
  const rows = CELLS.map((c) => statusOf(c, pass));
  const done = rows.filter((c) => c.cleared).length;
  const turned = rows.filter((c) => c.flipped).length;
  // スキンの完成(めくり・並び替え)は1周目だけ。2周目以降は盤を埋めるだけ
  const firstCycle = (pass.cycle || 1) < 2;
  const pending =
    firstCycle && allFlipped(pass) && !pass.assembled && !pass.claimed;
  const assembled = firstCycle && (pass.assembled || pass.claimed);
  // 今週あと何周できるか(1周=24枚)。null は未取得
  const cyclesLeft =
    passLeft == null
      ? null
      : Math.floor(passLeft / BATTLEPASS_TICKETS_PER_CYCLE);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 店が出せる端末(iOS)か。開いたら残高と、今週あと何枚受け取れるかを取り直す
  useEffect(() => {
    let alive = true;
    shopAvailable().then((ok) => alive && setShopOk(ok));
    syncWallet()
      .then((d) => {
        if (alive && d && Number.isSafeInteger(d.passTicketsLeftThisWeek))
          setPassLeft(d.passTicketsLeftThisWeek);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 運営が「クリア状態」にした印(サーバーの passComplete)を見て、盤を埋めてスキンを受け取る。
  // 同じ印は二度当てない(pass.grantedAt に控える)
  const grantAt = season === DEFAULT_SEASON ? collection.passComplete : collection.passCompleteBySeason?.[season];
  useEffect(() => {
    const at = grantAt;
    if (!at || pass.grantedAt === at) return;
    updatePass((s) => completeCycle(s, at), season);
    updateCollection((s) => claimSpecial(s, skin.id)).catch(() => {});
    setMessage("運営がバトルパスをクリア状態にしました。");
  }, [grantAt, pass.grantedAt, skin.id, season]);

  // 進めているパスを持っていない(未購入)のに、このパスは持っている → こちらを進める
  useEffect(() => {
    if (owned && !isActive && !activeOwned) setActivePassId(season);
  }, [owned, isActive, activeOwned, season]);

  // ジェムでバトルパスを買う(サーバーで減らして権利をつける)。足りなければ店を開く
  const purchase = useCallback(async () => {
    if (buying) return;
    setBuying(true);
    setMessage("");
    // 決済の呼び出しは src/ui/buy.js の1本に寄せてある(ショップと同じ道)
    const r = await buyPassFor(season);
    if (mounted.current) {
      setMessage(r.message);
      if (r.needGems && shopOk) setShop(true);
      setBuying(false);
    }
    return r.ok;
  }, [buying, shopOk, season]);

  // 次の周へ。今週の残枠(サーバーが正)を確かめてから盤をリセットする
  const nextCycle = useCallback(async () => {
    if (switching) return;
    setSwitching(true);
    setMessage("");
    try {
      const d = await syncWallet().catch(() => null);
      const left =
        d && Number.isSafeInteger(d.passTicketsLeftThisWeek)
          ? d.passTicketsLeftThisWeek
          : 0;
      if (mounted.current) setPassLeft(left);
      if (left < BATTLEPASS_TICKETS_PER_CYCLE) {
        if (mounted.current)
          setMessage("今週の周回(3回)を使い切りました。来週また挑戦できます。");
        return;
      }
      updatePass(startNewCycle, season);
    } finally {
      if (mounted.current) setSwitching(false);
    }
  }, [switching, season]);

  // 最後の札のめくりを見せてから、同じ25片の並び替えへつなぐ。
  useEffect(() => {
    if (!owned || !pending) {
      setAnimationReady(false);
      return;
    }
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 560;
    const timer = setTimeout(() => setAnimationReady(true), delay);
    return () => clearTimeout(timer);
  }, [pending, owned]);

  const claim = useCallback(async () => {
    if (claiming.current || !canClaim(getPass(season)) || !owned) return;
    claiming.current = true;
    setBusy(true);
    setMessage("");
    try {
      // 先行受取済みの場合や保存の再試行でも、特別スキンは1枚だけ。
      await updateCollection((s) => claimSpecial(s, skin.id));
      updatePass((s) => (canClaim(s) ? { ...s, claimed: true } : s), season);
      if (mounted.current) setMessage(`「${skin.name}」を手に入れました。`);
    } catch (e) {
      if (mounted.current)
        setMessage(
          (e && e.message) || "受け取れませんでした。もう一度お試しください。",
        );
    } finally {
      claiming.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [skin.id, skin.name, owned, season]);

  // 完成後だけ自動付与(権利があるとき)。保存失敗時には完成状態を保ち、明示的に再試行できる。
  useEffect(() => {
    if (!canClaim(pass) || attempted.current || !owned) return;
    attempted.current = true;
    claim();
  }, [pass, claim, owned]);

  const finishMagic = useCallback(() => {
    updatePass(markAssembled, season);
  }, [season]);

  function flip(id) {
    if (!owned || pending || assembled || !firstCycle) return;
    unlockAudio();
    updatePass((s) => toggleFlip(s, id), season);
  }

  function flipCompleted() {
    if (!owned || pending || assembled || !firstCycle) return;
    unlockAudio();
    updatePass((s) => flipAll(s, turned < done), season);
  }

  return (
    <div className="setup-wrap">
      {!embedded && <h2>バトルパス</h2>}
      {seasons.length > 1 && (
        /* 札1枚＋押すと縦一覧のシート(src/ui/series-select.jsx。2026-10-15 本人の決め「1」。どこも同じ部品) */
        <SeriesSelect
          className="pass-seasons"
          items={seasons.map((s) => ({ id: s.id, name: s.passName, note: activeId === s.id ? "進行中" : undefined, art: rewardSkin(s.id)?.card }))}
          value={season}
          onChange={setSeason}
          label="バトルパスを選ぶ"
          hint="パスを選ぶ"
        />
      )}
      {owned &&
        (isActive ? (
          <p className="pass-active-note" role="status">
            <Check size={14} /> このバトルパスを進めています（対局で取った駒を数えます）
          </p>
        ) : (
          <div className="pass-active-switch">
            <p className="hint">
              いま進めているのは「{contentSeason(activeId)?.passName || "魔術師のバトルパス"}」です。対局で取った駒はそちらに数えます。
            </p>
            <button className="btn btn-ghost btn-small" type="button" onClick={() => setActivePassId(season)}>
              このバトルパスを進める
            </button>
          </div>
        ))}
      {owned && (
        <p className="hint">
          相手の駒を取ると、真ん中のとなりのマスから埋まっていきます。
          マスをクリアするたびにガチャチケットが1枚（1周＝
          {BATTLEPASS_TICKETS_PER_CYCLE}枚）。
          {firstCycle
            ? "25マスすべてを開くと魔法で並び替わり、1周目は完成でスキンを獲得します。"
            : "盤を埋めると次の周へ進めます。"}
        </p>
      )}
      <p className="pass-reward">
        <Sparkle size={16} /> 各マスでチケット1枚
        {firstCycle && (
          <strong>・1周目の完成でA専用スキン「{skin.name}」</strong>
        )}
      </p>
      {owned && (
        <div className="pass-counts">
          <span>
            クリア <b>{done}</b>/{CELLS.length}
          </span>
          {firstCycle ? (
            <span>
              めくった <b>{assembled ? CELLS.length : turned}</b>/{CELLS.length}
            </span>
          ) : (
            <span>{pass.cycle}周目</span>
          )}
          {cyclesLeft != null && <span>今週あと{cyclesLeft}周</span>}
        </div>
      )}
      {!owned ? (
        <div
          className="pass-locked"
          aria-label="未購入のバトルパス。購入すると解放されます"
        >
          <BattlePassSkinLock className="pass-locked-art" />
          <div className="pass-locked-caption">
            <strong>{info.passName}を購入して解放</strong>
            <span>マスを埋めるとチケット。1周目の完成でA専用「{skin.name}」</span>
          </div>
        </div>
      ) : pending && animationReady ? (
        <BattlePassMagic
          imageSrc={imageSrc}
          order={pass.puzzleOrder}
          onComplete={finishMagic}
        />
      ) : assembled && !showConditions ? (
        <div className="pass-complete-art">
          <img src={imageSrc} alt={`完成した${skin.name}のイラスト`} />
        </div>
      ) : (
        <div
          className="pass-grid"
          style={{ "--n": SIZE }}
          role="group"
          aria-label="バトルパスのマス"
        >
          {rows.map((c, index) => {
            const piece = pass.puzzleOrder[index];
            const flipped = c.flipped && !showConditions;
            // ミッションの位置は固定。絵の欠片だけ、保存した順序で出す。
            const art = {
              backgroundImage: `url(${imageSrc})`,
              backgroundSize: `${SIZE * 100}% ${SIZE * 100}%`,
              backgroundPosition: `${((piece % SIZE) / (SIZE - 1)) * 100}% ${
                (Math.floor(piece / SIZE) / (SIZE - 1)) * 100
              }%`,
            };
            const label = c.free
              ? c.name
              : `${c.name}（${c.now}/${c.goal}）${
                  flipped ? "・めくり済み" : c.cleared ? "・クリア済み" : ""
                }`;
            return (
              <button
                type="button"
                className={`pass-cell ${c.onlineOnly ? "is-online" : ""} ${c.free ? "is-free" : ""} ${
                  c.cleared ? "is-cleared" : c.open ? "is-open" : "is-locked"
                } ${flipped ? "is-flipped" : ""}`}
                key={c.id}
                aria-label={label}
                title={label}
                disabled={!c.cleared || pending || assembled || !firstCycle}
                onClick={() => flip(c.id)}
              >
                {/* 表は条件、裏は絵柄の一片。押すとくるっと回って入れ替わる */}
                <span className="pass-inner">
                  <span className="pass-front">
                    {c.onlineOnly && (
                      <span className="pass-scope">
                        オンライン
                        <br />
                        対戦で
                      </span>
                    )}
                    <span className="pass-name">{c.shortName || c.name}</span>
                    {!c.free && (
                      <span className="pass-num">
                        {c.now}/{c.goal}
                      </span>
                    )}
                    {c.cleared && !c.free && !assembled && firstCycle && (
                      <span className="pass-turn">めくる</span>
                    )}
                    {!c.cleared && (
                      <span
                        className="pass-bar"
                        style={{ "--p": `${Math.round(c.ratio * 100)}%` }}
                      />
                    )}
                  </span>
                  <span className="pass-back" style={art} />
                </span>
              </button>
            );
          })}
        </div>
      )}
      {owned &&
        (assembled ? (
          <div className="pass-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setShowConditions((v) => !v)}
            >
              {showConditions
                ? "完成したイラストを見る"
                : "クリアした条件を見る"}
            </button>
          </div>
        ) : (
          firstCycle &&
          done > 1 &&
          !pending && (
            <div className="pass-actions">
              <button className="btn btn-ghost" onClick={flipCompleted}>
                {turned < done
                  ? "クリアしたマスを全部めくる"
                  : "全部を条件に戻す"}
              </button>
            </div>
          )
        ))}
      <p className="mission-message" role="status" aria-live="polite">
        {message}
      </p>
      {!owned ? (
        <div className="pass-purchase">
          <p className="hint">
            バトルパスの購入で解放されます（ミッションでためた無償ジェムでも可）。 ジェム{" "}
            <GemAmount amount={collection.gems || 0} />。
          </p>
          <button
            className="btn btn-primary btn-wide"
            disabled={buying}
            onClick={purchase}
          >
            {buying ? (
              "購入を確認しています…"
            ) : (
              <>
                {info.passName}を購入（
                <GemAmount amount={BATTLEPASS_GEMS} />）
              </>
            )}
          </button>
          {shopOk && (
            <button
              className="btn btn-ghost"
              disabled={buying}
              onClick={() => setShop(true)}
            >
              ジェムを買う
            </button>
          )}
        </div>
      ) : pass.claimed && firstCycle ? (
        <p className="pass-earned" role="status">
          <Sparkle size={18} /> スキン獲得
          <strong>A専用「{skin.name}」</strong>
        </p>
      ) : canClaim(pass) ? (
        <button
          className="btn btn-primary btn-wide"
          disabled={busy}
          onClick={claim}
        >
          <Check size={16} />{" "}
          {busy ? "スキンを受け取っています…" : "スキンの受け取りを再試行"}
        </button>
      ) : firstCycle ? (
        <p className="hint">
          {pending
            ? "25枚の欠片が、ひとつの絵に。"
            : allCleared(pass)
              ? "最後のマスをめくると、並び替えの魔法が始まります。"
              : "25マスすべてを開くと、並び替えの魔法が始まります。"}
        </p>
      ) : (
        <p className="hint">
          {cycleDone(pass)
            ? "この周のチケットはそろいました。"
            : "マスをクリアしてチケットを集めよう。"}
        </p>
      )}
      {owned && cycleDone(pass) && (
        <div className="pass-purchase">
          {cyclesLeft === 0 ? (
            <p className="hint">
              今週の周回（{BATTLEPASS_CYCLES_PER_WEEK}
              回）を使い切りました。来週また挑戦できます。
            </p>
          ) : (
            <button
              className="btn btn-primary btn-wide"
              disabled={switching}
              onClick={nextCycle}
            >
              {switching
                ? "次の周を用意しています…"
                : `次の周へ（チケット${BATTLEPASS_TICKETS_PER_CYCLE}枚）`}
            </button>
          )}
        </div>
      )}
      {/* クリア後に装備を促す釦は出さない(2026-10-16 本人の指示) */}
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> ホームに戻る
      </button>
      {shop && (
        <GemShop
          gems={collection.gems || 0}
          gemsFree={collection.gemsFree || 0}
          onClose={() => setShop(false)}
          onMessage={setMessage}
        />
      )}
    </div>
  );
}
