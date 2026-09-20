import { normalizeSummonFreeze, freezeLadder, freezeFoilUpgrade } from "../skins/summon-freeze.js";
import { SummonFreeze, useSummonFreeze } from "./summon-freeze.jsx";
import { GemIcon, GemAmount } from "./gem.jsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cardBackImg } from "../assets.js";
import {
  SKINS,
  ALL_SKINS,
  ALL_FOIL_SKINS,
  FOIL_SKINS,
  POOL,
  ODDS,
  FOIL_CHANCE,
  byId,
  rate,
  foilId,
  baseSkinId,
} from "../skins/catalog.js";
import {
  claimFoilMilestone,
  dismantle,
  dismantleAll,
  dismantleResults,
  dismantledIndexes,
  DISMANTLE_RARITIES,
  equip,
  exchangeFoil,
  FOIL_MILESTONE,
  foilMilestoneCheck,
  applyPull,
  pull,
  shatterMany,
  craftMany,
  unequip,
  foilRevealed,
  FREE_GACHA,
  PULL_COST,
} from "../skins/collection.js";
import {
  SHARD_NAME,
  SHARD_VALUE,
  EXCHANGE_COST,
  exchangeCheck,
  exchangeCostOf,
  foilSpares,
  shardsOf,
} from "../skins/shards.js";
import {
  CRAFT,
  CRAFT_MAX,
  ETHER_NAME,
  costOf,
  craftableCount,
  dustOf,
  etherOf,
  forgeSummary,
  isKeepsake,
  spares,
  totalOfSpares,
} from "../skins/ether.js";
import { AmountPicker } from "./amount-picker.jsx";
import { updateCollection, useCollection } from "../skins/store.js";
import {
  WALLET_SERVER,
  debitTickets,
  newEventId,
  syncWallet,
  migrateOnce,
  logPull,
  noteCollection,
  pullFromServer,
} from "../net/wallet.js";
import { shopAvailable, flushPurchases } from "../net/iap.js";
import { adsAvailable, watchAdForTicket } from "../net/ads.js";
import {
  GEM_PER_TICKET,
  TICKET_BUNDLE,
  ETHER_EXCHANGE,
  etherFor,
  FIRST_PURCHASE_SKIN,
} from "../iap/catalog.js";
import { GemShop } from "./gem-shop.jsx";
import { CardFace } from "./cards.jsx";
import { SkinModal, useReducedMotion } from "./skin-modal.jsx";
import { AREA_BY_RANK, AREA_INFO } from "../game/areas.js";
import { AreaPreview } from "./area-preview.jsx";
import { AreaAcquisition } from "./area-acquisition.jsx";
import { areaRewardName, areaRewardsFor } from "../skins/area-rewards.js";
import { SkinFilm } from "./skin-film.jsx";
import { ArrowLeft, Ether, Shard } from "../icons.jsx";
import { OMEN_TEXT, ladderFor, omenOf, seedOf, foilRevealRoute } from "../skins/reveal.js";
import { BattlePassSkinLock } from "./battlepass-skin-lock.jsx";
import { FoilArtwork } from "./foil-artwork.jsx";
import { FoilOfferSheet } from "./foil-offer.jsx";
import { buyFoilFor, buyTicketsFor } from "./buy.js";
import { TicketBuy } from "./ticket-buy.jsx";
import {
  foilOffers,
  bandOf,
  skinVisibleInCollection,
  startFoilWindow,
} from "../skins/foil-shop.js";
import { addEther } from "../skins/collection.js";
import { buyEther } from "../net/wallet.js";
import { FoilAcquisition } from "./foil-acquisition.jsx";
import { FoilSeal, FoilUnveiling } from "./foil-unveiling.jsx";
import { SummonIntro } from "./summon-intro.jsx";

const foilPct = FOIL_CHANCE * 100;
/**
 * 効果盤面(src/game/areas.js)の案内。フォイル版だけがエリアを立てられる。
 * フォイルの詳細ではエリアの名前・効果・発動の条件を、通常版では
 * 「フォイル版を手に入れると開く」ことを伝える
 */
function SkinAreaNote({ skin, owned, equipped }) {
  if (skin.id === "genie-magician:foil")
    return (
      <div className="skins-area-note">
        <b>マジカルシャッフル · 9×9</b>
        <p>Aが王でなくても、毎回の自分の手番に任意で1回発動。自軍のAと王を除く駒からランダムな3体の位置を入れ替えます。相手の王も対象です。発動後も通常の移動ができます。</p>
      </div>
    );
  const type = AREA_BY_RANK[skin.rank];
  if (!type) return null;
  const info = AREA_INFO[type];
  if (!skin.foil)return (
      <p className="skins-area-note skins-area-note-plain">
        フォイル版を手に入れると、効果盤面「{info.name}」が使えます。
      </p>
    );
  return (
    <div className={`skins-area-note skins-area-note-${type}`}>
      <span className="skins-eyebrow">効果盤面</span>
      <h3>{info.name}</h3>
      <AreaPreview
        type={type}
        skinId={skin.id}
        className="skins-area-preview"
      />
      <p>{info.text}</p>
      <p className="skins-area-how">
        このフォイルを <b>{skin.rank}</b> に装備し、<b>{skin.rank} を王</b>
        にすると使えます（9×9の対局のみ・自分の手番の初めに1回まで）。
        {!owned
          ? " まだ持っていません。ガチャや錬成でフォイルを引くか、同じキャラを通算100枚集めて加工すると手に入ります。"
          : equipped
            ? " いま装備中です。"
            : " 持っています。装備すると使えます。"}
      </p>
    </div>
  );
}

/**
 * その札のキャラのフォイル版を返す。画面に出してはいけないときは null。
 * - 10(白翼の天馬騎士)のようにフォイル版が存在しないキャラがある
 * - A のフォイルは全収集まで伏せる(skinVisibleInCollection)
 * - フォイルを1枚も持たないうちは、フォイルの存在ごと画面に出さない(foilKnown)
 * skin がフォイル版そのものでも foilId は自分自身を指すので、分岐は要らない。
 */
function visibleFoilOf(collection, foilKnown, skin) {
  const candidate = foilKnown && skin ? byId(foilId(skin.id)) : null;
  return skinVisibleInCollection(collection, candidate) ? candidate : null;
}

function FoilBadge({ className = "" }) {
  return <span className={`skins-foil-badge ${className}`}>FOIL</span>;
}

const isBattlePassLocked = (skin, owned) =>
  skin?.acquisition === "battlepass" && !owned[skin.id];

const rarityLabel = (s) =>
  s.rarity === "LIMITED"
    ? "初回購入特典"
    : s.rarity === "SPECIAL"
      ? "特別スキン"
      : s.rarity;

/**
 * 提供割合の見せ方。SSR は 3÷7 で割り切れないので、そのまま出すと
 * 0.42857142857142855％ になってしまう。小数第3位まで出し、
 * 末尾の 0 は落とす(16.25％ は 16.25％ のまま)。
 */
const ratePct = (skin) => Number(rate(skin).toFixed(3)).toString();

/** めくる1枚。指で引き寄せると角度がついてめくれ、半分を越えると裏返る */
/** 昇格の間合い。格を読ませる時間と、くるくる回る時間 */
const PROMOTE_HOLD_MS = 900;
const PROMOTE_SPIN_MS = 1100;

/** めくる1枚。指で引き寄せると角度がついてめくれ、半分を越えると裏返る */
function RevealCard({
  result,
  index,
  flipped,
  onFlip,
  onComplete,
  onRarityComplete,
  foilRevealed = false,
  foilRoute = "common",
  foilSelected = false,
  freezeInitial = null,
  foilUpgrade = false,
  reduce,
  seed,
  // そのキャラの所持数 { base, foil }。引いた札が通常・フォイルのどちらを埋めたかが分かる
  // (2026-09-18 本人の指示)
  owned = null,
}) {
  const skin = byId(result.id);
  // 素で出るか、昇格を経るかは束と位置で決まる(再読み込みしても同じ)
  const ladder = useMemo(
    () => freezeInitial ? freezeLadder(freezeInitial, skin.id) : skin.foil ? [skin.rarity] : ladderFor(skin.rarity, `${seed}#${index}`),
    [skin.id, skin.rarity, skin.foil, seed, index, freezeInitial],
  );
  // -1 は伏せたまま。0 以降は ladder の段階(昇格の途中)
  const [stage, setStage] = useState(-1);
  // 次の格へ向けて回っている最中か。回っている間も今の格は見せたまま
  const [spinning, setSpinning] = useState(false);
  // 着地した瞬間だけ光る
  const [landing, setLanding] = useState(false);
  const [settled, setSettled] = useState(false);
  const rarityRef = useRef(onRarityComplete);
  rarityRef.current = onRarityComplete;
  const completeRef = useRef(onComplete);
  const notified = useRef(false);
  const promotionFinal = useRef(false);
  completeRef.current = onComplete;
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  useEffect(() => {
    if (!flipped) return;
    if (reduce || promotionFinal.current || ladder.length === 1) {
      setStage(ladder.length - 1);
      setSpinning(false);
      if (reduce || promotionFinal.current) {
        promotionFinal.current = true;
        setLanding(false);
        return;
      }
      // 素で SR・SSR が出た札は、めくった瞬間に光る
      if (ladder[ladder.length - 1] !== "R") {
        setLanding(true);
        const t = setTimeout(() => setLanding(false), 650);
        return () => clearTimeout(t);
      }
      return;
    }
    setStage(0);
    const timers = [];
    let t = PROMOTE_HOLD_MS; // まず R を読ませる
    for (let k = 1; k < ladder.length; k++) {
      timers.push(setTimeout(() => setSpinning(true), t)); // 回りはじめる
      t += PROMOTE_SPIN_MS;
      timers.push(
        setTimeout(() => {
          setSpinning(false);
          setStage(k); // 着地して昇格
          if (k === ladder.length - 1) promotionFinal.current = true;
          setLanding(true);
        }, t),
      );
      timers.push(setTimeout(() => setLanding(false), t + 650));
      t += PROMOTE_HOLD_MS; // 上がった格を読ませてから次へ
    }
    return () => timers.forEach(clearTimeout);
  }, [flipped, reduce, ladder]);
  const down = (e) => {
    if (flipped) return;
    drag.current = {
      x: e.clientX,
      w: e.currentTarget.getBoundingClientRect().width || 120,
      moved: 0,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!drag.current || flipped) return;
    const dx = Math.abs(e.clientX - drag.current.x);
    drag.current.moved = Math.max(drag.current.moved, dx);
    setAngle(Math.min(180, (dx / drag.current.w) * 180));
  };
  const up = () => {
    if (!drag.current || flipped) return;
    const { moved } = drag.current;
    drag.current = null;
    setDragging(false);
    // 触っただけ(タップ)でもめくれる。引き寄せたなら半分を越えたときだけ
    if (moved < 8 || angle >= 90) onFlip();
    else setAngle(0);
  };
  const shown = stage >= 0 ? ladder[stage] : null;
  const next = stage >= 0 ? ladder[stage + 1] : null;
  const final = flipped && stage === ladder.length - 1;
  // Complete the final rarity landing before starting the separate foil change.
  useEffect(() => {
    if (!final) return;
    if (reduce) {
      setSettled(true);
      return;
    }
    const timer = setTimeout(() => setSettled(true), 650);
    return () => clearTimeout(timer);
  }, [final, reduce]);
  useEffect(() => {
    if (settled) rarityRef.current?.();
  }, [settled]);
  const identityHidden = skin.foil && !foilUpgrade && !foilRevealed && !reduce;
  const finished = final && settled && (!skin.foil || foilRevealed || reduce);
  useEffect(() => {
    if (!finished || notified.current) return;
    notified.current = true;
    completeRef.current?.();
  }, [finished]);
  const visibleSkin = foilUpgrade && !foilRevealed && !reduce ? byId(baseSkinId(skin.id)) : skin;
  // Hint only the actual promotion/foil cards; keep the ordinary backs quiet.
  const backGlow = !flipped && !freezeInitial
    ? skin.foil
      ? foilRoute === "legend" ? "ssr-foil" : "foil"
      : skin.rarity === "SSR" && ladder.length > 1
        ? "ssr"
        : null
    : null;
  const label = identityHidden ? "" :
    shown === "SSR" && ["LIMITED", "SPECIAL"].includes(skin.rarity)
      ? rarityLabel(skin)
      : shown;
  return (
    <button
      type="button"
      className={`reveal-card ${foilSelected ? "is-foil-selected" : ""} ${flipped ? "is-flipped" : ""} ${
        dragging ? "is-dragging" : ""
      } ${shown && !identityHidden ? `rarity-${shown}` : ""} ${final ? "is-final" : ""} ${
        spinning ? `is-spinning spin-to-${identityHidden ? "foil" : next}` : ""
      } ${landing && !identityHidden ? "is-landing" : ""} ${backGlow ? `back-glow-${backGlow}` : ""} ${reduce ? "is-reduced" : ""}`}
      style={{ "--i": index, "--angle": `${flipped ? 180 : angle}deg` }}
      data-index={index}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={(e) => {
        if (!flipped && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onFlip();
        }
      }}
      aria-label={
        flipped
          ? identityHidden ? "フォイルカード。正体はまだ光に包まれています" : final
            ? visibleSkin.name
            : shown
              ? `${label}。${next}へ昇格中`
              : `${index + 1}枚目をめくっています`
          : `${index + 1}枚目をめくる`
      }
    >
      <span className="reveal-inner">
        <img
          className="reveal-back"
          src={cardBackImg}
          alt=""
          draggable="false"
        />
        {backGlow && (
          <span className="reveal-back-light" aria-hidden="true">
            <span className="reveal-back-sheen" />
            {backGlow === "ssr-foil" && (
              <>
                <span className="reveal-back-aurora" />
                <svg className="reveal-back-regalia" viewBox="0 0 90 120" fill="none">
                  <path className="back-gold-tracery" d="M4 27V7h19M67 7h19v20M4 93v20h19M67 113h19V93M7 20l5-8h8M70 12h8l5 8M7 100l5 8h8M70 108h8l5-8M37 9l8-5 8 5-8 5zM37 111l8-5 8 5-8 5z" />
                  <g className="back-star-orbit">
                    <circle cx="45" cy="48" r="29" strokeDasharray="33 8 3 8" />
                    <path d="M45 15l3 5-3 5-3-5zM45 71l3 5-3 5-3-5zM12 48l5-3 5 3-5 3zM68 48l5-3 5 3-5 3z" />
                  </g>
                  <g className="back-star-orbit back-star-orbit-inner">
                    <circle cx="45" cy="48" r="23" strokeDasharray="24 12" />
                    <path d="M45 21l2 4-2 4-2-4zM45 67l2 4-2 4-2-4z" />
                  </g>
                  <path className="back-star-heart" d="M45 29l3.5 14 11.5 5-11.5 4L45 67l-3.5-15L30 48l11.5-5z" />
                </svg>
              </>
            )}
            <i />
            <i />
            <i />
          </span>
        )}
        <span className="reveal-front">
          {identityHidden ? (
            <span className="reveal-veil reveal-foil-seal"><FoilSeal legend={foilRoute === "legend"} /></span>
          ) : final ? (
              <FoilArtwork
                skin={visibleSkin}
                src={visibleSkin.card}
                alt={visibleSkin.role}
                animated={false}
              />
            ) : (
            <span className="reveal-veil" />
          )}
          <span className="reveal-rarity">{label || ""}</span>
          {final && visibleSkin.foil && !identityHidden && (
            <FoilBadge className="reveal-foil" />
          )}
          {spinning && <span className="reveal-promoting">{skin.foil && !foilUpgrade ? "覚醒" : "昇格"}</span>}
          {final && !identityHidden && <strong className="reveal-name">{visibleSkin.name}</strong>}
          {final && !identityHidden && !(foilUpgrade && !foilRevealed && !reduce) && result.isNew && (
            <span className="reveal-new">NEW</span>
          )}
          {/* 通常とフォイルを持っているか。引いた側は光らせる */}
          {final && !identityHidden && !(foilUpgrade && !foilRevealed && !reduce) && owned && (
            <span className="reveal-owned" aria-label="このキャラの所持">
              <b className={owned.base > 0 ? "is-owned" : ""}>
                通常{owned.base > 0 ? `×${owned.base}` : "—"}
              </b>
              <b className={owned.foil > 0 ? "is-owned is-foil" : ""}>
                箔{owned.foil > 0 ? `×${owned.foil}` : "—"}
              </b>
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/**
 * 召喚の開示。引いた札を伏せて並べ、1枚ずつ自分でめくる。
 * 束に SSR がいれば伏せた時点で前兆を出す。めくると R→SR→SSR と昇格して見せる。
 * 結果は先に保存してあるので、途中で閉じても失わない。
 */
function SummonReveal({ results, onFinish, reduce, drawNumber = 0, freeze: freezeInput = null }) {
  const freeze = useMemo(() => normalizeSummonFreeze(freezeInput, results.map(r => r.id)), [freezeInput, results]);
  // 引いた札ごとに、そのキャラの通常とフォイルを何枚持っているか(結果に出す)
  const ownedNow = useCollection().owned;
  const ownedOf = (id) => {
    const base = baseSkinId(id);
    return {
      base: ownedNow[base] || 0,
      foil: ownedNow[foilId(base)] || 0,
    };
  };
  const [intro, setIntro] = useState(!reduce);
  const [freezePhase, releaseFreeze] = useSummonFreeze(!!freeze, intro, reduce);
  const freezeLocked = !!freeze && freezePhase !== "released";
  const revealRef = useRef(null);
  const finishIntro = useCallback(() => setIntro(false), []);
  useEffect(() => { if (reduce) setIntro(false); }, [reduce]);
  const [flipped, setFlipped] = useState(() => results.map(() => false));
  const [completed, setCompleted] = useState(() => results.map(() => false));
  const [raritiesReady, setRaritiesReady] = useState(() =>
    results.map(() => false),
  );
  const [foilStart, setFoilStart] = useState(false);
  const [revealedFoils, setRevealedFoils] = useState(() => results.map(() => false));
  const foilIndexes = useMemo(() => results.flatMap((result, index) => byId(result.id)?.foil ? [index] : []), [results]);
  const foilRoutes = useMemo(() => results.map((result, index) => freezeFoilUpgrade(freeze, index, result.id) ? "surprise" : foilRevealRoute(byId(result.id), `${drawNumber}#${seedOf(results)}#${index}`)), [results, drawNumber, freeze]);
  const activeFoil = foilStart && !reduce ? foilIndexes.find(index => !revealedFoils[index]) : undefined;
  useEffect(() => {
    if (!intro && !freezeLocked && activeFoil === undefined)
      revealRef.current?.querySelector(".reveal-card")?.focus({ preventScroll: true });
  }, [intro, activeFoil, freezeLocked]);
  const unveilAt = useCallback((index) => {
    setRevealedFoils(done => done.map((value, i) => value || i === index));
  }, []);
  const allRaritiesReady = raritiesReady.every(Boolean);
  const rarityAt = useCallback((i) => {
    setRaritiesReady((ready) =>
      ready[i] ? ready : ready.map((v, k) => (k === i ? true : v)),
    );
  }, []);
  useEffect(() => {
    if (!allRaritiesReady) return;
    // Finish the entire draw's rarity promotions, pause, then unveil each foil.
    const timer = setTimeout(
      () => setFoilStart(true),
      reduce ? 0 : 500,
    );
    return () => clearTimeout(timer);
  }, [allRaritiesReady, reduce]);
  const omen = freeze ? "R" : omenOf(results.filter((result, index) => !byId(result.id)?.foil || foilRoutes[index] === "legend"));
  const seed = seedOf(results);
  const all = flipped.every(Boolean);
  const allComplete = completed.every(Boolean);
  const hasAreaReward = areaRewardsFor(results).length > 0;
  useEffect(() => {
    // 演出を省く設定のときだけ、全札の完成を見届けたら自動で盤面の獲得へつなぐ。
    // 通常は「結果へ」を自分で押して、10連のめくり結果に余韻を持たせる(2026-09-21 本人の指示)。
    if (!allComplete || !hasAreaReward || !reduce) return;
    const timer = setTimeout(onFinish, 0);
    return () => clearTimeout(timer);
  }, [allComplete, hasAreaReward, onFinish, reduce]);
  const completeAt = useCallback((i) => {
    setCompleted((c) => (c[i] ? c : c.map((v, k) => (k === i ? true : v))));
  }, []);
  const flipAt = (i) =>
    !freezeLocked && setFlipped((f) => (f[i] ? f : f.map((v, k) => (k === i ? true : v))));
  const cols = results.length === 1 ? 1 : results.length <= 4 ? 2 : 5;
  // 指でなぞる: 押したまま動かして通った札を順にめくる。
  // 1枚目は自分の引き寄せ(RevealCard)に任せ、指がその札の外へ出てから他の札をめくる
  const sweep = useRef(null);
  const sweepDown = (e) => {
    const card = e.target.closest?.(".reveal-card");
    sweep.current = { origin: card, id: e.pointerId };
  };
  const sweepMove = (e) => {
    const s = sweep.current;
    if (!s || s.id !== e.pointerId || e.buttons === 0) return;
    const under = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest?.(".reveal-card");
    if (!under || under === s.origin) return;
    // 出発した札からよそへ移ったら、出発した札もめくる
    if (s.origin && !s.origin.classList.contains("is-flipped"))
      flipAt(Number(s.origin.dataset.index));
    if (!under.classList.contains("is-flipped"))
      flipAt(Number(under.dataset.index));
  };
  const sweepUp = () => {
    sweep.current = null;
  };
  return (
    <SkinModal
      label="スキン召喚"
      onClose={intro ? finishIntro : freeze && !allComplete ? () => {} : onFinish}
      className={`skin-summon-overlay ${freeze && !intro ? `freeze-phase-${freezePhase}` : ""}`}
    >
      <div ref={revealRef} inert={intro || freezeLocked || activeFoil !== undefined || undefined} aria-hidden={intro || freezeLocked || activeFoil !== undefined || undefined} className={`skin-reveal omen-${omen} ${activeFoil !== undefined ? "has-foil-unveiling" : ""} ${intro ? "summon-intro-active" : "summon-arrived"}`}>
        <div className="reveal-omen" aria-hidden="true" />
        <p className="reveal-caption" role="status">
          {allComplete
            ? "すべての札が現れました。"
            : all
              ? foilIndexes.length ? "まだ、輝きは終わらない。" : "札に宿る輝きをお待ちください。"
              : freeze ? "" : OMEN_TEXT[omen]}
        </p>
        <div
          className={`reveal-grid ${results.length === 1 ? "single" : ""}`}
          style={{ "--cols": cols }}
          onPointerDown={sweepDown}
          onPointerMove={sweepMove}
          onPointerUp={sweepUp}
          onPointerCancel={sweepUp}
        >
          {results.map((r, i) => (
            <RevealCard
              key={i}
              result={r}
              index={i}
              flipped={flipped[i]}
              onFlip={() => flipAt(i)}
              onComplete={() => completeAt(i)}
              onRarityComplete={() => rarityAt(i)}
              foilRevealed={revealedFoils[i] || reduce}
              foilRoute={foilRoutes[i]}
              foilSelected={activeFoil === i && results.length > 1}
              freezeInitial={freeze?.initial[i]}
              foilUpgrade={freezeFoilUpgrade(freeze, i, r.id)}
              reduce={reduce}
              seed={seed}
              owned={ownedOf(r.id)}
            />
          ))}
        </div>
        <p className="reveal-hint">
          {all || freezeLocked
            ? ""
            : results.length === 1
              ? "札を引き寄せて、めくってください。"
              : "札を引き寄せてめくるか、指でなぞって次々にめくれます。"}
        </p>
        <div className="reveal-actions">
          {!all && !freezeLocked && (
            <button
              className="skin-btn"
              onClick={() => setFlipped(results.map(() => true))}
            >
              すべてめくる
            </button>
          )}
          {allComplete && (!hasAreaReward || !reduce) && (
            <button className="skin-btn skin-btn-gold" onClick={onFinish}>
              結果へ →
            </button>
          )}
        </div>
      </div>
      {!intro && freeze && <SummonFreeze phase={freezePhase} reduce={reduce} onOpen={() => {
        if (freezePhase !== "invitation") return;
        releaseFreeze();
        setFlipped(results.map(() => true));
      }} />}
      {intro && <SummonIntro results={results} targetRef={revealRef} onFinish={finishIntro} />}
      {activeFoil !== undefined && <FoilUnveiling
        key={activeFoil}
        skin={byId(results[activeFoil].id)}
        route={foilRoutes[activeFoil]}
        upgradedFromNormal={freezeFoilUpgrade(freeze, activeFoil, results[activeFoil].id)}
        position={foilIndexes.indexOf(activeFoil) + 1}
        total={foilIndexes.length}
        fromGrid={results.length > 1}
        sourceRef={revealRef}
        sourceIndex={activeFoil}
        onComplete={() => unveilAt(activeFoil)}
      />}
    </SkinModal>
  );
}

/** A new crafted reward changes once; restored saved results bypass this view. */
function CraftedFoilReveal({ result, reduce, onFinish }) {
  const skin = byId(result.id);
  const base = byId(baseSkinId(skin.id));
  return (
    <SkinModal
      label="カードの獲得演出"
      onClose={onFinish}
      className="skins-results-overlay"
    >
      <div className="skin-modal-head">
        <div>
          <span className="skins-eyebrow">
            {rarityLabel(base)} / {base.rank}
          </span>
          <h2>カードに宿る輝き</h2>
        </div>
      </div>
      <div className="skins-results-grid single-result">
        <article className={`skins-result rarity-${skin.rarity}`}>
          <div className="skins-result-art">
            <FoilAcquisition
              skin={skin}
              play
              reduce={reduce}
              onComplete={onFinish}
              alt={base.name}
            />
            <span className="skins-tile-rank">{base.rank}</span>
            <span className="skins-tile-rarity">{base.rarity}</span>
          </div>
          <strong>{base.name}</strong>
        </article>
      </div>
      <button className="skin-btn skins-result-done" onClick={onFinish}>
        演出をスキップ
      </button>
    </SkinModal>
  );
}

/**
 * 錬成。ダブった札を崩してエーテルにし、狙った1枚を作る。
 * 値づけの根拠は src/skins/ether.js に書いてある。
 */
function ForgePanel({
  collection,
  run,
  acquire,
  working,
  onPick,
  message,
  setMessage,
  foilKnown = true,
  // "ether": 崩す・作る・目安。"foil": 欠片と交換・フォイル加工。画面を分けて情報を絞る
  view = "ether",
  // 無償ジェムをエーテルに(サーバーの財布があるときだけ)
  onEther = null,
}) {
  const [pick, setPick] = useState("SSR");
  const foilView = view === "foil";
  // 加工の画面は、まず「フォイル加工」か「フォイルの交換」を選ぶ。
  // 両方の一覧を一度に出すと長すぎて探せない(2026-09-18 本人の指示)
  const [foilWork, setFoilWork] = useState("milestone");
  const [confirmBreak, setConfirmBreak] = useState(null);
  // 確認の中で決める枚数(まとめ錬成・一括分解。本人の指示 2026-09-19)
  const [breakN, setBreakN] = useState(1);
  const [confirmCraft, setConfirmCraft] = useState(null);
  const [craftN, setCraftN] = useState(1);
  // 目安の数字は抽選の中身から引き直す。手で書くと片方だけ古くなる
  const summary = forgeSummary();
  const top = summary.byId("SSR");
  const ether = etherOf(collection);
  const shards = shardsOf(collection);
  // 崩す一覧は通常版だけ。フォイルのダブりは「フォイルの交換」で欠片にする
  const rows = spares(collection, SKINS);
  const foilRows = foilSpares(collection);
  const bulk = totalOfSpares(collection, SKINS);
  const targets = SKINS.filter((s) => !isKeepsake(s) && s.rarity === pick);
  const milestones = POOL.map((skin) => ({
    skin,
    check: foilMilestoneCheck(collection, skin.id),
  }));
  const readyCount = milestones.filter(({ check }) => check.ok).length;
  const claimedCount = milestones.filter(({ check }) => check.claimed).length;

  const breakOne = async (skin) => {
    if (await run((c) => dismantle(c, skin.id))) {
      setConfirmBreak(null);
      setMessage(
        `「${skin.name}」を崩して ${ETHER_NAME}を ${dustOf(skin)} 得ました。`,
      );
    }
  };
  const shatterSome = async (skin, n) => {
    if (await run((c) => shatterMany(c, skin.id, n))) {
      setConfirmBreak(null);
      setMessage(
        `「${skin.name}」を ${n}枚崩して ${SHARD_NAME}を ${SHARD_VALUE[skin.rarity] * n} 得ました。`,
      );
    }
  };
  const trade = async (base) => {
    const cost = exchangeCostOf(base);
    const next = await acquire((c) => exchangeFoil(c, base.id));
    if (next)
      setMessage(
        `${SHARD_NAME}を ${cost} 使って、「${base.name}」のフォイルと交換しました。`,
      );
  };
  const breakAll = async () => {
    if (await run((c) => dismantleAll(c)))
      setMessage(
        `通常版のダブりを崩して ${ETHER_NAME}を ${bulk} 得ました。フォイルは残しています。`,
      );
  };
  const make = async (skin, n = 1) => {
    const next = await acquire((c) => craftMany(c, skin.id, n));
    if (next) {
      setConfirmCraft(null);
      setMessage(
        `${ETHER_NAME}を ${(costOf(skin) * n).toLocaleString()} 使って、${n}枚を錬成しました。`,
      );
    }
  };
  const finishFoil = async (skin) => {
    const next = await acquire((c) => claimFoilMilestone(c, skin.id));
    if (next) {
      setMessage(
        `通算${FOIL_MILESTONE}枚獲得の記念に1枚を受け取りました。所持カードと${ETHER_NAME}は減りません。`,
      );
    }
  };

  return (
    <div role="tabpanel" aria-label={foilView ? "加工" : "錬成"}>
      <div className="forge-banks">
        {foilView ? (
          <div className="forge-bank forge-bank-shards">
            <span className="skins-eyebrow">YOUR SHARDS</span>
            <b>
              <Shard size={26} /> {shards.toLocaleString()}
            </b>
            <p>
              ダブったフォイルを崩すと貯まります。持っていないフォイルと交換します。
            </p>
          </div>
        ) : (
          <div className="forge-bank">
            <span className="skins-eyebrow">YOUR ETHER</span>
            <b>
              <Ether size={26} /> {ether.toLocaleString()}
            </b>
            <p>ダブった札を崩すと貯まります。狙った1枚を作るのに使います。</p>
          </div>
        )}
      </div>
      {/* 崩した・作った結果の返事。確認の窓を閉じたあとも読めるように、ここに出す
          (2026-09-19。それまでは窓の中にしか無く、閉じた瞬間に消えていた) */}
      {message && !confirmBreak && !confirmCraft && (
        <p className="skins-message forge-message" role="status">
          {message}
        </p>
      )}
      {!foilView && onEther && (
        <section
          className="forge-section forge-ether-exchange"
          aria-label="無償ジェムをエーテルに"
        >
          <div className="forge-head">
            <h3>無償ジェムを{ETHER_NAME}に</h3>
            <p className="skins-note">
              無償ジェム {ETHER_EXCHANGE.gems} → {ETHER_NAME}{" "}
              {ETHER_EXCHANGE.ether}。有償ジェムは使いません。いま無償ジェム{" "}
              <b>{(collection.gemsFree || 0).toLocaleString()}</b>
            </p>
          </div>
          <div className="skins-pull-buttons">
            {[10, 50, 100].map((g) => (
              <button
                key={g}
                className="skin-btn"
                disabled={working || (collection.gemsFree || 0) < g}
                onClick={() => onEther(g)}
              >
                ジェム{g}
                <span>
                  → {ETHER_NAME} {etherFor(g)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* どちらの作業をするかを先に選ぶ。選んだほうの一覧だけを出す */}
      {foilView && (
        <div className="forge-work-picker" role="tablist" aria-label="加工の種類">
          <button
            className="btn btn-ghost"
            role="tab"
            aria-selected={foilWork === "milestone"}
            onClick={() => setFoilWork("milestone")}
          >
            フォイル加工
            <small>通算獲得で1枚</small>
          </button>
          <button
            className="btn btn-ghost"
            role="tab"
            aria-selected={foilWork === "exchange"}
            onClick={() => setFoilWork("exchange")}
            disabled={!foilKnown}
          >
            フォイルの交換
            <small>{foilKnown ? `${SHARD_NAME}と引き換え` : "フォイルを持つと開きます"}</small>
          </button>
        </div>
      )}
      {/* フォイル加工(通算獲得の記念)は、フォイルを持たないうちも出す。
          進み具合と手に入れる道筋を見せるため。交換・所持の一覧は下で伏せる */}
      {foilView && foilWork === "milestone" && (
        <section
          id="forge-foil-milestones"
          className="forge-section forge-milestones"
          aria-label="通算獲得でフォイル加工"
        >
          <div className="forge-head">
            <h3>
              <FoilBadge /> フォイル加工
            </h3>
            <span>
              {readyCount > 0 ? `受取可能 ${readyCount}種 · ` : ""}受取済み{" "}
              {claimedCount}/{POOL.length}種
            </span>
          </div>
          <p className="forge-milestone-intro">
            同じキャラを通算{FOIL_MILESTONE}
            枚獲得すると、フォイル1枚を一度だけ受け取れます。
            <strong>所持カード・エーテルの消費はありません。</strong>
          </p>
          <p className="skins-note">
            通常版とフォイル版を合算します。カードを崩しても進捗は減りません。
            ガチャ・錬成で1枚ごとに{foilPct}%のフォイル抽選も続きます。
            加工で受け取る報酬は通算枚数に含みません。
          </p>
          <div className="forge-milestone-grid">
            {milestones.map(({ skin, check }) => (
              <article
                key={skin.id}
                className={`forge-milestone-card${check.ok ? " is-ready" : ""}${check.claimed ? " is-claimed" : ""}`}
              >
                <button
                  className="forge-milestone-thumb"
                  onClick={() => onPick(byId(foilId(skin.id)))}
                  aria-label={`${skin.name}のフォイル詳細`}
                >
                  <FoilArtwork
                    skin={byId(foilId(skin.id))}
                    alt=""
                    loading="lazy"
                    animated={true}
                  />
                </button>
                <div className="forge-milestone-name">
                  <span>
                    {skin.rank} · {rarityLabel(skin)}
                  </span>
                  <h4>{skin.name}</h4>
                  {/* このフォイルで立つ効果盤面。押すとフォイル版の詳細(効果・発動の条件)へ */}
                  {AREA_BY_RANK[skin.rank] && (
                    <button
                      type="button"
                      className="forge-milestone-area"
                      onClick={() => onPick(byId(foilId(skin.id)))}
                      aria-label={`${skin.name}のフォイルで立つ効果盤面「${AREA_INFO[AREA_BY_RANK[skin.rank]].name}」の詳細`}
                    >
                      効果盤面: {AREA_INFO[AREA_BY_RANK[skin.rank]].name} ›
                    </button>
                  )}
                </div>
                <div className="forge-milestone-progress">
                  <div>
                    <span>
                      通算 <b>{check.total.toLocaleString()}</b>/{check.target}
                      枚
                    </span>
                    <span>
                      {check.claimed
                        ? "受取済み"
                        : check.remaining
                          ? `あと${check.remaining}枚`
                          : "目標達成"}
                    </span>
                  </div>
                  <progress
                    max={check.target}
                    value={Math.min(check.total, check.target)}
                    aria-label={`${skin.name}の通算獲得`}
                    aria-valuetext={`通算${check.total}枚、目標${check.target}枚${check.claimed ? "、受取済み" : ""}`}
                  />
                </div>
                <button
                  className={`skin-btn${check.ok ? " skin-btn-gold" : ""} forge-milestone-claim`}
                  disabled={working || !check.ok}
                  onClick={() => finishFoil(skin)}
                  aria-label={`${skin.name} ${check.claimed ? "フォイル受取済み" : "フォイル加工"}`}
                >
                  {check.claimed ? "受取済み" : "フォイル加工"}
                </button>
              </article>
            ))}
          </div>
          <p className="skins-note forge-milestone-migration">
            以前のバージョンからは、現在の所持枚数を通算獲得の開始値として引き継ぎます。過去に崩した分は履歴がないため含められません。
          </p>
        </section>
      )}

      {foilView && foilKnown && foilWork === "exchange" && (
        <section
          id="forge-foil-exchange"
          className="forge-section forge-milestones forge-exchange"
          aria-label="フォイルの交換"
        >
          <div className="forge-head">
            <h3>
              <Shard size={16} /> フォイルの交換
            </h3>
            <span>
              {SHARD_NAME} {shards}
              {foilRows.length
                ? ` · 崩せるフォイル ${foilRows.reduce((n, r) => n + r.spare, 0)}枚`
                : ""}
            </span>
          </div>
          <p className="forge-milestone-intro">
            ダブったフォイルを崩すと{SHARD_NAME}になり、
            持っていないフォイルと交換できます。
            <strong>
              崩すと R {SHARD_VALUE.R}・SR {SHARD_VALUE.SR}・SSR{" "}
              {SHARD_VALUE.SSR}
              。交換に要るのは R {EXCHANGE_COST.R}・SR {EXCHANGE_COST.SR}・SSR{" "}
              {EXCHANGE_COST.SSR}。
            </strong>
          </p>
          <p className="skins-note">
            最後の1枚は残ります。交換は持っていないフォイルだけで、抽選はありません。交換で得た分も通算獲得に数えます。
          </p>
          {foilRows.length > 0 && (
            <ul className="forge-list">
              {foilRows.map(({ skin, spare, gain }) => (
                <li key={skin.id} className={`forge-row rarity-${skin.rarity}`}>
                  <button
                    className="forge-thumb"
                    onClick={() => onPick(skin)}
                    aria-label={`${skin.name}の詳細`}
                  >
                    <FoilArtwork
                      skin={skin}
                      alt=""
                      loading="lazy"
                      animated={false}
                    />
                  </button>
                  <span className="forge-name">
                    <b>{skin.name}</b>
                    <small>
                      {rarityLabel(skin)} ・ 余り {spare}枚 <FoilBadge />
                    </small>
                  </span>
                  <span className="forge-gain forge-gain-shard">
                    <Shard size={13} />+{gain}
                  </span>
                  <button
                    className="btn btn-ghost btn-small"
                    disabled={working}
                    onClick={() => (
                      setMessage(""), setBreakN(1), setConfirmBreak(skin)
                    )}
                  >
                    欠片にする
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="forge-grid forge-exchange-grid">
            {POOL.map((base) => {
              const skin = byId(foilId(base.id));
              const check = exchangeCheck(collection, base.id);
              const owned = (collection.owned[skin.id] || 0) > 0;
              return (
                <div
                  key={base.id}
                  className={`forge-card rarity-${base.rarity}${owned ? " is-owned" : check.ok ? "" : " is-short"}`}
                >
                  <button
                    className="forge-card-art"
                    onClick={() => onPick(skin)}
                    aria-label={`${skin.name}の詳細`}
                  >
                    <FoilArtwork
                      skin={skin}
                      alt=""
                      loading="lazy"
                      animated={false}
                    />
                    <span className="skins-tile-rank">{base.rank}</span>
                  </button>
                  <b>{base.name}</b>
                  <small>
                    {rarityLabel(base)}
                    {AREA_BY_RANK[base.rank]
                      ? ` ・ ${AREA_INFO[AREA_BY_RANK[base.rank]].name}`
                      : ""}
                  </small>
                  <small className="forge-foil-held">
                    {owned
                      ? `フォイル所持 ×${collection.owned[skin.id]}`
                      : "フォイル未所持"}
                  </small>
                  <button
                    className={`btn ${check.ok ? "btn-primary" : "btn-ghost"} btn-small`}
                    disabled={working || !check.ok}
                    onClick={() => trade(base)}
                    aria-label={`${base.name}のフォイルと${SHARD_NAME} ${exchangeCostOf(base)} で交換`}
                    title={check.ok ? "" : check.why}
                  >
                    <Shard size={13} />{" "}
                    {owned ? "所持済み" : exchangeCostOf(base)}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!foilView && (
        <section className="forge-section">
          <div className="forge-head">
            <h3>崩す</h3>
            <span>
              {rows.length
                ? `ダブり ${rows.reduce((n, r) => n + r.spare, 0)}枚`
                : "ダブりなし"}
            </span>
          </div>
          {rows.length ? (
            <>
              <ul className="forge-list">
                {rows.map(({ skin, spare, gain }) => (
                  <li
                    key={skin.id}
                    className={`forge-row rarity-${skin.rarity}`}
                  >
                    <button
                      className="forge-thumb"
                      onClick={() => onPick(skin)}
                      aria-label={`${skin.name}の詳細`}
                    >
                      <img src={skin.card} alt="" loading="lazy" />
                    </button>
                    <span className="forge-name">
                      <b>{skin.name}</b>
                      <small>
                        {rarityLabel(skin)} ・ 余り {spare}枚
                      </small>
                    </span>
                    <span className="forge-gain">
                      <Ether size={13} />+{gain}
                    </span>
                    <button
                      className="btn btn-ghost btn-small"
                      disabled={working}
                      onClick={() => breakOne(skin)}
                    >
                      崩す
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className="btn btn-primary btn-wide"
                disabled={working || !bulk}
                onClick={breakAll}
              >
                <Ether size={16} /> 通常版のダブりを全部崩す（+{bulk}）
              </button>
            </>
          ) : (
            <p className="skins-empty">
              同じ札が2枚以上あると崩せます。最後の1枚は残るので、装備中の札が消えることはありません。
            </p>
          )}
          <p className="skins-note forge-protection">
            {foilKnown
              ? `最後の1枚は通常版・フォイルそれぞれ守られます。ここで崩すのは通常版だけです。フォイルのダブりは「加工」タブで${SHARD_NAME}にします(エーテルにはなりません)。`
              : "最後の1枚は保護され、一括で崩す対象になりません。"}
          </p>
        </section>
      )}

      {!foilView && (
        <section className="forge-section">
          <div className="forge-head">
            <h3>作る</h3>
            <span>好きなキャラを選べます</span>
          </div>
          <p className="skins-foil-note">
            錬成も1枚ごとに{foilPct}
            %でフォイルになります。通常版とフォイルのどちらか1枚を獲得します。
          </p>
          <div className="skins-filters" aria-label="作る札の絞り込み">
            {["R", "SR", "SSR"].map((r) => (
              <button
                key={r}
                aria-pressed={pick === r}
                onClick={() => setPick(r)}
              >
                {r}（{CRAFT[r]}）
              </button>
            ))}
          </div>
          <div className="forge-grid">
            {targets.map((skin) => {
              const cost = costOf(skin);
              const can = ether >= cost;
              const held = collection.owned[skin.id] || 0;
              return (
                <div
                  key={skin.id}
                  className={`forge-card rarity-${skin.rarity} ${can ? "" : "is-short"}`}
                >
                  <button
                    className="forge-card-art"
                    onClick={() => onPick(skin)}
                    aria-label={`${skin.name}の詳細`}
                  >
                    <img src={skin.card} alt="" loading="lazy" />
                    <span className="skins-tile-rank">{skin.rank}</span>
                  </button>
                  <b>{skin.name}</b>
                  <small>{held ? `所持 ×${held}` : "未所持"}</small>
                  <small className="forge-foil-held">
                    フォイル{" "}
                    {collection.owned[foilId(skin.id)]
                      ? `×${collection.owned[foilId(skin.id)]}`
                      : "未所持"}
                  </small>
                  <button
                    className={`btn ${can ? "btn-primary" : "btn-ghost"} btn-small`}
                    disabled={working || !can}
                    onClick={() => (
                      setMessage(""), setCraftN(1), setConfirmCraft(skin)
                    )}
                  >
                    <Ether size={13} /> {cost.toLocaleString()}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!foilView && (
        <section className="forge-section forge-rates">
          <div className="forge-head">
            <h3>交換の目安</h3>
          </div>
          <p className="skins-note">召喚回数の目安は通常抽選の割合で計算しています。10回召喚のフリーズ昇格は含みません。</p>
          <table className="skins-rate-table">
            <thead>
              <tr>
                <th>格</th>
                <th>崩すと</th>
                <th>作るのに</th>
                <th>1枚を狙うと</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.rarity}>
                  <td>{row.rarity}</td>
                  <td>+{row.dust}</td>
                  <td>{row.craft.toLocaleString()}</td>
                  <td>{row.pulls}回</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="skins-note">
            崩してもらえる量は「その1枚の出にくさ」に比例させてあります。作るのに要るのは、その4倍。つまり
            <b>同じ格ならダブり4枚で好きなキャラを1枚</b>
            。
            <br />
            SSR 1枚（{CRAFT.SSR.toLocaleString()}）は
            <b>
              {" "}
              R なら{summary.byId("R").cardsForTop}枚 ・ SR なら
              {summary.byId("SR").cardsForTop}枚 ・ SSR なら
              {summary.byId("SSR").cardsForTop}枚
            </b>
            。 R だけを崩して貯めると約{summary.byId("R").pullsForTop}回ぶん、SR
            だけなら約{summary.byId("SR").pullsForTop}回ぶんで、 狙った SSR
            を運で当てる{top.pulls}回とほぼ同じです。 引いたものを全部崩せば約
            {summary.pullsIfAll}回ぶんになります。
            <br />
            初回購入特典・特別スキンは崩すことも作ることもできません。
            {foilKnown &&
              ` フォイルのダブりはエーテルにならず、「加工」タブで${SHARD_NAME}(R ${SHARD_VALUE.R}・SR ${SHARD_VALUE.SR}・SSR ${SHARD_VALUE.SSR})になります。`}
          </p>
        </section>
      )}
      {confirmBreak && (
        <SkinModal
          label="フォイルを崩す確認"
          onClose={() => setConfirmBreak(null)}
        >
          <div className="skin-modal-head">
            <h2>フォイルを{breakN}枚崩しますか？</h2>
            <button
              className="skin-close"
              aria-label="確認を閉じる"
              disabled={working}
              onClick={() => setConfirmBreak(null)}
            >
              ×
            </button>
          </div>
          <p>
            「{confirmBreak.name}」のダブり{breakN}枚を、{SHARD_NAME}{" "}
            {SHARD_VALUE[confirmBreak.rarity] * breakN}{" "}
            に変えます。エーテルにはなりません。
          </p>
          <AmountPicker
            value={breakN}
            max={Math.max(1, (collection.owned[confirmBreak.id] || 0) - 1)}
            working={working}
            onChange={setBreakN}
          />
          <p className="skins-note">
            所持 {collection.owned[confirmBreak.id] || 0}枚 →{" "}
            {Math.max(0, (collection.owned[confirmBreak.id] || 0) - breakN)}
            枚。最後の1枚は残ります。
          </p>
          <div className="skins-confirm-actions">
            <button
              className="skin-btn"
              disabled={working}
              onClick={() => setConfirmBreak(null)}
            >
              残す
            </button>
            <button
              className="skin-btn skin-btn-gold"
              disabled={
                working ||
                (collection.owned[confirmBreak.id] || 0) - breakN < 1
              }
              onClick={() => shatterSome(confirmBreak, breakN)}
            >
              {breakN}枚崩す（{SHARD_NAME} +
              {SHARD_VALUE[confirmBreak.rarity] * breakN}）
            </button>
          </div>
          <p className="skins-message" role="status">
            {message}
          </p>
        </SkinModal>
      )}
      {confirmCraft && (
        <SkinModal label="錬成の確認" onClose={() => setConfirmCraft(null)}>
          <div className="skin-modal-head">
            <h2>
              「{confirmCraft.name}」を{craftN}枚つくりますか？
            </h2>
            <button
              className="skin-close"
              aria-label="確認を閉じる"
              disabled={working}
              onClick={() => setConfirmCraft(null)}
            >
              ×
            </button>
          </div>
          <p>
            {ETHER_NAME}{" "}
            <b>{(costOf(confirmCraft) * craftN).toLocaleString()}</b>{" "}
            を使います（残り{" "}
            {Math.max(
              0,
              ether - costOf(confirmCraft) * craftN,
            ).toLocaleString()}
            ）。
          </p>
          <AmountPicker
            value={craftN}
            max={Math.max(1, craftableCount(collection, confirmCraft.id))}
            working={working}
            onChange={setCraftN}
          />
          <p className="skins-note">
            1枚ごとに{foilPct}
            %でフォイルになります。まとめて作っても1枚あたりの確率は変わりません。一度に作れるのは
            {CRAFT_MAX}枚までです。
          </p>
          <div className="skins-confirm-actions">
            <button
              className="skin-btn"
              disabled={working}
              onClick={() => setConfirmCraft(null)}
            >
              やめる
            </button>
            <button
              className="skin-btn skin-btn-gold"
              disabled={working || ether < costOf(confirmCraft) * craftN}
              onClick={() => make(confirmCraft, craftN)}
            >
              {craftN}枚つくる（{(costOf(confirmCraft) * craftN).toLocaleString()}
              ）
            </button>
          </div>
          <p className="skins-message" role="status">
            {message}
          </p>
        </SkinModal>
      )}
    </div>
  );
}

/**
 * ガチャ結果のダブりを崩す欄(本人の指示 2026-09-17)。
 *
 * 崩すのは**この抽選で来たダブりだけ**で、フォイル・記念の札・最後の1枚には触らない
 * (src/skins/collection.js の dismantleResults)。
 * 「次から自動で崩す」を入れておくと、次の結果からは開いた時点で崩して、何を崩したかを出す。
 * 崩すのは取り消せないので、自動を入れるまでは必ず押してもらう(選ぶ→確認→確定の決めに合わせる)。
 */
function ResultDismantle({
  collection,
  results,
  working,
  onRun,
  onToggleAuto,
  onToggleRarity,
  done,
  setDone,
}) {
  const rarities = collection.dismantleRarities || [];
  const preview = useMemo(
    () => dismantleResults(collection, results, rarities),
    [collection, results, rarities],
  );
  const auto = collection.autoDismantle === true;
  const fired = useRef(false);
  useEffect(() => {
    // 開いた時点で一度だけ。結果ごとに作り直されるので、ここでの一度きりで足りる
    if (fired.current || !auto || preview.gain <= 0) return;
    fired.current = true;
    onRun(preview).then((r) => r && setDone(r));
    // 開いた瞬間の下見だけを見る(崩したあとに走り直さない)
  }, []);
  const shown = done || (preview.gain > 0 ? preview : null);
  // 崩せるものが無くても、何を崩すかの選択は出す(SSR を入れれば崩せることが分かるように)
  const anyDup = results.some(
    (r) => (collection.owned[r.id] || 0) > 1 && DISMANTLE_RARITIES.includes(byId(r.id)?.rarity),
  );
  if (!shown && !anyDup) return null;
  const sheets = shown ? shown.rows.reduce((n, r) => n + r.count, 0) : 0;
  const label = shown
    ? shown.rows.map((r) => `${byId(r.id).rank} ${byId(r.id).name}×${r.count}`).join("・")
    : "";
  return (
    <section className="skins-result-dismantle" aria-label="重複した札を崩す">
      {!shown ? (
        <p className="skins-note">
          いま選んでいるレア度に、崩せる重複はありません。
        </p>
      ) : done ? (
        <p className="skins-note">
          重複した{sheets}枚を崩して{" "}
          <b>
            {ETHER_NAME} +{done.gain}
          </b>{" "}
          にしました。
          <small>{label}</small>
        </p>
      ) : (
        <>
          <p className="skins-note">
            重複した{sheets}枚を崩すと{" "}
            <b>
              {ETHER_NAME} +{preview.gain}
            </b>
            。<small>{label}</small>
          </p>
          <button
            className="skin-btn"
            disabled={working}
            onClick={() => onRun(preview).then((r) => r && setDone(r))}
          >
            <Ether size={16} /> 重複を崩す
          </button>
        </>
      )}
      <div className="skins-dismantle-rarities" role="group" aria-label="崩すレア度">
        <span>崩すのは</span>
        {DISMANTLE_RARITIES.map((r) => (
          <button
            key={r}
            className={`rank-toggle ${rarities.includes(r) ? "active" : ""}`}
            aria-pressed={rarities.includes(r)}
            disabled={working}
            onClick={() => onToggleRarity(r)}
          >
            {r}
          </button>
        ))}
      </div>
      <label className="skins-auto-dismantle">
        <input
          type="checkbox"
          checked={auto}
          disabled={working}
          onChange={onToggleAuto}
        />
        次から自動で崩す
        <small>フォイルと記念の札、最後の1枚は崩しません。あとから切れます</small>
      </label>
    </section>
  );
}

export function SkinsScreen({ onBack, onBattlePass, initialTab = "gacha" }) {
  const collection = useCollection(),
    reduce = useReducedMotion();
  // 最初に出すタブ。ショップの「フォイルを買う」から来たときは「加工」を開く
  const [tab, setTab] = useState(initialTab),
    [filter, setFilter] = useState("all");
  const [finish, setFinish] = useState("all");
  const [selected, setSelected] = useState(null),
    [odds, setOdds] = useState(false);
  const [acquisitionMode, setAcquisitionMode] = useState(null),
    [film, setFilm] = useState(null);
  const [working, setWorking] = useState(false),
    [message, setMessage] = useState("");
  const busy = useRef(false);
  // 店(チケットの購入)。iOS で StoreKit が使えるときだけ出す
  const [shopOk, setShopOk] = useState(false);
  // 初回購入特典(天馬騎士)をもう持っているか。以前の早期特典で受け取った人も含む
  const hasPegasus = !!collection.owned[FIRST_PURCHASE_SKIN];
  const [shop, setShop] = useState(null); // null=閉じている / { products }
  // ガチャでフォイルを引いた直後の「ほかのフォイルも」(src/skins/foil-shop.js)。exclude は引いた帯
  const [foilOffer, setFoilOffer] = useState(null);
  const [buying, setBuying] = useState(false);
  // 広告リワード。iOS で広告が出せるとき、残り回数を出す
  const [adsOk, setAdsOk] = useState(false);
  const [adsLeft, setAdsLeft] = useState(null);
  useEffect(() => {
    let alive = true;
    // 開いたら、控えていた購入を送り直し、端末の枚数を一度だけ引き継ぎ、残高を取り直す
    (async () => {
      try {
        await flushPurchases();
      } catch {
        /* 次に開いたとき */
      }
      try {
        await migrateOnce();
      } catch {
        /* サーバー側で一度きり */
      }
      try {
        await syncWallet();
      } catch {
        /* 圏外なら写しのまま */
      }
    })();
    shopAvailable().then((ok) => alive && setShopOk(ok));
    adsAvailable().then((ok) => alive && setAdsOk(ok));
    // 残り回数はサーバーの財布から(端末では数えない)
    syncWallet()
      .then(
        (d) =>
          alive &&
          d &&
          Number.isSafeInteger(d.adsLeftToday) &&
          setAdsLeft(d.adsLeftToday),
      )
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const watchAd = async () => {
    if (buying) return;
    setBuying(true);
    setMessage("");
    try {
      const d = await watchAdForTicket();
      if (d === null) return; // 途中で閉じた
      if (Number.isSafeInteger(d.adsLeftToday)) setAdsLeft(d.adsLeftToday);
      setMessage("ガチャチケットを1枚受け取りました。");
    } catch (e) {
      setMessage((e && e.message) || "広告を再生できませんでした。");
    } finally {
      setBuying(false);
    }
  };
  // ジェムでチケットを買う(両替はサーバーで1つの出来事。足りなければ店を開く)
  const buyTickets = async (n) => {
    if (buying) return;
    setBuying(true);
    setMessage("");
    // 決済の呼び出しは src/ui/buy.js の1本に寄せてある(ショップと同じ道)
    const r = await buyTicketsFor(n);
    if (r.needGems && shopOk) setShop(true);
    setMessage(r.message);
    setBuying(false);
    return r.ok;
  };
  // 無償ジェムをエーテルに(無償だけ。サーバーで減らし、通ったら端末のエーテルを足す)
  const buyEtherWith = async (gems) => {
    if (buying || busy.current) return;
    setBuying(true);
    setMessage("");
    try {
      const d = await buyEther(newEventId("ether"), gems);
      const got = Number.isSafeInteger(d && d.ether)
        ? d.ether
        : etherFor(gems) || 0;
      if (got > 0) await updateCollection((s) => addEther(s, got));
      setMessage(`無償ジェム ${gems} を ${ETHER_NAME} ${got} にしました。`);
    } catch (e) {
      setMessage((e && e.message) || "両替できませんでした。");
    } finally {
      setBuying(false);
    }
  };
  const visibleSkins = ALL_SKINS.filter((s) => skinVisibleInCollection(collection, s));
  const visibleFoils = ALL_FOIL_SKINS.filter((s) => skinVisibleInCollection(collection, s));
  const ownedCount = visibleSkins.filter((s) => collection.owned[s.id]).length;
  const foilOwnedCount = visibleFoils.filter(
    (s) => collection.owned[s.id],
  ).length;
  const shine = !reduce;
  const craftResult = !collection.pending && collection.lastCraft;
  const milestoneResult = craftResult?.source === "milestone";
  const exchangeResult = craftResult?.source === "exchange";
  const resultLabel = milestoneResult
    ? "フォイル加工完了"
    : exchangeResult
      ? "フォイル交換完了"
      : craftResult
        ? "錬成結果"
        : "召喚結果";
  // まとめ錬成は lastCraft.results に複数枚が入る(pending は召喚専用なので使わない)
  const results =
    collection.pending?.results ||
    craftResult?.results ||
    (craftResult ? [craftResult] : null);
  // まとめて作ってフォイルが混ざったとき、その1枚を演出に渡す
  const craftedFoil =
    craftResult &&
    (craftResult.results || [craftResult]).find((r) => byId(r.id)?.foil);
  const areaRewards = areaRewardsFor(results || []);
  const finishAcquisition = useCallback(() => setAcquisitionMode("area"), []);
  const magicianLocked = isBattlePassLocked(
    byId("genie-magician"),
    collection.owned,
  );
  const selectedLocked = isBattlePassLocked(selected, collection.owned);
  const run = async (change) => {
    if (busy.current) return false;
    busy.current = true;
    setWorking(true);
    setMessage("");
    try {
      return await updateCollection(change);
    } catch (e) {
      setMessage(e.message);
      return false;
    } finally {
      busy.current = false;
      setWorking(false);
    }
  };
  const acquire = async (change, kind = "forge") => {
    if (busy.current || collection.pending || collection.lastCraft)
      return false;
    // Mark only local, fresh acquisitions before the store emits its saved result.
    // A screen restored from storage starts with null and never replays this change.
    setAcquisitionMode(
      reduce || collection.summonMotion === "skip"
        ? "area"
        : kind === "summon"
          ? "summon"
          : "foil",
    );
    const next = await run(change);
    if (!next) setAcquisitionMode(null);
    return next;
  };
  const roll = async (amount) => {
    if (WALLET_SERVER && !FREE_GACHA) {
      // サーバーで消費・抽選・昇格を確定し、端末は同じ結果を一度だけ所持に加える。
      if (busy.current || collection.pending || collection.lastCraft) return;
      busy.current = true;
      setWorking(true);
      setMessage("");
      try {
        // まずサーバーに引いてもらう(2026-09-18)。チケットの消費と抽選が1つの要求になり、
        // 「何を引いたか」をサーバーが知る = 所持の検証の正になる。
        // 旧サーバーの404だけは従来経路へ。通信失敗・不正な成功応答では抽選し直さない。
        const requested = await updateCollection(s => s.pendingPull ? s : { ...s, pendingPull: { id: newEventId("pull"), amount } });
        const eventId = requested.pendingPull.id;
        amount = requested.pendingPull.amount;
        let drawn = null;
        try {
          drawn = await pullFromServer(eventId, amount);
        } catch (e) {
          // 残高不足など、サーバーがはっきり断ったものはそのまま伝える
          if (/足りません|他の人の抽選|前の抽選と枚数/.test(e?.message || ""))
            await updateCollection(s => ({ ...s, pendingPull: null }));
          if (!/見つかりません|not found|404/i.test((e && e.message) || "")) throw e;
        }
        if (!drawn) await debitTickets(eventId, amount * PULL_COST);
        setAcquisitionMode(reduce || collection.summonMotion === "skip" ? "area" : "summon");
        const next = await updateCollection((s) =>
          drawn ? applyPull(s, drawn, { free: true }) : { ...pull(s, amount, undefined, { free: true }), pendingPull: null, lastPullId: eventId },
        );
        if (next?.pending?.results && !drawn) logPull(next.pending.results);
        // 引いた札をサーバーの記録にも残す(所持の検証の土台。best-effort)
        noteCollection();
      } catch (e) {
        setAcquisitionMode(null);
        setMessage(
          (e && e.message) || "ガチャチケットを確認できませんでした。",
        );
      } finally {
        busy.current = false;
        setWorking(false);
      }
      return;
    }
    const next = await acquire((s) => pull(s, amount), "summon");
    if (next?.pending?.results) logPull(next.pending.results);
    // 引いた札をサーバーの記録にも残す(所持の検証の土台。best-effort)
    noteCollection();
  };
  const equipSkin = async (skin) => {
    if (await run((s) => equip(s, skin.id)))
      setMessage(`${skin.rank}のカードに「${skin.name}」を装備しました。`);
  };
  // 崩した結果(どの札を何枚崩したか)。結果の並びに印を出すために画面が持つ
  const [dismantled, setDismantled] = useState(null);
  const dismantledAt = useMemo(
    () => dismantledIndexes(results || [], dismantled),
    [results, dismantled],
  );
  /** ガチャ結果のダブりを崩す。下見(preview)と同じものを台帳へ書く */
  const dismantlePulled = async (preview) => {
    if (!preview || preview.gain <= 0) return null;
    const next = await run(
      (s) => dismantleResults(s, results, s.dismantleRarities).state,
    );
    if (!next) return null;
    return { gain: preview.gain, rows: preview.rows };
  };
  /** 「次から自動で崩す」の入り切り */
  const toggleAutoDismantle = async () => {
    await run((s) => ({ ...s, autoDismantle: !s.autoDismantle }));
  };
  /** 崩すレア度の入り切り */
  const toggleDismantleRarity = async (rarity) => {
    await run((s) => ({
      ...s,
      dismantleRarities: s.dismantleRarities.includes(rarity)
        ? s.dismantleRarities.filter((r) => r !== rarity)
        : [...s.dismantleRarities, rarity],
    }));
  };
  /** 「買う前に確認する」の入り切り(チケットだけ) */
  const toggleTicketConfirm = async () => {
    await run((s) => ({ ...s, ticketConfirm: s.ticketConfirm === false }));
  };
  const closeResults = async () => {
    setAcquisitionMode(null);
    setDismantled(null);
    // ガチャ(召喚)でフォイルが出ていたら、閉じたあとに「ほかのフォイルも」を出す(引いた帯は除く)
    const pulledFoils = craftResult
      ? []
      : (collection.pending?.results || []).filter((r) => byId(r.id)?.foil);
    // フォイルを引いたら、その時刻から72時間だけショップにフォイルの欄を並べる
    // (2026-09-18 本人の指示。引くたびに引き直す)
    const next = await run((s) => {
      const base = craftResult ? { ...s, lastCraft: null } : { ...s, pending: null };
      return pulledFoils.length ? startFoilWindow(base) : base;
    });
    // 有償ジェムはサーバーの財布にあるので、Web でも(iOS で買った分を)使える。店の釦だけ iOS 限定
    if (next && pulledFoils.length && WALLET_SERVER) {
      const exclude = [
        ...new Set(pulledFoils.map((r) => bandOf(r.id)?.id).filter(Boolean)),
      ];
      if (foilOffers(next, { exclude }).length) setFoilOffer({ exclude });
    }
    return next;
  };
  /** フォイルを有償ジェムで買う。通ればサーバーの残高を写し、所持に足す */
  const buyFoilOffer = async (offer) => {
    if (busy.current) return false;
    busy.current = true;
    setWorking(true);
    setMessage("");
    try {
      const r = await buyFoilFor(offer);
      setMessage(r.message);
      if (r.needGems && shopOk) setShop(true);
      return r.ok;
    } finally {
      busy.current = false;
      setWorking(false);
    }
  };
  // フォイルを1枚も持たないうちは、フォイル関連を画面に出さない(確率の明記は除く)
  const foilKnown = foilRevealed(collection);
  const shown = SKINS.flatMap((s) => {
    const foil = visibleFoilOf(collection, foilKnown, s);
    return foil ? [s, foil] : [s];
  }).filter(
    (s) =>
      (finish === "all" || (finish === "foil" ? s.foil : !s.foil)) &&
      (filter === "all" ||
        (filter === "owned" ? collection.owned[s.id] : s.rarity === filter)),
  );
  return (
    <div className="skins-page">
      <div className="skins-heading">
        <div>
          <span className="skins-eyebrow">トッタリー / CARD SKINS</span>
          <h1>英雄の召喚</h1>
        </div>
        <p>
          所持 <strong>{ownedCount}</strong>
          <span> / {foilKnown ? visibleSkins.length : SKINS.length}</span>
          {foilKnown && (
            <small className="skins-owned-breakdown">
              通常 {ownedCount - foilOwnedCount}/{SKINS.length} · フォイル{" "}
              {foilOwnedCount}/{visibleFoils.length}
            </small>
          )}
        </p>
      </div>
      <div className="skins-tabs" role="tablist" aria-label="スキンメニュー">
        <button
          role="tab"
          aria-selected={tab === "gacha"}
          onClick={() => setTab("gacha")}
        >
          ガチャ
        </button>
        <button
          role="tab"
          aria-selected={tab === "collection"}
          onClick={() => setTab("collection")}
        >
          所持・装備
        </button>
        <button
          role="tab"
          aria-selected={tab === "forge"}
          onClick={() => setTab("forge")}
        >
          錬成
        </button>
        {/* 欠片と交換・フォイル加工はこちら。錬成と対の名前。
            フォイルを持たないうちも開ける(通算獲得の進み具合を見せ、手に入れる道筋を知らせる)。
            交換と所持の一覧は、フォイルを1枚持つまで中で伏せる */}
        <button
          role="tab"
          aria-selected={tab === "foil"}
          onClick={() => setTab("foil")}
        >
          加工
        </button>
      </div>
      {tab === "gacha" ? (
        <div className="skins-gacha" role="tabpanel" aria-label="ガチャ">
          <section className="skins-banner">
            <div className="skins-banner-art" aria-hidden="true">
              <FoilArtwork
                className="banner-left"
                skin={byId(foilId("demon-q"))}
                alt=""
                animated={shine}
              />
              <FoilArtwork
                className="banner-right"
                skin={byId(foilId("angel-k"))}
                alt=""
                animated={shine}
              />
            </div>
            <div className="skins-banner-copy">
              <span className="skins-eyebrow">天使か、悪魔か。</span>
              <h2>
                運命の一枚を、
                <br />
                この手に。
              </h2>
              <p>カードに宿る、新たな姿。</p>
              {foilKnown && (
                <>
                  <FoilBadge />
                  <p className="skins-banner-foil">
                    箔がきらめく、特別な一枚。
                  </p>
                </>
              )}
              <span className="skins-banner-label">
                {POOL.length}キャラ{foilKnown ? " · 各キャラにフォイル版" : ""}
              </span>
            </div>
          </section>
          <div className="skins-summon-controls">
            {FREE_GACHA ? (
              <div className="skins-free">
                <span>TEST PLAY</span>無料・回数制限なし
              </div>
            ) : (
              <div className="skins-balances">
                <div className="skins-free">
                  <span>TICKETS</span>チケット {collection.tickets}枚
                </div>
                <div className="skins-free">
                  <GemAmount amount={collection.gems || 0} size={28} />
                </div>
              </div>
            )}
            {collection.pendingPull && <button className="skin-btn skin-btn-gold" disabled={working || !!results} onClick={() => roll(collection.pendingPull.amount)}>
              未受取の{collection.pendingPull.amount}回召喚を確認
            </button>}
            <div className="skins-pull-buttons">
              <button
                disabled={
                  working ||
                  !!collection.pendingPull ||
                  !!results ||
                  (!FREE_GACHA && collection.tickets < PULL_COST)
                }
                className="skin-btn"
                onClick={() => roll(1)}
              >
                1回召喚
                <span>{FREE_GACHA ? "無料" : `チケット${PULL_COST}枚`}</span>
              </button>
              <button
                disabled={
                  working ||
                  !!collection.pendingPull ||
                  !!results ||
                  (!FREE_GACHA && collection.tickets < PULL_COST * 10)
                }
                className="skin-btn skin-btn-gold"
                onClick={() => roll(10)}
              >
                10回召喚
                <span>
                  {FREE_GACHA ? "無料" : `チケット${PULL_COST * 10}枚`}
                </span>
              </button>
            </div>
            {/* 召喚の釦を先に、演出の設定はその下へ(開いてすぐ引けるように。2026-09-18 本人の指示) */}
            <label className="skins-summon-motion">
              <input
                type="checkbox"
                checked={collection.summonMotion === "skip"}
                disabled={working}
                onChange={(e) => {
                  const summonMotion = e.target.checked ? "skip" : "full";
                  run((s) => ({ ...s, summonMotion }));
                }}
              />
              召喚の演出を飛ばす
              <small>門とカードの演出を省き、結果をすぐ出します</small>
            </label>
            {WALLET_SERVER && !FREE_GACHA && (
              /* ショップと同じ部品。買う前に確認し、確認は切れる(本人の指示 2026-09-17) */
              <TicketBuy
                layout="grid"
                gems={collection.gems || 0}
                working={buying || working}
                confirm={collection.ticketConfirm !== false}
                onToggleConfirm={toggleTicketConfirm}
                onBuy={buyTickets}
                onShop={shopOk ? () => setShop(true) : null}
              />
            )}
            {WALLET_SERVER && (shopOk || (adsOk && adsLeft !== 0)) && (
              <div className="skins-shop-row">
                {/* 左に広告、右にジェム(本人の指示 2026-09-17)。広告の文は3行に分けて読みやすく */}
                {adsOk && adsLeft !== 0 && (
                  <button
                    className="skin-btn skins-ad-btn"
                    disabled={buying || working}
                    onClick={watchAd}
                  >
                    広告を見て
                    <br />
                    チケット1枚
                    <span>
                      {adsLeft == null ? "1日3回まで" : `今日はあと${adsLeft}回`}
                    </span>
                  </button>
                )}
                {shopOk && (
                  <button
                    className="skin-btn skin-btn-gold skins-gem-btn"
                    disabled={buying || working}
                    onClick={() => setShop(true)}
                  >
                    <GemIcon size={24} /> ジェムを買う
                  </button>
                )}
              </div>
            )}
            <div className="skins-odds">
              <span>
                R <b>{ODDS.R}%</b>
              </span>
              <span>
                SR <b>{ODDS.SR}%</b>
              </span>
              <span>
                SSR <b>{ODDS.SSR}%</b>
              </span>
              <button onClick={() => setOdds(true)}>提供割合</button>
            </div>
            <p className="skins-note">
              上記は通常抽選の割合です。10回召喚では、条件達成でフリーズ昇格が発生します。
            </p>
            <p className="skins-foil-note">
              各キャラ獲得時に{foilPct}
              %でフォイル。フリーズ時は、最初に出た通常SSRがそれぞれ30%でフォイルへ昇格します。
            </p>
          </div>
          <section className="skins-special">
            <button
              className="skins-special-art"
              aria-label="A ランプのマジシャンの詳細"
              onClick={() => setSelected(byId("genie-magician"))}
            >
              {magicianLocked ? (
                <BattlePassSkinLock />
              ) : (
                <img
                  src={byId("genie-magician").image}
                  alt="ランプのマジシャン"
                />
              )}
            </button>
            <div>
              <span className="skins-eyebrow">BATTLE PASS REWARD / A</span>
              <h3>ランプのマジシャン</h3>
              {magicianLocked && (
                <p className="skins-pass-hint">バトルパスクリアで獲得可能</p>
              )}
              <p>
                3つの帽子で入れ替え、包囲した相手は大きな帽子の中へ。
                <br />
                バトルパスを完成させて手に入る特別スキンです。
              </p>
              <button
                className="skin-btn skin-btn-gold"
                disabled={
                  working ||
                  collection.equipped.A === "genie-magician" ||
                  (!collection.owned["genie-magician"] && !onBattlePass)
                }
                onClick={() =>
                  collection.owned["genie-magician"]
                    ? equipSkin(byId("genie-magician"))
                    : onBattlePass()
                }
              >
                {collection.equipped.A === "genie-magician"
                  ? "Aに装備中"
                  : collection.owned["genie-magician"]
                    ? "Aに装備"
                    : "バトルパスで獲得"}
              </button>
            </div>
          </section>
          {/* 天馬騎士は「はじめてのジェム購入」の特典。以前は無料で受け取れる早期特典だったが、
              いまは初回購入で配る(src/iap/catalog.js の FIRST_PURCHASE_SKIN)。
              受け取り済みの人にはその旨を出す(2026-09-18 本人の指摘) */}
          <section className="skins-early">
            <div className="skins-early-cards">
              <CardFace
                rank="10"
                suit="heart"
                size="lg"
                skinId="pegasus-knight"
              />
            </div>
            <div>
              <span className="skins-eyebrow">FIRST PURCHASE GIFT</span>
              <h3>白い翼を、あなたに。</h3>
              <p>
                ペガサスナイト
                <br />
                はじめてのジェム購入でお渡しする「10」用スキン。
                <br />
                {hasPegasus
                  ? "受け取り済みです。所持・装備から選べます。"
                  : "ガチャからは出ません。初回購入だけ、ジェムも2倍になります。"}
              </p>
              <button
                className="skin-btn"
                disabled={working || hasPegasus || !shopOk}
                onClick={() => setShop(true)}
              >
                {hasPegasus
                  ? "受け取り済み"
                  : shopOk
                    ? "ジェムを買う"
                    : "アプリでジェムを買うと受け取れます"}
              </button>
            </div>
          </section>
        </div>
      ) : tab === "forge" || tab === "foil" ? (
        <ForgePanel
          collection={collection}
          foilKnown={foilKnown}
          view={tab === "foil" ? "foil" : "ether"}
          run={run}
          acquire={acquire}
          working={working || buying}
          onEther={WALLET_SERVER ? buyEtherWith : null}
          onPick={setSelected}
          message={message}
          setMessage={setMessage}
        />
      ) : (
        <div role="tabpanel" aria-label="所持・装備">
          <div className="skins-loadout">
            <div>
              <span className="skins-eyebrow">YOUR DECK</span>
              <h3>装備中のスキン</h3>
            </div>
            <div className="skins-loadout-row">
              {Object.values(collection.equipped).length ? (
                Object.values(collection.equipped).map((id) => {
                  const skin = byId(id);
                  return (
                    <button
                      key={id}
                      aria-label={`${skin.rank} ${skin.name}の装備詳細`}
                      onClick={() => setSelected(skin)}
                    >
                      <CardFace
                        rank={skin.rank}
                        suit="spade"
                        skinId={id}
                        animated={shine}
                      />
                      {skin.foil && (
                        <FoilBadge className="skins-loadout-foil" />
                      )}
                    </button>
                  );
                })
              ) : (
                <p>獲得したスキンを選び、カードを着せ替えましょう。</p>
              )}
            </div>
          </div>
          <div className="skins-filters" aria-label="スキンの絞り込み">
            {[
              ["all", "すべて"],
              ["owned", "所持"],
              ["R", "R"],
              ["SR", "SR"],
              ["SSR", "SSR"],
              ["LIMITED", "初回購入特典"],
              ["SPECIAL", "特別スキン"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {foilKnown && (
            <div
              className="skins-filters skins-finish-filters"
              aria-label="仕上げの絞り込み"
            >
              {[
                ["all", "すべての仕上げ"],
                ["normal", `通常版 ${SKINS.length}種`],
                ["foil", `フォイル ${visibleFoils.length}種`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={finish === id}
                  onClick={() => setFinish(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="skins-grid">
            {shown.map((skin) => {
              const locked = isBattlePassLocked(skin, collection.owned);
              return (
                <button
                  className={`skins-tile rarity-${skin.rarity}${locked ? " is-pass-locked" : ""}${skin.foil ? " is-foil" : ""}`}
                  key={skin.id}
                  onClick={() => setSelected(skin)}
                  aria-label={`${skin.rank} ${skin.name} ${locked ? "ロック中・バトルパスクリアで獲得可能" : collection.owned[skin.id] ? "所持" : "未所持"}`}
                >
                  <div className="skins-tile-art">
                    {locked ? (
                      <BattlePassSkinLock />
                    ) : (
                      <FoilArtwork
                        skin={skin}
                        src={skin.boardCard || skin.card}
                        alt={skin.role}
                        loading="lazy"
                        animated={shine}
                      />
                    )}
                    <span className="skins-tile-rank">{skin.rank}</span>
                    <span className="skins-tile-rarity">
                      {rarityLabel(skin)}
                    </span>
                    {skin.foil && <FoilBadge className="skins-art-foil" />}
                    {collection.equipped[skin.rank] === skin.id && (
                      <span className="skins-equipped">装備中</span>
                    )}
                  </div>
                  <strong>{skin.name}</strong>
                  <span className="skins-tile-status">
                    {collection.owned[skin.id]
                      ? `所持 ×${collection.owned[skin.id]}`
                      : locked
                        ? "バトルパスクリアで獲得可能"
                        : "未所持"}
                  </span>
                </button>
              );
            })}
          </div>
          {!shown.length && (
            <p className="skins-empty">
              この条件に当てはまるスキンはありません。
            </p>
          )}
        </div>
      )}
      <div className="skins-preferences">
        <p>
          音と対局中の演出(動画)は、右上の設定で変えられます。所持と装備はこの端末に保存されます。
        </p>
      </div>
      <p className="skins-message" role="status">
        {message}
      </p>

      {odds && (
        <SkinModal label="提供割合" onClose={() => setOdds(false)}>
          <div className="skin-modal-head">
            <h2>提供割合</h2>
            <button
              className="skin-close"
              aria-label="提供割合を閉じる"
              onClick={() => setOdds(false)}
            >
              ×
            </button>
          </div>
          <p>
            通常抽選の提供割合：R {ODDS.R}％ / SR {ODDS.SR}％ / SSR {ODDS.SSR}％
          </p>
          <p className="skins-foil-note">
            キャラが決まったあと、{foilPct}
            %でフォイルになります。下表はフリーズ昇格前の、通常版とフォイルを合計したキャラごとの確率です。
          </p>
          <p className="skins-note">
            10回召喚で、最初の10枚に「SSRが2枚以上」または「SSRとフォイルが各1枚以上」含まれるとフリーズが発生します。SSRフォイル1枚だけでも後者を満たします。
            元のSSR・フォイル以外は、通常R→通常SR、通常SR→通常SSRに1段階昇格し、昇格先のキャラはそのレアリティ内で均等に抽選します。
            元の通常SSRは、キャラを変えずに1枚ごとに30%でフォイルへ。元からあるフォイルは変わりません。昇格で新たに生まれたSSRは追加フォイル抽選の対象外です。
            獲得するのは昇格後の10枚です。追加のチケットは不要で、演出を省略しても結果は同じです。
          </p>
          <table className="skins-rate-table">
            <thead>
              <tr>
                <th>スキン</th>
                <th>レア度</th>
                <th>キャラ合計</th>
                <th>うちフォイル</th>
              </tr>
            </thead>
            <tbody>
              {POOL.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.rank} · {s.name}
                  </td>
                  <td>{s.rarity}</td>
                  <td>{ratePct(s)}％</td>
                  <td>{Number((rate(s) * FOIL_CHANCE).toFixed(5))}％</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="skins-note">
            通常抽選は1枚ごとに独立し、その後に上記のフリーズ判定を行います。重複時は所持数が増えます。初回購入特典・特別スキンはガチャから出現しません。
            通常版とフォイルは別々に所持・装備できます。錬成もキャラ1枚ごとに
            {foilPct}%でフォイルです。
          </p>
        </SkinModal>
      )}

      {results &&
        (acquisitionMode === "summon" && collection.pending ? (
          <SummonReveal
            results={collection.pending.results}
            drawNumber={collection.draws}
            freeze={collection.pending.freeze}
            onFinish={finishAcquisition}
            reduce={reduce || collection.summonMotion === "skip"}
          />
        ) : acquisitionMode === "foil" && craftedFoil ? (
          <CraftedFoilReveal
            result={craftedFoil}
            onFinish={finishAcquisition}
            reduce={reduce || collection.summonMotion === "skip"}
          />
        ) : acquisitionMode === "area" && areaRewards.length > 0 ? (
          <AreaAcquisition
            rewards={areaRewards}
            reduce={reduce || collection.summonMotion === "skip"}
            onFinish={() => setAcquisitionMode(null)}
          />
        ) : (
          <SkinModal
            label={resultLabel}
            onClose={closeResults}
            className="skins-results-overlay"
          >
            <div className="skin-modal-head">
              <div>
                <span className="skins-eyebrow">
                  {milestoneResult
                    ? "MILESTONE COMPLETE"
                    : exchangeResult
                      ? "EXCHANGE COMPLETE"
                      : craftResult
                        ? "FORGE COMPLETE"
                        : "SUMMON COMPLETE"}
                </span>
                <h2>
                  {milestoneResult
                    ? "フォイル加工完了"
                    : exchangeResult
                      ? "フォイル交換完了"
                      : craftResult
                        ? "錬成が完成しました"
                        : "新たな出会い"}
                </h2>
                {milestoneResult && (
                  <p className="skins-note">
                    通算{FOIL_MILESTONE}
                    枚獲得の記念に1枚プレゼント。所持カード・エーテルの消費はありません。
                  </p>
                )}
                {exchangeResult && (
                  <p className="skins-note">
                    {SHARD_NAME}を使って交換しました。抽選はありません。
                  </p>
                )}
                {results.some((r) => byId(r.id).foil) && (
                  <p className="skins-foil-acquired">
                    <FoilBadge /> フォイルを獲得しました
                  </p>
                )}
              </div>
              <button
                className="skin-close"
                aria-label={`${resultLabel}を閉じる`}
                disabled={working}
                onClick={closeResults}
              >
                ×
              </button>
            </div>
            <div
              className={`skins-results-grid ${results.length === 1 ? "single-result" : ""}`}
            >
              {results.map((result, index) => {
                const s = byId(result.id);
                // 崩した札は、その1枚ずつに印を出す(10連で何が崩れたか目で追えるように)
                const crushed = dismantledAt.has(index);
                // このキャラのフォイルを持っているか。どちらを装備するかの判断に効くので
                // 札ごとに出す。フォイル版が無い/伏せる札では foil が null になる
                const foil = visibleFoilOf(collection, foilKnown, s);
                const foilHeld = foil ? collection.owned[foil.id] || 0 : 0;
                return (
                  <article
                    key={index}
                    className={`skins-result rarity-${s.rarity}${s.foil ? " is-foil" : ""}${crushed ? " is-dismantled" : ""}`}
                  >
                    <div className="skins-result-art">
                      <FoilArtwork
                        skin={s}
                        src={s.card}
                        alt={s.role}
                        animated={shine}
                      />
                      <span className="skins-tile-rank">{s.rank}</span>
                      <span className="skins-tile-rarity">{s.rarity}</span>
                      {s.foil && <FoilBadge className="skins-art-foil" />}
                      <span
                        className={
                          crushed
                            ? "skin-dismantled"
                            : result.isNew
                              ? "skin-new"
                              : "skin-duplicate"
                        }
                      >
                        {crushed
                          ? `崩した +${dismantledAt.get(index)}`
                          : result.isNew
                            ? "NEW"
                            : "重複"}
                      </span>
                    </div>
                    <strong>{s.name}</strong>
                    {foilKnown && (
                      <small
                        className={`skins-result-foil${foilHeld ? " is-owned" : ""}`}
                      >
                        {foil ? (foilHeld ? "フォイル所持" : "フォイル未所持") : ""}
                      </small>
                    )}
                    <button
                      className="skin-btn"
                      disabled={working || collection.equipped[s.rank] === s.id}
                      onClick={() => equipSkin(s)}
                    >
                      {collection.equipped[s.rank] === s.id
                        ? "装備中"
                        : `${s.rank}に装備`}
                    </button>
                  </article>
                );
              })}
            </div>
            {areaRewards.length > 0 && (
              <section
                className="skins-result-areas"
                aria-label="獲得した効果盤面"
              >
                <h3>効果盤面も獲得しました</h3>
                <ul>
                  {areaRewards.map((reward) => (
                    <li key={reward.theme}>
                      <b>{areaRewardName(reward)}</b>
                      <span>
                        {reward.skins.map((skin) => (
                          <small key={skin.id}>
                            {skin.rank}：{skin.name.replace("（フォイル）", "")}
                          </small>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
                <p>
                  獲得したフォイルを対応する数字に装備し、その札を王にすると、9×9の対局で使えます。
                </p>
                <p>
                  効果の詳しい説明は、所持スキン一覧でフォイルを選ぶと確認できます。
                </p>
                <p>
                  対応するホーム装飾も解放されます。ホームの「着せ替え」から選べます。
                </p>
              </section>
            )}
            {/* 崩せるのはガチャの結果だけ。錬成・交換・加工の1枚は対象にしない */}
            {collection.pending?.results && (
              <ResultDismantle
                collection={collection}
                results={results}
                working={working}
                onRun={dismantlePulled}
                onToggleAuto={toggleAutoDismantle}
                onToggleRarity={toggleDismantleRarity}
                done={dismantled}
                setDone={setDismantled}
              />
            )}
            <div className="skins-result-actions">
              <p className="skins-message" role="status">
                {message}
              </p>
              <button
                className="skin-btn skin-btn-gold skins-result-done"
                disabled={working}
                onClick={closeResults}
              >
                結果を確認
              </button>
            </div>
          </SkinModal>
        ))}

      {foilOffer && !shop && (
        <FoilOfferSheet
          offers={
            foilOffer
              ? foilOffers(collection, { exclude: foilOffer.exclude })
              : []
          }
          gemsPaid={collection.gemsPaid || 0}
          working={working}
          onBuy={buyFoilOffer}
          message={message}
          onClose={() => setFoilOffer(null)}
          onShop={shopOk ? () => setShop(true) : null}
        />
      )}
      {shop && (
        <GemShop
          gems={collection.gems || 0}
          gemsPaid={collection.gemsPaid || 0}
          gemsFree={collection.gemsFree || 0}
          onClose={() => setShop(null)}
          onMessage={setMessage}
        />
      )}
      {selected && (
        <SkinModal
          label={`${selected.name}の詳細`}
          onClose={() => setSelected(null)}
          className="skins-detail-overlay"
        >
          <div className="skins-detail-nav">
            <button
              type="button"
              className="skin-btn skins-detail-back"
              aria-label="スキン一覧に戻る"
              onClick={() => setSelected(null)}
            >
              <ArrowLeft size={18} /> もどる
            </button>
            {!selectedLocked && selected.video ? (
              <button
                type="button"
                className="skin-btn skin-btn-gold skins-detail-play"
                onClick={() => setFilm(selected)}
              >
                ▶ バトル演出を見る
              </button>
            ) : (
              <span>スキン詳細</span>
            )}
          </div>
          <div className="skins-detail">
            {selectedLocked ? (
              <BattlePassSkinLock className="skins-detail-portrait" />
            ) : (
              <FoilArtwork
                className="skins-detail-portrait"
                skin={selected}
                alt={selected.name}
                animated={shine}
              />
            )}
            <div className="skins-detail-info">
              <span className="skins-eyebrow">
                {rarityLabel(selected)} / {selected.rank}
              </span>
              {selected.foil && <FoilBadge className="skins-detail-foil" />}
              <h2>{selected.name}</h2>
              <p>{selected.role}</p>
              {foilKnown && (
                <SkinAreaNote
                  skin={selected}
                  owned={!!collection.owned[selected.id]}
                  equipped={collection.equipped[selected.rank] === selected.id}
                />
              )}
              {foilKnown && skinVisibleInCollection(collection, byId(foilId(baseSkinId(selected.id)))) && (
                <div
                  className="skins-variant-switch"
                  aria-label="このキャラの仕上げ"
                >
                  {[
                    byId(baseSkinId(selected.id)),
                    byId(foilId(baseSkinId(selected.id))),
                  ].map((variant) => (
                    <button
                      key={variant.id}
                      aria-pressed={selected.id === variant.id}
                      onClick={() => setSelected(variant)}
                    >
                      {variant.foil ? "フォイル" : "通常版"}
                      <small>
                        {collection.owned[variant.id]
                          ? `所持 ×${collection.owned[variant.id]}`
                          : "未所持"}
                        {collection.equipped[variant.rank] === variant.id
                          ? " · 装備中"
                          : ""}
                      </small>
                    </button>
                  ))}
                </div>
              )}
              {selected.foil && !selected.secret && (
                <>
                  <p className="skins-note">
                    箔の部分だけが光るフォイル版。ガチャ・錬成で、このキャラを獲得したときに
                    {foilPct}%の確率で手に入ります。また、通算{FOIL_MILESTONE}
                    枚獲得すると「フォイル加工」で一度だけ、所持カード・エーテルを消費せず1枚受け取れます。
                  </p>
                  <button
                    className="skin-btn"
                    onClick={() => {
                      setSelected(null);
                      setTab("foil");
                      requestAnimationFrame(() =>
                        document
                          .getElementById("forge-foil-milestones")
                          ?.scrollIntoView({ block: "start" }),
                      );
                    }}
                  >
                    フォイル加工の進捗を見る
                  </button>
                </>
              )}
              {selected.secret && (
                <p className="skins-note">
                  すべての通常カードとほかのフォイルをそろえた人だけが、有償ジェム2,000で購入できる特別なフォイルです。
                </p>
              )}
              {selectedLocked ? (
                <div className="skins-pass-unlock">
                  <strong>バトルパスクリアで獲得可能</strong>
                  <p>
                    すべてのマスをクリアしてめくり、報酬を受け取ると解放されます。
                  </p>
                </div>
              ) : (
                <div className="skins-board-preview">
                  <div>
                    <CardFace
                      rank={selected.rank}
                      suit="spade"
                      size="md"
                      skinId={selected.id}
                      animated={shine}
                    />
                    <span>5マス盤</span>
                  </div>
                  <div>
                    <CardFace
                      rank={selected.rank}
                      suit="heart"
                      size="xs"
                      skinId={selected.id}
                      animated={shine}
                    />
                    <span>9マス盤</span>
                  </div>
                  <div>
                    <CardFace
                      rank={selected.rank}
                      suit="club"
                      size="sm"
                      skinId={selected.id}
                      animated={shine}
                      isKing
                    />
                    <span>王カード</span>
                  </div>
                </div>
              )}
              <p className="skins-note">
                同じ数字の全スートに適用。
                <br />
                {selected.id === "genie-magician:foil"
                  ? "9×9では通常のAの能力に加えて、マジカルシャッフルを使えます。"
                  : "カードの能力や動ける範囲は変わりません。"}
              </p>
              {collection.owned[selected.id] ? (
                <button
                  className="skin-btn skin-btn-gold"
                  disabled={working}
                  onClick={() =>
                    collection.equipped[selected.rank] === selected.id
                      ? run((s) => unequip(s, selected.rank))
                      : equipSkin(selected)
                  }
                >
                  {collection.equipped[selected.rank] === selected.id
                    ? "装備を外す"
                    : `${selected.rank}のカードに装備`}
                </button>
              ) : selected.secret ? (
                <button
                  className="skin-btn skin-btn-gold"
                  disabled={working || !foilOffers(collection).some(o => o.product.secret)}
                  onClick={() => {
                    setSelected(null);
                    setFoilOffer({ exclude: [] });
                  }}
                >
                  有償ジェム2,000で購入
                </button>
              ) : selected.acquisition === "battlepass" ? (
                <button
                  className="skin-btn skin-btn-gold"
                  disabled={working || !onBattlePass}
                  onClick={onBattlePass}
                >
                  バトルパスを見る
                </button>
              ) : (
                <p className="skins-locked">
                  {selected.rarity === "LIMITED"
                    ? "はじめてのジェム購入で獲得"
                    : selected.foil
                      ? `獲得時に${foilPct}%、または通算${FOIL_MILESTONE}枚でフォイル加工`
                      : "ガチャ・錬成から獲得できます"}
                </p>
              )}
              {!selectedLocked && selected.videos && (
                <>
                  <p>{selected.description}</p>
                  <button
                    className="skin-btn"
                    onClick={() =>
                      setFilm({ ...selected, video: selected.videos.swap })
                    }
                  >
                    ▶ 入れ替えの動画を見る
                  </button>
                  <button
                    className="skin-btn"
                    onClick={() =>
                      setFilm({ ...selected, video: selected.videos.capture })
                    }
                  >
                    ▶ 包囲撃破の動画を見る
                  </button>
                </>
              )}
              <p className="skins-message" role="status">
                {message}
              </p>
            </div>
          </div>
        </SkinModal>
      )}
      {film && <SkinFilm skin={film} onClose={() => setFilm(null)} />}
      {onBack && (
        <button className="btn btn-ghost btn-home" onClick={onBack}>
          <ArrowLeft size={16} /> ホームに戻る
        </button>
      )}
    </div>
  );
}
