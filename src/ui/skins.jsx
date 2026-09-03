import { useEffect, useRef, useState } from "react";
import { cardBackImg } from "../assets.js";
import { SKINS, POOL, ODDS, byId, rate } from "../skins/catalog.js";
import { claimEarly, equip, pull, unequip } from "../skins/collection.js";
import { updateCollection, useCollection } from "../skins/store.js";
import { CardFace } from "./cards.jsx";
import { SkinModal, useReducedMotion } from "./skin-modal.jsx";
import { SkinFilm } from "./skin-film.jsx";
import { OMEN_TEXT, ladderOf, omenOf } from "../skins/reveal.js";

const rarityLabel = (s) => (s.rarity === "LIMITED" ? "早期特典" : s.rarity);

/** めくる1枚。指で引き寄せると角度がついてめくれ、半分を越えると裏返る */
/** 昇格の間合い。格を読ませる時間と、くるくる回る時間 */
const PROMOTE_HOLD_MS = 900;
const PROMOTE_SPIN_MS = 1100;

/** めくる1枚。指で引き寄せると角度がついてめくれ、半分を越えると裏返る */
function RevealCard({ result, index, flipped, onFlip, reduce }) {
  const skin = byId(result.id);
  const ladder = ladderOf(skin.rarity);
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
    shown === "SSR" && skin.rarity === "LIMITED" ? "早期特典" : shown;
  return (
    <button
      type="button"
      className={`reveal-card ${flipped ? "is-flipped" : ""} ${
        dragging ? "is-dragging" : ""
      } ${shown ? `rarity-${shown}` : ""} ${final ? "is-final" : ""} ${
        spinning ? `is-spinning spin-to-${next}` : ""
      } ${landing ? "is-landing" : ""}`}
      style={{ "--i": index, "--angle": `${flipped ? 180 : angle}deg` }}
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
  const all = flipped.every(Boolean);
  const flipAt = (i) =>
    setFlipped((f) => (f[i] ? f : f.map((v, k) => (k === i ? true : v))));
  const cols = results.length === 1 ? 1 : results.length <= 4 ? 2 : 5;
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
        >
          {results.map((r, i) => (
            <RevealCard
              key={i}
              result={r}
              index={i}
              flipped={flipped[i]}
              onFlip={() => flipAt(i)}
              reduce={reduce}
            />
          ))}
        </div>
        <p className="reveal-hint">
          {all
            ? ""
            : results.length === 1
              ? "札を引き寄せて、めくってください。"
              : "札を1枚ずつ引き寄せて、めくってください。"}
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
      {!all && (
        <button className="skin-skip" onClick={onFinish}>
          スキップして結果へ →
        </button>
      )}
    </SkinModal>
  );
}

export function SkinsScreen() {
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
                全14種 · 同じ数字のカードに装備
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
          <section className="skins-early">
            <div className="skins-early-cards">
              <CardFace
                rank="10"
                suit="spade"
                size="lg"
                skinId="dragon-knight"
              />
              <CardFace
                rank="10"
                suit="heart"
                size="lg"
                skinId="pegasus-knight"
              />
            </div>
            <div>
              <span className="skins-eyebrow">EARLY ACCESS GIFT</span>
              <h3>ふたつの翼を、あなたに。</h3>
              <p>
                ドラゴンナイト ＆ ペガサスナイト
                <br />
                早期特典の「10」用スキンをプレゼント。
              </p>
              <button
                className="skin-btn"
                disabled={working || collection.earlyClaimed}
                onClick={async () => {
                  if (await run(claimEarly)) {
                    setTab("collection");
                    setFilter("LIMITED");
                    setMessage(
                      "早期特典の2種を受け取りました。カードを選んで装備できます。",
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
            <option value="full">通常（5秒）</option>
            <option value="short">短縮（バトル2秒・ガチャ省略）</option>
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
                  <td>{rate(s)}％</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="skins-note">
            10回召喚も各回独立です。重複時は所持数が増えます。早期特典2種はガチャから出現しません。
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
              ) : (
                <p className="skins-locked">
                  {selected.rarity === "LIMITED"
                    ? "早期特典で獲得"
                    : "ガチャから獲得できます"}
                </p>
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
    </div>
  );
}
