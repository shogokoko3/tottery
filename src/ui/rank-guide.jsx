import { RANK_TIERS } from "../game/rating.js";
import { L, Lx } from "../i18n/index.js";

export function RankGuide() {
  return (
    <section className="rank-guide" aria-labelledby="rank-guide-title">
      <h3 id="rank-guide-title">{L("段位と到達条件")}</h3>
      <p className="rank-guide-intro">
        {L("現在のレートで段位が決まります。対戦数の条件はありません。")}
      </p>
      <table className="rank-guide-table" aria-label={L("段位ごとのレート範囲")}>
        <thead>
          <tr>
            <th scope="col">{L("段位")}</th>
            <th scope="col">{L("レート")}</th>
          </tr>
        </thead>
        <tbody>
          {RANK_TIERS.map((tier, index) => (
            <tr key={tier.name}>
              <th scope="row">
                <span className={`rank-guide-emblem rank-guide-tier-${index}`}>
                  {Lx(tier.name)}
                </span>
              </th>
              <td>
                <b>
                  {index === 0
                    ? RANK_TIERS[1].rating - 1
                    : RANK_TIERS[index + 1]
                      ? `${tier.rating}〜${RANK_TIERS[index + 1].rating - 1}`
                      : tier.rating}
                </b>
                {index === 0 && <small>{L("以下")}</small>}
                {index === RANK_TIERS.length - 1 && <small>{L("以上")}</small>}
              </td>
            </tr>
          )).reverse()}
        </tbody>
      </table>
      <div className="rank-guide-note">
        <b>{L("対象はフェーズ3の9×9のオンライン対戦")}</b>
        <p>{L("今シーズンのレートで段位を判定します。")}</p>
        <p>{L("初期レートは1500。「兵」からスタートします。")}</p>
      </div>
    </section>
  );
}
