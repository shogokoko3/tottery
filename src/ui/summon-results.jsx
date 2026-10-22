import { FoilArtwork } from "./foil-artwork.jsx";
import { Phrases, namePhrases } from "./phrases.jsx";

export function FoilBadge({ className = "" }) {
  return <span className={`skins-foil-badge ${className}`}>FOIL</span>;
}

// Shared card presentation for real gacha results and the first-run preview.
// Inventory changes are supplied by the caller; this component never writes.
export function SummonResultCard({
  skin: s,
  result,
  index,
  collection,
  foil = null,
  foilKnown = false,
  foilHeld = 0,
  crushed = false,
  dismantledAt = new Map(),
  autoEquippedAt = new Set(),
  firstResults = false,
  working = false,
  shine = true,
  onEquip,
}) {
  return (
    <article
      key={index}
      className={`skins-result rarity-${s.rarity}${s.foil ? " is-foil" : ""}${crushed ? " is-dismantled" : ""}`}
    >
      <div className="skins-result-art">
        <FoilArtwork skin={s} src={s.card} alt={s.role} animated={shine} />
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
        {/* このキャラのフォイルを持っているか。1行の文で出すと枠を取りすぎるので、
                          絵の右下に小さな印で(2026-09-24 本人の指示) */}
        {foilKnown && foil && (
          <small
            className={`skins-result-foil${foilHeld ? " is-owned" : ""}`}
            title={
              foilHeld
                ? "このキャラのフォイルを持っています"
                : "このキャラのフォイルは未所持"
            }
          >
            箔
          </small>
        )}
      </div>
      {/* 名は「の」と空白のあとで句に切る(4列の狭い列で「黄昏のレヴナン/ト」と割れた。2026-10-06 見直し) */}
      <strong>
        <Phrases text={namePhrases(s.name)} />
      </strong>
      {/* このキャラのフォイルを所持・装備しているときは、通常版の装備釦を出さない。
                        上位のフォイルが付いているのに通常版へ戻す操作は紛らわしい(2026-09-21 本人の指示) */}
      {/* 手で着せなくてよかったことが分かるように、この抽選で
                        自動装備した札には金の印を出す(2026-09-28 本人の指示)。
                        あとから別の札に着せ替えたら、ふつうの釦に戻る */}
      {autoEquippedAt.has(index) && collection.equipped[s.rank] === s.id ? (
        <small
          className="skins-result-equipped"
          aria-label={`${s.rank}に「${s.name}」を装備${firstResults ? "した" : "しました"}`}
        >
          <i aria-hidden="true" />
          {/* 導入の10連は導入の言葉の調子で(2026-10-06 見直し) */}
          {firstResults ? "装備した" : "装備しました"}
        </small>
      ) : !s.foil &&
        foil &&
        foilHeld &&
        collection.equipped[s.rank] === foil.id ? (
        <small className="skins-result-equipped-foil">フォイル装備中</small>
      ) : (
        <button
          className="skin-btn"
          disabled={working || collection.equipped[s.rank] === s.id}
          onClick={() => onEquip(s)}
        >
          {collection.equipped[s.rank] === s.id ? "装備中" : `${s.rank}に装備`}
        </button>
      )}
    </article>
  );
}
