import { playSound, useCue } from "../audio/index.js";
import { MASTERY_STEPS, MASTERY_SKIN_RANK } from "../game/constants.js";
import { byId } from "../skins/catalog.js";
import { FRAME_GRADES } from "./title-design.js";
import { TitleFrame } from "./title-frame.jsx";
import { L, Lx } from "../i18n/index.js";

/** スキン id → 短い呼び名(絵札の名前)。無ければ id をそのまま */
const skinLabel = (id) => Lx(byId(id)?.name) || id;

/**
 * 終局画面に出す、スキンごとの熟練度のメーター(2026-09-22 着手。2026-09-24 でスキン制に)。
 *
 * その局で使った所持スキン(王にしたスキン・盤に出したスキン)を出して「どれだけ上がったか」を見せる。
 * 段に届いた行だけ印を強くする。
 */
export function MasteryGains({ gains, titles }) {
  useCue("mastery", !!gains?.some(g => g.after > g.before && g.added > 0));
  // 王を一度も動かさなかった局は、欄ごと出さない
  if (!gains || !gains.length) return null;
  // 王は1局に1種類なので、ふつうは1行。念のため並べ替えは残す
  const rows = [...gains].sort(
    (a, b) => b.added - a.added || b.after - a.after,
  );
  return (
    <section className="mastery-gains" aria-label={L("スキンの熟練度")}>
      <h4 className="mastery-gains-head">
        <span>{L("スキンの熟練度")}</span>
        <small>{L("使ったスキンにたまる点")}</small>
      </h4>
      {rows.map((g) => {
        const p = g.progress;
        const stepUp = p.step > g.stepBefore;
        return (
          <div
            key={g.skin}
            className={`mastery-row${stepUp ? " mastery-row-up" : ""}`}
          >
            <b className="mastery-rank">{MASTERY_SKIN_RANK[g.skin] || ""}</b>
            <div className="mastery-meter">
              <div
                className="mastery-track"
                role="progressbar"
                aria-label={L("{name} の熟練度", { name: skinLabel(g.skin) })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(p.ratio * 100)}
                aria-valuetext={
                  p.done
                    ? L("極み（{n}点）", { n: p.count })
                    : L("{n}点。次の段まであと{left}点", {
                        n: p.count,
                        left: p.left,
                      })
                }
              >
                <span style={{ width: `${p.ratio * 100}%` }} />
              </div>
              <div className="mastery-detail">
                <span>
                  {p.done
                    ? L("極み · 累計{n}点", { n: p.count })
                    : L("{n} / {next}点", { n: p.count, next: p.next })}
                </span>
                {stepUp ? (
                  <b className="mastery-up">
                    {p.done
                      ? L("極みに到達")
                      : FRAME_GRADES[p.step - 1]
                        ? L("{name}に到達", { name: FRAME_GRADES[p.step - 1].name })
                        : L("段{n}に到達", { n: p.step })}
                  </b>
                ) : p.done ? (
                  <span>{L("これ以上は上がりません")}</span>
                ) : (
                  <span>{L("次の段まであと {n}", { n: p.left })}</span>
                )}
              </div>
            </div>
            <span className="mastery-added">+{g.added}</span>
            <small className="mastery-skin-name">{skinLabel(g.skin)}</small>
            {/* 点の内訳(2026-09-24)。何で稼いだかが分からないと、次に何をすればいいか分からない */}
            {g.points && (
              <small className="mastery-breakdown">
                {[
                  g.points.king ? L("王に選んだ +{n}", { n: g.points.king }) : null,
                  g.points.pieces ? L("駒を出した +{n}", { n: g.points.pieces }) : null,
                  g.points.moves ? L("王を動かした +{n}", { n: g.points.moves }) : null,
                  g.points.captures ? L("王で取った +{n}", { n: g.points.captures }) : null,
                  g.points.kingCapture ? L("王を討った +{n}", { n: g.points.kingCapture }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            )}
          </div>
        );
      })}
      {/* この局で届いた称号は、額縁ごと見せる。数字だけでは手に入れた実感が薄い */}
      {titles && titles.length > 0 && (
        <div className="mastery-earned">
          <small>{L("称号を手に入れました")}</small>
          {titles.map((t) => (
            <TitleFrame key={t.id} id={t.id} size="compact" />
          ))}
        </div>
      )}
      {/* 段の境目を添える。あと何点でどうなるのかが読めないと、伸ばす気にならない */}
      <p className="mastery-steps-note">
        {L("段の境目: {steps}点", { steps: MASTERY_STEPS.join(" · ") })}
      </p>
    </section>
  );
}
