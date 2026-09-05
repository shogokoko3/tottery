import { useEffect, useRef, useState } from "react";
import { cardBackImg } from "../assets.js";
import { SKINS, POOL, ODDS, byId, rate } from "../skins/catalog.js";
import {
  claimEarly,
  craft,
  dismantle,
  dismantleAll,
  equip,
  pull,
  unequip,
} from "../skins/collection.js";
import {
  CRAFT,
  ETHER_NAME,
  costOf,
  dustOf,
  etherOf,
  forgeSummary,
  isKeepsake,
  spares,
  totalOfSpares,
} from "../skins/ether.js";
import { updateCollection, useCollection } from "../skins/store.js";
import { CardFace } from "./cards.jsx";
import { SkinModal, useReducedMotion } from "./skin-modal.jsx";
import { SkinFilm } from "./skin-film.jsx";
import { ArrowLeft, Ether } from "../icons.jsx";
import { OMEN_TEXT, ladderFor, omenOf, seedOf } from "../skins/reveal.js";

const rarityLabel = (s) =>
  s.rarity === "LIMITED"
    ? "早期特典"
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
function RevealCard({ result, index, flipped, onFlip, reduce, seed }) {
  const skin = byId(result.id);
  // 素で出るか、昇格を経るかは束と位置で決まる(再読み込みしても同じ)
  const ladder = ladderFor(skin.rarity, `${seed}#${index}`);
  // -1 は伏せたまま。0 以降は ladder の段階(昇格の途中)
  const [stage, setStage] = useState(-1);
  // 次の格へ向けて回っている最中か。回っている間も今の格は見せたまま
  const [spinning, setSpinning] = useState(false);
  // 着地した瞬間だけ光る
  const [landing, setLanding] = useState(false);
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  useEffect(() => {
    if (!flipped) return;
    if (reduce || ladder.length === 1) {
      setStage(ladder.length - 1);
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
          setLanding(true);
        }, t),
      );
      timers.push(setTimeout(() => setLanding(false), t + 650));
      t += PROMOTE_HOLD_MS; // 上がった格を読ませてから次へ
    }
    return () => timers.forEach(clearTimeout);
  }, [flipped]);
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
  const final = stage === ladder.length - 1;
  const label =
    shown === "SSR" && ["LIMITED", "SPECIAL"].includes(skin.rarity)
      ? rarityLabel(skin)
      : shown;
  return (
    <button
      type="button"
      className={`reveal-card ${flipped ? "is-flipped" : ""} ${
        dragging ? "is-dragging" : ""
      } ${shown ? `rarity-${shown}` : ""} ${final ? "is-final" : ""} ${
        spinning ? `is-spinning spin-to-${next}` : ""
      } ${landing ? "is-landing" : ""}`}
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
          ? final
            ? skin.name
            : `${label}。${next}へ昇格中`
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
        <span className="reveal-front">
          {final ? (
            <img src={skin.card} alt={skin.role} draggable="false" />
          ) : (
            <span className="reveal-veil" />
          )}
          <span className="reveal-rarity">{label || ""}</span>
          {!final && spinning && <span className="reveal-promoting">昇格</span>}
          {final && <strong className="reveal-name">{skin.name}</strong>}
          {final && result.isNew && <span className="reveal-new">NEW</span>}
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
function SummonReveal({ results, onFinish, reduce }) {
  const [flipped, setFlipped] = useState(() => results.map(() => false));
  const omen = omenOf(results);
  const seed = seedOf(results);
  const all = flipped.every(Boolean);
  const flipAt = (i) =>
    setFlipped((f) => (f[i] ? f : f.map((v, k) => (k === i ? true : v))));
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
      onClose={onFinish}
      className="skin-summon-overlay"
    >
      <div className={`skin-reveal omen-${omen}`}>
        <div className="reveal-omen" aria-hidden="true" />
        <p className="reveal-caption" role="status">
          {all ? "すべての札がめくれました。" : OMEN_TEXT[omen]}
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
              reduce={reduce}
              seed={seed}
            />
          ))}
        </div>
        <p className="reveal-hint">
          {all
            ? ""
            : results.length === 1
              ? "札を引き寄せて、めくってください。"
              : "札を引き寄せてめくるか、指でなぞって次々にめくれます。"}
        </p>
        <div className="reveal-actions">
          {!all && (
            <button
              className="skin-btn"
              onClick={() => setFlipped(results.map(() => true))}
            >
              すべてめくる
            </button>
          )}
          {all && (
            <button className="skin-btn skin-btn-gold" onClick={onFinish}>
              結果へ →
            </button>
          )}
        </div>
      </div>
    </SkinModal>
  );
}

/**
 * 錬成。ダブった札を崩してエーテルにし、狙った1枚を作る。
 * 値づけの根拠は src/skins/ether.js に書いてある。
 */
function ForgePanel({ collection, run, working, onPick, setMessage }) {
  const [pick, setPick] = useState("SSR");
  // 目安の数字は抽選の中身から引き直す。手で書くと片方だけ古くなる
  const summary = forgeSummary();
  const top = summary.byId("SSR");
  const ether = etherOf(collection);
  const rows = spares(collection, SKINS);
  const bulk = totalOfSpares(collection, SKINS);
  const targets = SKINS.filter((s) => !isKeepsake(s) && s.rarity === pick);

  const breakOne = async (skin) => {
    if (await run((c) => dismantle(c, skin.id)))
      setMessage(
        `「${skin.name}」を崩して ${ETHER_NAME}を ${dustOf(skin)} 得ました。`,
      );
  };
  const breakAll = async () => {
    if (await run((c) => dismantleAll(c)))
      setMessage(`ダブりを全部崩して ${ETHER_NAME}を ${bulk} 得ました。`);
  };
  const make = async (skin) => {
    if (await run((c) => craft(c, skin.id)))
      setMessage(
        `${ETHER_NAME}を ${costOf(skin).toLocaleString()} 使って「${skin.name}」を作りました。`,
      );
  };

  return (
    <div role="tabpanel" aria-label="錬成">
      <div className="forge-bank">
        <span className="skins-eyebrow">YOUR ETHER</span>
        <b>
          <Ether size={26} /> {ether.toLocaleString()}
        </b>
        <p>ダブった札を崩すと貯まります。狙った1枚を作るのに使います。</p>
      </div>

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
                <li key={skin.id} className={`forge-row rarity-${skin.rarity}`}>
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
              disabled={working}
              onClick={breakAll}
            >
              <Ether size={16} /> ダブりを全部崩す（+{bulk}）
            </button>
          </>
        ) : (
          <p className="skins-empty">
            同じ札が2枚以上あると崩せます。最後の1枚は残るので、
            装備中の札が消えることはありません。
          </p>
        )}
      </section>

      <section className="forge-section">
        <div className="forge-head">
          <h3>作る</h3>
          <span>好きな1枚を選べます</span>
        </div>
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
                <button
                  className={`btn ${can ? "btn-primary" : "btn-ghost"} btn-small`}
                  disabled={working || !can}
                  onClick={() => make(skin)}
                >
                  <Ether size={13} /> {cost.toLocaleString()}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="forge-section forge-rates">
        <div className="forge-head">
          <h3>交換の目安</h3>
        </div>
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
          崩してもらえる量は「その1枚の出にくさ」に比例させてあります。
          作るのに要るのは、その4倍。つまり<b>同じ格ならダブり4枚で好きな1枚</b>
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
          早期特典・特別スキンは崩すことも作ることもできません。
        </p>
      </section>
    </div>
  );
}

export function SkinsScreen({ onBack, onBattlePass }) {
  const collection = useCollection(),
    reduce = useReducedMotion();
  const [tab, setTab] = useState("gacha"),
    [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null),
    [odds, setOdds] = useState(false);
  const [animating, setAnimating] = useState(false),
    [film, setFilm] = useState(null);
  const [working, setWorking] = useState(false),
    [message, setMessage] = useState("");
  const busy = useRef(false);
  const ownedCount = Object.keys(collection.owned).length;
  const run = async (change) => {
    if (busy.current) return false;
    busy.current = true;
    setWorking(true);
    setMessage("");
    try {
      await updateCollection(change);
      return true;
    } catch (e) {
      setMessage(e.message);
      return false;
    } finally {
      busy.current = false;
      setWorking(false);
    }
  };
  const roll = async (amount) => {
    if (busy.current || collection.pending) return;
    setAnimating(!reduce && collection.motion === "full");
    if (!(await run((s) => pull(s, amount)))) setAnimating(false);
  };
  const equipSkin = async (skin) => {
    if (await run((s) => equip(s, skin.id)))
      setMessage(`${skin.rank}のカードに「${skin.name}」を装備しました。`);
  };
  const closeResults = () => run((s) => ({ ...s, pending: null }));
  const shown = SKINS.filter(
    (s) =>
      filter === "all" ||
      (filter === "owned" ? collection.owned[s.id] : s.rarity === filter),
  );
  return (
    <div className="skins-page">
      <div className="skins-heading">
        <div>
          <span className="skins-eyebrow">TOTTERY / CARD SKINS</span>
          <h1>英雄の召喚</h1>
        </div>
        <p>
          所持 <strong>{ownedCount}</strong>
          <span> / {SKINS.length}</span>
        </p>
      </div>
      <div className="skins-tabs" role="tablist" aria-label="スキンメニュー">
        <button
          role="tab"
          aria-selected={tab === "gacha"}
          onClick={() => setTab("gacha")}
        >
          スキンガチャ
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
      </div>
      {tab === "gacha" ? (
        <div className="skins-gacha" role="tabpanel" aria-label="スキンガチャ">
          <section className="skins-banner">
            <div className="skins-banner-art" aria-hidden="true">
              <img className="banner-left" src={byId("demon-q").image} alt="" />
              <img
                className="banner-right"
                src={byId("angel-k").image}
                alt=""
              />
            </div>
            <div className="skins-banner-copy">
              <span className="skins-eyebrow">天使か、悪魔か。</span>
              <h2>
                運命の一枚を、
                <br />
                手に。
              </h2>
              <p>カードに宿る、新たな姿。</p>
              <span className="skins-banner-label">
                全{POOL.length}種 · 同じ数字のカードに装備
              </span>
            </div>
          </section>
          <div className="skins-summon-controls">
            <div className="skins-free">
              <span>TEST PLAY</span>無料・回数制限なし
            </div>
            <div className="skins-pull-buttons">
              <button
                disabled={working || !!collection.pending}
                className="skin-btn"
                onClick={() => roll(1)}
              >
                1回召喚<span>無料</span>
              </button>
              <button
                disabled={working || !!collection.pending}
                className="skin-btn skin-btn-gold"
                onClick={() => roll(10)}
              >
                10回召喚<span>無料</span>
              </button>
            </div>
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
              1回ごとに同じ確率で抽選します。10回召喚の確定枠はありません。
            </p>
          </div>
          <section className="skins-special">
            <button
              className="skins-special-art"
              aria-label="A ランプのマジシャンの詳細"
              onClick={() => setSelected(byId("genie-magician"))}
            >
              <img
                src={byId("genie-magician").image}
                alt="ランプのマジシャン"
              />
            </button>
            <div>
              <span className="skins-eyebrow">BATTLE PASS REWARD / A</span>
              <h3>ランプのマジシャン</h3>
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
              <span className="skins-eyebrow">EARLY ACCESS GIFT</span>
              <h3>白い翼を、あなたに。</h3>
              <p>
                ペガサスナイト
                <br />
                早期特典の「10」用スキンをプレゼント。
                <br />
                ここでしか手に入りません。
              </p>
              <button
                className="skin-btn"
                disabled={working || collection.earlyClaimed}
                onClick={async () => {
                  if (await run(claimEarly)) {
                    setTab("collection");
                    setFilter("LIMITED");
                    setMessage(
                      "早期特典を受け取りました。カードを選んで装備できます。",
                    );
                  }
                }}
              >
                {collection.earlyClaimed
                  ? "受け取り済み"
                  : "早期特典を受け取る"}
              </button>
            </div>
          </section>
        </div>
      ) : tab === "forge" ? (
        <ForgePanel
          collection={collection}
          run={run}
          working={working}
          onPick={setSelected}
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
                      <CardFace rank={skin.rank} suit="spade" skinId={id} />
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
              ["LIMITED", "早期特典"],
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
          <div className="skins-grid">
            {shown.map((skin) => (
              <button
                className={`skins-tile rarity-${skin.rarity}`}
                key={skin.id}
                onClick={() => setSelected(skin)}
                aria-label={`${skin.rank} ${skin.name} ${collection.owned[skin.id] ? "所持" : "未所持"}`}
              >
                <div className="skins-tile-art">
                  <img src={skin.card} alt={skin.role} loading="lazy" />
                  <span className="skins-tile-rank">{skin.rank}</span>
                  <span className="skins-tile-rarity">{rarityLabel(skin)}</span>
                  {collection.equipped[skin.rank] === skin.id && (
                    <span className="skins-equipped">装備中</span>
                  )}
                </div>
                <strong>{skin.name}</strong>
                <span className="skins-tile-status">
                  {collection.owned[skin.id]
                    ? `所持 ×${collection.owned[skin.id]}`
                    : "未所持"}
                </span>
              </button>
            ))}
          </div>
          {!shown.length && (
            <p className="skins-empty">
              まだスキンを所持していません。ガチャで英雄を迎えましょう。
            </p>
          )}
        </div>
      )}
      <div className="skins-preferences">
        <label>
          演出の長さ
          <select
            aria-label="演出の長さ"
            value={collection.motion}
            disabled={working}
            onChange={(e) => {
              const motion = e.target.value;
              run((s) => ({ ...s, motion }));
            }}
          >
            <option value="full">通常（動画＋盤面演出）</option>
            <option value="short">短縮（最大2秒・ガチャ省略）</option>
            <option value="off">演出なし</option>
          </select>
        </label>
        <p>
          音は右上の設定に従います。所持・装備はこのブラウザーに保存されます。
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
          <p>R 65％ / SR 32％ / SSR 3％</p>
          <table className="skins-rate-table">
            <thead>
              <tr>
                <th>スキン</th>
                <th>レア度</th>
                <th>1回の確率</th>
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
                </tr>
              ))}
            </tbody>
          </table>
          <p className="skins-note">
            10回召喚も各回独立です。重複時は所持数が増えます。早期特典・特別スキンはガチャから出現しません。
          </p>
        </SkinModal>
      )}

      {collection.pending &&
        (animating ? (
          <SummonReveal
            results={collection.pending.results}
            onFinish={() => setAnimating(false)}
            reduce={reduce}
          />
        ) : (
          <SkinModal
            label="召喚結果"
            onClose={closeResults}
            className="skins-results-overlay"
          >
            <div className="skin-modal-head">
              <div>
                <span className="skins-eyebrow">SUMMON COMPLETE</span>
                <h2>新たな出会い</h2>
              </div>
              <button
                className="skin-close"
                aria-label="召喚結果を閉じる"
                disabled={working}
                onClick={closeResults}
              >
                ×
              </button>
            </div>
            <div
              className={`skins-results-grid ${collection.pending.results.length === 1 ? "single-result" : ""}`}
            >
              {collection.pending.results.map((result, index) => {
                const s = byId(result.id);
                return (
                  <article
                    key={index}
                    className={`skins-result rarity-${s.rarity}`}
                  >
                    <div className="skins-result-art">
                      <img src={s.card} alt={s.role} />
                      <span className="skins-tile-rank">{s.rank}</span>
                      <span className="skins-tile-rarity">{s.rarity}</span>
                      <span
                        className={result.isNew ? "skin-new" : "skin-duplicate"}
                      >
                        {result.isNew ? "NEW" : "重複"}
                      </span>
                    </div>
                    <strong>{s.name}</strong>
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
          </SkinModal>
        ))}

      {selected && (
        <SkinModal
          label={`${selected.name}の詳細`}
          onClose={() => setSelected(null)}
          className="skins-detail-overlay"
        >
          <button
            className="skin-close detail-close"
            aria-label="スキンの詳細を閉じる"
            onClick={() => setSelected(null)}
          >
            ×
          </button>
          <div className="skins-detail">
            <img
              className="skins-detail-portrait"
              src={selected.image}
              alt={selected.name}
            />
            <div className="skins-detail-info">
              <span className="skins-eyebrow">
                {rarityLabel(selected)} / {selected.rank}
              </span>
              <h2>{selected.name}</h2>
              <p>{selected.role}</p>
              <div className="skins-board-preview">
                <div>
                  <CardFace
                    rank={selected.rank}
                    suit="spade"
                    size="md"
                    skinId={selected.id}
                  />
                  <span>5マス盤</span>
                </div>
                <div>
                  <CardFace
                    rank={selected.rank}
                    suit="heart"
                    size="xs"
                    skinId={selected.id}
                  />
                  <span>9マス盤</span>
                </div>
                <div>
                  <CardFace
                    rank={selected.rank}
                    suit="club"
                    size="sm"
                    skinId={selected.id}
                    isKing
                  />
                  <span>王カード</span>
                </div>
              </div>
              <p className="skins-note">
                同じ数字の全スートに適用。
                <br />
                カードの能力や動ける範囲は変わりません。
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
              ) : selected.rarity === "SPECIAL" ? (
                <button
                  className="skin-btn skin-btn-gold"
                  disabled={working || !onBattlePass}
                  onClick={onBattlePass}
                >
                  バトルパスで獲得
                </button>
              ) : (
                <p className="skins-locked">
                  {selected.rarity === "LIMITED"
                    ? "早期特典で獲得"
                    : "ガチャから獲得できます"}
                </p>
              )}
              {selected.videos && (
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
              {selected.video && (
                <button className="skin-btn" onClick={() => setFilm(selected)}>
                  ▶ 5秒のバトル演出を見る
                </button>
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
